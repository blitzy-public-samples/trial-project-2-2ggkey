/**
 * @fileoverview A reusable project card component that displays project information
 * following Material Design principles and WCAG accessibility guidelines.
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import classnames from 'classnames'; // v2.3.2
import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';
import { Project, ProjectStatus } from '../../types/project.types';
import styles from './ProjectCard.module.css';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ProjectCardProps {
  /** Project data object containing all required display information */
  project: Project;
  /** Optional click handler for card interaction */
  onClick?: (project: Project) => void;
  /** Optional additional CSS classes */
  className?: string;
  /** Optional test ID for automated testing */
  testId?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Maps project status to appropriate theme color with accessibility considerations
 * @param status - Project status to map to color
 * @returns CSS color class name based on status
 */
const getStatusColor = (status: ProjectStatus): string => {
  switch (status) {
    case ProjectStatus.IN_PROGRESS:
      return 'text-primary';
    case ProjectStatus.COMPLETED:
      return 'text-success';
    case ProjectStatus.ON_HOLD:
      return 'text-warning';
    case ProjectStatus.CANCELLED:
      return 'text-error';
    case ProjectStatus.ARCHIVED:
      return 'text-secondary';
    default:
      return 'text-info';
  }
};

/**
 * Formats team member count for accessibility
 * @param count - Number of team members
 * @returns Formatted string for screen readers
 */
const formatTeamCount = (count: number): string => {
  return `${count} team member${count === 1 ? '' : 's'}`;
};

// ============================================================================
// Component
// ============================================================================

/**
 * ProjectCard component that displays project information in a visually appealing
 * and accessible format following Material Design principles.
 */
const ProjectCard: React.FC<ProjectCardProps> = React.memo(({
  project,
  onClick,
  className,
  testId = 'project-card'
}) => {
  // Memoize status color to prevent recalculation
  const statusColor = useMemo(() => getStatusColor(project.status), [project.status]);

  // Memoize team count for accessibility
  const teamCount = useMemo(() => 
    formatTeamCount(project.teamMemberIds.length),
    [project.teamMemberIds.length]
  );

  // Handle card click with project context
  const handleClick = () => {
    if (onClick) {
      onClick(project);
    }
  };

  return (
    <Card
      className={classnames(styles.projectCard, className)}
      onClick={onClick ? handleClick : undefined}
      elevation={2}
      testId={testId}
    >
      <div className={styles.header}>
        <h3 className={styles.title} title={project.name}>
          {project.name}
        </h3>
        <span 
          className={classnames(styles.status, statusColor)}
          aria-label={`Status: ${project.status}`}
        >
          {project.status}
        </span>
      </div>

      <div className={styles.content}>
        {project.description && (
          <p className={styles.description} title={project.description}>
            {project.description}
          </p>
        )}

        <div className={styles.progress}>
          <ProgressBar
            value={project.progress}
            color={project.progress === 100 ? 'success' : 'primary'}
            size="sm"
            showLabel
            animated={project.status === ProjectStatus.IN_PROGRESS}
            ariaLabel={`Project progress: ${project.progress}%`}
          />
        </div>

        <div className={styles.metadata}>
          <div className={styles.team} aria-label={teamCount}>
            <span className={styles.teamCount}>
              {project.teamMemberIds.length}
            </span>
            <span className={styles.teamLabel}>Team Members</span>
          </div>

          {project.dueDate && (
            <div className={styles.dueDate}>
              <span>Due: </span>
              <time dateTime={project.dueDate}>
                {new Date(project.dueDate).toLocaleDateString()}
              </time>
            </div>
          )}
        </div>

        {project.tags.length > 0 && (
          <div className={styles.tags} aria-label="Project tags">
            {project.tags.map(tag => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
});

// Display name for debugging
ProjectCard.displayName = 'ProjectCard';

// Default export
export default ProjectCard;

// CSS Module styles would be in a separate file: ProjectCard.module.css
/*
.projectCard {
  width: 100%;
  max-width: 400px;
  transition: var(--transition-base);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-sm);
  white-space: nowrap;
}

.description {
  font-size: var(--font-size-sm);
  color: var(--theme-text-secondary);
  margin: 0 0 var(--spacing-md);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.progress {
  margin-bottom: var(--spacing-md);
}

.metadata {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.team {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.teamCount {
  font-weight: var(--font-weight-bold);
}

.teamLabel {
  font-size: var(--font-size-sm);
  color: var(--theme-text-secondary);
}

.dueDate {
  font-size: var(--font-size-sm);
  color: var(--theme-text-secondary);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}

.tag {
  font-size: var(--font-size-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background-color: var(--theme-background-secondary);
  border-radius: var(--border-radius-sm);
  color: var(--theme-text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .projectCard {
    transition: none;
  }
}
*/