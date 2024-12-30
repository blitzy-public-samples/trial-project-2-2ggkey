package com.taskmanager.controllers;

import com.taskmanager.services.TaskService;
import com.taskmanager.entities.Task;
import com.taskmanager.dto.TaskDTO;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.util.UUID;

/**
 * REST controller for managing tasks with enhanced security, caching, and rate limiting.
 * Provides endpoints for task CRUD operations and advanced task management features.
 *
 * @version 1.0
 * @since 2024-01
 */
@RestController
@RequestMapping("/api/v1/tasks")
@Tag(name = "Task Management", description = "APIs for task operations")
@Validated
@Slf4j
public class TaskController {

    private final TaskService taskService;
    private final CacheManager cacheManager;

    public TaskController(TaskService taskService, CacheManager cacheManager) {
        this.taskService = taskService;
        this.cacheManager = cacheManager;
    }

    /**
     * Creates a new task with validation and security checks.
     *
     * @param taskDTO Task creation data
     * @return Created task with 201 status
     */
    @PostMapping
    @PreAuthorize("hasRole('USER')")
    @RateLimiter(name = "createTask")
    @Operation(summary = "Create new task", description = "Creates a new task with validation")
    @ApiResponse(responseCode = "201", description = "Task created successfully")
    public ResponseEntity<TaskDTO> createTask(@Valid @RequestBody TaskDTO taskDTO) {
        log.debug("REST request to create Task : {}", taskDTO);
        Task task = taskService.createTask(taskDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(convertToDTO(task));
    }

    /**
     * Updates an existing task with validation and security checks.
     *
     * @param id Task identifier
     * @param taskDTO Updated task data
     * @return Updated task with 200 status
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('USER')")
    @RateLimiter(name = "updateTask")
    @Operation(summary = "Update existing task", description = "Updates task details with validation")
    public ResponseEntity<TaskDTO> updateTask(
            @PathVariable @NotNull UUID id,
            @Valid @RequestBody TaskDTO taskDTO) {
        log.debug("REST request to update Task : {}", id);
        taskDTO.setId(id);
        Task task = taskService.updateTask(taskDTO);
        return ResponseEntity.ok(convertToDTO(task));
    }

    /**
     * Retrieves a task by ID with caching.
     *
     * @param id Task identifier
     * @return Task if found, 404 otherwise
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('USER')")
    @Operation(summary = "Get task by ID", description = "Retrieves task details")
    public ResponseEntity<TaskDTO> getTask(@PathVariable @NotNull UUID id) {
        log.debug("REST request to get Task : {}", id);
        return taskService.getTaskById(id)
                .map(this::convertToDTO)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Retrieves paginated tasks for a project with caching.
     *
     * @param projectId Project identifier
     * @param pageable Pagination parameters
     * @return Page of tasks
     */
    @GetMapping("/project/{projectId}")
    @PreAuthorize("hasRole('USER')")
    @Operation(summary = "Get project tasks", description = "Retrieves paginated tasks for a project")
    public ResponseEntity<Page<TaskDTO>> getProjectTasks(
            @PathVariable @NotNull UUID projectId,
            @PageableDefault(size = 20) Pageable pageable) {
        log.debug("REST request to get Tasks for Project : {}", projectId);
        Page<Task> tasks = taskService.getTasksByProject(projectId, pageable);
        return ResponseEntity.ok(tasks.map(this::convertToDTO));
    }

    /**
     * Retrieves paginated tasks for an assignee with caching.
     *
     * @param assigneeId Assignee identifier
     * @param pageable Pagination parameters
     * @return Page of tasks
     */
    @GetMapping("/assignee/{assigneeId}")
    @PreAuthorize("hasRole('USER')")
    @Operation(summary = "Get assignee tasks", description = "Retrieves paginated tasks for an assignee")
    public ResponseEntity<Page<TaskDTO>> getAssigneeTasks(
            @PathVariable @NotNull UUID assigneeId,
            @PageableDefault(size = 20) Pageable pageable) {
        log.debug("REST request to get Tasks for Assignee : {}", assigneeId);
        Page<Task> tasks = taskService.getTasksByAssignee(assigneeId, pageable);
        return ResponseEntity.ok(tasks.map(this::convertToDTO));
    }

    /**
     * Updates task status with validation.
     *
     * @param id Task identifier
     * @param status New status
     * @return Updated task
     */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('USER')")
    @RateLimiter(name = "updateTaskStatus")
    @Operation(summary = "Update task status", description = "Updates task status with validation")
    public ResponseEntity<TaskDTO> updateTaskStatus(
            @PathVariable @NotNull UUID id,
            @RequestParam @NotNull Task.TaskStatus status) {
        log.debug("REST request to update Task status : {} to {}", id, status);
        Task task = taskService.updateTaskStatus(id, status);
        return ResponseEntity.ok(convertToDTO(task));
    }

    /**
     * Deletes a task with security checks.
     *
     * @param id Task identifier
     * @return No content response
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('USER')")
    @RateLimiter(name = "deleteTask")
    @Operation(summary = "Delete task", description = "Deletes a task permanently")
    public ResponseEntity<Void> deleteTask(@PathVariable @NotNull UUID id) {
        log.debug("REST request to delete Task : {}", id);
        taskService.deleteTask(id);
        evictTaskCaches();
        return ResponseEntity.noContent().build();
    }

    /**
     * Converts Task entity to DTO.
     *
     * @param task Task entity
     * @return Task DTO
     */
    private TaskDTO convertToDTO(Task task) {
        return TaskDTO.builder()
                .id(task.getId())
                .title(task.getTitle())
                .description(task.getDescription())
                .projectId(task.getProject().getId())
                .creatorId(task.getCreatorId())
                .assigneeId(task.getAssigneeId())
                .status(task.getStatus())
                .priority(task.getPriority())
                .dueDate(task.getDueDate())
                .attachmentUrls(task.getAttachmentUrls())
                .comments(task.getComments())
                .completionPercentage(task.getCompletionPercentage())
                .createdAt(task.getCreatedAt())
                .updatedAt(task.getUpdatedAt())
                .build();
    }

    /**
     * Evicts all task-related caches.
     */
    private void evictTaskCaches() {
        cacheManager.getCache("projectTasks").clear();
        cacheManager.getCache("assigneeTasks").clear();
        cacheManager.getCache("taskCounts").clear();
    }
}