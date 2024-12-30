/**
 * @fileoverview Task-related TypeScript types and interfaces for the Task Management System
 * @version 1.0.0
 */

import { ApiResponse, PaginatedResponse, UUID } from './common.types';

// ============================================================================
// Enums
// ============================================================================

/**
 * Comprehensive task status enumeration supporting full workflow lifecycle
 */
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * Detailed task priority levels for effective task management
 */
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
  CRITICAL = 'CRITICAL'
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Comprehensive interface for task comments with rich metadata
 */
export interface Comment {
  id: UUID;
  content: string;
  authorId: UUID;
  createdAt: string;
  updatedAt: string;
  attachments: string[];
}

/**
 * Enhanced interface representing a task entity with comprehensive tracking
 * and collaboration features
 */
export interface Task {
  id: UUID;
  title: string;
  description: string | null;
  projectId: UUID;
  creatorId: UUID;
  assigneeId: UUID | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  startDate: string | null;
  completionDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  attachmentUrls: string[];
  comments: Comment[];
  tags: string[];
  completionPercentage: number;
  dependencies: UUID[];
  createdAt: string;
  updatedAt: string;
  lastModifiedBy: UUID;
}

/**
 * Comprehensive interface for task creation with validation constraints
 */
export interface CreateTaskDto {
  title: string;
  description: string | null;
  projectId: UUID;
  assigneeId: UUID | null;
  priority: TaskPriority;
  dueDate: string | null;
  estimatedHours: number | null;
  tags: string[];
  dependencies: UUID[];
}

/**
 * Flexible interface for partial task updates with validation
 */
export interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  assigneeId?: UUID | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  completionPercentage?: number;
  actualHours?: number | null;
  tags?: string[];
  dependencies?: UUID[];
}

/**
 * Comprehensive interface for advanced task filtering and sorting
 */
export interface TaskQueryParams {
  projectId: UUID | null;
  assigneeId: UUID | null;
  creatorId: UUID | null;
  status: TaskStatus | null;
  priority: TaskPriority | null;
  search: string | null;
  tags: string[];
  dueDateFrom: string | null;
  dueDateTo: string | null;
  page: number;
  pageSize: number;
  sortBy: keyof Task;
  sortOrder: 'asc' | 'desc';
}

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Type alias for task API response with error handling
 */
export type TaskResponse = ApiResponse<Task>;

/**
 * Type alias for paginated task list response with metadata
 */
export type TaskListResponse = PaginatedResponse<Task[]>;

/**
 * Type alias for task filtering options
 */
export type TaskFilter = Partial<Pick<Task, 'status' | 'priority' | 'assigneeId' | 'projectId'>>;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type guard to check if a value is a valid TaskStatus
 */
export function isTaskStatus(value: unknown): value is TaskStatus {
  return Object.values(TaskStatus).includes(value as TaskStatus);
}

/**
 * Type guard to check if a value is a valid TaskPriority
 */
export function isTaskPriority(value: unknown): value is TaskPriority {
  return Object.values(TaskPriority).includes(value as TaskPriority);
}