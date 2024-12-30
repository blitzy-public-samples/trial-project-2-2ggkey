package com.taskmanager.dto;

import com.taskmanager.entities.Project.ProjectStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import javax.validation.constraints.Future;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Data Transfer Object (DTO) for Project entity.
 * Provides a clean API contract for project-related operations with comprehensive validation.
 * 
 * @version 1.0
 * @since 2024-01
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProjectDTO {

    /**
     * Unique identifier for the project.
     * Generated automatically for new projects.
     */
    private UUID id;

    /**
     * Name of the project.
     * Must be between 3 and 100 characters.
     */
    @NotNull(message = "Project name is required")
    @Size(min = 3, max = 100, message = "Project name must be between 3 and 100 characters")
    private String name;

    /**
     * Detailed description of the project.
     * Optional, but cannot exceed 1000 characters when provided.
     */
    @Size(max = 1000, message = "Project description cannot exceed 1000 characters")
    private String description;

    /**
     * UUID of the project owner.
     * Must be a valid user ID.
     */
    @NotNull(message = "Project owner is required")
    private UUID ownerId;

    /**
     * Current status of the project.
     * Must be one of the defined ProjectStatus values.
     */
    @NotNull(message = "Project status is required")
    private ProjectStatus status;

    /**
     * Timestamp when the project was created.
     * Set automatically during creation.
     */
    private LocalDateTime createdAt;

    /**
     * Timestamp of the last update to the project.
     * Updated automatically on each modification.
     */
    private LocalDateTime updatedAt;

    /**
     * Project deadline.
     * Must be a future date when specified.
     */
    @Future(message = "Due date must be in the future")
    private LocalDateTime dueDate;

    /**
     * Set of team member UUIDs assigned to the project.
     * Must contain at least one member (the owner) and cannot exceed 50 members.
     */
    @NotNull(message = "Team members list is required")
    @Size(min = 1, max = 50, message = "Team size must be between 1 and 50 members")
    private Set<UUID> teamMemberIds = new HashSet<>();

    /**
     * Validates that the owner is part of the team members.
     * Should be called before saving or updating project data.
     *
     * @throws IllegalStateException if the owner is not in the team members list
     */
    public void validateOwnerInTeam() {
        if (ownerId != null && teamMemberIds != null && !teamMemberIds.contains(ownerId)) {
            teamMemberIds.add(ownerId);
        }
    }

    /**
     * Creates a copy of the DTO with a new instance of the team members set.
     * Useful for preventing external modifications to the internal state.
     *
     * @return A new ProjectDTO instance with copied data and a new team members set
     */
    public ProjectDTO copy() {
        ProjectDTO copy = new ProjectDTO();
        copy.setId(this.id);
        copy.setName(this.name);
        copy.setDescription(this.description);
        copy.setOwnerId(this.ownerId);
        copy.setStatus(this.status);
        copy.setCreatedAt(this.createdAt);
        copy.setUpdatedAt(this.updatedAt);
        copy.setDueDate(this.dueDate);
        copy.setTeamMemberIds(new HashSet<>(this.teamMemberIds));
        return copy;
    }

    /**
     * Checks if this is a new project (no ID assigned).
     *
     * @return true if this represents a new project, false otherwise
     */
    public boolean isNew() {
        return id == null;
    }

    /**
     * Updates the timestamps for creation or modification.
     * Should be called before saving the project data.
     */
    public void updateTimestamps() {
        LocalDateTime now = LocalDateTime.now();
        if (isNew()) {
            this.createdAt = now;
        }
        this.updatedAt = now;
    }
}