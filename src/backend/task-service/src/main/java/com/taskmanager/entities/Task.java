package com.taskmanager.entities;

import javax.persistence.*;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import javax.validation.constraints.Pattern;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.Index;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Enhanced JPA entity representing a task in the task management system.
 * Implements comprehensive validation, security features, and performance optimizations.
 * Supports core task management requirements including assignment, priority tracking,
 * and file attachments.
 *
 * @version 1.0
 * @since 2024-01
 */
@Entity
@Table(name = "tasks", indexes = {
    @Index(name = "idx_task_status", columnList = "status"),
    @Index(name = "idx_task_priority", columnList = "priority"),
    @Index(name = "idx_task_project", columnList = "project_id"),
    @Index(name = "idx_task_assignee", columnList = "assignee_id")
})
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Task {

    /**
     * Enumeration of possible task states with clear progression path.
     */
    public enum TaskStatus {
        TODO,
        IN_PROGRESS,
        IN_REVIEW,
        COMPLETED,
        BLOCKED
    }

    /**
     * Enumeration of task priorities for efficient task management.
     */
    public enum TaskPriority {
        LOW,
        MEDIUM,
        HIGH,
        URGENT
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false)
    private UUID id;

    @NotNull
    @Size(min = 1, max = 100)
    @Pattern(regexp = "^[\\w\\s\\-.,!?()]+$", message = "Title contains invalid characters")
    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Size(max = 1000)
    @Column(name = "description", length = 1000)
    private String description;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @NotNull
    @Column(name = "creator_id", nullable = false, updatable = false)
    private UUID creatorId;

    @Column(name = "assignee_id")
    private UUID assigneeId;

    @NotNull
    @Column(name = "status", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private TaskStatus status;

    @NotNull
    @Column(name = "priority", nullable = false, length = 20)
    @Enumerated(EnumType.STRING)
    private TaskPriority priority;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @ElementCollection
    @CollectionTable(
        name = "task_attachments",
        joinColumns = @JoinColumn(name = "task_id")
    )
    @BatchSize(size = 20)
    @Column(name = "attachment_url", length = 255)
    private List<String> attachmentUrls;

    @ElementCollection
    @CollectionTable(
        name = "task_comments",
        joinColumns = @JoinColumn(name = "task_id")
    )
    @BatchSize(size = 20)
    @Column(name = "comment", length = 1000)
    private List<String> comments;

    @Column(name = "completion_percentage")
    private Double completionPercentage;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "version")
    private Long version;

    @Column(name = "last_modified_by", length = 50)
    private String lastModifiedBy;

    /**
     * Enhanced lifecycle callback executed before entity persistence.
     * Performs validation and initialization of required fields.
     */
    @PrePersist
    protected void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;

        // Initialize default values
        if (this.status == null) {
            this.status = TaskStatus.TODO;
        }
        if (this.priority == null) {
            this.priority = TaskPriority.MEDIUM;
        }
        if (this.completionPercentage == null) {
            this.completionPercentage = 0.0;
        }
        if (this.attachmentUrls == null) {
            this.attachmentUrls = new ArrayList<>();
        }
        if (this.comments == null) {
            this.comments = new ArrayList<>();
        }

        validateEntity();
        sanitizeInputs();
    }

    /**
     * Enhanced lifecycle callback executed before entity update.
     * Performs validation and updates metadata.
     */
    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = LocalDateTime.now();
        
        // Set last modified by from security context
        this.lastModifiedBy = SecurityContextHolder.getContext()
            .getAuthentication()
            .getName();

        validateEntity();
        sanitizeInputs();
        validateStatusTransition();
    }

    /**
     * Validates the entity's state according to business rules.
     * @throws IllegalStateException if validation fails
     */
    private void validateEntity() {
        if (title != null && (title.trim().isEmpty() || title.length() > 100)) {
            throw new IllegalStateException("Task title must be between 1 and 100 characters");
        }

        if (description != null && description.length() > 1000) {
            throw new IllegalStateException("Task description cannot exceed 1000 characters");
        }

        if (attachmentUrls != null && attachmentUrls.size() > 20) {
            throw new IllegalStateException("Task cannot have more than 20 attachments");
        }

        if (comments != null && comments.size() > 100) {
            throw new IllegalStateException("Task cannot have more than 100 comments");
        }

        if (completionPercentage != null && 
            (completionPercentage < 0 || completionPercentage > 100)) {
            throw new IllegalStateException("Completion percentage must be between 0 and 100");
        }
    }

    /**
     * Sanitizes string inputs to prevent XSS and other injection attacks.
     */
    private void sanitizeInputs() {
        if (title != null) {
            title = sanitizeString(title);
        }
        if (description != null) {
            description = sanitizeString(description);
        }
        if (comments != null) {
            comments.replaceAll(this::sanitizeString);
        }
        if (attachmentUrls != null) {
            attachmentUrls.replaceAll(this::sanitizeString);
        }
    }

    /**
     * Validates task status transitions according to business rules.
     * @throws IllegalStateException if the transition is not allowed
     */
    private void validateStatusTransition() {
        if (status == TaskStatus.COMPLETED && completionPercentage < 100) {
            throw new IllegalStateException("Cannot mark task as completed when completion percentage is less than 100");
        }

        if (status == TaskStatus.IN_REVIEW && assigneeId == null) {
            throw new IllegalStateException("Cannot move task to review without an assignee");
        }
    }

    /**
     * Sanitizes a string input to prevent security vulnerabilities.
     * @param input the string to sanitize
     * @return the sanitized string
     */
    private String sanitizeString(String input) {
        if (input == null) {
            return null;
        }
        // Remove potentially dangerous characters and HTML tags
        return input.replaceAll("<[^>]*>", "")
                   .replaceAll("\"", "&quot;")
                   .replaceAll("'", "&apos;")
                   .replaceAll("<", "&lt;")
                   .replaceAll(">", "&gt;");
    }
}