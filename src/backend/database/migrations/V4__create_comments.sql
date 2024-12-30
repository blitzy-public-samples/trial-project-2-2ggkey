-- PostgreSQL 14+ Migration Script
-- Creates comments table with comprehensive auditing and optimized indexing

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create audit function for comments table
CREATE OR REPLACE FUNCTION create_comments_audit_trigger()
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
            changed_at
        ) VALUES (
            'comments',
            NEW.id,
            'INSERT',
            NULL,
            to_jsonb(NEW),
            current_user,
            CURRENT_TIMESTAMP
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by,
            changed_at
        ) VALUES (
            'comments',
            NEW.id,
            'UPDATE',
            to_jsonb(OLD),
            to_jsonb(NEW),
            current_user,
            CURRENT_TIMESTAMP
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by,
            changed_at
        ) VALUES (
            'comments',
            OLD.id,
            'DELETE',
            to_jsonb(OLD),
            NULL,
            current_user,
            CURRENT_TIMESTAMP
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create comments table
CREATE TABLE comments (
    -- Primary identifier
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Relationships
    task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES users(id),
    parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
    
    -- Content
    content text NOT NULL,
    mentioned_users uuid[] NOT NULL DEFAULT '{}',
    
    -- Metadata
    is_edited boolean NOT NULL DEFAULT FALSE,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Validation
    CONSTRAINT content_not_empty CHECK (length(trim(content)) > 0),
    CONSTRAINT valid_mentioned_users CHECK (
        -- Ensure all mentioned users exist in users table
        mentioned_users <@ (SELECT ARRAY_AGG(id) FROM users)
    )
);

-- Create optimized indexes
CREATE INDEX comments_task_id_created_at_idx ON comments (task_id, created_at);
CREATE INDEX comments_author_id_idx ON comments (author_id);
CREATE INDEX comments_parent_id_idx ON comments (parent_id);
CREATE INDEX comments_mentioned_users_idx ON comments USING gin (mentioned_users);

-- Create trigger for audit logging
CREATE TRIGGER comments_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION create_comments_audit_trigger();

-- Create trigger for updating updated_at timestamp
CREATE TRIGGER comments_updated_at_trigger
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments for database administrators
COMMENT ON TABLE comments IS 'Stores task-related comments with user attribution and threading support';
COMMENT ON COLUMN comments.id IS 'Unique identifier for the comment';
COMMENT ON COLUMN comments.task_id IS 'Reference to the task this comment belongs to';
COMMENT ON COLUMN comments.author_id IS 'User who created the comment';
COMMENT ON COLUMN comments.parent_id IS 'Parent comment ID for nested replies';
COMMENT ON COLUMN comments.content IS 'Text content of the comment';
COMMENT ON COLUMN comments.mentioned_users IS 'Array of user IDs mentioned in the comment';
COMMENT ON COLUMN comments.is_edited IS 'Indicates if the comment has been edited';
COMMENT ON COLUMN comments.created_at IS 'Timestamp when the comment was created';
COMMENT ON COLUMN comments.updated_at IS 'Timestamp when the comment was last updated';

-- Create rollback function (will be used if migration needs to be reverted)
CREATE OR REPLACE FUNCTION rollback_v4_migration()
RETURNS void AS $$
BEGIN
    DROP TABLE IF EXISTS comments CASCADE;
    DROP FUNCTION IF EXISTS create_comments_audit_trigger();
    DROP FUNCTION IF EXISTS rollback_v4_migration();
END;
$$ LANGUAGE plpgsql;