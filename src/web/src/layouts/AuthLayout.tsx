/**
 * @fileoverview Enterprise-grade authentication layout component with comprehensive
 * security features, accessibility support, and responsive design
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { Outlet } from 'react-router-dom';
import { useAnalytics } from '@analytics/react';
import { ErrorBoundary } from 'react-error-boundary';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface AuthLayoutProps {
  /** Optional CSS class name */
  className?: string;
  /** CSRF token for form security */
  csrfToken: string;
  /** Current locale for RTL support */
  locale?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const AuthLayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--color-background);
  transition: background-color 0.2s ease-in-out;
  position: relative;
  direction: ${({ dir }) => dir};

  /* High contrast mode support */
  @media (forced-colors: active) {
    border: 1px solid ButtonText;
  }

  /* Focus outline styles */
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
  }
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-lg);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  position: relative;

  @media (max-width: 768px) {
    padding: var(--spacing-md);
  }

  /* Animation for content transitions */
  animation: fadeIn 0.3s ease-in-out;
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const ErrorFallback = styled.div`
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-error);
`;

// ============================================================================
// Error Boundary Component
// ============================================================================

const ErrorFallbackComponent: React.FC<{ error: Error }> = ({ error }) => (
  <ErrorFallback role="alert" aria-live="assertive">
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
    <button onClick={() => window.location.reload()}>Retry</button>
  </ErrorFallback>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * AuthLayout component providing secure and accessible layout structure for
 * authentication-related pages with comprehensive error handling and analytics
 */
const AuthLayout: React.FC<AuthLayoutProps> = React.memo(({
  className,
  csrfToken,
  locale = 'en'
}) => {
  const analytics = useAnalytics();

  // Security headers setup
  useEffect(() => {
    // Set security headers
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self'; img-src 'self' https:; script-src 'self'";
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  // Analytics tracking
  useEffect(() => {
    analytics.page({
      title: 'Authentication',
      path: window.location.pathname
    });
  }, [analytics]);

  // Error handler for ErrorBoundary
  const handleError = useCallback((error: Error) => {
    console.error('AuthLayout Error:', error);
    analytics.track('Error', {
      category: 'Auth',
      error: error.message
    });
  }, [analytics]);

  // CSRF token validation
  useEffect(() => {
    if (!csrfToken) {
      throw new Error('CSRF token is required for security');
    }
  }, [csrfToken]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallbackComponent}
      onError={handleError}
    >
      <AuthLayoutContainer
        className={className}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        data-testid="auth-layout"
      >
        {/* Secure header with authentication state */}
        <Header
          analyticsEnabled
          onThemeChange={(theme) => {
            analytics.track('Theme Change', { theme });
          }}
        />

        {/* Main content area with ARIA landmarks */}
        <MainContent
          role="main"
          aria-label="Authentication content"
        >
          {/* Hidden CSRF token for form security */}
          <input
            type="hidden"
            name="_csrf"
            value={csrfToken}
            aria-hidden="true"
          />

          {/* Render nested routes */}
          <Outlet />
        </MainContent>

        {/* Accessible footer */}
        <Footer />
      </AuthLayoutContainer>
    </ErrorBoundary>
  );
});

// Display name for debugging
AuthLayout.displayName = 'AuthLayout';

export default AuthLayout;