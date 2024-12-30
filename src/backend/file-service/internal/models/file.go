// Package models provides core data structures and business logic for file management
package models

import (
    "errors"
    "time"

    "github.com/google/uuid" // v1.3.0
    "src/backend/file-service/pkg/validator"
    "src/backend/file-service/pkg/logger"
)

// File status constants
const (
    FileStatusPending  = "pending"
    FileStatusUploaded = "uploaded"
    FileStatusFailed   = "failed"
    FileStatusDeleted  = "deleted"
)

// Error definitions
var (
    ErrInvalidStatus = errors.New("invalid file status")
    ErrInvalidPath   = errors.New("invalid storage path")
    MaxFileSize      = int64(100 * 1024 * 1024) // 100MB
)

// File represents a secure file entity with comprehensive metadata
type File struct {
    ID            string    `json:"id" bson:"_id"`
    FileName      string    `json:"fileName" bson:"fileName"`
    Size          int64     `json:"size" bson:"size"`
    ContentType   string    `json:"contentType" bson:"contentType"`
    Status        string    `json:"status" bson:"status"`
    StoragePath   string    `json:"storagePath" bson:"storagePath"`
    Checksum      string    `json:"checksum" bson:"checksum"`
    CreatedAt     time.Time `json:"createdAt" bson:"createdAt"`
    UpdatedAt     time.Time `json:"updatedAt" bson:"updatedAt"`
    LastAccessedAt time.Time `json:"lastAccessedAt" bson:"lastAccessedAt"`
}

// NewFile creates a new File instance with comprehensive validation
func NewFile(fileName string, size int64, contentType string) (*File, error) {
    log := logger.GetLogger()
    
    // Validate file attributes
    if err := validator.ValidateFileName(fileName); err != nil {
        log.Error("File name validation failed",
            logger.zap.String("fileName", fileName),
            logger.zap.Error(err))
        return nil, err
    }

    if err := validator.ValidateFileSize(size); err != nil {
        log.Error("File size validation failed",
            logger.zap.Int64("size", size),
            logger.zap.Error(err))
        return nil, err
    }

    if err := validator.ValidateFileType(contentType, nil); err != nil {
        log.Error("Content type validation failed",
            logger.zap.String("contentType", contentType),
            logger.zap.Error(err))
        return nil, err
    }

    // Generate secure UUID for file ID
    fileID := uuid.New().String()
    now := time.Now().UTC()

    file := &File{
        ID:            fileID,
        FileName:      fileName,
        Size:          size,
        ContentType:   contentType,
        Status:        FileStatusPending,
        CreatedAt:     now,
        UpdatedAt:     now,
        LastAccessedAt: now,
    }

    log.Info("Created new file instance",
        logger.zap.String("fileId", fileID),
        logger.zap.String("fileName", fileName))

    return file, nil
}

// UpdateStatus updates the file status with validation
func (f *File) UpdateStatus(status string) error {
    log := logger.GetLogger()

    // Validate status transition
    validStatuses := map[string]bool{
        FileStatusPending:  true,
        FileStatusUploaded: true,
        FileStatusFailed:   true,
        FileStatusDeleted:  true,
    }

    if !validStatuses[status] {
        log.Error("Invalid status transition",
            logger.zap.String("fileId", f.ID),
            logger.zap.String("currentStatus", f.Status),
            logger.zap.String("newStatus", status))
        return ErrInvalidStatus
    }

    // Update status and timestamp
    f.Status = status
    f.UpdatedAt = time.Now().UTC()

    log.Info("Updated file status",
        logger.zap.String("fileId", f.ID),
        logger.zap.String("status", status))

    return nil
}

// SetStoragePath sets the validated storage path
func (f *File) SetStoragePath(path string) error {
    log := logger.GetLogger()

    // Validate storage path
    if err := validator.ValidateStoragePath(path); err != nil {
        log.Error("Storage path validation failed",
            logger.zap.String("fileId", f.ID),
            logger.zap.String("path", path),
            logger.zap.Error(err))
        return ErrInvalidPath
    }

    // Update storage path and timestamp
    f.StoragePath = path
    f.UpdatedAt = time.Now().UTC()

    log.Info("Updated file storage path",
        logger.zap.String("fileId", f.ID),
        logger.zap.String("path", path))

    return nil
}

// UpdateChecksum updates the file checksum for integrity verification
func (f *File) UpdateChecksum(checksum string) error {
    log := logger.GetLogger()

    if checksum == "" {
        log.Error("Empty checksum provided",
            logger.zap.String("fileId", f.ID))
        return errors.New("checksum cannot be empty")
    }

    f.Checksum = checksum
    f.UpdatedAt = time.Now().UTC()

    log.Info("Updated file checksum",
        logger.zap.String("fileId", f.ID),
        logger.zap.String("checksum", checksum))

    return nil
}

// UpdateLastAccessed updates the last accessed timestamp
func (f *File) UpdateLastAccessed() {
    f.LastAccessedAt = time.Now().UTC()
}

// IsUploaded checks if the file is in uploaded status
func (f *File) IsUploaded() bool {
    return f.Status == FileStatusUploaded
}

// IsDeleted checks if the file is in deleted status
func (f *File) IsDeleted() bool {
    return f.Status == FileStatusDeleted
}

// Validate performs comprehensive validation of the file instance
func (f *File) Validate() error {
    if err := validator.ValidateFileName(f.FileName); err != nil {
        return err
    }
    if err := validator.ValidateFileSize(f.Size); err != nil {
        return err
    }
    if err := validator.ValidateFileType(f.ContentType, nil); err != nil {
        return err
    }
    return nil
}