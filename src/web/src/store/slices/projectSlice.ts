/**
 * @fileoverview Redux slice for managing project state in the task management system
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
// @reduxjs/toolkit version: 1.9+

import { 
  Project, 
  ProjectStatus, 
  ProjectPriority,
  ProjectFilter,
  CreateProjectRequest,
  UpdateProjectRequest 
} from '../../types/project.types';
import { UUID, PaginatedResponse } from '../../types/common.types';

// ============================================================================
// Types
// ============================================================================

interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  loading: boolean;
  error: string | null;
  totalProjects: number;
  currentPage: number;
  pageSize: number;
  filters: ProjectFilter;
  teamUtilization: Record<UUID, number>;
  milestoneProgress: Record<UUID, number>;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: ProjectState = {
  projects: [],
  selectedProject: null,
  loading: false,
  error: null,
  totalProjects: 0,
  currentPage: 1,
  pageSize: 10,
  filters: {},
  teamUtilization: {},
  milestoneProgress: {}
};

// ============================================================================
// Async Thunks
// ============================================================================

export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async ({ page, pageSize, filters }: { 
    page: number; 
    pageSize: number; 
    filters?: ProjectFilter 
  }) => {
    try {
      const response = await fetch(`/api/v1/projects?page=${page}&pageSize=${pageSize}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data: PaginatedResponse<Project> = await response.json();
      return data;
    } catch (error) {
      throw new Error('Failed to fetch projects');
    }
  }
);

export const createProject = createAsyncThunk(
  'projects/createProject',
  async (projectData: CreateProjectRequest) => {
    try {
      const response = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });
      const data: Project = await response.json();
      return data;
    } catch (error) {
      throw new Error('Failed to create project');
    }
  }
);

export const updateProject = createAsyncThunk(
  'projects/updateProject',
  async ({ projectId, updates }: { projectId: UUID; updates: UpdateProjectRequest }) => {
    try {
      const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data: Project = await response.json();
      return data;
    } catch (error) {
      throw new Error('Failed to update project');
    }
  }
);

export const updateTeamAllocation = createAsyncThunk(
  'projects/updateTeamAllocation',
  async ({ projectId, teamAllocations }: { 
    projectId: UUID; 
    teamAllocations: Record<UUID, number> 
  }) => {
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/team-allocation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamAllocations })
      });
      const data = await response.json();
      return { projectId, teamAllocations: data.teamAllocations };
    } catch (error) {
      throw new Error('Failed to update team allocation');
    }
  }
);

// ============================================================================
// Slice Definition
// ============================================================================

export const projectSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setSelectedProject: (state, action: PayloadAction<Project | null>) => {
      state.selectedProject = action.payload;
    },
    setFilters: (state, action: PayloadAction<ProjectFilter>) => {
      state.filters = action.payload;
      state.currentPage = 1; // Reset to first page when filters change
    },
    updateMilestoneProgress: (state, action: PayloadAction<{ 
      projectId: UUID; 
      progress: number 
    }>) => {
      state.milestoneProgress[action.payload.projectId] = action.payload.progress;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Projects
      .addCase(fetchProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.loading = false;
        state.projects = action.payload.items;
        state.totalProjects = action.payload.total;
        state.currentPage = action.payload.page;
        state.pageSize = action.payload.pageSize;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch projects';
      })
      // Create Project
      .addCase(createProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.loading = false;
        state.projects.unshift(action.payload);
        state.totalProjects += 1;
      })
      .addCase(createProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to create project';
      })
      // Update Project
      .addCase(updateProject.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.projects.findIndex(p => p.id === action.payload.id);
        if (index !== -1) {
          state.projects[index] = action.payload;
        }
        if (state.selectedProject?.id === action.payload.id) {
          state.selectedProject = action.payload;
        }
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update project';
      })
      // Update Team Allocation
      .addCase(updateTeamAllocation.fulfilled, (state, action) => {
        state.teamUtilization = {
          ...state.teamUtilization,
          ...action.payload.teamAllocations
        };
      });
  }
});

// ============================================================================
// Selectors
// ============================================================================

export const selectAllProjects = (state: { projects: ProjectState }) => state.projects.projects;
export const selectSelectedProject = (state: { projects: ProjectState }) => state.projects.selectedProject;
export const selectProjectsLoading = (state: { projects: ProjectState }) => state.projects.loading;
export const selectProjectsError = (state: { projects: ProjectState }) => state.projects.error;
export const selectProjectFilters = (state: { projects: ProjectState }) => state.projects.filters;

export const selectProjectsByStatus = createSelector(
  [selectAllProjects, (_, status: ProjectStatus) => status],
  (projects, status) => projects.filter(project => project.status === status)
);

export const selectTeamUtilization = createSelector(
  [(state: { projects: ProjectState }) => state.projects.teamUtilization],
  (teamUtilization) => teamUtilization
);

export const selectProjectProgress = createSelector(
  [selectAllProjects],
  (projects) => projects.reduce((acc, project) => ({
    ...acc,
    [project.id]: project.progress
  }), {} as Record<UUID, number>)
);

// Export actions
export const { 
  setSelectedProject, 
  setFilters, 
  updateMilestoneProgress, 
  clearError 
} = projectSlice.actions;

// Export reducer
export default projectSlice.reducer;