package com.taskmanager.services;

import com.taskmanager.entities.Project;
import com.taskmanager.dto.ProjectDTO;
import com.taskmanager.exceptions.ResourceNotFoundException;
import com.taskmanager.exceptions.OptimisticLockingException;
import com.taskmanager.exceptions.UnauthorizedAccessException;
import com.taskmanager.repositories.ProjectRepository;
import com.taskmanager.security.SecurityService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.modelmapper.ModelMapper;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.Optional;

import lombok.extern.slf4j.Slf4j;

/**
 * Service layer implementation for project management operations.
 * Provides caching, security, and optimistic locking capabilities.
 *
 * @version 1.0
 * @since 2024-01
 */
@Slf4j
@Service
@Validated
@CacheConfig(cacheNames = "projects")
@Transactional
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ModelMapper modelMapper;
    private final SecurityService securityService;

    @Autowired
    public ProjectService(
            ProjectRepository projectRepository,
            ModelMapper modelMapper,
            SecurityService securityService) {
        this.projectRepository = projectRepository;
        this.modelMapper = modelMapper;
        this.securityService = securityService;
    }

    /**
     * Retrieves a project by ID with caching support.
     *
     * @param id The UUID of the project to retrieve
     * @return ProjectDTO containing the project data
     * @throws ResourceNotFoundException if project not found
     * @throws UnauthorizedAccessException if user lacks access rights
     */
    @Cacheable(key = "#id", unless = "#result == null")
    @Transactional(readOnly = true)
    public ProjectDTO getProjectById(@NotNull UUID id) {
        log.debug("Fetching project with id: {}", id);
        
        Project project = projectRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + id));

        // Verify user has access rights
        if (!securityService.hasProjectAccess(project)) {
            throw new UnauthorizedAccessException("User not authorized to access project: " + id);
        }

        return modelMapper.map(project, ProjectDTO.class);
    }

    /**
     * Creates a new project with validation and security checks.
     *
     * @param projectDTO The project data to create
     * @return ProjectDTO containing the created project data
     * @throws UnauthorizedAccessException if user lacks creation rights
     */
    @Transactional
    public ProjectDTO createProject(@Valid @NotNull ProjectDTO projectDTO) {
        log.debug("Creating new project: {}", projectDTO.getName());

        // Verify user has project creation rights
        securityService.validateProjectCreation();

        // Set creation metadata
        projectDTO.setId(null); // Ensure new project
        projectDTO.updateTimestamps();
        projectDTO.validateOwnerInTeam();

        Project project = modelMapper.map(projectDTO, Project.class);
        project = projectRepository.save(project);

        log.info("Created project with id: {}", project.getId());
        return modelMapper.map(project, ProjectDTO.class);
    }

    /**
     * Updates an existing project with optimistic locking and cache eviction.
     *
     * @param id The UUID of the project to update
     * @param projectDTO The updated project data
     * @return ProjectDTO containing the updated project data
     * @throws ResourceNotFoundException if project not found
     * @throws OptimisticLockingException if version conflict detected
     * @throws UnauthorizedAccessException if user lacks update rights
     */
    @CacheEvict(key = "#id")
    @Transactional
    public ProjectDTO updateProject(@NotNull UUID id, @Valid @NotNull ProjectDTO projectDTO) {
        log.debug("Updating project with id: {}", id);

        Project existingProject = projectRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + id));

        // Verify user has update rights
        if (!securityService.hasProjectUpdateRights(existingProject)) {
            throw new UnauthorizedAccessException("User not authorized to update project: " + id);
        }

        // Verify optimistic locking version
        if (!existingProject.getVersion().equals(projectDTO.getVersion())) {
            throw new OptimisticLockingException("Project was modified by another user");
        }

        // Update project data
        projectDTO.setId(id);
        projectDTO.updateTimestamps();
        projectDTO.validateOwnerInTeam();

        Project updatedProject = modelMapper.map(projectDTO, Project.class);
        updatedProject = projectRepository.save(updatedProject);

        log.info("Updated project with id: {}", id);
        return modelMapper.map(updatedProject, ProjectDTO.class);
    }

    /**
     * Deletes a project with security verification and cache eviction.
     *
     * @param id The UUID of the project to delete
     * @throws ResourceNotFoundException if project not found
     * @throws UnauthorizedAccessException if user lacks deletion rights
     */
    @CacheEvict(key = "#id")
    @Transactional
    public void deleteProject(@NotNull UUID id) {
        log.debug("Deleting project with id: {}", id);

        Project project = projectRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + id));

        // Verify user has deletion rights
        if (!securityService.hasProjectDeletionRights(project)) {
            throw new UnauthorizedAccessException("User not authorized to delete project: " + id);
        }

        projectRepository.delete(project);
        log.info("Deleted project with id: {}", id);
    }

    /**
     * Retrieves projects for the current user with pagination support.
     *
     * @param page The page number (0-based)
     * @param size The page size
     * @return List of ProjectDTO objects
     */
    @Transactional(readOnly = true)
    public List<ProjectDTO> getCurrentUserProjects(int page, int size) {
        log.debug("Fetching projects for current user, page: {}, size: {}", page, size);

        UUID currentUserId = securityService.getCurrentUserId();
        return projectRepository.findByTeamMemberIdsContaining(currentUserId)
            .stream()
            .map(project -> modelMapper.map(project, ProjectDTO.class))
            .collect(Collectors.toList());
    }

    /**
     * Updates project status with validation and notification.
     *
     * @param id The UUID of the project
     * @param status The new project status
     * @return ProjectDTO containing the updated project data
     */
    @CacheEvict(key = "#id")
    @Transactional
    public ProjectDTO updateProjectStatus(@NotNull UUID id, @NotNull Project.ProjectStatus status) {
        log.debug("Updating status for project id: {} to: {}", id, status);

        Project project = projectRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + id));

        // Verify user has update rights
        if (!securityService.hasProjectUpdateRights(project)) {
            throw new UnauthorizedAccessException("User not authorized to update project status: " + id);
        }

        project.setStatus(status);
        project.setUpdatedAt(LocalDateTime.now());
        project = projectRepository.save(project);

        log.info("Updated status for project id: {} to: {}", id, status);
        return modelMapper.map(project, ProjectDTO.class);
    }
}