/**
 * @fileoverview TypeScript type definitions for project-related data structures
 * @version 1.0.0
 */

import { 
  ApiResponse, 
  PaginatedResponse, 
  UUID 
} from './common.types';

// ============================================================================
// Enums
// ============================================================================

/**
 * Represents the possible states of a project throughout its lifecycle
 */
export enum ProjectStatus {
  /** Initial planning phase */
  PLANNING = 'PLANNING',
  /** Active development/execution phase */
  IN_PROGRESS = 'IN_PROGRESS',
  /** Temporarily paused */
  ON_HOLD = 'ON_HOLD',
  /** Successfully finished */
  COMPLETED = 'COMPLETED',
  /** Terminated before completion */
  CANCELLED = 'CANCELLED',
  /** Moved to long-term storage */
  ARCHIVED = 'ARCHIVED'
}

/**
 * Represents the priority levels for projects
 */
export enum ProjectPriority {
  /** Minimal urgency */
  LOW = 'LOW',
  /** Standard priority */
  MEDIUM = 'MEDIUM',
  /** Urgent attention needed */
  HIGH = 'HIGH',
  /** Highest priority requiring immediate attention */
  CRITICAL = 'CRITICAL'
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Comprehensive interface representing a project in the task management system
 */
export interface Project {
  /** Unique identifier for the project */
  id: UUID;
  /** Project name */
  name: string;
  /** Detailed project description */
  description: string | null;
  /** ID of the project owner/creator */
  ownerId: UUID;
  /** Current project status */
  status: ProjectStatus;
  /** List of team member UUIDs assigned to the project */
  teamMemberIds: readonly UUID[];
  /** List of task UUIDs associated with the project */
  taskIds: readonly UUID[];
  /** List of milestone UUIDs for the project */
  milestoneIds: readonly UUID[];
  /** Project due date in ISO 8601 format */
  dueDate: string | null;
  /** Project start date in ISO 8601 format */
  startDate: string | null;
  /** Project creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Project completion percentage (0-100) */
  progress: number;
  /** Project priority level */
  priority: ProjectPriority;
  /** Project tags for categorization */
  tags: readonly string[];
  /** Additional project metadata */
  metadata: Record<string, unknown>;
}

/**
 * Interface for project creation request payload
 */
export interface CreateProjectRequest {
  /** Project name */
  name: string;
  /** Project description */
  description: string | null;
  /** Initial team member UUIDs */
  teamMemberIds: UUID[];
  /** Project due date in ISO 8601 format */
  dueDate: string | null;
  /** Project start date in ISO 8601 format */
  startDate: string | null;
  /** Project priority level */
  priority: ProjectPriority;
  /** Project tags */
  tags: string[];
  /** Additional project metadata */
  metadata: Record<string, unknown>;
}

/**
 * Interface for project update request payload
 * All fields are optional to support partial updates
 */
export interface UpdateProjectRequest {
  /** Updated project name */
  name?: string;
  /** Updated project description */
  description?: string | null;
  /** Updated project status */
  status?: ProjectStatus;
  /** Updated team member UUIDs */
  teamMemberIds?: UUID[];
  /** Updated due date in ISO 8601 format */
  dueDate?: string | null;
  /** Updated start date in ISO 8601 format */
  startDate?: string | null;
  /** Updated priority level */
  priority?: ProjectPriority;
  /** Updated project tags */
  tags?: string[];
  /** Updated project metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Type for single project API response
 */
export type ProjectResponse = ApiResponse<Project>;

/**
 * Type for paginated project list API response
 */
export type ProjectListResponse = ApiResponse<PaginatedResponse<Project>>;

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Type for filtering projects in list views
 */
export type ProjectFilter = {
  /** Filter by project status */
  status?: ProjectStatus[];
  /** Filter by priority level */
  priority?: ProjectPriority[];
  /** Filter by team member */
  teamMemberIds?: UUID[];
  /** Filter by tags */
  tags?: string[];
  /** Filter by start date range */
  startDate?: string;
  /** Filter by end date range */
  endDate?: string;
};