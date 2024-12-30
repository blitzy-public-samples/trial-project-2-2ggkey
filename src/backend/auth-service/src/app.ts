/**
 * @fileoverview Main application entry point for the authentication service with
 * enhanced security, performance monitoring, and health checks.
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express'; // ^4.18.0
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import morgan from 'morgan'; // ^1.10.0
import compression from 'compression'; // ^1.7.4
import rateLimit from 'express-rate-limit'; // ^6.7.0
import dotenv from 'dotenv'; // ^16.0.0
import configureAuthRoutes from './routes/auth.routes';
import { pool } from './config/database.config';
import { jwtConfig } from './config/auth.config';

// Initialize environment variables
dotenv.config();

// Constants for application configuration
const PORT = process.env.PORT || 3001;
const CORS_OPTIONS = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
};

const RATE_LIMIT_OPTIONS = {
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  standardHeaders: true,
  legacyHeaders: false
};

const HELMET_OPTIONS = {
  contentSecurityPolicy: {
    directives: {
      'default-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'script-src': ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
};

/**
 * Validates required environment variables and security configurations
 * @throws Error if required variables are missing or invalid
 */
function validateEnvironment(): void {
  const requiredVars = [
    'JWT_ACCESS_TOKEN_SECRET',
    'JWT_REFRESH_TOKEN_SECRET',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate JWT secrets length
  if (jwtConfig.accessTokenSecret.length < 32 || jwtConfig.refreshTokenSecret.length < 32) {
    throw new Error('JWT secrets must be at least 32 characters long');
  }
}

/**
 * Main application class with enhanced security and monitoring features
 */
export class App {
  private app: Express;
  private isShuttingDown: boolean;

  constructor() {
    this.app = express();
    this.isShuttingDown = false;
    this.initialize();
  }

  /**
   * Initializes the application with security middleware and routes
   */
  private initialize(): void {
    // Validate environment
    validateEnvironment();

    // Configure security middleware
    this.configureMiddleware();

    // Configure routes
    this.configureRoutes();

    // Configure error handling
    this.configureErrorHandling();
  }

  /**
   * Configures Express application middleware with security and performance optimizations
   */
  private configureMiddleware(): void {
    // Security middleware
    this.app.use(helmet(HELMET_OPTIONS));
    this.app.use(cors(CORS_OPTIONS));
    this.app.use(rateLimit(RATE_LIMIT_OPTIONS));

    // Performance middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10kb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10kb' }));

    // Logging middleware
    this.app.use(morgan('combined'));

    // Health check middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      if (this.isShuttingDown) {
        res.status(503).json({ status: 'Service Unavailable', message: 'Server is shutting down' });
      } else {
        next();
      }
    });
  }

  /**
   * Configures application routes and authentication endpoints
   */
  private configureRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        await pool.query('SELECT 1');
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
      }
    });

    // Configure authentication routes
    this.app.use('/api/v1/auth', configureAuthRoutes);
  }

  /**
   * Configures global error handling with security considerations
   */
  private configureErrorHandling(): void {
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Application Error:', {
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 
          'An unexpected error occurred' : 
          err.message,
        correlationId: req.get('x-correlation-id')
      });
    });
  }

  /**
   * Starts the application with monitoring and graceful shutdown
   */
  public async start(): Promise<void> {
    try {
      // Test database connection
      await pool.query('SELECT 1');

      const server = this.app.listen(PORT, () => {
        console.log(`Auth service listening on port ${PORT}`);
      });

      // Graceful shutdown handling
      const shutdown = async (signal: string) => {
        console.log(`Received ${signal}. Starting graceful shutdown...`);
        this.isShuttingDown = true;

        server.close(async () => {
          try {
            await pool.end();
            console.log('Graceful shutdown completed');
            process.exit(0);
          } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
          }
        });

        // Force shutdown after 30 seconds
        setTimeout(() => {
          console.error('Forced shutdown after timeout');
          process.exit(1);
        }, 30000);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
      console.error('Failed to start auth service:', error);
      process.exit(1);
    }
  }
}

// Create and export app instance
export default new App();