import { User } from '../models/user.model';
import speakeasy from 'speakeasy'; // ^2.0.0
import qrcode from 'qrcode'; // ^1.5.0
import { Auth0Client } from '@auth0/auth0-spa-js'; // ^2.1.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // ^2.4.1
import jwt from 'jsonwebtoken'; // ^9.0.0
import { hashPassword, comparePassword, encryptData } from '../utils/encryption.util';
import { jwtConfig, oauthConfig, mfaConfig, passwordConfig } from '../config/auth.config';
import { pool } from '../config/database.config';

// Constants for authentication flows
const AUTH_PROVIDERS = {
  GOOGLE: 'google',
  GITHUB: 'github',
  MICROSOFT: 'microsoft'
} as const;

const RATE_LIMIT_WINDOWS = {
  LOGIN: 60 * 60, // 1 hour
  MFA: 5 * 60, // 5 minutes
  BACKUP_CODES: 24 * 60 * 60 // 24 hours
} as const;

const SECURITY_SETTINGS = {
  MAX_LOGIN_ATTEMPTS: 5,
  MFA_TIMEOUT: 5 * 60,
  TOKEN_ROTATION_WINDOW: 24 * 60 * 60
} as const;

// Interfaces
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDTO;
  requiresMFA: boolean;
  deviceFingerprint?: string;
  sessionId: string;
}

interface SecuritySettings {
  mfaEnabled: boolean;
  backupCodesEnabled: boolean;
  deviceTrustEnabled: boolean;
  loginNotificationsEnabled: boolean;
}

interface UserDTO {
  id: string;
  email: string;
  name: string;
  mfaEnabled: boolean;
  securitySettings: SecuritySettings;
}

export class AuthService {
  private rateLimiter: RateLimiterRedis;
  private auth0Client: Auth0Client;

  constructor(rateLimiter: RateLimiterRedis) {
    this.rateLimiter = rateLimiter;
    this.initializeAuth0Client();
  }

  private async initializeAuth0Client(): Promise<void> {
    this.auth0Client = new Auth0Client({
      domain: oauthConfig.auth0Domain,
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      redirect_uri: oauthConfig.callbackUrl
    });
  }

  /**
   * Authenticates user with password and handles MFA if enabled
   */
  async authenticate(email: string, password: string, ip: string): Promise<AuthResponse> {
    try {
      // Rate limiting check
      await this.rateLimiter.consume(ip);

      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Validate password
      const isValidPassword = await comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        await user.updateLoginAttempts(false, ip);
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);
      const sessionId = this.generateSessionId();

      await user.updateLoginAttempts(true, ip);

      return {
        accessToken,
        refreshToken,
        user: this.mapUserToDTO(user),
        requiresMFA: user.mfa_enabled,
        sessionId
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handles OAuth2.0/OIDC authentication flow
   */
  async authenticateWithOAuth(provider: string, code: string): Promise<AuthResponse> {
    try {
      const tokenResponse = await this.auth0Client.getTokenSilently({
        code,
        scope: oauthConfig.scope,
        audience: oauthConfig.audience
      });

      const userInfo = await this.auth0Client.getUser(tokenResponse.accessToken);

      // Create or update user
      let user = await User.findByEmail(userInfo.email);
      if (!user) {
        user = await User.create({
          email: userInfo.email,
          name: userInfo.name,
          is_email_verified: true
        });
      }

      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);
      const sessionId = this.generateSessionId();

      return {
        accessToken,
        refreshToken,
        user: this.mapUserToDTO(user),
        requiresMFA: user.mfa_enabled,
        sessionId
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validates MFA token and completes authentication
   */
  async validateMFAToken(userId: string, token: string): Promise<boolean> {
    const user = await User.findByEmail(userId);
    if (!user || !user.mfa_secret) {
      throw new Error('Invalid user or MFA not enabled');
    }

    return speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token,
      window: mfaConfig.window
    });
  }

  /**
   * Generates backup codes for account recovery
   */
  async generateBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = Array.from(
      { length: mfaConfig.backupCodesCount },
      () => speakeasy.generateSecret({ length: 10 }).base32
    );

    const hashedCodes = await Promise.all(
      backupCodes.map(code => hashPassword(code))
    );

    await User.updateSecuritySettings(userId, { backupCodes: hashedCodes });

    return backupCodes;
  }

  /**
   * Validates device fingerprint for trusted devices
   */
  async validateDeviceFingerprint(userId: string, fingerprint: string): Promise<boolean> {
    const user = await User.findByEmail(userId);
    if (!user) {
      return false;
    }

    // Implement device fingerprint validation logic
    const encryptedFingerprint = await encryptData(fingerprint, process.env.MFA_SECRET_KEY!);
    return user.trusted_devices?.includes(encryptedFingerprint.toString());
  }

  private generateAccessToken(user: User): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      jwtConfig.accessTokenSecret,
      {
        expiresIn: jwtConfig.accessTokenExpiry,
        algorithm: jwtConfig.algorithm,
        issuer: jwtConfig.issuer
      }
    );
  }

  private generateRefreshToken(user: User): string {
    return jwt.sign(
      {
        userId: user.id,
        tokenVersion: user.token_version
      },
      jwtConfig.refreshTokenSecret,
      {
        expiresIn: jwtConfig.refreshTokenExpiry,
        algorithm: jwtConfig.algorithm,
        issuer: jwtConfig.issuer
      }
    );
  }

  private generateSessionId(): string {
    return speakeasy.generateSecret({ length: 20 }).base32;
  }

  private mapUserToDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      mfaEnabled: user.mfa_enabled,
      securitySettings: {
        mfaEnabled: user.mfa_enabled,
        backupCodesEnabled: !!user.mfa_backup_codes?.length,
        deviceTrustEnabled: !!user.trusted_devices?.length,
        loginNotificationsEnabled: user.login_notifications_enabled
      }
    };
  }
}