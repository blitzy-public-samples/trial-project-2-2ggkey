/**
 * @fileoverview A secure and accessible registration form component implementing 
 * comprehensive validation, real-time error handling, and WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

import React, { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form'; // v7.45.0
import { yupResolver } from '@hookform/resolvers/yup'; // v3.1.0

// Internal imports
import { RegisterCredentials } from '../../types/auth.types';
import { authValidationSchemas } from '../../utils/validation.utils';
import AuthApi from '../../api/authApi';
import Button from '../common/Button';
import Input from '../common/Input';

import styles from './RegisterForm.module.css';

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface RegisterFormProps {
  /** Callback function called after successful registration */
  onSuccess: (response: any) => void;
  /** Callback function called on registration error */
  onError: (error: any) => void;
}

// =============================================================================
// Component
// =============================================================================

const RegisterForm: React.FC<RegisterFormProps> = React.memo(({ onSuccess, onError }) => {
  // Form state management with validation
  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset
  } = useForm<RegisterCredentials>({
    resolver: yupResolver(authValidationSchemas.registerSchema),
    mode: 'onChange'
  });

  // Local state for API errors
  const [apiError, setApiError] = useState<string | null>(null);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleSubmit = useCallback(async (data: RegisterCredentials) => {
    try {
      setApiError(null);

      // Generate CAPTCHA token (implementation depends on your CAPTCHA service)
      const captchaToken = await generateCaptchaToken();
      
      // Make API call with enhanced security
      const response = await AuthApi.register({
        ...data,
        captchaToken
      });

      if (response.success) {
        reset(); // Clear form on success
        onSuccess(response.data);
      } else {
        setApiError(response.error?.message || 'Registration failed');
        onError(response.error);
      }
    } catch (error: any) {
      const errorMessage = error.message || 'An unexpected error occurred';
      setApiError(errorMessage);
      onError(error);
    }
  }, [reset, onSuccess, onError]);

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const renderField = useCallback((
    name: keyof RegisterCredentials,
    label: string,
    type: string = 'text',
    autoComplete: string = 'off'
  ) => (
    <div className={styles['form-field']}>
      <Input
        {...register(name)}
        type={type}
        label={label}
        error={errors[name]?.message}
        autoComplete={autoComplete}
        aria-invalid={!!errors[name]}
        aria-describedby={`${name}-error`}
        data-testid={`register-${name}-input`}
      />
    </div>
  ), [register, errors]);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <form 
      onSubmit={handleFormSubmit(handleSubmit)}
      className={styles['register-form']}
      noValidate
      aria-label="Registration form"
    >
      {/* Name field */}
      {renderField('name', 'Full Name', 'text', 'name')}

      {/* Email field */}
      {renderField('email', 'Email Address', 'email', 'email')}

      {/* Password field */}
      {renderField('password', 'Password', 'password', 'new-password')}

      {/* Confirm Password field */}
      {renderField('confirmPassword', 'Confirm Password', 'password', 'new-password')}

      {/* Terms acceptance */}
      <div className={styles['form-field']}>
        <label className={styles['checkbox-label']}>
          <input
            type="checkbox"
            {...register('acceptTerms')}
            aria-invalid={!!errors.acceptTerms}
            data-testid="register-terms-checkbox"
          />
          <span>
            I accept the{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer">
              Terms of Service
            </a>
            {' '}and{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
          </span>
        </label>
        {errors.acceptTerms && (
          <div 
            className={styles['error-message']} 
            role="alert"
            id="terms-error"
          >
            {errors.acceptTerms.message}
          </div>
        )}
      </div>

      {/* API Error Message */}
      {apiError && (
        <div 
          className={styles['api-error']} 
          role="alert"
          aria-live="polite"
        >
          {apiError}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={isSubmitting}
        disabled={isSubmitting}
        data-testid="register-submit-button"
        aria-label={isSubmitting ? 'Registering...' : 'Register'}
      >
        {isSubmitting ? 'Registering...' : 'Register'}
      </Button>
    </form>
  );
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generates a CAPTCHA token for form submission security
 * Note: Implement this based on your CAPTCHA service (e.g., reCAPTCHA)
 */
async function generateCaptchaToken(): Promise<string> {
  // Implementation depends on your CAPTCHA service
  return 'captcha-token';
}

RegisterForm.displayName = 'RegisterForm';

export default RegisterForm;