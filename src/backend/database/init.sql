-- PostgreSQL 14+ Initial Database Setup Script
-- Purpose: Configure database extensions, audit logging, and utility functions
-- Security: Implements encryption, audit logging, and data integrity features

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- For UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- For encryption functions

-- Set search path to ensure extensions are accessible
SET search_path TO public;

-- Create audit log table for comprehensive change tracking
CREATE TABLE IF NOT EXISTS audit_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name varchar(50) NOT NULL,
    operation varchar(20) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data jsonb,
    new_data jsonb,
    changed_by uuid NOT NULL,  -- References users table (created in V1__create_users.sql)
    changed_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT audit_log_operation_check CHECK (
        CASE operation
            WHEN 'INSERT' THEN old_data IS NULL AND new_data IS NOT NULL
            WHEN 'UPDATE' THEN old_data IS NOT NULL AND new_data IS NOT NULL
            WHEN 'DELETE' THEN old_data IS NOT NULL AND new_data IS NULL
        END
    )
);

-- Create optimized indexes for audit log queries
CREATE INDEX IF NOT EXISTS audit_log_table_name_idx ON audit_log USING btree (table_name);
CREATE INDEX IF NOT EXISTS audit_log_changed_at_idx ON audit_log USING brin (changed_at);
CREATE INDEX IF NOT EXISTS audit_log_changed_by_idx ON audit_log USING btree (changed_by);
CREATE INDEX IF NOT EXISTS audit_log_operation_idx ON audit_log USING btree (operation);

-- Create function to automatically update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    -- Ensure NEW row exists
    IF NEW IS NULL THEN
        RAISE EXCEPTION 'Cannot update updated_at on NULL row';
    END IF;

    -- Set the updated_at timestamp
    NEW.updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

COMMENT ON FUNCTION update_updated_at_column() IS 
'Trigger function to automatically update updated_at timestamp columns';

-- Create enhanced audit log entry function with error handling
CREATE OR REPLACE FUNCTION create_audit_log_entry(
    old_data jsonb,
    new_data jsonb,
    operation varchar,
    table_name varchar
)
RETURNS void AS $$
DECLARE
    current_user_id uuid;
BEGIN
    -- Validate input parameters
    IF table_name IS NULL OR operation IS NULL THEN
        RAISE EXCEPTION 'Table name and operation are required parameters';
    END IF;

    -- Validate operation type
    IF operation NOT IN ('INSERT', 'UPDATE', 'DELETE') THEN
        RAISE EXCEPTION 'Invalid operation type: %', operation;
    END IF;

    -- Get current user ID from session context
    -- Note: This assumes set_config('app.current_user_id', user_id, true) is called during connection setup
    current_user_id := current_setting('app.current_user_id', true)::uuid;
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Current user ID not found in session context';
    END IF;

    -- Insert audit log entry
    INSERT INTO audit_log (
        table_name,
        operation,
        old_data,
        new_data,
        changed_by,
        changed_at
    ) VALUES (
        table_name,
        operation,
        old_data,
        new_data,
        current_user_id,
        CURRENT_TIMESTAMP
    );

EXCEPTION
    WHEN others THEN
        -- Log the error and re-raise
        RAISE EXCEPTION 'Error creating audit log entry: %', SQLERRM;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY INVOKER;

COMMENT ON FUNCTION create_audit_log_entry(jsonb, jsonb, varchar, varchar) IS 
'Creates standardized audit log entries with error handling and user attribution';

-- Create helper function to encrypt sensitive data
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data text)
RETURNS text AS $$
BEGIN
    RETURN encode(
        encrypt_iv(
            data::bytea,
            current_setting('app.encryption_key')::bytea,
            current_setting('app.encryption_iv')::bytea,
            'aes'
        ),
        'hex'
    );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

COMMENT ON FUNCTION encrypt_sensitive_data(text) IS 
'Encrypts sensitive data using AES encryption with app-specific key and IV';

-- Create helper function to decrypt sensitive data
CREATE OR REPLACE FUNCTION decrypt_sensitive_data(encrypted_data text)
RETURNS text AS $$
BEGIN
    RETURN convert_from(
        decrypt_iv(
            decode(encrypted_data, 'hex'),
            current_setting('app.encryption_key')::bytea,
            current_setting('app.encryption_iv')::bytea,
            'aes'
        ),
        'UTF8'
    );
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

COMMENT ON FUNCTION decrypt_sensitive_data(text) IS 
'Decrypts sensitive data using AES encryption with app-specific key and IV';

-- Set up basic security policies
ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM PUBLIC;

-- Grant specific permissions to application role
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_log TO app_user;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO app_user;
GRANT EXECUTE ON FUNCTION create_audit_log_entry(jsonb, jsonb, varchar, varchar) TO app_user;
GRANT EXECUTE ON FUNCTION encrypt_sensitive_data(text) TO app_user;
GRANT EXECUTE ON FUNCTION decrypt_sensitive_data(text) TO app_user;

-- Create index for audit log JSON queries
CREATE INDEX IF NOT EXISTS audit_log_new_data_gin_idx ON audit_log USING gin (new_data);
CREATE INDEX IF NOT EXISTS audit_log_old_data_gin_idx ON audit_log USING gin (old_data);

-- Add table comment
COMMENT ON TABLE audit_log IS 'Stores comprehensive audit trail for all database changes';