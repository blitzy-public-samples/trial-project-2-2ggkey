/**
 * @fileoverview Comprehensive test suite for useAuth hook
 * @version 1.0.0
 * @package @testing-library/react-hooks@8.0.1
 * @package @testing-library/react@13.4.0
 * @package @reduxjs/toolkit@1.9.7
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import useAuth from '../../src/hooks/useAuth';
import { AuthErrorType, UserRole } from '../../src/types/auth.types';

// ============================================================================
// Test Setup
// ============================================================================

const mockUser = {
  id: '123',
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
      loginAlerts: true
    },
    language: 'en',
    sessionTimeout: 30,
    securityAlerts: true
  },
  lastLoginAt: '2024-01-01T00:00:00Z',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

const mockSecurityContext = {
  mfaEnabled: true,
  deviceTrusted: false,
  securityEvents: [],
  sessionStatus: 'active'
};

const mockStore = configureStore({
  reducer: {
    auth: (state = { user: null, error: null }, action) => {
      switch (action.type) {
        case 'AUTH_LOGIN_SUCCESS':
          return { ...state, user: action.payload };
        case 'AUTH_LOGOUT':
          return { ...state, user: null };
        case 'AUTH_ERROR':
          return { ...state, error: action.payload };
        default:
          return state;
      }
    }
  }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={mockStore}>{children}</Provider>
);

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key],
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// ============================================================================
// Test Suites
// ============================================================================

describe('useAuth', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  // ============================================================================
  // Login Tests
  // ============================================================================

  describe('login', () => {
    it('should handle successful login with MFA', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'password123'
        });
      });

      expect(result.current.mfaRequired).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should handle login failure with rate limiting', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Attempt multiple failed logins
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          await result.current.login({
            email: 'test@example.com',
            password: 'wrongpassword'
          });
        });
      }

      expect(result.current.error).toEqual({
        type: AuthErrorType.RATE_LIMITED,
        message: 'Maximum login attempts exceeded. Please try again later.'
      });
      expect(result.current.loading).toBe(false);
    });
  });

  // ============================================================================
  // MFA Tests
  // ============================================================================

  describe('MFA validation', () => {
    it('should validate MFA token successfully', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Setup initial login state
      mockStore.dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: { ...mockUser, mfaRequired: true } });

      await act(async () => {
        await result.current.validateMfa('123456');
      });

      expect(result.current.mfaRequired).toBe(false);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toBeTruthy();
    });

    it('should handle invalid MFA token', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.validateMfa('invalid');
      });

      expect(result.current.error).toEqual({
        type: AuthErrorType.MFA_INVALID,
        message: 'Invalid MFA token'
      });
    });
  });

  // ============================================================================
  // Device Trust Tests
  // ============================================================================

  describe('device trust', () => {
    it('should handle device trust validation', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock successful login with device trust
      await act(async () => {
        await result.current.login({
          email: 'test@example.com',
          password: 'password123',
          rememberMe: true
        });
      });

      expect(mockLocalStorage.getItem('device_trust')).toBeTruthy();
      expect(result.current.deviceTrusted).toBe(true);
    });

    it('should clear device trust on logout', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Set initial device trust
      mockLocalStorage.setItem('device_trust', JSON.stringify({
        deviceId: '123',
        timestamp: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
      }));

      await act(async () => {
        await result.current.logout();
      });

      expect(mockLocalStorage.getItem('device_trust')).toBeFalsy();
      expect(result.current.deviceTrusted).toBe(false);
    });
  });

  // ============================================================================
  // Token Management Tests
  // ============================================================================

  describe('token management', () => {
    it('should handle token refresh', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock initial authentication
      mockStore.dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: mockUser });

      // Fast-forward time to trigger token refresh
      jest.advanceTimersByTime(5 * 60 * 1000);

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it('should handle token rotation', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock initial authentication
      mockStore.dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: mockUser });

      // Fast-forward time to trigger token rotation
      jest.advanceTimersByTime(15 * 60 * 1000);

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.error).toBe(null);
    });
  });

  // ============================================================================
  // Session Management Tests
  // ============================================================================

  describe('session management', () => {
    it('should handle session timeout', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock initial authentication
      mockStore.dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: mockUser });

      // Fast-forward time to trigger session timeout
      jest.advanceTimersByTime(30 * 60 * 1000);

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBe(null);
    });

    it('should maintain session with activity', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock initial authentication
      mockStore.dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: mockUser });

      // Simulate user activity
      await act(async () => {
        // Trigger some authenticated action
        await result.current.hasPermission('read:tasks');
      });

      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  // ============================================================================
  // Permission Tests
  // ============================================================================

  describe('permissions', () => {
    it('should check permissions correctly', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Mock authenticated user with permissions
      mockStore.dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: mockUser });

      expect(result.current.hasPermission('read:tasks')).toBe(true);
      expect(result.current.hasPermission('admin:access')).toBe(false);
    });
  });
});