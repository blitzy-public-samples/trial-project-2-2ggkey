import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';
import '../../styles/variables.css';
import '../../styles/theme.css';

// Define prop types for the component
interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large' | string;
  color?: string;
  className?: string;
  ariaLabel?: string;
  speed?: 'slow' | 'normal' | 'fast';
}

// Define size mappings in pixels
const SIZE_MAPPINGS = {
  small: '16px',
  medium: '24px',
  large: '32px',
};

// Define speed mappings in milliseconds
const SPEED_MAPPINGS = {
  slow: '1.5s',
  normal: '1s',
  fast: '0.5s',
};

// Spinner animation
const rotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

// Styled container with performance optimizations
const SpinnerContainer = styled.div<{
  size: string;
  color: string;
  speed: string;
  reducedMotion: boolean;
}>`
  display: inline-block;
  width: ${props => getSize(props.size)};
  height: ${props => getSize(props.size)};
  border: 2px solid transparent;
  border-top-color: ${props => props.color};
  border-radius: var(--border-radius-full);
  animation: ${rotate} ${props => props.speed} linear infinite;
  animation-play-state: ${props => props.reducedMotion ? 'paused' : 'running'};
  
  /* Performance optimizations */
  will-change: transform;
  contain: strict;
  
  /* High contrast mode support */
  @media screen and (-ms-high-contrast: active) {
    border-top-color: currentColor;
  }
  
  /* Ensure smooth animation */
  backface-visibility: hidden;
  transform-style: preserve-3d;
  
  /* Fallback for browsers that don't support CSS custom properties */
  @supports not (--custom: property) {
    border-radius: 50%;
  }
`;

// Helper function to determine spinner size
const getSize = (size: string): string => {
  if (size in SIZE_MAPPINGS) {
    return SIZE_MAPPINGS[size as keyof typeof SIZE_MAPPINGS];
  }
  // Support custom sizes if they include valid CSS units
  if (/^[\d.]+(px|rem|em|vh|vw)$/.test(size)) {
    return size;
  }
  return SIZE_MAPPINGS.medium;
};

// Helper function to determine animation speed
const getSpeed = (speed: string): string => {
  return SPEED_MAPPINGS[speed as keyof typeof SPEED_MAPPINGS] || SPEED_MAPPINGS.normal;
};

/**
 * LoadingSpinner Component
 * 
 * A reusable loading spinner that provides visual feedback during async operations.
 * Supports different sizes, colors, and animation speeds while maintaining accessibility.
 *
 * @param {LoadingSpinnerProps} props - Component props
 * @returns {JSX.Element} Rendered loading spinner
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'var(--theme-primary)',
  className = '',
  ariaLabel = 'Loading...',
  speed = 'normal'
}) => {
  // Check for reduced motion preference
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    // Listen for changes in motion preference
    const handleMotionPreference = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleMotionPreference);
    return () => mediaQuery.removeEventListener('change', handleMotionPreference);
  }, []);

  // Fallback color if CSS custom property is not supported
  const getComputedColor = () => {
    if (color.startsWith('var(')) {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(color.slice(4, -1).trim()) || '#2196F3';
    }
    return color;
  };

  return (
    <SpinnerContainer
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      className={`loading-spinner ${className}`}
      size={size}
      color={getComputedColor()}
      speed={getSpeed(speed)}
      reducedMotion={reducedMotion}
      data-testid="loading-spinner"
    />
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(LoadingSpinner);

// Type export for consumers
export type { LoadingSpinnerProps };