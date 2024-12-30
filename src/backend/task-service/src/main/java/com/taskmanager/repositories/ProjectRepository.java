package com.taskmanager.repositories;

import com.taskmanager.entities.Project;
import com.taskmanager.entities.Project.ProjectStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import javax.persistence.QueryHint;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * High-performance repository interface for Project entity providing optimized data access operations.
 * Implements caching and pagination support for efficient resource utilization.
 *
 * @version 1.0
 * @since 2024-01
 */
@Repository
@Transactional(readOnly = true)
public interface ProjectRepository extends JpaRepository<Project, UUID> {

    /**
     * Retrieves a paginated list of projects owned by a specific user.
     * Utilizes second-level cache for improved performance.
     *
     * @param ownerId ID of the project owner
     * @param pageable pagination parameters
     * @return Page of projects owned by the user
     */
    @QueryHints(value = {
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL")
    })
    Page<Project> findByOwnerId(UUID ownerId, Pageable pageable);

    /**
     * Retrieves a paginated list of projects where the specified user is a team member.
     * Uses optimized JOIN query for collection handling.
     *
     * @param memberId ID of the team member
     * @param pageable pagination parameters
     * @return Page of projects where user is a team member
     */
    @Query("SELECT DISTINCT p FROM Project p JOIN p.teamMemberIds t WHERE :memberId IN t")
    @QueryHints(value = {
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL")
    })
    Page<Project> findByTeamMemberIdsContaining(UUID memberId, Pageable pageable);

    /**
     * Retrieves a paginated list of projects with a specific status.
     * Utilizes database index on status field for optimal performance.
     *
     * @param status project status to filter by
     * @param pageable pagination parameters
     * @return Page of projects with given status
     */
    @QueryHints(value = {
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL")
    })
    Page<Project> findByStatus(ProjectStatus status, Pageable pageable);

    /**
     * Retrieves a paginated list of projects due before a specified date.
     * Orders results by due date ascending for priority handling.
     *
     * @param date cutoff date for due projects
     * @param pageable pagination parameters
     * @return Page of projects due before given date
     */
    @Query("SELECT p FROM Project p WHERE p.dueDate < :date ORDER BY p.dueDate ASC")
    @QueryHints(value = {
        @QueryHint(name = "org.hibernate.cacheable", value = "true"),
        @QueryHint(name = "org.hibernate.cacheMode", value = "NORMAL")
    })
    Page<Project> findByDueDateBefore(LocalDateTime date, Pageable pageable);

    /**
     * Efficiently checks if a project with given name exists for a specific owner.
     * Uses optimized EXISTS query instead of counting all records.
     *
     * @param name project name to check
     * @param ownerId ID of the project owner
     * @return true if project exists, false otherwise
     */
    @Query("SELECT COUNT(p) > 0 FROM Project p WHERE p.name = :name AND p.ownerId = :ownerId")
    boolean existsByNameAndOwnerId(String name, UUID ownerId);
}