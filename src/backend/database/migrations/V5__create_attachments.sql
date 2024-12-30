-- PostgreSQL 14+ Migration Script
-- Creates attachments table with comprehensive auditing and security features

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create audit trigger function for attachments table
CREATE OR REPLACE FUNCTION create_attachments_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by,
            client_ip,
            user_agent
        ) VALUES (
            'attachments',
            NEW.id,
            'INSERT',
            NULL,
            to_jsonb(NEW),
            current_user,
            current_setting('app.client_ip', TRUE),
            current_setting('app.user_agent', TRUE)
        );
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by,
            client_ip,
            user_agent
        ) VALUES (
            'attachments',
            NEW.id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            current_user,
            current_setting('app.client_ip', TRUE),
            current_setting('app.user_agent', TRUE)
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by,
            client_ip,
            user_agent
        ) VALUES (
            'attachments',
            OLD.id,
            'DELETE',
            to_jsonb(OLD),
            NULL,
            current_user,
            current_setting('app.client_ip', TRUE),
            current_setting('app.user_agent', TRUE)
        );
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create attachments table
CREATE TABLE attachments (
    -- Primary identifier
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relationships
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    uploader_id uuid NOT NULL REFERENCES users(id),
    
    -- File metadata
    file_name varchar(255) NOT NULL CHECK (length(file_name) > 0 AND file_name ~ '^[^/\\:*?"<>|]+$'),
    content_type varchar(100) NOT NULL CHECK (content_type ~ '^[a-zA-Z0-9-]+/[a-zA-Z0-9-+.]+$'),
    size bigint NOT NULL CHECK (size > 0 AND size <= 104857600), -- Max 100MB
    storage_path text NOT NULL CHECK (storage_path ~ '^[a-zA-Z0-9-_/]+\.[a-zA-Z0-9]+$'),
    
    -- Status tracking
    status varchar(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'uploading', 'uploaded', 'failed', 'deleted')),
    
    -- Audit timestamps
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create optimized indexes
CREATE INDEX attachments_task_id_status_idx ON attachments (task_id, status);
CREATE INDEX attachments_uploader_id_idx ON attachments (uploader_id);
CREATE INDEX attachments_content_type_idx ON attachments (content_type);
CREATE INDEX attachments_created_at_idx ON attachments (created_at);

-- Create audit trigger
CREATE TRIGGER attachments_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON attachments
    FOR EACH ROW
    EXECUTE FUNCTION create_attachments_audit_trigger();

-- Create updated_at trigger
CREATE TRIGGER attachments_updated_at_trigger
    BEFORE UPDATE ON attachments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add table comments
COMMENT ON TABLE attachments IS 'Stores file attachment metadata and relationships to tasks';
COMMENT ON COLUMN attachments.id IS 'Unique identifier for the attachment';
COMMENT ON COLUMN attachments.task_id IS 'Reference to the associated task';
COMMENT ON COLUMN attachments.uploader_id IS 'Reference to the user who uploaded the file';
COMMENT ON COLUMN attachments.file_name IS 'Original name of the uploaded file';
COMMENT ON COLUMN attachments.content_type IS 'MIME type of the uploaded file';
COMMENT ON COLUMN attachments.size IS 'Size of the file in bytes (max 100MB)';
COMMENT ON COLUMN attachments.storage_path IS 'Path where the file is stored in object storage';
COMMENT ON COLUMN attachments.status IS 'Current status of the file upload process';
COMMENT ON COLUMN attachments.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN attachments.updated_at IS 'Timestamp when the record was last updated';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON attachments TO app_user;
GRANT USAGE, SELECT ON SEQUENCE attachments_id_seq TO app_user;