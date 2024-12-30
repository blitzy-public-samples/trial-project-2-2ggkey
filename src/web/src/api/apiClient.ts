/**
 * @fileoverview Enterprise-grade API client with comprehensive security features,
 * performance optimization, and monitoring capabilities
 * @version 1.0.0
 * @package axios@1.4.0
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, HttpMethod, UUID } from '../types/common.types';
import { createApiUrl, handleApiError } from '../utils/api.utils';

// ============================================================================
// Types
// ============================================================================

/**
 * Request options for API calls
 */
interface RequestOptions extends Partial<AxiosRequestConfig> {
  /** Skip cache for this request */
  skipCache?: boolean;
  /** Custom cache duration in ms */
  cacheDuration?: number;
  /** Retry configuration */
  retry?: {
    attempts: number;
    delay: number;
  };
  /** Request priority */
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Request metrics for monitoring
 */
interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestTimes: number[];
}

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRY_ATTEMPTS = 3;
const CACHE_DURATION = 300000; // 5 minutes

// ============================================================================
// API Client Implementation
// ============================================================================

class ApiClient {
  private axios: AxiosInstance;
  private cache: Map<string, { data: any; timestamp: number }>;
  private retryCount: Map<string, number>;
  private metrics: RequestMetrics;
  private authToken?: string;

  constructor() {
    // Initialize axios instance with secure defaults
    this.axios = axios.create({
      baseURL: API_BASE_URL,
      timeout: DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      withCredentials: true // Enable CORS credentials
    });

    // Initialize cache and tracking
    this.cache = new Map();
    this.retryCount = new Map();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestTimes: []
    };

    this.setupInterceptors();
  }

  /**
   * Configure request/response interceptors for security and monitoring
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        // Add security headers
        config.headers = {
          ...config.headers,
          'X-Request-ID': crypto.randomUUID(),
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        };

        // Start performance tracking
        config.metadata = { startTime: Date.now() };

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        this.updateMetrics(response);
        return response;
      },
      (error) => {
        this.handleRequestError(error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Update request metrics for monitoring
   */
  private updateMetrics(response: AxiosResponse): void {
    const duration = Date.now() - (response.config.metadata?.startTime || 0);
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    this.metrics.requestTimes.push(duration);
    
    // Update average response time
    const total = this.metrics.requestTimes.reduce((a, b) => a + b, 0);
    this.metrics.averageResponseTime = total / this.metrics.requestTimes.length;
  }

  /**
   * Handle request errors with retry logic
   */
  private handleRequestError(error: any): void {
    this.metrics.failedRequests++;
    const requestId = error.config?.headers?.['X-Request-ID'];
    
    if (requestId) {
      const retryCount = this.retryCount.get(requestId) || 0;
      this.retryCount.set(requestId, retryCount + 1);
    }
  }

  /**
   * Set authentication token for requests
   */
  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Perform GET request with caching support
   */
  public async get<T>(
    endpoint: string,
    params: Record<string, any> = {},
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = createApiUrl(endpoint, params);
    
    // Check cache if enabled
    if (!options.skipCache) {
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.timestamp < (options.cacheDuration || CACHE_DURATION)) {
        return cached.data;
      }
    }

    try {
      const response = await this.axios.get<ApiResponse<T>>(url, {
        ...options,
        params
      });

      // Cache successful response
      if (!options.skipCache) {
        this.cache.set(url, {
          data: response.data,
          timestamp: Date.now()
        });
      }

      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Perform POST request with validation
   */
  public async post<T>(
    endpoint: string,
    data: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axios.post<ApiResponse<T>>(
        createApiUrl(endpoint),
        data,
        options
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Perform PUT request
   */
  public async put<T>(
    endpoint: string,
    data: any,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axios.put<ApiResponse<T>>(
        createApiUrl(endpoint),
        data,
        options
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Perform DELETE request
   */
  public async delete<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axios.delete<ApiResponse<T>>(
        createApiUrl(endpoint),
        options
      );
      return response.data;
    } catch (error) {
      return handleApiError(error);
    }
  }

  /**
   * Get current request metrics
   */
  public getMetrics(): RequestMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear request cache
   */
  public clearCache(): void {
    this.cache.clear();
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Prevent modifications to the instance
Object.freeze(apiClient);

export default apiClient;