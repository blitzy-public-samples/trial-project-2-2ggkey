/**
 * @fileoverview Notification system type definitions supporting real-time updates,
 * event-driven architecture, and advanced filtering capabilities
 * @version 1.0.0
 */

import { ApiResponse, UUID, ISO8601DateString } from './common.types';

// ============================================================================
// Enums
// ============================================================================

/**
 * Supported notification types in the system
 */
export enum NotificationType {
  EMAIL = 'EMAIL',
  IN_APP = 'IN_APP',
  SYSTEM = 'SYSTEM',
  TASK_UPDATE = 'TASK_UPDATE',
  PROJECT_UPDATE = 'PROJECT_UPDATE',
  MENTION = 'MENTION',
  COMMENT = 'COMMENT',
  DUE_DATE = 'DUE_DATE',
  ASSIGNMENT = 'ASSIGNMENT',
  CUSTOM = 'CUSTOM'
}

/**
 * Current status of a notification
 */
export enum NotificationStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  SENDING = 'SENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * Priority levels for notifications
 */
export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

/**
 * Types of actions that can be taken on notifications
 */
export enum NotificationActionType {
  VIEW = 'VIEW',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  ACKNOWLEDGE = 'ACKNOWLEDGE',
  CUSTOM = 'CUSTOM'
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Structured content for notifications with template support
 */
export interface NotificationContent {
  /** Title of the notification */
  title: string;
  
  /** Main notification message */
  message: string;
  
  /** Optional deep link URL for action */
  actionUrl: string | null;
  
  /** Type of action required */
  actionType: NotificationActionType | null;
  
  /** Additional structured content data */
  data: Record<string, unknown>;
  
  /** Optional template identifier */
  template: string | null;
  
  /** Template variables for dynamic content */
  variables: Record<string, string>;
}

/**
 * Comprehensive notification entity with scheduling and metadata support
 */
export interface Notification {
  /** Unique identifier for the notification */
  id: UUID;
  
  /** Type of notification */
  type: NotificationType;
  
  /** Current delivery status */
  status: NotificationStatus;
  
  /** Priority level */
  priority: NotificationPriority;
  
  /** Structured notification content */
  content: NotificationContent;
  
  /** Array of recipient user IDs */
  recipients: UUID[];
  
  /** Extensible metadata for custom properties */
  metadata: Record<string, unknown>;
  
  /** Creation timestamp */
  createdAt: ISO8601DateString;
  
  /** Last update timestamp */
  updatedAt: ISO8601DateString;
  
  /** Optional scheduled delivery time */
  scheduledFor: ISO8601DateString | null;
  
  /** Timestamp when notification was read */
  readAt: ISO8601DateString | null;
  
  /** Optional group ID for notification clustering */
  groupId: UUID | null;
}

/**
 * Notification preferences for a user
 */
export interface NotificationPreferences {
  /** Enabled notification types */
  enabledTypes: NotificationType[];
  
  /** Email notification settings */
  email: {
    enabled: boolean;
    frequency: 'immediate' | 'daily' | 'weekly';
    digestTime?: string;
  };
  
  /** In-app notification settings */
  inApp: {
    enabled: boolean;
    showBadge: boolean;
    soundEnabled: boolean;
  };
  
  /** Push notification settings */
  push: {
    enabled: boolean;
    devices: string[];
  };
  
  /** Do not disturb settings */
  doNotDisturb: {
    enabled: boolean;
    startTime?: string;
    endTime?: string;
    timezone: string;
  };
}

/**
 * Notification filter criteria
 */
export interface NotificationFilter {
  types?: NotificationType[];
  status?: NotificationStatus[];
  priority?: NotificationPriority[];
  startDate?: ISO8601DateString;
  endDate?: ISO8601DateString;
  read?: boolean;
  groupId?: UUID;
}

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Response type for notification API endpoints
 */
export type NotificationResponse = ApiResponse<Notification>;

/**
 * Response type for notification list endpoints
 */
export type NotificationListResponse = ApiResponse<{
  notifications: Notification[];
  unreadCount: number;
  totalCount: number;
}>;

/**
 * Notification event payload for WebSocket events
 */
export type NotificationEvent = {
  type: 'notification';
  action: 'created' | 'updated' | 'deleted';
  data: Notification;
  timestamp: ISO8601DateString;
};

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Type for creating a new notification
 */
export type CreateNotification = Omit<Notification, 'id' | 'createdAt' | 'updatedAt' | 'readAt'>;

/**
 * Type for updating an existing notification
 */
export type UpdateNotification = Partial<Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Type guard for checking if a value is a valid NotificationType
 */
export function isNotificationType(value: unknown): value is NotificationType {
  return Object.values(NotificationType).includes(value as NotificationType);
}

/**
 * Type guard for checking if a value is a valid NotificationStatus
 */
export function isNotificationStatus(value: unknown): value is NotificationStatus {
  return Object.values(NotificationStatus).includes(value as NotificationStatus);
}