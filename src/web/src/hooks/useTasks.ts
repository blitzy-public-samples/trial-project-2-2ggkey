/**
 * @fileoverview Enterprise-grade custom React hook for managing tasks with optimistic updates,
 * caching, and comprehensive error handling
 * @version 1.0.0
 * @package react@18.2.0
 * @package react-redux@8.0.0
 * @package react-query@4.0.0
 */

import { useCallback } from 'react'; // v18.2.0
import { useDispatch } from 'react-redux'; // v8.0.0
import { useQueryClient } from 'react-query'; // v4.0.0
import { Task, CreateTaskDto, UpdateTaskDto, TaskStatus, TaskPriority } from '../types/task.types';
import { taskSlice } from '../store/slices/taskSlice';
import tasksApi from '../api/tasksApi';

// ============================================================================
// Types
// ============================================================================

interface UseTasksOptions {
  enableCache?: boolean;
  retryCount?: number;
  optimisticUpdates?: boolean;
  batchSize?: number;
}

interface LoadingState {
  fetchTasks: boolean;
  createTask: boolean;
  updateTask: boolean;
  deleteTask: boolean;
}

interface ErrorState {
  fetchTasks: Error | null;
  createTask: Error | null;
  updateTask: Error | null;
  deleteTask: Error | null;
}

interface TaskActions {
  createTask: (task: CreateTaskDto) => Promise<Task>;
  updateTask: (taskId: string, data: UpdateTaskDto) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<Task>;
  updateTaskPriority: (taskId: string, priority: TaskPriority) => Promise<Task>;
  batchUpdateTasks: (updates: Array<{ id: string; data: UpdateTaskDto }>) => Promise<Task[]>;
  refreshTasks: () => Promise<void>;
  clearErrors: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: UseTasksOptions = {
  enableCache: true,
  retryCount: 3,
  optimisticUpdates: true,
  batchSize: 100,
};

const CACHE_KEY = 'tasks';

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Enhanced custom hook for managing tasks with optimistic updates, caching,
 * and comprehensive error handling
 */
export function useTasks(options: UseTasksOptions = DEFAULT_OPTIONS) {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const {
    actions: { setSelectedTask, setFilters, invalidateCache },
    selectors: { selectTasks, selectTaskMetrics },
  } = taskSlice;

  // Initialize state
  const [loading, setLoading] = useState<LoadingState>({
    fetchTasks: false,
    createTask: false,
    updateTask: false,
    deleteTask: false,
  });

  const [errors, setErrors] = useState<ErrorState>({
    fetchTasks: null,
    createTask: null,
    updateTask: null,
    deleteTask: null,
  });

  /**
   * Creates a new task with optimistic updates
   */
  const createTask = useCallback(async (taskData: CreateTaskDto): Promise<Task> => {
    setLoading(prev => ({ ...prev, createTask: true }));
    setErrors(prev => ({ ...prev, createTask: null }));

    try {
      // Generate temporary ID for optimistic update
      const tempId = crypto.randomUUID();
      const optimisticTask: Task = {
        id: tempId,
        ...taskData,
        status: TaskStatus.TODO,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (options.optimisticUpdates) {
        // Add optimistic task to cache
        queryClient.setQueryData(CACHE_KEY, (old: Task[] = []) => [optimisticTask, ...old]);
      }

      const response = await tasksApi.createTask(taskData);

      if (!response.success) {
        throw new Error(response.error?.message);
      }

      // Update cache with real task
      queryClient.setQueryData(CACHE_KEY, (old: Task[] = []) => 
        old.map(task => task.id === tempId ? response.data : task)
      );

      return response.data;
    } catch (error) {
      setErrors(prev => ({ ...prev, createTask: error as Error }));
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, createTask: false }));
    }
  }, [queryClient, options.optimisticUpdates]);

  /**
   * Updates an existing task with optimistic updates
   */
  const updateTask = useCallback(async (
    taskId: string,
    data: UpdateTaskDto
  ): Promise<Task> => {
    setLoading(prev => ({ ...prev, updateTask: true }));
    setErrors(prev => ({ ...prev, updateTask: null }));

    try {
      if (options.optimisticUpdates) {
        // Apply optimistic update
        queryClient.setQueryData(CACHE_KEY, (old: Task[] = []) =>
          old.map(task => task.id === taskId ? { ...task, ...data } : task)
        );
      }

      const response = await tasksApi.updateTask(taskId, data);

      if (!response.success) {
        throw new Error(response.error?.message);
      }

      // Update cache with confirmed data
      queryClient.setQueryData(CACHE_KEY, (old: Task[] = []) =>
        old.map(task => task.id === taskId ? response.data : task)
      );

      return response.data;
    } catch (error) {
      // Revert optimistic update on error
      if (options.optimisticUpdates) {
        queryClient.invalidateQueries(CACHE_KEY);
      }
      setErrors(prev => ({ ...prev, updateTask: error as Error }));
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, updateTask: false }));
    }
  }, [queryClient, options.optimisticUpdates]);

  /**
   * Deletes a task with optimistic removal
   */
  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    setLoading(prev => ({ ...prev, deleteTask: true }));
    setErrors(prev => ({ ...prev, deleteTask: null }));

    try {
      if (options.optimisticUpdates) {
        // Remove task optimistically
        queryClient.setQueryData(CACHE_KEY, (old: Task[] = []) =>
          old.filter(task => task.id !== taskId)
        );
      }

      const response = await tasksApi.deleteTask(taskId);

      if (!response.success) {
        throw new Error(response.error?.message);
      }
    } catch (error) {
      // Revert optimistic deletion on error
      if (options.optimisticUpdates) {
        queryClient.invalidateQueries(CACHE_KEY);
      }
      setErrors(prev => ({ ...prev, deleteTask: error as Error }));
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, deleteTask: false }));
    }
  }, [queryClient, options.optimisticUpdates]);

  /**
   * Updates task status with optimistic update
   */
  const updateTaskStatus = useCallback(async (
    taskId: string,
    status: TaskStatus
  ): Promise<Task> => {
    return updateTask(taskId, { status });
  }, [updateTask]);

  /**
   * Updates task priority with optimistic update
   */
  const updateTaskPriority = useCallback(async (
    taskId: string,
    priority: TaskPriority
  ): Promise<Task> => {
    return updateTask(taskId, { priority });
  }, [updateTask]);

  /**
   * Batch updates multiple tasks
   */
  const batchUpdateTasks = useCallback(async (
    updates: Array<{ id: string; data: UpdateTaskDto }>
  ): Promise<Task[]> => {
    try {
      if (options.optimisticUpdates) {
        // Apply optimistic updates
        queryClient.setQueryData(CACHE_KEY, (old: Task[] = []) =>
          old.map(task => {
            const update = updates.find(u => u.id === task.id);
            return update ? { ...task, ...update.data } : task;
          })
        );
      }

      const response = await tasksApi.batchUpdateTasks(updates);

      if (!response.success) {
        throw new Error(response.error?.message);
      }

      // Update cache with confirmed data
      queryClient.setQueryData(CACHE_KEY, (old: Task[] = []) =>
        old.map(task => {
          const updated = response.data.find(u => u.id === task.id);
          return updated || task;
        })
      );

      return response.data;
    } catch (error) {
      if (options.optimisticUpdates) {
        queryClient.invalidateQueries(CACHE_KEY);
      }
      throw error;
    }
  }, [queryClient, options.optimisticUpdates]);

  /**
   * Refreshes task data
   */
  const refreshTasks = useCallback(async (): Promise<void> => {
    setLoading(prev => ({ ...prev, fetchTasks: true }));
    setErrors(prev => ({ ...prev, fetchTasks: null }));

    try {
      await queryClient.invalidateQueries(CACHE_KEY);
    } catch (error) {
      setErrors(prev => ({ ...prev, fetchTasks: error as Error }));
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, fetchTasks: false }));
    }
  }, [queryClient]);

  /**
   * Clears all error states
   */
  const clearErrors = useCallback((): void => {
    setErrors({
      fetchTasks: null,
      createTask: null,
      updateTask: null,
      deleteTask: null,
    });
  }, []);

  return {
    // State
    tasks: selectTasks,
    loading,
    errors,
    metrics: selectTaskMetrics,

    // Actions
    actions: {
      createTask,
      updateTask,
      deleteTask,
      updateTaskStatus,
      updateTaskPriority,
      batchUpdateTasks,
      refreshTasks,
      clearErrors,
    },
  };
}