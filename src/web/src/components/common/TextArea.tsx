/**
 * @fileoverview A reusable TextArea component with comprehensive accessibility,
 * theming, and validation support. Implements WCAG 2.1 Level AA compliance.
 * @version 1.0.0
 */

import React, { useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { Theme } from '../types/common.types';
import { lightTheme, darkTheme } from '../config/theme';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface TextAreaProps {
  /** Current value of the textarea */
  value: string;
  /** Change handler function */
  onChange: (value: string) => void;
  /** Placeholder text with proper contrast ratio */
  placeholder?: string;
  /** Accessible label text */
  label?: string;
  /** Error message with aria-invalid support */
  error?: string;
  /** Disabled state with proper styling */
  disabled?: boolean;
  /** Number of visible text rows */
  rows?: number;
  /** Maximum character length with validation */
  maxLength?: number;
  /** Unique identifier for accessibility */
  id?: string;
  /** Form field name */
  name?: string;
  /** Additional CSS classes */
  className?: string;
  /** Explicit aria-label for accessibility */
  ariaLabel?: string;
  /** Autocomplete behavior */
  autoComplete?: string;
  /** Blur event handler */
  onBlur?: () => void;
  /** Focus event handler */
  onFocus?: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const StyledTextAreaContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  width: 100%;
  position: relative;
`;

const StyledLabel = styled.label<{ hasError?: boolean }>`
  color: ${({ theme, hasError }) => hasError ? theme.colors.error : theme.colors.text};
  font-size: ${({ theme }) => theme.typography.baseSize};
  font-weight: ${({ theme }) => theme.typography.weights.medium};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  user-select: none;
`;

const StyledTextArea = styled.textarea<{ hasError?: boolean }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme, hasError }) => 
    hasError ? theme.colors.error : theme.colors.border};
  border-radius: 4px;
  font-size: ${({ theme }) => theme.typography.baseSize};
  font-family: ${({ theme }) => theme.typography.fontFamily};
  background-color: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text};
  resize: vertical;
  min-height: 100px;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: ${({ theme, hasError }) => 
      hasError ? theme.colors.error : theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme, hasError }) => 
      hasError ? 
        `rgba(${theme.colors.error}, 0.2)` : 
        `rgba(${theme.colors.primary}, 0.2)`};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }

  &:disabled {
    background-color: ${({ theme }) => theme.colors.divider};
    cursor: not-allowed;
    opacity: 0.7;
  }

  &::placeholder {
    color: ${({ theme }) => theme.colors.secondary};
    opacity: 0.8;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StyledError = styled.div`
  color: ${({ theme }) => theme.colors.error};
  font-size: calc(${({ theme }) => theme.typography.baseSize} * 0.875);
  margin-top: ${({ theme }) => theme.spacing.xs};
  min-height: 20px;
  transition: opacity 0.2s ease;
`;

// ============================================================================
// Component Implementation
// ============================================================================

/**
 * A fully accessible and themeable TextArea component.
 * Implements WCAG 2.1 Level AA compliance with comprehensive keyboard navigation
 * and screen reader support.
 */
export const TextArea: React.FC<TextAreaProps> = React.memo(({
  value,
  onChange,
  placeholder,
  label,
  error,
  disabled = false,
  rows = 4,
  maxLength,
  id,
  name,
  className,
  ariaLabel,
  autoComplete,
  onBlur,
  onFocus,
}) => {
  // Generate unique ID if not provided
  const textAreaId = useMemo(() => id || `textarea-${Math.random().toString(36).slice(2, 11)}`, [id]);

  // Optimized change handler with validation
  const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    const newValue = event.target.value.trim();
    
    // Validate against maxLength if specified
    if (maxLength && newValue.length > maxLength) {
      return;
    }

    onChange(newValue);
  }, [onChange, maxLength]);

  // Compute aria-describedby based on error state
  const ariaDescribedBy = error ? `${textAreaId}-error` : undefined;

  return (
    <StyledTextAreaContainer className={className}>
      {label && (
        <StyledLabel 
          htmlFor={textAreaId}
          hasError={!!error}
        >
          {label}
          {maxLength && ` (${value.length}/${maxLength})`}
        </StyledLabel>
      )}

      <StyledTextArea
        id={textAreaId}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        onFocus={onFocus}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel || label}
        aria-invalid={!!error}
        aria-describedby={ariaDescribedBy}
        autoComplete={autoComplete}
        hasError={!!error}
        data-testid="textarea-component"
      />

      {error && (
        <StyledError
          id={`${textAreaId}-error`}
          role="alert"
          aria-live="polite"
        >
          {error}
        </StyledError>
      )}
    </StyledTextAreaContainer>
  );
});

TextArea.displayName = 'TextArea';

export default TextArea;