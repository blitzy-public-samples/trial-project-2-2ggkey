// Package service implements the core file service business logic with enhanced security
// features, metadata tracking, and performance optimizations.
package service

import (
    "context"
    "crypto/sha256"
    "encoding/hex"
    "errors"
    "fmt"
    "io"
    "sync"
    "time"

    "src/backend/file-service/internal/models"
    "src/backend/file-service/internal/storage"
    "src/backend/file-service/pkg/logger"
    "src/backend/file-service/pkg/validator"
)

// Common errors
var (
    ErrInvalidInput     = errors.New("invalid input parameters")
    ErrFileNotFound     = errors.New("file not found")
    ErrOperationFailed  = errors.New("operation failed")
    ErrInvalidChecksum  = errors.New("checksum validation failed")
)

// WorkerPoolConfig defines configuration for the worker pool
type WorkerPoolConfig struct {
    MaxWorkers int
    QueueSize int
    BufferSize int
}

// FileService defines the interface for file operations
type FileService interface {
    Upload(ctx context.Context, fileName string, contentType string, size int64, reader io.Reader) (*models.File, error)
    Download(ctx context.Context, fileID string) (*models.File, io.ReadCloser, error)
    Delete(ctx context.Context, fileID string, softDelete bool) error
}

// fileService implements the FileService interface
type fileService struct {
    storage    storage.Storage
    workerPool *sync.Pool
    logger     *logger.Logger
    bufferSize int
}

// NewFileService creates a new instance of fileService
func NewFileService(storage storage.Storage, config WorkerPoolConfig) (FileService, error) {
    log := logger.GetLogger()

    // Validate dependencies and configuration
    if storage == nil {
        return nil, errors.New("storage implementation is required")
    }

    if config.MaxWorkers <= 0 {
        config.MaxWorkers = 10 // Default workers
    }
    if config.BufferSize <= 0 {
        config.BufferSize = 32 * 1024 // 32KB default buffer
    }

    // Initialize worker pool
    workerPool := &sync.Pool{
        New: func() interface{} {
            return make([]byte, config.BufferSize)
        },
    }

    service := &fileService{
        storage:    storage,
        workerPool: workerPool,
        logger:     log,
        bufferSize: config.BufferSize,
    }

    log.Info("File service initialized",
        logger.zap.Int("maxWorkers", config.MaxWorkers),
        logger.zap.Int("bufferSize", config.BufferSize))

    return service, nil
}

// Upload handles secure file upload with validation and encryption
func (s *fileService) Upload(ctx context.Context, fileName string, contentType string, 
    size int64, reader io.Reader) (*models.File, error) {
    
    log := s.logger.With(
        logger.zap.String("fileName", fileName),
        logger.zap.String("contentType", contentType),
        logger.zap.Int64("size", size),
    )

    // Validate input parameters
    if err := validator.ValidateFileName(fileName); err != nil {
        log.Error("File name validation failed", logger.zap.Error(err))
        return nil, fmt.Errorf("%w: %v", ErrInvalidInput, err)
    }

    if err := validator.ValidateFileType(contentType, nil); err != nil {
        log.Error("Content type validation failed", logger.zap.Error(err))
        return nil, fmt.Errorf("%w: %v", ErrInvalidInput, err)
    }

    if err := validator.ValidateFileSize(size); err != nil {
        log.Error("File size validation failed", logger.zap.Error(err))
        return nil, fmt.Errorf("%w: %v", ErrInvalidInput, err)
    }

    // Create file record
    file, err := models.NewFile(fileName, size, contentType)
    if err != nil {
        log.Error("Failed to create file record", logger.zap.Error(err))
        return nil, fmt.Errorf("%w: %v", ErrOperationFailed, err)
    }

    // Calculate checksum while uploading
    hash := sha256.New()
    teeReader := io.TeeReader(reader, hash)

    // Get buffer from pool
    buffer := s.workerPool.Get().([]byte)
    defer s.workerPool.Put(buffer)

    // Upload file with progress tracking
    if err := s.storage.Upload(ctx, file, teeReader); err != nil {
        log.Error("File upload failed", 
            logger.zap.String("fileId", file.ID),
            logger.zap.Error(err))
        return nil, fmt.Errorf("%w: %v", ErrOperationFailed, err)
    }

    // Update file checksum
    checksum := hex.EncodeToString(hash.Sum(nil))
    if err := file.UpdateChecksum(checksum); err != nil {
        log.Error("Failed to update checksum",
            logger.zap.String("fileId", file.ID),
            logger.zap.Error(err))
        return nil, fmt.Errorf("%w: %v", ErrOperationFailed, err)
    }

    log.Info("File upload completed successfully",
        logger.zap.String("fileId", file.ID),
        logger.zap.String("checksum", checksum))

    return file, nil
}

// Download handles secure file download with validation
func (s *fileService) Download(ctx context.Context, fileID string) (*models.File, io.ReadCloser, error) {
    log := s.logger.With(logger.zap.String("fileId", fileID))

    // Validate file ID
    if fileID == "" {
        return nil, nil, ErrInvalidInput
    }

    // Get file metadata
    file := &models.File{ID: fileID}
    if !file.IsUploaded() {
        log.Error("File not in uploaded state")
        return nil, nil, ErrFileNotFound
    }

    // Download file with validation
    reader, err := s.storage.Download(ctx, file)
    if err != nil {
        log.Error("File download failed", logger.zap.Error(err))
        return nil, nil, fmt.Errorf("%w: %v", ErrOperationFailed, err)
    }

    log.Info("File download started")
    return file, reader, nil
}

// Delete handles secure file deletion with optional soft delete
func (s *fileService) Delete(ctx context.Context, fileID string, softDelete bool) error {
    log := s.logger.With(
        logger.zap.String("fileId", fileID),
        logger.zap.Bool("softDelete", softDelete),
    )

    // Validate file ID
    if fileID == "" {
        return ErrInvalidInput
    }

    // Get file metadata
    file := &models.File{ID: fileID}
    if file.IsDeleted() {
        log.Warn("File already deleted")
        return nil
    }

    // Delete file with specified option
    if err := s.storage.Delete(ctx, file, softDelete); err != nil {
        log.Error("File deletion failed", logger.zap.Error(err))
        return fmt.Errorf("%w: %v", ErrOperationFailed, err)
    }

    log.Info("File deleted successfully")
    return nil
}