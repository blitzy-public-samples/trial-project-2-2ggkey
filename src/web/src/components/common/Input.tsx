import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import { ValidationError } from '../../types/common.types';
import styles from './Input.module.css';

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Input label text */
  label?: string;
  /** Error message or validation error object */
  error?: string | ValidationError;
  /** Helper text displayed below input */
  helperText?: string;
  /** Content rendered before input */
  startAdornment?: React.ReactNode;
  /** Content rendered after input */
  endAdornment?: React.ReactNode;
  /** Input mask pattern */
  mask?: string | RegExp;
  /** Show character counter */
  showCharCount?: boolean;
  /** Show clear button */
  clearable?: boolean;
}

// =============================================================================
// Component
// =============================================================================

/**
 * A reusable, accessible, and themeable input component that supports various
 * input types, validation states, and customization options.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const {
    label,
    error,
    helperText,
    startAdornment,
    endAdornment,
    mask,
    showCharCount,
    clearable,
    className,
    id: providedId,
    required,
    disabled,
    readOnly,
    value,
    defaultValue,
    maxLength,
    onChange,
    onFocus,
    onBlur,
    ...restProps
  } = props;

  // Generate unique ID for input-label association
  const id = useMemo(() => providedId || `input-${Math.random().toString(36).substr(2, 9)}`, [providedId]);
  
  // Local state for controlled input value
  const [localValue, setLocalValue] = useState<string>((value as string) || defaultValue as string || '');
  
  // Error message handling
  const errorMessage = useMemo(() => {
    if (!error) return '';
    return typeof error === 'string' ? error : error.message;
  }, [error]);

  // Character count
  const charCount = useMemo(() => {
    return localValue.length;
  }, [localValue]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = event.target.value;

    // Apply mask if provided
    if (mask) {
      const maskRegex = typeof mask === 'string' ? new RegExp(mask) : mask;
      if (!maskRegex.test(newValue)) {
        return;
      }
    }

    // Apply maxLength constraint
    if (maxLength && newValue.length > maxLength) {
      newValue = newValue.slice(0, maxLength);
    }

    setLocalValue(newValue);
    onChange?.(event);
  }, [mask, maxLength, onChange]);

  const handleClear = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setLocalValue('');
    const input = document.getElementById(id) as HTMLInputElement;
    if (input) {
      const changeEvent = new Event('change', { bubbles: true });
      input.value = '';
      input.dispatchEvent(changeEvent);
    }
  }, [id]);

  // =============================================================================
  // Effects
  // =============================================================================

  // Sync local value with controlled value
  useEffect(() => {
    if (value !== undefined) {
      setLocalValue(value as string);
    }
  }, [value]);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div
      className={classNames(
        styles['input-container'],
        {
          [styles['input-disabled']]: disabled,
          [styles['input-readonly']]: readOnly,
          [styles['input-error']]: !!error,
        },
        className
      )}
    >
      {label && (
        <label
          htmlFor={id}
          className={styles['input-label']}
        >
          {label}
          {required && <span className={styles['required-indicator']}>*</span>}
        </label>
      )}

      <div className={styles['input-wrapper']}>
        {startAdornment && (
          <div className={styles['adornment-start']}>
            {startAdornment}
          </div>
        )}

        <input
          {...restProps}
          ref={ref}
          id={id}
          value={localValue}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          aria-invalid={!!error}
          aria-describedby={
            classNames({
              [`${id}-error`]: !!error,
              [`${id}-helper`]: !!helperText,
              [`${id}-counter`]: showCharCount,
            })
          }
          className={classNames(
            styles['input-field'],
            {
              [styles['input-with-start-adornment']]: !!startAdornment,
              [styles['input-with-end-adornment']]: !!endAdornment || clearable,
            }
          )}
        />

        {(endAdornment || (clearable && localValue)) && (
          <div className={styles['adornment-end']}>
            {endAdornment}
            {clearable && localValue && (
              <button
                type="button"
                onClick={handleClear}
                className={styles['clear-button']}
                aria-label="Clear input"
                tabIndex={-1}
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error and Helper Text */}
      <div className={styles['input-footer']}>
        {errorMessage && (
          <div
            id={`${id}-error`}
            className={styles['error-message']}
            role="alert"
          >
            {errorMessage}
          </div>
        )}
        
        {helperText && (
          <div
            id={`${id}-helper`}
            className={styles['helper-text']}
          >
            {helperText}
          </div>
        )}

        {showCharCount && (
          <div
            id={`${id}-counter`}
            className={styles['char-counter']}
          >
            {charCount}{maxLength ? `/${maxLength}` : ''}
          </div>
        )}
      </div>
    </div>
  );
});

Input.displayName = 'Input';

export default React.memo(Input);