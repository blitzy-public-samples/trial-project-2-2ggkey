/**
 * @fileoverview Dashboard component for displaying project progress information
 * with virtualized list support and performance optimizations.
 * @version 1.0.0
 */

import React, { useMemo, useCallback } from 'react';
import { FixedSizeList as VirtualList } from 'react-window'; // v1.8.9
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.11

import { Project, ProjectStatus } from '../../types/project.types';
import { ProgressBar } from '../common/ProgressBar';
import { useProjects } from '../../hooks/useProjects';
import { formatClassName } from '../../utils/format.utils';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ProjectProgressProps {
  /** Maximum number of projects to display */
  maxProjects?: number;
  /** Optional additional CSS classes */
  className?: string;
  /** Number of projects at which to enable virtualization */
  virtualizeThreshold?: number;
}

interface ProjectItemProps {
  project: Project;
  style: React.CSSProperties;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_PROJECTS = 10;
const DEFAULT_VIRTUALIZE_THRESHOLD = 20;
const ITEM_HEIGHT = 80;
const LIST_HEIGHT = 400;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines the progress bar color based on completion percentage
 * @param progress - Project completion percentage
 * @returns Design system color token
 */
const getProgressColor = (progress: number): 'error' | 'warning' | 'primary' | 'success' => {
  if (progress < 25) return 'error';
  if (progress < 50) return 'warning';
  if (progress < 75) return 'primary';
  return 'success';
};

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Individual project progress item component
 */
const ProjectItem: React.FC<ProjectItemProps> = React.memo(({ project, style }) => {
  const progressColor = getProgressColor(project.progress);
  
  return (
    <div 
      className="project-progress-item"
      style={style}
      data-testid={`project-progress-${project.id}`}
    >
      <div className="project-progress-header">
        <h3 className="project-progress-title" title={project.name}>
          {project.name}
        </h3>
        <span className={`project-status status-${project.status.toLowerCase()}`}>
          {project.status}
        </span>
      </div>
      
      <div className="project-progress-bar">
        <ProgressBar
          value={project.progress}
          color={progressColor}
          size="md"
          showLabel
          animated
          ariaLabel={`${project.name} progress: ${project.progress}%`}
        />
      </div>
    </div>
  );
});

ProjectItem.displayName = 'ProjectItem';

/**
 * Error fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="project-progress-error" role="alert">
    <h3>Error Loading Projects</h3>
    <pre>{error.message}</pre>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * ProjectProgress component displays a list of projects with their progress bars
 * and implements virtualization for performance with large datasets.
 */
export const ProjectProgress: React.FC<ProjectProgressProps> = React.memo(({
  maxProjects = DEFAULT_MAX_PROJECTS,
  className,
  virtualizeThreshold = DEFAULT_VIRTUALIZE_THRESHOLD
}) => {
  // Fetch projects using custom hook
  const { projects, loading, error } = useProjects();

  // Memoize filtered and sorted projects
  const displayProjects = useMemo(() => {
    return projects
      .filter(project => project.status !== ProjectStatus.ARCHIVED)
      .sort((a, b) => b.progress - a.progress)
      .slice(0, maxProjects);
  }, [projects, maxProjects]);

  // Virtualized row renderer
  const rowRenderer = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const project = displayProjects[index];
    return <ProjectItem project={project} style={style} />;
  }, [displayProjects]);

  // Container classes
  const containerClasses = formatClassName(
    'project-progress-container',
    className,
    {
      'is-loading': loading,
      'is-empty': !loading && displayProjects.length === 0
    }
  );

  // Loading state
  if (loading) {
    return (
      <div className={containerClasses} aria-busy="true">
        <div className="project-progress-skeleton" />
      </div>
    );
  }

  // Empty state
  if (!displayProjects.length) {
    return (
      <div className={containerClasses}>
        <p className="project-progress-empty">
          No active projects found
        </p>
      </div>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div 
        className={containerClasses}
        role="region"
        aria-label="Project Progress"
      >
        {displayProjects.length > virtualizeThreshold ? (
          <VirtualList
            height={LIST_HEIGHT}
            width="100%"
            itemCount={displayProjects.length}
            itemSize={ITEM_HEIGHT}
          >
            {rowRenderer}
          </VirtualList>
        ) : (
          <div className="project-progress-list">
            {displayProjects.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                style={{ height: ITEM_HEIGHT }}
              />
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
});

ProjectProgress.displayName = 'ProjectProgress';

export default ProjectProgress;