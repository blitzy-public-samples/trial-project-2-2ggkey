-- PostgreSQL 14+ Migration Script
-- Creates tasks table with comprehensive fields, constraints, indexes and audit capabilities

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tasks audit table
CREATE TABLE tasks_audit (
    audit_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_type varchar(10) NOT NULL CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
    operation_timestamp timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    operation_user varchar(100) NOT NULL,
    table_name varchar(50) NOT NULL DEFAULT 'tasks',
    record_id uuid NOT NULL,
    old_data jsonb,
    new_data jsonb,
    change_summary text
);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION create_tasks_audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO tasks_audit (
        operation_type,
        operation_user,
        record_id,
        old_data,
        new_data,
        change_summary
    )
    SELECT
        CASE
            WHEN TG_OP = 'INSERT' THEN 'INSERT'
            WHEN TG_OP = 'UPDATE' THEN 'UPDATE'
            WHEN TG_OP = 'DELETE' THEN 'DELETE'
        END,
        CURRENT_USER,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        CASE
            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
            WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD)
            ELSE NULL
        END,
        CASE
            WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)
            WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW)
            ELSE NULL
        END,
        CASE
            WHEN TG_OP = 'INSERT' THEN 'Task created'
            WHEN TG_OP = 'UPDATE' THEN 'Task updated'
            WHEN TG_OP = 'DELETE' THEN 'Task deleted'
        END;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create tasks table
CREATE TABLE tasks (
    -- Primary identifier
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Core task fields
    title varchar(200) NOT NULL CHECK (length(trim(title)) > 0),
    description text,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    creator_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
    
    -- Status and priority
    status varchar(20) NOT NULL DEFAULT 'TODO'
        CHECK (status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'BLOCKED')),
    priority varchar(10) NOT NULL DEFAULT 'MEDIUM'
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    
    -- Progress tracking
    due_date timestamp with time zone CHECK (due_date > created_at),
    completion_percentage decimal(5,2) NOT NULL DEFAULT 0.00
        CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    
    -- Attachments and comments
    attachment_urls text[] NOT NULL DEFAULT '{}'
        CHECK (array_length(attachment_urls, 1) <= 100),
    comments jsonb[] NOT NULL DEFAULT '{}',
    
    -- Audit timestamps
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create optimized indexes
CREATE INDEX tasks_project_id_status_idx ON tasks (project_id, status);
CREATE INDEX tasks_assignee_due_date_idx ON tasks (assignee_id, due_date);
CREATE INDEX tasks_todo_status_idx ON tasks (status) WHERE status = 'TODO';

-- Create audit trigger
CREATE TRIGGER tasks_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION create_tasks_audit_trigger();

-- Create updated_at trigger
CREATE TRIGGER tasks_updated_at_trigger
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE tasks IS 'Stores task information with comprehensive tracking and audit capabilities';
COMMENT ON COLUMN tasks.id IS 'Unique identifier for task using UUID v4';
COMMENT ON COLUMN tasks.title IS 'Task title with non-empty validation';
COMMENT ON COLUMN tasks.description IS 'Optional detailed task description';
COMMENT ON COLUMN tasks.project_id IS 'Project this task belongs to with cascading delete';
COMMENT ON COLUMN tasks.creator_id IS 'User who created the task with restrict delete';
COMMENT ON COLUMN tasks.assignee_id IS 'User assigned to the task with null on delete';
COMMENT ON COLUMN tasks.status IS 'Current task status with valid value constraint';
COMMENT ON COLUMN tasks.priority IS 'Task priority level with valid value constraint';
COMMENT ON COLUMN tasks.due_date IS 'Task deadline with future date validation';
COMMENT ON COLUMN tasks.completion_percentage IS 'Task completion percentage with range validation';
COMMENT ON COLUMN tasks.attachment_urls IS 'Array of attachment URLs with max limit';
COMMENT ON COLUMN tasks.comments IS 'Array of comment objects with JSON validation';
COMMENT ON COLUMN tasks.created_at IS 'Record creation timestamp with timezone';
COMMENT ON COLUMN tasks.updated_at IS 'Record update timestamp with timezone';

-- Add rollback capability
CREATE OR REPLACE PROCEDURE rollback_v3_migration()
LANGUAGE plpgsql
AS $$
BEGIN
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS tasks_audit;
    DROP FUNCTION IF EXISTS create_tasks_audit_trigger();
    DROP FUNCTION IF EXISTS update_updated_at_column();
END;
$$;