/**
 * @fileoverview Enterprise-grade dashboard layout component implementing a secure,
 * responsive, and accessible three-panel structure with comprehensive features
 * @version 1.0.0
 */

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import styled from '@emotion/styled';
import { ErrorBoundary } from 'react-error-boundary';

import Header from '../components/layout/Header';
import Navigation from '../components/layout/Navigation';
import MainContent from '../components/layout/MainContent';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

// ============================================================================
// Types & Interfaces
// ============================================================================

interface DashboardLayoutProps {
  /** Child components to render within the layout */
  children: React.ReactNode;
  /** Optional CSS class for custom styling */
  className?: string;
  /** ARIA role for accessibility */
  role?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const LayoutContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: var(--theme-background);
  color: var(--theme-text);
  transition: var(--theme-transition);

  /* High contrast mode support */
  @media (forced-colors: active) {
    border: 1px solid ButtonText;
  }
`;

const MainSection = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;

  @media (max-width: 768px) {
    flex-direction: column;
    padding: var(--spacing-md);
  }

  @media (min-width: 769px) {
    padding: var(--spacing-lg);
  }
`;

const ErrorFallback = styled.div`
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--theme-error);
`;

// ============================================================================
// Error Boundary Component
// ============================================================================

const ErrorFallbackComponent: React.FC<{ error: Error }> = ({ error }) => (
  <ErrorFallback role="alert" aria-live="assertive">
    <h2>Something went wrong</h2>
    <pre>{error.message}</pre>
    <button onClick={() => window.location.reload()}>
      Retry
    </button>
  </ErrorFallback>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * Enhanced dashboard layout component implementing a secure, responsive, and
 * accessible three-panel structure with comprehensive features
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = React.memo(({
  children,
  className,
  role = 'main'
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, validateSession } = useAuth();
  const { currentTheme, toggleTheme } = useTheme();
  
  // Track mounted state to prevent memory leaks
  const isMounted = useRef(true);
  const [isLoading, setIsLoading] = useState(true);

  // Session validation and security check
  useEffect(() => {
    const validateAuth = async () => {
      try {
        const isValid = await validateSession();
        if (isMounted.current && !isValid) {
          navigate('/login', { 
            replace: true,
            state: { from: location.pathname }
          });
        }
      } catch (error) {
        console.error('Session validation failed:', error);
        navigate('/login', { replace: true });
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    validateAuth();

    return () => {
      isMounted.current = false;
    };
  }, [location.pathname, navigate, validateSession]);

  // Handle theme changes with analytics tracking
  const handleThemeChange = useCallback((theme: string) => {
    toggleTheme();
    // Track theme change event
    window.dispatchEvent(new CustomEvent('theme-change', {
      detail: { theme, timestamp: Date.now() }
    }));
  }, [toggleTheme]);

  // Handle errors with analytics tracking
  const handleError = useCallback((error: Error) => {
    console.error('Dashboard Layout Error:', error);
    window.dispatchEvent(new CustomEvent('error', {
      detail: { error: error.message, timestamp: Date.now() }
    }));
  }, []);

  // Redirect to login if not authenticated
  if (!isAuthenticated && !isLoading) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallbackComponent}
      onError={handleError}
    >
      <LayoutContainer
        className={className}
        role={role}
        data-theme={currentTheme}
        data-testid="dashboard-layout"
      >
        <Header
          onThemeChange={handleThemeChange}
          analyticsEnabled
        />

        <MainSection>
          <Navigation
            securityContext={{
              validateAccess: () => isAuthenticated,
              securityLevel: 'high'
            }}
            analyticsConfig={{
              enabled: true,
              trackEvents: true
            }}
          >
            <MainContent
              isLoading={isLoading}
              testId="dashboard-main-content"
            >
              {children}
            </MainContent>
          </Navigation>
        </MainSection>
      </LayoutContainer>
    </ErrorBoundary>
  );
});

// Display name for debugging
DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;