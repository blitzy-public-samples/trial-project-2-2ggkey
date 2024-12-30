/**
 * @fileoverview Secure localStorage utility functions with encryption, compression, and type safety
 * @version 1.0.0
 */

import CryptoJS from 'crypto-js'; // v4.1.1
import * as pako from 'pako'; // v2.1.0
import { Theme } from '../types/common.types';

// Constants
const ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY || 'default-key';
const COMPRESSION_THRESHOLD = 1024 * 1024; // 1MB
const STORAGE_PREFIX = 'tms_'; // Task Management System prefix

// Types
interface StorageStats {
  usedSpace: number;
  availableSpace: number;
  totalSpace: number;
  usagePercentage: number;
}

interface StorageChangeEvent {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

/**
 * Securely sets an encrypted item in localStorage with optional compression
 * @template T - Type of the value being stored
 * @param {string} key - Storage key
 * @param {T} value - Value to store
 * @param {boolean} encrypt - Whether to encrypt the data
 * @param {boolean} compress - Whether to compress large data
 * @throws {Error} If storage quota is exceeded or encryption fails
 */
export async function setLocalStorageItem<T>(
  key: string,
  value: T,
  encrypt = true,
  compress = true
): Promise<void> {
  try {
    if (!key || typeof key !== 'string') {
      throw new Error('Invalid storage key');
    }

    // Check available space
    const stats = await getStorageUsage();
    if (stats.availableSpace < 1024) {
      throw new Error('Insufficient storage space');
    }

    // Serialize value
    let serializedValue = JSON.stringify(value);

    // Compress if enabled and data is large
    if (compress && serializedValue.length > COMPRESSION_THRESHOLD) {
      const compressed = pako.deflate(serializedValue);
      serializedValue = String.fromCharCode.apply(null, compressed);
    }

    // Encrypt if enabled
    if (encrypt) {
      serializedValue = CryptoJS.AES.encrypt(
        serializedValue,
        ENCRYPTION_KEY
      ).toString();
    }

    // Store with prefix
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    localStorage.setItem(prefixedKey, serializedValue);

    // Emit storage change event
    dispatchStorageEvent(key, value);
  } catch (error) {
    console.error('Storage operation failed:', error);
    throw new Error(`Failed to set storage item: ${error.message}`);
  }
}

/**
 * Retrieves and decrypts an item from localStorage
 * @template T - Expected type of the stored value
 * @param {string} key - Storage key
 * @param {boolean} encrypted - Whether the data is encrypted
 * @param {boolean} compressed - Whether the data is compressed
 * @returns {Promise<T | null>} Decrypted and parsed value or null if not found
 */
export async function getLocalStorageItem<T>(
  key: string,
  encrypted = true,
  compressed = true
): Promise<T | null> {
  try {
    if (!key) {
      throw new Error('Invalid storage key');
    }

    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    let value = localStorage.getItem(prefixedKey);

    if (!value) {
      return null;
    }

    // Decrypt if encrypted
    if (encrypted) {
      const decrypted = CryptoJS.AES.decrypt(value, ENCRYPTION_KEY);
      value = decrypted.toString(CryptoJS.enc.Utf8);
    }

    // Decompress if compressed
    if (compressed && value.length > COMPRESSION_THRESHOLD) {
      const compressed = new Uint8Array(value.split('').map(char => char.charCodeAt(0)));
      value = pako.inflate(compressed, { to: 'string' });
    }

    // Parse and validate
    const parsed = JSON.parse(value) as T;
    if (parsed === undefined) {
      throw new Error('Invalid stored value');
    }

    return parsed;
  } catch (error) {
    console.error('Failed to retrieve storage item:', error);
    return null;
  }
}

/**
 * Safely removes an item from localStorage
 * @param {string} key - Storage key to remove
 */
export async function removeLocalStorageItem(key: string): Promise<void> {
  try {
    if (!key) {
      throw new Error('Invalid storage key');
    }

    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    const oldValue = await getLocalStorageItem(key);
    
    localStorage.removeItem(prefixedKey);
    
    // Emit storage change event
    dispatchStorageEvent(key, null, oldValue);
  } catch (error) {
    console.error('Failed to remove storage item:', error);
    throw new Error(`Failed to remove storage item: ${error.message}`);
  }
}

/**
 * Safely clears all items from localStorage matching optional pattern
 * @param {string} pattern - Optional pattern to match keys
 */
export async function clearLocalStorage(pattern?: string): Promise<void> {
  try {
    if (pattern) {
      const keys = Object.keys(localStorage)
        .filter(key => key.startsWith(STORAGE_PREFIX))
        .filter(key => key.includes(pattern));

      for (const key of keys) {
        await removeLocalStorageItem(key.replace(STORAGE_PREFIX, ''));
      }
    } else {
      localStorage.clear();
      dispatchStorageEvent('clear', null);
    }
  } catch (error) {
    console.error('Failed to clear storage:', error);
    throw new Error(`Failed to clear storage: ${error.message}`);
  }
}

/**
 * Calculates current localStorage usage and available space
 * @returns {Promise<StorageStats>} Storage usage statistics
 */
export async function getStorageUsage(): Promise<StorageStats> {
  try {
    let totalSize = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalSize += localStorage[key].length * 2; // UTF-16 characters = 2 bytes
      }
    }

    const totalSpace = 5 * 1024 * 1024; // 5MB default localStorage limit
    const usedSpace = totalSize;
    const availableSpace = totalSpace - usedSpace;
    const usagePercentage = (usedSpace / totalSpace) * 100;

    return {
      usedSpace,
      availableSpace,
      totalSpace,
      usagePercentage
    };
  } catch (error) {
    console.error('Failed to calculate storage usage:', error);
    throw new Error(`Failed to calculate storage usage: ${error.message}`);
  }
}

/**
 * Dispatches a storage change event
 * @private
 */
function dispatchStorageEvent(
  key: string,
  newValue: unknown,
  oldValue: unknown = null
): void {
  const event: StorageChangeEvent = {
    key,
    oldValue,
    newValue,
    timestamp: Date.now()
  };

  window.dispatchEvent(
    new CustomEvent('tms-storage-change', { detail: event })
  );
}

// Type guard for theme validation
function isValidTheme(theme: unknown): theme is Theme {
  return typeof theme === 'string' && Object.values(Theme).includes(theme as Theme);
}

/**
 * Storage keys enum for type safety
 */
export enum StorageKeys {
  THEME = 'theme',
  USER_PREFERENCES = 'user_preferences',
  AUTH_TOKEN = 'auth_token'
}