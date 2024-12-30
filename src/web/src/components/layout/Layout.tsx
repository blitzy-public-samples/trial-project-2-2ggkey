/**
 * @fileoverview Enterprise-grade main layout component implementing a responsive 
 * three-panel layout with comprehensive security, accessibility, and theme support.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { useMediaQuery } from '@mui/material';
import Header from './Header';
import Navigation from './Navigation';
import MainContent from './MainContent';
import Footer from './Footer';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../types/common.types';

// ============================================================================
// Constants
// ============================================================================

const BREAKPOINTS = {
  MOBILE: '320px',
  TABLET: '768px',
  DESKTOP: '1024px',
  LARGE: '1440px'
} as const;

// ============================================================================
// Styled Components
// ============================================================================

const LayoutContainer = styled.div<{ $isRtl?: boolean }>`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--theme-background);
  color: var(--theme-text);
  transition: var(--theme-transition);
  position: relative;
  direction: ${props => props.$isRtl ? 'rtl' : 'ltr'};

  /* High contrast mode support */
  @media (forced-colors: active) {
    border: 1px solid ButtonText;
  }
`;

const MainSection = styled.div<{ $sidebarOpen: boolean }>`
  display: flex;
  flex: 1;
  position: relative;
  overflow: hidden;
  gap: var(--spacing-md);
  margin-top: 64px; /* Header height */

  @media (max-width: ${BREAKPOINTS.TABLET}) {
    margin-top: 56px;
    flex-direction: column;
  }

  @media (min-width: ${BREAKPOINTS.DESKTOP}) {
    max-width: var(--breakpoint-large);
    margin: 64px auto 0;
    padding: 0 var(--spacing-lg);
  }
`;

const SkipLink = styled.a`
  position: absolute;
  left: -9999px;
  z-index: var(--z-index-tooltip);
  padding: var(--spacing-sm);
  background-color: var(--theme-background);
  color: var(--theme-text);
  text-decoration: none;

  &:focus {
    left: var(--spacing-md);
    top: var(--spacing-md);
  }
`;

// ============================================================================
// Types & Interfaces
// ============================================================================

interface LayoutProps {
  /** Child components to render within layout */
  children: React.ReactNode;
  /** Optional className for styling customization */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Enterprise-grade layout component implementing a responsive three-panel layout
 * with comprehensive security, accessibility, and theme support.
 */
const Layout: React.FC<LayoutProps> = React.memo(({
  children,
  className
}) => {
  // Hooks
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.TABLET})`);
  const { isAuthenticated, user } = useAuth();
  const { currentTheme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [isRtl, setIsRtl] = useState(false);

  // Handle responsive sidebar
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Handle RTL support
  useEffect(() => {
    const dir = document.documentElement.dir;
    setIsRtl(dir === 'rtl');
  }, []);

  // Handle theme change with analytics
  const handleThemeChange = useCallback((theme: Theme) => {
    toggleTheme();
    // Track theme change event
    window.dispatchEvent(new CustomEvent('theme-change', {
      detail: { theme, timestamp: Date.now() }
    }));
  }, [toggleTheme]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setSidebarOpen(false);
    }
  }, []);

  return (
    <LayoutContainer
      className={className}
      $isRtl={isRtl}
      onKeyDown={handleKeyDown}
      data-theme={currentTheme}
      data-testid="layout"
    >
      {/* Accessibility skip link */}
      <SkipLink href="#main-content">
        Skip to main content
      </SkipLink>

      {/* Header with theme toggle and user controls */}
      <Header
        onThemeChange={handleThemeChange}
        analyticsEnabled
      />

      <MainSection $sidebarOpen={sidebarOpen}>
        {/* Navigation sidebar with role-based access */}
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
          {/* Main content area with proper ARIA landmarks */}
          <MainContent
            id="main-content"
            role="main"
            aria-label="Main content"
          >
            {children}
          </MainContent>
        </Navigation>
      </MainSection>

      {/* Accessible footer */}
      <Footer />
    </LayoutContainer>
  );
});

// Display name for debugging
Layout.displayName = 'Layout';

export default Layout;