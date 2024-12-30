/**
 * @fileoverview Enhanced forgot password page component with comprehensive security features,
 * accessibility compliance, and performance optimizations
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.11.0
import { toast } from 'react-toastify'; // ^9.1.3
import classNames from 'classnames'; // ^2.3.2

import ForgotPasswordForm from '../../components/auth/ForgotPasswordForm';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import styles from './ForgotPassword.module.css';

/**
 * Enhanced forgot password page component with security monitoring and accessibility features
 */
const ForgotPassword: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { loading, trackSecurityEvent } = useAuth();
  const { currentTheme } = useTheme();

  // Track page access for security monitoring
  useEffect(() => {
    trackSecurityEvent({
      type: 'PAGE_ACCESS',
      context: 'FORGOT_PASSWORD',
      timestamp: new Date().toISOString()
    });
  }, [trackSecurityEvent]);

  /**
   * Handle successful password reset request with security logging
   */
  const handleSuccess = useCallback((email: string) => {
    // Track successful request
    trackSecurityEvent({
      type: 'PASSWORD_RESET_REQUEST',
      context: 'SUCCESS',
      metadata: { email },
      timestamp: new Date().toISOString()
    });

    // Show success message
    toast.success('Password reset instructions have been sent to your email', {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: false
    });

    // Navigate to login with success parameter
    navigate('/auth/login?reset=requested', { replace: true });
  }, [navigate, trackSecurityEvent]);

  /**
   * Enhanced error handler with security monitoring
   */
  const handleError = useCallback((error: Error) => {
    // Track error event
    trackSecurityEvent({
      type: 'PASSWORD_RESET_REQUEST',
      context: 'ERROR',
      metadata: { error: error.message },
      timestamp: new Date().toISOString()
    });

    // Show error message
    toast.error('Failed to request password reset. Please try again later.', {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: false
    });
  }, [trackSecurityEvent]);

  return (
    <div 
      className={classNames(
        styles.pageContainer,
        styles[`theme-${currentTheme}`]
      )}
      role="main"
      aria-labelledby="forgotPasswordTitle"
    >
      <div className={styles.contentWrapper}>
        <h1 
          id="forgotPasswordTitle" 
          className={styles.title}
          tabIndex={-1} // For focus management
        >
          Forgot Password
        </h1>

        <p className={styles.description}>
          Enter your email address and we'll send you instructions to reset your password.
        </p>

        <div 
          className={styles.formContainer}
          aria-busy={loading}
        >
          <ForgotPasswordForm
            onSuccess={handleSuccess}
            onError={handleError}
            className={styles.form}
          />
        </div>

        <button
          onClick={() => navigate('/auth/login')}
          className={styles.backButton}
          aria-label="Back to login"
        >
          ← Back to Login
        </button>
      </div>
    </div>
  );
});

// Display name for debugging
ForgotPassword.displayName = 'ForgotPassword';

export default ForgotPassword;

// CSS Module styles are defined in ForgotPassword.module.css