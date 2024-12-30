/**
 * @fileoverview Secure and accessible project creation page component
 * @version 1.0.0
 */

import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import styled from '@emotion/styled';

import DashboardLayout from '../../layouts/DashboardLayout';
import ProjectForm from '../../components/projects/ProjectForm';
import { useProjects } from '../../hooks/useProjects';
import type { ProjectFormData } from '../../types/project.types';

// ============================================================================
// Styled Components
// ============================================================================

const PageContainer = styled.div`
  padding: var(--spacing-lg);
  max-width: 800px;
  margin: 0 auto;
  width: 100%;

  @media (max-width: 768px) {
    padding: var(--spacing-md);
  }
`;

const PageHeader = styled.header`
  margin-bottom: var(--spacing-xl);
`;

const Title = styled.h1`
  font-size: var(--font-size-2xl);
  color: var(--theme-text);
  margin-bottom: var(--spacing-sm);
`;

const Subtitle = styled.p`
  color: var(--theme-secondary);
  font-size: var(--font-size-md);
`;

const ErrorContainer = styled.div`
  padding: var(--spacing-lg);
  background-color: var(--theme-error);
  color: white;
  border-radius: var(--border-radius-md);
  margin-bottom: var(--spacing-lg);
`;

// ============================================================================
// Error Fallback Component
// ============================================================================

const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <ErrorContainer role="alert">
    <h2>Error Creating Project</h2>
    <pre>{error.message}</pre>
  </ErrorContainer>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * Project creation page component with comprehensive security,
 * accessibility, and analytics features
 */
const ProjectCreate: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { createProject } = useProjects();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle form submission with analytics tracking
  const handleSubmit = useCallback(async (formData: ProjectFormData) => {
    try {
      setIsSubmitting(true);

      // Track project creation attempt
      window.dispatchEvent(new CustomEvent('analytics', {
        detail: {
          event: 'project_create_attempt',
          timestamp: Date.now()
        }
      }));

      await createProject({
        name: formData.name,
        description: formData.description,
        teamMemberIds: formData.teamMembers,
        startDate: formData.startDate,
        dueDate: formData.dueDate,
        priority: formData.priority,
        tags: [],
        metadata: {}
      });

      // Track successful project creation
      window.dispatchEvent(new CustomEvent('analytics', {
        detail: {
          event: 'project_create_success',
          timestamp: Date.now()
        }
      }));

      navigate('/projects');
    } catch (error) {
      // Track project creation failure
      window.dispatchEvent(new CustomEvent('analytics', {
        detail: {
          event: 'project_create_error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        }
      }));

      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [createProject, navigate]);

  // Handle cancellation
  const handleCancel = useCallback(() => {
    navigate('/projects');
  }, [navigate]);

  return (
    <DashboardLayout>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <PageContainer>
          <PageHeader>
            <Title>Create New Project</Title>
            <Subtitle>
              Create a new project and assign team members to start collaborating
            </Subtitle>
          </PageHeader>

          <ProjectForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        </PageContainer>
      </ErrorBoundary>
    </DashboardLayout>
  );
});

// Display name for debugging
ProjectCreate.displayName = 'ProjectCreate';

export default ProjectCreate;