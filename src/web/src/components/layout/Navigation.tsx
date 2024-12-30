/**
 * @fileoverview Enterprise-grade navigation component with comprehensive security,
 * accessibility, and responsive design features
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useMediaQuery } from '@mui/material';
import { AppBar, Toolbar, IconButton, Fade } from '@mui/material';
import { Menu as MenuIcon, NavigateNext, NavigateBefore } from '@mui/icons-material';
import styled from '@emotion/styled';
import Sidebar from '../common/Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { Theme } from '../../types/common.types';

// ============================================================================
// Constants
// ============================================================================

const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1440
} as const;

const TRANSITION_DURATION = 300;

const ARIA_LABELS = {
  TOGGLE_SIDEBAR: 'Toggle navigation sidebar',
  MAIN_NAV: 'Main navigation'
} as const;

// ============================================================================
// Styled Components
// ============================================================================

const NavigationContainer = styled.nav`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1100;
  transition: all ${TRANSITION_DURATION}ms ease-in-out;
  background-color: var(--color-background);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StyledAppBar = styled(AppBar)`
  background-color: var(--color-background);
  color: var(--color-text);
  box-shadow: none;
  border-bottom: 1px solid var(--color-border);
`;

const StyledToolbar = styled(Toolbar)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  min-height: 64px;

  @media (max-width: ${BREAKPOINTS.MOBILE}px) {
    min-height: 56px;
  }
`;

const MainContent = styled.main<{ $sidebarOpen: boolean }>`
  margin-left: ${({ $sidebarOpen }) => ($sidebarOpen ? '240px' : '0')};
  transition: margin ${TRANSITION_DURATION}ms ease-in-out;
  width: ${({ $sidebarOpen }) => ($sidebarOpen ? 'calc(100% - 240px)' : '100%')};

  @media (max-width: ${BREAKPOINTS.TABLET}px) {
    margin-left: 0;
    width: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// ============================================================================
// Types & Interfaces
// ============================================================================

interface NavigationProps {
  children: React.ReactNode;
  securityContext?: SecurityContext;
  analyticsConfig?: AnalyticsConfig;
}

interface SecurityContext {
  validateAccess: () => boolean;
  securityLevel: 'high' | 'medium' | 'low';
}

interface AnalyticsConfig {
  enabled: boolean;
  trackEvents: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Enhanced navigation component with security, accessibility, and analytics features
 */
const Navigation: React.FC<NavigationProps> = React.memo(({
  children,
  securityContext,
  analyticsConfig = { enabled: false, trackEvents: false }
}) => {
  // Hooks
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.TABLET}px)`);
  const { isAuthenticated, validateAccess } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Security validation
  useEffect(() => {
    if (securityContext?.validateAccess) {
      const hasAccess = securityContext.validateAccess();
      if (!hasAccess) {
        console.error('Security validation failed');
        // Handle security violation
      }
    }
  }, [securityContext]);

  // Handle responsive sidebar
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Analytics tracking
  const trackNavigationEvent = useCallback((eventName: string, details: object) => {
    if (analyticsConfig.enabled && analyticsConfig.trackEvents) {
      window.dispatchEvent(new CustomEvent('navigation-event', {
        detail: { event: eventName, ...details, timestamp: Date.now() }
      }));
    }
  }, [analyticsConfig]);

  // Toggle sidebar with animation
  const handleToggleSidebar = useCallback(() => {
    setIsTransitioning(true);
    setSidebarOpen(prev => !prev);
    
    trackNavigationEvent('toggle_sidebar', { state: !sidebarOpen });

    setTimeout(() => {
      setIsTransitioning(false);
    }, TRANSITION_DURATION);
  }, [sidebarOpen, trackNavigationEvent]);

  // Memoized security level indicator
  const SecurityIndicator = useMemo(() => (
    securityContext?.securityLevel === 'high' && (
      <div role="status" aria-label="High security mode active">
        🔒
      </div>
    )
  ), [securityContext?.securityLevel]);

  // Handle keyboard navigation
  const handleKeyboardNav = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setSidebarOpen(false);
    }
  }, []);

  return (
    <NavigationContainer
      role="navigation"
      aria-label={ARIA_LABELS.MAIN_NAV}
      onKeyDown={handleKeyboardNav}
    >
      <StyledAppBar position="fixed">
        <StyledToolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label={ARIA_LABELS.TOGGLE_SIDEBAR}
            onClick={handleToggleSidebar}
            data-testid="nav-toggle"
          >
            {sidebarOpen ? <NavigateBefore /> : <MenuIcon />}
          </IconButton>
          {SecurityIndicator}
        </StyledToolbar>
      </StyledAppBar>

      <Fade in={!isTransitioning} timeout={TRANSITION_DURATION}>
        <div>
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            variant={isMobile ? 'temporary' : 'permanent'}
            enableTouchGestures={isMobile}
          />
        </div>
      </Fade>

      <MainContent
        $sidebarOpen={sidebarOpen && !isMobile}
        role="main"
        aria-live="polite"
      >
        {children}
      </MainContent>
    </NavigationContainer>
  );
});

// Display name for debugging
Navigation.displayName = 'Navigation';

export default Navigation;