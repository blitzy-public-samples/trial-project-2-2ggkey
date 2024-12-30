/**
 * @fileoverview Enterprise-grade task detail component with real-time updates,
 * accessibility features, and comprehensive error handling
 * @version 1.0.0
 * @package react@18.2.0
 * @package react-router-dom@6.0.0
 * @package lodash@4.17.21
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import { Task, TaskStatus, TaskPriority } from '../../types/task.types';
import { useTasks } from '../../hooks/useTasks';

// ============================================================================
// Types
// ============================================================================

interface TaskDetailProps {
  taskId?: string;
  onClose?: () => void;
}

interface TaskFormState {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const AUTOSAVE_DELAY = 1000; // 1 second
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;

// ============================================================================
// Component Implementation
// ============================================================================

export const TaskDetail: React.FC<TaskDetailProps> = React.memo(({ taskId, onClose }) => {
  // Hooks
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    tasks,
    loading,
    errors,
    actions: {
      updateTask,
      deleteTask,
      updateTaskStatus,
      updateTaskPriority,
    }
  } = useTasks();

  // State
  const [task, setTask] = useState<Task | null>(null);
  const [formState, setFormState] = useState<TaskFormState>({
    title: '',
    description: '',
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    assigneeId: null,
    dueDate: null
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Refs
  const previousTaskRef = useRef<Task | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    const currentTaskId = taskId || id;
    if (!currentTaskId) return;

    const currentTask = tasks.find(t => t.id === currentTaskId);
    if (currentTask && currentTask !== previousTaskRef.current) {
      setTask(currentTask);
      setFormState({
        title: currentTask.title,
        description: currentTask.description || '',
        status: currentTask.status,
        priority: currentTask.priority,
        assigneeId: currentTask.assigneeId,
        dueDate: currentTask.dueDate
      });
      previousTaskRef.current = currentTask;
    }
  }, [taskId, id, tasks]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isEditing]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
    validateField(name, value);
  }, []);

  const validateField = useCallback((name: string, value: string) => {
    const errors: Record<string, string> = {};

    switch (name) {
      case 'title':
        if (!value.trim()) {
          errors.title = 'Title is required';
        } else if (value.length > MAX_TITLE_LENGTH) {
          errors.title = `Title must be less than ${MAX_TITLE_LENGTH} characters`;
        }
        break;
      case 'description':
        if (value.length > MAX_DESCRIPTION_LENGTH) {
          errors.description = `Description must be less than ${MAX_DESCRIPTION_LENGTH} characters`;
        }
        break;
    }

    setValidationErrors(prev => ({ ...prev, ...errors }));
    return Object.keys(errors).length === 0;
  }, []);

  const handleStatusChange = useCallback(async (status: TaskStatus) => {
    if (!task) return;

    try {
      await updateTaskStatus(task.id, status);
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  }, [task, updateTaskStatus]);

  const handlePriorityChange = useCallback(async (priority: TaskPriority) => {
    if (!task) return;

    try {
      await updateTaskPriority(task.id, priority);
    } catch (error) {
      console.error('Failed to update task priority:', error);
    }
  }, [task, updateTaskPriority]);

  // Debounced save handler for auto-saving
  const debouncedSave = useCallback(
    debounce(async (data: Partial<Task>) => {
      if (!task) return;

      try {
        setIsSaving(true);
        await updateTask(task.id, data);
      } catch (error) {
        console.error('Failed to save task:', error);
      } finally {
        setIsSaving(false);
      }
    }, AUTOSAVE_DELAY),
    [task, updateTask]
  );

  const handleSave = useCallback(async () => {
    if (!task || Object.keys(validationErrors).length > 0) return;

    try {
      setIsSaving(true);
      await updateTask(task.id, formState);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setIsSaving(false);
    }
  }, [task, formState, validationErrors, updateTask]);

  const handleDelete = useCallback(async () => {
    if (!task || !window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await deleteTask(task.id);
      if (onClose) {
        onClose();
      } else {
        navigate('/tasks');
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }, [task, deleteTask, onClose, navigate]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderHeader = () => (
    <header className="taskDetail__header">
      <div className="taskDetail__title">
        {isEditing ? (
          <input
            ref={titleInputRef}
            name="title"
            value={formState.title}
            onChange={handleInputChange}
            maxLength={MAX_TITLE_LENGTH}
            aria-invalid={!!validationErrors.title}
            aria-describedby={validationErrors.title ? 'title-error' : undefined}
          />
        ) : (
          <h1>{task?.title}</h1>
        )}
      </div>
      <div className="taskDetail__actions">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              disabled={isSaving || Object.keys(validationErrors).length > 0}
              aria-busy={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setIsEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <button onClick={() => setIsEditing(true)}>Edit</button>
            <button onClick={handleDelete} className="danger">Delete</button>
          </>
        )}
      </div>
    </header>
  );

  const renderContent = () => (
    <div className="taskDetail__content">
      <div className="taskDetail__section">
        <label htmlFor="description">Description</label>
        {isEditing ? (
          <textarea
            id="description"
            name="description"
            value={formState.description}
            onChange={handleInputChange}
            maxLength={MAX_DESCRIPTION_LENGTH}
            aria-invalid={!!validationErrors.description}
            aria-describedby={validationErrors.description ? 'description-error' : undefined}
          />
        ) : (
          <p>{task?.description || 'No description provided.'}</p>
        )}
      </div>

      <div className="taskDetail__section">
        <label>Status</label>
        <select
          value={formState.status}
          onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
          disabled={!isEditing}
        >
          {Object.values(TaskStatus).map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <div className="taskDetail__section">
        <label>Priority</label>
        <select
          value={formState.priority}
          onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
          disabled={!isEditing}
        >
          {Object.values(TaskPriority).map(priority => (
            <option key={priority} value={priority}>{priority}</option>
          ))}
        </select>
      </div>

      {/* Additional sections for attachments, comments, etc. */}
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  if (loading.fetchTasks) {
    return <div className="taskDetail__skeleton" aria-busy="true">Loading...</div>;
  }

  if (errors.fetchTasks) {
    return (
      <div className="taskDetail__error" role="alert">
        <h2>Error loading task</h2>
        <p>{errors.fetchTasks.message}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="taskDetail__error" role="alert">
        <h2>Task not found</h2>
        <p>The requested task could not be found.</p>
        <button onClick={() => navigate('/tasks')}>Return to Tasks</button>
      </div>
    );
  }

  return (
    <div 
      className="taskDetail"
      role="region"
      aria-label="Task Details"
    >
      {renderHeader()}
      {renderContent()}
    </div>
  );
});

TaskDetail.displayName = 'TaskDetail';

export default TaskDetail;