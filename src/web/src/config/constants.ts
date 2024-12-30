// @ts-check
/**
 * Global constants configuration file for the Task Management System
 * @version 1.0.0
 * @package task-management-system
 */

// vite v4.x
import { loadEnv } from 'vite';

// Type definitions for configuration objects
interface ApiEndpoints {
  AUTH: string;
  TASKS: string;
  PROJECTS: string;
  USERS: string;
  FILES: string;
  TEAMS: string;
  REPORTS: string;
  NOTIFICATIONS: string;
  PREFERENCES: string;
}

interface ApiConfig {
  BASE_URL: string;
  TIMEOUT: number;
  RATE_LIMIT: number;
  ENDPOINTS: ApiEndpoints;
}

interface AuthConfig {
  TOKEN_KEY: string;
  REFRESH_TOKEN_KEY: string;
  TOKEN_EXPIRY: number;
  REFRESH_TOKEN_EXPIRY: number;
  MAX_LOGIN_ATTEMPTS: number;
  LOCKOUT_DURATION: number;
  PASSWORD_MIN_LENGTH: number;
  PASSWORD_COMPLEXITY: RegExp;
  MFA_TIMEOUT: number;
  SESSION_TIMEOUT: number;
}

interface Breakpoints {
  MOBILE: number;
  TABLET: number;
  DESKTOP: number;
  LARGE: number;
}

interface PaginationConfig {
  DEFAULT_PAGE_SIZE: number;
  MAX_PAGE_SIZE: number;
  MAX_PAGES: number;
}

interface UiConfig {
  BREAKPOINTS: Breakpoints;
  PAGINATION: PaginationConfig;
  ANIMATION_DURATION: number;
  DEBOUNCE_DELAY: number;
  MAX_FILE_SIZE: number;
  MAX_UPLOAD_FILES: number;
  INFINITE_SCROLL_THRESHOLD: number;
  TOAST_DURATION: number;
  MODAL_TRANSITION: number;
}

interface StorageKeys {
  THEME: string;
  USER_PREFERENCES: string;
  LANGUAGE: string;
  LAST_ROUTE: string;
  RECENT_SEARCHES: string;
  DRAFT_TASKS: string;
  OFFLINE_DATA: string;
  NOTIFICATION_SETTINGS: string;
}

// Global environment variables
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
const API_TIMEOUT = 30000;
const API_RATE_LIMIT = 1000;

/**
 * API configuration settings including endpoints and limits
 */
export const API_CONFIG: ApiConfig = {
  BASE_URL: API_BASE_URL,
  TIMEOUT: API_TIMEOUT,
  RATE_LIMIT: API_RATE_LIMIT,
  ENDPOINTS: {
    AUTH: '/auth',
    TASKS: '/tasks',
    PROJECTS: '/projects',
    USERS: '/users',
    FILES: '/files',
    TEAMS: '/teams',
    REPORTS: '/reports',
    NOTIFICATIONS: '/notifications',
    PREFERENCES: '/preferences'
  }
} as const;

/**
 * Authentication and security configuration
 */
export const AUTH_CONFIG: AuthConfig = {
  TOKEN_KEY: 'task_manager_token',
  REFRESH_TOKEN_KEY: 'task_manager_refresh_token',
  TOKEN_EXPIRY: 3600, // 1 hour in seconds
  REFRESH_TOKEN_EXPIRY: 604800, // 7 days in seconds
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 900, // 15 minutes in seconds
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_COMPLEXITY: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
  MFA_TIMEOUT: 300, // 5 minutes in seconds
  SESSION_TIMEOUT: 1800 // 30 minutes in seconds
} as const;

/**
 * UI configuration constants for responsive design
 */
export const UI_CONFIG: UiConfig = {
  BREAKPOINTS: {
    MOBILE: 320,
    TABLET: 768,
    DESKTOP: 1024,
    LARGE: 1440
  },
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100,
    MAX_PAGES: 1000
  },
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 300,
  MAX_FILE_SIZE: 5242880, // 5MB in bytes
  MAX_UPLOAD_FILES: 10,
  INFINITE_SCROLL_THRESHOLD: 0.8,
  TOAST_DURATION: 3000,
  MODAL_TRANSITION: 200
} as const;

/**
 * Local storage key constants for persistent data
 */
export const STORAGE_KEYS: StorageKeys = {
  THEME: 'task_manager_theme',
  USER_PREFERENCES: 'task_manager_preferences',
  LANGUAGE: 'task_manager_language',
  LAST_ROUTE: 'task_manager_last_route',
  RECENT_SEARCHES: 'task_manager_recent_searches',
  DRAFT_TASKS: 'task_manager_draft_tasks',
  OFFLINE_DATA: 'task_manager_offline_data',
  NOTIFICATION_SETTINGS: 'task_manager_notification_settings'
} as const;

// Type exports for consuming components
export type { ApiConfig, AuthConfig, UiConfig, StorageKeys, Breakpoints, PaginationConfig };