/**
 * @fileoverview Enterprise-grade Recent Tasks component for dashboard display
 * @version 1.0.0
 * @package react@18.2.0
 * @package date-fns@2.30.0
 * @package react-window@1.8.9
 */

import React, { useCallback, useMemo, useState } from 'react';
import { format, isToday, isTomorrow, isYesterday } from 'date-fns';
import { VariableSizeList as VirtualList } from 'react-window';
import { Task, TaskPriority } from '../../types/task.types';
import Card from '../common/Card';
import { useTasks } from '../../hooks/useTasks';
import styles from './RecentTasks.module.css';

// ============================================================================
// Types
// ============================================================================

interface RecentTasksProps {
  /** Maximum number of tasks to display */
  limit?: number;
  /** Additional CSS classes */
  className?: string;
  /** Filter tasks by priority */
  filterPriority?: TaskPriority;
  /** Task click handler */
  onTaskClick?: (task: Task) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LIMIT = 5;
const TASK_ITEM_HEIGHT = 72; // Base height for task items
const TASK_ITEM_EXPANDED_HEIGHT = 96; // Height when task has long content

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Formats the task due date into a human-readable string
 */
const formatDueDate = (date: string | null): string => {
  if (!date) return 'No due date';

  const dueDate = new Date(date);
  
  if (isToday(dueDate)) return `Today at ${format(dueDate, 'h:mm a')}`;
  if (isTomorrow(dueDate)) return `Tomorrow at ${format(dueDate, 'h:mm a')}`;
  if (isYesterday(dueDate)) return `Yesterday at ${format(dueDate, 'h:mm a')}`;
  
  return format(dueDate, 'MMM d, yyyy');
};

// ============================================================================
// Component Implementation
// ============================================================================

const RecentTasks: React.FC<RecentTasksProps> = ({
  limit = DEFAULT_LIMIT,
  className = '',
  filterPriority,
  onTaskClick,
}) => {
  // State and hooks
  const { tasks, loading, error, actions } = useTasks({
    enableCache: true,
    retryCount: 3,
  });
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];
    
    if (filterPriority) {
      filtered = filtered.filter(task => task.priority === filterPriority);
    }
    
    return filtered
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }, [tasks, filterPriority, limit]);

  // Calculate item heights for virtual list
  const getItemHeight = useCallback((index: number) => {
    const task = filteredTasks[index];
    return task?.id === expandedTaskId ? TASK_ITEM_EXPANDED_HEIGHT : TASK_ITEM_HEIGHT;
  }, [filteredTasks, expandedTaskId]);

  // Handle task click with debouncing
  const handleTaskClick = useCallback((task: Task) => {
    if (!onTaskClick) return;
    
    // Debounce click handler to prevent double clicks
    let timeoutId: NodeJS.Timeout;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => onTaskClick(task), 300);
  }, [onTaskClick]);

  // Render task item
  const renderTask = useCallback(({ index, style }: { index: number, style: React.CSSProperties }) => {
    const task = filteredTasks[index];
    const isExpanded = task.id === expandedTaskId;

    return (
      <div style={style} className={styles.taskItemContainer}>
        <Card
          elevation={1}
          className={`${styles.taskItem} ${isExpanded ? styles.expanded : ''}`}
          onClick={() => handleTaskClick(task)}
          testId={`task-item-${task.id}`}
        >
          <div className={styles.taskHeader}>
            <h3 className={styles.taskTitle}>{task.title}</h3>
            <button
              className={styles.expandButton}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedTaskId(isExpanded ? null : task.id);
              }}
              aria-label={isExpanded ? 'Collapse task' : 'Expand task'}
            >
              {isExpanded ? '−' : '+'}
            </button>
          </div>

          <div className={styles.taskMeta}>
            <span 
              className={`${styles.priority} ${styles[task.priority.toLowerCase()]}`}
              aria-label={`Priority: ${task.priority}`}
            >
              {task.priority}
            </span>
            <span 
              className={`${styles.status} ${styles[task.status.toLowerCase()]}`}
              aria-label={`Status: ${task.status}`}
            >
              {task.status}
            </span>
            <span className={styles.dueDate}>
              {formatDueDate(task.dueDate)}
            </span>
          </div>

          {isExpanded && task.description && (
            <p className={styles.description}>{task.description}</p>
          )}
        </Card>
      </div>
    );
  }, [filteredTasks, expandedTaskId, handleTaskClick]);

  // Handle error states
  if (error) {
    return (
      <Card className={`${styles.errorCard} ${className}`}>
        <p>Error loading tasks. Please try again later.</p>
        <button 
          onClick={() => actions.refreshTasks()}
          className={styles.retryButton}
        >
          Retry
        </button>
      </Card>
    );
  }

  // Handle loading state
  if (loading.fetchTasks) {
    return (
      <Card className={`${styles.loadingCard} ${className}`}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={styles.skeleton} />
        ))}
      </Card>
    );
  }

  return (
    <Card className={`${styles.recentTasks} ${className}`}>
      <h2 className={styles.heading}>Recent Tasks</h2>
      {filteredTasks.length > 0 ? (
        <VirtualList
          height={Math.min(filteredTasks.length * TASK_ITEM_HEIGHT, 400)}
          width="100%"
          itemCount={filteredTasks.length}
          itemSize={getItemHeight}
          className={styles.taskList}
        >
          {renderTask}
        </VirtualList>
      ) : (
        <p className={styles.emptyState}>No tasks found</p>
      )}
    </Card>
  );
};

export default React.memo(RecentTasks);