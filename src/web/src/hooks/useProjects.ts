/**
 * @fileoverview Custom React hook for managing project-related operations and state
 * @version 1.0.0
 */

// External imports - versions specified as per technical requirements
import { useSelector, useDispatch } from 'react-redux'; // v8.1+
import { useCallback, useEffect, useMemo } from 'react'; // v18.2+
import debounce from 'lodash/debounce'; // v4.17+

// Internal imports
import { 
  Project, 
  ProjectStatus, 
  ProjectFilter,
  CreateProjectRequest,
  UpdateProjectRequest 
} from '../types/project.types';
import { 
  selectAllProjects,
  selectProjectsLoading,
  selectProjectsError,
  selectSelectedProject,
  selectProjectFilters,
  selectTeamUtilization,
  selectProjectProgress,
  fetchProjects,
  createProject,
  updateProject,
  setSelectedProject,
  setFilters,
  updateMilestoneProgress,
  clearError
} from '../store/slices/projectSlice';
import { UUID } from '../types/common.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Project statistics interface
 */
interface ProjectStats {
  totalProjects: number;
  projectsByStatus: Record<ProjectStatus, number>;
  averageProgress: number;
  teamUtilization: Record<UUID, number>;
}

/**
 * Custom error type for project operations
 */
interface ProjectError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Return type for useProjects hook
 */
interface UseProjectsReturn {
  // State
  projects: Project[];
  filteredProjects: Project[];
  loading: boolean;
  error: ProjectError | null;
  selectedProject: Project | null;
  projectStats: ProjectStats;

  // Actions
  createProject: (data: CreateProjectRequest) => Promise<void>;
  updateProject: (id: UUID, updates: UpdateProjectRequest) => Promise<void>;
  selectProject: (project: Project | null) => void;
  setProjectFilters: (filters: ProjectFilter) => void;
  updateMilestone: (projectId: UUID, progress: number) => void;
  clearProjectError: () => void;
  refreshProjects: () => Promise<void>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for managing project operations and state
 * @param filters - Optional project filters
 * @returns {UseProjectsReturn} Object containing project state and operations
 */
export const useProjects = (filters?: ProjectFilter): UseProjectsReturn => {
  const dispatch = useDispatch();

  // Selectors
  const projects = useSelector(selectAllProjects);
  const loading = useSelector(selectProjectsLoading);
  const error = useSelector(selectProjectsError);
  const selectedProject = useSelector(selectSelectedProject);
  const currentFilters = useSelector(selectProjectFilters);
  const teamUtilization = useSelector(selectTeamUtilization);
  const projectProgress = useSelector(selectProjectProgress);

  // Memoized project statistics
  const projectStats: ProjectStats = useMemo(() => {
    const statusCounts = projects.reduce((acc, project) => ({
      ...acc,
      [project.status]: (acc[project.status] || 0) + 1
    }), {} as Record<ProjectStatus, number>);

    const totalProgress = projects.reduce((sum, project) => sum + project.progress, 0);

    return {
      totalProjects: projects.length,
      projectsByStatus: statusCounts,
      averageProgress: projects.length ? totalProgress / projects.length : 0,
      teamUtilization
    };
  }, [projects, teamUtilization]);

  // Debounced filter application
  const debouncedSetFilters = useMemo(
    () => debounce((newFilters: ProjectFilter) => {
      dispatch(setFilters(newFilters));
    }, 300),
    [dispatch]
  );

  // Effect to apply initial filters
  useEffect(() => {
    if (filters) {
      debouncedSetFilters(filters);
    }
    return () => {
      debouncedSetFilters.cancel();
    };
  }, [filters, debouncedSetFilters]);

  // Effect to fetch initial projects
  useEffect(() => {
    dispatch(fetchProjects({ page: 1, pageSize: 10, filters: currentFilters }));
  }, [dispatch, currentFilters]);

  // Memoized filtered projects
  const filteredProjects = useMemo(() => {
    if (!filters) return projects;
    
    return projects.filter(project => {
      if (filters.status && !filters.status.includes(project.status)) return false;
      if (filters.teamMemberIds && !filters.teamMemberIds.some(id => project.teamMemberIds.includes(id))) return false;
      if (filters.tags && !filters.tags.some(tag => project.tags.includes(tag))) return false;
      
      if (filters.startDate && new Date(project.startDate!) < new Date(filters.startDate)) return false;
      if (filters.endDate && new Date(project.dueDate!) > new Date(filters.endDate)) return false;
      
      return true;
    });
  }, [projects, filters]);

  // Callback functions
  const handleCreateProject = useCallback(async (data: CreateProjectRequest) => {
    try {
      await dispatch(createProject(data)).unwrap();
    } catch (err) {
      throw new Error('Failed to create project');
    }
  }, [dispatch]);

  const handleUpdateProject = useCallback(async (id: UUID, updates: UpdateProjectRequest) => {
    try {
      await dispatch(updateProject({ projectId: id, updates })).unwrap();
    } catch (err) {
      throw new Error('Failed to update project');
    }
  }, [dispatch]);

  const handleSelectProject = useCallback((project: Project | null) => {
    dispatch(setSelectedProject(project));
  }, [dispatch]);

  const handleSetFilters = useCallback((newFilters: ProjectFilter) => {
    debouncedSetFilters(newFilters);
  }, [debouncedSetFilters]);

  const handleUpdateMilestone = useCallback((projectId: UUID, progress: number) => {
    dispatch(updateMilestoneProgress({ projectId, progress }));
  }, [dispatch]);

  const handleClearError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleRefreshProjects = useCallback(async () => {
    try {
      await dispatch(fetchProjects({ 
        page: 1, 
        pageSize: 10, 
        filters: currentFilters 
      })).unwrap();
    } catch (err) {
      throw new Error('Failed to refresh projects');
    }
  }, [dispatch, currentFilters]);

  return {
    // State
    projects,
    filteredProjects,
    loading,
    error: error ? { code: 'PROJECT_ERROR', message: error } : null,
    selectedProject,
    projectStats,

    // Actions
    createProject: handleCreateProject,
    updateProject: handleUpdateProject,
    selectProject: handleSelectProject,
    setProjectFilters: handleSetFilters,
    updateMilestone: handleUpdateMilestone,
    clearProjectError: handleClearError,
    refreshProjects: handleRefreshProjects
  };
};

export default useProjects;