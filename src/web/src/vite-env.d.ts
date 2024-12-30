/// <reference types="vite/client" /> // Version ^4.4.0

/**
 * Type augmentation for Vite's ImportMetaEnv interface
 * Provides type definitions for environment variables used in the application
 */
interface ImportMetaEnv {
  /** API endpoint base URL */
  readonly VITE_API_URL: string;
  /** WebSocket server URL */
  readonly VITE_WS_URL: string;
  /** Application title */
  readonly VITE_APP_TITLE: string;
  /** Application version */
  readonly VITE_APP_VERSION: string;
  /** Authentication feature flag */
  readonly VITE_AUTH_ENABLED: boolean;
  /** Current environment */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';
  /** Application logging level */
  readonly VITE_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  /** API request timeout in milliseconds */
  readonly VITE_API_TIMEOUT: number;
  /** Maximum file upload size in bytes */
  readonly VITE_MAX_UPLOAD_SIZE: number;
  /** Feature flags configuration */
  readonly VITE_FEATURE_FLAGS: Record<string, boolean>;
  /** Vite internal environment variables */
  readonly MODE: string;
  readonly BASE_URL: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
}

/**
 * Type augmentation for Vite's ImportMeta interface
 * Provides type definitions for import.meta properties
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
  /** Dynamic import glob function */
  readonly glob: Function;
  /** Eager import glob function */
  readonly globEager: Function;
}

/**
 * Module declarations for static assets
 * Supports modern browser compatibility (Chrome, Firefox, Safari, Edge - last 2 versions)
 */
declare module '*.svg' {
  import React from 'react';
  const content: React.FunctionComponent<React.SVGProps<SVGElement>>;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.webp' {
  const content: string;
  export default content;
}

declare module '*.avif' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.json' {
  const content: any;
  export default content;
}