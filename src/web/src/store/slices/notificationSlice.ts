/**
 * @fileoverview Redux slice for managing notification state with enhanced features
 * including real-time updates, optimistic updates, error handling, and performance optimizations
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  Notification, 
  NotificationPreferences, 
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  NotificationFilter,
  NotificationResponse,
  NotificationListResponse,
  NotificationEvent
} from '../../types/notification.types';
import { UUID, ISO8601DateString } from '../../types/common.types';

// ============================================================================
// Types
// ============================================================================

interface LoadingState {
  fetch: boolean;
  update: boolean;
  markAsRead: boolean;
  preferences: boolean;
}

interface ErrorState {
  code: string | null;
  message: string | null;
  retryCount: number;
  lastRetry: ISO8601DateString | null;
}

interface NotificationState {
  notifications: Record<string, Notification[]>;
  unreadCount: number;
  preferences: NotificationPreferences;
  loading: LoadingState;
  error: ErrorState;
  offline: boolean;
  lastSync: ISO8601DateString | null;
  selectedGroupId: UUID | null;
}

interface FetchOptions extends NotificationFilter {
  forceRefresh?: boolean;
  page?: number;
  pageSize?: number;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: NotificationState = {
  notifications: {},
  unreadCount: 0,
  preferences: {
    enabledTypes: Object.values(NotificationType),
    email: {
      enabled: true,
      frequency: 'immediate'
    },
    inApp: {
      enabled: true,
      showBadge: true,
      soundEnabled: true
    },
    push: {
      enabled: true,
      devices: []
    },
    doNotDisturb: {
      enabled: false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  },
  loading: {
    fetch: false,
    update: false,
    markAsRead: false,
    preferences: false
  },
  error: {
    code: null,
    message: null,
    retryCount: 0,
    lastRetry: null
  },
  offline: false,
  lastSync: null,
  selectedGroupId: null
};

// ============================================================================
// Async Thunks
// ============================================================================

/**
 * Fetches notifications with advanced filtering and caching
 */
export const fetchNotifications = createAsyncThunk<
  NotificationListResponse,
  FetchOptions
>(
  'notifications/fetchNotifications',
  async (options, { rejectWithValue, getState }) => {
    try {
      const { offline, lastSync } = getState() as { notifications: NotificationState };
      
      // Return cached data if offline
      if (offline && !options.forceRefresh) {
        return {
          success: true,
          data: {
            notifications: Object.values(getState().notifications.notifications).flat(),
            unreadCount: getState().notifications.unreadCount,
            totalCount: Object.values(getState().notifications.notifications).flat().length
          },
          error: null,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          requestId: crypto.randomUUID()
        };
      }

      // Add If-Modified-Since header if we have lastSync
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (lastSync) {
        headers['If-Modified-Since'] = lastSync;
      }

      const response = await fetch('/api/v1/notifications', {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: NotificationListResponse = await response.json();
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Updates notification preferences with optimistic updates
 */
export const updatePreferences = createAsyncThunk<
  NotificationPreferences,
  Partial<NotificationPreferences>
>(
  'notifications/updatePreferences',
  async (preferences, { getState, rejectWithValue }) => {
    try {
      const response = await fetch('/api/v1/notifications/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// ============================================================================
// Slice Definition
// ============================================================================

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /**
     * Handles real-time notification updates
     */
    handleNotificationEvent(state, action: PayloadAction<NotificationEvent>) {
      const { action: eventAction, data: notification } = action.payload;
      const date = new Date(notification.createdAt).toDateString();

      switch (eventAction) {
        case 'created':
          if (!state.notifications[date]) {
            state.notifications[date] = [];
          }
          state.notifications[date].unshift(notification);
          if (notification.status !== NotificationStatus.READ) {
            state.unreadCount++;
          }
          break;

        case 'updated':
          Object.keys(state.notifications).forEach(date => {
            const index = state.notifications[date].findIndex(n => n.id === notification.id);
            if (index !== -1) {
              const oldStatus = state.notifications[date][index].status;
              state.notifications[date][index] = notification;
              if (oldStatus !== NotificationStatus.READ && notification.status === NotificationStatus.READ) {
                state.unreadCount = Math.max(0, state.unreadCount - 1);
              }
            }
          });
          break;

        case 'deleted':
          Object.keys(state.notifications).forEach(date => {
            const index = state.notifications[date].findIndex(n => n.id === notification.id);
            if (index !== -1) {
              if (state.notifications[date][index].status !== NotificationStatus.READ) {
                state.unreadCount = Math.max(0, state.unreadCount - 1);
              }
              state.notifications[date].splice(index, 1);
            }
          });
          break;
      }
    },

    /**
     * Updates offline status
     */
    setOfflineStatus(state, action: PayloadAction<boolean>) {
      state.offline = action.payload;
    },

    /**
     * Selects a notification group
     */
    selectNotificationGroup(state, action: PayloadAction<UUID | null>) {
      state.selectedGroupId = action.payload;
    },

    /**
     * Clears all errors
     */
    clearErrors(state) {
      state.error = {
        code: null,
        message: null,
        retryCount: 0,
        lastRetry: null
      };
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications reducers
      .addCase(fetchNotifications.pending, (state) => {
        state.loading.fetch = true;
        state.error = { ...initialState.error };
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading.fetch = false;
        state.lastSync = action.payload.timestamp;
        state.unreadCount = action.payload.data.unreadCount;
        
        // Group notifications by date
        const grouped = action.payload.data.notifications.reduce((acc, notification) => {
          const date = new Date(notification.createdAt).toDateString();
          if (!acc[date]) {
            acc[date] = [];
          }
          acc[date].push(notification);
          return acc;
        }, {} as Record<string, Notification[]>);
        
        state.notifications = grouped;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading.fetch = false;
        state.error = {
          code: 'FETCH_ERROR',
          message: action.payload as string,
          retryCount: state.error.retryCount + 1,
          lastRetry: new Date().toISOString()
        };
      })

      // Update preferences reducers
      .addCase(updatePreferences.pending, (state) => {
        state.loading.preferences = true;
      })
      .addCase(updatePreferences.fulfilled, (state, action) => {
        state.loading.preferences = false;
        state.preferences = action.payload;
      })
      .addCase(updatePreferences.rejected, (state, action) => {
        state.loading.preferences = false;
        state.error = {
          code: 'PREFERENCES_ERROR',
          message: action.payload as string,
          retryCount: state.error.retryCount + 1,
          lastRetry: new Date().toISOString()
        };
      });
  }
});

// ============================================================================
// Exports
// ============================================================================

export const {
  handleNotificationEvent,
  setOfflineStatus,
  selectNotificationGroup,
  clearErrors
} = notificationSlice.actions;

export default notificationSlice.reducer;