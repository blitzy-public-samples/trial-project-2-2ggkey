package com.taskmanager.repositories;

import com.taskmanager.entities.Task;
import com.taskmanager.entities.Task.TaskStatus;
import com.taskmanager.entities.Task.TaskPriority;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.QueryHint;
import static org.hibernate.annotations.QueryHints.HINT_FETCH_SIZE;
import static org.hibernate.annotations.QueryHints.HINT_COMMENT;
import static org.hibernate.jpa.QueryHints.HINT_CACHEABLE;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.List;

/**
 * Repository interface for Task entity providing optimized database operations.
 * Implements caching, pagination, and performance optimizations for task management.
 *
 * @version 1.0
 * @since 2024-01
 */
@Repository
@Transactional(readOnly = true)
public interface TaskRepository extends JpaRepository<Task, UUID> {

    /**
     * Retrieves paginated tasks for a specific project with optimized fetch size.
     * Uses caching to improve performance for frequently accessed projects.
     *
     * @param projectId Project identifier
     * @param pageable Pagination parameters
     * @return Page of tasks belonging to the project
     */
    @QueryHints(value = {
        @QueryHint(name = HINT_FETCH_SIZE, value = "50"),
        @QueryHint(name = HINT_CACHEABLE, value = "true")
    })
    @Cacheable(value = "projectTasks", key = "#projectId")
    Page<Task> findByProjectId(UUID projectId, Pageable pageable);

    /**
     * Retrieves paginated tasks assigned to a specific user with caching.
     * Optimized for frequent access patterns in task management workflows.
     *
     * @param assigneeId Assignee identifier
     * @param pageable Pagination parameters
     * @return Page of tasks assigned to the user
     */
    @QueryHints(value = @QueryHint(name = HINT_CACHEABLE, value = "true"))
    @Cacheable(value = "assigneeTasks", key = "#assigneeId")
    Page<Task> findByAssigneeId(UUID assigneeId, Pageable pageable);

    /**
     * Retrieves paginated tasks with a specific status using status index.
     *
     * @param status Task status
     * @param pageable Pagination parameters
     * @return Page of tasks with the given status
     */
    @QueryHints(value = @QueryHint(name = HINT_COMMENT, value = "Use idx_task_status"))
    Page<Task> findByStatus(TaskStatus status, Pageable pageable);

    /**
     * Retrieves paginated tasks for a project with specific status using composite index.
     *
     * @param projectId Project identifier
     * @param status Task status
     * @param pageable Pagination parameters
     * @return Page of tasks for the project with given status
     */
    @Query("SELECT t FROM Task t WHERE t.project.id = :projectId AND t.status = :status")
    @QueryHints(value = {
        @QueryHint(name = HINT_COMMENT, value = "Use idx_task_project"),
        @QueryHint(name = HINT_CACHEABLE, value = "true")
    })
    Page<Task> findByProjectIdAndStatus(UUID projectId, TaskStatus status, Pageable pageable);

    /**
     * Retrieves tasks due before a date with specific status using date index.
     * Important for deadline management and overdue task tracking.
     *
     * @param dueDate Due date threshold
     * @param status Task status
     * @param pageable Pagination parameters
     * @return Page of tasks due before date with status
     */
    @QueryHints(value = @QueryHint(name = HINT_COMMENT, value = "Use idx_task_due_date"))
    Page<Task> findByDueDateBeforeAndStatus(LocalDateTime dueDate, TaskStatus status, Pageable pageable);

    /**
     * Counts tasks in a project with specific status using optimized count query.
     * Cached to improve dashboard and project summary performance.
     *
     * @param projectId Project identifier
     * @param status Task status
     * @return Number of tasks matching criteria
     */
    @Cacheable(value = "taskCounts", key = "#projectId + '_' + #status")
    Long countByProjectIdAndStatus(UUID projectId, TaskStatus status);

    /**
     * Retrieves tasks assigned to user with specific priority ordered by due date.
     * Optimized for task prioritization and personal task list views.
     *
     * @param assigneeId Assignee identifier
     * @param priority Task priority
     * @param pageable Pagination parameters
     * @return Page of prioritized tasks ordered by due date
     */
    @QueryHints(value = {
        @QueryHint(name = HINT_COMMENT, value = "Use idx_task_assignee"),
        @QueryHint(name = HINT_CACHEABLE, value = "true")
    })
    Page<Task> findByAssigneeIdAndPriorityOrderByDueDateAsc(
        UUID assigneeId, 
        TaskPriority priority, 
        Pageable pageable
    );

    /**
     * Retrieves high priority tasks that are overdue.
     * Critical for task management alerts and notifications.
     *
     * @param currentTime Current timestamp
     * @param pageable Pagination parameters
     * @return Page of overdue high priority tasks
     */
    @Query("SELECT t FROM Task t WHERE t.dueDate < :currentTime " +
           "AND t.status != 'COMPLETED' AND t.priority = 'HIGH'")
    @QueryHints(value = @QueryHint(name = HINT_COMMENT, value = "Use idx_task_priority"))
    Page<Task> findOverdueHighPriorityTasks(LocalDateTime currentTime, Pageable pageable);

    /**
     * Retrieves recently updated tasks for a project.
     * Used for activity feeds and project monitoring.
     *
     * @param projectId Project identifier
     * @param limit Maximum number of tasks to retrieve
     * @return List of recently updated tasks
     */
    @Query(value = "SELECT t FROM Task t WHERE t.project.id = :projectId " +
           "ORDER BY t.updatedAt DESC")
    @QueryHints(value = @QueryHint(name = HINT_FETCH_SIZE, value = "20"))
    List<Task> findRecentlyUpdatedTasks(UUID projectId, Pageable pageable);
}