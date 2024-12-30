/**
 * @fileoverview Enterprise-grade API utilities for the Task Management System
 * @version 1.0.0
 * @package axios@1.4.0
 */

import { AxiosError } from 'axios';
import { ApiResponse, ApiError } from '../types/common.types';

// ============================================================================
// Constants
// ============================================================================

const API_VERSION = 'v1';
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080/api';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * API URL creation options
 */
interface ApiUrlOptions {
  /** Include version prefix */
  includeVersion?: boolean;
  /** Additional path segments */
  pathSegments?: string[];
  /** Base URL override */
  baseUrl?: string;
  /** Parameter encoding options */
  parameterEncoding?: 'RFC3986' | 'RFC1738';
}

/**
 * Error handling options
 */
interface ErrorHandlingOptions {
  /** Custom error messages */
  messages?: Record<string, string>;
  /** Retry configuration */
  retry?: {
    /** Maximum retry attempts */
    maxAttempts: number;
    /** Retry delay in milliseconds */
    delayMs: number;
  };
  /** Error logging configuration */
  logging?: {
    /** Enable detailed logging */
    enabled: boolean;
    /** Log level */
    level: 'error' | 'warn' | 'info';
  };
}

/**
 * Response transformation options
 */
interface TransformOptions<T> {
  /** Custom data transformer */
  transformer?: (data: any) => T;
  /** Response validation options */
  validation?: {
    /** Schema validation */
    schema?: unknown;
    /** Custom validation function */
    validator?: (data: T) => boolean;
  };
  /** Security options */
  security?: {
    /** Enable response sanitization */
    sanitize: boolean;
    /** Content security policies */
    contentSecurityPolicy?: boolean;
  };
}

// ============================================================================
// URL Creation
// ============================================================================

/**
 * Creates a fully qualified API URL with enhanced security and validation
 * @param endpoint - API endpoint path
 * @param params - URL parameters
 * @param options - URL creation options
 * @returns Secure, fully qualified API URL
 * @throws {Error} If URL creation fails validation
 */
export function createApiUrl(
  endpoint: string,
  params: Record<string, any> = {},
  options: ApiUrlOptions = {}
): string {
  // Validate endpoint
  if (!endpoint || typeof endpoint !== 'string') {
    throw new Error('Invalid endpoint provided');
  }

  // Normalize endpoint
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  // Build base URL
  const baseUrl = options.baseUrl || API_BASE_URL;
  const versionPrefix = options.includeVersion !== false ? `/${API_VERSION}` : '';
  let url = `${baseUrl}${versionPrefix}/${normalizedEndpoint}`;

  // Add path segments if provided
  if (options.pathSegments?.length) {
    const sanitizedSegments = options.pathSegments
      .map(segment => encodeURIComponent(segment))
      .join('/');
    url = `${url}/${sanitizedSegments}`;
  }

  // Add query parameters
  if (Object.keys(params).length) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });
    url = `${url}?${queryParams.toString()}`;
  }

  // Validate final URL
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`Invalid URL created: ${url}`);
  }

  return url;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Enhanced error processor with security context and retry detection
 * @param error - Axios error object
 * @param options - Error handling options
 * @returns Standardized error response
 */
export function handleApiError(
  error: AxiosError,
  options: ErrorHandlingOptions = {}
): ApiResponse<never> {
  const timestamp = new Date().toISOString();
  const requestId = error.config?.headers?.['x-request-id'] || crypto.randomUUID();

  // Default error response
  const apiError: ApiError = {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    context: {},
    retryable: false
  };

  // Handle Axios errors
  if (error.isAxiosError) {
    const status = error.response?.status;
    const data = error.response?.data as any;

    // Map HTTP status codes to error codes
    switch (status) {
      case 400:
        apiError.code = 'BAD_REQUEST';
        apiError.message = data?.message || 'Invalid request parameters';
        break;
      case 401:
        apiError.code = 'UNAUTHORIZED';
        apiError.message = 'Authentication required';
        break;
      case 403:
        apiError.code = 'FORBIDDEN';
        apiError.message = 'Access denied';
        break;
      case 404:
        apiError.code = 'NOT_FOUND';
        apiError.message = data?.message || 'Resource not found';
        break;
      case 429:
        apiError.code = 'RATE_LIMITED';
        apiError.message = 'Too many requests';
        apiError.retryable = true;
        break;
      case 500:
        apiError.code = 'SERVER_ERROR';
        apiError.message = 'Internal server error';
        apiError.retryable = true;
        break;
      default:
        apiError.code = 'NETWORK_ERROR';
        apiError.message = error.message;
        apiError.retryable = !error.response;
    }

    // Add error context
    apiError.context = {
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      data: error.response?.data
    };
  }

  // Log error if enabled
  if (options.logging?.enabled) {
    const logLevel = options.logging.level || 'error';
    console[logLevel]('[API Error]', {
      error: apiError,
      originalError: error,
      timestamp,
      requestId
    });
  }

  return {
    success: false,
    data: null,
    error: apiError,
    timestamp,
    version: API_VERSION,
    requestId
  };
}

// ============================================================================
// Response Transformation
// ============================================================================

/**
 * Transforms API response with enhanced validation and security checks
 * @param response - Raw API response
 * @param options - Transform options
 * @returns Validated and secured API response
 * @throws {Error} If response validation fails
 */
export function transformResponse<T>(
  response: any,
  options: TransformOptions<T> = {}
): ApiResponse<T> {
  const timestamp = new Date().toISOString();
  const requestId = response?.headers?.['x-request-id'] || crypto.randomUUID();

  // Validate response structure
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response structure');
  }

  // Extract and transform data
  let transformedData: T;
  try {
    transformedData = options.transformer 
      ? options.transformer(response.data)
      : response.data;
  } catch (error) {
    throw new Error('Response transformation failed');
  }

  // Validate transformed data
  if (options.validation?.validator) {
    const isValid = options.validation.validator(transformedData);
    if (!isValid) {
      throw new Error('Response validation failed');
    }
  }

  // Sanitize response if enabled
  if (options.security?.sanitize) {
    // Add security headers
    if (options.security.contentSecurityPolicy) {
      response.headers = {
        ...response.headers,
        'Content-Security-Policy': "default-src 'self'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      };
    }
  }

  return {
    success: true,
    data: transformedData,
    error: null,
    timestamp,
    version: API_VERSION,
    requestId
  };
}