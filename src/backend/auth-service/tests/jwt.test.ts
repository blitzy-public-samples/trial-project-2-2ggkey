// @package jest ^29.0.0
// @package jsonwebtoken ^9.0.0
// @package crypto latest

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { sign, verify } from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  rotateRefreshToken,
  generateTokenFingerprint,
  TokenPayload,
  TokenType
} from '../src/utils/jwt.util';
import { jwtConfig } from '../src/config/auth.config';

// Mock jsonwebtoken and crypto modules
jest.mock('jsonwebtoken');
jest.mock('crypto');

// Test constants
const TEST_USER_PAYLOAD = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'user',
  deviceId: 'test-device-id',
  sessionId: 'test-session-id'
};

const INVALID_TOKEN = 'invalid.token.signature';
const TEST_FINGERPRINT = 'test-fingerprint-hash';

describe('JWT Token Generation and Verification Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful JWT sign operation
    (sign as jest.Mock).mockReturnValue('mocked.jwt.token');
    // Mock successful random bytes generation
    (randomBytes as jest.Mock).mockReturnValue(Buffer.from('mockedRandomBytes'));
  });

  describe('generateAccessToken', () => {
    test('should generate valid access token with fingerprint', async () => {
      const result = await generateAccessToken(TEST_USER_PAYLOAD);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresIn');
      expect(result).toHaveProperty('fingerprint');
      expect(result).toHaveProperty('tokenId');
      expect(sign).toHaveBeenCalledWith(
        expect.objectContaining({
          ...TEST_USER_PAYLOAD,
          type: 'access',
          fingerprint: expect.any(String)
        }),
        jwtConfig.accessTokenSecret,
        expect.any(Object)
      );
    });

    test('should include correct token expiration settings', async () => {
      const result = await generateAccessToken(TEST_USER_PAYLOAD);

      expect(sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({
          expiresIn: jwtConfig.accessTokenExpiry,
          algorithm: 'HS256'
        })
      );
      expect(result.expiresIn).toBe(jwtConfig.accessTokenExpiry);
    });

    test('should generate unique token IDs for each call', async () => {
      const result1 = await generateAccessToken(TEST_USER_PAYLOAD);
      const result2 = await generateAccessToken(TEST_USER_PAYLOAD);

      expect(result1.tokenId).not.toBe(result2.tokenId);
    });

    test('should handle payload validation errors', async () => {
      const invalidPayload = { ...TEST_USER_PAYLOAD, id: undefined };
      
      await expect(generateAccessToken(invalidPayload as any))
        .rejects
        .toThrow('Invalid payload');
    });
  });

  describe('verifyToken', () => {
    beforeEach(() => {
      (verify as jest.Mock).mockReturnValue({
        ...TEST_USER_PAYLOAD,
        type: 'access',
        fingerprint: TEST_FINGERPRINT,
        jti: 'test-token-id',
        iat: Date.now() / 1000
      });
    });

    test('should successfully verify valid token with fingerprint', async () => {
      const result = await verifyToken('valid.token', 'access', TEST_FINGERPRINT);

      expect(result).toMatchObject({
        ...TEST_USER_PAYLOAD,
        type: 'access',
        fingerprint: TEST_FINGERPRINT
      });
      expect(verify).toHaveBeenCalledWith('valid.token', jwtConfig.accessTokenSecret);
    });

    test('should reject invalid token type', async () => {
      (verify as jest.Mock).mockReturnValue({
        ...TEST_USER_PAYLOAD,
        type: 'refresh'
      });

      await expect(verifyToken('valid.token', 'access'))
        .rejects
        .toThrow('Invalid token type');
    });

    test('should validate token fingerprint when provided', async () => {
      await expect(verifyToken('valid.token', 'access', 'wrong-fingerprint'))
        .rejects
        .toThrow('Invalid token fingerprint');
    });

    test('should reject expired tokens', async () => {
      (verify as jest.Mock).mockReturnValue({
        ...TEST_USER_PAYLOAD,
        type: 'access',
        iat: (Date.now() / 1000) - 90000 // Token too old
      });

      await expect(verifyToken('valid.token', 'access'))
        .rejects
        .toThrow('Token has exceeded maximum age');
    });

    test('should handle invalid token signatures', async () => {
      (verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(verifyToken(INVALID_TOKEN, 'access'))
        .rejects
        .toThrow('Token verification failed: invalid signature');
    });
  });

  describe('rotateRefreshToken', () => {
    beforeEach(() => {
      (verify as jest.Mock).mockReturnValue({
        ...TEST_USER_PAYLOAD,
        type: 'refresh',
        iat: Date.now() / 1000
      });
    });

    test('should successfully rotate valid refresh token', async () => {
      const result = await rotateRefreshToken('valid.refresh.token', TEST_USER_PAYLOAD);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('expiresIn');
      expect(result).toHaveProperty('fingerprint');
      expect(result).toHaveProperty('tokenId');
      expect(sign).toHaveBeenCalledWith(
        expect.objectContaining({
          ...TEST_USER_PAYLOAD,
          type: 'refresh'
        }),
        jwtConfig.refreshTokenSecret,
        expect.any(Object)
      );
    });

    test('should generate new fingerprint during rotation', async () => {
      const result1 = await rotateRefreshToken('valid.refresh.token', TEST_USER_PAYLOAD);
      const result2 = await rotateRefreshToken('valid.refresh.token', TEST_USER_PAYLOAD);

      expect(result1.fingerprint).not.toBe(result2.fingerprint);
    });

    test('should reject rotation of invalid refresh tokens', async () => {
      (verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(rotateRefreshToken(INVALID_TOKEN, TEST_USER_PAYLOAD))
        .rejects
        .toThrow('Token verification failed: invalid token');
    });

    test('should maintain consistent token expiration during rotation', async () => {
      const result = await rotateRefreshToken('valid.refresh.token', TEST_USER_PAYLOAD);

      expect(result.expiresIn).toBe(jwtConfig.refreshTokenExpiry);
      expect(sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({
          expiresIn: jwtConfig.refreshTokenExpiry
        })
      );
    });
  });

  describe('generateTokenFingerprint', () => {
    test('should generate secure fingerprint of correct length', () => {
      const fingerprint = generateTokenFingerprint();
      
      expect(fingerprint).toMatch(/^[A-Za-z0-9]{32}$/);
      expect(randomBytes).toHaveBeenCalledWith(32);
    });

    test('should generate unique fingerprints for each call', () => {
      const fingerprint1 = generateTokenFingerprint();
      const fingerprint2 = generateTokenFingerprint();

      expect(fingerprint1).not.toBe(fingerprint2);
    });
  });
});