/**
 * @fileoverview Enterprise-grade task details page component with real-time updates,
 * optimistic updates, enhanced accessibility, and comprehensive error handling
 * @version 1.0.0
 * @package react@18.2.0
 * @package react-router-dom@6.0.0
 * @package react-query@4.0.0
 * @package react-error-boundary@4.0.0
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from 'react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { TaskDetail } from '../../components/tasks/TaskDetail';
import { Task, UpdateTaskDto } from '../../types/task.types';
import { useTasks } from '../../hooks/useTasks';
import styles from './TaskDetails.module.css';

// ============================================================================
// Types
// ============================================================================

interface TaskDetailsErrorProps {
  error: Error;
  resetErrorBoundary: () => void;
}

// ============================================================================
// Error Fallback Component
// ============================================================================

const TaskDetailsErrorFallback: React.FC<TaskDetailsErrorProps> = ({ 
  error, 
  resetErrorBoundary 
}) => (
  <div 
    className={styles.taskDetailsPage__error}
    role="alert"
    aria-live="assertive"
  >
    <h2>Error Loading Task</h2>
    <p>{error.message}</p>
    <button 
      onClick={resetErrorBoundary}
      className={styles.taskDetailsPage__errorButton}
    >
      Try Again
    </button>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const TaskDetailsPage: React.FC = React.memo(() => {
  // Hooks
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { 
    tasks,
    loading,
    errors,
    actions: {
      updateTask,
      deleteTask,
      useTaskSubscription
    }
  } = useTasks();

  // State
  const [optimisticTask, setOptimisticTask] = useState<Task | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // ============================================================================
  // Effects
  // ============================================================================

  // Setup real-time task subscription
  useEffect(() => {
    if (!taskId || isSubscribed) return;

    const subscription = useTaskSubscription(taskId, {
      onUpdate: (updatedTask) => {
        queryClient.setQueryData(['task', taskId], updatedTask);
      },
      onError: (error) => {
        console.error('Task subscription error:', error);
      }
    });

    setIsSubscribed(true);

    return () => {
      subscription.unsubscribe();
      setIsSubscribed(false);
    };
  }, [taskId, isSubscribed, queryClient, useTaskSubscription]);

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handles task updates with optimistic updates and error handling
   */
  const handleTaskUpdate = useCallback(async (
    taskData: UpdateTaskDto
  ): Promise<void> => {
    if (!taskId) return;

    try {
      // Apply optimistic update
      const currentTask = tasks.find(t => t.id === taskId);
      if (currentTask) {
        setOptimisticTask({ ...currentTask, ...taskData });
        queryClient.setQueryData(['task', taskId], { ...currentTask, ...taskData });
      }

      // Perform actual update
      await updateTask(taskId, taskData);
    } catch (error) {
      // Revert optimistic update on error
      setOptimisticTask(null);
      queryClient.invalidateQueries(['task', taskId]);
      throw error;
    }
  }, [taskId, tasks, updateTask, queryClient]);

  /**
   * Handles task deletion with confirmation and cleanup
   */
  const handleTaskDelete = useCallback(async (): Promise<void> => {
    if (!taskId) return;

    const confirmDelete = window.confirm(
      'Are you sure you want to delete this task? This action cannot be undone.'
    );

    if (!confirmDelete) return;

    try {
      await deleteTask(taskId);
      navigate('/tasks', { replace: true });
    } catch (error) {
      console.error('Failed to delete task:', error);
      throw error;
    }
  }, [taskId, deleteTask, navigate]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderLoading = () => (
    <div 
      className={styles.taskDetailsPage__loading}
      role="status"
      aria-busy="true"
    >
      <div className={styles.taskDetailsPage__loadingSpinner} />
      <span className="sr-only">Loading task details...</span>
    </div>
  );

  const renderContent = () => {
    const task = optimisticTask || tasks.find(t => t.id === taskId);

    if (!task) {
      return (
        <div 
          className={styles.taskDetailsPage__error}
          role="alert"
        >
          <h2>Task Not Found</h2>
          <p>The requested task could not be found.</p>
          <button 
            onClick={() => navigate('/tasks')}
            className={styles.taskDetailsPage__errorButton}
          >
            Return to Tasks
          </button>
        </div>
      );
    }

    return (
      <TaskDetail
        taskId={taskId}
        task={task}
        onUpdate={handleTaskUpdate}
        onDelete={handleTaskDelete}
        isOptimistic={!!optimisticTask}
      />
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <ErrorBoundary
      FallbackComponent={TaskDetailsErrorFallback}
      onReset={() => {
        queryClient.invalidateQueries(['task', taskId]);
        setOptimisticTask(null);
      }}
    >
      <div 
        className={styles.taskDetailsPage}
        role="main"
        aria-label="Task Details Page"
      >
        <div className={styles.taskDetailsPage__container}>
          {loading.fetchTasks ? renderLoading() : renderContent()}
        </div>
      </div>
    </ErrorBoundary>
  );
});

TaskDetailsPage.displayName = 'TaskDetailsPage';

export default TaskDetailsPage;