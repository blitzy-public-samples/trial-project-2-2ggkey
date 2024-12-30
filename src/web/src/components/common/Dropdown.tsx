/**
 * @fileoverview A reusable, accessible, and theme-aware dropdown component
 * @version 1.0.0
 * 
 * Features:
 * - WCAG 2.1 Level AA compliance
 * - Keyboard navigation support
 * - Dynamic theme adaptation
 * - Search functionality
 * - Single/Multi select support
 */

import React, { 
  useState, 
  useCallback, 
  useMemo, 
  useRef, 
  useEffect 
} from 'react';
import classNames from 'classnames';
import { Theme } from '../../types/common.types';
import { useTheme } from '../../hooks/useTheme';

// Constants for keyboard navigation
const KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  HOME: 'Home',
  END: 'End',
  TAB: 'Tab'
};

// Interface for dropdown options
export interface DropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

// Props interface with comprehensive options
export interface DropdownProps {
  options: DropdownOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  multiple?: boolean;
  searchable?: boolean;
  className?: string;
  themeOverride?: Theme;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/**
 * Dropdown component with accessibility and theme support
 */
export const Dropdown = React.memo(({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  error,
  multiple = false,
  searchable = false,
  className,
  themeOverride,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy
}: DropdownProps) => {
  // Hooks and refs
  const { currentTheme, isDarkMode, themeTransitioning } = useTheme();
  const theme = themeOverride || currentTheme;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [announceMessage, setAnnounceMessage] = useState('');

  // Computed values
  const selectedOptions = useMemo(() => {
    return Array.isArray(value) 
      ? options.filter(opt => value.includes(String(opt.value)))
      : options.find(opt => String(opt.value) === value);
  }, [value, options]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(option => 
      option.label.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Handle dropdown toggle
  const toggleDropdown = useCallback(() => {
    if (!disabled) {
      setIsOpen(prev => !prev);
      setSearchQuery('');
      setFocusedIndex(-1);
    }
  }, [disabled]);

  // Handle option selection
  const handleOptionSelect = useCallback((option: DropdownOption) => {
    if (option.disabled) return;

    if (multiple) {
      const newValue = Array.isArray(value) ? [...value] : [];
      const optionValue = String(option.value);
      
      if (newValue.includes(optionValue)) {
        onChange(newValue.filter(v => v !== optionValue));
      } else {
        onChange([...newValue, optionValue]);
      }
    } else {
      onChange(String(option.value));
      setIsOpen(false);
    }

    // Announce selection to screen readers
    setAnnounceMessage(`Selected ${option.label}`);
  }, [multiple, value, onChange]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case KEYS.ENTER:
      case KEYS.SPACE:
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (focusedIndex >= 0) {
          handleOptionSelect(filteredOptions[focusedIndex]);
        }
        break;

      case KEYS.ESCAPE:
        setIsOpen(false);
        dropdownRef.current?.focus();
        break;

      case KEYS.ARROW_UP:
        event.preventDefault();
        setFocusedIndex(prev => 
          prev <= 0 ? filteredOptions.length - 1 : prev - 1
        );
        break;

      case KEYS.ARROW_DOWN:
        event.preventDefault();
        setFocusedIndex(prev => 
          prev >= filteredOptions.length - 1 ? 0 : prev + 1
        );
        break;

      case KEYS.HOME:
        event.preventDefault();
        setFocusedIndex(0);
        break;

      case KEYS.END:
        event.preventDefault();
        setFocusedIndex(filteredOptions.length - 1);
        break;
    }
  }, [disabled, isOpen, focusedIndex, filteredOptions, handleOptionSelect]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus management
  useEffect(() => {
    if (isOpen && searchable) {
      searchInputRef.current?.focus();
    }
  }, [isOpen, searchable]);

  // Generate class names
  const dropdownClasses = classNames(
    'dropdown',
    {
      'dropdown--open': isOpen,
      'dropdown--disabled': disabled,
      'dropdown--error': error,
      'dropdown--dark': isDarkMode,
      'dropdown--transitioning': themeTransitioning
    },
    className
  );

  return (
    <div
      ref={dropdownRef}
      className={dropdownClasses}
      tabIndex={disabled ? -1 : 0}
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-controls="dropdown-options"
      onKeyDown={handleKeyDown}
      onClick={toggleDropdown}
    >
      <div className="dropdown__selected">
        {multiple ? (
          Array.isArray(selectedOptions) && selectedOptions.length > 0 ? (
            <div className="dropdown__multi-value">
              {selectedOptions.map(option => (
                <span key={option.value} className="dropdown__tag">
                  {option.icon && <span className="dropdown__tag-icon">{option.icon}</span>}
                  {option.label}
                </span>
              ))}
            </div>
          ) : (
            <span className="dropdown__placeholder">{placeholder}</span>
          )
        ) : (
          selectedOptions ? (
            <span className="dropdown__single-value">
              {selectedOptions.icon && (
                <span className="dropdown__value-icon">{selectedOptions.icon}</span>
              )}
              {selectedOptions.label}
            </span>
          ) : (
            <span className="dropdown__placeholder">{placeholder}</span>
          )
        )}
      </div>

      {isOpen && (
        <div 
          className="dropdown__menu" 
          role="listbox"
          id="dropdown-options"
          aria-multiselectable={multiple}
        >
          {searchable && (
            <div className="dropdown__search">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                aria-label="Search options"
                onClick={e => e.stopPropagation()}
              />
            </div>
          )}

          {filteredOptions.map((option, index) => (
            <div
              key={option.value}
              className={classNames('dropdown__option', {
                'dropdown__option--selected': multiple 
                  ? Array.isArray(value) && value.includes(String(option.value))
                  : String(option.value) === value,
                'dropdown__option--focused': index === focusedIndex,
                'dropdown__option--disabled': option.disabled
              })}
              role="option"
              aria-selected={multiple 
                ? Array.isArray(value) && value.includes(String(option.value))
                : String(option.value) === value}
              aria-disabled={option.disabled}
              onClick={e => {
                e.stopPropagation();
                handleOptionSelect(option);
              }}
            >
              {option.icon && <span className="dropdown__option-icon">{option.icon}</span>}
              {option.label}
            </div>
          ))}
        </div>
      )}

      {/* Announcer for screen readers */}
      <div 
        role="status" 
        aria-live="polite" 
        className="dropdown__announcer"
      >
        {announceMessage}
      </div>

      {error && (
        <div className="dropdown__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
});

Dropdown.displayName = 'Dropdown';