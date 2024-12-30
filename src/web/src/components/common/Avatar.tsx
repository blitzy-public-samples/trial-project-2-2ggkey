/**
 * @fileoverview A reusable Avatar component that displays user profile images or initials
 * with support for different sizes, themes, and accessibility features.
 * @version 1.0.0
 * @author Task Management System Team
 */

import React, { memo, useCallback } from 'react'; // ^18.2.0
import styled from '@emotion/styled'; // ^11.11.0
import { Theme } from '../../types/common.types';

// ============================================================================
// Constants
// ============================================================================

const SIZES = {
  sm: '32px',
  md: '40px',
  lg: '48px'
} as const;

const FONT_SIZES = {
  sm: 'calc(var(--base-font-size) * 0.75)', // 12px with base 16px
  md: 'var(--base-font-size)', // 16px
  lg: 'calc(var(--base-font-size) * 1.25)' // 20px with base 16px
} as const;

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AvatarProps {
  /** URL of the avatar image */
  src?: string;
  /** Alternative text for accessibility (required) */
  alt: string;
  /** Size variant of the avatar */
  size?: keyof typeof SIZES;
  /** User's full name for generating initials */
  name: string;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Optional error handler for image loading failures */
  onError?: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================

interface ContainerProps {
  $size: keyof typeof SIZES;
}

const AvatarContainer = styled.div<ContainerProps>`
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${props => SIZES[props.$size]};
  height: ${props => SIZES[props.$size]};
  font-size: ${props => FONT_SIZES[props.$size]};
  font-weight: var(--font-weight-medium);
  background-color: var(--avatar-bg, #e2e8f0);
  color: var(--avatar-text, #475569);
  transition: all 0.2s ease-in-out;
  position: relative;
  user-select: none;

  /* High contrast mode support */
  @media (forced-colors: active) {
    border: 2px solid ButtonText;
  }

  /* Dark mode support */
  [data-theme="${Theme.DARK}"] & {
    background-color: var(--avatar-bg-dark, #334155);
    color: var(--avatar-text-dark, #e2e8f0);
  }
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.2s ease-in-out;
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts initials from a user's full name
 * @param name - The full name to extract initials from
 * @returns A string of up to 2 uppercase initials
 */
const getInitials = (name: string): string => {
  const trimmedName = name.trim();
  if (!trimmedName) return '';

  const nameParts = trimmedName.split(/\s+/);
  const firstInitial = nameParts[0]?.[0] || '';
  const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1]?.[0] : '';

  return (firstInitial + lastInitial).toUpperCase();
};

// ============================================================================
// Component
// ============================================================================

/**
 * Avatar component that displays either a user's profile image or their initials
 * in a circular container. Supports different sizes and themes while maintaining
 * accessibility standards.
 */
export const Avatar: React.FC<AvatarProps> = memo(({
  src,
  alt,
  size = 'md',
  name,
  className,
  onError
}) => {
  const handleImageError = useCallback(() => {
    onError?.();
  }, [onError]);

  return (
    <AvatarContainer
      $size={size}
      className={className}
      role="img"
      aria-label={alt}
      data-testid="avatar"
    >
      {src ? (
        <AvatarImage
          src={src}
          alt={alt}
          onError={handleImageError}
          data-testid="avatar-image"
        />
      ) : (
        <span aria-hidden="true" data-testid="avatar-initials">
          {getInitials(name)}
        </span>
      )}
    </AvatarContainer>
  );
});

Avatar.displayName = 'Avatar';

export default Avatar;