/**
 * @fileoverview Test suite for the Button component
 * @version 1.0.0
 */

import React from 'react';
import { render, fireEvent, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@mui/material';
import Button, { ButtonProps } from '../../../src/components/common/Button';
import { Theme } from '../../../src/types/common.types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock theme context
const mockTheme = {
  palette: {
    primary: { main: '#2196F3' },
    secondary: { main: '#757575' },
  },
};

// Test setup utilities
const renderButton = (props: Partial<ButtonProps> = {}) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      <Button {...props} />
    </ThemeProvider>
  );
};

describe('Button Component', () => {
  // Mock functions
  const mockOnClick = jest.fn();
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // Rendering Tests
  describe('Rendering', () => {
    test('renders with default props', () => {
      renderButton();
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('button', 'button--primary', 'button--medium');
    });

    test('renders with custom className', () => {
      renderButton({ className: 'custom-class' });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    test('renders children content correctly', () => {
      renderButton({ children: 'Click Me' });
      expect(screen.getByText('Click Me')).toBeInTheDocument();
    });

    test('applies fullWidth prop correctly', () => {
      renderButton({ fullWidth: true });
      const button = screen.getByRole('button');
      expect(button).toHaveClass('button--full-width');
    });
  });

  // Variants Tests
  describe('Variants', () => {
    test.each(['primary', 'secondary', 'outlined', 'text'] as const)(
      'renders %s variant with correct styling',
      (variant) => {
        renderButton({ variant });
        const button = screen.getByRole('button');
        expect(button).toHaveClass(`button--${variant}`);
      }
    );

    test('handles variant prop changes', () => {
      const { rerender } = render(<Button variant="primary">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('button--primary');

      rerender(<Button variant="secondary">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('button--secondary');
    });
  });

  // Size Tests
  describe('Sizes', () => {
    test.each(['small', 'medium', 'large'] as const)(
      'renders %s size with correct dimensions',
      (size) => {
        renderButton({ size });
        const button = screen.getByRole('button');
        expect(button).toHaveClass(`button--${size}`);
      }
    );

    test('maintains proper spacing with icons', () => {
      const startIcon = <span data-testid="start-icon">→</span>;
      const endIcon = <span data-testid="end-icon">←</span>;
      
      renderButton({ startIcon, endIcon });
      expect(screen.getByTestId('start-icon')).toHaveClass('button__icon-start');
      expect(screen.getByTestId('end-icon')).toHaveClass('button__icon-end');
    });
  });

  // State Tests
  describe('States', () => {
    test('displays loading spinner in loading state', () => {
      renderButton({ loading: true });
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByRole('button')).toContainElement(
        screen.getByRole('presentation', { hidden: true })
      );
    });

    test('prevents clicks in loading state', async () => {
      renderButton({ loading: true, onClick: mockOnClick });
      await user.click(screen.getByRole('button'));
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    test('applies proper disabled styling', () => {
      renderButton({ disabled: true });
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('button--disabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    test('maintains focus state styles', async () => {
      renderButton();
      const button = screen.getByRole('button');
      await user.tab();
      expect(button).toHaveFocus();
      expect(button.querySelector('.button__focus-ring')).toBeVisible();
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    test('meets WCAG accessibility guidelines', async () => {
      const { container } = renderButton({ children: 'Accessible Button' });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('supports keyboard navigation', async () => {
      renderButton({ onClick: mockOnClick });
      const button = screen.getByRole('button');
      
      await user.tab();
      expect(button).toHaveFocus();
      
      await user.keyboard('{enter}');
      expect(mockOnClick).toHaveBeenCalledTimes(1);
      
      await user.keyboard(' ');
      expect(mockOnClick).toHaveBeenCalledTimes(2);
    });

    test('provides proper ARIA attributes', () => {
      renderButton({
        ariaLabel: 'Custom Label',
        loading: true,
        disabled: true,
      });
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });
  });

  // Theme Support Tests
  describe('Theme Support', () => {
    test('applies theme correctly', () => {
      renderButton({ theme: Theme.DARK });
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-theme', 'dark');
    });

    test('handles theme switching', () => {
      const { rerender } = renderButton({ theme: Theme.LIGHT });
      let button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-theme', 'light');

      rerender(
        <ThemeProvider theme={mockTheme}>
          <Button theme={Theme.DARK} />
        </ThemeProvider>
      );
      
      button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-theme', 'dark');
    });
  });

  // Performance Tests
  describe('Performance', () => {
    test('renders without unnecessary updates', async () => {
      const renderSpy = jest.spyOn(console, 'log');
      const { rerender } = renderButton({ children: 'Test' });
      
      rerender(
        <ThemeProvider theme={mockTheme}>
          <Button>Test</Button>
        </ThemeProvider>
      );

      expect(renderSpy).not.toHaveBeenCalled();
      renderSpy.mockRestore();
    });

    test('handles rapid state changes', async () => {
      const { rerender } = renderButton({ loading: false });
      
      for (let i = 0; i < 100; i++) {
        rerender(
          <ThemeProvider theme={mockTheme}>
            <Button loading={i % 2 === 0}>Test</Button>
          </ThemeProvider>
        );
      }

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
    });
  });
});