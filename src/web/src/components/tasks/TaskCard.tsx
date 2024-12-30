/**
 * @fileoverview A reusable, accessible, and performant task card component that displays
 * comprehensive task information following Material Design principles.
 * @version 1.0.0
 */

import React, { useCallback, useMemo } from 'react'; // ^18.2.0
import { format } from 'date-fns'; // ^2.30.0
import classNames from 'classnames'; // ^2.3.2
import { Task, TaskStatus, TaskPriority } from '../../types/task.types';
import Card from '../common/Card';
import Badge from '../common/Badge';
import Avatar from '../common/Avatar';
import ProgressBar from '../common/ProgressBar';
import { formatTaskStatus, formatTaskPriority } from '../../utils/format.utils';
import styles from './TaskCard.module.css';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TaskCardProps {
  /** Task data object containing all task information */
  task: Task;
  /** Optional click handler for task selection */
  onClick?: (taskId: string) => void;
  /** Optional additional CSS classes */
  className?: string;
  /** Optional card elevation level */
  elevation?: 0 | 1 | 2 | 3;
  /** Optional test ID for automated testing */
  testId?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps task status to appropriate badge variant
 */
const getStatusVariant = (status: TaskStatus): string => {
  const variantMap: Record<TaskStatus, string> = {
    [TaskStatus.TODO]: 'neutral',
    [TaskStatus.IN_PROGRESS]: 'primary',
    [TaskStatus.IN_REVIEW]: 'warning',
    [TaskStatus.COMPLETED]: 'success',
    [TaskStatus.BLOCKED]: 'error',
    [TaskStatus.ARCHIVED]: 'neutral'
  };
  return variantMap[status];
};

/**
 * Maps task priority to appropriate badge variant
 */
const getPriorityVariant = (priority: TaskPriority): string => {
  const variantMap: Record<TaskPriority, string> = {
    [TaskPriority.LOW]: 'neutral',
    [TaskPriority.MEDIUM]: 'info',
    [TaskPriority.HIGH]: 'warning',
    [TaskPriority.URGENT]: 'error',
    [TaskPriority.CRITICAL]: 'error'
  };
  return variantMap[priority];
};

/**
 * Formats the due date with relative time indication
 */
const formatDueDate = (dueDate: string | null): string => {
  if (!dueDate) return 'No due date';
  return format(new Date(dueDate), 'MMM d, yyyy');
};

// ============================================================================
// Component
// ============================================================================

/**
 * TaskCard component that displays comprehensive task information in an accessible
 * and visually appealing format following Material Design principles.
 */
export const TaskCard: React.FC<TaskCardProps> = React.memo(({
  task,
  onClick,
  className,
  elevation = 1,
  testId = 'task-card'
}) => {
  // Memoize event handler
  const handleClick = useCallback(() => {
    onClick?.(task.id);
  }, [onClick, task.id]);

  // Memoize class names
  const containerClasses = useMemo(() => classNames(
    styles.taskCard,
    {
      [styles.interactive]: !!onClick,
      [styles.overdue]: task.dueDate && new Date(task.dueDate) < new Date()
    },
    className
  ), [onClick, task.dueDate, className]);

  // Generate accessible description
  const cardDescription = useMemo(() => {
    return `Task: ${task.title}. Status: ${formatTaskStatus(task.status)}. ` +
           `Priority: ${formatTaskPriority(task.priority)}. ` +
           `Due: ${formatDueDate(task.dueDate)}`;
  }, [task]);

  return (
    <Card
      className={containerClasses}
      elevation={elevation}
      onClick={handleClick}
      testId={testId}
    >
      <div className={styles.header}>
        <h3 className={styles.title} title={task.title}>
          {task.title}
        </h3>
        <div className={styles.badges}>
          <Badge
            variant={getStatusVariant(task.status)}
            size="small"
            rounded
          >
            {formatTaskStatus(task.status)}
          </Badge>
          <Badge
            variant={getPriorityVariant(task.priority)}
            size="small"
            rounded
          >
            {formatTaskPriority(task.priority)}
          </Badge>
        </div>
      </div>

      <div className={styles.content}>
        {task.description && (
          <p className={styles.description} title={task.description}>
            {task.description}
          </p>
        )}

        <div className={styles.progress}>
          <ProgressBar
            value={task.completionPercentage}
            size="sm"
            color={task.status === TaskStatus.BLOCKED ? 'error' : 'primary'}
            showLabel
            animated
          />
        </div>

        <div className={styles.footer}>
          <div className={styles.assignee}>
            {task.assigneeId && (
              <Avatar
                src={task.assignee?.avatarUrl}
                name={task.assignee?.name || 'Unassigned'}
                size="sm"
                alt={`Assigned to ${task.assignee?.name || 'Unassigned'}`}
              />
            )}
          </div>
          
          <div className={styles.dueDate}>
            <span className={styles.dueDateLabel}>Due:</span>
            <time dateTime={task.dueDate || ''}>
              {formatDueDate(task.dueDate)}
            </time>
          </div>
        </div>
      </div>
    </Card>
  );
});

TaskCard.displayName = 'TaskCard';

export default TaskCard;

// CSS Module type definitions
declare module './TaskCard.module.css' {
  interface TaskCardStyles {
    taskCard: string;
    interactive: string;
    overdue: string;
    header: string;
    title: string;
    badges: string;
    content: string;
    description: string;
    progress: string;
    footer: string;
    assignee: string;
    dueDate: string;
    dueDateLabel: string;
  }
  const styles: TaskCardStyles;
  export default styles;
}