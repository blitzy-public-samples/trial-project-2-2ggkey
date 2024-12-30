-- Migration: V1__create_users.sql
-- Description: Initial migration to create users table with comprehensive user management support
-- Version: 1.0
-- Author: Task Management System Team

-- Create users table with all required fields for user management
CREATE TABLE users (
    -- Primary identifier using UUID for enhanced security
    id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    
    -- Authentication and contact fields
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    
    -- Account status flags
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Multi-factor authentication fields
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret VARCHAR(32), -- Encrypted TOTP secret
    
    -- Account security fields
    login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    
    -- Audit timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for optimizing common queries
CREATE INDEX users_email_idx ON users (email);
CREATE INDEX users_created_at_idx ON users (created_at);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE users IS 'Stores user account information with security and audit features';
COMMENT ON COLUMN users.id IS 'Unique identifier for user using UUID for enhanced security';
COMMENT ON COLUMN users.email IS 'User''s email address for authentication and communication';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password with work factor 12 for secure storage';
COMMENT ON COLUMN users.name IS 'User''s full name for display and identification';
COMMENT ON COLUMN users.is_active IS 'Flag indicating if user account is active or deactivated';
COMMENT ON COLUMN users.is_email_verified IS 'Flag indicating if user''s email has been verified';
COMMENT ON COLUMN users.mfa_enabled IS 'Flag indicating if multi-factor authentication is enabled';
COMMENT ON COLUMN users.mfa_secret IS 'Encrypted secret key for TOTP-based multi-factor authentication';
COMMENT ON COLUMN users.login_attempts IS 'Counter for failed login attempts for account security';
COMMENT ON COLUMN users.locked_until IS 'Timestamp until which account is locked due to failed attempts';
COMMENT ON COLUMN users.created_at IS 'Timestamp of record creation for audit tracking';
COMMENT ON COLUMN users.updated_at IS 'Timestamp of last record update for audit tracking';

-- Grant minimal required permissions
GRANT SELECT, INSERT, UPDATE ON users TO api_user;
GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO api_user;