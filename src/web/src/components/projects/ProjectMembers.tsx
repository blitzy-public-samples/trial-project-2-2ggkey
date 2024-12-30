/**
 * @fileoverview ProjectMembers component for displaying and managing team members in a project
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { useVirtualizer } from '@tanstack/react-virtual';

import { Project } from '../../types/project.types';
import Avatar from '../common/Avatar';
import { useProjects } from '../../hooks/useProjects';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ProjectMembersProps {
  /** ID of the project to display members for */
  projectId: string;
  /** Optional CSS class name for styling */
  className?: string;
  /** Callback for member list updates */
  onMemberUpdate?: (members: string[]) => void;
}

interface MemberItemProps {
  memberId: string;
  name: string;
  avatarUrl?: string;
  role: string;
  isOnline: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const MembersContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: clamp(0.75rem, 2vw, 1rem);
  padding: clamp(0.75rem, 2vw, 1rem);
  background-color: var(--color-background-secondary);
  border-radius: var(--border-radius-md);
  max-height: calc(100vh - var(--header-height));
  overflow: auto;
  scroll-behavior: smooth;

  /* Scrollbar styling */
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--color-scrollbar);
    border-radius: 3px;
  }
`;

const MemberItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: var(--border-radius-sm);
  background-color: var(--color-background-primary);
  transition: var(--transition-base);
  position: relative;

  &:hover {
    background-color: var(--color-background-hover);
  }

  &:focus-within {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`;

const MemberInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const MemberName = styled.div`
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MemberRole = styled.div`
  font-size: 0.875rem;
  color: var(--color-text-secondary);
`;

const OnlineIndicator = styled.div<{ $isOnline: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${props => 
    props.$isOnline ? 'var(--color-success)' : 'var(--color-text-tertiary)'};
  margin-left: auto;
`;

const RemoveButton = styled.button`
  padding: 0.25rem;
  border-radius: var(--border-radius-sm);
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: var(--transition-base);

  &:hover {
    color: var(--color-danger);
    background-color: var(--color-danger-light);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`;

// ============================================================================
// Component
// ============================================================================

export const ProjectMembers: React.FC<ProjectMembersProps> = ({
  projectId,
  className,
  onMemberUpdate
}) => {
  const { selectedProject, updateProject } = useProjects();
  const [isUpdating, setIsUpdating] = useState(false);

  // Get current project's team members
  const members = useMemo(() => {
    if (!selectedProject?.teamMemberIds) return [];
    return selectedProject.teamMemberIds;
  }, [selectedProject]);

  // Virtual list setup for performance
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: members.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // Estimated height of each member item
    overscan: 5 // Number of items to render outside visible area
  });

  /**
   * Handles removing a member from the project
   */
  const handleRemoveMember = useCallback(async (memberId: string) => {
    if (!selectedProject || isUpdating) return;

    try {
      setIsUpdating(true);
      const updatedMembers = selectedProject.teamMemberIds.filter(id => id !== memberId);
      
      await updateProject(selectedProject.id, {
        teamMemberIds: updatedMembers
      });

      onMemberUpdate?.(updatedMembers);
    } catch (error) {
      console.error('Failed to remove team member:', error);
      // Toast notification would be shown here
    } finally {
      setIsUpdating(false);
    }
  }, [selectedProject, isUpdating, updateProject, onMemberUpdate]);

  if (!selectedProject) return null;

  return (
    <MembersContainer 
      ref={parentRef}
      className={className}
      role="list"
      aria-label="Project team members"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const memberId = members[virtualRow.index];
          // In a real app, we would fetch member details from a user store
          const memberDetails = {
            name: `Team Member ${virtualRow.index + 1}`,
            role: 'Developer',
            isOnline: Math.random() > 0.5 // Simulated online status
          };

          return (
            <MemberItem
              key={memberId}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`
              }}
              role="listitem"
            >
              <Avatar
                name={memberDetails.name}
                size="sm"
                alt={`${memberDetails.name}'s avatar`}
              />
              <MemberInfo>
                <MemberName>{memberDetails.name}</MemberName>
                <MemberRole>{memberDetails.role}</MemberRole>
              </MemberInfo>
              <OnlineIndicator 
                $isOnline={memberDetails.isOnline}
                aria-label={memberDetails.isOnline ? 'Online' : 'Offline'}
              />
              <RemoveButton
                onClick={() => handleRemoveMember(memberId)}
                aria-label={`Remove ${memberDetails.name} from project`}
                disabled={isUpdating}
              >
                <span aria-hidden="true">×</span>
              </RemoveButton>
            </MemberItem>
          );
        })}
      </div>
    </MembersContainer>
  );
};

export default ProjectMembers;