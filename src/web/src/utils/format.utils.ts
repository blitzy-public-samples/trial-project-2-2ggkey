/**
 * @fileoverview Comprehensive utility functions for formatting various data types
 * including task statuses, priorities, and other data formats
 * @version 1.0.0
 */

import numeral from 'numeral'; // v2.0.6
import { TaskStatus, TaskPriority } from '../types/task.types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Mapping of task statuses to their human-readable display values
 */
const STATUS_DISPLAY_MAP: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'To Do',
  [TaskStatus.IN_PROGRESS]: 'In Progress',
  [TaskStatus.IN_REVIEW]: 'In Review',
  [TaskStatus.COMPLETED]: 'Completed',
  [TaskStatus.BLOCKED]: 'Blocked',
  [TaskStatus.ARCHIVED]: 'Archived'
};

/**
 * Mapping of task priorities to their human-readable display values
 */
const PRIORITY_DISPLAY_MAP: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: 'Low Priority',
  [TaskPriority.MEDIUM]: 'Medium Priority',
  [TaskPriority.HIGH]: 'High Priority',
  [TaskPriority.URGENT]: 'Urgent',
  [TaskPriority.CRITICAL]: 'Critical'
};

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Formats a number with specified decimal places and thousands separators
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number string
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  return numeral(value).format(`0,0.${Array(decimals).fill('0').join('')}`);
};

/**
 * Formats a number as a percentage
 * @param value - The decimal value to format as percentage (e.g., 0.75 for 75%)
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, decimals: number = 0): string => {
  return numeral(value).format(`0,0.${Array(decimals).fill('0').join('')}`) + '%';
};

/**
 * Formats a number as currency (USD)
 * @param value - The number to format as currency
 * @param showCents - Whether to show cents (default: true)
 * @returns Formatted currency string
 */
export const formatCurrency = (value: number, showCents: boolean = true): string => {
  return numeral(value).format(`$0,0${showCents ? '.00' : ''}`);
};

// ============================================================================
// Task Status Formatting
// ============================================================================

/**
 * Formats a task status enum value into a human-readable string
 * @param status - The TaskStatus enum value to format
 * @returns Formatted and localized status string
 * @throws Error if status is invalid
 */
export const formatTaskStatus = (status: TaskStatus): string => {
  if (!(status in STATUS_DISPLAY_MAP)) {
    throw new Error(`Invalid task status: ${status}`);
  }
  return STATUS_DISPLAY_MAP[status];
};

/**
 * Gets the CSS class name for a task status
 * @param status - The TaskStatus enum value
 * @returns CSS class name for styling
 */
export const getTaskStatusClassName = (status: TaskStatus): string => {
  const baseClass = 'task-status';
  switch (status) {
    case TaskStatus.TODO:
      return `${baseClass} status-todo`;
    case TaskStatus.IN_PROGRESS:
      return `${baseClass} status-in-progress`;
    case TaskStatus.IN_REVIEW:
      return `${baseClass} status-in-review`;
    case TaskStatus.COMPLETED:
      return `${baseClass} status-completed`;
    case TaskStatus.BLOCKED:
      return `${baseClass} status-blocked`;
    case TaskStatus.ARCHIVED:
      return `${baseClass} status-archived`;
    default:
      return baseClass;
  }
};

// ============================================================================
// Task Priority Formatting
// ============================================================================

/**
 * Formats a task priority enum value into a human-readable string
 * @param priority - The TaskPriority enum value to format
 * @returns Formatted and localized priority string
 * @throws Error if priority is invalid
 */
export const formatTaskPriority = (priority: TaskPriority): string => {
  if (!(priority in PRIORITY_DISPLAY_MAP)) {
    throw new Error(`Invalid task priority: ${priority}`);
  }
  return PRIORITY_DISPLAY_MAP[priority];
};

/**
 * Gets the CSS class name for a task priority
 * @param priority - The TaskPriority enum value
 * @returns CSS class name for styling
 */
export const getTaskPriorityClassName = (priority: TaskPriority): string => {
  const baseClass = 'task-priority';
  switch (priority) {
    case TaskPriority.LOW:
      return `${baseClass} priority-low`;
    case TaskPriority.MEDIUM:
      return `${baseClass} priority-medium`;
    case TaskPriority.HIGH:
      return `${baseClass} priority-high`;
    case TaskPriority.URGENT:
      return `${baseClass} priority-urgent`;
    case TaskPriority.CRITICAL:
      return `${baseClass} priority-critical`;
    default:
      return baseClass;
  }
};

// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Formats a date string or Date object into a localized date string
 * @param date - Date string or Date object to format
 * @param options - Intl.DateTimeFormatOptions for customizing the output
 * @returns Formatted date string
 */
export const formatDate = (
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', options).format(dateObj);
};

/**
 * Formats a duration in hours into a human-readable string
 * @param hours - Number of hours
 * @returns Formatted duration string
 */
export const formatDuration = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)} minutes`;
  }
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (minutes === 0) {
    return `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'}`;
  }
  return `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'} ${minutes} minutes`;
};