/**
 * @fileoverview Authentication routes configuration with enhanced security features,
 * rate limiting, and comprehensive error handling.
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import { AuthController } from '../controllers/auth.controller';
import { validateLoginRequest, validateRegistrationRequest, validateMFARequest } from '../middleware/validation.middleware';
import authenticateJWT from '../middleware/jwt.middleware';

// Security-related constants
const AUTH_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
} as const;

// Specific rate limits for different auth endpoints
const RATE_LIMITS = {
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5 // 5 registrations per hour per IP
  },
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10 // 10 login attempts per 15 minutes
  },
  mfa: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3 // 3 MFA attempts per 5 minutes
  },
  refresh: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30 // 30 token refreshes per hour
  }
} as const;

// CORS configuration with strict security settings
const CORS_OPTIONS = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  methods: ['POST'],
  credentials: true,
  maxAge: 86400, // 24 hours
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Client-ID',
    'X-Fingerprint'
  ]
};

/**
 * Configures and returns the authentication router with enhanced security features
 * @param authController Instance of AuthController for handling auth operations
 * @returns Configured Express router with secure auth routes
 */
export function configureAuthRoutes(authController: AuthController): Router {
  const router = Router();

  // Apply security middleware
  router.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    noSniff: true,
    xssFilter: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // Configure CORS
  router.use(cors(CORS_OPTIONS));

  // Configure rate limiters for different endpoints
  const registerLimiter = rateLimit(RATE_LIMITS.register);
  const loginLimiter = rateLimit(RATE_LIMITS.login);
  const mfaLimiter = rateLimit(RATE_LIMITS.mfa);
  const refreshLimiter = rateLimit(RATE_LIMITS.refresh);

  // Registration endpoint
  router.post(
    '/register',
    registerLimiter,
    validateRegistrationRequest,
    async (req, res, next) => {
      try {
        await authController.register(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Login endpoint
  router.post(
    '/login',
    loginLimiter,
    validateLoginRequest,
    async (req, res, next) => {
      try {
        await authController.login(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Token refresh endpoint
  router.post(
    '/refresh-token',
    refreshLimiter,
    authenticateJWT,
    async (req, res, next) => {
      try {
        await authController.refreshToken(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // MFA setup endpoint
  router.post(
    '/mfa/setup',
    authenticateJWT,
    mfaLimiter,
    async (req, res, next) => {
      try {
        await authController.setupMFA(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // MFA verification endpoint
  router.post(
    '/mfa/verify',
    mfaLimiter,
    validateMFARequest,
    async (req, res, next) => {
      try {
        await authController.verifyMFA(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handling middleware
  router.use((err: Error, req: any, res: any, next: any) => {
    console.error('Auth Route Error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      error: 'Authentication service error',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message,
      correlationId: req.get('x-correlation-id')
    });
  });

  return router;
}

export default configureAuthRoutes;