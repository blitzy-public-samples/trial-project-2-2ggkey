/**
 * @fileoverview Enhanced login page component with comprehensive security features,
 * accessibility support, and theme integration
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import LoginForm from '../../components/auth/LoginForm';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

// Constants
const DASHBOARD_ROUTE = '/dashboard';
const MAX_LOGIN_ATTEMPTS = 5;
const MFA_TIMEOUT_MS = 300000; // 5 minutes
const RATE_LIMIT_WINDOW_MS = 3600000; // 1 hour

// Styled Components
const LoginContainer = styled.div<{ theme: any }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: ${({ theme }) => theme.spacing.lg};
  background-color: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  transition: background-color 0.3s ease, color 0.3s ease;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.md};
  }
`;

const LoginCard = styled.div<{ theme: any }>`
  width: 100%;
  max-width: 400px;
  padding: ${({ theme }) => theme.spacing.xl};
  background: ${({ theme }) => theme.colors.background};
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  position: relative;
  overflow: hidden;

  @media (max-width: ${({ theme }) => theme.breakpoints.mobile}) {
    padding: ${({ theme }) => theme.spacing.lg};
    box-shadow: none;
  }
`;

const SecurityInfo = styled.div<{ theme: any }>`
  margin-top: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm};
  font-size: 0.875rem;
  color: ${({ theme }) => theme.colors.secondary};
  text-align: center;
`;

/**
 * Enhanced Login page component with security features and accessibility
 */
const Login: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { isAuthenticated, validateDevice } = useAuth();
  const { currentTheme } = useTheme();
  
  // Local state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaTimeout, setMfaTimeout] = useState<NodeJS.Timeout>();
  const [deviceTrustChecked, setDeviceTrustChecked] = useState(false);

  /**
   * Redirect to dashboard if already authenticated
   */
  useEffect(() => {
    if (isAuthenticated && deviceTrustChecked) {
      navigate(DASHBOARD_ROUTE, { replace: true });
    }
  }, [isAuthenticated, deviceTrustChecked, navigate]);

  /**
   * Handle MFA timeout
   */
  useEffect(() => {
    if (mfaRequired) {
      const timeout = setTimeout(() => {
        setMfaRequired(false);
      }, MFA_TIMEOUT_MS);
      
      setMfaTimeout(timeout);
      return () => clearTimeout(timeout);
    }
  }, [mfaRequired]);

  /**
   * Handle successful login with device trust validation
   */
  const handleLoginSuccess = useCallback(async () => {
    try {
      // Validate device trust status
      const deviceTrusted = await validateDevice();
      setDeviceTrustChecked(true);

      if (deviceTrusted) {
        navigate(DASHBOARD_ROUTE, { replace: true });
      } else {
        setMfaRequired(true);
      }
    } catch (error) {
      console.error('Device trust validation failed:', error);
      setMfaRequired(true);
    }
  }, [navigate, validateDevice]);

  /**
   * Handle MFA requirement
   */
  const handleMFARequired = useCallback(() => {
    setMfaRequired(true);
  }, []);

  /**
   * Handle login error
   */
  const handleLoginError = useCallback((error: Error) => {
    // Log security event
    console.error('Login error:', {
      timestamp: new Date().toISOString(),
      error: error.message,
      // Exclude sensitive information from logs
      metadata: {
        userAgent: window.navigator.userAgent,
        timestamp: Date.now()
      }
    });
  }, []);

  return (
    <LoginContainer theme={currentTheme}>
      <LoginCard theme={currentTheme} role="main" aria-labelledby="login-title">
        <LoginForm
          onSuccess={handleLoginSuccess}
          onMFARequired={handleMFARequired}
          onError={handleLoginError}
          maxAttempts={MAX_LOGIN_ATTEMPTS}
          rateLimitWindow={RATE_LIMIT_WINDOW_MS}
        />

        {mfaRequired && (
          <SecurityInfo theme={currentTheme} role="alert" aria-live="polite">
            Additional verification required for enhanced security.
            Please check your authentication device.
          </SecurityInfo>
        )}

        <SecurityInfo theme={currentTheme}>
          This login is protected by advanced security measures including
          multi-factor authentication and device trust validation.
        </SecurityInfo>
      </LoginCard>
    </LoginContainer>
  );
});

// Display name for debugging
Login.displayName = 'Login';

export default Login;