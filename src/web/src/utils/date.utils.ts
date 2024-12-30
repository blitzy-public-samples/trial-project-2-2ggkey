/**
 * @fileoverview Date utility functions for the Task Management System
 * @version 1.0.0
 * 
 * This module provides comprehensive date manipulation, formatting, validation,
 * and comparison utilities with enhanced error handling and internationalization support.
 * 
 * @packageDocumentation
 */

import { format, isValid, parseISO, differenceInDays } from 'date-fns'; // v2.30.0
import type { ISO8601DateString } from '../types/common.types';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';
export const TIME_FORMAT = 'HH:mm:ss';
export const DATETIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';
export const DISPLAY_DATE_FORMAT = 'MMM dd, yyyy';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a Date object
 * @param value - Value to check
 */
const isDateObject = (value: unknown): value is Date => {
  return value instanceof Date;
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Formats a date string or Date object into a specified format with enhanced error handling
 * and locale support
 * 
 * @param date - Date to format
 * @param formatString - Format string (defaults to DEFAULT_DATE_FORMAT)
 * @param locale - Optional locale for internationalization
 * @returns Formatted date string or empty string if invalid
 * 
 * @example
 * ```ts
 * formatDate(new Date(), 'MMM dd, yyyy') // 'Jan 01, 2024'
 * formatDate('2024-01-01', DATETIME_FORMAT) // '2024-01-01 00:00:00'
 * ```
 */
export const formatDate = (
  date: Date | ISO8601DateString | null,
  formatString: string = DEFAULT_DATE_FORMAT,
  locale?: Locale
): string => {
  try {
    if (!date) {
      return '';
    }

    const dateObject = isDateObject(date) ? date : parseISO(date);

    if (!isValid(dateObject)) {
      console.warn(`Invalid date provided: ${date}`);
      return '';
    }

    return format(dateObject, formatString, { locale });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Validates if a given date string or Date object is valid with enhanced type checking
 * 
 * @param date - Date to validate
 * @returns True if date is valid, false otherwise
 * 
 * @example
 * ```ts
 * isValidDate(new Date()) // true
 * isValidDate('2024-01-01') // true
 * isValidDate('invalid') // false
 * ```
 */
export const isValidDate = (date: Date | ISO8601DateString | null): boolean => {
  try {
    if (!date) {
      return false;
    }

    const dateObject = isDateObject(date) ? date : parseISO(date);
    return isValid(dateObject);
  } catch (error) {
    console.error('Error validating date:', error);
    return false;
  }
};

/**
 * Calculates the difference in days between two dates with timezone handling
 * 
 * @param dateLeft - First date
 * @param dateRight - Second date
 * @returns Absolute number of days difference between dates
 * 
 * @example
 * ```ts
 * getDaysDifference('2024-01-01', '2024-01-05') // 4
 * ```
 */
export const getDaysDifference = (
  dateLeft: Date | ISO8601DateString,
  dateRight: Date | ISO8601DateString
): number => {
  try {
    const date1 = isDateObject(dateLeft) ? dateLeft : parseISO(dateLeft);
    const date2 = isDateObject(dateRight) ? dateRight : parseISO(dateRight);

    if (!isValid(date1) || !isValid(date2)) {
      throw new Error('Invalid date provided');
    }

    return Math.abs(differenceInDays(date1, date2));
  } catch (error) {
    console.error('Error calculating days difference:', error);
    return 0;
  }
};

/**
 * Returns a human-readable relative time string with enhanced granularity
 * 
 * @param date - Date to compare
 * @param locale - Optional locale for internationalization
 * @returns Localized human-readable relative time string
 * 
 * @example
 * ```ts
 * getRelativeTime('2024-01-01') // '2 months ago'
 * ```
 */
export const getRelativeTime = (
  date: Date | ISO8601DateString,
  locale?: Locale
): string => {
  try {
    const dateObject = isDateObject(date) ? date : parseISO(date);

    if (!isValid(dateObject)) {
      throw new Error('Invalid date provided');
    }

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObject.getTime()) / 1000);

    // Define time units in seconds
    const timeUnits = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1
    };

    // Find the appropriate time unit
    for (const [unit, seconds] of Object.entries(timeUnits)) {
      const value = Math.floor(Math.abs(diffInSeconds) / seconds);
      
      if (value >= 1) {
        const formatter = new Intl.RelativeTimeFormat(locale?.code, {
          numeric: 'always',
          style: 'long'
        });
        
        return formatter.format(-value, unit as Intl.RelativeTimeFormatUnit);
      }
    }

    return 'just now';
  } catch (error) {
    console.error('Error generating relative time:', error);
    return '';
  }
};

/**
 * Checks if a date is in the future with timezone consideration
 * 
 * @param date - Date to check
 * @returns True if date is in the future, false otherwise
 * 
 * @example
 * ```ts
 * isFutureDate('2025-01-01') // true
 * ```
 */
export const isFutureDate = (date: Date | ISO8601DateString): boolean => {
  try {
    const dateObject = isDateObject(date) ? date : parseISO(date);

    if (!isValid(dateObject)) {
      throw new Error('Invalid date provided');
    }

    const now = new Date();
    return dateObject.getTime() > now.getTime();
  } catch (error) {
    console.error('Error checking future date:', error);
    return false;
  }
};