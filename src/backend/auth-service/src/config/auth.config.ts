// @package dotenv ^16.0.0
import dotenv from 'dotenv';

// Initialize environment variables
dotenv.config();

/**
 * Validates all required environment variables for authentication configuration
 * Throws detailed error if any security-critical variables are missing or invalid
 */
const validateEnvironmentVariables = (): void => {
  const requiredVars = [
    'JWT_ACCESS_TOKEN_SECRET',
    'JWT_REFRESH_TOKEN_SECRET',
    'AUTH0_DOMAIN',
    'AUTH0_CLIENT_ID',
    'AUTH0_CLIENT_SECRET',
    'MFA_ISSUER',
    'MFA_SECRET_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate minimum length for security-critical variables
  if (process.env.JWT_ACCESS_TOKEN_SECRET!.length < 32) {
    throw new Error('JWT_ACCESS_TOKEN_SECRET must be at least 32 characters long');
  }
  if (process.env.JWT_REFRESH_TOKEN_SECRET!.length < 32) {
    throw new Error('JWT_REFRESH_TOKEN_SECRET must be at least 32 characters long');
  }
  if (process.env.MFA_SECRET_KEY!.length < 32) {
    throw new Error('MFA_SECRET_KEY must be at least 32 characters long');
  }
};

// Validate environment variables on module load
validateEnvironmentVariables();

// Constants for default configuration values
export const DEFAULT_ACCESS_TOKEN_EXPIRY = '15m';
export const DEFAULT_REFRESH_TOKEN_EXPIRY = '7d';
export const DEFAULT_PASSWORD_SALT_ROUNDS = 12;
export const DEFAULT_PASSWORD_MIN_LENGTH = 8;
export const DEFAULT_PASSWORD_MAX_LENGTH = 64;
export const DEFAULT_MAX_LOGIN_ATTEMPTS = 5;
export const DEFAULT_ACCOUNT_LOCK_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
export const DEFAULT_MFA_DIGITS = 6;
export const DEFAULT_MFA_STEP = 30;
export const DEFAULT_MFA_WINDOW = 1;
export const DEFAULT_MFA_BACKUP_CODES = 10;
export const DEFAULT_JWT_ALGORITHM = 'HS256';
export const DEFAULT_TOTP_ALGORITHM = 'SHA1';

/**
 * JWT token configuration including separate access/refresh token management
 */
export const jwtConfig = {
  accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET!,
  refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET!,
  accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || DEFAULT_ACCESS_TOKEN_EXPIRY,
  refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || DEFAULT_REFRESH_TOKEN_EXPIRY,
  algorithm: DEFAULT_JWT_ALGORITHM,
  issuer: process.env.JWT_ISSUER || 'task-management-system'
} as const;

/**
 * Enhanced password security configuration with comprehensive policy settings
 */
export const passwordConfig = {
  saltRounds: Number(process.env.PASSWORD_SALT_ROUNDS) || DEFAULT_PASSWORD_SALT_ROUNDS,
  minLength: Number(process.env.PASSWORD_MIN_LENGTH) || DEFAULT_PASSWORD_MIN_LENGTH,
  maxLength: Number(process.env.PASSWORD_MAX_LENGTH) || DEFAULT_PASSWORD_MAX_LENGTH,
  maxAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS) || DEFAULT_MAX_LOGIN_ATTEMPTS,
  lockDuration: Number(process.env.ACCOUNT_LOCK_DURATION) || DEFAULT_ACCOUNT_LOCK_DURATION,
  requireSpecialChar: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
  requireNumber: process.env.PASSWORD_REQUIRE_NUMBER !== 'false'
} as const;

/**
 * OAuth 2.0/OIDC configuration for Auth0 integration with enhanced security parameters
 */
export const oauthConfig = {
  auth0Domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  callbackUrl: process.env.AUTH0_CALLBACK_URL || 'http://localhost:3000/auth/callback',
  scope: process.env.AUTH0_SCOPE || 'openid profile email',
  audience: process.env.AUTH0_AUDIENCE || 'https://api.taskmanagement.com'
} as const;

/**
 * Comprehensive MFA/TOTP configuration with enhanced security settings
 */
export const mfaConfig = {
  issuer: process.env.MFA_ISSUER || 'TaskManagementSystem',
  digits: Number(process.env.MFA_DIGITS) || DEFAULT_MFA_DIGITS,
  step: Number(process.env.MFA_STEP) || DEFAULT_MFA_STEP,
  window: Number(process.env.MFA_WINDOW) || DEFAULT_MFA_WINDOW,
  backupCodesCount: Number(process.env.MFA_BACKUP_CODES) || DEFAULT_MFA_BACKUP_CODES,
  algorithm: process.env.MFA_ALGORITHM || DEFAULT_TOTP_ALGORITHM
} as const;

// Type definitions for exported configurations
export type JWTConfig = typeof jwtConfig;
export type PasswordConfig = typeof passwordConfig;
export type OAuthConfig = typeof oauthConfig;
export type MFAConfig = typeof mfaConfig;