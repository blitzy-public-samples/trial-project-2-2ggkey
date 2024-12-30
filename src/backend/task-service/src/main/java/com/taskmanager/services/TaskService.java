package com.taskmanager.services;

import com.taskmanager.entities.Task;
import com.taskmanager.entities.Task.TaskStatus;
import com.taskmanager.entities.Task.TaskPriority;
import com.taskmanager.repositories.TaskRepository;
import com.taskmanager.dto.TaskDTO;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.CacheManager;
import org.springframework.retry.annotation.Retry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import io.micrometer.core.annotation.Timed;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;

import javax.validation.Valid;
import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.Optional;

/**
 * Service class implementing core business logic for task management operations.
 * Provides comprehensive task management functionality with caching, transaction management,
 * and performance optimizations.
 *
 * @version 1.0
 * @since 2024-01
 */
@Service
@Transactional
@Slf4j
public class TaskService {

    private final TaskRepository taskRepository;
    private final CacheManager cacheManager;
    private final MeterRegistry meterRegistry;

    /**
     * Constructs TaskService with required dependencies.
     *
     * @param taskRepository Repository for task data access
     * @param cacheManager Cache manager for task caching
     * @param meterRegistry Metrics registry for monitoring
     */
    public TaskService(
            TaskRepository taskRepository,
            CacheManager cacheManager,
            MeterRegistry meterRegistry) {
        this.taskRepository = taskRepository;
        this.cacheManager = cacheManager;
        this.meterRegistry = meterRegistry;
    }

    /**
     * Creates a new task with comprehensive validation and metrics tracking.
     *
     * @param taskDTO Task data transfer object
     * @return Created task entity
     * @throws IllegalArgumentException if validation fails
     */
    @Timed(value = "task.creation.time", description = "Time taken to create task")
    @Transactional(timeout = 5)
    @CacheEvict(value = {"projectTasks", "assigneeTasks"}, allEntries = true)
    public Task createTask(@Valid @NotNull TaskDTO taskDTO) {
        log.debug("Creating new task with title: {}", taskDTO.getTitle());
        
        // Validate task data
        taskDTO.validateStatusTransition();
        
        // Create task entity
        Task task = new Task();
        mapDTOToTask(taskDTO, task);
        
        // Record metric for task creation
        meterRegistry.counter("task.created", 
            "project", task.getProject().getId().toString(),
            "priority", task.getPriority().toString()
        ).increment();
        
        // Persist task with retry mechanism
        return persistTaskWithRetry(task);
    }

    /**
     * Updates an existing task with validation and cache management.
     *
     * @param taskDTO Updated task data
     * @return Updated task entity
     * @throws IllegalArgumentException if validation fails
     * @throws IllegalStateException if task not found
     */
    @Timed(value = "task.update.time", description = "Time taken to update task")
    @Transactional(timeout = 5)
    @CacheEvict(value = {"projectTasks", "assigneeTasks", "taskCounts"}, allEntries = true)
    public Task updateTask(@Valid @NotNull TaskDTO taskDTO) {
        log.debug("Updating task with ID: {}", taskDTO.getId());
        
        Task existingTask = taskRepository.findById(taskDTO.getId())
            .orElseThrow(() -> new IllegalStateException("Task not found"));
        
        // Validate status transition
        taskDTO.validateStatusTransition();
        
        // Update task
        mapDTOToTask(taskDTO, existingTask);
        
        // Record metric for task update
        meterRegistry.counter("task.updated",
            "status", existingTask.getStatus().toString()
        ).increment();
        
        return persistTaskWithRetry(existingTask);
    }

    /**
     * Retrieves tasks for a project with caching and pagination.
     *
     * @param projectId Project identifier
     * @param pageable Pagination parameters
     * @return Page of tasks
     */
    @Timed(value = "task.retrieval.time", description = "Time taken to retrieve tasks")
    @Transactional(readOnly = true)
    @Cacheable(value = "projectTasks", key = "#projectId + '_' + #pageable")
    public Page<Task> getProjectTasks(
            @NotNull UUID projectId,
            @NotNull Pageable pageable) {
        log.debug("Retrieving tasks for project: {}", projectId);
        return taskRepository.findByProjectId(projectId, pageable);
    }

    /**
     * Retrieves tasks assigned to a user with caching and pagination.
     *
     * @param assigneeId Assignee identifier
     * @param pageable Pagination parameters
     * @return Page of tasks
     */
    @Timed(value = "task.assignee.retrieval.time")
    @Transactional(readOnly = true)
    @Cacheable(value = "assigneeTasks", key = "#assigneeId + '_' + #pageable")
    public Page<Task> getAssigneeTasks(
            @NotNull UUID assigneeId,
            @NotNull Pageable pageable) {
        log.debug("Retrieving tasks for assignee: {}", assigneeId);
        return taskRepository.findByAssigneeId(assigneeId, pageable);
    }

    /**
     * Deletes a task with cache eviction.
     *
     * @param taskId Task identifier
     * @throws IllegalStateException if task not found
     */
    @Timed(value = "task.deletion.time")
    @Transactional(timeout = 5)
    @CacheEvict(value = {"projectTasks", "assigneeTasks", "taskCounts"}, allEntries = true)
    public void deleteTask(@NotNull UUID taskId) {
        log.debug("Deleting task: {}", taskId);
        
        Task task = taskRepository.findById(taskId)
            .orElseThrow(() -> new IllegalStateException("Task not found"));
        
        taskRepository.delete(task);
        
        meterRegistry.counter("task.deleted").increment();
    }

    /**
     * Maps DTO data to task entity.
     *
     * @param dto Source DTO
     * @param task Target task entity
     */
    private void mapDTOToTask(TaskDTO dto, Task task) {
        task.setTitle(dto.getTitle());
        task.setDescription(dto.getDescription());
        task.setStatus(dto.getStatus());
        task.setPriority(dto.getPriority());
        task.setAssigneeId(dto.getAssigneeId());
        task.setDueDate(dto.getDueDate());
        task.setCompletionPercentage(dto.getCompletionPercentage());
        task.setAttachmentUrls(dto.getAttachmentUrls());
        task.setComments(dto.getComments());
    }

    /**
     * Persists task with retry mechanism.
     *
     * @param task Task to persist
     * @return Persisted task
     */
    @Retry(maxAttempts = 3, backoff = @Backoff(delay = 1000))
    private Task persistTaskWithRetry(Task task) {
        try {
            return taskRepository.save(task);
        } catch (Exception e) {
            log.error("Error persisting task: {}", e.getMessage());
            throw new RuntimeException("Failed to persist task", e);
        }
    }
}