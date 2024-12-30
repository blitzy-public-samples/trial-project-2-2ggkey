/**
 * @fileoverview Enhanced real-time activity feed component with security, offline support,
 * and accessibility features
 * @version 1.0.0
 * @package react@18.2.0
 * @package date-fns@2.30.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, formatDistanceToNow, formatInTimeZone } from 'date-fns';
import Card from '../common/Card';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../hooks/useAuth';
import { UI_CONFIG } from '../../config/constants';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface ActivityFeedProps {
  /** Maximum number of activities to display */
  limit?: number;
  /** Optional CSS class name */
  className?: string;
  /** Configuration options */
  options?: ActivityFeedOptions;
}

interface ActivityFeedOptions {
  /** Auto-refresh interval in ms */
  refreshInterval?: number;
  /** Enable offline support */
  offlineSupport?: boolean;
  /** Activity types to filter */
  activityTypes?: string[];
  /** Custom activity formatter */
  formatter?: (activity: ActivityItem) => React.ReactNode;
}

interface ActivityItem {
  id: string;
  optimisticId?: string;
  type: string;
  userId: string;
  userName: string;
  action: string;
  entityId: string;
  entityType: string;
  entityMetadata: Record<string, any>;
  timestamp: string;
  securityContext: {
    userRole: string;
    permissions: string[];
    ipAddress: string;
  };
  status: 'pending' | 'synced' | 'failed';
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OPTIONS: ActivityFeedOptions = {
  refreshInterval: 30000,
  offlineSupport: true,
  activityTypes: ['all'],
};

const ACTIVITY_TYPE_ICONS = {
  task_created: '📝',
  comment_added: '💬',
  file_uploaded: '📎',
  status_changed: '🔄',
  user_mentioned: '@',
};

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * Enhanced real-time activity feed component with security and accessibility features
 */
const ActivityFeed: React.FC<ActivityFeedProps> = ({
  limit = UI_CONFIG.PAGINATION.DEFAULT_PAGE_SIZE,
  className = '',
  options = {},
}) => {
  // Merge options with defaults
  const config = { ...DEFAULT_OPTIONS, ...options };

  // State and refs
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activitiesRef = useRef<ActivityItem[]>([]);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Hooks
  const { user } = useAuth();
  const {
    isConnected,
    connectionHealth,
    sendMessage,
    messageQueue,
  } = useWebSocket('/ws/activities', {
    autoReconnect: true,
    enableEncryption: true,
    heartbeatInterval: config.refreshInterval,
  });

  /**
   * Initialize activity feed with optimistic updates and offline support
   */
  useEffect(() => {
    const initializeFeed = async () => {
      try {
        setIsLoading(true);
        // Load cached activities if offline support is enabled
        if (config.offlineSupport) {
          const cached = localStorage.getItem('activity_feed_cache');
          if (cached) {
            setActivities(JSON.parse(cached));
          }
        }

        // Subscribe to real-time updates
        sendMessage('subscribe', {
          userId: user?.id,
          activityTypes: config.activityTypes,
        });

        setIsLoading(false);
      } catch (err) {
        setError('Failed to initialize activity feed');
        console.error('Activity feed initialization error:', err);
      }
    };

    initializeFeed();

    return () => {
      sendMessage('unsubscribe', { userId: user?.id });
    };
  }, [user?.id, config.offlineSupport, config.activityTypes, sendMessage]);

  /**
   * Handle real-time activity updates with optimistic UI
   */
  useEffect(() => {
    if (messageQueue.length > 0) {
      const newActivities = messageQueue
        .filter(msg => msg.type === 'activity_update')
        .map(msg => ({
          ...msg.payload,
          status: 'synced',
          timestamp: new Date().toISOString(),
        }));

      setActivities(prev => {
        const updated = [...newActivities, ...prev].slice(0, limit);
        // Update cache if offline support is enabled
        if (config.offlineSupport) {
          localStorage.setItem('activity_feed_cache', JSON.stringify(updated));
        }
        return updated;
      });
    }
  }, [messageQueue, limit, config.offlineSupport]);

  /**
   * Set up infinite scroll with intersection observer
   */
  useEffect(() => {
    if (!loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isLoading) {
          loadMoreActivities();
        }
      },
      { threshold: UI_CONFIG.INFINITE_SCROLL_THRESHOLD }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isLoading]);

  /**
   * Load more activities when scrolling
   */
  const loadMoreActivities = useCallback(async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      sendMessage('load_more', {
        lastActivityId: activities[activities.length - 1]?.id,
        limit,
      });
    } catch (err) {
      setError('Failed to load more activities');
      console.error('Load more activities error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activities, isLoading, limit, sendMessage]);

  /**
   * Format activity timestamp with timezone support
   */
  const formatTimestamp = useCallback((timestamp: string): string => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (err) {
      console.error('Timestamp formatting error:', err);
      return 'Invalid date';
    }
  }, []);

  /**
   * Render activity item with security context
   */
  const renderActivity = useCallback((activity: ActivityItem) => {
    const icon = ACTIVITY_TYPE_ICONS[activity.type as keyof typeof ACTIVITY_TYPE_ICONS] || '•';
    
    return (
      <Card
        key={activity.optimisticId || activity.id}
        className={`activity-item ${activity.status === 'pending' ? 'pending' : ''}`}
        elevation={1}
        testId={`activity-${activity.id}`}
      >
        <div className="activity-content">
          <span className="activity-icon" aria-hidden="true">{icon}</span>
          <div className="activity-details">
            <span className="activity-user">{activity.userName}</span>
            <span className="activity-action">{activity.action}</span>
            <time className="activity-time" dateTime={activity.timestamp}>
              {formatTimestamp(activity.timestamp)}
            </time>
          </div>
        </div>
      </Card>
    );
  }, [formatTimestamp]);

  return (
    <div
      className={`activity-feed ${className}`}
      role="feed"
      aria-busy={isLoading}
      aria-live="polite"
    >
      <div className="activity-feed-header">
        <h2>Activity Feed</h2>
        {!isConnected && (
          <div className="connection-status" role="alert">
            Reconnecting... ({connectionHealth.reconnectAttempts})
          </div>
        )}
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}

      <div className="activities-container">
        {activities.map(renderActivity)}
      </div>

      <div ref={loadMoreRef} className="load-more">
        {isLoading && <span>Loading more activities...</span>}
      </div>
    </div>
  );
};

export default React.memo(ActivityFeed);