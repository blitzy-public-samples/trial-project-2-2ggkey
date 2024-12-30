// Package repository implements data persistence layer for file metadata management
package repository

import (
    "context"
    "database/sql"
    "errors"
    "fmt"
    "time"

    "src/backend/file-service/internal/models"
    "src/backend/file-service/pkg/logger"
)

// Common errors
var (
    ErrNotFound = errors.New("file not found")
    ErrInvalidID = errors.New("invalid file ID")
    ErrInvalidTransaction = errors.New("invalid transaction")
)

// FileRepository defines the interface for file metadata persistence operations
type FileRepository interface {
    Create(ctx context.Context, file *models.File) error
    GetByID(ctx context.Context, id string) (*models.File, error)
    Update(ctx context.Context, file *models.File) error
    Delete(ctx context.Context, id string) error
    List(ctx context.Context, offset, limit int, filters map[string]interface{}) ([]*models.File, int64, error)
}

// fileRepository implements FileRepository interface using PostgreSQL
type fileRepository struct {
    db *sql.DB
    log *logger.Logger
}

// NewFileRepository creates a new instance of fileRepository
func NewFileRepository(db *sql.DB) (FileRepository, error) {
    if db == nil {
        return nil, errors.New("database connection is required")
    }

    return &fileRepository{
        db:  db,
        log: logger.GetLogger(),
    }, nil
}

// Create inserts a new file record with audit trail
func (r *fileRepository) Create(ctx context.Context, file *models.File) error {
    if file == nil {
        return errors.New("file cannot be nil")
    }

    // Start transaction with high isolation level
    tx, err := r.db.BeginTx(ctx, &sql.TxOptions{
        Isolation: sql.LevelSerializable,
    })
    if err != nil {
        return fmt.Errorf("failed to start transaction: %w", err)
    }
    defer tx.Rollback()

    // Set audit timestamps
    now := time.Now().UTC()
    file.CreatedAt = now
    file.UpdatedAt = now

    // Insert file record with parameterized query
    const query = `
        INSERT INTO files (
            id, file_name, size, content_type, status, 
            storage_path, checksum, created_at, updated_at, last_accessed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `

    _, err = tx.ExecContext(ctx, query,
        file.ID, file.FileName, file.Size, file.ContentType,
        file.Status, file.StoragePath, file.Checksum,
        file.CreatedAt, file.UpdatedAt, file.LastAccessedAt,
    )
    if err != nil {
        return fmt.Errorf("failed to insert file: %w", err)
    }

    // Commit transaction
    if err = tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }

    r.log.Info("Created new file record",
        logger.zap.String("fileId", file.ID),
        logger.zap.String("fileName", file.FileName))

    return nil
}

// GetByID retrieves a file record by ID with audit logging
func (r *fileRepository) GetByID(ctx context.Context, id string) (*models.File, error) {
    if id == "" {
        return nil, ErrInvalidID
    }

    const query = `
        SELECT id, file_name, size, content_type, status,
               storage_path, checksum, created_at, updated_at, last_accessed_at
        FROM files
        WHERE id = $1 AND status != $2
    `

    file := &models.File{}
    err := r.db.QueryRowContext(ctx, query, id, models.FileStatusDeleted).Scan(
        &file.ID, &file.FileName, &file.Size, &file.ContentType,
        &file.Status, &file.StoragePath, &file.Checksum,
        &file.CreatedAt, &file.UpdatedAt, &file.LastAccessedAt,
    )

    if err == sql.ErrNoRows {
        r.log.Warn("File not found", logger.zap.String("fileId", id))
        return nil, ErrNotFound
    }
    if err != nil {
        return nil, fmt.Errorf("failed to get file: %w", err)
    }

    // Update last accessed timestamp
    _, err = r.db.ExecContext(ctx,
        "UPDATE files SET last_accessed_at = $1 WHERE id = $2",
        time.Now().UTC(), id,
    )
    if err != nil {
        r.log.Error("Failed to update last accessed timestamp",
            logger.zap.String("fileId", id),
            logger.zap.Error(err))
    }

    r.log.Info("Retrieved file record",
        logger.zap.String("fileId", id),
        logger.zap.String("fileName", file.FileName))

    return file, nil
}

// Update modifies an existing file record with audit trail
func (r *fileRepository) Update(ctx context.Context, file *models.File) error {
    if file == nil || file.ID == "" {
        return ErrInvalidID
    }

    tx, err := r.db.BeginTx(ctx, &sql.TxOptions{
        Isolation: sql.LevelSerializable,
    })
    if err != nil {
        return fmt.Errorf("failed to start transaction: %w", err)
    }
    defer tx.Rollback()

    file.UpdatedAt = time.Now().UTC()

    const query = `
        UPDATE files 
        SET file_name = $1, size = $2, content_type = $3,
            status = $4, storage_path = $5, checksum = $6,
            updated_at = $7
        WHERE id = $8 AND status != $9
    `

    result, err := tx.ExecContext(ctx, query,
        file.FileName, file.Size, file.ContentType,
        file.Status, file.StoragePath, file.Checksum,
        file.UpdatedAt, file.ID, models.FileStatusDeleted,
    )
    if err != nil {
        return fmt.Errorf("failed to update file: %w", err)
    }

    rows, err := result.RowsAffected()
    if err != nil {
        return fmt.Errorf("failed to get affected rows: %w", err)
    }
    if rows == 0 {
        return ErrNotFound
    }

    if err = tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }

    r.log.Info("Updated file record",
        logger.zap.String("fileId", file.ID),
        logger.zap.String("fileName", file.FileName))

    return nil
}

// Delete performs a soft deletion of a file record
func (r *fileRepository) Delete(ctx context.Context, id string) error {
    if id == "" {
        return ErrInvalidID
    }

    tx, err := r.db.BeginTx(ctx, &sql.TxOptions{
        Isolation: sql.LevelSerializable,
    })
    if err != nil {
        return fmt.Errorf("failed to start transaction: %w", err)
    }
    defer tx.Rollback()

    const query = `
        UPDATE files 
        SET status = $1, updated_at = $2
        WHERE id = $3 AND status != $4
    `

    result, err := tx.ExecContext(ctx, query,
        models.FileStatusDeleted,
        time.Now().UTC(),
        id,
        models.FileStatusDeleted,
    )
    if err != nil {
        return fmt.Errorf("failed to delete file: %w", err)
    }

    rows, err := result.RowsAffected()
    if err != nil {
        return fmt.Errorf("failed to get affected rows: %w", err)
    }
    if rows == 0 {
        return ErrNotFound
    }

    if err = tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }

    r.log.Info("Deleted file record", logger.zap.String("fileId", id))

    return nil
}

// List retrieves a paginated list of files with optional filters
func (r *fileRepository) List(ctx context.Context, offset, limit int, filters map[string]interface{}) ([]*models.File, int64, error) {
    if offset < 0 || limit <= 0 {
        return nil, 0, errors.New("invalid pagination parameters")
    }

    // Build query with filters
    whereClause := "WHERE status != $1"
    args := []interface{}{models.FileStatusDeleted}
    argCount := 2

    if filters != nil {
        for key, value := range filters {
            whereClause += fmt.Sprintf(" AND %s = $%d", key, argCount)
            args = append(args, value)
            argCount++
        }
    }

    // Get total count
    var total int64
    countQuery := fmt.Sprintf("SELECT COUNT(*) FROM files %s", whereClause)
    err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
    if err != nil {
        return nil, 0, fmt.Errorf("failed to get total count: %w", err)
    }

    // Get paginated results
    query := fmt.Sprintf(`
        SELECT id, file_name, size, content_type, status,
               storage_path, checksum, created_at, updated_at, last_accessed_at
        FROM files %s
        ORDER BY created_at DESC
        LIMIT $%d OFFSET $%d
    `, whereClause, argCount, argCount+1)

    args = append(args, limit, offset)
    rows, err := r.db.QueryContext(ctx, query, args...)
    if err != nil {
        return nil, 0, fmt.Errorf("failed to list files: %w", err)
    }
    defer rows.Close()

    var files []*models.File
    for rows.Next() {
        file := &models.File{}
        err := rows.Scan(
            &file.ID, &file.FileName, &file.Size, &file.ContentType,
            &file.Status, &file.StoragePath, &file.Checksum,
            &file.CreatedAt, &file.UpdatedAt, &file.LastAccessedAt,
        )
        if err != nil {
            return nil, 0, fmt.Errorf("failed to scan file: %w", err)
        }
        files = append(files, file)
    }

    if err = rows.Err(); err != nil {
        return nil, 0, fmt.Errorf("error iterating rows: %w", err)
    }

    r.log.Info("Listed files",
        logger.zap.Int("count", len(files)),
        logger.zap.Int("offset", offset),
        logger.zap.Int("limit", limit))

    return files, total, nil
}