/**
 * @fileoverview Test suite for Redux auth slice with enhanced security features
 * @version 1.0.0
 * @package @reduxjs/toolkit@1.9.7
 * @package @jest/globals@29.0.0
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import reducer, {
  login,
  register,
  logout,
  refreshToken,
  validateMfa,
  actions,
} from '../../src/store/slices/authSlice';
import { 
  AuthState, 
  AuthErrorType, 
  UserRole,
  DEFAULT_SESSION_TIMEOUT 
} from '../../types/auth.types';

// ============================================================================
// Test Setup
// ============================================================================

/**
 * Creates a test store with security middleware
 */
const setupSecureStore = () => {
  return configureStore({
    reducer: { auth: reducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore these action types for non-serializable values
          ignoredActions: ['auth/login/fulfilled', 'auth/refreshToken/fulfilled'],
        },
      }),
  });
};

/**
 * Mock security context for testing
 */
const mockSecurityContext = () => ({
  deviceId: 'test-device-123',
  sessionId: 'test-session-456',
  timestamp: Date.now(),
  userAgent: 'test-agent',
});

/**
 * Mock MFA credentials for testing
 */
const mockMfaCredentials = () => ({
  totpCode: '123456',
  deviceId: 'test-device-123',
  timestamp: Date.now(),
});

// Initial state for testing
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  mfaPending: false,
  sessionExpiry: null,
};

// Mock user data
const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: UserRole.USER,
  permissions: ['read:tasks', 'write:tasks'],
  mfaEnabled: true,
  preferences: {
    theme: 'light',
    notifications: {
      email: true,
      browser: true,
      securityAlerts: true,
      loginAlerts: true,
    },
    language: 'en',
    sessionTimeout: DEFAULT_SESSION_TIMEOUT,
    securityAlerts: true,
  },
  lastLoginAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Auth Slice Tests
// ============================================================================

describe('Auth Slice Tests', () => {
  let store: ReturnType<typeof setupSecureStore>;

  beforeEach(() => {
    store = setupSecureStore();
    jest.clearAllMocks();
  });

  // ============================================================================
  // Reducer Tests
  // ============================================================================

  describe('Auth Reducers', () => {
    test('should handle initial state', () => {
      expect(reducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    test('should handle clearError', () => {
      const state = {
        ...initialState,
        error: { type: AuthErrorType.INVALID_CREDENTIALS, message: 'Error', timestamp: Date.now() },
      };
      expect(reducer(state, actions.clearError())).toEqual({
        ...state,
        error: null,
      });
    });

    test('should handle updateSessionExpiry', () => {
      const expiryTime = Date.now() + 3600000;
      expect(reducer(initialState, actions.updateSessionExpiry(expiryTime))).toEqual({
        ...initialState,
        sessionExpiry: expiryTime,
      });
    });

    test('should handle resetAuth', () => {
      const state = {
        ...initialState,
        user: mockUser,
        isAuthenticated: true,
      };
      expect(reducer(state, actions.resetAuth())).toEqual(initialState);
    });
  });

  // ============================================================================
  // Authentication Flow Tests
  // ============================================================================

  describe('Authentication Flow', () => {
    test('should handle successful login without MFA', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'Test123!',
        deviceId: mockSecurityContext().deviceId,
      };

      const mockResponse = {
        user: mockUser,
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
        mfaRequired: false,
      };

      // @ts-ignore - Partial mock implementation
      login.fulfilled.match = jest.fn().mockReturnValue(true);
      await store.dispatch(login.fulfilled(mockResponse, 'requestId', credentials));

      const state = store.getState().auth;
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    test('should handle login with MFA requirement', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'Test123!',
        deviceId: mockSecurityContext().deviceId,
      };

      const mockResponse = {
        mfaRequired: true,
        email: credentials.email,
      };

      // @ts-ignore - Partial mock implementation
      login.fulfilled.match = jest.fn().mockReturnValue(true);
      await store.dispatch(login.fulfilled(mockResponse, 'requestId', credentials));

      const state = store.getState().auth;
      expect(state.mfaPending).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(state.loading).toBe(false);
    });

    test('should handle successful MFA validation', async () => {
      const mfaCredentials = mockMfaCredentials();
      const mockResponse = {
        ...mockUser,
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
      };

      // @ts-ignore - Partial mock implementation
      validateMfa.fulfilled.match = jest.fn().mockReturnValue(true);
      await store.dispatch(validateMfa.fulfilled(mockResponse, 'requestId', mfaCredentials.totpCode));

      const state = store.getState().auth;
      expect(state.isAuthenticated).toBe(true);
      expect(state.mfaPending).toBe(false);
      expect(state.user).toBeTruthy();
    });
  });

  // ============================================================================
  // Security Feature Tests
  // ============================================================================

  describe('Security Features', () => {
    test('should handle token refresh', async () => {
      const mockResponse = {
        accessToken: 'new-test-token',
        refreshToken: 'new-test-refresh-token',
        expiresIn: 3600,
      };

      // @ts-ignore - Partial mock implementation
      refreshToken.fulfilled.match = jest.fn().mockReturnValue(true);
      await store.dispatch(refreshToken.fulfilled(mockResponse, 'requestId', undefined));

      const state = store.getState().auth;
      expect(state.sessionExpiry).toBeTruthy();
      expect(state.error).toBeNull();
    });

    test('should handle secure logout', async () => {
      // Setup authenticated state
      store = setupSecureStore();
      store.dispatch(login.fulfilled({
        user: mockUser,
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
        mfaRequired: false,
      }, 'requestId', {}));

      // @ts-ignore - Partial mock implementation
      logout.fulfilled.match = jest.fn().mockReturnValue(true);
      await store.dispatch(logout.fulfilled(undefined, 'requestId', undefined));

      const state = store.getState().auth;
      expect(state).toEqual(initialState);
    });

    test('should handle session timeout', () => {
      const state = {
        ...initialState,
        sessionExpiry: Date.now() - 1000, // Expired session
      };
      
      expect(reducer(state, actions.resetAuth())).toEqual(initialState);
    });

    test('should handle authentication errors', async () => {
      const error = {
        type: AuthErrorType.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
        timestamp: Date.now(),
      };

      // @ts-ignore - Partial mock implementation
      login.rejected.match = jest.fn().mockReturnValue(true);
      await store.dispatch(login.rejected(error, 'requestId', {}, error));

      const state = store.getState().auth;
      expect(state.error).toEqual(error);
      expect(state.isAuthenticated).toBe(false);
      expect(state.loading).toBe(false);
    });
  });

  // ============================================================================
  // Registration Tests
  // ============================================================================

  describe('Registration Flow', () => {
    test('should handle successful registration', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'Test123!',
        name: 'Test User',
        confirmPassword: 'Test123!',
        acceptTerms: true,
        captchaToken: 'test-captcha',
      };

      const mockResponse = {
        user: mockUser,
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
        mfaRequired: false,
      };

      // @ts-ignore - Partial mock implementation
      register.fulfilled.match = jest.fn().mockReturnValue(true);
      await store.dispatch(register.fulfilled(mockResponse, 'requestId', credentials));

      const state = store.getState().auth;
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});