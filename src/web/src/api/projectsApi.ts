/**
 * @fileoverview Enhanced API client for project-related operations with advanced security,
 * caching, and error handling capabilities.
 * @version 1.0.0
 * @package axios-cache-adapter@2.7.3
 */

import ApiClient from './apiClient';
import { setupCache } from 'axios-cache-adapter';
import {
  Project,
  ProjectStatus,
  ProjectPriority,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectResponse,
  ProjectListResponse,
  ProjectFilter
} from '../types/project.types';
import { UUID, PaginatedResponse } from '../types/common.types';

// ============================================================================
// Constants
// ============================================================================

const PROJECTS_ENDPOINT = '/api/v1/projects';
const REQUEST_TIMEOUT = 5000;
const RETRY_ATTEMPTS = 3;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache configuration for project requests
const cache = setupCache({
  maxAge: CACHE_DURATION,
  exclude: { query: false },
  clearOnStale: true,
  readOnError: true
});

// ============================================================================
// Types
// ============================================================================

interface ProjectQueryParams {
  page?: number;
  limit?: number;
  status?: ProjectStatus[];
  priority?: ProjectPriority[];
  teamMemberIds?: UUID[];
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// ProjectsApi Class Implementation
// ============================================================================

export class ProjectsApi {
  private apiClient: typeof ApiClient;

  constructor() {
    this.apiClient = ApiClient;
    this.apiClient.setRequestTimeout(REQUEST_TIMEOUT);
    this.apiClient.setRetryConfig({ attempts: RETRY_ATTEMPTS, delay: 1000 });
  }

  /**
   * Retrieve a paginated list of projects with filtering and sorting
   * @param params - Query parameters for filtering and pagination
   * @returns Promise with paginated project list
   */
  public async getProjects(params: ProjectQueryParams = {}): Promise<ProjectListResponse> {
    try {
      return await this.apiClient.get<PaginatedResponse<Project>>(
        PROJECTS_ENDPOINT,
        params,
        {
          cache: {
            maxAge: CACHE_DURATION,
            exclude: { query: false }
          }
        }
      );
    } catch (error) {
      console.error('[ProjectsApi] Error fetching projects:', error);
      throw error;
    }
  }

  /**
   * Retrieve a single project by ID
   * @param projectId - UUID of the project
   * @returns Promise with project details
   */
  public async getProjectById(projectId: UUID): Promise<ProjectResponse> {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    try {
      return await this.apiClient.get<Project>(
        `${PROJECTS_ENDPOINT}/${projectId}`,
        {},
        {
          cache: {
            maxAge: CACHE_DURATION
          }
        }
      );
    } catch (error) {
      console.error(`[ProjectsApi] Error fetching project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new project
   * @param project - Project creation request data
   * @returns Promise with created project
   */
  public async createProject(project: CreateProjectRequest): Promise<ProjectResponse> {
    if (!project.name) {
      throw new Error('Project name is required');
    }

    try {
      const response = await this.apiClient.post<Project>(
        PROJECTS_ENDPOINT,
        project,
        {
          skipCache: true
        }
      );

      // Invalidate projects list cache after creation
      this.apiClient.clearCache();
      return response;
    } catch (error) {
      console.error('[ProjectsApi] Error creating project:', error);
      throw error;
    }
  }

  /**
   * Update an existing project
   * @param projectId - UUID of the project to update
   * @param updates - Project update data
   * @returns Promise with updated project
   */
  public async updateProject(
    projectId: UUID,
    updates: UpdateProjectRequest
  ): Promise<ProjectResponse> {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    try {
      const response = await this.apiClient.put<Project>(
        `${PROJECTS_ENDPOINT}/${projectId}`,
        updates,
        {
          skipCache: true
        }
      );

      // Invalidate related caches
      this.apiClient.clearCache();
      return response;
    } catch (error) {
      console.error(`[ProjectsApi] Error updating project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a project
   * @param projectId - UUID of the project to delete
   * @returns Promise with deletion confirmation
   */
  public async deleteProject(projectId: UUID): Promise<ProjectResponse> {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    try {
      const response = await this.apiClient.delete<Project>(
        `${PROJECTS_ENDPOINT}/${projectId}`,
        {
          skipCache: true
        }
      );

      // Invalidate related caches
      this.apiClient.clearCache();
      return response;
    } catch (error) {
      console.error(`[ProjectsApi] Error deleting project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Filter projects by custom criteria
   * @param filter - Project filter criteria
   * @returns Promise with filtered project list
   */
  public async filterProjects(filter: ProjectFilter): Promise<ProjectListResponse> {
    try {
      return await this.apiClient.get<PaginatedResponse<Project>>(
        PROJECTS_ENDPOINT,
        { ...filter },
        {
          cache: {
            maxAge: CACHE_DURATION,
            exclude: { query: false }
          }
        }
      );
    } catch (error) {
      console.error('[ProjectsApi] Error filtering projects:', error);
      throw error;
    }
  }

  /**
   * Clear all project-related cache entries
   */
  public clearProjectCache(): void {
    this.apiClient.clearCache();
  }
}

// Create singleton instance
const projectsApi = new ProjectsApi();

// Prevent modifications to the instance
Object.freeze(projectsApi);

export default projectsApi;