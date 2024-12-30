/**
 * @fileoverview Security settings page component with comprehensive security management features
 * @version 1.0.0
 * @package react@18.2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useAuth } from '../../hooks/useAuth';
import styles from './Security.module.css';

// =============================================================================
// Types & Interfaces
// =============================================================================

interface SecurityFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  trustedDevices: Device[];
  securityEvents: SecurityEvent[];
}

interface Device {
  id: string;
  name: string;
  lastUsed: string;
  trusted: boolean;
}

interface SecurityEvent {
  id: string;
  type: 'login' | 'password_change' | 'mfa_update' | 'device_trust';
  timestamp: string;
  details: Record<string, any>;
}

// =============================================================================
// Constants
// =============================================================================

const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: true,
};

const SESSION_TIMEOUT_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
];

// =============================================================================
// Component Implementation
// =============================================================================

const Security: React.FC = () => {
  const { user, isAuthenticated, updateSecuritySettings } = useAuth();

  // State management
  const [formState, setFormState] = useState<SecurityFormState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    twoFactorEnabled: user?.mfaEnabled || false,
    sessionTimeout: user?.securityPreferences?.sessionTimeout || 30,
    trustedDevices: [],
    securityEvents: [],
  });

  const [loading, setLoading] = useState<Record<string, boolean>>({
    passwordChange: false,
    mfaSetup: false,
    deviceTrust: false,
  });

  const [error, setError] = useState<Record<string, string | null>>({
    passwordChange: null,
    mfaSetup: null,
    deviceTrust: null,
  });

  const [validation, setValidation] = useState({
    passwordStrength: 0,
    passwordMatch: false,
    currentPasswordValid: false,
  });

  // =============================================================================
  // Validation & Helpers
  // =============================================================================

  const validatePasswordStrength = useCallback((password: string): number => {
    let strength = 0;
    if (password.length >= PASSWORD_REQUIREMENTS.minLength) strength++;
    if (/[A-Z]/.test(password) && PASSWORD_REQUIREMENTS.requireUppercase) strength++;
    if (/[a-z]/.test(password) && PASSWORD_REQUIREMENTS.requireLowercase) strength++;
    if (/[0-9]/.test(password) && PASSWORD_REQUIREMENTS.requireNumbers) strength++;
    if (/[^A-Za-z0-9]/.test(password) && PASSWORD_REQUIREMENTS.requireSpecial) strength++;
    return (strength / 5) * 100;
  }, []);

  const validatePasswords = useCallback(() => {
    const { newPassword, confirmPassword } = formState;
    setValidation(prev => ({
      ...prev,
      passwordMatch: newPassword === confirmPassword && newPassword !== '',
      passwordStrength: validatePasswordStrength(newPassword),
    }));
  }, [formState, validatePasswordStrength]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
    setError(prev => ({ ...prev, passwordChange: null }));
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, passwordChange: true }));
    setError(prev => ({ ...prev, passwordChange: null }));

    try {
      if (!validation.passwordMatch || validation.passwordStrength < 80) {
        throw new Error('Password requirements not met');
      }

      await updateSecuritySettings({
        type: 'password',
        currentPassword: formState.currentPassword,
        newPassword: formState.newPassword,
      });

      // Reset form on success
      setFormState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setError(prev => ({
        ...prev,
        passwordChange: err instanceof Error ? err.message : 'Password change failed',
      }));
    } finally {
      setLoading(prev => ({ ...prev, passwordChange: false }));
    }
  };

  const handleMfaToggle = async () => {
    setLoading(prev => ({ ...prev, mfaSetup: true }));
    try {
      await updateSecuritySettings({
        type: 'mfa',
        enabled: !securitySettings.twoFactorEnabled,
      });
      setSecuritySettings(prev => ({
        ...prev,
        twoFactorEnabled: !prev.twoFactorEnabled,
      }));
    } catch (err) {
      setError(prev => ({
        ...prev,
        mfaSetup: err instanceof Error ? err.message : 'MFA setup failed',
      }));
    } finally {
      setLoading(prev => ({ ...prev, mfaSetup: false }));
    }
  };

  const handleSessionTimeoutChange = async (value: number) => {
    try {
      await updateSecuritySettings({
        type: 'sessionTimeout',
        timeout: value,
      });
      setSecuritySettings(prev => ({
        ...prev,
        sessionTimeout: value,
      }));
    } catch (err) {
      setError(prev => ({
        ...prev,
        sessionTimeout: err instanceof Error ? err.message : 'Session timeout update failed',
      }));
    }
  };

  // =============================================================================
  // Effects
  // =============================================================================

  useEffect(() => {
    validatePasswords();
  }, [formState.newPassword, formState.confirmPassword, validatePasswords]);

  // =============================================================================
  // Render
  // =============================================================================

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.securityContainer} role="main" aria-labelledby="security-title">
      <h1 id="security-title" className={styles.title}>Security Settings</h1>

      {/* Password Change Section */}
      <section className={styles.section} aria-labelledby="password-section">
        <h2 id="password-section">Password Management</h2>
        <form onSubmit={handlePasswordChange} className={styles.form}>
          <Input
            label="Current Password"
            type="password"
            name="currentPassword"
            value={formState.currentPassword}
            onChange={handleInputChange}
            required
            aria-describedby="current-password-help"
            error={error.passwordChange}
          />

          <Input
            label="New Password"
            type="password"
            name="newPassword"
            value={formState.newPassword}
            onChange={handleInputChange}
            required
            helperText={`Password strength: ${validation.passwordStrength}%`}
            error={!validation.passwordMatch ? 'Passwords do not match' : ''}
          />

          <Input
            label="Confirm New Password"
            type="password"
            name="confirmPassword"
            value={formState.confirmPassword}
            onChange={handleInputChange}
            required
            error={!validation.passwordMatch ? 'Passwords do not match' : ''}
          />

          <Button
            type="submit"
            variant="primary"
            loading={loading.passwordChange}
            disabled={!validation.passwordMatch || validation.passwordStrength < 80}
            aria-label="Change password"
          >
            Change Password
          </Button>
        </form>
      </section>

      {/* Two-Factor Authentication Section */}
      <section className={styles.section} aria-labelledby="mfa-section">
        <h2 id="mfa-section">Two-Factor Authentication</h2>
        <div className={styles.mfaContainer}>
          <p>
            {securitySettings.twoFactorEnabled
              ? 'Two-factor authentication is enabled'
              : 'Enable two-factor authentication for additional security'}
          </p>
          <Button
            variant="outlined"
            onClick={handleMfaToggle}
            loading={loading.mfaSetup}
            aria-label={securitySettings.twoFactorEnabled ? 'Disable two-factor authentication' : 'Enable two-factor authentication'}
          >
            {securitySettings.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
          </Button>
          {error.mfaSetup && (
            <p className={styles.error} role="alert">{error.mfaSetup}</p>
          )}
        </div>
      </section>

      {/* Session Management Section */}
      <section className={styles.section} aria-labelledby="session-section">
        <h2 id="session-section">Session Management</h2>
        <div className={styles.sessionContainer}>
          <label htmlFor="session-timeout">Session Timeout</label>
          <select
            id="session-timeout"
            value={securitySettings.sessionTimeout}
            onChange={(e) => handleSessionTimeoutChange(Number(e.target.value))}
            className={styles.select}
          >
            {SESSION_TIMEOUT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Security Events Section */}
      <section className={styles.section} aria-labelledby="events-section">
        <h2 id="events-section">Recent Security Events</h2>
        <div className={styles.eventsContainer}>
          {securitySettings.securityEvents.length > 0 ? (
            <ul className={styles.eventsList}>
              {securitySettings.securityEvents.map(event => (
                <li key={event.id} className={styles.eventItem}>
                  <span className={styles.eventType}>{event.type}</span>
                  <span className={styles.eventTime}>
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No recent security events</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default Security;