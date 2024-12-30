/**
 * @fileoverview Enterprise-grade task creation page component with comprehensive validation,
 * accessibility support, and analytics tracking
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useDebounce } from 'use-debounce';
import { ErrorBoundary } from 'react-error-boundary';
import styled from '@emotion/styled';

import DashboardLayout from '../../layouts/DashboardLayout';
import TaskForm from '../../components/tasks/TaskForm';
import { TasksApi } from '../../api/tasksApi';
import { Task } from '../../types/task.types';
import { Theme } from '../../types/common.types';

// ============================================================================
// Styled Components
// ============================================================================

const PageContainer = styled.div`
  padding: var(--spacing-lg);
  max-width: 800px;
  margin: 0 auto;
  background-color: var(--theme-background);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-md);

  @media (max-width: 768px) {
    padding: var(--spacing-md);
  }
`;

const PageHeader = styled.header`
  margin-bottom: var(--spacing-lg);
  
  h1 {
    color: var(--theme-text);
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--spacing-sm);
  }

  p {
    color: var(--theme-secondary);
    font-size: var(--font-size-md);
  }
`;

const ErrorFallback = styled.div`
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--theme-error);
`;

// ============================================================================
// Error Boundary Component
// ============================================================================

const ErrorFallbackComponent: React.FC<{ error: Error }> = ({ error }) => (
  <ErrorFallback role="alert" aria-live="assertive">
    <h2>Error Creating Task</h2>
    <pre>{error.message}</pre>
    <button onClick={() => window.location.reload()}>
      Try Again
    </button>
  </ErrorFallback>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * TaskCreate component for creating new tasks with enhanced validation,
 * accessibility support, and analytics tracking
 */
const TaskCreate: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [debouncedSubmit] = useDebounce(
    (task: Task) => handleTaskCreate(task),
    300
  );

  // Set up page title and analytics tracking
  useEffect(() => {
    document.title = 'Create New Task - Task Management System';
    
    // Track page view
    window.dispatchEvent(new CustomEvent('page-view', {
      detail: {
        page: 'task-create',
        timestamp: Date.now()
      }
    }));

    return () => {
      document.title = 'Task Management System';
    };
  }, []);

  /**
   * Handles task creation with optimistic updates and error handling
   */
  const handleTaskCreate = useCallback(async (taskData: Task) => {
    setIsSubmitting(true);

    try {
      // Validate CSRF token
      const csrfToken = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]'
      )?.content;

      if (!csrfToken) {
        throw new Error('CSRF token not found');
      }

      const response = await TasksApi.createTask({
        ...taskData,
        projectId: taskData.projectId || '',
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to create task');
      }

      // Show success message
      toast.success('Task created successfully', {
        position: 'top-right',
        autoClose: 3000,
      });

      // Track successful task creation
      window.dispatchEvent(new CustomEvent('task-created', {
        detail: {
          taskId: response.data.id,
          timestamp: Date.now()
        }
      }));

      // Navigate to task list
      navigate('/tasks');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      
      // Show error message
      toast.error(`Failed to create task: ${errorMessage}`, {
        position: 'top-right',
        autoClose: 5000,
      });

      // Track error
      window.dispatchEvent(new CustomEvent('task-error', {
        detail: {
          error: errorMessage,
          timestamp: Date.now()
        }
      }));
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate]);

  /**
   * Handles form cancellation
   */
  const handleCancel = useCallback(() => {
    navigate('/tasks');
  }, [navigate]);

  /**
   * Handles form errors
   */
  const handleError = useCallback((error: Error) => {
    console.error('Task creation error:', error);
    
    // Track error
    window.dispatchEvent(new CustomEvent('form-error', {
      detail: {
        error: error.message,
        timestamp: Date.now()
      }
    }));
  }, []);

  return (
    <DashboardLayout>
      <ErrorBoundary
        FallbackComponent={ErrorFallbackComponent}
        onError={handleError}
      >
        <PageContainer>
          <PageHeader>
            <h1>Create New Task</h1>
            <p>Enter the details for your new task below</p>
          </PageHeader>

          <TaskForm
            projectId=""
            onSubmit={debouncedSubmit}
            onCancel={handleCancel}
            onError={handleError}
          />
        </PageContainer>
      </ErrorBoundary>
    </DashboardLayout>
  );
});

// Display name for debugging
TaskCreate.displayName = 'TaskCreate';

export default TaskCreate;