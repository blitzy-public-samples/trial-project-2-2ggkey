/**
 * @fileoverview Authentication controller implementing secure authentication endpoints
 * with comprehensive security measures, rate limiting, and performance optimizations.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // ^2.4.1
import httpStatus from 'http-status'; // ^1.6.0
import { withCorrelationId } from 'correlation-id'; // ^5.0.0
import winston from 'winston'; // ^3.8.0
import { AuthService } from '../services/auth.service';
import { validateLoginRequest } from '../middleware/validation.middleware';
import { authenticateJWT } from '../middleware/jwt.middleware';
import { passwordConfig, mfaConfig } from '../config/auth.config';

// Security-related constants
const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password - Security Event Logged',
  USER_EXISTS: 'User already exists - Security Event Logged',
  MFA_REQUIRED: 'MFA verification required for secure access',
  INVALID_MFA: 'Invalid MFA token - Security Event Logged',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token - Security Event Logged',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded - Please try again later',
  SECURITY_VIOLATION: 'Security violation detected - Event Logged'
} as const;

const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS: 1000,
  WINDOW_MS: 60000, // 1 minute
  MESSAGE: 'Rate limit exceeded'
} as const;

// Configure logger for security events
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'security-events.log' })
  ]
});

/**
 * Authentication controller class implementing secure authentication endpoints
 */
export class AuthController {
  private authService: AuthService;
  private rateLimiter: RateLimiterRedis;

  constructor(authService: AuthService, rateLimiter: RateLimiterRedis) {
    this.authService = authService;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Handles user registration with enhanced security validation
   */
  public register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const correlationId = req.get('x-correlation-id') || 'unknown';

    try {
      // Rate limiting check
      await this.rateLimiter.consume(req.ip);

      const { email, password, name } = req.body;

      // Log registration attempt
      logger.info({
        event: 'registration_attempt',
        email,
        ip: req.ip,
        correlationId,
        userAgent: req.get('user-agent')
      });

      // Register user with enhanced security
      const result = await this.authService.register({
        email,
        password,
        name,
        clientIp: req.ip,
        userAgent: req.get('user-agent')
      });

      // Log successful registration
      logger.info({
        event: 'registration_success',
        userId: result.user.id,
        email,
        correlationId
      });

      res.status(httpStatus.CREATED).json({
        message: 'User registered successfully',
        user: result.user,
        requiresMFA: false
      });
    } catch (error) {
      logger.error({
        event: 'registration_failure',
        error: error.message,
        correlationId,
        ip: req.ip
      });

      next(error);
    }
  };

  /**
   * Handles secure user login with MFA support
   */
  @validateLoginRequest
  public login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const correlationId = req.get('x-correlation-id') || 'unknown';

    try {
      // Rate limiting check
      await this.rateLimiter.consume(req.ip);

      const { email, password } = req.body;

      // Log login attempt
      logger.info({
        event: 'login_attempt',
        email,
        ip: req.ip,
        correlationId,
        userAgent: req.get('user-agent')
      });

      // Authenticate user
      const result = await this.authService.authenticate(
        email,
        password,
        req.ip
      );

      // Handle MFA if enabled
      if (result.requiresMFA) {
        res.status(httpStatus.OK).json({
          message: ERROR_MESSAGES.MFA_REQUIRED,
          requiresMFA: true,
          sessionId: result.sessionId
        });
        return;
      }

      // Log successful login
      logger.info({
        event: 'login_success',
        userId: result.user.id,
        correlationId
      });

      // Set secure cookies and headers
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(httpStatus.OK).json({
        accessToken: result.accessToken,
        user: result.user
      });
    } catch (error) {
      logger.error({
        event: 'login_failure',
        error: error.message,
        correlationId,
        ip: req.ip
      });

      next(error);
    }
  };

  /**
   * Handles secure token refresh with comprehensive validation
   */
  @authenticateJWT
  public refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const correlationId = req.get('x-correlation-id') || 'unknown';

    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        throw new Error(ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
      }

      const result = await this.authService.refreshToken(
        refreshToken,
        req.ip,
        req.get('user-agent') || 'unknown'
      );

      // Log token refresh
      logger.info({
        event: 'token_refresh',
        userId: result.user.id,
        correlationId
      });

      res.status(httpStatus.OK).json({
        accessToken: result.accessToken,
        user: result.user
      });
    } catch (error) {
      logger.error({
        event: 'token_refresh_failure',
        error: error.message,
        correlationId,
        ip: req.ip
      });

      next(error);
    }
  };

  /**
   * Handles MFA setup with secure QR code generation
   */
  @authenticateJWT
  public setupMFA = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const correlationId = req.get('x-correlation-id') || 'unknown';

    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const result = await this.authService.setupMFA(userId);

      // Log MFA setup
      logger.info({
        event: 'mfa_setup',
        userId,
        correlationId
      });

      res.status(httpStatus.OK).json({
        qrCode: result.qrCode,
        backupCodes: result.backupCodes
      });
    } catch (error) {
      logger.error({
        event: 'mfa_setup_failure',
        error: error.message,
        correlationId,
        ip: req.ip
      });

      next(error);
    }
  };

  /**
   * Handles MFA verification with comprehensive security checks
   */
  @validateLoginRequest
  public verifyMFA = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const correlationId = req.get('x-correlation-id') || 'unknown';

    try {
      const { token, sessionId } = req.body;

      const result = await this.authService.verifyMFA(
        token,
        sessionId,
        req.ip,
        req.get('user-agent') || 'unknown'
      );

      // Log MFA verification
      logger.info({
        event: 'mfa_verification',
        userId: result.user.id,
        correlationId
      });

      res.status(httpStatus.OK).json({
        accessToken: result.accessToken,
        user: result.user
      });
    } catch (error) {
      logger.error({
        event: 'mfa_verification_failure',
        error: error.message,
        correlationId,
        ip: req.ip
      });

      next(error);
    }
  };
}