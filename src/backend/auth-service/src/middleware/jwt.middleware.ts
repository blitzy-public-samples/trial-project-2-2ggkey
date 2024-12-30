// @package express ^4.18.0
// @package redis ^4.0.0

import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { verifyToken, TokenPayload } from '../utils/jwt.util';
import { jwtConfig } from '../config/auth.config';

/**
 * Extended Express Request interface with enhanced user and security context
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    sessionId: string;
    fingerprint: string;
  };
  securityContext?: {
    tokenIssueTime: number;
    tokenExpiry: number;
    clientIp: string;
    userAgent: string;
  };
}

// Security constants for token validation
const BEARER_PREFIX = 'Bearer ';
const TOKEN_REGEX = /^Bearer\s[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/;
const CACHE_TTL = 300; // 5 minutes in seconds

// Error messages and codes for consistent error handling
const ERROR_MESSAGES = {
  MISSING_AUTH_HEADER: 'Authorization header is required',
  INVALID_TOKEN_FORMAT: 'Invalid token format or structure',
  INVALID_TOKEN: 'Invalid or expired token',
  MISSING_FINGERPRINT: 'Client fingerprint is required',
  INVALID_FINGERPRINT: 'Invalid client fingerprint',
  TOKEN_BLACKLISTED: 'Token has been revoked',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions for access',
  SERVER_ERROR: 'Authentication service error'
} as const;

const ERROR_CODES = {
  AUTH_HEADER_MISSING: 'AUTH001',
  TOKEN_FORMAT_INVALID: 'AUTH002',
  TOKEN_INVALID: 'AUTH003',
  FINGERPRINT_MISSING: 'AUTH004',
  FINGERPRINT_INVALID: 'AUTH005',
  TOKEN_BLACKLISTED: 'AUTH006',
  INSUFFICIENT_PERMISSIONS: 'AUTH007',
  SERVER_ERROR: 'AUTH008'
} as const;

// Initialize Redis client for token caching
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
  }
});

redisClient.connect().catch(console.error);

/**
 * Validates the Authorization header format and extracts the token
 * @param authHeader - The Authorization header value
 * @param fingerprint - The client fingerprint for additional validation
 * @returns The extracted and validated token
 */
const validateAuthHeader = async (
  authHeader: string | undefined,
  fingerprint: string | undefined
): Promise<string> => {
  if (!authHeader) {
    throw new Error(ERROR_MESSAGES.MISSING_AUTH_HEADER);
  }

  if (!TOKEN_REGEX.test(authHeader)) {
    throw new Error(ERROR_MESSAGES.INVALID_TOKEN_FORMAT);
  }

  if (jwtConfig.tokenFingerprint && !fingerprint) {
    throw new Error(ERROR_MESSAGES.MISSING_FINGERPRINT);
  }

  return authHeader.slice(BEARER_PREFIX.length);
};

/**
 * Express middleware for JWT token validation with enhanced security features
 * Implements caching for performance optimization and comprehensive security checks
 */
const authenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = await validateAuthHeader(
      req.headers.authorization,
      req.headers['x-fingerprint'] as string
    );

    // Check token cache for performance optimization
    const cachedPayload = await redisClient.get(`token:${token}`);
    let payload: TokenPayload;

    if (cachedPayload) {
      payload = JSON.parse(cachedPayload);
    } else {
      // Verify token if not in cache
      payload = await verifyToken(
        token,
        'access',
        req.headers['x-fingerprint'] as string
      );

      // Cache successful validation result
      await redisClient.setEx(
        `token:${token}`,
        CACHE_TTL,
        JSON.stringify(payload)
      );
    }

    // Check token blacklist
    const isBlacklisted = await redisClient.get(`blacklist:${payload.jti}`);
    if (isBlacklisted) {
      throw new Error(ERROR_MESSAGES.TOKEN_BLACKLISTED);
    }

    // Build enhanced security context
    const securityContext = {
      tokenIssueTime: payload.iat || 0,
      tokenExpiry: payload.exp || 0,
      clientIp: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    };

    // Attach user and security context to request
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions || [],
      sessionId: payload.jti,
      fingerprint: payload.fingerprint || ''
    };
    req.securityContext = securityContext;

    // Log security event for audit
    console.info({
      event: 'authentication_success',
      userId: payload.id,
      tokenId: payload.jti,
      clientIp: req.ip,
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.SERVER_ERROR;
    const errorCode = getErrorCode(errorMessage);

    // Log security event for audit
    console.error({
      event: 'authentication_failure',
      error: errorMessage,
      clientIp: req.ip,
      timestamp: new Date().toISOString()
    });

    res.status(401).json({
      error: {
        code: errorCode,
        message: errorMessage
      }
    });
  }
};

/**
 * Maps error messages to error codes for consistent error handling
 */
const getErrorCode = (errorMessage: string): string => {
  switch (errorMessage) {
    case ERROR_MESSAGES.MISSING_AUTH_HEADER:
      return ERROR_CODES.AUTH_HEADER_MISSING;
    case ERROR_MESSAGES.INVALID_TOKEN_FORMAT:
      return ERROR_CODES.TOKEN_FORMAT_INVALID;
    case ERROR_MESSAGES.INVALID_TOKEN:
      return ERROR_CODES.TOKEN_INVALID;
    case ERROR_MESSAGES.MISSING_FINGERPRINT:
      return ERROR_CODES.FINGERPRINT_MISSING;
    case ERROR_MESSAGES.INVALID_FINGERPRINT:
      return ERROR_CODES.FINGERPRINT_INVALID;
    case ERROR_MESSAGES.TOKEN_BLACKLISTED:
      return ERROR_CODES.TOKEN_BLACKLISTED;
    case ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS:
      return ERROR_CODES.INSUFFICIENT_PERMISSIONS;
    default:
      return ERROR_CODES.SERVER_ERROR;
  }
};

export default authenticateJWT;