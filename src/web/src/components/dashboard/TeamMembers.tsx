/**
 * @fileoverview A dashboard component that displays team members with real-time status updates
 * @version 1.0.0
 * @author Task Management System Team
 */

import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { FixedSizeList as VirtualList } from 'react-window'; // ^1.8.9
import Avatar from '../common/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { UI_CONFIG } from '../../config/constants';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastActive: string;
}

interface FilterOptions {
  status?: string[];
  role?: string[];
  search?: string;
}

export interface TeamMembersProps {
  className?: string;
  maxDisplay?: number;
  filterOptions?: FilterOptions;
  onMemberClick?: (member: TeamMember) => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  background: var(--background-card);
  border-radius: 8px;
  padding: 16px;
  box-shadow: var(--shadow-sm);

  @media (max-width: ${UI_CONFIG.BREAKPOINTS.MOBILE}px) {
    padding: 12px;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const Title = styled.h2`
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
`;

const MemberList = styled.div`
  min-height: 200px;
  max-height: 400px;
`;

const MemberItem = styled.div<{ isOnline: boolean }>`
  display: flex;
  align-items: center;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--background-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
`;

const MemberInfo = styled.div`
  margin-left: 12px;
  flex: 1;
`;

const MemberName = styled.div`
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
`;

const MemberRole = styled.div`
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
`;

const StatusIndicator = styled.div<{ status: TeamMember['status'] }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 8px;
  background-color: ${({ status }) => {
    switch (status) {
      case 'online': return 'var(--color-success)';
      case 'away': return 'var(--color-warning)';
      case 'busy': return 'var(--color-error)';
      default: return 'var(--color-disabled)';
    }
  }};
`;

// ============================================================================
// Component
// ============================================================================

export const TeamMembers: React.FC<TeamMembersProps> = memo(({
  className,
  maxDisplay = 5,
  filterOptions,
  onMemberClick
}) => {
  // State and hooks
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // WebSocket setup for real-time updates
  const { isConnected, messageQueue } = useWebSocket(
    `${process.env.REACT_APP_WS_URL}/team-updates`,
    {
      autoConnect: true,
      enableEncryption: true,
      heartbeatInterval: 30000
    }
  );

  // Filter and sort members
  const filteredMembers = useMemo(() => {
    if (!members.length) return [];

    let result = [...members];

    if (filterOptions?.status?.length) {
      result = result.filter(member => 
        filterOptions.status?.includes(member.status)
      );
    }

    if (filterOptions?.role?.length) {
      result = result.filter(member => 
        filterOptions.role?.includes(member.role)
      );
    }

    if (filterOptions?.search) {
      const search = filterOptions.search.toLowerCase();
      result = result.filter(member =>
        member.name.toLowerCase().includes(search) ||
        member.email.toLowerCase().includes(search)
      );
    }

    // Sort by online status and name
    return result.sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (a.status !== 'online' && b.status === 'online') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [members, filterOptions]);

  // Handle member status updates from WebSocket
  useEffect(() => {
    const statusUpdates = messageQueue.filter(msg => msg.type === 'MEMBER_STATUS_UPDATE');
    if (statusUpdates.length) {
      setMembers(prev => prev.map(member => {
        const update = statusUpdates.find(msg => msg.payload.userId === member.id);
        return update ? { ...member, ...update.payload } : member;
      }));
    }
  }, [messageQueue]);

  // Virtual list row renderer
  const renderRow = useCallback(({ index, style }) => {
    const member = filteredMembers[index];
    return (
      <MemberItem
        key={member.id}
        isOnline={member.status === 'online'}
        style={style}
        onClick={() => onMemberClick?.(member)}
        role="button"
        tabIndex={0}
        aria-label={`${member.name}, ${member.role}, ${member.status}`}
      >
        <Avatar
          src={member.avatarUrl}
          alt={member.name}
          name={member.name}
          size="sm"
        />
        <MemberInfo>
          <MemberName>{member.name}</MemberName>
          <MemberRole>{member.role}</MemberRole>
        </MemberInfo>
        <StatusIndicator 
          status={member.status}
          aria-label={`Status: ${member.status}`}
        />
      </MemberItem>
    );
  }, [filteredMembers, onMemberClick]);

  return (
    <Container 
      className={className}
      aria-label="Team Members"
      role="region"
    >
      <Header>
        <Title>Team Members</Title>
        {isConnected && (
          <StatusIndicator 
            status="online"
            aria-label="Real-time updates active"
          />
        )}
      </Header>
      <MemberList>
        {loading ? (
          <div aria-busy="true">Loading team members...</div>
        ) : (
          <VirtualList
            height={Math.min(400, filteredMembers.length * 56)}
            width="100%"
            itemCount={filteredMembers.length}
            itemSize={56}
            overscanCount={2}
          >
            {renderRow}
          </VirtualList>
        )}
      </MemberList>
    </Container>
  );
});

TeamMembers.displayName = 'TeamMembers';

export default TeamMembers;