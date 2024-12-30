/**
 * @fileoverview Enterprise-grade authentication API client with comprehensive security features
 * @version 1.0.0
 * @package crypto-js@4.1.1
 */

import ApiClient from './apiClient';
import { ApiResponse } from '../types/common.types';
import CryptoJS from 'crypto-js';

// ============================================================================
// Types
// ============================================================================

/**
 * Login credentials interface
 */
interface LoginCredentials {
  email: string;
  password: string;
  deviceId?: string;
  rememberMe?: boolean;
}

/**
 * Authentication response interface
 */
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
  mfaRequired?: boolean;
  deviceTrusted?: boolean;
}

/**
 * User profile interface
 */
interface UserProfile {
  id: string;
  email: string;
  name: string;
  mfaEnabled: boolean;
  lastLogin: string;
  securityPreferences: SecurityPreferences;
}

/**
 * Security preferences interface
 */
interface SecurityPreferences {
  mfaMethod: 'totp' | 'sms' | 'none';
  trustedDevices: boolean;
  loginNotifications: boolean;
  sessionTimeout: number;
}

/**
 * Token encryption service for secure token storage
 */
class TokenEncryptionService {
  private readonly encryptionKey: string;

  constructor() {
    this.encryptionKey = this.generateEncryptionKey();
  }

  private generateEncryptionKey(): string {
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  public encryptToken(token: string): string {
    return CryptoJS.AES.encrypt(token, this.encryptionKey).toString();
  }

  public decryptToken(encryptedToken: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedToken, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }
}

/**
 * Rate limiting service to prevent brute force attacks
 */
class RateLimitService {
  private attempts: Map<string, number[]>;
  private readonly maxAttempts: number;
  private readonly timeWindow: number;

  constructor(maxAttempts: number = 5, timeWindow: number = 300000) {
    this.attempts = new Map();
    this.maxAttempts = maxAttempts;
    this.timeWindow = timeWindow;
  }

  public checkRateLimit(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts
    const recentAttempts = attempts.filter(time => now - time < this.timeWindow);
    
    if (recentAttempts.length >= this.maxAttempts) {
      return false;
    }

    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    return true;
  }
}

// ============================================================================
// Auth API Implementation
// ============================================================================

export class AuthApi {
  private readonly apiClient: ApiClient;
  private readonly tokenStorage: TokenEncryptionService;
  private readonly rateLimiter: RateLimitService;
  private refreshTokenTimeout?: NodeJS.Timeout;

  constructor(apiClient: ApiClient) {
    this.apiClient = apiClient;
    this.tokenStorage = new TokenEncryptionService();
    this.rateLimiter = new RateLimitService();
  }

  /**
   * Authenticate user with enhanced security features
   * @param credentials - User login credentials
   * @param mfaToken - Optional MFA token
   * @returns Authentication response with tokens and user profile
   * @throws {Error} If authentication fails or rate limit exceeded
   */
  public async login(
    credentials: LoginCredentials,
    mfaToken?: string
  ): Promise<ApiResponse<AuthResponse>> {
    // Check rate limiting
    const rateLimitKey = `login:${credentials.email}`;
    if (!this.rateLimiter.checkRateLimit(rateLimitKey)) {
      throw new Error('Too many login attempts. Please try again later.');
    }

    // Generate device fingerprint
    const deviceId = credentials.deviceId || this.generateDeviceFingerprint();

    try {
      const response = await this.apiClient.post<AuthResponse>('/auth/login', {
        ...credentials,
        deviceId,
        mfaToken
      });

      if (response.success && response.data) {
        // Handle MFA requirement
        if (response.data.mfaRequired && !mfaToken) {
          return response;
        }

        // Store encrypted tokens
        this.storeTokens(response.data);

        // Setup automatic token refresh
        this.setupTokenRefresh(response.data.expiresIn);

        // Set auth token for subsequent requests
        this.apiClient.setAuthToken(response.data.accessToken);

        return response;
      }

      throw new Error(response.error?.message || 'Authentication failed');
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Validate MFA token
   * @param mfaToken - MFA token to validate
   * @param userId - User ID
   * @returns Validation result
   */
  public async validateMFA(
    mfaToken: string,
    userId: string
  ): Promise<ApiResponse<boolean>> {
    const rateLimitKey = `mfa:${userId}`;
    if (!this.rateLimiter.checkRateLimit(rateLimitKey)) {
      throw new Error('Too many MFA attempts. Please try again later.');
    }

    return this.apiClient.post<boolean>('/auth/mfa/validate', {
      mfaToken,
      userId
    });
  }

  /**
   * Refresh authentication tokens
   * @returns New authentication response
   */
  public async refreshToken(): Promise<ApiResponse<AuthResponse>> {
    try {
      const refreshToken = this.getStoredRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.apiClient.post<AuthResponse>('/auth/refresh', {
        refreshToken
      });

      if (response.success && response.data) {
        this.storeTokens(response.data);
        this.setupTokenRefresh(response.data.expiresIn);
        this.apiClient.setAuthToken(response.data.accessToken);
      }

      return response;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Logout user and clear security context
   */
  public async logout(): Promise<void> {
    try {
      await this.apiClient.post('/auth/logout', {});
      this.clearSecurityContext();
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear security context even if logout request fails
      this.clearSecurityContext();
    }
  }

  /**
   * Generate device fingerprint for security tracking
   */
  private generateDeviceFingerprint(): string {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset()
    ];
    return CryptoJS.SHA256(components.join('|')).toString();
  }

  /**
   * Store encrypted authentication tokens
   */
  private storeTokens(authResponse: AuthResponse): void {
    const encryptedAccess = this.tokenStorage.encryptToken(authResponse.accessToken);
    const encryptedRefresh = this.tokenStorage.encryptToken(authResponse.refreshToken);
    
    localStorage.setItem('auth_access_token', encryptedAccess);
    localStorage.setItem('auth_refresh_token', encryptedRefresh);
  }

  /**
   * Retrieve stored refresh token
   */
  private getStoredRefreshToken(): string | null {
    const encryptedToken = localStorage.getItem('auth_refresh_token');
    return encryptedToken ? this.tokenStorage.decryptToken(encryptedToken) : null;
  }

  /**
   * Setup automatic token refresh
   */
  private setupTokenRefresh(expiresIn: number): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    // Refresh token 1 minute before expiration
    const refreshTime = (expiresIn - 60) * 1000;
    this.refreshTokenTimeout = setTimeout(() => {
      this.refreshToken().catch(console.error);
    }, refreshTime);
  }

  /**
   * Clear security context on logout or error
   */
  private clearSecurityContext(): void {
    localStorage.removeItem('auth_access_token');
    localStorage.removeItem('auth_refresh_token');
    this.apiClient.setAuthToken('');
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: any): Error {
    // Clear security context on critical errors
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      this.clearSecurityContext();
    }
    return error;
  }
}

// Create singleton instance
const authApi = new AuthApi(ApiClient);

// Prevent modifications to the instance
Object.freeze(authApi);

export default authApi;