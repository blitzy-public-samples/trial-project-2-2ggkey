package com.taskmanager.entities;

import javax.persistence.*;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.hibernate.annotations.Index;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.Cache;
import org.hibernate.annotations.CacheConcurrencyStrategy;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashSet;

/**
 * Enhanced JPA entity representing a project in the task management system.
 * Implements comprehensive data modeling with optimized persistence configurations.
 * 
 * @version 1.0
 * @since 2024-01
 */
@Entity
@Table(name = "projects", indexes = {
    @Index(name = "idx_project_owner", columnList = "owner_id"),
    @Index(name = "idx_project_status", columnList = "status")
})
@Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Project {

    /**
     * Enumeration of possible project states with strict transition rules.
     */
    public enum ProjectStatus {
        PLANNING,
        IN_PROGRESS,
        ON_HOLD,
        COMPLETED,
        CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false)
    private UUID id;

    @NotNull
    @Size(min = 1, max = 100)
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Size(max = 1000)
    @Column(name = "description", length = 1000)
    private String description;

    @NotNull
    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @NotNull
    @Column(name = "status", nullable = false, length = 20)
    private ProjectStatus status;

    @ElementCollection
    @CollectionTable(
        name = "project_team_members",
        joinColumns = @JoinColumn(name = "project_id")
    )
    @Column(name = "team_member_id")
    @BatchSize(size = 20)
    @Size(max = 100)
    private Set<UUID> teamMemberIds;

    @ElementCollection
    @CollectionTable(
        name = "project_tasks",
        joinColumns = @JoinColumn(name = "project_id")
    )
    @Column(name = "task_id")
    @BatchSize(size = 50)
    @Size(max = 1000)
    private Set<UUID> taskIds;

    @Column(name = "due_date")
    private LocalDateTime dueDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "version")
    private Long version;

    /**
     * Enhanced lifecycle callback executed before entity persistence.
     * Performs validation and initialization of required fields.
     */
    @PrePersist
    protected void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;

        // Initialize default status if not set
        if (this.status == null) {
            this.status = ProjectStatus.PLANNING;
        }

        // Initialize collections if null
        if (this.teamMemberIds == null) {
            this.teamMemberIds = new ConcurrentHashSet<>();
        }
        if (this.taskIds == null) {
            this.taskIds = new ConcurrentHashSet<>();
        }

        // Ensure owner is part of team members
        this.teamMemberIds.add(this.ownerId);

        validateEntity();
    }

    /**
     * Enhanced lifecycle callback executed before entity update.
     * Performs validation and updates timestamp.
     */
    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = LocalDateTime.now();

        // Ensure owner remains in team members
        if (!this.teamMemberIds.contains(this.ownerId)) {
            this.teamMemberIds.add(this.ownerId);
        }

        validateEntity();
        validateStatusTransition();
    }

    /**
     * Validates the entity's state according to business rules.
     * @throws IllegalStateException if validation fails
     */
    private void validateEntity() {
        if (name != null && (name.trim().isEmpty() || name.length() > 100)) {
            throw new IllegalStateException("Project name must be between 1 and 100 characters");
        }

        if (description != null && description.length() > 1000) {
            throw new IllegalStateException("Project description cannot exceed 1000 characters");
        }

        if (teamMemberIds != null && teamMemberIds.size() > 100) {
            throw new IllegalStateException("Project cannot have more than 100 team members");
        }

        if (taskIds != null && taskIds.size() > 1000) {
            throw new IllegalStateException("Project cannot have more than 1000 tasks");
        }
    }

    /**
     * Validates project status transitions according to business rules.
     * @throws IllegalStateException if the transition is not allowed
     */
    private void validateStatusTransition() {
        // Add specific status transition rules here if needed
        // Example: Cannot move back to PLANNING from COMPLETED
        if (status == ProjectStatus.PLANNING && 
            (taskIds != null && !taskIds.isEmpty())) {
            throw new IllegalStateException("Cannot set status to PLANNING when tasks exist");
        }
    }
}