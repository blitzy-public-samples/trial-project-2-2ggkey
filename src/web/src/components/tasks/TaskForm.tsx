/**
 * @fileoverview Enterprise-grade task form component with comprehensive validation,
 * accessibility support, and error handling
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form'; // v7.43.0
import * as yup from 'yup'; // v1.0.0
import { useAnnouncer } from '@react-aria/announcer'; // v3.0.0
import { Task, CreateTaskDto, TaskStatus, TaskPriority } from '../../types/task.types';
import tasksApi from '../../api/tasksApi';

// ============================================================================
// Constants & Types
// ============================================================================

const DEBOUNCE_MS = 300;
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;

/**
 * Props interface for TaskForm component
 */
interface TaskFormProps {
  initialData?: Task;
  projectId: string;
  onSubmit: (task: Task) => Promise<void>;
  onCancel: () => void;
  onError: (error: Error) => void;
}

// ============================================================================
// Validation Schema
// ============================================================================

const taskValidationSchema = yup.object().shape({
  title: yup
    .string()
    .required('Task title is required')
    .min(3, 'Title must be at least 3 characters')
    .max(MAX_TITLE_LENGTH, `Title must not exceed ${MAX_TITLE_LENGTH} characters`),
  description: yup
    .string()
    .nullable()
    .max(MAX_DESCRIPTION_LENGTH, `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`),
  priority: yup
    .string()
    .oneOf(Object.values(TaskPriority), 'Invalid priority level')
    .required('Priority is required'),
  dueDate: yup
    .date()
    .nullable()
    .min(new Date(), 'Due date cannot be in the past'),
  estimatedHours: yup
    .number()
    .nullable()
    .min(0, 'Estimated hours must be positive')
    .max(1000, 'Estimated hours cannot exceed 1000'),
  assigneeId: yup.string().uuid('Invalid assignee ID').nullable(),
  tags: yup.array().of(yup.string()),
});

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * TaskForm component for creating and editing tasks with enhanced validation
 * and accessibility support
 */
const TaskForm: React.FC<TaskFormProps> = ({
  initialData,
  projectId,
  onSubmit,
  onCancel,
  onError,
}) => {
  const { announce } = useAnnouncer();
  
  // Initialize form with react-hook-form and yup validation
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    setError,
  } = useForm({
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      priority: initialData?.priority || TaskPriority.MEDIUM,
      dueDate: initialData?.dueDate || null,
      estimatedHours: initialData?.estimatedHours || null,
      assigneeId: initialData?.assigneeId || null,
      tags: initialData?.tags || [],
    },
    resolver: yup.resolver(taskValidationSchema),
    mode: 'onChange',
  });

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  // Announce validation errors for screen readers
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      const errorMessages = Object.values(errors)
        .map((error) => error.message)
        .join('. ');
      announce(`Form validation errors: ${errorMessages}`, 'assertive');
    }
  }, [errors, announce]);

  // Form submission handler with optimistic updates and error handling
  const onFormSubmit = useCallback(
    async (formData: Partial<Task>) => {
      try {
        const taskData: CreateTaskDto = {
          ...formData,
          projectId,
          status: initialData?.status || TaskStatus.TODO,
        };

        const response = initialData
          ? await tasksApi.updateTask(initialData.id, taskData)
          : await tasksApi.createTask(taskData);

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to save task');
        }

        await onSubmit(response.data);
        announce(
          `Task successfully ${initialData ? 'updated' : 'created'}`,
          'polite'
        );
        reset();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setError('root', { message: errorMessage });
        onError(error instanceof Error ? error : new Error(errorMessage));
        announce(`Error: ${errorMessage}`, 'assertive');
      }
    },
    [initialData, projectId, onSubmit, onError, announce, reset, setError]
  );

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      className="task-form"
      noValidate
      aria-label={`${initialData ? 'Edit' : 'Create'} Task Form`}
    >
      <div className="form-group" role="group" aria-labelledby="title-label">
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <>
              <label id="title-label" htmlFor={field.name}>
                Task Title *
              </label>
              <input
                {...field}
                type="text"
                id={field.name}
                aria-describedby={errors.title ? 'title-error' : undefined}
                aria-invalid={!!errors.title}
                className={errors.title ? 'field-error' : ''}
                maxLength={MAX_TITLE_LENGTH}
                disabled={isSubmitting}
              />
              {errors.title && (
                <span id="title-error" className="error-message" role="alert">
                  {errors.title.message}
                </span>
              )}
            </>
          )}
        />
      </div>

      <div className="form-group" role="group" aria-labelledby="description-label">
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <>
              <label id="description-label" htmlFor={field.name}>
                Description
              </label>
              <textarea
                {...field}
                id={field.name}
                aria-describedby={errors.description ? 'description-error' : undefined}
                aria-invalid={!!errors.description}
                className={errors.description ? 'field-error' : ''}
                maxLength={MAX_DESCRIPTION_LENGTH}
                disabled={isSubmitting}
              />
              {errors.description && (
                <span id="description-error" className="error-message" role="alert">
                  {errors.description.message}
                </span>
              )}
            </>
          )}
        />
      </div>

      <div className="form-actions">
        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          aria-busy={isSubmitting}
          className={isSubmitting ? 'loading-state' : ''}
        >
          {isSubmitting ? 'Saving...' : initialData ? 'Update Task' : 'Create Task'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default TaskForm;