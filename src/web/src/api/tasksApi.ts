/**
 * @fileoverview Enterprise-grade API client for task management operations with
 * comprehensive caching, error handling, and performance optimizations
 * @version 1.0.0
 * @package axios@1.6.0
 */

import axios, { CancelTokenSource } from 'axios'; // v1.6.0
import apiClient from './apiClient';
import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  CreateTaskDto, 
  UpdateTaskDto,
  TaskQueryParams,
  TaskResponse,
  TaskListResponse
} from '../types/task.types';
import { ApiResponse, PaginatedResponse } from '../types/common.types';

// ============================================================================
// Constants
// ============================================================================

const TASKS_API_BASE = '/api/v1/tasks';
const CACHE_DURATION = 300000; // 5 minutes
const BATCH_SIZE = 100; // Maximum items per request

// ============================================================================
// Types
// ============================================================================

interface TaskCacheEntry {
  data: ApiResponse<PaginatedResponse<Task>>;
  timestamp: number;
  queryHash: string;
}

// ============================================================================
// TasksApi Implementation
// ============================================================================

export class TasksApi {
  private cancelTokenSource: CancelTokenSource;
  private cache: Map<string, TaskCacheEntry>;
  private pendingRequests: Map<string, Promise<any>>;

  constructor() {
    this.cancelTokenSource = axios.CancelToken.source();
    this.cache = new Map();
    this.pendingRequests = new Map();
  }

  /**
   * Generates a cache key for task queries
   */
  private generateQueryHash(params: TaskQueryParams): string {
    return JSON.stringify(params);
  }

  /**
   * Retrieves tasks with caching and request deduplication
   * @param params - Query parameters for filtering and pagination
   * @returns Promise resolving to paginated task list
   */
  public async getTasks(
    params: TaskQueryParams
  ): Promise<ApiResponse<PaginatedResponse<Task>>> {
    const queryHash = this.generateQueryHash(params);

    // Check cache first
    const cached = this.cache.get(queryHash);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    // Check for pending request with same parameters
    const pendingRequest = this.pendingRequests.get(queryHash);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Make new request
    const request = apiClient.get<PaginatedResponse<Task>>(
      TASKS_API_BASE,
      params,
      {
        cancelToken: this.cancelTokenSource.token,
        cacheDuration: CACHE_DURATION
      }
    );

    // Store pending request
    this.pendingRequests.set(queryHash, request);

    try {
      const response = await request;
      
      // Cache successful response
      if (response.success) {
        this.cache.set(queryHash, {
          data: response,
          timestamp: Date.now(),
          queryHash
        });
      }

      return response;
    } finally {
      this.pendingRequests.delete(queryHash);
    }
  }

  /**
   * Creates a new task
   * @param taskData - Task creation data
   * @returns Promise resolving to created task
   */
  public async createTask(taskData: CreateTaskDto): Promise<TaskResponse> {
    const response = await apiClient.post<Task>(
      TASKS_API_BASE,
      taskData,
      { skipCache: true }
    );

    if (response.success) {
      this.invalidateTaskCache();
    }

    return response;
  }

  /**
   * Updates an existing task
   * @param taskId - ID of task to update
   * @param updateData - Task update data
   * @returns Promise resolving to updated task
   */
  public async updateTask(
    taskId: string,
    updateData: UpdateTaskDto
  ): Promise<TaskResponse> {
    const response = await apiClient.put<Task>(
      `${TASKS_API_BASE}/${taskId}`,
      updateData,
      { skipCache: true }
    );

    if (response.success) {
      this.invalidateTaskCache();
    }

    return response;
  }

  /**
   * Deletes a task
   * @param taskId - ID of task to delete
   * @returns Promise resolving to deletion confirmation
   */
  public async deleteTask(taskId: string): Promise<ApiResponse<void>> {
    const response = await apiClient.delete<void>(
      `${TASKS_API_BASE}/${taskId}`,
      { skipCache: true }
    );

    if (response.success) {
      this.invalidateTaskCache();
    }

    return response;
  }

  /**
   * Updates task status
   * @param taskId - ID of task to update
   * @param status - New task status
   * @returns Promise resolving to updated task
   */
  public async updateTaskStatus(
    taskId: string,
    status: TaskStatus
  ): Promise<TaskResponse> {
    return this.updateTask(taskId, { status });
  }

  /**
   * Updates task priority
   * @param taskId - ID of task to update
   * @param priority - New task priority
   * @returns Promise resolving to updated task
   */
  public async updateTaskPriority(
    taskId: string,
    priority: TaskPriority
  ): Promise<TaskResponse> {
    return this.updateTask(taskId, { priority });
  }

  /**
   * Batch updates multiple tasks
   * @param updates - Array of task updates
   * @returns Promise resolving to array of updated tasks
   */
  public async batchUpdateTasks(
    updates: Array<{ id: string; data: UpdateTaskDto }>
  ): Promise<ApiResponse<Task[]>> {
    // Split updates into batches
    const batches = [];
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      batches.push(updates.slice(i, i + BATCH_SIZE));
    }

    // Process batches sequentially
    const results: Task[] = [];
    for (const batch of batches) {
      const response = await apiClient.post<Task[]>(
        `${TASKS_API_BASE}/batch`,
        { updates: batch },
        { skipCache: true }
      );

      if (!response.success) {
        return response;
      }

      results.push(...response.data);
    }

    this.invalidateTaskCache();

    return {
      success: true,
      data: results,
      error: null,
      timestamp: new Date().toISOString(),
      version: '1.0',
      requestId: crypto.randomUUID()
    };
  }

  /**
   * Invalidates all cached task data
   */
  private invalidateTaskCache(): void {
    this.cache.clear();
  }

  /**
   * Cancels all pending requests
   */
  public cancelPendingRequests(): void {
    this.cancelTokenSource.cancel('Operation cancelled by user');
    this.cancelTokenSource = axios.CancelToken.source();
  }

  /**
   * Cleans up resources
   */
  public dispose(): void {
    this.cancelPendingRequests();
    this.cache.clear();
    this.pendingRequests.clear();
  }
}

// Create singleton instance
const tasksApi = new TasksApi();

// Prevent modifications to the instance
Object.freeze(tasksApi);

export default tasksApi;