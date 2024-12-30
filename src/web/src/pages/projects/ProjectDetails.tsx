/**
 * @fileoverview Project details page component displaying comprehensive project information
 * with real-time updates, responsive design, and accessibility features.
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useCallback } from 'react';
import styled from '@emotion/styled';
import { useQuery } from '@tanstack/react-query';
import { useMediaQuery } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

import { Project, ProjectStatus } from '../../types/project.types';
import ProjectMembers from '../../components/projects/ProjectMembers';
import { useProjects } from '../../hooks/useProjects';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ProjectDetailsProps {
  /** Project identifier */
  projectId: string;
  /** Optional CSS class name */
  className?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: grid;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  max-width: 100%;
  margin: 0 auto;

  @media (min-width: 768px) {
    grid-template-columns: 2fr 1fr;
    gap: var(--spacing-lg);
  }

  @media (min-width: 1024px) {
    grid-template-columns: 3fr 1fr;
    max-width: 1440px;
  }
`;

const MainContent = styled.main`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
`;

const Title = styled.h1`
  font-size: var(--font-size-xl);
  color: var(--color-text-primary);
  margin: 0;
`;

const StatusBadge = styled.span<{ $status: ProjectStatus }>`
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background-color: ${({ $status }) => `var(--color-status-${$status.toLowerCase()})`};
  color: var(--color-text-inverse);
`;

const ProgressSection = styled.section`
  background: var(--color-background-secondary);
  padding: var(--spacing-md);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-sm);
`;

const ProgressBar = styled.div<{ $progress: number }>`
  width: 100%;
  height: 8px;
  background: var(--color-background-tertiary);
  border-radius: var(--border-radius-pill);
  overflow: hidden;

  &::after {
    content: '';
    display: block;
    width: ${props => props.$progress}%;
    height: 100%;
    background: var(--color-primary);
    transition: width 0.3s ease-in-out;
  }
`;

const Sidebar = styled.aside`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
`;

const ErrorFallback = styled.div`
  padding: var(--spacing-md);
  background: var(--color-error-light);
  color: var(--color-error);
  border-radius: var(--border-radius-md);
  margin: var(--spacing-md) 0;
`;

// ============================================================================
// Component
// ============================================================================

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  projectId,
  className
}) => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  
  const {
    selectedProject,
    loading,
    error,
    updateProject,
    selectProject,
    refreshProjects
  } = useProjects();

  // Real-time project data subscription
  const { data: projectData } = useQuery(
    ['project', projectId],
    () => fetch(`/api/v1/projects/${projectId}`).then(res => res.json()),
    {
      enabled: !!projectId,
      refetchInterval: 30000, // Poll every 30 seconds
      staleTime: 10000 // Consider data stale after 10 seconds
    }
  );

  // Update project in store when real-time data changes
  useEffect(() => {
    if (projectData) {
      selectProject(projectData);
    }
  }, [projectData, selectProject]);

  // Update document title
  useEffect(() => {
    if (selectedProject) {
      document.title = `${selectedProject.name} - Project Details`;
    }
    return () => {
      document.title = 'Task Management System';
    };
  }, [selectedProject]);

  // Format project progress for display
  const formattedProgress = useMemo(() => {
    if (!selectedProject) return 0;
    return Math.round(selectedProject.progress);
  }, [selectedProject]);

  // Handle status change
  const handleStatusChange = useCallback(async (newStatus: ProjectStatus) => {
    if (!selectedProject) return;

    try {
      await updateProject(selectedProject.id, { status: newStatus });
      await refreshProjects();
    } catch (err) {
      console.error('Failed to update project status:', err);
    }
  }, [selectedProject, updateProject, refreshProjects]);

  // Handle member updates
  const handleMemberUpdate = useCallback(async (members: string[]) => {
    if (!selectedProject) return;

    try {
      await updateProject(selectedProject.id, { teamMemberIds: members });
      await refreshProjects();
    } catch (err) {
      console.error('Failed to update team members:', err);
    }
  }, [selectedProject, updateProject, refreshProjects]);

  if (loading) {
    return (
      <Container className={className} aria-busy="true">
        <p>Loading project details...</p>
      </Container>
    );
  }

  if (error || !selectedProject) {
    return (
      <ErrorFallback role="alert">
        <h2>Error Loading Project</h2>
        <p>{error || 'Project not found'}</p>
        <button onClick={refreshProjects}>Retry</button>
      </ErrorFallback>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <ErrorFallback role="alert">
          <h2>Error in Project Details</h2>
          <p>{error.message}</p>
        </ErrorFallback>
      )}
    >
      <Container className={className}>
        <MainContent>
          <Header>
            <Title>{selectedProject.name}</Title>
            <StatusBadge 
              $status={selectedProject.status}
              role="status"
              aria-label={`Project status: ${selectedProject.status}`}
            >
              {selectedProject.status}
            </StatusBadge>
          </Header>

          <ProgressSection>
            <h2>Project Progress</h2>
            <ProgressBar 
              $progress={formattedProgress}
              role="progressbar"
              aria-valuenow={formattedProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
            <p aria-live="polite">
              {formattedProgress}% Complete
            </p>
          </ProgressSection>

          {!isMobile && (
            <section>
              <h2>Project Timeline</h2>
              <p>
                <strong>Start Date:</strong> {new Date(selectedProject.startDate!).toLocaleDateString()}
              </p>
              <p>
                <strong>Due Date:</strong> {new Date(selectedProject.dueDate!).toLocaleDateString()}
              </p>
            </section>
          )}
        </MainContent>

        <Sidebar>
          <ProjectMembers
            projectId={selectedProject.id}
            onMemberUpdate={handleMemberUpdate}
          />
          
          {!isTablet && (
            <section>
              <h2>Project Details</h2>
              <p>{selectedProject.description}</p>
              {selectedProject.tags.length > 0 && (
                <div>
                  <strong>Tags:</strong>
                  <ul>
                    {selectedProject.tags.map(tag => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </Sidebar>
      </Container>
    </ErrorBoundary>
  );
};

export default ProjectDetails;