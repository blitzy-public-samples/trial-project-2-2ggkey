/**
 * @fileoverview A reusable Badge component for displaying status indicators, labels, or counts
 * with theme support and accessibility features.
 * @version 1.0.0
 */

import React from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import { Status } from '../../types/common.types';
import styles from './Badge.module.css';

/**
 * Props interface for the Badge component
 */
interface BadgeProps {
  /** Content to be displayed inside the badge */
  children: React.ReactNode;
  /** Visual variant based on status */
  variant?: Status;
  /** Additional CSS classes */
  className?: string;
  /** Size variant affecting padding and font size */
  size?: 'small' | 'medium';
  /** Whether to display fully rounded corners */
  rounded?: boolean;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** Test identifier for automated testing */
  dataTestId?: string;
}

/**
 * A themed badge component that displays a status indicator, label, or count
 * with customizable appearance and accessibility support.
 *
 * @example
 * ```tsx
 * <Badge variant={Status.ACTIVE} size="small" rounded>
 *   Active
 * </Badge>
 * ```
 */
const Badge: React.FC<BadgeProps> = React.memo(({
  children,
  variant,
  className,
  size = 'medium',
  rounded = false,
  ariaLabel,
  dataTestId,
}) => {
  // Compose CSS classes with type safety
  const badgeClasses = classNames(
    styles.badge,
    {
      [styles.active]: variant === Status.ACTIVE,
      [styles.inactive]: variant === Status.INACTIVE,
      [styles.pending]: variant === Status.PENDING,
      [styles.archived]: variant === Status.ARCHIVED,
      [styles.small]: size === 'small',
      [styles.medium]: size === 'medium',
      [styles.rounded]: rounded,
    },
    className
  );

  // Map status to appropriate ARIA role and label
  const getAriaRole = (): string => {
    return variant ? 'status' : 'presentation';
  };

  return (
    <span
      className={badgeClasses}
      role={getAriaRole()}
      aria-label={ariaLabel}
      data-testid={dataTestId}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </span>
  );
});

// Display name for debugging
Badge.displayName = 'Badge';

export default Badge;

/**
 * CSS Module definition for type checking
 */
declare module './Badge.module.css' {
  interface BadgeStyles {
    badge: string;
    active: string;
    inactive: string;
    pending: string;
    archived: string;
    small: string;
    medium: string;
    rounded: string;
  }
  const styles: BadgeStyles;
  export default styles;
}
```

Now, let's create the accompanying CSS module with theme support and accessibility considerations:

# src/web/src/components/common/Badge.module.css
```css
/* Base badge styles following 8px grid system */
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0.01em;
  transition: all 200ms ease-in-out;
  white-space: nowrap;
  
  /* Default theme-aware colors */
  background-color: var(--badge-bg-color, #e5e7eb);
  color: var(--badge-text-color, #374151);
  
  /* Ensure minimum touch target size */
  min-height: 24px;
}

/* Size variants based on 8px grid */
.small {
  padding: 0.25rem 0.5rem; /* 4px 8px */
  font-size: 0.875rem; /* 14px */
  border-radius: 0.25rem; /* 4px */
}

.medium {
  padding: 0.5rem 0.75rem; /* 8px 12px */
  font-size: 1rem; /* 16px */
  border-radius: 0.375rem; /* 6px */
}

/* Pill shape variant */
.rounded {
  border-radius: 9999px;
}

/* Status variants with theme-aware colors and WCAG contrast ratios */
.active {
  background-color: var(--badge-success-bg, #dcfce7);
  color: var(--badge-success-text, #166534);
}

.inactive {
  background-color: var(--badge-neutral-bg, #f3f4f6);
  color: var(--badge-neutral-text, #4b5563);
}

.pending {
  background-color: var(--badge-warning-bg, #fef3c7);
  color: var(--badge-warning-text, #92400e);
}

.archived {
  background-color: var(--badge-error-bg, #fee2e2);
  color: var(--badge-error-text, #b91c1c);
}

/* Dark theme overrides using CSS custom properties */
:global(.dark-theme) .badge {
  --badge-bg-color: #374151;
  --badge-text-color: #e5e7eb;
  
  --badge-success-bg: #065f46;
  --badge-success-text: #dcfce7;
  
  --badge-neutral-bg: #4b5563;
  --badge-neutral-text: #f3f4f6;
  
  --badge-warning-bg: #92400e;
  --badge-warning-text: #fef3c7;
  
  --badge-error-bg: #991b1b;
  --badge-error-text: #fee2e2;
}

/* High contrast theme support */
@media (prefers-contrast: high) {
  .badge {
    border: 2px solid currentColor;
  }
}

/* Reduce motion preference */
@media (prefers-reduced-motion: reduce) {
  .badge {
    transition: none;
  }
}