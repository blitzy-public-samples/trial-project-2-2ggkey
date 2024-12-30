package com.taskmanager.controllers;

import com.taskmanager.dto.ProjectDTO;
import com.taskmanager.services.ProjectService;
import com.taskmanager.entities.Project.ProjectStatus;

import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import java.util.List;
import java.util.UUID;

import lombok.extern.slf4j.Slf4j;

/**
 * REST controller for project management operations.
 * Implements enterprise-grade security, caching, and rate limiting.
 *
 * @version 1.0
 * @since 2024-01
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/projects")
@SecurityRequirement(name = "bearer-jwt")
@Tag(name = "Projects", description = "Project management endpoints")
@Validated
public class ProjectController {

    private final ProjectService projectService;

    @Autowired
    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    /**
     * Creates a new project with validation and security checks.
     *
     * @param projectDTO Project data for creation
     * @return Created project with generated ID
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create new project", description = "Creates a new project with the provided details")
    @ApiResponse(responseCode = "201", description = "Project created successfully")
    @RateLimiter(name = "project-api")
    @PreAuthorize("hasRole('PROJECT_CREATE')")
    public ResponseEntity<ProjectDTO> createProject(
            @Valid @RequestBody ProjectDTO projectDTO) {
        log.debug("REST request to create Project: {}", projectDTO.getName());
        ProjectDTO result = projectService.createProject(projectDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    /**
     * Retrieves a project by ID with caching support.
     *
     * @param id Project UUID
     * @return Project details if found
     */
    @GetMapping("/{id}")
    @Operation(summary = "Get project by ID", description = "Retrieves project details by UUID")
    @ApiResponse(responseCode = "200", description = "Project found")
    @ApiResponse(responseCode = "404", description = "Project not found")
    @Cacheable(cacheNames = "projects", key = "#id")
    @PreAuthorize("hasRole('PROJECT_READ')")
    public ResponseEntity<ProjectDTO> getProject(
            @Parameter(description = "Project UUID", required = true)
            @PathVariable UUID id) {
        log.debug("REST request to get Project: {}", id);
        ProjectDTO project = projectService.getProjectById(id);
        return ResponseEntity.ok(project);
    }

    /**
     * Updates an existing project with optimistic locking.
     *
     * @param id Project UUID
     * @param projectDTO Updated project data
     * @return Updated project details
     */
    @PutMapping("/{id}")
    @Operation(summary = "Update project", description = "Updates existing project details")
    @ApiResponse(responseCode = "200", description = "Project updated successfully")
    @RateLimiter(name = "project-api")
    @PreAuthorize("hasRole('PROJECT_UPDATE')")
    public ResponseEntity<ProjectDTO> updateProject(
            @Parameter(description = "Project UUID", required = true)
            @PathVariable UUID id,
            @Valid @RequestBody ProjectDTO projectDTO) {
        log.debug("REST request to update Project: {}", id);
        ProjectDTO result = projectService.updateProject(id, projectDTO);
        return ResponseEntity.ok(result);
    }

    /**
     * Deletes a project by ID with security verification.
     *
     * @param id Project UUID
     * @return No content on successful deletion
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete project", description = "Deletes project by UUID")
    @ApiResponse(responseCode = "204", description = "Project deleted successfully")
    @RateLimiter(name = "project-api")
    @PreAuthorize("hasRole('PROJECT_DELETE')")
    public ResponseEntity<Void> deleteProject(
            @Parameter(description = "Project UUID", required = true)
            @PathVariable UUID id) {
        log.debug("REST request to delete Project: {}", id);
        projectService.deleteProject(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Retrieves projects for current user with pagination.
     *
     * @param page Page number
     * @param size Page size
     * @return List of projects
     */
    @GetMapping
    @Operation(summary = "Get user projects", description = "Retrieves paginated list of user's projects")
    @ApiResponse(responseCode = "200", description = "Projects retrieved successfully")
    @PreAuthorize("hasRole('PROJECT_READ')")
    public ResponseEntity<List<ProjectDTO>> getUserProjects(
            @Parameter(description = "Page number (0-based)")
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @Parameter(description = "Page size")
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        log.debug("REST request to get user Projects, page: {}, size: {}", page, size);
        List<ProjectDTO> projects = projectService.getCurrentUserProjects(page, size);
        return ResponseEntity.ok(projects);
    }

    /**
     * Updates project status with validation.
     *
     * @param id Project UUID
     * @param status New project status
     * @return Updated project details
     */
    @PatchMapping("/{id}/status")
    @Operation(summary = "Update project status", description = "Updates project status")
    @ApiResponse(responseCode = "200", description = "Status updated successfully")
    @RateLimiter(name = "project-api")
    @PreAuthorize("hasRole('PROJECT_UPDATE')")
    public ResponseEntity<ProjectDTO> updateProjectStatus(
            @Parameter(description = "Project UUID", required = true)
            @PathVariable UUID id,
            @Parameter(description = "New project status", required = true)
            @RequestParam ProjectStatus status) {
        log.debug("REST request to update Project status: {} to {}", id, status);
        ProjectDTO result = projectService.updateProjectStatus(id, status);
        return ResponseEntity.ok(result);
    }
}