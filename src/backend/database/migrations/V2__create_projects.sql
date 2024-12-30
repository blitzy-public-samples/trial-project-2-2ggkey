-- PostgreSQL 14+ Migration Script
-- Creates projects table with comprehensive project management support
-- Implements audit logging, team handling, and optimized indexes

-- Create enum type for project status to ensure data integrity
DO $$ BEGIN
    CREATE TYPE project_status AS ENUM (
        'PLANNING',
        'IN_PROGRESS',
        'ON_HOLD',
        'COMPLETED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create projects table with comprehensive structure
CREATE TABLE projects (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(100) NOT NULL,
    description text,
    owner_id uuid NOT NULL REFERENCES users(id),
    status project_status NOT NULL DEFAULT 'PLANNING',
    due_date timestamp with time zone,
    team_member_ids uuid[] NOT NULL DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Add constraint to ensure team_member_ids array elements are valid user IDs
    CONSTRAINT valid_team_members FOREIGN KEY (unnest(team_member_ids)) 
        REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Add constraint to ensure project name is not empty
    CONSTRAINT project_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Create optimized indexes for common query patterns
CREATE INDEX projects_owner_id_idx ON projects USING btree (owner_id);
CREATE INDEX projects_status_idx ON projects USING btree (status);
CREATE INDEX projects_due_date_idx ON projects USING btree (due_date);
CREATE INDEX projects_team_member_ids_idx ON projects USING gin (team_member_ids);

-- Create function for audit logging
CREATE OR REPLACE FUNCTION create_projects_audit_trigger() 
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by
        ) VALUES (
            'projects',
            NEW.id,
            'INSERT',
            null,
            jsonb_build_object(
                'name', NEW.name,
                'description', NEW.description,
                'owner_id', NEW.owner_id,
                'status', NEW.status,
                'due_date', NEW.due_date,
                'team_member_ids', NEW.team_member_ids
            ),
            current_user
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by
        ) VALUES (
            'projects',
            NEW.id,
            'UPDATE',
            jsonb_build_object(
                'name', OLD.name,
                'description', OLD.description,
                'owner_id', OLD.owner_id,
                'status', OLD.status,
                'due_date', OLD.due_date,
                'team_member_ids', OLD.team_member_ids
            ),
            jsonb_build_object(
                'name', NEW.name,
                'description', NEW.description,
                'owner_id', NEW.owner_id,
                'status', NEW.status,
                'due_date', NEW.due_date,
                'team_member_ids', NEW.team_member_ids
            ),
            current_user
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            changed_by
        ) VALUES (
            'projects',
            OLD.id,
            'DELETE',
            jsonb_build_object(
                'name', OLD.name,
                'description', OLD.description,
                'owner_id', OLD.owner_id,
                'status', OLD.status,
                'due_date', OLD.due_date,
                'team_member_ids', OLD.team_member_ids
            ),
            null,
            current_user
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for audit logging and timestamp updates
CREATE TRIGGER projects_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION create_projects_audit_trigger();

CREATE TRIGGER projects_updated_at_trigger
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create index for efficient audit log queries
CREATE INDEX projects_created_at_idx ON projects USING btree (created_at);
CREATE INDEX projects_updated_at_idx ON projects USING btree (updated_at);

-- Add comments for documentation
COMMENT ON TABLE projects IS 'Stores project information with team management and tracking capabilities';
COMMENT ON COLUMN projects.id IS 'Unique identifier for the project using UUID v4';
COMMENT ON COLUMN projects.name IS 'Project name with 100 character limit';
COMMENT ON COLUMN projects.description IS 'Detailed project description';
COMMENT ON COLUMN projects.owner_id IS 'Reference to project owner in users table';
COMMENT ON COLUMN projects.status IS 'Current project status (PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED)';
COMMENT ON COLUMN projects.due_date IS 'Project deadline with timezone awareness';
COMMENT ON COLUMN projects.team_member_ids IS 'Array of team member UUIDs for efficient team management';
COMMENT ON COLUMN projects.created_at IS 'Timestamp when the project was created';
COMMENT ON COLUMN projects.updated_at IS 'Timestamp when the project was last updated';

-- Create function to validate team member existence
CREATE OR REPLACE FUNCTION validate_team_members()
RETURNS trigger AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM unnest(NEW.team_member_ids) AS team_member_id
        LEFT JOIN users ON users.id = team_member_id
        WHERE users.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Invalid team member ID found in team_member_ids array';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for team member validation
CREATE TRIGGER validate_team_members_trigger
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION validate_team_members();