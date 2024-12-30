/**
 * @fileoverview Secure and accessible registration page component implementing
 * WCAG 2.1 Level AA compliance with comprehensive security features
 * @version 1.0.0
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.11.0
import RegisterForm from '../../components/auth/RegisterForm';
import { useAuth } from '../../hooks/useAuth';
import { AuthResponse } from '../../types/auth.types';
import styles from './Register.module.css';

// =============================================================================
// Security & Monitoring
// =============================================================================

const MAX_REGISTRATION_ATTEMPTS = 5;
const ATTEMPT_RESET_TIMEOUT = 30 * 60 * 1000; // 30 minutes

/**
 * Secure registration page component with WCAG compliance and security monitoring
 */
const Register: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { isAuthenticated, registerAttempts } = useAuth();
  const [securityError, setSecurityError] = useState<string | null>(null);

  // =============================================================================
  // Security Checks & Monitoring
  // =============================================================================

  useEffect(() => {
    // Redirect authenticated users
    if (isAuthenticated) {
      navigate('/dashboard');
      return;
    }

    // Check registration attempts
    if (registerAttempts >= MAX_REGISTRATION_ATTEMPTS) {
      setSecurityError('Too many registration attempts. Please try again later.');
    }

    // Initialize security monitoring
    const securityContext = {
      timestamp: Date.now(),
      deviceFingerprint: generateDeviceFingerprint(),
      referrer: document.referrer
    };

    // Log security event
    console.info('[Security] Registration page accessed:', securityContext);

    return () => {
      // Cleanup security monitoring
      console.info('[Security] Registration page exited');
    };
  }, [isAuthenticated, navigate, registerAttempts]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleRegistrationSuccess = useCallback((response: AuthResponse) => {
    // Log successful registration
    console.info('[Security] Registration successful:', {
      timestamp: Date.now(),
      userId: response.user.id
    });

    // Clear sensitive data
    window.history.replaceState({}, document.title, window.location.pathname);

    // Navigate to login
    navigate('/login', { 
      state: { 
        registrationSuccess: true,
        email: response.user.email 
      }
    });
  }, [navigate]);

  const handleRegistrationError = useCallback((error: any) => {
    // Log security event
    console.warn('[Security] Registration failed:', {
      timestamp: Date.now(),
      error: error.message,
      attempts: registerAttempts + 1
    });

    setSecurityError(error.message);
  }, [registerAttempts]);

  // =============================================================================
  // Security Utilities
  // =============================================================================

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

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div 
      className={styles['register-page']}
      role="main"
      aria-labelledby="register-title"
    >
      <div className={styles['register-container']}>
        <h1 
          id="register-title" 
          className={styles['register-header']}
          tabIndex={-1}
        >
          Create Account
        </h1>

        {/* Security Alert */}
        {securityError && (
          <div 
            className={styles['security-alert']}
            role="alert"
            aria-live="polite"
          >
            {securityError}
          </div>
        )}

        {/* Registration Form */}
        <div 
          className={styles['register-form-wrapper']}
          aria-labelledby="register-form-title"
        >
          <h2 
            id="register-form-title" 
            className="visually-hidden"
          >
            Registration Form
          </h2>

          <RegisterForm
            onSuccess={handleRegistrationSuccess}
            onError={handleRegistrationError}
          />
        </div>

        {/* Login Link */}
        <div className={styles['register-footer']}>
          <p>
            Already have an account?{' '}
            <a 
              href="/login"
              className={styles['login-link']}
              onClick={(e) => {
                e.preventDefault();
                navigate('/login');
              }}
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
});

Register.displayName = 'Register';

export default Register;