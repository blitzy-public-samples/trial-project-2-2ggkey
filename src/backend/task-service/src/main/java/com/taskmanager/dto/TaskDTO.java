package com.taskmanager.dto;

import com.fasterxml.jackson.annotation.JsonView; // v2.13.0
import com.taskmanager.entities.Task.TaskStatus;
import com.taskmanager.entities.Task.TaskPriority;
import lombok.AllArgsConstructor; // v1.18.22
import lombok.Builder; // v1.18.22
import lombok.Getter; // v1.18.22
import lombok.NoArgsConstructor; // v1.18.22
import lombok.Setter; // v1.18.22
import org.hibernate.validator.constraints.SafeHtml; // v7.0.1.Final
import javax.validation.constraints.Future; // v2.0.1.Final
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull; // v2.0.1.Final
import javax.validation.constraints.Pattern; // v2.0.1.Final
import javax.validation.constraints.Size; // v2.0.1.Final

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Enhanced Data Transfer Object for task-related operations with comprehensive validation.
 * Implements security measures and performance optimizations for the Task Management System.
 *
 * @version 1.0
 * @since 2024-01
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonView(Views.Public.class)
public class TaskDTO {

    /**
     * Validation groups for different operations
     */
    public interface Create {}
    public interface Update {}

    /**
     * Task identifier, required for updates
     */
    @NotNull(groups = Update.class)
    private UUID id;

    /**
     * Task title with strict validation and sanitization
     */
    @NotNull
    @Size(min = 1, max = 100)
    @SafeHtml
    @Pattern(regexp = "^[\\w\\s-]+$", message = "Title must contain only letters, numbers, spaces and hyphens")
    private String title;

    /**
     * Optional task description with sanitization
     */
    @Size(max = 1000)
    @SafeHtml
    private String description;

    /**
     * Project identifier to which this task belongs
     */
    @NotNull
    private UUID projectId;

    /**
     * User identifier who created the task
     */
    @NotNull
    private UUID creatorId;

    /**
     * Optional assignee identifier
     */
    private UUID assigneeId;

    /**
     * Current task status
     */
    @NotNull
    private TaskStatus status;

    /**
     * Task priority level
     */
    @NotNull
    private TaskPriority priority;

    /**
     * Task due date must be in the future
     */
    @Future
    private LocalDateTime dueDate;

    /**
     * Task creation timestamp
     */
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /**
     * Task last update timestamp
     */
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    /**
     * List of attachment URLs with size limit and sanitization
     */
    @Builder.Default
    @Size(max = 10)
    private List<@SafeHtml String> attachmentUrls = new ArrayList<>();

    /**
     * List of task comments with size limit and sanitization
     */
    @Builder.Default
    @Size(max = 100)
    private List<@SafeHtml String> comments = new ArrayList<>();

    /**
     * Task completion percentage
     */
    @Builder.Default
    @Min(0)
    @Max(100)
    private Double completionPercentage = 0.0;

    /**
     * Views for JSON serialization control
     */
    public static class Views {
        public interface Public {}
        public interface Internal extends Public {}
        public interface Admin extends Internal {}
    }

    /**
     * Validates the status transition based on completion percentage
     * @throws IllegalStateException if the transition is invalid
     */
    public void validateStatusTransition() {
        if (status == TaskStatus.COMPLETED && (completionPercentage == null || completionPercentage < 100)) {
            throw new IllegalStateException("Cannot mark task as completed when completion percentage is less than 100%");
        }

        if (status == TaskStatus.IN_REVIEW && assigneeId == null) {
            throw new IllegalStateException("Cannot move task to review without an assignee");
        }
    }

    /**
     * Builder customization to ensure default values are set
     */
    public static class TaskDTOBuilder {
        private List<String> attachmentUrls = new ArrayList<>();
        private List<String> comments = new ArrayList<>();
        private Double completionPercentage = 0.0;
        private LocalDateTime createdAt = LocalDateTime.now();
        private LocalDateTime updatedAt = LocalDateTime.now();
    }
}