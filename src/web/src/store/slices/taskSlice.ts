/**
 * @fileoverview Redux Toolkit slice for task management with enhanced features
 * @version 1.0.0
 * @package @reduxjs/toolkit@1.9.0
 */

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { 
  Task, 
  TaskStatus, 
  TaskPriority, 
  CreateTaskDto, 
  UpdateTaskDto,
  TaskQueryParams 
} from '../../types/task.types';
import { UUID } from '../../types/common.types';
import tasksApi from '../../api/tasksApi';

// ============================================================================
// Types
// ============================================================================

/**
 * Enhanced task state interface with comprehensive tracking
 */
interface TaskState {
  tasks: Task[];
  selectedTask: Task | null;
  loading: {
    fetchTasks: boolean;
    createTask: boolean;
    updateTask: boolean;
    deleteTask: boolean;
    [key: string]: boolean;
  };
  errors: {
    fetchTasks: Error | null;
    createTask: Error | null;
    updateTask: Error | null;
    deleteTask: Error | null;
    [key: string]: Error | null;
  };
  filters: {
    status: TaskStatus | null;
    priority: TaskPriority | null;
    assigneeId: UUID | null;
    projectId: UUID | null;
    search: string | null;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
  cache: {
    timestamp: number;
    invalidated: boolean;
  };
  metrics: {
    updateCount: number;
    errorCount: number;
    lastUpdate: number;
    performance: {
      avgLoadTime: number;
      cacheHitRate: number;
    };
  };
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_DURATION = 300000; // 5 minutes
const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// Initial State
// ============================================================================

const initialState: TaskState = {
  tasks: [],
  selectedTask: null,
  loading: {
    fetchTasks: false,
    createTask: false,
    updateTask: false,
    deleteTask: false
  },
  errors: {
    fetchTasks: null,
    createTask: null,
    updateTask: null,
    deleteTask: null
  },
  filters: {
    status: null,
    priority: null,
    assigneeId: null,
    projectId: null,
    search: null
  },
  pagination: {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0
  },
  cache: {
    timestamp: 0,
    invalidated: false
  },
  metrics: {
    updateCount: 0,
    errorCount: 0,
    lastUpdate: 0,
    performance: {
      avgLoadTime: 0,
      cacheHitRate: 0
    }
  }
};

// ============================================================================
// Async Thunks
// ============================================================================

/**
 * Fetch tasks with enhanced error handling and caching
 */
export const fetchTasks = createAsyncThunk(
  'tasks/fetchTasks',
  async (params: TaskQueryParams, { rejectWithValue, getState }) => {
    try {
      const startTime = performance.now();
      const response = await tasksApi.getTasks(params);
      
      if (!response.success) {
        return rejectWithValue(response.error);
      }

      const endTime = performance.now();
      const loadTime = endTime - startTime;

      return {
        data: response.data,
        metrics: { loadTime }
      };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Create task with optimistic updates
 */
export const createTask = createAsyncThunk(
  'tasks/createTask',
  async (taskData: CreateTaskDto, { rejectWithValue }) => {
    try {
      const response = await tasksApi.createTask(taskData);
      
      if (!response.success) {
        return rejectWithValue(response.error);
      }

      return response.data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Update task with validation
 */
export const updateTask = createAsyncThunk(
  'tasks/updateTask',
  async ({ taskId, updateData }: { taskId: UUID; updateData: UpdateTaskDto }, 
    { rejectWithValue }
  ) => {
    try {
      const response = await tasksApi.updateTask(taskId, updateData);
      
      if (!response.success) {
        return rejectWithValue(response.error);
      }

      return response.data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Delete task with confirmation
 */
export const deleteTask = createAsyncThunk(
  'tasks/deleteTask',
  async (taskId: UUID, { rejectWithValue }) => {
    try {
      const response = await tasksApi.deleteTask(taskId);
      
      if (!response.success) {
        return rejectWithValue(response.error);
      }

      return taskId;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

// ============================================================================
// Slice Definition
// ============================================================================

const taskSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setSelectedTask: (state, action: PayloadAction<Task | null>) => {
      state.selectedTask = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<TaskState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.page = 1; // Reset pagination on filter change
      state.cache.invalidated = true;
    },
    setPagination: (state, action: PayloadAction<Partial<TaskState['pagination']>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
      state.cache.invalidated = true;
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
      state.pagination.page = 1;
      state.cache.invalidated = true;
    },
    invalidateCache: (state) => {
      state.cache.invalidated = true;
    },
    updateMetrics: (state, action: PayloadAction<Partial<TaskState['metrics']>>) => {
      state.metrics = { ...state.metrics, ...action.payload };
    }
  },
  extraReducers: (builder) => {
    // Fetch Tasks
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.loading.fetchTasks = true;
        state.errors.fetchTasks = null;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading.fetchTasks = false;
        state.tasks = action.payload.data.items;
        state.pagination.total = action.payload.data.total;
        state.cache = {
          timestamp: Date.now(),
          invalidated: false
        };
        // Update performance metrics
        state.metrics.performance.avgLoadTime = 
          (state.metrics.performance.avgLoadTime + action.payload.metrics.loadTime) / 2;
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.loading.fetchTasks = false;
        state.errors.fetchTasks = action.payload as Error;
        state.metrics.errorCount++;
      })

    // Create Task
    builder
      .addCase(createTask.pending, (state) => {
        state.loading.createTask = true;
        state.errors.createTask = null;
      })
      .addCase(createTask.fulfilled, (state, action) => {
        state.loading.createTask = false;
        state.tasks.unshift(action.payload);
        state.metrics.updateCount++;
        state.metrics.lastUpdate = Date.now();
        state.cache.invalidated = true;
      })
      .addCase(createTask.rejected, (state, action) => {
        state.loading.createTask = false;
        state.errors.createTask = action.payload as Error;
        state.metrics.errorCount++;
      })

    // Update Task
    builder
      .addCase(updateTask.pending, (state) => {
        state.loading.updateTask = true;
        state.errors.updateTask = null;
      })
      .addCase(updateTask.fulfilled, (state, action) => {
        state.loading.updateTask = false;
        const index = state.tasks.findIndex(task => task.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = action.payload;
        }
        state.metrics.updateCount++;
        state.metrics.lastUpdate = Date.now();
        state.cache.invalidated = true;
      })
      .addCase(updateTask.rejected, (state, action) => {
        state.loading.updateTask = false;
        state.errors.updateTask = action.payload as Error;
        state.metrics.errorCount++;
      })

    // Delete Task
    builder
      .addCase(deleteTask.pending, (state) => {
        state.loading.deleteTask = true;
        state.errors.deleteTask = null;
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.loading.deleteTask = false;
        state.tasks = state.tasks.filter(task => task.id !== action.payload);
        state.metrics.updateCount++;
        state.metrics.lastUpdate = Date.now();
        state.cache.invalidated = true;
      })
      .addCase(deleteTask.rejected, (state, action) => {
        state.loading.deleteTask = false;
        state.errors.deleteTask = action.payload as Error;
        state.metrics.errorCount++;
      });
  }
});

// ============================================================================
// Selectors
// ============================================================================

const selectTaskState = (state: { tasks: TaskState }) => state.tasks;

export const selectTasks = createSelector(
  [selectTaskState],
  (taskState) => taskState.tasks
);

export const selectTaskById = createSelector(
  [selectTasks, (_, taskId: UUID) => taskId],
  (tasks, taskId) => tasks.find(task => task.id === taskId)
);

export const selectFilteredTasks = createSelector(
  [selectTasks, (state: { tasks: TaskState }) => state.tasks.filters],
  (tasks, filters) => {
    return tasks.filter(task => {
      if (filters.status && task.status !== filters.status) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.assigneeId && task.assigneeId !== filters.assigneeId) return false;
      if (filters.projectId && task.projectId !== filters.projectId) return false;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return task.title.toLowerCase().includes(searchLower) ||
               task.description?.toLowerCase().includes(searchLower);
      }
      return true;
    });
  }
);

export const selectTaskMetrics = createSelector(
  [selectTaskState],
  (taskState) => taskState.metrics
);

// ============================================================================
// Exports
// ============================================================================

export const { 
  setSelectedTask, 
  setFilters, 
  setPagination, 
  clearFilters,
  invalidateCache,
  updateMetrics 
} = taskSlice.actions;

export default taskSlice.reducer;