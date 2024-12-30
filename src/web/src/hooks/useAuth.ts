/**
 * @fileoverview Enhanced React hook for managing authentication state and operations
 * @version 1.0.0
 * @package react@18.2.0
 * @package react-redux@8.0.5
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import authApi, { AuthApi } from '../api/authApi';

// ============================================================================
// Types
// ============================================================================

interface LoginCredentials {
  email: string;
  password: string;
  deviceId?: string;
  rememberMe?: boolean;
}

interface AuthError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

interface User {
  id: string;
  email: string;
  name: string;
  mfaEnabled: boolean;
  lastLogin: string;
  securityPreferences: {
    mfaMethod: 'totp' | 'sms' | 'none';
    trustedDevices: boolean;
    loginNotifications: boolean;
    sessionTimeout: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const DEVICE_TRUST_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const TOKEN_ROTATION_INTERVAL = 15 * 60 * 1000; // 15 minutes

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Enhanced authentication hook with comprehensive security features
 */
export function useAuth() {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AuthError | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [deviceTrusted, setDeviceTrusted] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  
  // Refs for intervals and timeouts
  const refreshTokenInterval = useRef<NodeJS.Timeout>();
  const tokenRotationInterval = useRef<NodeJS.Timeout>();
  const sessionTimeout = useRef<NodeJS.Timeout>();

  // Get user from Redux store
  const user = useSelector((state: any) => state.auth.user);
  const permissions = useSelector((state: any) => state.auth.permissions);

  /**
   * Initialize security monitoring and session management
   */
  useEffect(() => {
    if (user) {
      // Set up token refresh interval
      refreshTokenInterval.current = setInterval(() => {
        authApi.refreshToken().catch(handleAuthError);
      }, TOKEN_REFRESH_INTERVAL);

      // Set up token rotation for enhanced security
      tokenRotationInterval.current = setInterval(() => {
        authApi.refreshToken().catch(handleAuthError);
      }, TOKEN_ROTATION_INTERVAL);

      // Set up session timeout based on user preferences
      if (user.securityPreferences.sessionTimeout) {
        sessionTimeout.current = setTimeout(() => {
          logout();
        }, user.securityPreferences.sessionTimeout);
      }

      // Check device trust status
      checkDeviceTrust();
    }

    return () => {
      // Clean up intervals and timeouts
      if (refreshTokenInterval.current) clearInterval(refreshTokenInterval.current);
      if (tokenRotationInterval.current) clearInterval(tokenRotationInterval.current);
      if (sessionTimeout.current) clearTimeout(sessionTimeout.current);
    };
  }, [user]);

  /**
   * Enhanced login with security features
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);

      // Check login attempts
      if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        throw new Error('Maximum login attempts exceeded. Please try again later.');
      }

      // Generate device fingerprint if not provided
      const deviceId = credentials.deviceId || generateDeviceFingerprint();

      const response = await authApi.login({ ...credentials, deviceId });

      if (response.success && response.data) {
        if (response.data.mfaRequired) {
          setMfaRequired(true);
          return;
        }

        dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: response.data });
        
        // Update device trust if remember me is enabled
        if (credentials.rememberMe) {
          updateDeviceTrust(deviceId);
        }

        setLoginAttempts(0);
      }
    } catch (err) {
      setLoginAttempts(prev => prev + 1);
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  }, [loginAttempts, dispatch]);

  /**
   * Validate MFA token
   */
  const validateMfa = useCallback(async (token: string) => {
    try {
      setLoading(true);
      setError(null);

      if (!user?.id) {
        throw new Error('User context not found');
      }

      const response = await authApi.validateMFA(token, user.id);

      if (response.success) {
        setMfaRequired(false);
        dispatch({ type: 'AUTH_MFA_SUCCESS' });
      }
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  }, [user, dispatch]);

  /**
   * Secure logout with cleanup
   */
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await authApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clean up security context
      clearSecurityContext();
      dispatch({ type: 'AUTH_LOGOUT' });
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Check if user has specific permission
   */
  const hasPermission = useCallback((permission: string): boolean => {
    return permissions?.includes(permission) || false;
  }, [permissions]);

  /**
   * Generate device fingerprint for security tracking
   */
  const generateDeviceFingerprint = (): string => {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset()
    ];
    return btoa(components.join('|'));
  };

  /**
   * Update device trust status
   */
  const updateDeviceTrust = (deviceId: string) => {
    try {
      localStorage.setItem('device_trust', JSON.stringify({
        deviceId,
        timestamp: Date.now(),
        expiresAt: Date.now() + DEVICE_TRUST_DURATION
      }));
      setDeviceTrusted(true);
    } catch (err) {
      console.error('Failed to update device trust:', err);
    }
  };

  /**
   * Check device trust status
   */
  const checkDeviceTrust = () => {
    try {
      const trust = localStorage.getItem('device_trust');
      if (trust) {
        const { expiresAt } = JSON.parse(trust);
        setDeviceTrusted(Date.now() < expiresAt);
      }
    } catch (err) {
      console.error('Failed to check device trust:', err);
      setDeviceTrusted(false);
    }
  };

  /**
   * Clear security context
   */
  const clearSecurityContext = () => {
    localStorage.removeItem('device_trust');
    setDeviceTrusted(false);
    setMfaRequired(false);
    setLoginAttempts(0);
  };

  /**
   * Handle authentication errors
   */
  const handleAuthError = (error: any) => {
    const authError: AuthError = {
      code: error.code || 'AUTH_ERROR',
      message: error.message || 'Authentication failed',
      details: error.details
    };
    setError(authError);

    // Handle critical security errors
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      clearSecurityContext();
      dispatch({ type: 'AUTH_ERROR', payload: authError });
    }
  };

  return {
    user,
    isAuthenticated: !!user,
    loading,
    error,
    mfaRequired,
    deviceTrusted,
    permissions,
    login,
    logout,
    validateMfa,
    hasPermission
  };
}

export default useAuth;