/**
 * @fileoverview Enhanced entry point of the React application that bootstraps the task management system
 * with advanced security features, performance monitoring, and robust error handling
 * @version 1.0.0
 */

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ErrorBoundary } from 'react-error-boundary';

import App from './App';
import { store } from './store';
import './styles/variables.css';
import './styles/theme.css';

// ============================================================================
// Constants & Environment Validation
// ============================================================================

const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const PERFORMANCE_MONITORING_ENABLED = process.env.ENABLE_MONITORING === 'true';

// ============================================================================
// Environment & Security Validation
// ============================================================================

/**
 * Validates runtime environment and security configurations
 * @returns {boolean} Environment validation result
 */
const validateEnvironment = (): boolean => {
  try {
    // Validate required environment variables
    if (!process.env.REACT_APP_API_URL) {
      throw new Error('API URL not configured');
    }

    // Validate CSP headers in production
    if (!IS_DEVELOPMENT) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = "default-src 'self'; img-src 'self' https:; script-src 'self'";
      document.head.appendChild(meta);
    }

    // Validate secure context in production
    if (!IS_DEVELOPMENT && !window.isSecureContext) {
      throw new Error('Application must be served over HTTPS');
    }

    return true;
  } catch (error) {
    console.error('Environment validation failed:', error);
    return false;
  }
};

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Initializes performance monitoring and error tracking
 */
const initializeMonitoring = (): void => {
  if (PERFORMANCE_MONITORING_ENABLED) {
    // Set performance markers
    performance.mark('app-init-start');

    // Monitor long tasks
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 50) { // Tasks longer than 50ms
          console.warn('Long task detected:', entry);
        }
      });
    });
    observer.observe({ entryTypes: ['longtask'] });

    // Monitor memory usage in development
    if (IS_DEVELOPMENT && performance.memory) {
      setInterval(() => {
        const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
        const usagePercent = (usedJSHeapSize / totalJSHeapSize) * 100;
        if (usagePercent > 90) {
          console.warn('High memory usage detected:', usagePercent.toFixed(2) + '%');
        }
      }, 10000);
    }
  }
};

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Global error boundary fallback component
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>Something went wrong</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button onClick={() => window.location.reload()}>Reload Application</button>
  </div>
);

// ============================================================================
// Application Bootstrap
// ============================================================================

/**
 * Bootstraps the application with security and monitoring
 */
const renderApp = (): void => {
  // Validate environment before rendering
  if (!validateEnvironment()) {
    document.body.innerHTML = '<div role="alert">Application configuration error</div>';
    return;
  }

  // Initialize performance monitoring
  initializeMonitoring();

  // Get and validate root element
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Create root with concurrent features
  const root = createRoot(rootElement);

  // Render application with error boundary and security context
  root.render(
    <StrictMode>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={(error) => {
          console.error('Application Error:', error);
          // Track error in monitoring system
          if (PERFORMANCE_MONITORING_ENABLED) {
            window.dispatchEvent(new CustomEvent('app-error', {
              detail: { error: error.message, timestamp: Date.now() }
            }));
          }
        }}
      >
        <Provider store={store}>
          <App />
        </Provider>
      </ErrorBoundary>
    </StrictMode>
  );

  // Set final performance marker
  if (PERFORMANCE_MONITORING_ENABLED) {
    performance.mark('app-init-end');
    performance.measure('app-initialization', 'app-init-start', 'app-init-end');
  }
};

// ============================================================================
// Application Initialization
// ============================================================================

// Initialize application with error handling
try {
  renderApp();
} catch (error) {
  console.error('Critical initialization error:', error);
  document.body.innerHTML = '<div role="alert">Failed to initialize application</div>';
}

// Register cleanup for performance monitoring
if (PERFORMANCE_MONITORING_ENABLED) {
  window.addEventListener('unload', () => {
    performance.clearMarks();
    performance.clearMeasures();
  });
}