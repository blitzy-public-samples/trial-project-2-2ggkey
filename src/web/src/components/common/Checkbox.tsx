/**
 * @fileoverview Accessible, themeable checkbox component with WCAG 2.1 Level AA compliance
 * @version 1.0.0
 * 
 * Features:
 * - WCAG 2.1 Level AA compliant
 * - Material Design principles
 * - Dynamic theme support
 * - Enhanced keyboard navigation
 * - Screen reader optimizations
 * - Touch target size compliance
 */

import React, { useCallback, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { Theme } from '../../types/common.types';
import { useTheme } from '../../hooks/useTheme';

// Constants for accessibility
const CHECKBOX_SIZE = '20px';
const TOUCH_TARGET_SIZE = '44px';
const TRANSITION_DURATION = '200ms';
const FOCUS_RING_SIZE = '3px';

// Interfaces
export interface CheckboxProps {
  /** Controlled checked state */
  checked?: boolean;
  /** Initial checked state for uncontrolled mode */
  defaultChecked?: boolean;
  /** Change event handler with event object */
  onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Disabled state with ARIA support */
  disabled?: boolean;
  /** Accessible label text */
  label?: string;
  /** Input name for form integration */
  name?: string;
  /** Unique identifier for ARIA relationships */
  id?: string;
  /** Additional CSS classes for customization */
  className?: string;
  /** Custom ARIA label for screen readers */
  ariaLabel?: string;
}

// Styled components with theme support
const CheckboxContainer = styled.div<{ disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  position: relative;
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ disabled }) => disabled ? '0.5' : '1'};
  min-height: ${TOUCH_TARGET_SIZE};
  padding: 2px;
`;

const HiddenInput = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  margin: 0;
  padding: 0;
`;

const CheckboxVisual = styled.div<{ checked?: boolean; focused?: boolean; isDarkMode: boolean }>`
  width: ${CHECKBOX_SIZE};
  height: ${CHECKBOX_SIZE};
  border: 2px solid ${({ isDarkMode }) => isDarkMode ? '#BBBBBB' : '#757575'};
  border-radius: 2px;
  background-color: ${({ checked, isDarkMode }) => 
    checked ? (isDarkMode ? '#90CAF9' : '#2196F3') : 'transparent'};
  transition: all ${TRANSITION_DURATION} ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin: 12px;

  &:hover {
    border-color: ${({ isDarkMode }) => isDarkMode ? '#90CAF9' : '#2196F3'};
  }

  ${({ focused }) => focused && `
    outline: ${FOCUS_RING_SIZE} solid ${({ isDarkMode }) => 
      isDarkMode ? 'rgba(144, 202, 249, 0.5)' : 'rgba(33, 150, 243, 0.5)'};
    outline-offset: 2px;
  `}

  &::after {
    content: '';
    display: ${({ checked }) => checked ? 'block' : 'none'};
    width: 6px;
    height: 12px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    margin-top: -2px;
  }
`;

const Label = styled.label<{ isDarkMode: boolean }>`
  margin-left: 8px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 16px;
  color: ${({ isDarkMode }) => isDarkMode ? '#FFFFFF' : '#333333'};
  cursor: inherit;
  user-select: none;
`;

/**
 * Accessible checkbox component with theme support and WCAG compliance
 */
export const Checkbox: React.FC<CheckboxProps> = React.memo(({
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  disabled = false,
  label,
  name,
  id,
  className,
  ariaLabel,
}) => {
  // Hooks
  const { currentTheme } = useTheme();
  const isDarkMode = currentTheme === Theme.DARK;
  const inputRef = useRef<HTMLInputElement>(null);
  
  // State
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const [focused, setFocused] = useState(false);
  
  // Determine if component is controlled
  const isControlled = controlledChecked !== undefined;
  const isChecked = isControlled ? controlledChecked : internalChecked;

  /**
   * Enhanced change event handler with accessibility support
   */
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }

    const newChecked = event.target.checked;

    if (!isControlled) {
      setInternalChecked(newChecked);
    }

    onChange?.(newChecked, event);
  }, [disabled, isControlled, onChange]);

  /**
   * Keyboard event handler for accessibility
   */
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      const newChecked = !isChecked;
      
      if (!isControlled) {
        setInternalChecked(newChecked);
      }
      
      onChange?.(newChecked, event as any);
      
      // Emit click sound for screen readers
      inputRef.current?.click();
    }
  }, [disabled, isChecked, isControlled, onChange]);

  const uniqueId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <CheckboxContainer
      className={className}
      disabled={disabled}
      onClick={() => inputRef.current?.focus()}
      role="presentation"
    >
      <HiddenInput
        ref={inputRef}
        type="checkbox"
        checked={isChecked}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        name={name}
        id={uniqueId}
        aria-label={ariaLabel}
        aria-checked={isChecked}
        aria-disabled={disabled}
      />
      <CheckboxVisual
        checked={isChecked}
        focused={focused}
        isDarkMode={isDarkMode}
        role="presentation"
      />
      {label && (
        <Label
          htmlFor={uniqueId}
          isDarkMode={isDarkMode}
        >
          {label}
        </Label>
      )}
    </CheckboxContainer>
  );
});

Checkbox.displayName = 'Checkbox';