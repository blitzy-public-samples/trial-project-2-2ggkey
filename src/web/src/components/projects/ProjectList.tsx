/**
 * @fileoverview A responsive and accessible component that displays a virtualized 
 * grid or list of project cards with advanced filtering, sorting, and selection capabilities.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeGrid, FixedSizeList } from 'react-window'; // v1.8.9
import classnames from 'classnames'; // v2.3.2
import debounce from 'lodash/debounce'; // v4.17.21

import ProjectCard from './ProjectCard';
import LoadingSpinner from '../common/LoadingSpinner';
import { useProjects } from '../../hooks/useProjects';
import { Project, ProjectFilter, ProjectSortKey } from '../../types/project.types';
import styles from './ProjectList.module.css';

// ============================================================================
// Constants
// ============================================================================

const GRID_COLUMN_WIDTHS = {
  mobile: 320,
  tablet: 384,
  desktop: 400,
  large: 420,
};

const ROW_HEIGHTS = {
  grid: 320,
  list: 120,
};

const GRID_GAP = 24;

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ProjectListProps {
  /** Optional CSS class name for styling */
  className?: string;
  /** Optional callback when a project is selected */
  onProjectSelect?: (projectId: string) => void;
  /** Optional filter configuration for projects */
  filter?: ProjectFilter;
  /** Optional sort configuration */
  sortBy?: ProjectSortKey;
  /** Display mode for projects */
  viewMode?: 'grid' | 'list';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculates grid dimensions based on container width and view mode
 */
const useGridDimensions = (
  containerWidth: number,
  viewMode: 'grid' | 'list'
): { columns: number; itemWidth: number } => {
  return useMemo(() => {
    if (viewMode === 'list') {
      return { columns: 1, itemWidth: containerWidth };
    }

    let columnWidth = GRID_COLUMN_WIDTHS.desktop;
    if (containerWidth <= 768) columnWidth = GRID_COLUMN_WIDTHS.mobile;
    else if (containerWidth <= 1024) columnWidth = GRID_COLUMN_WIDTHS.tablet;
    else if (containerWidth >= 1440) columnWidth = GRID_COLUMN_WIDTHS.large;

    const columns = Math.max(1, Math.floor((containerWidth + GRID_GAP) / (columnWidth + GRID_GAP)));
    const itemWidth = (containerWidth - (columns - 1) * GRID_GAP) / columns;

    return { columns, itemWidth };
  }, [containerWidth, viewMode]);
};

// ============================================================================
// Component
// ============================================================================

const ProjectList: React.FC<ProjectListProps> = React.memo(({
  className,
  onProjectSelect,
  filter,
  sortBy,
  viewMode = 'grid'
}) => {
  // Refs and state
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Custom hooks
  const {
    projects,
    loading,
    error,
    selectProject,
    setProjectFilters,
  } = useProjects(filter);

  // Calculate grid dimensions
  const { columns, itemWidth } = useGridDimensions(containerWidth, viewMode);

  // Resize observer setup
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(debounce((entries) => {
      const { width } = entries[0].contentRect;
      setContainerWidth(width);
    }, 100));

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Project selection handler
  const handleProjectClick = useCallback((project: Project) => {
    selectProject(project);
    onProjectSelect?.(project.id);
  }, [selectProject, onProjectSelect]);

  // Grid item renderer
  const GridItem = useCallback(({ columnIndex, rowIndex, style }: any) => {
    const index = rowIndex * columns + columnIndex;
    const project = projects[index];

    if (!project) return null;

    return (
      <div style={style} className={styles.gridItem}>
        <ProjectCard
          project={project}
          onClick={() => handleProjectClick(project)}
          className={styles.card}
          testId={`project-card-${project.id}`}
        />
      </div>
    );
  }, [projects, columns, handleProjectClick]);

  // List item renderer
  const ListItem = useCallback(({ index, style }: any) => {
    const project = projects[index];

    return (
      <div style={style} className={styles.listItem}>
        <ProjectCard
          project={project}
          onClick={() => handleProjectClick(project)}
          className={styles.card}
          testId={`project-card-${project.id}`}
        />
      </div>
    );
  }, [projects, handleProjectClick]);

  // Error state
  if (error) {
    return (
      <div className={styles.error} role="alert">
        <p>Failed to load projects. Please try again later.</p>
      </div>
    );
  }

  // Loading state
  if (loading && !projects.length) {
    return (
      <div className={styles.loading}>
        <LoadingSpinner size="large" ariaLabel="Loading projects..." />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={classnames(styles.container, className)}
      data-testid="project-list"
    >
      {viewMode === 'grid' ? (
        <FixedSizeGrid
          className={styles.grid}
          columnCount={columns}
          columnWidth={itemWidth}
          height={Math.min(window.innerHeight * 0.8, ROW_HEIGHTS.grid * 2)}
          rowCount={Math.ceil(projects.length / columns)}
          rowHeight={ROW_HEIGHTS.grid}
          width={containerWidth}
          itemData={projects}
        >
          {GridItem}
        </FixedSizeGrid>
      ) : (
        <FixedSizeList
          className={styles.list}
          height={Math.min(window.innerHeight * 0.8, ROW_HEIGHTS.list * 5)}
          itemCount={projects.length}
          itemSize={ROW_HEIGHTS.list}
          width={containerWidth}
          itemData={projects}
        >
          {ListItem}
        </FixedSizeList>
      )}
    </div>
  );
});

// Display name for debugging
ProjectList.displayName = 'ProjectList';

// Default export
export default ProjectList;

// CSS Module styles would be in ProjectList.module.css
/*
.container {
  width: 100%;
  min-height: 200px;
  position: relative;
}

.grid {
  padding: var(--spacing-md);
}

.list {
  padding: var(--spacing-sm);
}

.gridItem {
  padding: var(--spacing-md);
}

.listItem {
  padding: var(--spacing-sm);
}

.card {
  height: 100%;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.error {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  color: var(--theme-error);
  text-align: center;
  padding: var(--spacing-lg);
}

@media (prefers-reduced-motion: reduce) {
  .grid,
  .list {
    scroll-behavior: auto;
  }
}
*/