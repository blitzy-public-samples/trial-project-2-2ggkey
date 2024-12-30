import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames'; // v2.3.2
import { DatePicker as MuiDatePicker, LocalizationProvider } from '@mui/x-date-pickers'; // v6.0.0
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'; // v6.0.0
import { parseISO } from 'date-fns'; // v2.30.0
import type { BaseProps } from '../../types/common.types';
import type { DateString } from '../../types/common.types';
import { formatDate, isValidDate } from '../../utils/date.utils';
import Input from './Input';
import styles from './DatePicker.module.css';

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface DatePickerProps extends BaseProps {
  /** Input name attribute */
  name: string;
  /** Selected date value */
  value: DateString | null;
  /** Label text for the date picker */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Minimum selectable date */
  minDate?: DateString;
  /** Maximum selectable date */
  maxDate?: DateString;
  /** Disabled state */
  disabled?: boolean;
  /** Required field indicator */
  required?: boolean;
  /** Change handler function */
  onChange: (date: DateString | null) => void;
  /** Blur event handler */
  onBlur?: () => void;
  /** Custom date format string */
  format?: string;
  /** Locale identifier for formatting */
  locale?: string;
  /** Timezone identifier */
  timezone?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * A reusable date picker component that provides a consistent date selection
 * interface with Material Design styling, accessibility support, and validation.
 */
const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>((props, ref) => {
  const {
    name,
    value,
    label,
    error,
    minDate,
    maxDate,
    disabled,
    required,
    onChange,
    onBlur,
    format = 'yyyy-MM-dd',
    locale = 'en-US',
    timezone,
    className,
    style,
  } = props;

  // =============================================================================
  // Memoized Values
  // =============================================================================

  const dateAdapter = useMemo(() => {
    return new AdapterDateFns({ locale: new Intl.Locale(locale) });
  }, [locale]);

  const containerClassName = useMemo(() => {
    return classNames(
      styles['datepicker-container'],
      {
        [styles['datepicker--error']]: !!error,
        [styles['datepicker--disabled']]: disabled,
        [styles['datepicker--rtl']]: new Intl.Locale(locale).textInfo.direction === 'rtl',
      },
      className
    );
  }, [className, error, disabled, locale]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleDateChange = useCallback((newDate: Date | null) => {
    if (!newDate) {
      onChange(null);
      return;
    }

    // Validate date range
    if (minDate && newDate < parseISO(minDate)) {
      onChange(null);
      return;
    }

    if (maxDate && newDate > parseISO(maxDate)) {
      onChange(null);
      return;
    }

    // Format date with timezone consideration
    const formattedDate = formatDate(newDate, format);
    onChange(formattedDate);
  }, [onChange, minDate, maxDate, format]);

  const handleBlur = useCallback(() => {
    // Validate required field
    if (required && !value) {
      onBlur?.();
      return;
    }

    // Validate date format
    if (value && !isValidDate(value)) {
      onChange(null);
    }

    onBlur?.();
  }, [required, value, onChange, onBlur]);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div
      ref={ref}
      className={containerClassName}
      style={style}
    >
      <LocalizationProvider dateAdapter={dateAdapter}>
        <MuiDatePicker
          value={value ? parseISO(value) : null}
          onChange={handleDateChange}
          renderInput={(params) => (
            <Input
              {...params}
              name={name}
              label={label}
              error={error}
              required={required}
              disabled={disabled}
              onBlur={handleBlur}
              className={styles.datepicker}
              aria-label={label || 'Date picker'}
              aria-invalid={!!error}
              aria-required={required}
              data-testid="date-picker-input"
            />
          )}
          disabled={disabled}
          minDate={minDate ? parseISO(minDate) : undefined}
          maxDate={maxDate ? parseISO(maxDate) : undefined}
          disableHighlightToday={false}
          showTodayButton
          clearable
          inputFormat={format}
          mask="____-__-__"
          toolbarFormat={format}
          showToolbar
          OpenPickerButtonProps={{
            'aria-label': 'Open date picker',
            className: styles['calendar-icon'],
          }}
          PaperProps={{
            className: styles['datepicker-popup'],
            elevation: 8,
          }}
          DialogProps={{
            'aria-label': 'Date picker dialog',
          }}
        />
      </LocalizationProvider>
      {error && (
        <div 
          className={styles.error}
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
});

DatePicker.displayName = 'DatePicker';

export default React.memo(DatePicker);