/**
 * @fileoverview Main projects page component implementing a responsive, accessible,
 * and performant interface for project management following Material Design principles.
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

// Internal components
import ProjectList from '../../components/projects/ProjectList';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';

// Custom hooks
import { useProjects } from '../../hooks/useProjects';

// Styles
import styles from './Projects.module.css';

/**
 * Projects page component that implements project management functionality
 * with responsive design, accessibility features, and performance optimizations.
 */
const Projects: React.FC = () => {
  const navigate = useNavigate();
  const {
    projects,
    loading,
    error,
    selectedProject,
    projectStats,
    selectProject,
    clearProjectError,
    refreshProjects
  } = useProjects();

  // Fetch projects on mount
  useEffect(() => {
    refreshProjects().catch(console.error);
    return () => {
      // Cleanup selected project on unmount
      selectProject(null);
    };
  }, [refreshProjects, selectProject]);

  // Handle project creation
  const handleCreateProject = useCallback(() => {
    navigate('/projects/new');
  }, [navigate]);

  // Handle project selection
  const handleProjectSelect = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      selectProject(project);
      navigate(`/projects/${projectId}`);
    }
  }, [projects, selectProject, navigate]);

  // Error fallback component
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }) => (
    <div className={styles.errorContainer} role="alert">
      <h2>Something went wrong</h2>
      <pre className={styles.errorMessage}>{error.message}</pre>
      <Button 
        variant="primary" 
        onClick={resetErrorBoundary}
        ariaLabel="Try again"
      >
        Try again
      </Button>
    </div>
  ), []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={clearProjectError}
    >
      <div className={styles.container}>
        {/* Header section */}
        <header className={styles.header}>
          <div className={styles.titleSection}>
            <h1 className={styles.title}>Projects</h1>
            <div className={styles.stats}>
              <span>Total: {projectStats.totalProjects}</span>
              <span>Active: {projectStats.projectsByStatus.IN_PROGRESS || 0}</span>
              <span>
                Progress: {Math.round(projectStats.averageProgress)}%
              </span>
            </div>
          </div>
          
          <div className={styles.actions}>
            <Button
              variant="primary"
              onClick={handleCreateProject}
              startIcon={<span aria-hidden="true">+</span>}
              ariaLabel="Create new project"
              dataTestId="create-project-button"
            >
              New Project
            </Button>
          </div>
        </header>

        {/* Main content */}
        <main className={styles.content}>
          {loading && !projects.length ? (
            <div className={styles.loading}>
              <LoadingSpinner 
                size="large"
                ariaLabel="Loading projects"
              />
            </div>
          ) : error ? (
            <div className={styles.error} role="alert">
              <p>{error.message}</p>
              <Button 
                variant="secondary" 
                onClick={refreshProjects}
                ariaLabel="Retry loading projects"
              >
                Retry
              </Button>
            </div>
          ) : (
            <ProjectList
              onProjectSelect={handleProjectSelect}
              className={styles.projectList}
              testId="projects-list"
            />
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
};

// Export with memo for performance optimization
export default React.memo(Projects);

// CSS Module styles would be in Projects.module.css
/*
.container {
  padding: var(--spacing-lg);
  max-width: 1440px;
  margin: 0 auto;
  min-height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.titleSection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--theme-text);
  margin: 0;
}

.stats {
  display: flex;
  gap: var(--spacing-md);
  color: var(--theme-text-secondary);
  font-size: var(--font-size-sm);
}

.actions {
  display: flex;
  gap: var(--spacing-md);
}

.content {
  position: relative;
  min-height: 400px;
}

.loading,
.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: var(--spacing-md);
  text-align: center;
}

.error {
  color: var(--theme-error);
}

.projectList {
  margin-top: var(--spacing-lg);
}

.errorContainer {
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--theme-error);
}

.errorMessage {
  margin: var(--spacing-md) 0;
  padding: var(--spacing-md);
  background: var(--theme-background-secondary);
  border-radius: var(--border-radius-md);
  font-family: var(--font-family-mono);
  overflow-x: auto;
}

@media (max-width: 768px) {
  .container {
    padding: var(--spacing-md);
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
  }

  .stats {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading {
    animation: none;
  }
}
*/