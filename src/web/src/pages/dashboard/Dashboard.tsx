/**
 * @fileoverview Main dashboard page component providing comprehensive overview of tasks,
 * projects, team activities and key metrics with real-time updates and performance optimizations.
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import OverviewStats from '../../components/dashboard/OverviewStats';
import ProjectProgress from '../../components/dashboard/ProjectProgress';
import TeamMembers from '../../components/dashboard/TeamMembers';
import { UI_CONFIG } from '../../config/constants';

// ============================================================================
// Styled Components
// ============================================================================

const DashboardContainer = styled.div`
  display: grid;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  max-width: 1440px;
  margin: 0 auto;
  
  @media (min-width: ${UI_CONFIG.BREAKPOINTS.DESKTOP}px) {
    grid-template-columns: repeat(12, 1fr);
    grid-template-areas:
      "welcome welcome welcome welcome welcome welcome welcome welcome welcome welcome welcome welcome"
      "stats stats stats stats stats stats stats stats stats stats stats stats"
      "projects projects projects projects projects projects activity activity activity team team team";
  }

  @media (max-width: ${UI_CONFIG.BREAKPOINTS.TABLET}px) {
    grid-template-columns: 1fr;
    grid-template-areas:
      "welcome"
      "stats"
      "projects"
      "team"
      "activity";
  }
`;

const WelcomeSection = styled.div`
  grid-area: welcome;
  padding: var(--spacing-lg);
  background: var(--theme-background);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
`;

const StatsSection = styled.div`
  grid-area: stats;
`;

const ProjectsSection = styled.div`
  grid-area: projects;
`;

const ActivitySection = styled.div`
  grid-area: activity;
`;

const TeamSection = styled.div`
  grid-area: team;
`;

// ============================================================================
// Types
// ============================================================================

interface DashboardProps {
  className?: string;
}

interface DashboardMetrics {
  taskCompletionRate: number;
  activeProjects: number;
  teamUtilization: number;
  overdueTasks: number;
}

// ============================================================================
// Component
// ============================================================================

export const Dashboard: React.FC<DashboardProps> = ({ className }) => {
  // Authentication and user context
  const { user } = useAuth();

  // WebSocket connection for real-time updates
  const { isConnected, messageQueue } = useWebSocket('/ws/dashboard', {
    autoReconnect: true,
    enableEncryption: true,
    heartbeatInterval: 30000
  });

  // Local state for dashboard metrics
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    taskCompletionRate: 0,
    activeProjects: 0,
    teamUtilization: 0,
    overdueTasks: 0
  });

  // Error state management
  const [error, setError] = useState<string | null>(null);

  // Memoized greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Handle real-time metric updates
  useEffect(() => {
    const metricUpdates = messageQueue.filter(msg => msg.type === 'DASHBOARD_METRICS');
    if (metricUpdates.length > 0) {
      const latestMetrics = metricUpdates[metricUpdates.length - 1].payload;
      setMetrics(prevMetrics => ({
        ...prevMetrics,
        ...latestMetrics
      }));
    }
  }, [messageQueue]);

  // Error handling callback
  const handleError = useCallback((error: Error) => {
    setError(error.message);
    console.error('Dashboard error:', error);
  }, []);

  // Clear error callback
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <DashboardContainer 
      className={className}
      role="main"
      aria-label="Dashboard"
    >
      {/* Welcome Section */}
      <WelcomeSection>
        <h1>
          {greeting}, {user?.name}
          {isConnected && <span aria-label="Connected" role="img" aria-hidden="true"> 🟢</span>}
        </h1>
        {error && (
          <div 
            role="alert" 
            className="error-message"
            onClick={clearError}
          >
            {error}
          </div>
        )}
      </WelcomeSection>

      {/* Statistics Overview */}
      <StatsSection>
        <OverviewStats
          tasks={[]} // Passed from parent or fetched via hook
          projects={[]} // Passed from parent or fetched via hook
          refreshInterval={UI_CONFIG.ANIMATION_DURATION}
        />
      </StatsSection>

      {/* Project Progress */}
      <ProjectsSection>
        <ProjectProgress
          maxProjects={5}
          virtualizeThreshold={20}
        />
      </ProjectsSection>

      {/* Activity Feed */}
      <ActivitySection>
        <ActivityFeed
          limit={10}
          options={{
            refreshInterval: 30000,
            offlineSupport: true,
            activityTypes: ['all']
          }}
        />
      </ActivitySection>

      {/* Team Members */}
      <TeamSection>
        <TeamMembers
          maxDisplay={5}
          filterOptions={{
            status: ['online', 'away', 'busy'],
            role: ['all']
          }}
        />
      </TeamSection>
    </DashboardContainer>
  );
};

// Performance optimization
export default React.memo(Dashboard);