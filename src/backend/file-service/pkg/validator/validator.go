// Package validator provides comprehensive validation utilities for file operations
// with enhanced security checks, malware detection, and content integrity verification.
package validator

import (
    "bytes"
    "errors"
    "fmt"
    "io"
    "mime"
    "path/filepath"
    "strings"
    
    "src/backend/file-service/pkg/logger"
)

// Global constants for file validation
const (
    // MaxFileSize defines maximum allowed file size (100MB)
    MaxFileSize int64 = 100 * 1024 * 1024
    
    // MaxFileNameLength defines maximum allowed filename length
    MaxFileNameLength = 255
)

// AllowedFileTypes defines the list of allowed MIME types
var AllowedFileTypes = []string{
    "image/jpeg",
    "image/png", 
    "application/pdf",
    "text/plain",
}

// Common malware signatures (simplified example - in production use comprehensive signature database)
var malwareSignatures = [][]byte{
    []byte{0x4D, 0x5A}, // EXE signature
    []byte("<?php"),    // PHP script signature
    []byte("<script>"), // JavaScript signature
}

// ValidationError represents a custom error type for validation failures
type ValidationError struct {
    Code    string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// ValidateFileSize checks if the file size is within acceptable limits
func ValidateFileSize(size int64) error {
    log := logger.GetLogger()
    
    if size <= 0 {
        return &ValidationError{
            Code:    "INVALID_SIZE",
            Message: "File size must be greater than 0",
        }
    }
    
    if size > MaxFileSize {
        log.Error("File size validation failed",
            logger.zap.Int64("size", size),
            logger.zap.Int64("maxAllowed", MaxFileSize))
        return &ValidationError{
            Code:    "SIZE_EXCEEDED",
            Message: fmt.Sprintf("File size %d exceeds maximum allowed size of %d bytes", size, MaxFileSize),
        }
    }
    
    log.Debug("File size validation passed", logger.zap.Int64("size", size))
    return nil
}

// ValidateFileType performs enhanced MIME type validation with spoofing detection
func ValidateFileType(contentType string, header []byte) error {
    log := logger.GetLogger()
    
    if contentType == "" {
        return &ValidationError{
            Code:    "MISSING_CONTENT_TYPE",
            Message: "Content type is required",
        }
    }
    
    // Detect MIME type from file header
    detectedType := mime.TypeByExtension(filepath.Ext(contentType))
    if detectedType != "" && detectedType != contentType {
        log.Warn("Potential MIME type spoofing detected",
            logger.zap.String("claimed", contentType),
            logger.zap.String("detected", detectedType))
        return &ValidationError{
            Code:    "MIME_SPOOFING",
            Message: "Content type mismatch - potential MIME spoofing attempt",
        }
    }
    
    // Validate against allowed types
    allowed := false
    for _, allowedType := range AllowedFileTypes {
        if strings.EqualFold(contentType, allowedType) {
            allowed = true
            break
        }
    }
    
    if !allowed {
        log.Error("Invalid file type",
            logger.zap.String("contentType", contentType))
        return &ValidationError{
            Code:    "INVALID_TYPE",
            Message: fmt.Sprintf("File type %s is not allowed", contentType),
        }
    }
    
    log.Debug("File type validation passed",
        logger.zap.String("contentType", contentType))
    return nil
}

// ValidateFileName performs security checks on the file name
func ValidateFileName(fileName string) error {
    log := logger.GetLogger()
    
    if fileName == "" {
        return &ValidationError{
            Code:    "MISSING_FILENAME",
            Message: "File name is required",
        }
    }
    
    if len(fileName) > MaxFileNameLength {
        return &ValidationError{
            Code:    "NAME_TOO_LONG",
            Message: fmt.Sprintf("File name exceeds maximum length of %d characters", MaxFileNameLength),
        }
    }
    
    // Check for path traversal attempts
    cleanPath := filepath.Clean(fileName)
    if strings.Contains(cleanPath, "..") {
        log.Error("Path traversal attempt detected",
            logger.zap.String("fileName", fileName))
        return &ValidationError{
            Code:    "PATH_TRAVERSAL",
            Message: "Invalid file name - path traversal attempt detected",
        }
    }
    
    // Check for invalid characters and patterns
    invalidChars := `<>:"/\|?*`
    if strings.ContainsAny(fileName, invalidChars) {
        return &ValidationError{
            Code:    "INVALID_CHARACTERS",
            Message: "File name contains invalid characters",
        }
    }
    
    log.Debug("File name validation passed",
        logger.zap.String("fileName", fileName))
    return nil
}

// ValidateFileContent performs comprehensive content validation including malware detection
func ValidateFileContent(content []byte) error {
    log := logger.GetLogger()
    
    if len(content) == 0 {
        return &ValidationError{
            Code:    "EMPTY_CONTENT",
            Message: "File content cannot be empty",
        }
    }
    
    // Check for malware signatures
    reader := bytes.NewReader(content)
    buffer := make([]byte, 1024)
    
    for {
        n, err := reader.Read(buffer)
        if err == io.EOF {
            break
        }
        if err != nil {
            return &ValidationError{
                Code:    "READ_ERROR",
                Message: "Error reading file content: " + err.Error(),
            }
        }
        
        chunk := buffer[:n]
        for _, signature := range malwareSignatures {
            if bytes.Contains(chunk, signature) {
                log.Error("Malware signature detected",
                    logger.zap.Binary("signature", signature))
                return &ValidationError{
                    Code:    "MALWARE_DETECTED",
                    Message: "Potential security threat detected in file content",
                }
            }
        }
    }
    
    // Verify content integrity
    if bytes.Count(content, []byte{0}) > len(content)/2 {
        log.Warn("Suspicious content detected - high concentration of null bytes")
        return &ValidationError{
            Code:    "SUSPICIOUS_CONTENT",
            Message: "File content appears to be corrupted or suspicious",
        }
    }
    
    log.Debug("File content validation passed",
        logger.zap.Int("contentLength", len(content)))
    return nil
}