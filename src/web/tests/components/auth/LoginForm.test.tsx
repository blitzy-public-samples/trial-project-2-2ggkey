/**
 * @fileoverview Comprehensive test suite for the LoginForm component
 * @version 1.0.0
 * @package @testing-library/react@13.0.0
 * @package @testing-library/user-event@14.0.0
 * @package vitest@0.34.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import LoginForm from '../../src/components/auth/LoginForm';
import { useAuth } from '../../src/hooks/useAuth';

// Mock useAuth hook
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

// Test data
const validCredentials = {
  email: 'test@example.com',
  password: 'ValidPass123!',
  deviceFingerprint: 'test-device-id'
};

const invalidCredentials = {
  email: 'invalid',
  password: 'short',
};

// Custom render function with auth provider
const renderLoginForm = (props = {}) => {
  return render(<LoginForm {...props} />);
};

describe('LoginForm Component', () => {
  // Setup for each test
  let mockLogin: vi.Mock;
  let mockValidateDevice: vi.Mock;
  let mockInitiateMFA: vi.Mock;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    // Reset mocks
    mockLogin = vi.fn();
    mockValidateDevice = vi.fn();
    mockInitiateMFA = vi.fn();
    
    // Setup useAuth mock
    (useAuth as vi.Mock).mockReturnValue({
      login: mockLogin,
      validateDevice: mockValidateDevice,
      initiateMFA: mockInitiateMFA,
      loading: false,
      error: null,
      attemptCount: 0
    });

    // Setup user event
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering and Accessibility', () => {
    test('renders all form elements with proper accessibility attributes', () => {
      renderLoginForm();

      // Check form elements presence
      expect(screen.getByRole('form')).toHaveAttribute('aria-labelledby', 'login-heading');
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();

      // Verify ARIA attributes
      const emailInput = screen.getByTestId('email-input');
      expect(emailInput).toHaveAttribute('aria-required', 'true');
      
      const passwordInput = screen.getByTestId('password-input');
      expect(passwordInput).toHaveAttribute('aria-required', 'true');
    });

    test('supports keyboard navigation', async () => {
      renderLoginForm();
      const form = screen.getByRole('form');

      // Tab through form elements
      await user.tab();
      expect(screen.getByTestId('email-input')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('password-input')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('submit-button')).toHaveFocus();
    });

    test('toggles password visibility', async () => {
      renderLoginForm();
      const passwordInput = screen.getByTestId('password-input');
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      expect(passwordInput).toHaveAttribute('type', 'password');
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
    });
  });

  describe('Form Validation', () => {
    test('displays validation errors for empty fields', async () => {
      renderLoginForm();
      const submitButton = screen.getByTestId('submit-button');

      await user.click(submitButton);

      expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    });

    test('validates email format', async () => {
      renderLoginForm();
      const emailInput = screen.getByTestId('email-input');

      await user.type(emailInput, 'invalid-email');
      await user.tab();

      expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument();
    });

    test('validates password requirements', async () => {
      renderLoginForm();
      const passwordInput = screen.getByTestId('password-input');

      await user.type(passwordInput, 'weak');
      await user.tab();

      expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });

    test('shows real-time validation feedback', async () => {
      renderLoginForm();
      const emailInput = screen.getByTestId('email-input');
      const passwordInput = screen.getByTestId('password-input');

      // Test email validation
      await user.type(emailInput, 'test');
      expect(await screen.findByText(/invalid email format/i)).toBeInTheDocument();
      await user.type(emailInput, '@example.com');
      expect(screen.queryByText(/invalid email format/i)).not.toBeInTheDocument();

      // Test password validation
      await user.type(passwordInput, 'Pass123!');
      expect(screen.queryByText(/password must be at least 8 characters/i)).not.toBeInTheDocument();
    });
  });

  describe('Authentication Flow', () => {
    test('handles successful login', async () => {
      const onSuccess = vi.fn();
      renderLoginForm({ onSuccess });

      mockLogin.mockResolvedValueOnce({ success: true });
      mockValidateDevice.mockResolvedValueOnce(true);

      await user.type(screen.getByTestId('email-input'), validCredentials.email);
      await user.type(screen.getByTestId('password-input'), validCredentials.password);
      await user.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({
          email: validCredentials.email,
          password: validCredentials.password
        }));
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    test('handles MFA requirement', async () => {
      const onMFARequired = vi.fn();
      renderLoginForm({ onMFARequired });

      mockLogin.mockResolvedValueOnce({ mfaRequired: true });

      await user.type(screen.getByTestId('email-input'), validCredentials.email);
      await user.type(screen.getByTestId('password-input'), validCredentials.password);
      await user.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(onMFARequired).toHaveBeenCalled();
      });
    });

    test('implements account lockout after 5 failed attempts', async () => {
      renderLoginForm();

      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      // Attempt login 5 times
      for (let i = 0; i < 5; i++) {
        await user.type(screen.getByTestId('email-input'), invalidCredentials.email);
        await user.type(screen.getByTestId('password-input'), invalidCredentials.password);
        await user.click(screen.getByTestId('submit-button'));
      }

      await waitFor(() => {
        expect(screen.getByText(/account temporarily locked/i)).toBeInTheDocument();
        expect(screen.getByTestId('submit-button')).toBeDisabled();
      });
    });

    test('validates device trust', async () => {
      renderLoginForm();

      mockLogin.mockResolvedValueOnce({ success: true });
      mockValidateDevice.mockResolvedValueOnce(true);

      await user.type(screen.getByTestId('email-input'), validCredentials.email);
      await user.type(screen.getByTestId('password-input'), validCredentials.password);
      await user.click(screen.getByTestId('submit-button'));

      await waitFor(() => {
        expect(mockValidateDevice).toHaveBeenCalled();
      });
    });
  });

  describe('Security Features', () => {
    test('disables form during authentication', async () => {
      (useAuth as vi.Mock).mockReturnValue({
        ...useAuth(),
        loading: true
      });

      renderLoginForm();

      expect(screen.getByTestId('email-input')).toBeDisabled();
      expect(screen.getByTestId('password-input')).toBeDisabled();
      expect(screen.getByTestId('submit-button')).toBeDisabled();
    });

    test('displays failed attempt counter', async () => {
      renderLoginForm();
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      await user.type(screen.getByTestId('email-input'), invalidCredentials.email);
      await user.type(screen.getByTestId('password-input'), invalidCredentials.password);
      await user.click(screen.getByTestId('submit-button'));

      expect(await screen.findByText(/failed attempts: 1\/5/i)).toBeInTheDocument();
    });

    test('shows warning message after 3 failed attempts', async () => {
      renderLoginForm();
      mockLogin.mockRejectedValue(new Error('Invalid credentials'));

      // Attempt login 3 times
      for (let i = 0; i < 3; i++) {
        await user.type(screen.getByTestId('email-input'), invalidCredentials.email);
        await user.type(screen.getByTestId('password-input'), invalidCredentials.password);
        await user.click(screen.getByTestId('submit-button'));
      }

      expect(await screen.findByText(/warning: account will be locked/i)).toBeInTheDocument();
    });
  });
});