/**
 * @fileoverview A high-performance, accessible task list component with virtualization,
 * real-time updates, and optimistic updates support.
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useState } from 'react'; // ^18.2.0
import { useVirtual } from 'react-virtual'; // ^2.10.4
import { useQuery, useMutation, useQueryClient } from 'react-query'; // ^3.39.0
import { 
  CircularProgress, 
  Alert, 
  Box, 
  Grid,
  useTheme,
  useMediaQuery 
} from '@mui/material'; // ^5.14.0
import TaskCard from './TaskCard';
import { Task, TaskStatus, TaskPriority, TaskFilter } from '../../types/task.types';
import styles from './TaskList.module.css';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TaskListProps {
  projectId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  onTaskClick: (taskId: string) => void;
  virtualizeThreshold?: number;
  customLoader?: React.ReactNode;
  errorFallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface TaskListState {
  selectedTaskId: string | null;
  optimisticUpdates: Map<string, Partial<Task>>;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_VIRTUALIZE_THRESHOLD = 50;
const GRID_SPACING = 2;
const TASK_CARD_HEIGHT = 200;
const SCROLL_THRESHOLD = 0.8;

// ============================================================================
// Component
// ============================================================================

export const TaskList: React.FC<TaskListProps> = React.memo(({
  projectId,
  assigneeId,
  status,
  priority,
  onTaskClick,
  virtualizeThreshold = DEFAULT_VIRTUALIZE_THRESHOLD,
  customLoader,
  errorFallback: ErrorFallback
}) => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  // Local state
  const [state, setState] = useState<TaskListState>({
    selectedTaskId: null,
    optimisticUpdates: new Map()
  });

  // Query client for cache management
  const queryClient = useQueryClient();

  // Calculate grid columns based on screen size
  const gridColumns = useMemo(() => {
    if (isMobile) return 1;
    if (isTablet) return 2;
    return 3;
  }, [isMobile, isTablet]);

  // Prepare task filter
  const taskFilter: TaskFilter = useMemo(() => ({
    projectId,
    assigneeId,
    status,
    priority
  }), [projectId, assigneeId, status, priority]);

  // Fetch tasks with react-query
  const {
    data: tasks,
    isLoading,
    error,
    refetch
  } = useQuery(
    ['tasks', taskFilter],
    async () => {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskFilter)
      });
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
    {
      staleTime: 30000, // Consider data fresh for 30 seconds
      cacheTime: 300000, // Cache for 5 minutes
      refetchOnWindowFocus: true,
      retry: 3
    }
  );

  // Setup virtualization if needed
  const parentRef = React.useRef<HTMLDivElement>(null);
  const shouldVirtualize = (tasks?.length ?? 0) > virtualizeThreshold;

  const rowVirtualizer = useVirtual({
    size: Math.ceil((tasks?.length ?? 0) / gridColumns),
    parentRef,
    estimateSize: useCallback(() => TASK_CARD_HEIGHT, []),
    overscan: 5
  });

  // Task update mutation
  const updateTaskMutation = useMutation(
    async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!response.ok) throw new Error('Failed to update task');
      return response.json();
    },
    {
      onMutate: async ({ taskId, updates }) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries(['tasks', taskFilter]);

        // Snapshot previous value
        const previousTasks = queryClient.getQueryData(['tasks', taskFilter]);

        // Apply optimistic update
        setState(prev => ({
          ...prev,
          optimisticUpdates: new Map(prev.optimisticUpdates).set(taskId, updates)
        }));

        return { previousTasks };
      },
      onError: (err, { taskId }, context) => {
        // Revert optimistic update
        queryClient.setQueryData(['tasks', taskFilter], context?.previousTasks);
        setState(prev => {
          const newUpdates = new Map(prev.optimisticUpdates);
          newUpdates.delete(taskId);
          return { ...prev, optimisticUpdates: newUpdates };
        });
      },
      onSettled: () => {
        queryClient.invalidateQueries(['tasks', taskFilter]);
      }
    }
  );

  // Handle task selection
  const handleTaskSelect = useCallback((taskId: string) => {
    setState(prev => ({ ...prev, selectedTaskId: taskId }));
    onTaskClick(taskId);
  }, [onTaskClick]);

  // Error handling
  if (error && ErrorFallback) {
    return <ErrorFallback error={error as Error} reset={refetch} />;
  }

  if (error) {
    return (
      <Alert severity="error" className={styles.error}>
        Failed to load tasks. Please try again later.
      </Alert>
    );
  }

  // Loading state
  if (isLoading) {
    return customLoader || (
      <Box className={styles.loader}>
        <CircularProgress />
      </Box>
    );
  }

  // Render task grid with virtualization if needed
  return (
    <Box
      ref={parentRef}
      className={styles.container}
      role="list"
      aria-label="Task list"
    >
      <Grid container spacing={GRID_SPACING}>
        {shouldVirtualize ? (
          rowVirtualizer.virtualItems.map(virtualRow => (
            <React.Fragment key={virtualRow.index}>
              {Array.from({ length: gridColumns }).map((_, colIndex) => {
                const taskIndex = virtualRow.index * gridColumns + colIndex;
                const task = tasks?.[taskIndex];
                if (!task) return null;

                const optimisticUpdate = state.optimisticUpdates.get(task.id);
                const updatedTask = optimisticUpdate ? { ...task, ...optimisticUpdate } : task;

                return (
                  <Grid item xs={12 / gridColumns} key={`${virtualRow.index}-${colIndex}`}>
                    <TaskCard
                      task={updatedTask}
                      onClick={() => handleTaskSelect(task.id)}
                      elevation={state.selectedTaskId === task.id ? 3 : 1}
                    />
                  </Grid>
                );
              })}
            </React.Fragment>
          ))
        ) : (
          tasks?.map(task => {
            const optimisticUpdate = state.optimisticUpdates.get(task.id);
            const updatedTask = optimisticUpdate ? { ...task, ...optimisticUpdate } : task;

            return (
              <Grid item xs={12 / gridColumns} key={task.id}>
                <TaskCard
                  task={updatedTask}
                  onClick={() => handleTaskSelect(task.id)}
                  elevation={state.selectedTaskId === task.id ? 3 : 1}
                />
              </Grid>
            );
          })
        )}
      </Grid>
    </Box>
  );
});

TaskList.displayName = 'TaskList';

export default TaskList;