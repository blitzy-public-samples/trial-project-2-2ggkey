/**
 * @fileoverview Enterprise-grade password reset page component with comprehensive
 * security features, accessibility compliance, and error handling
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { ErrorBoundary } from 'react-error-boundary';

import ResetPasswordForm from '../../components/auth/ResetPasswordForm';
import AuthLayout from '../../layouts/AuthLayout';
import useAuth from '../../hooks/useAuth';
import { validatePassword } from '../../utils/validation.utils';
import { ApiResponse } from '../../types/common.types';

// =============================================================================
// Types & Interfaces
// =============================================================================

interface ResetPasswordPageProps {
  /** Maximum allowed reset attempts */
  maxAttempts?: number;
  /** Token validity duration in minutes */
  tokenValidityDuration?: number;
}

interface TokenValidationResult {
  isValid: boolean;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_TOKEN_VALIDITY = 30; // minutes
const SECURITY_EVENT_CATEGORY = 'password_reset';

// =============================================================================
// Error Boundary Fallback
// =============================================================================

const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" className="error-container">
    <h2>Password Reset Error</h2>
    <p>We encountered an issue processing your password reset request.</p>
    <p>Please try again or contact support if the issue persists.</p>
    <pre style={{ display: 'none' }}>{error.message}</pre>
  </div>
);

// =============================================================================
// Component
// =============================================================================

/**
 * Secure password reset page component implementing comprehensive validation,
 * security monitoring, and accessibility features
 */
const ResetPassword: React.FC<ResetPasswordPageProps> = React.memo(({
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  tokenValidityDuration = DEFAULT_TOKEN_VALIDITY
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const { login } = useAuth();

  // Local state
  const [isValidating, setIsValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState<TokenValidationResult>({ isValid: false });
  const [attempts, setAttempts] = useState(0);

  // Extract and validate reset token
  const resetToken = searchParams.get('token');

  /**
   * Validates reset token with security checks
   */
  const validateResetToken = useCallback(async (token: string): Promise<TokenValidationResult> => {
    try {
      // Validate token format
      if (!token || typeof token !== 'string' || token.length < 32) {
        return { isValid: false, error: 'Invalid reset token format' };
      }

      // Check token expiration
      const tokenTimestamp = parseInt(atob(token.split('.')[1]), 10);
      const tokenAge = (Date.now() - tokenTimestamp) / 1000 / 60; // minutes
      
      if (tokenAge > tokenValidityDuration) {
        return { isValid: false, error: 'Reset token has expired' };
      }

      // Verify token with backend
      const response = await fetch('/api/v1/auth/verify-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data: ApiResponse<{ valid: boolean }> = await response.json();
      
      return {
        isValid: data.success && data.data.valid,
        error: !data.success ? data.error?.message : undefined
      };
    } catch (error) {
      console.error('Token validation error:', error);
      return { isValid: false, error: 'Failed to validate reset token' };
    }
  }, [tokenValidityDuration]);

  /**
   * Handles successful password reset
   */
  const handleResetSuccess = useCallback((message: string) => {
    // Track successful reset
    window.dispatchEvent(new CustomEvent('security-event', {
      detail: {
        category: SECURITY_EVENT_CATEGORY,
        action: 'reset_success'
      }
    }));

    enqueueSnackbar(message, { 
      variant: 'success',
      autoHideDuration: 5000,
      anchorOrigin: { vertical: 'top', horizontal: 'center' }
    });

    // Redirect to login
    navigate('/login', { replace: true });
  }, [navigate, enqueueSnackbar]);

  /**
   * Handles reset errors with security logging
   */
  const handleResetError = useCallback((error: string) => {
    setAttempts(prev => prev + 1);

    // Track failed attempt
    window.dispatchEvent(new CustomEvent('security-event', {
      detail: {
        category: SECURITY_EVENT_CATEGORY,
        action: 'reset_error',
        value: attempts + 1
      }
    }));

    enqueueSnackbar(error, {
      variant: 'error',
      autoHideDuration: 5000,
      anchorOrigin: { vertical: 'top', horizontal: 'center' }
    });
  }, [attempts, enqueueSnackbar]);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!resetToken) {
        setTokenValid({ isValid: false, error: 'No reset token provided' });
        setIsValidating(false);
        return;
      }

      const result = await validateResetToken(resetToken);
      setTokenValid(result);
      setIsValidating(false);

      // Track validation result
      window.dispatchEvent(new CustomEvent('security-event', {
        detail: {
          category: SECURITY_EVENT_CATEGORY,
          action: 'token_validation',
          value: result.isValid ? 1 : 0
        }
      }));
    };

    validateToken();
  }, [resetToken, validateResetToken]);

  // Show loading state
  if (isValidating) {
    return (
      <AuthLayout>
        <div role="status" aria-live="polite" className="loading-container">
          <p>Validating reset token...</p>
        </div>
      </AuthLayout>
    );
  }

  // Show error if token is invalid
  if (!tokenValid.isValid) {
    return (
      <AuthLayout>
        <div role="alert" className="error-container">
          <h2>Invalid Reset Link</h2>
          <p>{tokenValid.error || 'The password reset link is invalid or has expired.'}</p>
          <button 
            onClick={() => navigate('/forgot-password')}
            className="retry-button"
          >
            Request New Reset Link
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AuthLayout>
        <ResetPasswordForm
          token={resetToken!}
          onSuccess={handleResetSuccess}
          onError={handleResetError}
          maxAttempts={maxAttempts}
        />
      </AuthLayout>
    </ErrorBoundary>
  );
});

ResetPassword.displayName = 'ResetPassword';

export default ResetPassword;