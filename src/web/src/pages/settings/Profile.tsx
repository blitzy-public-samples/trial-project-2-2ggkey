/**
 * @fileoverview User profile settings page component implementing a secure,
 * accessible, and responsive interface for managing user profile information.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form'; // ^7.0.0
import * as yup from 'yup'; // ^1.0.0
import { yupResolver } from '@hookform/resolvers/yup'; // ^3.0.0
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Avatar from '../../components/common/Avatar';
import { useAuth } from '../../hooks/useAuth';
import useNotification from '../../hooks/useNotification';
import { UI_CONFIG } from '../../config/constants';
import styles from './Profile.module.css';

// =============================================================================
// Types & Interfaces
// =============================================================================

interface ProfileFormData {
  name: string;
  email: string;
  avatar?: File;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    emailUpdates: boolean;
  };
}

// =============================================================================
// Validation Schema
// =============================================================================

const validationSchema = yup.object().shape({
  name: yup
    .string()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must not exceed 50 characters'),
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email'),
  preferences: yup.object().shape({
    theme: yup.string().oneOf(['light', 'dark', 'system']),
    notifications: yup.boolean(),
    emailUpdates: yup.boolean()
  })
});

// =============================================================================
// Component
// =============================================================================

const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const { showNotification } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Initialize form with react-hook-form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch
  } = useForm<ProfileFormData>({
    resolver: yupResolver(validationSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      preferences: user?.securityPreferences || {
        theme: 'system',
        notifications: true,
        emailUpdates: true
      }
    }
  });

  // Reset form when user data changes
  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        preferences: user.securityPreferences
      });
    }
  }, [user, reset]);

  /**
   * Handle avatar file upload with validation and preview
   */
  const handleAvatarChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > UI_CONFIG.MAX_FILE_SIZE) {
      showNotification({
        type: 'error',
        message: `File size must not exceed ${UI_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB`
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showNotification({
        type: 'error',
        message: 'Please upload an image file'
      });
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setValue('avatar', file);

    // Clean up preview URL on component unmount
    return () => URL.revokeObjectURL(previewUrl);
  }, [setValue, showNotification]);

  /**
   * Handle form submission with validation and error handling
   */
  const onSubmit = useCallback(async (data: ProfileFormData) => {
    try {
      setIsSubmitting(true);

      // Upload avatar if changed
      let avatarUrl;
      if (data.avatar) {
        const formData = new FormData();
        formData.append('avatar', data.avatar);
        // Implement avatar upload logic here
      }

      // Update profile
      await updateProfile({
        ...data,
        ...(avatarUrl && { avatarUrl })
      });

      showNotification({
        type: 'success',
        message: 'Profile updated successfully'
      });
    } catch (error) {
      showNotification({
        type: 'error',
        message: 'Failed to update profile'
      });
      console.error('Profile update error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [updateProfile, showNotification]);

  return (
    <div className={styles['profile-container']}>
      <header className={styles['profile-header']}>
        <h1>Profile Settings</h1>
        <p>Manage your account settings and preferences</p>
      </header>

      <form 
        className={styles['profile-form']} 
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        {/* Avatar Section */}
        <section className={styles['avatar-section']}>
          <Avatar
            src={avatarPreview || user?.avatarUrl}
            alt={user?.name || 'Profile picture'}
            size="lg"
            name={user?.name || ''}
          />
          <input
            type="file"
            id="avatar"
            accept="image/*"
            onChange={handleAvatarChange}
            className={styles['avatar-input']}
            aria-label="Upload profile picture"
          />
          <Button
            variant="outlined"
            size="small"
            onClick={() => document.getElementById('avatar')?.click()}
            type="button"
          >
            Change Picture
          </Button>
        </section>

        {/* Profile Information */}
        <section className={styles['form-section']}>
          <Input
            label="Full Name"
            {...register('name')}
            error={errors.name?.message}
            required
            autoComplete="name"
          />

          <Input
            label="Email Address"
            {...register('email')}
            error={errors.email?.message}
            required
            autoComplete="email"
            type="email"
          />
        </section>

        {/* Preferences */}
        <section className={styles['form-section']}>
          <h2>Preferences</h2>
          
          <div className={styles['preference-item']}>
            <label htmlFor="theme">Theme</label>
            <select
              id="theme"
              {...register('preferences.theme')}
              className={styles['theme-select']}
            >
              <option value="system">System Default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className={styles['preference-item']}>
            <label className={styles['checkbox-label']}>
              <input
                type="checkbox"
                {...register('preferences.notifications')}
              />
              Enable Notifications
            </label>
          </div>

          <div className={styles['preference-item']}>
            <label className={styles['checkbox-label']}>
              <input
                type="checkbox"
                {...register('preferences.emailUpdates')}
              />
              Receive Email Updates
            </label>
          </div>
        </section>

        {/* Form Actions */}
        <div className={styles['button-group']}>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Save Changes
          </Button>
          <Button
            type="button"
            variant="outlined"
            onClick={() => reset()}
            disabled={isSubmitting}
          >
            Reset
          </Button>
        </div>
      </form>
    </div>
  );
};

export default React.memo(Profile);