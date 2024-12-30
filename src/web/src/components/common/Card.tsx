import React, { useMemo } from 'react';
import '../../styles/theme.css';
import '../../styles/variables.css';

/**
 * Props interface for the Card component
 */
interface CardProps {
  /** Content to be rendered inside the card */
  children: React.ReactNode;
  /** Additional CSS classes for custom styling */
  className?: string;
  /** Controls shadow depth (1-3) */
  elevation?: 1 | 2 | 3;
  /** Click handler for interactive cards */
  onClick?: () => void;
  /** Custom padding override */
  padding?: string;
  /** Data attribute for testing purposes */
  testId?: string;
}

/**
 * A flexible card component implementing Material Design principles with accessibility
 * and performance optimizations.
 *
 * @version 1.0.0
 * @example
 * ```tsx
 * <Card elevation={2} onClick={() => console.log('clicked')}>
 *   <h2>Card Title</h2>
 *   <p>Card content</p>
 * </Card>
 * ```
 */
const Card: React.FC<CardProps> = ({
  children,
  className = '',
  elevation = 1,
  onClick,
  padding = 'var(--spacing-md)',
  testId = 'card',
}) => {
  // Memoize styles to prevent recalculation on every render
  const cardStyle = useMemo(() => {
    const elevationMap = {
      1: '0 2px 4px var(--theme-shadow)',
      2: '0 4px 8px var(--theme-shadow)',
      3: '0 8px 16px var(--theme-shadow)',
    };

    return {
      backgroundColor: 'var(--theme-background)',
      borderRadius: 'var(--border-radius-md)',
      boxShadow: elevationMap[elevation],
      color: 'var(--theme-text)',
      padding,
      transition: 'var(--transition-base)',
      willChange: 'transform, box-shadow',
      contain: 'layout style',
      cursor: onClick ? 'pointer' : 'default',
      position: 'relative' as const,
    };
  }, [elevation, padding, onClick]);

  // Determine appropriate ARIA role and keyboard interaction props
  const interactionProps = useMemo(() => {
    if (!onClick) return {};

    return {
      role: 'button',
      tabIndex: 0,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === 'Space') {
          e.preventDefault();
          onClick();
        }
      },
    };
  }, [onClick]);

  // Handle hover state for interactive cards
  const hoverStyles = onClick
    ? {
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 6px 12px var(--theme-shadow)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
      }
    : {};

  return (
    <div
      className={`card ${className}`}
      style={{ ...cardStyle, ...hoverStyles }}
      onClick={onClick}
      data-testid={testId}
      {...interactionProps}
      aria-disabled={!onClick}
    >
      {children}
    </div>
  );
};

// Performance optimization - prevent unnecessary re-renders
export default React.memo(Card);