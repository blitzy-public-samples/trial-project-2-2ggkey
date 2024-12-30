/**
 * @fileoverview Root Redux store configuration with enhanced features including
 * real-time updates, performance monitoring, and strict type safety
 * @version 1.0.0
 * @package @reduxjs/toolkit@1.9.7
 * @package react-redux@8.1.0
 */

import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

// Import reducers
import authReducer from './slices/authSlice';
import taskReducer from './slices/taskSlice';
import projectReducer from './slices/projectSlice';
import notificationReducer from './slices/notificationSlice';

// ============================================================================
// Performance Monitoring Middleware
// ============================================================================

/**
 * Custom middleware for tracking store performance metrics
 */
const performanceMiddleware = () => (next: any) => (action: any) => {
  const start = performance.now();
  const result = next(action);
  const duration = performance.now() - start;

  // Log actions taking longer than 16ms (1 frame)
  if (duration > 16) {
    console.warn(`Slow action detected: ${action.type} took ${duration.toFixed(2)}ms`);
  }

  return result;
};

// ============================================================================
// Store Configuration
// ============================================================================

/**
 * Configure Redux store with enhanced middleware and development tools
 */
export const store = configureStore({
  reducer: {
    auth: authReducer,
    tasks: taskReducer,
    projects: projectReducer,
    notifications: notificationReducer
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    // Enable serializable check in development only
    serializableCheck: process.env.NODE_ENV === 'development',
    // Increase thunk timeout for complex operations
    thunk: {
      extraArgument: undefined,
      timeout: 10000 // 10 seconds
    },
    // Enable immutability check in development only
    immutableCheck: process.env.NODE_ENV === 'development'
  }).concat(performanceMiddleware),
  devTools: {
    // Configure Redux DevTools
    name: 'Task Management System',
    maxAge: 50, // Maximum number of actions to store
    trace: true, // Enable action stack trace
    traceLimit: 25, // Limit stack trace length
    // Sanitize actions and state for security
    actionSanitizer: (action) => {
      // Remove sensitive data from actions
      if (action.type?.includes('auth/')) {
        return { ...action, payload: '[REDACTED]' };
      }
      return action;
    },
    stateSanitizer: (state) => {
      // Remove sensitive data from state
      if (state.auth) {
        return {
          ...state,
          auth: {
            ...state.auth,
            user: state.auth.user ? { ...state.auth.user, token: '[REDACTED]' } : null
          }
        };
      }
      return state;
    }
  }
});

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Type definition for the complete application state
 */
export type RootState = ReturnType<typeof store.getState>;

/**
 * Type definition for the store's dispatch function
 */
export type AppDispatch = typeof store.dispatch;

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Type-safe dispatch hook with error tracking
 * @returns Typed dispatch function
 */
export const useAppDispatch = () => {
  const dispatch = useDispatch<AppDispatch>();
  return (action: any) => {
    try {
      return dispatch(action);
    } catch (error) {
      console.error('Dispatch error:', error);
      // Re-throw to maintain error chain
      throw error;
    }
  };
};

/**
 * Type-safe selector hook with performance optimization
 * @returns Typed selector hook
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = (selector) => {
  try {
    const startTime = performance.now();
    const result = useSelector(selector);
    const duration = performance.now() - startTime;

    // Log slow selectors in development
    if (process.env.NODE_ENV === 'development' && duration > 5) {
      console.warn(`Slow selector detected: ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    console.error('Selector error:', error);
    throw error;
  }
};

// ============================================================================
// Store Monitoring
// ============================================================================

// Monitor store performance in development
if (process.env.NODE_ENV === 'development') {
  store.subscribe(() => {
    const state = store.getState();
    const stateSize = new TextEncoder().encode(JSON.stringify(state)).length;
    
    // Warn if state size exceeds 1MB
    if (stateSize > 1024 * 1024) {
      console.warn(`Large state detected: ${(stateSize / (1024 * 1024)).toFixed(2)}MB`);
    }
  });
}

export default store;