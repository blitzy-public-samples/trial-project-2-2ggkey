/**
 * @fileoverview Encryption utility module providing cryptographic operations
 * including password hashing and data encryption with comprehensive type safety.
 * @version 1.0.0
 */

import { passwordConfig } from '../config/auth.config';
import bcrypt from 'bcrypt'; // ^5.1.0
import crypto from 'crypto';

// Cryptographic constants
const ENCRYPTION_ALGORITHM = 'aes-256-gcm' as const;
const AUTH_TAG_LENGTH = 16 as const; // 128 bits
const IV_LENGTH = 12 as const; // 96 bits for GCM
const KEY_LENGTH = 32 as const; // 256 bits
const SALT_LENGTH = 16 as const; // 128 bits

/**
 * Interface representing encrypted data structure with initialization vector
 * and authentication tag for AES-GCM mode
 */
export interface EncryptedData {
  encryptedData: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * Interface for configuring cryptographic operations
 */
interface CryptoOptions {
  keyLength: number;
  ivLength: number;
  authTagLength: number;
}

/**
 * Default cryptographic options
 */
const defaultCryptoOptions: CryptoOptions = {
  keyLength: KEY_LENGTH,
  ivLength: IV_LENGTH,
  authTagLength: AUTH_TAG_LENGTH,
} as const;

/**
 * Securely hashes passwords using bcrypt with timing attack protection
 * @param password - Plain text password to hash
 * @returns Promise resolving to the hashed password
 * @throws Error if password validation fails or hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Invalid password input');
  }

  try {
    // Generate cryptographically secure salt and hash password
    const salt = await bcrypt.genSalt(passwordConfig.saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    throw new Error('Password hashing failed');
  }
}

/**
 * Securely compares passwords with constant-time comparison
 * @param password - Plain text password to compare
 * @param hashedPassword - Previously hashed password
 * @returns Promise resolving to boolean indicating if passwords match
 * @throws Error if input validation fails or comparison fails
 */
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  if (!password || !hashedPassword) {
    throw new Error('Invalid password comparison inputs');
  }

  try {
    // Use timing-safe comparison
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
}

/**
 * Encrypts data using AES-256-GCM with secure key management
 * @param data - Data to encrypt (string or Buffer)
 * @param key - Encryption key (string or Buffer)
 * @param options - Optional cryptographic settings
 * @returns Promise resolving to encrypted data structure
 * @throws Error if encryption fails or input validation fails
 */
export async function encryptData(
  data: string | Buffer,
  key: string | Buffer,
  options: Partial<CryptoOptions> = {}
): Promise<EncryptedData> {
  // Input validation
  if (!data || !key) {
    throw new Error('Invalid encryption inputs');
  }

  const opts = { ...defaultCryptoOptions, ...options };

  try {
    // Convert string inputs to buffers if necessary
    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key);

    // Generate cryptographically secure IV
    const iv = crypto.randomBytes(opts.ivLength);

    // Create cipher with AES-256-GCM
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      keyBuffer,
      iv,
      { authTagLength: opts.authTagLength }
    );

    // Encrypt data
    const encryptedData = Buffer.concat([
      cipher.update(dataBuffer),
      cipher.final()
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return { encryptedData, iv, authTag };
  } catch (error) {
    throw new Error('Data encryption failed');
  }
}

/**
 * Decrypts AES-256-GCM encrypted data with authentication verification
 * @param encryptedData - Encrypted data structure
 * @param key - Decryption key (string or Buffer)
 * @returns Promise resolving to decrypted data buffer
 * @throws Error if decryption fails or authentication fails
 */
export async function decryptData(
  encryptedData: EncryptedData,
  key: string | Buffer
): Promise<Buffer> {
  // Input validation
  if (!encryptedData?.encryptedData || !encryptedData?.iv || !encryptedData?.authTag || !key) {
    throw new Error('Invalid decryption inputs');
  }

  try {
    const keyBuffer = Buffer.isBuffer(key) ? key : Buffer.from(key);

    // Create decipher
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      keyBuffer,
      encryptedData.iv,
      { authTagLength: AUTH_TAG_LENGTH }
    );

    // Set auth tag for verification
    decipher.setAuthTag(encryptedData.authTag);

    // Decrypt data
    const decryptedData = Buffer.concat([
      decipher.update(encryptedData.encryptedData),
      decipher.final()
    ]);

    return decryptedData;
  } catch (error) {
    throw new Error('Data decryption failed');
  }
}