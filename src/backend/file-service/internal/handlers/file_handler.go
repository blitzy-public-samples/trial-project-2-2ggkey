// Package handlers provides HTTP request handlers for file service operations
// with comprehensive security, validation, monitoring, and error handling.
package handlers

import (
    "context"
    "encoding/json"
    "errors"
    "fmt"
    "io"
    "mime/multipart"
    "net/http"
    "path/filepath"
    "strconv"
    "time"

    "go.uber.org/ratelimit" // v0.2.0
    "go.uber.org/zap"       // v1.24.0
    "go.uber.org/metrics"   // v0.3.0

    "src/backend/file-service/internal/service"
    "src/backend/file-service/pkg/validator"
)

// Global constants for file handling
const (
    maxFileSize           = int64(100 * 1024 * 1024) // 100MB
    defaultPageSize      = 20
    maxRequestsPerSecond = 100
)

var allowedFileTypes = []string{".pdf", ".doc", ".docx", ".txt"}

// FileHandler handles HTTP requests for file operations
type FileHandler struct {
    fileService     service.FileService
    logger          *zap.Logger
    rateLimiter     ratelimit.Limiter
    metricsCollector metrics.Collector
}

// NewFileHandler creates a new FileHandler instance
func NewFileHandler(fileService service.FileService, metricsCollector metrics.Collector) *FileHandler {
    return &FileHandler{
        fileService:      fileService,
        logger:          zap.L().Named("file-handler"),
        rateLimiter:     ratelimit.New(maxRequestsPerSecond),
        metricsCollector: metricsCollector,
    }
}

// UploadHandler handles file upload requests
func (h *FileHandler) UploadHandler(w http.ResponseWriter, r *http.Request) {
    // Apply rate limiting
    h.rateLimiter.Take()

    // Start metrics tracking
    start := time.Now()
    defer func() {
        h.metricsCollector.Timing("file.upload.duration", time.Since(start))
    }()

    // Validate request method
    if r.Method != http.MethodPost {
        h.sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
        return
    }

    // Parse multipart form with size limit
    if err := r.ParseMultipartForm(maxFileSize); err != nil {
        h.logger.Error("Failed to parse multipart form",
            zap.Error(err))
        h.sendError(w, http.StatusBadRequest, "Invalid request: "+err.Error())
        return
    }

    file, header, err := r.FormFile("file")
    if err != nil {
        h.logger.Error("Failed to get file from form",
            zap.Error(err))
        h.sendError(w, http.StatusBadRequest, "Failed to get file from request")
        return
    }
    defer file.Close()

    // Validate file size
    if header.Size > maxFileSize {
        h.logger.Warn("File size exceeds limit",
            zap.Int64("size", header.Size),
            zap.Int64("maxSize", maxFileSize))
        h.sendError(w, http.StatusBadRequest, "File size exceeds maximum allowed size")
        return
    }

    // Validate file type
    ext := filepath.Ext(header.Filename)
    if !isAllowedFileType(ext) {
        h.logger.Warn("Invalid file type",
            zap.String("filename", header.Filename),
            zap.String("extension", ext))
        h.sendError(w, http.StatusBadRequest, "File type not allowed")
        return
    }

    // Create context with timeout
    ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
    defer cancel()

    // Upload file
    uploadedFile, err := h.fileService.Upload(ctx, header.Filename, header.Header.Get("Content-Type"), header.Size, file)
    if err != nil {
        h.logger.Error("Failed to upload file",
            zap.String("filename", header.Filename),
            zap.Error(err))
        h.sendError(w, http.StatusInternalServerError, "Failed to upload file")
        return
    }

    // Increment upload counter
    h.metricsCollector.Counter("file.upload.count").Inc(1)

    // Send success response
    h.sendJSON(w, http.StatusCreated, uploadedFile)
}

// DownloadHandler handles file download requests
func (h *FileHandler) DownloadHandler(w http.ResponseWriter, r *http.Request) {
    h.rateLimiter.Take()

    start := time.Now()
    defer func() {
        h.metricsCollector.Timing("file.download.duration", time.Since(start))
    }()

    if r.Method != http.MethodGet {
        h.sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
        return
    }

    fileID := r.URL.Query().Get("id")
    if fileID == "" {
        h.sendError(w, http.StatusBadRequest, "File ID is required")
        return
    }

    ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
    defer cancel()

    file, reader, err := h.fileService.Download(ctx, fileID)
    if err != nil {
        if errors.Is(err, service.ErrFileNotFound) {
            h.sendError(w, http.StatusNotFound, "File not found")
            return
        }
        h.logger.Error("Failed to download file",
            zap.String("fileId", fileID),
            zap.Error(err))
        h.sendError(w, http.StatusInternalServerError, "Failed to download file")
        return
    }
    defer reader.Close()

    // Set response headers
    w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", file.FileName))
    w.Header().Set("Content-Type", file.ContentType)
    w.Header().Set("Content-Length", strconv.FormatInt(file.Size, 10))

    // Stream file content
    if _, err := io.Copy(w, reader); err != nil {
        h.logger.Error("Failed to stream file content",
            zap.String("fileId", fileID),
            zap.Error(err))
        return
    }

    h.metricsCollector.Counter("file.download.count").Inc(1)
}

// DeleteHandler handles file deletion requests
func (h *FileHandler) DeleteHandler(w http.ResponseWriter, r *http.Request) {
    h.rateLimiter.Take()

    start := time.Now()
    defer func() {
        h.metricsCollector.Timing("file.delete.duration", time.Since(start))
    }()

    if r.Method != http.MethodDelete {
        h.sendError(w, http.StatusMethodNotAllowed, "Method not allowed")
        return
    }

    fileID := r.URL.Query().Get("id")
    if fileID == "" {
        h.sendError(w, http.StatusBadRequest, "File ID is required")
        return
    }

    // Parse soft delete option
    softDelete := r.URL.Query().Get("soft") == "true"

    ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
    defer cancel()

    if err := h.fileService.Delete(ctx, fileID, softDelete); err != nil {
        if errors.Is(err, service.ErrFileNotFound) {
            h.sendError(w, http.StatusNotFound, "File not found")
            return
        }
        h.logger.Error("Failed to delete file",
            zap.String("fileId", fileID),
            zap.Error(err))
        h.sendError(w, http.StatusInternalServerError, "Failed to delete file")
        return
    }

    h.metricsCollector.Counter("file.delete.count").Inc(1)
    w.WriteHeader(http.StatusNoContent)
}

// Helper functions

func (h *FileHandler) sendError(w http.ResponseWriter, status int, message string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func (h *FileHandler) sendJSON(w http.ResponseWriter, status int, data interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    json.NewEncoder(w).Encode(data)
}

func isAllowedFileType(ext string) bool {
    for _, allowed := range allowedFileTypes {
        if ext == allowed {
            return true
        }
    }
    return false
}