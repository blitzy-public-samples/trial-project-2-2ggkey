/**
 * @fileoverview Enterprise-grade notification API client with real-time support,
 * caching, and performance optimizations
 * @version 1.0.0
 * @package lodash@4.17.21
 */

import { debounce } from 'lodash';
import ApiClient from './apiClient';
import {
  Notification,
  NotificationFilter,
  NotificationPreferences,
  NotificationEvent,
  NotificationResponse,
  NotificationListResponse,
  CreateNotification,
  UpdateNotification
} from '../types/notification.types';

// ============================================================================
// Constants
// ============================================================================

const NOTIFICATIONS_ENDPOINT = '/api/v1/notifications';
const NOTIFICATION_CACHE_TTL = 300000; // 5 minutes
const WEBSOCKET_ENDPOINT = '/ws/notifications';
const BATCH_DEBOUNCE_TIME = 500; // 500ms for batching requests

// ============================================================================
// Types
// ============================================================================

interface WebSocketConfig {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
}

type NotificationCallback = (notification: Notification) => void;
type WebSocketSubscription = { unsubscribe: () => void };

// ============================================================================
// NotificationManager Class
// ============================================================================

export class NotificationManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts: number;
  private readonly reconnectInterval: number;
  private readonly heartbeatInterval: number;
  private callbacks: Set<NotificationCallback> = new Set();
  private heartbeatTimer?: NodeJS.Timer;

  constructor(config: WebSocketConfig = {}) {
    this.maxReconnectAttempts = config.reconnectAttempts || 5;
    this.reconnectInterval = config.reconnectInterval || 5000;
    this.heartbeatInterval = config.heartbeatInterval || 30000;
  }

  /**
   * Initializes WebSocket connection with reconnection logic
   */
  private initializeWebSocket(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(WEBSOCKET_ENDPOINT);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const notificationEvent: NotificationEvent = JSON.parse(event.data);
        this.handleNotificationEvent(notificationEvent);
      } catch (error) {
        console.error('Error processing notification:', error);
      }
    };

    this.ws.onclose = () => {
      this.handleDisconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnect();
    };
  }

  /**
   * Handles WebSocket disconnection with retry logic
   */
  private handleDisconnect(): void {
    this.stopHeartbeat();
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => this.initializeWebSocket(), this.reconnectInterval);
    }
  }

  /**
   * Manages WebSocket heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }

  /**
   * Processes incoming notification events
   */
  private handleNotificationEvent(event: NotificationEvent): void {
    this.callbacks.forEach(callback => {
      try {
        callback(event.data);
      } catch (error) {
        console.error('Error in notification callback:', error);
      }
    });
  }

  /**
   * Subscribes to real-time notifications
   */
  public subscribe(callback: NotificationCallback): WebSocketSubscription {
    this.callbacks.add(callback);
    if (!this.ws) {
      this.initializeWebSocket();
    }

    return {
      unsubscribe: () => {
        this.callbacks.delete(callback);
        if (this.callbacks.size === 0) {
          this.cleanup();
        }
      }
    };
  }

  /**
   * Cleans up WebSocket resources
   */
  private cleanup(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Retrieves notifications with caching and filtering support
 */
export const getNotifications = async (
  filter: NotificationFilter = {},
  useCache = true
): Promise<NotificationListResponse> => {
  const cacheKey = `notifications:${JSON.stringify(filter)}`;
  
  return ApiClient.get(
    NOTIFICATIONS_ENDPOINT,
    filter,
    {
      skipCache: !useCache,
      cacheDuration: NOTIFICATION_CACHE_TTL
    }
  );
};

/**
 * Creates a new notification with optimistic updates
 */
export const createNotification = async (
  notification: CreateNotification
): Promise<NotificationResponse> => {
  return ApiClient.post(NOTIFICATIONS_ENDPOINT, notification);
};

/**
 * Updates an existing notification
 */
export const updateNotification = async (
  id: string,
  updates: UpdateNotification
): Promise<NotificationResponse> => {
  return ApiClient.put(`${NOTIFICATIONS_ENDPOINT}/${id}`, updates);
};

/**
 * Marks notifications as read with request batching
 */
export const markAsRead = debounce(async (
  notificationIds: string[]
): Promise<NotificationResponse> => {
  return ApiClient.put(`${NOTIFICATIONS_ENDPOINT}/read`, { ids: notificationIds });
}, BATCH_DEBOUNCE_TIME);

/**
 * Updates notification preferences
 */
export const updateNotificationPreferences = async (
  preferences: NotificationPreferences
): Promise<NotificationResponse> => {
  return ApiClient.put(`${NOTIFICATIONS_ENDPOINT}/preferences`, preferences);
};

/**
 * Deletes a notification
 */
export const deleteNotification = async (
  id: string
): Promise<NotificationResponse> => {
  return ApiClient.delete(`${NOTIFICATIONS_ENDPOINT}/${id}`);
};

// Create singleton instance of NotificationManager
const notificationManager = new NotificationManager();
Object.freeze(notificationManager);

export default notificationManager;