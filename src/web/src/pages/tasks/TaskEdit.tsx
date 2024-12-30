/**
 * @fileoverview Enterprise-grade task editing page component with comprehensive validation,
 * real-time updates, and error handling
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom'; // v6.8.0
import { useQueryClient } from 'react-query'; // v4.0.0
import { toast } from 'react-toastify'; // v9.1.1
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11

import TaskForm from '../../components/tasks/TaskForm';
import tasksApi from '../../api/tasksApi';
import { Task, UpdateTaskDto } from '../../types/task.types';
import { ApiError } from '../../types/common.types';

// ============================================================================
// Types
// ============================================================================

interface TaskEditParams {
  taskId: string;
}

interface TaskEditState {
  isLoading: boolean;
  error: Error | null;
  task: Task | null;
  isDirty: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const ERROR_MESSAGES = {
  LOAD_FAILED: 'Failed to load task details',
  UPDATE_FAILED: 'Failed to update task',
  NOT_FOUND: 'Task not found',
  INVALID_ID: 'Invalid task ID provided'
};

// ============================================================================
// Error Fallback Component
// ============================================================================

const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div className="task-edit-error" role="alert">
    <h2>Error Loading Task</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try Again</button>
  </div>
);

// ============================================================================
// TaskEdit Component
// ============================================================================

/**
 * Task editing page component with comprehensive validation and error handling
 */
const TaskEdit: React.FC = () => {
  // Hooks
  const { taskId } = useParams<TaskEditParams>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // State
  const [state, setState] = useState<TaskEditState>({
    isLoading: true,
    error: null,
    task: null,
    isDirty: false
  });

  // ============================================================================
  // Data Fetching
  // ============================================================================

  /**
   * Fetches task data with error handling
   */
  const fetchTaskData = useCallback(async () => {
    if (!taskId) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: new Error(ERROR_MESSAGES.INVALID_ID)
      }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const response = await tasksApi.getTaskById(taskId);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || ERROR_MESSAGES.LOAD_FAILED);
      }

      setState(prev => ({
        ...prev,
        task: response.data,
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error(ERROR_MESSAGES.LOAD_FAILED)
      }));
    }
  }, [taskId]);

  // Initial data fetch
  useEffect(() => {
    fetchTaskData();
  }, [fetchTaskData]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handles form submission with optimistic updates
   */
  const handleSubmit = useCallback(async (taskData: UpdateTaskDto) => {
    if (!taskId || !state.task) return;

    // Optimistic update
    const previousData = queryClient.getQueryData<Task>(['task', taskId]);
    const optimisticTask = { ...state.task, ...taskData };

    queryClient.setQueryData(['task', taskId], optimisticTask);

    try {
      const response = await tasksApi.updateTask(taskId, taskData);

      if (!response.success) {
        throw new Error(response.error?.message || ERROR_MESSAGES.UPDATE_FAILED);
      }

      // Update cache with server response
      queryClient.setQueryData(['task', taskId], response.data);
      
      toast.success('Task updated successfully');
      navigate(`/tasks/${taskId}`, { replace: true });
    } catch (error) {
      // Revert optimistic update
      queryClient.setQueryData(['task', taskId], previousData);

      const apiError = error as ApiError;
      toast.error(apiError.message || ERROR_MESSAGES.UPDATE_FAILED);
      
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error(ERROR_MESSAGES.UPDATE_FAILED)
      }));
    }
  }, [taskId, state.task, queryClient, navigate]);

  /**
   * Handles cancellation and navigation
   */
  const handleCancel = useCallback(() => {
    if (state.isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmed) return;
    }
    navigate(-1);
  }, [navigate, state.isDirty]);

  /**
   * Tracks form dirty state
   */
  const handleDirtyChange = useCallback((isDirty: boolean) => {
    setState(prev => ({ ...prev, isDirty }));
  }, []);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  if (state.isLoading) {
    return (
      <div className="task-edit-container loading" aria-busy="true">
        <div className="loading-skeleton" aria-hidden="true">
          <div className="skeleton-header" />
          <div className="skeleton-content" />
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="task-edit-container error" role="alert">
        <h2>Error</h2>
        <p>{state.error.message}</p>
        <button onClick={fetchTaskData}>Retry</button>
      </div>
    );
  }

  if (!state.task) {
    return (
      <div className="task-edit-container not-found" role="alert">
        <h2>{ERROR_MESSAGES.NOT_FOUND}</h2>
        <button onClick={() => navigate('/tasks')}>Return to Tasks</button>
      </div>
    );
  }

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={fetchTaskData}
      resetKeys={[taskId]}
    >
      <div className="task-edit-container">
        <header className="task-edit-header">
          <h1>Edit Task</h1>
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li><a href="/tasks">Tasks</a></li>
              <li>{state.task.title}</li>
            </ol>
          </nav>
        </header>

        <main className="task-edit-content">
          <TaskForm
            initialData={state.task}
            projectId={state.task.projectId}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onDirtyChange={handleDirtyChange}
            onError={(error) => setState(prev => ({ ...prev, error }))}
          />
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default TaskEdit;