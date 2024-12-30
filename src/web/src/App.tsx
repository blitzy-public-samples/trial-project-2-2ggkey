/**
 * @fileoverview Root application component implementing secure routing, theme management,
 * and enhanced performance features for the Task Management System
 * @version 1.0.0
 */

import React, { useEffect, Suspense } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@emotion/react';
import styled from '@emotion/styled';
import { ErrorBoundary } from 'react-error-boundary';

import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import LoadingSpinner from './components/common/LoadingSpinner';
import routes from './config/routes';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { Theme } from './types/common.types';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface AppProps {
  /** CSRF token for security */
  csrfToken?: string;
  /** User locale for internationalization */
  locale?: string;
}

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const AppContainer = styled.div`
  height: 100vh;
  background-color: var(--theme-background);
  color: var(--theme-text);
  transition: var(--theme-transition);
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: var(--theme-background);
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: var(--spacing-lg);
  color: var(--theme-error);
  text-align: center;
`;

// ============================================================================
// Error Boundary Component
// ============================================================================

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => (
  <ErrorContainer role="alert">
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </ErrorContainer>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * Root application component with comprehensive security and performance features
 */
const App: React.FC<AppProps> = React.memo(({ 
  csrfToken = process.env.REACT_APP_CSRF_TOKEN,
  locale = 'en'
}) => {
  const { currentTheme, isDarkMode } = useTheme();
  const { isAuthenticated } = useAuth();

  // Set security headers
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self'; img-src 'self' https:; script-src 'self'";
    document.head.appendChild(meta);

    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  // Handle errors with analytics tracking
  const handleError = (error: Error) => {
    console.error('Application Error:', error);
    window.dispatchEvent(new CustomEvent('app-error', {
      detail: { error: error.message, timestamp: Date.now() }
    }));
  };

  // Loading fallback with theme support
  const LoadingFallback = (
    <LoadingContainer>
      <LoadingSpinner
        size="large"
        color={isDarkMode ? 'var(--theme-primary-dark)' : 'var(--theme-primary-light)'}
        ariaLabel="Loading application..."
      />
    </LoadingContainer>
  );

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => window.location.reload()}
    >
      <Provider store={store}>
        <ThemeProvider theme={{ mode: currentTheme }}>
          <BrowserRouter>
            <AppContainer data-theme={currentTheme}>
              <Suspense fallback={LoadingFallback}>
                <Routes>
                  {/* Public routes */}
                  <Route
                    path="/auth/*"
                    element={
                      <AuthLayout
                        csrfToken={csrfToken}
                        locale={locale}
                      />
                    }
                  />

                  {/* Protected routes */}
                  <Route
                    path="/app/*"
                    element={
                      isAuthenticated ? (
                        <DashboardLayout>
                          <Routes>
                            {routes.map((route) => (
                              <Route
                                key={route.path}
                                path={route.path}
                                element={
                                  <Suspense fallback={LoadingFallback}>
                                    <route.element />
                                  </Suspense>
                                }
                              />
                            ))}
                          </Routes>
                        </DashboardLayout>
                      ) : (
                        <Navigate to="/auth/login" replace />
                      )
                    }
                  />

                  {/* Default redirect */}
                  <Route
                    path="*"
                    element={<Navigate to="/auth/login" replace />}
                  />
                </Routes>
              </Suspense>
            </AppContainer>
          </BrowserRouter>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
});

// Display name for debugging
App.displayName = 'App';

export default App;