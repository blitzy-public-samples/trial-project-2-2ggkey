// Package storage provides secure and reliable storage operations for the file service
package storage

import (
    "context"
    "crypto/sha256"
    "encoding/hex"
    "errors"
    "fmt"
    "io"
    "path"
    "sync"
    "time"

    "github.com/aws/aws-sdk-go-v2/aws"
    "github.com/aws/aws-sdk-go-v2/aws/retry"
    "github.com/aws/aws-sdk-go-v2/config"
    "github.com/aws/aws-sdk-go-v2/service/kms"
    "github.com/aws/aws-sdk-go-v2/service/s3"
    "github.com/aws/aws-sdk-go-v2/service/s3/types"

    "src/backend/file-service/internal/config"
    "src/backend/file-service/internal/models"
    "src/backend/file-service/pkg/logger"
)

// Storage defines the interface for file storage operations
type Storage interface {
    Upload(ctx context.Context, file *models.File, reader io.Reader) error
    Download(ctx context.Context, file *models.File) (io.ReadCloser, error)
    Delete(ctx context.Context, file *models.File, softDelete bool) error
}

// S3Storage implements the Storage interface using AWS S3
type S3Storage struct {
    s3Client        *s3.Client
    kmsClient       *kms.Client
    bucket          string
    retryer         *retry.Retryer
    workerPool      *sync.Pool
    encryptionKeyID string
    logger          *logger.Logger
}

// NewS3Storage creates a new S3Storage instance with the provided configuration
func NewS3Storage(cfg *config.Config) (*S3Storage, error) {
    log := logger.GetLogger()

    // Configure AWS SDK
    awsCfg, err := config.LoadDefaultConfig(context.Background(),
        config.WithRegion(cfg.S3.Region),
        config.WithCredentialsProvider(aws.NewStaticCredentialsProvider(
            cfg.S3.AccessKey,
            cfg.S3.SecretKey,
            cfg.S3.SessionToken,
        )),
        config.WithRetryer(func() aws.Retryer {
            return retry.NewStandard(func(o *retry.StandardOptions) {
                o.MaxAttempts = cfg.S3.RetryMax
            })
        }),
    )
    if err != nil {
        return nil, fmt.Errorf("failed to load AWS config: %w", err)
    }

    // Initialize S3 client with custom endpoint if specified
    s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
        if cfg.S3.Endpoint != "" {
            o.BaseEndpoint = aws.String(cfg.S3.Endpoint)
        }
        o.UsePathStyle = cfg.S3.ForcePathStyle
    })

    // Initialize KMS client for encryption
    kmsClient := kms.NewFromConfig(awsCfg)

    // Initialize worker pool for concurrent operations
    workerPool := &sync.Pool{
        New: func() interface{} {
            return make([]byte, 32*1024) // 32KB buffer size
        },
    }

    storage := &S3Storage{
        s3Client:   s3Client,
        kmsClient:  kmsClient,
        bucket:     cfg.S3.Bucket,
        workerPool: workerPool,
        logger:     log,
    }

    // Verify bucket exists and is accessible
    if err := storage.verifyBucket(context.Background()); err != nil {
        return nil, fmt.Errorf("bucket verification failed: %w", err)
    }

    return storage, nil
}

// Upload securely uploads a file to S3 with encryption and validation
func (s *S3Storage) Upload(ctx context.Context, file *models.File, reader io.Reader) error {
    log := s.logger.With(
        logger.zap.String("fileId", file.ID),
        logger.zap.String("fileName", file.FileName),
    )

    // Generate secure storage path
    storagePath := path.Join(file.ID[:2], file.ID[2:4], file.ID)
    
    // Calculate checksum while uploading
    hash := sha256.New()
    teeReader := io.TeeReader(reader, hash)

    // Configure server-side encryption
    uploadInput := &s3.PutObjectInput{
        Bucket: aws.String(s.bucket),
        Key:    aws.String(storagePath),
        Body:   teeReader,
        Metadata: map[string]string{
            "file-id":   file.ID,
            "filename": file.FileName,
        },
        ServerSideEncryption: types.ServerSideEncryptionAes256,
    }

    // Upload file with retry logic
    _, err := s.s3Client.PutObject(ctx, uploadInput)
    if err != nil {
        log.Error("Failed to upload file to S3",
            logger.zap.Error(err))
        return fmt.Errorf("s3 upload failed: %w", err)
    }

    // Update file metadata
    checksum := hex.EncodeToString(hash.Sum(nil))
    if err := file.UpdateChecksum(checksum); err != nil {
        log.Error("Failed to update file checksum",
            logger.zap.Error(err))
        return err
    }

    if err := file.SetStoragePath(storagePath); err != nil {
        log.Error("Failed to update storage path",
            logger.zap.Error(err))
        return err
    }

    if err := file.UpdateStatus(models.FileStatusUploaded); err != nil {
        log.Error("Failed to update file status",
            logger.zap.Error(err))
        return err
    }

    log.Info("File uploaded successfully",
        logger.zap.String("storagePath", storagePath),
        logger.zap.String("checksum", checksum))

    return nil
}

// Download securely downloads a file from S3 with validation
func (s *S3Storage) Download(ctx context.Context, file *models.File) (io.ReadCloser, error) {
    log := s.logger.With(
        logger.zap.String("fileId", file.ID),
        logger.zap.String("storagePath", file.StoragePath),
    )

    if !file.IsUploaded() {
        return nil, errors.New("file is not in uploaded state")
    }

    // Configure download request
    input := &s3.GetObjectInput{
        Bucket: aws.String(s.bucket),
        Key:    aws.String(file.StoragePath),
    }

    // Download file with retry logic
    result, err := s.s3Client.GetObject(ctx, input)
    if err != nil {
        log.Error("Failed to download file from S3",
            logger.zap.Error(err))
        return nil, fmt.Errorf("s3 download failed: %w", err)
    }

    // Update last accessed timestamp
    file.UpdateLastAccessed()

    log.Info("File download started")
    return result.Body, nil
}

// Delete removes a file from S3 with optional soft delete
func (s *S3Storage) Delete(ctx context.Context, file *models.File, softDelete bool) error {
    log := s.logger.With(
        logger.zap.String("fileId", file.ID),
        logger.zap.String("storagePath", file.StoragePath),
        logger.zap.Bool("softDelete", softDelete),
    )

    if file.IsDeleted() {
        return errors.New("file is already deleted")
    }

    if softDelete {
        // Move to archive prefix
        archivePath := path.Join("archive", file.StoragePath)
        copySource := path.Join(s.bucket, file.StoragePath)

        // Copy to archive location
        _, err := s.s3Client.CopyObject(ctx, &s3.CopyObjectInput{
            Bucket:     aws.String(s.bucket),
            CopySource: aws.String(copySource),
            Key:        aws.String(archivePath),
        })
        if err != nil {
            log.Error("Failed to archive file",
                logger.zap.Error(err))
            return fmt.Errorf("file archival failed: %w", err)
        }
    }

    // Delete original file
    _, err := s.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
        Bucket: aws.String(s.bucket),
        Key:    aws.String(file.StoragePath),
    })
    if err != nil {
        log.Error("Failed to delete file from S3",
            logger.zap.Error(err))
        return fmt.Errorf("s3 deletion failed: %w", err)
    }

    // Update file status
    if err := file.UpdateStatus(models.FileStatusDeleted); err != nil {
        log.Error("Failed to update file status",
            logger.zap.Error(err))
        return err
    }

    log.Info("File deleted successfully")
    return nil
}

// verifyBucket checks if the configured bucket exists and is accessible
func (s *S3Storage) verifyBucket(ctx context.Context) error {
    _, err := s.s3Client.HeadBucket(ctx, &s3.HeadBucketInput{
        Bucket: aws.String(s.bucket),
    })
    if err != nil {
        return fmt.Errorf("bucket verification failed: %w", err)
    }
    return nil
}