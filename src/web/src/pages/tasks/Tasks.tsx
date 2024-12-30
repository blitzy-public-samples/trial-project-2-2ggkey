/**
 * @fileoverview Main tasks page component providing list and board views for task management
 * with optimistic updates, error handling, and accessibility features.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Box, 
  Container,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Snackbar,
  CircularProgress,
  useTheme,
  useMediaQuery 
} from '@mui/material'; // ^5.14.0
import { ViewList, ViewKanban } from '@mui/icons-material'; // ^5.14.0
import { useAnalytics } from '@monitoring/analytics'; // ^2.0.0

// Internal imports
import TaskList from '../../components/tasks/TaskList';
import TaskBoard from '../../components/tasks/TaskBoard';
import { useTasks } from '../../hooks/useTasks';
import { TaskStatus, TaskPriority } from '../../types/task.types';
import styles from './Tasks.module.css';

// ============================================================================
// Types & Interfaces
// ============================================================================

type ViewType = 'list' | 'board';

interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  searchTerm?: string;
}

// ============================================================================
// Constants
// ============================================================================

const VIEW_STORAGE_KEY = 'preferred_task_view';
const DEFAULT_VIEW: ViewType = 'list';

// ============================================================================
// Component
// ============================================================================

const Tasks: React.FC = () => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Analytics hook
  const analytics = useAnalytics();

  // URL search params for filter persistence
  const [searchParams, setSearchParams] = useSearchParams();

  // Local state
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    return (localStorage.getItem(VIEW_STORAGE_KEY) as ViewType) || DEFAULT_VIEW;
  });
  const [error, setError] = useState<Error | null>(null);

  // Task management hook
  const {
    tasks,
    loading,
    errors: taskErrors,
    actions: {
      createTask,
      updateTaskStatus,
      updateTaskPriority,
      refreshTasks,
      clearErrors
    }
  } = useTasks({
    enableCache: true,
    optimisticUpdates: true
  });

  // Parse filters from URL
  const filters = useMemo((): TaskFilters => ({
    status: searchParams.get('status') as TaskStatus || undefined,
    priority: searchParams.get('priority') as TaskPriority || undefined,
    assigneeId: searchParams.get('assignee') || undefined,
    searchTerm: searchParams.get('search') || undefined
  }), [searchParams]);

  // Handle view changes
  const handleViewChange = useCallback((
    _: React.MouseEvent<HTMLElement>,
    newView: ViewType
  ) => {
    if (newView) {
      setCurrentView(newView);
      localStorage.setItem(VIEW_STORAGE_KEY, newView);
      
      // Track view change
      analytics.track('task_view_changed', { view: newView });
    }
  }, [analytics]);

  // Handle task status changes (for board view)
  const handleTaskStatusChange = useCallback(async (
    taskId: string,
    newStatus: TaskStatus
  ) => {
    try {
      await updateTaskStatus(taskId, newStatus);
      analytics.track('task_status_changed', { taskId, status: newStatus });
    } catch (err) {
      setError(err as Error);
    }
  }, [updateTaskStatus, analytics]);

  // Handle task click navigation
  const handleTaskClick = useCallback((taskId: string) => {
    analytics.track('task_selected', { taskId });
    // Navigate to task details (implementation depends on routing setup)
  }, [analytics]);

  // Error handling effect
  useEffect(() => {
    if (taskErrors.updateTask) {
      setError(taskErrors.updateTask);
    }
  }, [taskErrors]);

  // Error snackbar close handler
  const handleErrorClose = useCallback(() => {
    setError(null);
    clearErrors();
  }, [clearErrors]);

  return (
    <Container 
      component="main"
      className={styles.tasksPage}
      role="main"
      aria-label="Tasks page"
    >
      {/* View Toggle */}
      <Box className={styles.header}>
        <ToggleButtonGroup
          value={currentView}
          exclusive
          onChange={handleViewChange}
          aria-label="Task view mode"
          size={isMobile ? 'small' : 'medium'}
        >
          <ToggleButton 
            value="list" 
            aria-label="List view"
            data-testid="list-view-toggle"
          >
            <ViewList /> List
          </ToggleButton>
          <ToggleButton 
            value="board" 
            aria-label="Board view"
            data-testid="board-view-toggle"
          >
            <ViewKanban /> Board
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Loading State */}
      {loading.fetchTasks && (
        <Box className={styles.loadingContainer}>
          <CircularProgress />
        </Box>
      )}

      {/* Task Views */}
      {!loading.fetchTasks && (
        <Box className={styles.content}>
          {currentView === 'list' ? (
            <TaskList
              tasks={tasks}
              onTaskClick={handleTaskClick}
              filters={filters}
              virtualizeThreshold={50}
              errorFallback={(error) => (
                <Alert severity="error" onClose={handleErrorClose}>
                  {error.message}
                </Alert>
              )}
            />
          ) : (
            <TaskBoard
              projectId={filters.projectId}
              onDragComplete={handleTaskStatusChange}
              onError={(error) => setError(error)}
              className={styles.board}
            />
          )}
        </Box>
      )}

      {/* Error Handling */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleErrorClose}
      >
        <Alert 
          onClose={handleErrorClose} 
          severity="error"
          variant="filled"
        >
          {error?.message || 'An error occurred'}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Tasks;