import React, { useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // v6.14.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { useToast } from '@chakra-ui/toast'; // v2.0.0

import ProjectForm, { ProjectFormProps } from '../../components/projects/ProjectForm';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import useProjects from '../../hooks/useProjects';
import type { Project } from '../../types/project.types';
import styles from './ProjectEdit.module.css';

// =============================================================================
// Types & Interfaces
// =============================================================================

interface ProjectEditProps {}

// =============================================================================
// Error Fallback Component
// =============================================================================

const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div className={styles['error-container']} role="alert">
    <h2>Error Editing Project</h2>
    <pre>{error.message}</pre>
    <button 
      onClick={resetErrorBoundary}
      className={styles['error-button']}
    >
      Try Again
    </button>
  </div>
);

// =============================================================================
// Main Component
// =============================================================================

/**
 * ProjectEdit component for editing existing project details.
 * Implements real-time validation, optimistic updates, and proper error handling.
 */
const ProjectEdit: React.FC<ProjectEditProps> = React.memo(() => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  // Get project data and update function from custom hook
  const { 
    selectedProject,
    updateProject,
    loading,
    error,
    clearProjectError 
  } = useProjects();

  // =============================================================================
  // Effects
  // =============================================================================

  // Clear any existing errors when component unmounts
  useEffect(() => {
    return () => {
      clearProjectError();
    };
  }, [clearProjectError]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleProjectUpdate = useCallback(async (updatedProject: Project) => {
    if (!projectId) return;

    try {
      await updateProject(projectId, updatedProject);
      
      toast({
        title: 'Project Updated',
        description: 'Project details have been successfully updated.',
        status: 'success',
        duration: 5000,
        isClosable: true,
        position: 'top-right'
      });

      navigate(`/projects/${projectId}`);
    } catch (err) {
      toast({
        title: 'Update Failed',
        description: error || 'Failed to update project. Please try again.',
        status: 'error',
        duration: 7000,
        isClosable: true,
        position: 'top-right'
      });
    }
  }, [projectId, updateProject, navigate, toast, error]);

  const handleCancel = useCallback(() => {
    navigate(`/projects/${projectId}`);
  }, [navigate, projectId]);

  // =============================================================================
  // Render Helpers
  // =============================================================================

  if (loading) {
    return (
      <div 
        className={styles['loading-container']}
        aria-label="Loading project details"
      >
        <LoadingSpinner 
          size="large"
          color="var(--theme-primary)"
          ariaLabel="Loading project details"
        />
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div 
        className={styles['error-container']}
        role="alert"
      >
        <h2>Project Not Found</h2>
        <p>The requested project could not be found.</p>
        <button 
          onClick={() => navigate('/projects')}
          className={styles['error-button']}
        >
          Return to Projects
        </button>
      </div>
    );
  }

  // =============================================================================
  // Main Render
  // =============================================================================

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={clearProjectError}
    >
      <div className={styles['edit-container']}>
        <h1 className={styles['edit-title']}>
          Edit Project: {selectedProject.name}
        </h1>
        
        <div className={styles['form-wrapper']}>
          <ProjectForm
            initialData={selectedProject}
            onSubmit={handleProjectUpdate}
            onCancel={handleCancel}
            isSubmitting={loading}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
});

ProjectEdit.displayName = 'ProjectEdit';

export default ProjectEdit;