/**
 * @fileoverview A reusable progress bar component with customizable appearance,
 * theming support, and accessibility features compliant with WCAG 2.1 Level AA.
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import classnames from 'classnames'; // v2.3.2
import { formatPercentage } from '../../utils/format.utils';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ProgressBarProps {
  /** Progress value between 0 and 100 */
  value: number;
  /** Optional color variant */
  color?: 'primary' | 'success' | 'warning' | 'error';
  /** Optional size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional additional CSS classes */
  className?: string;
  /** Optional flag to show percentage label */
  showLabel?: boolean;
  /** Optional flag for smooth transition animations */
  animated?: boolean;
  /** Custom accessibility label for screen readers */
  ariaLabel?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SIZE_CLASSES = {
  sm: 'progress-bar--sm', // 24px height
  md: 'progress-bar--md', // 32px height
  lg: 'progress-bar--lg', // 40px height
};

const COLOR_CLASSES = {
  primary: 'progress-bar--primary',
  success: 'progress-bar--success',
  warning: 'progress-bar--warning',
  error: 'progress-bar--error',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates and clamps progress value between 0 and 100
 * @param value - The progress value to validate
 * @returns Clamped value between 0 and 100
 */
const validateProgressValue = (value: number): number => {
  return Math.max(0, Math.min(100, value));
};

/**
 * Formats progress value for display and screen readers
 * @param value - The progress value to format
 * @returns Formatted percentage string
 */
const formatProgressLabel = (value: number): string => {
  const validValue = validateProgressValue(value);
  return formatPercentage(validValue / 100);
};

// ============================================================================
// Component
// ============================================================================

/**
 * ProgressBar component that visualizes completion or progress percentages
 * with customizable appearance, theming support, and accessibility features.
 */
export const ProgressBar: React.FC<ProgressBarProps> = React.memo(({
  value,
  color = 'primary',
  size = 'md',
  className,
  showLabel = false,
  animated = true,
  ariaLabel,
}) => {
  // Memoize validated progress value
  const validatedValue = useMemo(() => validateProgressValue(value), [value]);
  
  // Memoize formatted label
  const progressLabel = useMemo(() => formatProgressLabel(validatedValue), [validatedValue]);

  // Memoize class names
  const containerClasses = useMemo(() => classnames(
    'progress-bar',
    SIZE_CLASSES[size],
    COLOR_CLASSES[color],
    {
      'progress-bar--animated': animated,
      'progress-bar--with-label': showLabel,
    },
    className
  ), [size, color, animated, showLabel, className]);

  // Memoize style object for progress bar width
  const progressStyle = useMemo(() => ({
    transform: `translateX(${validatedValue - 100}%)`,
  }), [validatedValue]);

  return (
    <div
      className={containerClasses}
      role="progressbar"
      aria-valuenow={validatedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel || `Progress: ${progressLabel}`}
    >
      <div className="progress-bar__track">
        <div 
          className="progress-bar__fill"
          style={progressStyle}
        />
      </div>
      
      {showLabel && (
        <span className="progress-bar__label" aria-hidden="true">
          {progressLabel}
        </span>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo
  return (
    prevProps.value === nextProps.value &&
    prevProps.color === nextProps.color &&
    prevProps.size === nextProps.size &&
    prevProps.showLabel === nextProps.showLabel &&
    prevProps.animated === nextProps.animated &&
    prevProps.className === nextProps.className &&
    prevProps.ariaLabel === nextProps.ariaLabel
  );
});

// Display name for debugging
ProgressBar.displayName = 'ProgressBar';

// Default export
export default ProgressBar;

// CSS Module styles would be in a separate file: ProgressBar.module.css
/*
.progress-bar {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: var(--border-radius-md);
  background-color: var(--color-background-secondary);
}

.progress-bar__track {
  position: relative;
  width: 100%;
  overflow: hidden;
}

.progress-bar__fill {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: left;
  transition: transform 0.3s ease-in-out;
  background-color: var(--color-primary);
  will-change: transform;
}

.progress-bar--animated .progress-bar__fill {
  animation: progress-bar-stripes 1s linear infinite;
}

.progress-bar__label {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-contrast);
}

.progress-bar--sm {
  height: 24px;
}

.progress-bar--md {
  height: 32px;
}

.progress-bar--lg {
  height: 40px;
}

.progress-bar--primary .progress-bar__fill {
  background-color: var(--color-primary);
}

.progress-bar--success .progress-bar__fill {
  background-color: var(--color-success);
}

.progress-bar--warning .progress-bar__fill {
  background-color: var(--color-warning);
}

.progress-bar--error .progress-bar__fill {
  background-color: var(--color-error);
}

@keyframes progress-bar-stripes {
  from {
    background-position: 1rem 0;
  }
  to {
    background-position: 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-bar__fill {
    transition: none;
  }
  
  .progress-bar--animated .progress-bar__fill {
    animation: none;
  }
}
*/