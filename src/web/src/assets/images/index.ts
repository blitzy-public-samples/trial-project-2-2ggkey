/**
 * @fileoverview Centralized image asset management for the Task Management System
 * @version 1.0.0
 * 
 * This module provides a centralized location for managing and exporting optimized
 * image assets throughout the React frontend application. It supports theme-aware SVG
 * assets and responsive image loading with accessibility considerations.
 */

// Constants for image paths
const LOGO_PATH = './logo.svg';
const DEFAULT_AVATAR = './default-avatar.svg';
const PLACEHOLDER_IMAGE = './placeholder.svg';

/**
 * Supported image formats for the application
 * Prioritizing vector formats for scalability and modern compressed formats for raster
 */
export const SUPPORTED_IMAGE_FORMATS = ['svg', 'png', 'jpg', 'webp'] as const;
type SupportedImageFormat = typeof SUPPORTED_IMAGE_FORMATS[number];

/**
 * Standard dimensions for common image types
 * Following Material Design specifications for consistent sizing
 */
export const IMAGE_DIMENSIONS = {
  avatar: {
    width: 128,
    height: 128
  },
  logo: {
    small: {
      width: 32,
      height: 32
    },
    medium: {
      width: 48,
      height: 48
    },
    large: {
      width: 64,
      height: 64
    }
  }
} as const;

/**
 * Interface defining the structure of image asset metadata
 * Used for maintaining consistent image properties across the application
 */
interface ImageAssetMetadata {
  path: string;
  format: SupportedImageFormat;
  themeAware: boolean;
  dimensions?: {
    width: number;
    height: number;
  };
  accessibility: {
    role: 'img' | 'presentation';
    description?: string;
  };
}

/**
 * Theme-aware SVG logo path for application branding and header components
 * @type {ImageAssetMetadata}
 */
export const logo: ImageAssetMetadata = {
  path: LOGO_PATH,
  format: 'svg',
  themeAware: true,
  dimensions: IMAGE_DIMENSIONS.logo.medium,
  accessibility: {
    role: 'img',
    description: 'Task Management System Logo'
  }
};

/**
 * Default avatar SVG with consistent dimensions for user profile placeholders
 * @type {ImageAssetMetadata}
 */
export const defaultAvatar: ImageAssetMetadata = {
  path: DEFAULT_AVATAR,
  format: 'svg',
  themeAware: true,
  dimensions: IMAGE_DIMENSIONS.avatar,
  accessibility: {
    role: 'presentation'
  }
};

/**
 * Decorative placeholder SVG for component loading states and image fallbacks
 * @type {ImageAssetMetadata}
 */
export const placeholder: ImageAssetMetadata = {
  path: PLACEHOLDER_IMAGE,
  format: 'svg',
  themeAware: true,
  accessibility: {
    role: 'presentation'
  }
};

/**
 * Consolidated object containing all optimized and theme-aware image asset paths
 * @type {Object.<string, ImageAssetMetadata>}
 */
export const ImageAssets = {
  logo,
  defaultAvatar,
  placeholder
} as const;

/**
 * Type definition for the ImageAssets object to ensure type safety when accessing assets
 */
export type ImageAssetKey = keyof typeof ImageAssets;

/**
 * Helper function to get the full path for an image asset
 * @param {ImageAssetKey} key - The key of the image asset
 * @returns {string} The full path to the image asset
 */
export const getImagePath = (key: ImageAssetKey): string => {
  return ImageAssets[key].path;
};

/**
 * Helper function to get the dimensions for an image asset
 * @param {ImageAssetKey} key - The key of the image asset
 * @returns {object | undefined} The dimensions of the image asset if defined
 */
export const getImageDimensions = (key: ImageAssetKey) => {
  return ImageAssets[key].dimensions;
};

/**
 * Default export for convenient access to all image assets and utilities
 */
export default {
  paths: ImageAssets,
  dimensions: IMAGE_DIMENSIONS,
  supportedFormats: SUPPORTED_IMAGE_FORMATS,
  getPath: getImagePath,
  getDimensions: getImageDimensions
};