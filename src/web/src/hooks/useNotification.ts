/**
 * @fileoverview Enhanced React hook for managing notifications with advanced features
 * @version 1.0.0
 * @package react@18.2.0
 * @package react-redux@8.1.0
 * @package localforage@1.10.0
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import localforage from 'localforage';
import { useWebSocket } from './useWebSocket';
import { ISO8601DateString, UUID } from '../types/common.types';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Notification priority levels
 */
enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Notification type definition
 */
interface Notification {
  id: UUID;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: NotificationPriority;
  timestamp: ISO8601DateString;
  read: boolean;
  metadata?: Record<string, any>;
  actionUrl?: string;
  expiresAt?: ISO8601DateString;
}

/**
 * Notification preferences
 */
interface NotificationPreferences {
  enabled: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // 24h format "HH:mm"
    end: string;
  };
  desktopNotifications: boolean;
  soundEnabled: boolean;
  grouping: boolean;
  retentionDays: number;
}

/**
 * Notification filters
 */
interface NotificationFilters {
  type?: string[];
  priority?: NotificationPriority[];
  read?: boolean;
  startDate?: ISO8601DateString;
  endDate?: ISO8601DateString;
}

/**
 * Cache configuration
 */
interface CacheOptions {
  enabled: boolean;
  maxAge: number;
  maxItems: number;
}

/**
 * Hook return type
 */
interface UseNotificationResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  preferences: NotificationPreferences;
  connectionStatus: boolean;
  markAsRead: (id: UUID | UUID[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  clearCache: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_KEY = 'notifications_cache';
const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  enabled: true,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  maxItems: 100
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "07:00"
  },
  desktopNotifications: true,
  soundEnabled: true,
  grouping: true,
  retentionDays: 30
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useNotification(
  filters: NotificationFilters = {},
  cacheOptions: Partial<CacheOptions> = {}
): UseNotificationResult {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  // WebSocket connection for real-time updates
  const { isConnected, sendMessage, connectionHealth } = useWebSocket();

  // Cache configuration
  const cache = useMemo(() => ({
    ...DEFAULT_CACHE_OPTIONS,
    ...cacheOptions
  }), [cacheOptions]);

  // Refs for cleanup and batching
  const batchTimeout = useRef<NodeJS.Timeout>();
  const pendingUpdates = useRef<Notification[]>([]);

  /**
   * Initialize notification system
   */
  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        
        // Load cached notifications
        if (cache.enabled) {
          const cached = await localforage.getItem<Notification[]>(CACHE_KEY);
          if (cached) {
            setNotifications(cached);
          }
        }

        // Load user preferences
        const storedPrefs = await localforage.getItem<NotificationPreferences>('notification_preferences');
        if (storedPrefs) {
          setPreferences(storedPrefs);
        }

        // Fetch latest notifications
        await fetchNotifications();
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    init();
    return () => {
      if (batchTimeout.current) {
        clearTimeout(batchTimeout.current);
      }
    };
  }, [cache.enabled]);

  /**
   * Handle real-time notification updates
   */
  useEffect(() => {
    if (!isConnected) return;

    const handleNotification = (message: any) => {
      if (message.type === 'NOTIFICATION') {
        pendingUpdates.current.push(message.payload);
        
        // Batch updates for performance
        if (!batchTimeout.current) {
          batchTimeout.current = setTimeout(() => {
            setNotifications(prev => [...pendingUpdates.current, ...prev]);
            pendingUpdates.current = [];
            batchTimeout.current = undefined;
          }, 100);
        }
      }
    };

    sendMessage('SUBSCRIBE_NOTIFICATIONS', { filters });

    return () => {
      sendMessage('UNSUBSCRIBE_NOTIFICATIONS', {});
    };
  }, [isConnected, filters, sendMessage]);

  /**
   * Fetch notifications from API
   */
  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch notifications');
      
      const data = await response.json();
      setNotifications(data);

      // Update cache
      if (cache.enabled) {
        await localforage.setItem(CACHE_KEY, data);
      }
    } catch (err) {
      setError(err as Error);
    }
  };

  /**
   * Mark notifications as read
   */
  const markAsRead = async (ids: UUID | UUID[]) => {
    const idArray = Array.isArray(ids) ? ids : [ids];
    
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: idArray })
      });

      setNotifications(prev =>
        prev.map(notification =>
          idArray.includes(notification.id)
            ? { ...notification, read: true }
            : notification
        )
      );

      // Update cache
      if (cache.enabled) {
        await localforage.setItem(CACHE_KEY, notifications);
      }
    } catch (err) {
      setError(err as Error);
    }
  };

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      setNotifications(prev =>
        prev.map(notification => ({ ...notification, read: true }))
      );

      // Update cache
      if (cache.enabled) {
        await localforage.setItem(CACHE_KEY, notifications);
      }
    } catch (err) {
      setError(err as Error);
    }
  };

  /**
   * Clear all notifications
   */
  const clearNotifications = async () => {
    try {
      await fetch('/api/notifications/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      setNotifications([]);

      // Clear cache
      if (cache.enabled) {
        await localforage.removeItem(CACHE_KEY);
      }
    } catch (err) {
      setError(err as Error);
    }
  };

  /**
   * Update notification preferences
   */
  const updatePreferences = async (prefs: Partial<NotificationPreferences>) => {
    try {
      const newPreferences = { ...preferences, ...prefs };
      
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPreferences)
      });

      setPreferences(newPreferences);
      await localforage.setItem('notification_preferences', newPreferences);
    } catch (err) {
      setError(err as Error);
    }
  };

  /**
   * Clear notification cache
   */
  const clearCache = async () => {
    if (cache.enabled) {
      await localforage.removeItem(CACHE_KEY);
    }
  };

  // Calculate unread count
  const unreadCount = useMemo(() =>
    notifications.filter(n => !n.read).length,
    [notifications]
  );

  return {
    notifications,
    unreadCount,
    loading,
    error,
    preferences,
    connectionStatus: isConnected,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    updatePreferences,
    clearCache
  };
}

export type {
  Notification,
  NotificationPreferences,
  NotificationFilters,
  UseNotificationResult
};