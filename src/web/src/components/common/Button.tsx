/**
 * @fileoverview A highly customizable, accessible button component implementing Material Design principles
 * @version 1.0.0
 */

import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { Theme } from '../../types/common.types';

import styles from './Button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant following Material Design principles */
  variant?: 'primary' | 'secondary' | 'outlined' | 'text';
  /** Size variant affecting padding and font size */
  size?: 'small' | 'medium' | 'large';
  /** Controls button width expansion */
  fullWidth?: boolean;
  /** Shows loading state with spinner */
  loading?: boolean;
  /** Leading icon element */
  startIcon?: React.ReactNode;
  /** Trailing icon element */
  endIcon?: React.ReactNode;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** Test identifier for automated testing */
  dataTestId?: string;
  /** Theme override for the button */
  theme?: Theme;
}

/**
 * A highly customizable button component with Material Design styling,
 * accessibility features, and theme support.
 */
const Button = React.memo<ButtonProps>(({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  loading = false,
  startIcon,
  endIcon,
  ariaLabel,
  dataTestId,
  theme,
  disabled,
  className,
  children,
  onClick,
  type = 'button',
  ...restProps
}) => {
  // Generate dynamic class names
  const buttonClasses = useMemo(() => classNames(
    styles.button,
    styles[`button--${variant}`],
    styles[`button--${size}`],
    {
      [styles['button--full-width']]: fullWidth,
      [styles['button--loading']]: loading,
      [styles['button--disabled']]: disabled || loading,
      [styles['button--with-icon']]: startIcon || endIcon,
    },
    className
  ), [variant, size, fullWidth, loading, disabled, startIcon, endIcon, className]);

  // Memoize click handler to prevent unnecessary re-renders
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }, [loading, disabled, onClick]);

  // Loading spinner component
  const LoadingSpinner = useMemo(() => (
    <span className={styles['button__spinner']} aria-hidden="true">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="none" strokeWidth="3" />
      </svg>
    </span>
  ), []);

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      data-testid={dataTestId}
      data-theme={theme}
      {...restProps}
    >
      {/* Loading spinner */}
      {loading && LoadingSpinner}

      {/* Start icon */}
      {startIcon && !loading && (
        <span className={styles['button__icon-start']} aria-hidden="true">
          {startIcon}
        </span>
      )}

      {/* Button content */}
      <span className={styles['button__content']}>
        {children}
      </span>

      {/* End icon */}
      {endIcon && !loading && (
        <span className={styles['button__icon-end']} aria-hidden="true">
          {endIcon}
        </span>
      )}

      {/* Focus ring for accessibility */}
      <span className={styles['button__focus-ring']} aria-hidden="true" />
    </button>
  );
});

// Display name for debugging
Button.displayName = 'Button';

export default Button;

/**
 * CSS Module styles are defined in Button.module.css
 * 
 * Example usage:
 * ```tsx
 * <Button
 *   variant="primary"
 *   size="medium"
 *   onClick={handleClick}
 *   startIcon={<Icon name="plus" />}
 *   ariaLabel="Add new item"
 * >
 *   Add Item
 * </Button>
 * ```
 */