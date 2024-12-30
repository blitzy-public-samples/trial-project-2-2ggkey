/**
 * @fileoverview Authentication types and interfaces for the Task Management System
 * @version 1.0.0
 * Implements secure authentication and authorization types with comprehensive security considerations
 */

import { ApiResponse, Theme } from './common.types';

// ============================================================================
// Enums
// ============================================================================

/**
 * User roles with hierarchical access levels
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
  GUEST = 'GUEST'
}

/**
 * Comprehensive authentication error types for detailed error handling
 */
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  EMAIL_EXISTS = 'EMAIL_EXISTS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  MFA_INVALID = 'MFA_INVALID',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  RATE_LIMITED = 'RATE_LIMITED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_CAPTCHA = 'INVALID_CAPTCHA',
  SESSION_EXPIRED = 'SESSION_EXPIRED'
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Core user interface with security considerations
 */
export interface User {
  readonly id: string;
  readonly email: string;
  name: string;
  readonly role: UserRole;
  readonly permissions: string[];
  mfaEnabled: boolean;
  preferences: UserPreferences;
  lastLoginAt: string;
  readonly createdAt: string;
  updatedAt: string;
}

/**
 * User preferences with security settings
 */
export interface UserPreferences {
  theme: Theme;
  notifications: NotificationSettings;
  language: string;
  sessionTimeout: number;
  securityAlerts: boolean;
}

/**
 * Granular notification preferences
 */
export interface NotificationSettings {
  email: boolean;
  browser: boolean;
  securityAlerts: boolean;
  loginAlerts: boolean;
}

/**
 * Secure login credentials with MFA support
 */
export interface LoginCredentials {
  email: string;
  password: string;
  totpCode?: string;
  rememberMe?: boolean;
  deviceId?: string;
}

/**
 * Secure registration credentials with validation
 */
export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  confirmPassword: string;
  acceptTerms: boolean;
  captchaToken: string;
}

/**
 * Authentication response with token management
 */
export interface AuthResponse {
  user: Readonly<User>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  mfaRequired: boolean;
}

/**
 * Authentication state management
 */
export interface AuthState {
  user: Readonly<User> | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: AuthError | null;
  mfaPending: boolean;
  sessionExpiry: number | null;
}

/**
 * Comprehensive authentication error handling
 */
export interface AuthError {
  type: AuthErrorType;
  message: string;
  field?: string;
  timestamp: number;
  requestId?: string;
  attempts?: number;
}

// ============================================================================
// Types
// ============================================================================

/**
 * JWT token payload with security claims
 */
export type AuthTokenPayload = {
  userId: string;
  email: string;
  role: UserRole;
  permissions: string[];
  exp: number;
  iat: number;
  deviceId: string;
  sessionId: string;
};

/**
 * Type for authentication API responses
 */
export type AuthApiResponse<T> = ApiResponse<T>;

/**
 * Type guard for checking if a user has admin privileges
 */
export type IsAdmin = (user: User) => boolean;

/**
 * Type for permission checking
 */
export type HasPermission = (user: User, permission: string) => boolean;

// ============================================================================
// Constants
// ============================================================================

/**
 * Default session timeout in minutes
 */
export const DEFAULT_SESSION_TIMEOUT = 30;

/**
 * Maximum failed login attempts before account lockout
 */
export const MAX_LOGIN_ATTEMPTS = 5;

/**
 * Token expiration time in seconds
 */
export const TOKEN_EXPIRATION = 3600; // 1 hour