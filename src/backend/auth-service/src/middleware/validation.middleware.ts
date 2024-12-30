/**
 * @fileoverview Authentication request validation middleware with comprehensive security checks
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { plainToClass } from 'class-transformer'; // ^0.5.1
import { validate, IsEmail, IsString, MinLength, MaxLength, Matches, ValidateNested } from 'class-validator'; // ^0.14.0
import helmet from 'helmet'; // ^7.0.0
import { v4 as uuidv4 } from 'uuid';
import { passwordConfig } from '../config/auth.config';
import { User } from '../models/user.model';

// Security-related constants
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const REQUEST_SIZE_LIMIT = '10kb';
const VALIDATION_TIMEOUT = 5000;
const MAX_HEADER_SIZE = 8192; // 8KB
const ALLOWED_CONTENT_TYPES = ['application/json'];
const REQUIRED_HEADERS = ['user-agent', 'content-type'];

/**
 * Data Transfer Object for login request validation with enhanced security fields
 */
class LoginDTO {
    @IsEmail({}, { message: 'Invalid email format' })
    @Matches(EMAIL_REGEX, { message: 'Email format does not meet security requirements' })
    email: string;

    @IsString()
    @MinLength(passwordConfig.minLength)
    @MaxLength(passwordConfig.maxLength)
    @Matches(PASSWORD_REGEX, { 
        message: 'Password must contain uppercase, lowercase, number and special character' 
    })
    password: string;

    @IsString()
    clientId: string;

    @IsString()
    @MaxLength(256)
    userAgent: string;

    @IsString()
    @MaxLength(45)
    ipAddress: string;

    @IsString()
    @MinLength(32)
    @MaxLength(64)
    csrfToken: string;
}

/**
 * Validates and sanitizes login requests with comprehensive security checks
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 */
export async function validateLoginRequest(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    const correlationId = uuidv4();
    res.setHeader('X-Correlation-ID', correlationId);

    try {
        // Basic request validation
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new Error('Empty request body');
        }

        // Content-Type validation
        const contentType = req.get('content-type');
        if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType.toLowerCase())) {
            throw new Error('Invalid Content-Type');
        }

        // Required headers validation
        const missingHeaders = REQUIRED_HEADERS.filter(header => !req.get(header));
        if (missingHeaders.length > 0) {
            throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
        }

        // Header size validation
        const headerSize = JSON.stringify(req.headers).length;
        if (headerSize > MAX_HEADER_SIZE) {
            throw new Error('Header size exceeds limit');
        }

        // Request size validation
        const contentLength = parseInt(req.get('content-length') || '0', 10);
        if (contentLength > parseInt(REQUEST_SIZE_LIMIT, 10)) {
            throw new Error('Request size exceeds limit');
        }

        // Transform and validate request body
        const loginData = plainToClass(LoginDTO, {
            ...req.body,
            userAgent: req.get('user-agent'),
            ipAddress: req.ip,
            clientId: req.get('x-client-id'),
            csrfToken: req.get('x-csrf-token')
        });

        // Validate DTO with class-validator
        const errors = await validate(loginData, {
            whitelist: true,
            forbidNonWhitelisted: true,
            validationError: { target: false }
        });

        if (errors.length > 0) {
            throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
        }

        // Check rate limiting and account lockout
        const user = await User.findByEmail(loginData.email);
        if (user) {
            const isLocked = await user.checkLoginAttempts(loginData.ipAddress);
            if (isLocked) {
                throw new Error('Account temporarily locked due to multiple failed attempts');
            }
        }

        // Set validated data on request
        req.validatedData = loginData;
        
        // Apply security headers
        helmet({
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
        })(req, res, () => {});

        next();
    } catch (error) {
        // Log validation error with correlation ID
        console.error(`Validation error [${correlationId}]:`, error);

        res.status(400).json({
            error: 'Validation failed',
            message: error.message,
            correlationId
        });
    }
}

// Export validation middleware and DTO for testing
export { LoginDTO };