/**
 * @fileoverview A high-performance Kanban-style board component for task management
 * with virtualized scrolling and accessibility features.
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'; // ^13.1.1
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { Task, TaskStatus } from '../../types/task.types';
import TaskCard from './TaskCard';
import styles from './TaskBoard.module.css';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TaskBoardProps {
  /** Optional project ID to filter tasks */
  projectId?: UUID;
  /** Optional additional CSS classes */
  className?: string;
  /** Callback for successful drag operations */
  onDragComplete: (taskId: UUID, newStatus: TaskStatus) => Promise<void>;
  /** Error handler for failed operations */
  onError: (error: Error) => void;
}

interface TaskColumn {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  isDropDisabled: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const COLUMN_WIDTH = 300; // px
const TASK_HEIGHT = 150; // px
const COLUMN_PADDING = 16; // px

const COLUMNS: TaskColumn[] = [
  { status: TaskStatus.TODO, title: 'To Do', tasks: [], isDropDisabled: false },
  { status: TaskStatus.IN_PROGRESS, title: 'In Progress', tasks: [], isDropDisabled: false },
  { status: TaskStatus.IN_REVIEW, title: 'In Review', tasks: [], isDropDisabled: false },
  { status: TaskStatus.COMPLETED, title: 'Completed', tasks: [], isDropDisabled: false },
  { status: TaskStatus.BLOCKED, title: 'Blocked', tasks: [], isDropDisabled: true }
];

// ============================================================================
// Component
// ============================================================================

export const TaskBoard: React.FC<TaskBoardProps> = React.memo(({
  projectId,
  className,
  onDragComplete,
  onError
}) => {
  // State for optimistic updates
  const [optimisticTasks, setOptimisticTasks] = useState<Task[]>([]);

  // Setup virtualizers for each column
  const columnVirtualizers = useMemo(() => 
    COLUMNS.map(column => useVirtualizer({
      count: column.tasks.length,
      getScrollElement: () => document.querySelector(`[data-column="${column.status}"]`),
      estimateSize: () => TASK_HEIGHT,
      overscan: 5
    })), []);

  // Group tasks by status with virtualization
  const getVirtualizedColumns = useCallback((tasks: Task[]) => {
    return COLUMNS.map((column, index) => ({
      ...column,
      tasks: tasks.filter(task => task.status === column.status),
      virtualizer: columnVirtualizers[index]
    }));
  }, [columnVirtualizers]);

  // Handle drag end with optimistic updates
  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    // Return if dropped outside or in same position
    if (!destination || 
        (source.droppableId === destination.droppableId && 
         source.index === destination.index)) {
      return;
    }

    // Get new status from destination column
    const newStatus = destination.droppableId as TaskStatus;

    try {
      // Optimistically update UI
      setOptimisticTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === draggableId 
            ? { ...task, status: newStatus }
            : task
        )
      );

      // Announce status change to screen readers
      const statusAnnouncement = `Task moved to ${newStatus}`;
      document.getElementById('status-announcer')?.setAttribute('aria-label', statusAnnouncement);

      // Persist the change
      await onDragComplete(draggableId, newStatus);
    } catch (error) {
      // Revert optimistic update on failure
      setOptimisticTasks(prevTasks => 
        prevTasks.map(task => 
          task.id === draggableId 
            ? { ...task, status: source.droppableId as TaskStatus }
            : task
        )
      );

      onError(error as Error);
    }
  }, [onDragComplete, onError]);

  return (
    <div 
      className={`${styles.taskBoard} ${className || ''}`}
      role="region"
      aria-label="Task board"
    >
      {/* Screen reader announcements */}
      <div 
        id="status-announcer" 
        className="sr-only" 
        role="status" 
        aria-live="polite"
      />

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className={styles.columns}>
          {getVirtualizedColumns(optimisticTasks).map(column => (
            <div 
              key={column.status}
              className={styles.column}
              style={{ width: COLUMN_WIDTH }}
            >
              <h2 className={styles.columnHeader}>
                {column.title}
                <span className={styles.taskCount}>
                  {column.tasks.length}
                </span>
              </h2>

              <Droppable
                droppableId={column.status}
                isDropDisabled={column.isDropDisabled}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`${styles.taskList} ${
                      snapshot.isDraggingOver ? styles.draggingOver : ''
                    }`}
                    data-column={column.status}
                    style={{
                      height: `${column.virtualizer.getTotalSize()}px`,
                      padding: COLUMN_PADDING
                    }}
                  >
                    {column.virtualizer.getVirtualItems().map((virtualRow, index) => {
                      const task = column.tasks[virtualRow.index];
                      return (
                        <Draggable
                          key={task.id}
                          draggableId={task.id}
                          index={index}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={`${styles.taskWrapper} ${
                                dragSnapshot.isDragging ? styles.dragging : ''
                              }`}
                              style={{
                                ...dragProvided.draggableProps.style,
                                position: 'absolute',
                                top: 0,
                                transform: `translateY(${virtualRow.start}px)`
                              }}
                            >
                              <TaskCard
                                task={task}
                                elevation={dragSnapshot.isDragging ? 3 : 1}
                              />
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
});

TaskBoard.displayName = 'TaskBoard';

export default TaskBoard;

// CSS Module type definitions
declare module './TaskBoard.module.css' {
  interface TaskBoardStyles {
    taskBoard: string;
    columns: string;
    column: string;
    columnHeader: string;
    taskCount: string;
    taskList: string;
    taskWrapper: string;
    draggingOver: string;
    dragging: string;
  }
  const styles: TaskBoardStyles;
  export default styles;
}