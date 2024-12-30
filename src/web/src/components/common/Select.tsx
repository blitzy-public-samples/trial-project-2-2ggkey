import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Theme } from '../../types/common.types';
import styles from './Select.module.css';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps {
  /** Array of options to display in the select */
  options: SelectOption[];
  /** Currently selected value(s) */
  value: string | string[] | null;
  /** Callback fired when selection changes */
  onChange: (value: string | string[]) => void;
  /** Enable multiple selection mode */
  multiple?: boolean;
  /** Disable the entire select component */
  disabled?: boolean;
  /** Placeholder text when no option is selected */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Error message to display */
  error?: string;
  /** Mark select as required field */
  required?: boolean;
  /** Enable virtualization for large lists */
  virtualScroll?: boolean;
  /** Maximum height of dropdown in pixels */
  maxHeight?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_HEIGHT = 300;
const VIRTUAL_SCROLL_ITEM_HEIGHT = 40;
const DEBOUNCE_DELAY = 150;

// ============================================================================
// Component
// ============================================================================

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  multiple = false,
  disabled = false,
  placeholder = 'Select an option',
  className,
  error,
  required = false,
  virtualScroll = false,
  maxHeight = DEFAULT_MAX_HEIGHT,
}) => {
  // ============================================================================
  // Hooks & Refs
  // ============================================================================
  
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<Theme>(Theme.LIGHT);
  
  const selectRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    // Detect system theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? Theme.DARK : Theme.LIGHT);
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    setTheme(mediaQuery.matches ? Theme.DARK : Theme.LIGHT);

    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, []);

  useEffect(() => {
    // Handle click outside to close dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleChange = useCallback((selectedValue: string | string[]) => {
    if (disabled) return;

    const newValue = multiple 
      ? Array.isArray(selectedValue) ? selectedValue : [selectedValue]
      : selectedValue;

    onChange(newValue);
    if (!multiple) {
      setIsOpen(false);
    }
  }, [disabled, multiple, onChange]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = focusedIndex + direction;
        
        if (nextIndex >= 0 && nextIndex < options.length) {
          setFocusedIndex(nextIndex);
          // Scroll into view if using virtualization
          if (virtualScroll && dropdownRef.current) {
            const itemOffset = nextIndex * VIRTUAL_SCROLL_ITEM_HEIGHT;
            dropdownRef.current.scrollTop = itemOffset;
          }
        }
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (focusedIndex >= 0) {
          const option = options[focusedIndex];
          if (!option.disabled) {
            const newValue = multiple
              ? Array.isArray(value)
                ? value.includes(option.value.toString())
                  ? value.filter(v => v !== option.value.toString())
                  : [...value, option.value.toString()]
                : [option.value.toString()]
              : option.value.toString();
            handleChange(newValue);
          }
        }
        break;
      }
      case 'Escape': {
        event.preventDefault();
        setIsOpen(false);
        break;
      }
      case 'Tab': {
        setIsOpen(false);
        break;
      }
      default: {
        // Type to select functionality
        if (event.key.length === 1) {
          const char = event.key.toLowerCase();
          setSearchQuery(prev => prev + char);
          
          if (searchTimeout.current) {
            clearTimeout(searchTimeout.current);
          }
          
          searchTimeout.current = setTimeout(() => {
            setSearchQuery('');
          }, 500);

          const matchingIndex = options.findIndex(option =>
            option.label.toLowerCase().startsWith(searchQuery + char)
          );

          if (matchingIndex >= 0) {
            setFocusedIndex(matchingIndex);
          }
        }
      }
    }
  }, [disabled, focusedIndex, handleChange, isOpen, multiple, options, searchQuery, value, virtualScroll]);

  // ============================================================================
  // Render Helpers
  // ============================================================================

  const renderOption = (option: SelectOption, index: number) => {
    const isSelected = multiple
      ? Array.isArray(value) && value.includes(option.value.toString())
      : value === option.value.toString();

    const optionClassName = classNames(styles['select-option'], {
      [styles['select-option-selected']]: isSelected,
      [styles['select-option-focused']]: index === focusedIndex,
      [styles['select-option-disabled']]: option.disabled,
    });

    return (
      <li
        key={option.value}
        className={optionClassName}
        role="option"
        aria-selected={isSelected}
        aria-disabled={option.disabled}
        onClick={() => {
          if (!option.disabled) {
            const newValue = multiple
              ? Array.isArray(value)
                ? value.includes(option.value.toString())
                  ? value.filter(v => v !== option.value.toString())
                  : [...value, option.value.toString()]
                : [option.value.toString()]
              : option.value.toString();
            handleChange(newValue);
          }
        }}
      >
        {multiple && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            disabled={option.disabled}
            className={styles['select-checkbox']}
          />
        )}
        <span className={styles['select-option-label']}>{option.label}</span>
      </li>
    );
  };

  // ============================================================================
  // Render
  // ============================================================================

  const containerClassName = classNames(
    styles['select-container'],
    {
      [styles['select-disabled']]: disabled,
      [styles['select-error']]: error,
      [styles[`select-theme-${theme.toLowerCase()}`]]: true,
    },
    className
  );

  return (
    <div
      ref={selectRef}
      className={containerClassName}
      onKeyDown={handleKeyDown}
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-disabled={disabled}
      aria-required={required}
      aria-invalid={!!error}
      tabIndex={disabled ? -1 : 0}
    >
      <div
        className={styles['select-value']}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {multiple && Array.isArray(value) && value.length > 0 ? (
          <span className={styles['select-multiple-value']}>
            {value.length} selected
          </span>
        ) : value ? (
          options.find(opt => opt.value.toString() === value)?.label
        ) : (
          <span className={styles['select-placeholder']}>{placeholder}</span>
        )}
        <span className={styles['select-arrow']} aria-hidden="true" />
      </div>

      {isOpen && (
        <ul
          ref={dropdownRef}
          className={styles['select-dropdown']}
          role="listbox"
          aria-multiselectable={multiple}
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {virtualScroll ? (
            <div
              className={styles['select-virtual-scroll']}
              style={{ height: options.length * VIRTUAL_SCROLL_ITEM_HEIGHT }}
            >
              {options
                .slice(
                  Math.floor(dropdownRef.current?.scrollTop ?? 0 / VIRTUAL_SCROLL_ITEM_HEIGHT),
                  Math.ceil((dropdownRef.current?.scrollTop ?? 0 + maxHeight) / VIRTUAL_SCROLL_ITEM_HEIGHT)
                )
                .map((option, index) => renderOption(option, index))}
            </div>
          ) : (
            options.map((option, index) => renderOption(option, index))
          )}
        </ul>
      )}

      {error && (
        <div className={styles['select-error-message']} role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default Select;