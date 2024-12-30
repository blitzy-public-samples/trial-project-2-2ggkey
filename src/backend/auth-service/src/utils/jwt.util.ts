// @package jsonwebtoken ^9.0.0

import { sign, verify, JwtPayload } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { jwtConfig } from '../config/auth.config';

/**
 * Token types supported by the system
 */
export type TokenType = 'access' | 'refresh';

/**
 * Enhanced interface for JWT token payload with additional security fields
 */
export interface TokenPayload extends JwtPayload {
  id: string;
  email: string;
  role: string;
  type: TokenType;
  fingerprint?: string;
  jti: string;
}

/**
 * Enhanced interface for token generation response with additional security metadata
 */
export interface TokenResponse {
  token: string;
  expiresIn: string;
  fingerprint?: string;
  tokenId: string;
}

/**
 * Security constants for token management
 */
const SECURITY_CONSTANTS = {
  FINGERPRINT_LENGTH: 32,
  TOKEN_ID_LENGTH: 24,
  MAX_TOKEN_AGE: 86400 // 24 hours in seconds
} as const;

/**
 * Token type constants
 */
const TOKEN_TYPES = {
  ACCESS: 'access' as const,
  REFRESH: 'refresh' as const
};

/**
 * Generates a cryptographically secure token fingerprint
 * Used for additional token validation layer
 * @returns A base64 encoded random string
 */
const generateTokenFingerprint = (): string => {
  const randomString = randomBytes(SECURITY_CONSTANTS.FINGERPRINT_LENGTH);
  return randomString
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, SECURITY_CONSTANTS.FINGERPRINT_LENGTH);
};

/**
 * Generates a unique token identifier
 * @returns A random string to be used as token ID
 */
const generateTokenId = (): string => {
  return randomBytes(SECURITY_CONSTANTS.TOKEN_ID_LENGTH)
    .toString('hex')
    .slice(0, SECURITY_CONSTANTS.TOKEN_ID_LENGTH);
};

/**
 * Generates a secure JWT access token with enhanced security features
 * @param payload The token payload containing user information
 * @returns Promise resolving to token response with security metadata
 */
export const generateAccessToken = async (
  payload: Omit<TokenPayload, 'type' | 'fingerprint' | 'jti' | 'iat' | 'exp'>
): Promise<TokenResponse> => {
  const tokenId = generateTokenId();
  const fingerprint = jwtConfig.tokenFingerprint ? generateTokenFingerprint() : undefined;

  const tokenPayload: TokenPayload = {
    ...payload,
    type: TOKEN_TYPES.ACCESS,
    fingerprint,
    jti: tokenId
  };

  const token = sign(tokenPayload, jwtConfig.accessTokenSecret, {
    expiresIn: jwtConfig.accessTokenExpiry,
    algorithm: 'HS256'
  });

  return {
    token,
    expiresIn: jwtConfig.accessTokenExpiry,
    fingerprint,
    tokenId
  };
};

/**
 * Comprehensive token verification with enhanced security checks
 * @param token The JWT token to verify
 * @param type Expected token type
 * @param fingerprint Optional token fingerprint for additional validation
 * @returns Promise resolving to verified token payload
 * @throws Error if token is invalid or verification fails
 */
export const verifyToken = async (
  token: string,
  type: TokenType,
  fingerprint?: string
): Promise<TokenPayload> => {
  const secret = type === TOKEN_TYPES.ACCESS 
    ? jwtConfig.accessTokenSecret 
    : jwtConfig.refreshTokenSecret;

  try {
    const decoded = verify(token, secret) as TokenPayload;

    // Validate token type
    if (decoded.type !== type) {
      throw new Error('Invalid token type');
    }

    // Validate token fingerprint if enabled
    if (jwtConfig.tokenFingerprint && fingerprint) {
      if (decoded.fingerprint !== fingerprint) {
        throw new Error('Invalid token fingerprint');
      }
    }

    // Validate token age
    const tokenAge = (Date.now() / 1000) - (decoded.iat || 0);
    if (tokenAge > SECURITY_CONSTANTS.MAX_TOKEN_AGE) {
      throw new Error('Token has exceeded maximum age');
    }

    return decoded;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
    throw new Error('Token verification failed');
  }
};

/**
 * Securely rotates refresh tokens with comprehensive validation
 * @param oldToken Current refresh token
 * @param payload User payload for new token
 * @returns Promise resolving to new token response
 * @throws Error if old token is invalid or rotation fails
 */
export const rotateRefreshToken = async (
  oldToken: string,
  payload: Omit<TokenPayload, 'type' | 'fingerprint' | 'jti' | 'iat' | 'exp'>
): Promise<TokenResponse> => {
  // Verify old token first
  await verifyToken(oldToken, TOKEN_TYPES.REFRESH);

  const tokenId = generateTokenId();
  const fingerprint = jwtConfig.tokenFingerprint ? generateTokenFingerprint() : undefined;

  const tokenPayload: TokenPayload = {
    ...payload,
    type: TOKEN_TYPES.REFRESH,
    fingerprint,
    jti: tokenId
  };

  const token = sign(tokenPayload, jwtConfig.refreshTokenSecret, {
    expiresIn: jwtConfig.refreshTokenExpiry,
    algorithm: 'HS256'
  });

  return {
    token,
    expiresIn: jwtConfig.refreshTokenExpiry,
    fingerprint,
    tokenId
  };
};