/**
 * @fileoverview A secure and accessible authentication form component with MFA support
 * @version 1.0.0
 * @package react@18.2.0
 * @package react-hook-form@7.0.0
 * @package yup@1.0.0
 * @package @fingerprintjs/fingerprintjs@3.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { useAuth } from '../../hooks/useAuth';
import Button from '../common/Button';
import Input from '../common/Input';
import styles from './LoginForm.module.css';

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface LoginFormProps {
  onSuccess?: () => void;
  onMFARequired?: () => void;
}

interface LoginFormData {
  email: string;
  password: string;
  deviceFingerprint?: string;
}

// =============================================================================
// Validation Schema
// =============================================================================

const loginSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format')
    .max(255, 'Email must not exceed 255 characters'),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
});

// =============================================================================
// Component
// =============================================================================

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onMFARequired }) => {
  // Hooks
  const { login, loading, error, validateMFA, checkDeviceTrust } = useAuth();
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<LoginFormData>({
    mode: 'onChange',
    resolver: yup.resolver(loginSchema),
  });

  // =============================================================================
  // Effects
  // =============================================================================

  // Initialize device fingerprinting
  useEffect(() => {
    const initializeFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setDeviceFingerprint(result.visitorId);
      } catch (error) {
        console.error('Failed to initialize fingerprint:', error);
      }
    };

    initializeFingerprint();
  }, []);

  // Handle account lockout
  useEffect(() => {
    if (loginAttempts >= 5) {
      setIsLocked(true);
      const unlockTimeout = setTimeout(() => {
        setIsLocked(false);
        setLoginAttempts(0);
      }, 30 * 60 * 1000); // 30 minutes lockout

      return () => clearTimeout(unlockTimeout);
    }
  }, [loginAttempts]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      if (isLocked) {
        return;
      }

      try {
        clearErrors();
        const response = await login({
          email: data.email,
          password: data.password,
          deviceFingerprint,
        });

        if (response?.mfaRequired) {
          onMFARequired?.();
          return;
        }

        // Check device trust status
        await checkDeviceTrust(deviceFingerprint);
        onSuccess?.();
      } catch (err: any) {
        setLoginAttempts((prev) => prev + 1);
        setError('root', {
          type: 'manual',
          message: err.message || 'Authentication failed',
        });
      }
    },
    [
      isLocked,
      login,
      deviceFingerprint,
      onMFARequired,
      onSuccess,
      checkDeviceTrust,
      setError,
      clearErrors,
    ]
  );

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={styles.loginForm}
      noValidate
      aria-labelledby="login-heading"
    >
      <h1 id="login-heading" className={styles.heading}>
        Sign In
      </h1>

      {isLocked && (
        <div
          className={styles.lockoutMessage}
          role="alert"
          aria-live="assertive"
        >
          Account temporarily locked. Please try again later.
        </div>
      )}

      {error && (
        <div
          className={styles.errorMessage}
          role="alert"
          aria-live="assertive"
        >
          {error.message}
        </div>
      )}

      <Input
        {...register('email')}
        type="email"
        label="Email"
        error={errors.email?.message}
        autoComplete="email"
        disabled={isLocked || loading}
        required
        aria-required="true"
        data-testid="email-input"
      />

      <Input
        {...register('password')}
        type={showPassword ? 'text' : 'password'}
        label="Password"
        error={errors.password?.message}
        autoComplete="current-password"
        disabled={isLocked || loading}
        required
        aria-required="true"
        data-testid="password-input"
        endAdornment={
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className={styles.passwordToggle}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? '👁️' : '👁️‍🗨️'}
          </button>
        }
      />

      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={loading}
        disabled={isLocked || loading}
        ariaLabel="Sign in"
        data-testid="submit-button"
      >
        Sign In
      </Button>

      <div className={styles.securityInfo} aria-live="polite">
        {loginAttempts > 0 && (
          <p>
            Failed attempts: {loginAttempts}/5
            {loginAttempts >= 3 && (
              <span className={styles.warning}>
                Warning: Account will be locked after 5 failed attempts
              </span>
            )}
          </p>
        )}
      </div>
    </form>
  );
};

export default React.memo(LoginForm);