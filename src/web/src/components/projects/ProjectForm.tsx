import React, { useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form'; // v7.45.0
import { useTranslation } from 'react-i18next'; // v13.0.0
import * as yup from 'yup'; // v1.2.0
import { yupResolver } from '@hookform/resolvers/yup'; // v3.1.0
import Input, { InputProps } from '../common/Input';
import DatePicker, { DatePickerProps } from '../common/DatePicker';
import styles from './ProjectForm.module.css';
import type { Project, ValidationError } from '../../types/common.types';

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface ProjectFormProps {
  /** Initial project data for editing mode */
  initialData?: Project;
  /** Callback function called on successful form submission */
  onSubmit: (project: Project) => Promise<void>;
  /** Callback function called when form is cancelled */
  onCancel: () => void;
  /** Loading state indicator for form submission */
  isSubmitting: boolean;
}

interface ProjectFormData {
  name: string;
  description: string;
  teamMembers: string[];
  startDate: string;
  dueDate: string;
  priority: string;
  status: string;
}

// =============================================================================
// Validation Schema
// =============================================================================

const validationSchema = yup.object().shape({
  name: yup
    .string()
    .required('Project name is required')
    .min(3, 'Project name must be at least 3 characters')
    .max(100, 'Project name cannot exceed 100 characters'),
  description: yup
    .string()
    .required('Project description is required')
    .max(500, 'Description cannot exceed 500 characters'),
  teamMembers: yup
    .array()
    .of(yup.string())
    .min(1, 'At least one team member is required'),
  startDate: yup
    .string()
    .required('Start date is required')
    .test('valid-date', 'Invalid date format', (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value)),
  dueDate: yup
    .string()
    .required('Due date is required')
    .test('valid-date', 'Invalid date format', (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value))
    .test('after-start-date', 'Due date must be after start date', function(value) {
      const { startDate } = this.parent;
      if (!startDate || !value) return true;
      return new Date(value) > new Date(startDate);
    }),
  priority: yup
    .string()
    .required('Priority is required')
    .oneOf(['low', 'medium', 'high', 'urgent'], 'Invalid priority level'),
  status: yup
    .string()
    .required('Status is required')
    .oneOf(['active', 'inactive', 'pending', 'archived'], 'Invalid status')
});

// =============================================================================
// Component
// =============================================================================

/**
 * A comprehensive form component for creating and editing projects with
 * validation, accessibility features, and optimistic updates.
 */
const ProjectForm: React.FC<ProjectFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting
}) => {
  const { t } = useTranslation();
  
  // Initialize form with react-hook-form and yup validation
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid },
    setError
  } = useForm<ProjectFormData>({
    resolver: yupResolver(validationSchema),
    mode: 'onChange',
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      teamMembers: initialData?.teamMembers || [],
      startDate: initialData?.startDate || '',
      dueDate: initialData?.dueDate || '',
      priority: initialData?.priority || 'medium',
      status: initialData?.status || 'active'
    }
  });

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleFormSubmit = useCallback(async (data: ProjectFormData) => {
    try {
      await onSubmit({
        id: initialData?.id,
        ...data,
        updatedAt: new Date().toISOString(),
        createdAt: initialData?.createdAt || new Date().toISOString()
      });
    } catch (error) {
      // Handle API validation errors
      if (error instanceof Error && 'details' in error) {
        const validationErrors = (error as { details: ValidationError[] }).details;
        validationErrors.forEach((validationError) => {
          setError(validationError.field as keyof ProjectFormData, {
            type: 'manual',
            message: validationError.message
          });
        });
      } else {
        console.error('Form submission error:', error);
      }
    }
  }, [initialData, onSubmit, setError]);

  const handleCancel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (isDirty) {
      // Show confirmation dialog if form is dirty
      const confirmed = window.confirm(t('common.discardChanges'));
      if (!confirmed) return;
    }
    onCancel();
  }, [isDirty, onCancel, t]);

  // =============================================================================
  // Effects
  // =============================================================================

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      reset(initialData);
    }
  }, [initialData, reset]);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className={styles['form-container']}
      noValidate
      aria-label={initialData ? t('project.editTitle') : t('project.createTitle')}
    >
      <div className={styles['form-group']}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              label={t('project.nameLabel')}
              error={errors.name?.message}
              required
              disabled={isSubmitting}
              maxLength={100}
              aria-describedby="name-description"
              data-testid="project-name-input"
            />
          )}
        />
        <span id="name-description" className="sr-only">
          {t('project.nameDescription')}
        </span>
      </div>

      <div className={styles['form-group']}>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              label={t('project.descriptionLabel')}
              error={errors.description?.message}
              required
              disabled={isSubmitting}
              multiline
              rows={4}
              maxLength={500}
              showCharCount
              data-testid="project-description-input"
            />
          )}
        />
      </div>

      <div className={styles['form-row']}>
        <div className={styles['form-group']}>
          <Controller
            name="startDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                {...field}
                label={t('project.startDateLabel')}
                error={errors.startDate?.message}
                required
                disabled={isSubmitting}
                minDate={new Date().toISOString()}
                data-testid="project-start-date-input"
              />
            )}
          />
        </div>

        <div className={styles['form-group']}>
          <Controller
            name="dueDate"
            control={control}
            render={({ field }) => (
              <DatePicker
                {...field}
                label={t('project.dueDateLabel')}
                error={errors.dueDate?.message}
                required
                disabled={isSubmitting}
                minDate={new Date().toISOString()}
                data-testid="project-due-date-input"
              />
            )}
          />
        </div>
      </div>

      <div className={styles['form-actions']}>
        <button
          type="button"
          onClick={handleCancel}
          className={styles['cancel-button']}
          disabled={isSubmitting}
          data-testid="project-cancel-button"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          className={styles['submit-button']}
          disabled={!isDirty || !isValid || isSubmitting}
          data-testid="project-submit-button"
        >
          {isSubmitting ? t('common.submitting') : initialData ? t('common.update') : t('common.create')}
        </button>
      </div>
    </form>
  );
};

export default React.memo(ProjectForm);