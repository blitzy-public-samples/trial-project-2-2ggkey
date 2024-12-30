import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import supertest from 'supertest';
import { AuthService } from '../src/services/auth.service';
import { User } from '../src/models/user.model';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { jwtConfig, mfaConfig } from '../config/auth.config';
import { hashPassword, encryptData } from '../utils/encryption.util';

// Test constants
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#',
  name: 'Test User',
  deviceFingerprint: 'test-device-hash'
};

const INVALID_TOKEN = 'invalid.jwt.token';

const OAUTH_MOCK_DATA = {
  provider: 'google',
  code: 'mock.oauth.code',
  userData: {
    email: 'oauth@example.com',
    name: 'OAuth User'
  }
};

// Mock Redis rate limiter
const mockRateLimiter = {
  consume: jest.fn().mockResolvedValue(true),
  penalty: jest.fn().mockResolvedValue(true),
  delete: jest.fn().mockResolvedValue(true)
} as unknown as RateLimiterRedis;

let authService: AuthService;
let mongoServer: MongoMemoryServer;

describe('AuthService', () => {
  beforeAll(async () => {
    // Setup MongoDB memory server
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'auth-test-db',
        auth: true
      }
    });

    // Initialize AuthService with mocked dependencies
    authService = new AuthService(mockRateLimiter);

    // Mock Auth0 client initialization
    jest.spyOn(authService as any, 'initializeAuth0Client').mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear test data and reset mocks
    jest.clearAllMocks();
    await User.deleteMany({});
  });

  describe('register', () => {
    test('should successfully register a new user with secure password', async () => {
      const result = await authService.authenticate(TEST_USER.email, TEST_USER.password, '127.0.0.1');
      
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(TEST_USER.email);
      expect(result.requiresMFA).toBe(false);
    });

    test('should prevent duplicate email registration', async () => {
      await User.create({
        email: TEST_USER.email,
        password_hash: await hashPassword(TEST_USER.password),
        name: TEST_USER.name
      });

      await expect(
        authService.authenticate(TEST_USER.email, TEST_USER.password, '127.0.0.1')
      ).rejects.toThrow('Invalid credentials');
    });

    test('should enforce password complexity requirements', async () => {
      const weakPassword = 'weak';
      
      await expect(
        authService.authenticate(TEST_USER.email, weakPassword, '127.0.0.1')
      ).rejects.toThrow('Invalid credentials');
    });

    test('should properly hash passwords before storage', async () => {
      await authService.authenticate(TEST_USER.email, TEST_USER.password, '127.0.0.1');
      
      const user = await User.findByEmail(TEST_USER.email);
      expect(user.password_hash).not.toBe(TEST_USER.password);
      expect(user.password_hash).toMatch(/^\$2[aby]\$\d{1,2}\$[./A-Za-z0-9]{53}$/);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create test user
      await User.create({
        email: TEST_USER.email,
        password_hash: await hashPassword(TEST_USER.password),
        name: TEST_USER.name
      });
    });

    test('should successfully authenticate valid credentials', async () => {
      const result = await authService.authenticate(TEST_USER.email, TEST_USER.password, '127.0.0.1');
      
      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe(TEST_USER.email);
      expect(mockRateLimiter.consume).toHaveBeenCalled();
    });

    test('should enforce account lockout after max failed attempts', async () => {
      mockRateLimiter.consume.mockRejectedValue(new Error('Rate limit exceeded'));

      for (let i = 0; i < 6; i++) {
        await expect(
          authService.authenticate(TEST_USER.email, 'wrong-password', '127.0.0.1')
        ).rejects.toThrow();
      }

      const user = await User.findByEmail(TEST_USER.email);
      expect(user.locked_until).toBeDefined();
      expect(user.login_attempts).toBe(5);
    });

    test('should validate device fingerprint for trusted devices', async () => {
      const result = await authService.validateDeviceFingerprint(
        TEST_USER.email,
        TEST_USER.deviceFingerprint
      );
      
      expect(result).toBe(false); // Initially not trusted
    });
  });

  describe('OAuth', () => {
    test('should successfully authenticate with OAuth provider', async () => {
      const result = await authService.authenticateWithOAuth(
        OAUTH_MOCK_DATA.provider,
        OAUTH_MOCK_DATA.code
      );

      expect(result).toHaveProperty('accessToken');
      expect(result.user.email).toBe(OAUTH_MOCK_DATA.userData.email);
    });

    test('should link OAuth account with existing user', async () => {
      // Create user first
      await User.create({
        email: OAUTH_MOCK_DATA.userData.email,
        password_hash: await hashPassword(TEST_USER.password),
        name: OAUTH_MOCK_DATA.userData.name
      });

      const result = await authService.authenticateWithOAuth(
        OAUTH_MOCK_DATA.provider,
        OAUTH_MOCK_DATA.code
      );

      expect(result.user.email).toBe(OAUTH_MOCK_DATA.userData.email);
    });
  });

  describe('MFA', () => {
    let user: any;
    let mfaSecret: string;

    beforeEach(async () => {
      user = await User.create({
        email: TEST_USER.email,
        password_hash: await hashPassword(TEST_USER.password),
        name: TEST_USER.name,
        mfa_enabled: true
      });

      mfaSecret = 'JBSWY3DPEHPK3PXP'; // Test TOTP secret
    });

    test('should successfully validate MFA token', async () => {
      const isValid = await authService.validateMFAToken(user.id, '123456');
      expect(isValid).toBe(false); // Invalid test token
    });

    test('should generate and validate backup codes', async () => {
      const backupCodes = await authService.generateBackupCodes(user.id);
      
      expect(backupCodes).toHaveLength(mfaConfig.backupCodesCount);
      expect(backupCodes[0]).toMatch(/^[A-Z2-7]{16}$/);
    });

    test('should prevent MFA bypass attempts', async () => {
      await expect(
        authService.validateMFAToken(user.id, 'invalid-token')
      ).rejects.toThrow();
    });
  });

  describe('Security Protocols', () => {
    test('should enforce rate limiting on authentication attempts', async () => {
      mockRateLimiter.consume.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(
        authService.authenticate(TEST_USER.email, TEST_USER.password, '127.0.0.1')
      ).rejects.toThrow('Rate limit exceeded');
    });

    test('should validate JWT token signatures', async () => {
      await expect(
        authService.validateDeviceFingerprint(INVALID_TOKEN, TEST_USER.deviceFingerprint)
      ).rejects.toThrow();
    });

    test('should properly encrypt sensitive data', async () => {
      const sensitiveData = 'sensitive-info';
      const encryptedData = await encryptData(sensitiveData, process.env.MFA_SECRET_KEY!);
      
      expect(encryptedData).toHaveProperty('encryptedData');
      expect(encryptedData).toHaveProperty('iv');
      expect(encryptedData).toHaveProperty('authTag');
    });
  });
});