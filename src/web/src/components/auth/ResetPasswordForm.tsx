/**
 * @fileoverview A secure and accessible password reset form component with comprehensive validation
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form'; // v7.45.0
import * as yup from 'yup'; // v1.2.0
import { useTranslation } from 'react-i18next'; // v12.3.1
import Input from '../common/Input';
import Button from '../common/Button';
import { validatePassword } from '../../utils/validation.utils';
import authApi from '../../api/authApi';
import styles from './ResetPasswordForm.module.css';

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface ResetPasswordFormProps {
  /** Password reset token from URL */
  token: string;
  /** Callback function called on successful password reset */
  onSuccess: (message: string) => void;
  /** Callback function called on password reset error */
  onError: (error: string) => void;
  /** Maximum allowed reset attempts before lockout */
  maxAttempts?: number;
}

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

// =============================================================================
// Validation Schema
// =============================================================================

const resetPasswordSchema = yup.object().shape({
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .matches(/[!@#$%^&*]/, 'Password must contain at least one special character'),
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match')
});

// =============================================================================
// Component
// =============================================================================

const ResetPasswordForm: React.FC<ResetPasswordFormProps> = React.memo(({
  token,
  onSuccess,
  onError,
  maxAttempts = 5
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isTokenValid, setIsTokenValid] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    trigger
  } = useForm<ResetPasswordFormData>({
    mode: 'onChange',
    resolver: yup.resolver(resetPasswordSchema)
  });

  // =============================================================================
  // Token Validation
  // =============================================================================

  useEffect(() => {
    const validateToken = async () => {
      try {
        const response = await authApi.validateResetToken(token);
        setIsTokenValid(response.success);
        if (!response.success) {
          onError(t('auth.resetPassword.invalidToken'));
        }
      } catch (error) {
        setIsTokenValid(false);
        onError(t('auth.resetPassword.tokenValidationError'));
      }
    };

    validateToken();
  }, [token, onError, t]);

  // =============================================================================
  // Password Validation
  // =============================================================================

  const currentPassword = watch('password');
  
  useEffect(() => {
    if (currentPassword) {
      const validation = validatePassword(currentPassword);
      if (!validation.isValid) {
        trigger('password');
      }
    }
  }, [currentPassword, trigger]);

  // =============================================================================
  // Form Submission
  // =============================================================================

  const onSubmit = useCallback(async (data: ResetPasswordFormData) => {
    if (attempts >= maxAttempts) {
      onError(t('auth.resetPassword.tooManyAttempts'));
      return;
    }

    setIsLoading(true);
    setAttempts(prev => prev + 1);

    try {
      const response = await authApi.resetPassword({
        token,
        newPassword: data.password
      });

      if (response.success) {
        onSuccess(t('auth.resetPassword.success'));
      } else {
        onError(response.error?.message || t('auth.resetPassword.error'));
      }
    } catch (error) {
      onError(t('auth.resetPassword.error'));
    } finally {
      setIsLoading(false);
    }
  }, [token, attempts, maxAttempts, onSuccess, onError, t]);

  // =============================================================================
  // Render
  // =============================================================================

  if (!isTokenValid) {
    return null;
  }

  return (
    <form 
      className={styles.form}
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-labelledby="reset-password-title"
    >
      <h1 id="reset-password-title" className={styles['form-title']}>
        {t('auth.resetPassword.title')}
      </h1>

      <div className={styles['form-group']}>
        <Input
          {...register('password')}
          type="password"
          label={t('auth.resetPassword.passwordLabel')}
          error={errors.password?.message}
          autoComplete="new-password"
          required
          aria-required="true"
        />

        <Input
          {...register('confirmPassword')}
          type="password"
          label={t('auth.resetPassword.confirmPasswordLabel')}
          error={errors.confirmPassword?.message}
          autoComplete="new-password"
          required
          aria-required="true"
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        fullWidth
        loading={isLoading}
        disabled={!isValid || isLoading || attempts >= maxAttempts}
        className={styles['submit-button']}
        ariaLabel={t('auth.resetPassword.submitButton')}
      >
        {t('auth.resetPassword.submitButton')}
      </Button>

      {attempts > 0 && (
        <p className={styles['attempts-warning']} role="alert">
          {t('auth.resetPassword.attemptsRemaining', {
            remaining: maxAttempts - attempts
          })}
        </p>
      )}
    </form>
  );
});

ResetPasswordForm.displayName = 'ResetPasswordForm';

export default ResetPasswordForm;