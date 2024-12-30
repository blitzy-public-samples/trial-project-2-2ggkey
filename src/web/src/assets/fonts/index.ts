/**
 * @fileoverview Font configuration and typography system management.
 * Provides consistent font families, weights and scaling across the application
 * while maintaining WCAG 2.1 Level AA compliance for accessibility.
 * 
 * @version 1.0.0
 */

/**
 * Type definition for standardized font weights used throughout the application.
 * Ensures consistent typography weight management.
 */
export interface FontWeight {
  regular: number;
  medium: number;
  bold: number;
}

/**
 * Primary font family stack using system fonts for optimal performance.
 * Prioritizes system native fonts to reduce loading time and ensure
 * consistent rendering across different platforms and devices.
 * 
 * @constant
 */
export const PRIMARY_FONT_FAMILY = `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif`;

/**
 * Monospace font family stack for code blocks and technical content.
 * Provides consistent character spacing and clear distinction for
 * code snippets and technical information.
 * 
 * @constant
 */
export const MONO_FONT_FAMILY = `'Fira Code', 'Source Code Pro', Consolas, Monaco, 'Andale Mono', monospace`;

/**
 * Standardized font weights following Material Design principles.
 * - regular (400): Primary text content
 * - medium (500): Emphasis and subheadings
 * - bold (700): Headers and strong emphasis
 * 
 * @constant
 */
export const FONT_WEIGHTS: FontWeight = {
  regular: 400,
  medium: 500,
  bold: 700
} as const;

/**
 * Base font size in pixels. Used as the foundation for the typography scale.
 * 16px is the recommended base size for optimal readability across devices.
 * 
 * @constant
 * @private
 */
const BASE_FONT_SIZE = 16;

/**
 * Typography scale ratio for maintaining visual hierarchy.
 * Uses a 1.2 (minor third) ratio as specified in the requirements.
 * 
 * @constant
 * @private
 */
const TYPOGRAPHY_SCALE_RATIO = 1.2;

/**
 * Calculates a scaled font size based on the base size and scale ratio.
 * Used internally to maintain consistent typography scaling.
 * 
 * @param {number} level - The number of steps to scale (positive or negative)
 * @returns {number} The calculated font size in pixels
 * @private
 */
const calculateScaledSize = (level: number): number => {
  return BASE_FONT_SIZE * Math.pow(TYPOGRAPHY_SCALE_RATIO, level);
};

// Export additional constants if needed for the typography system
export const TYPOGRAPHY = {
  baseSize: BASE_FONT_SIZE,
  scaleRatio: TYPOGRAPHY_SCALE_RATIO,
  calculateScaledSize
} as const;