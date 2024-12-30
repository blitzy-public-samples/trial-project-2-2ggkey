import { Pool, PoolConfig } from 'pg'; // pg ^8.11.0
import * as dotenv from 'dotenv'; // dotenv ^16.0.0
import { hostname } from 'os';

// Load environment variables
dotenv.config();

// Connection pool configuration constants
const DEFAULT_POOL_SIZE = 20;
const MIN_POOL_SIZE = 5;
const MAX_POOL_SIZE = 50;
const IDLE_TIMEOUT_MILLIS = 10000;
const CONNECTION_TIMEOUT_MILLIS = 5000;
const CONNECTION_RETRY_ATTEMPTS = 3;
const SSL_MODE = 'require';
const HEALTH_CHECK_INTERVAL = 60000;
const LEAK_DETECTION_THRESHOLD = 30000;

/**
 * Validates required database environment variables and their formats
 * @throws Error if any required variable is missing or invalid
 */
const validateEnvironmentVariables = (): void => {
  const requiredVars = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }

  // Validate DB_PORT is a valid port number
  const port = parseInt(process.env.DB_PORT!, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be a valid port number between 1 and 65535');
  }

  // Validate DB_HOST format
  const hostRegex = /^[a-zA-Z0-9.-]+$/;
  if (!hostRegex.test(process.env.DB_HOST!)) {
    throw new Error('DB_HOST contains invalid characters');
  }

  // Validate DB_NAME against injection patterns
  const nameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!nameRegex.test(process.env.DB_NAME!)) {
    throw new Error('DB_NAME contains invalid characters');
  }

  // Validate DB_PASSWORD minimum complexity
  if (process.env.DB_PASSWORD!.length < 8) {
    throw new Error('DB_PASSWORD must be at least 8 characters long');
  }
};

/**
 * Creates and configures a PostgreSQL connection pool with security and performance optimizations
 * @returns Configured PostgreSQL connection pool
 */
const createPool = (): Pool => {
  validateEnvironmentVariables();

  const poolConfig: PoolConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT!, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    
    // Connection pool settings
    min: MIN_POOL_SIZE,
    max: MAX_POOL_SIZE,
    idleTimeoutMillis: IDLE_TIMEOUT_MILLIS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MILLIS,
    
    // SSL/TLS configuration
    ssl: {
      rejectUnauthorized: true,
      mode: SSL_MODE,
    },
    
    // Application name for monitoring
    application_name: `auth-service-${hostname()}`,
    
    // Statement timeout to prevent long-running queries
    statement_timeout: 30000,
  };

  const pool = new Pool(poolConfig);

  // Setup error handling
  pool.on('error', (err: Error) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  // Setup connection monitoring
  pool.on('connect', (client) => {
    client.on('error', (err: Error) => {
      console.error('Database client error:', err);
    });
  });

  // Setup health checking
  setInterval(() => {
    pool.query('SELECT 1')
      .catch((err: Error) => {
        console.error('Health check failed:', err);
      });
  }, HEALTH_CHECK_INTERVAL);

  return pool;
};

// Create the database pool
export const pool = createPool();

// Export database configuration (excluding sensitive data)
export const databaseConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT!, 10),
  database: process.env.DB_NAME,
  ssl: {
    mode: SSL_MODE,
    rejectUnauthorized: true
  },
  poolMetrics: {
    min: MIN_POOL_SIZE,
    max: MAX_POOL_SIZE,
    idleTimeout: IDLE_TIMEOUT_MILLIS,
    connectionTimeout: CONNECTION_TIMEOUT_MILLIS,
    healthCheckInterval: HEALTH_CHECK_INTERVAL,
    leakDetectionThreshold: LEAK_DETECTION_THRESHOLD
  }
};

// Export pool metrics interface
export interface PoolMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
}

/**
 * Get current pool metrics
 * @returns Current pool metrics
 */
export const getPoolMetrics = (): PoolMetrics => ({
  totalConnections: pool.totalCount,
  idleConnections: pool.idleCount,
  waitingClients: pool.waitingCount
});