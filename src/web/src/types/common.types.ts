/**
 * @fileoverview Common TypeScript types and interfaces for the Task Management System
 * @version 1.0.0
 */

// ============================================================================
// Base Types
// ============================================================================

/**
 * ISO 8601 date string type
 * @example "2024-01-01T00:00:00Z"
 */
export type ISO8601DateString = string;

/**
 * UUID string type
 * @example "123e4567-e89b-12d3-a456-426614174000"
 */
export type UUID = string;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Makes all properties in T nullable
 */
export type Nullable<T> = T | null;

/**
 * Makes all properties in T optional
 */
export type Optional<T> = T | undefined;

/**
 * Makes all properties in T and nested objects readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

// ============================================================================
// Enums
// ============================================================================

/**
 * Sort order options for queries
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

/**
 * Application theme options
 */
export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

/**
 * Common status values
 */
export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  ARCHIVED = 'archived'
}

/**
 * Priority levels
 */
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * HTTP methods
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Standard API response wrapper
 * @template T - The type of data returned by the API
 */
export interface ApiResponse<T> {
  /** Indicates if the request was successful */
  success: boolean;
  /** The response data */
  data: T;
  /** Error information if the request failed */
  error: ApiError | null;
  /** Timestamp of the response */
  timestamp: ISO8601DateString;
  /** API version */
  version: string;
  /** Unique request identifier for tracking */
  requestId: UUID;
}

/**
 * API error details
 */
export interface ApiError {
  /** Error code for identifying the error type */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Detailed validation errors if applicable */
  details: ValidationError[];
  /** Stack trace (only included in development) */
  stack?: string;
  /** Error timestamp */
  timestamp: ISO8601DateString;
}

/**
 * Field-level validation error
 */
export interface ValidationError {
  /** The field that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Validation error code */
  code: string;
  /** The invalid value */
  value: unknown;
  /** Validation constraints that failed */
  constraints: Record<string, string>;
}

/**
 * Paginated response wrapper
 * @template T - The type of items being paginated
 */
export interface PaginatedResponse<T> {
  /** Array of items for the current page */
  items: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Indicates if there are more pages */
  hasMore: boolean;
  /** Total number of pages */
  totalPages: number;
}

/**
 * Common query parameters for API requests
 */
export interface QueryParams {
  /** Page number (1-based) */
  page?: number;
  /** Number of items per page */
  pageSize?: number;
  /** Field to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: SortOrder;
  /** Search query string */
  search?: string;
  /** Additional filters */
  filters?: Record<string, unknown>;
}