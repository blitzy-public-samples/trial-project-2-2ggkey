/**
 * @fileoverview A secure and accessible password reset request form component
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form'; // ^7.0.0
import * as yup from 'yup'; // ^1.0.0
import classNames from 'classnames'; // ^2.3.2
import debounce from 'lodash/debounce'; // ^4.17.21

import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useTheme } from '../../hooks/useTheme';
import authApi from '../../api/authApi';

import styles from './ForgotPasswordForm.module.css';

// =============================================================================
// Types & Validation
// =============================================================================

interface ForgotPasswordFormProps {
  /** Callback function called after successful password reset request */
  onSuccess: () => void;
  /** Callback function called when an error occurs */
  onError: (error: Error) => void;
  /** Optional CSS class for styling */
  className?: string;
}

interface FormData {
  email: string;
}

// Email validation schema with security considerations
const validationSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email is too long')
    .matches(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Invalid email format'
    )
});

// =============================================================================
// Component
// =============================================================================

/**
 * A secure and accessible form component for handling password reset requests
 * through email verification. Implements comprehensive validation, error handling,
 * loading states, and follows WCAG 2.1 Level AA compliance guidelines.
 */
const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = React.memo(({
  onSuccess,
  onError,
  className
}) => {
  // Theme and form state
  const { currentTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Initialize form with validation
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset
  } = useForm<FormData>({
    mode: 'onBlur',
    defaultValues: {
      email: ''
    }
  });

  // Debounced submit handler to prevent rapid submissions
  const onSubmit = useCallback(
    debounce(async (data: FormData) => {
      setLoading(true);
      setSubmitError(null);

      try {
        const response = await authApi.forgotPassword(data.email);

        if (response.success) {
          setSubmitSuccess(true);
          reset();
          onSuccess();
        } else {
          throw new Error(response.error?.message || 'Password reset request failed');
        }
      } catch (error) {
        setSubmitError(error.message);
        setError('email', {
          type: 'manual',
          message: error.message
        });
        onError(error);
      } finally {
        setLoading(false);
      }
    }, 500),
    [onSuccess, onError, reset, setError]
  );

  return (
    <div
      className={classNames(
        styles.container,
        styles[`theme-${currentTheme}`],
        className
      )}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className={styles.form}
        noValidate
        aria-labelledby="forgotPasswordTitle"
      >
        <h1 id="forgotPasswordTitle" className={styles.title}>
          Reset Password
        </h1>

        <p className={styles.description}>
          Enter your email address and we'll send you instructions to reset your password.
        </p>

        <div className={styles.field}>
          <Input
            {...register('email')}
            type="email"
            label="Email Address"
            error={errors.email?.message}
            disabled={loading || submitSuccess}
            required
            autoComplete="email"
            autoFocus
            aria-describedby="emailHint emailError"
            data-testid="email-input"
          />
          <span id="emailHint" className={styles.hint}>
            We'll send a password reset link to this email address
          </span>
          {errors.email && (
            <span id="emailError" className={styles.error} role="alert">
              {errors.email.message}
            </span>
          )}
        </div>

        {submitError && (
          <div className={styles.submitError} role="alert">
            {submitError}
          </div>
        )}

        {submitSuccess && (
          <div className={styles.submitSuccess} role="status">
            Password reset instructions have been sent to your email.
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="large"
          fullWidth
          loading={loading}
          disabled={loading || submitSuccess}
          className={styles.submitButton}
          ariaLabel="Request password reset"
          dataTestId="submit-button"
        >
          {loading ? 'Sending...' : 'Reset Password'}
        </Button>
      </form>
    </div>
  );
});

ForgotPasswordForm.displayName = 'ForgotPasswordForm';

export default ForgotPasswordForm;

// CSS Module styles are defined in ForgotPasswordForm.module.css