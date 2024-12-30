/**
 * @fileoverview Enterprise-grade sidebar component with comprehensive security,
 * accessibility, and responsive design features
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Skeleton
} from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { routes } from '../../config/routes';

// ============================================================================
// Constants
// ============================================================================

const DRAWER_WIDTH = 240;
const MOBILE_BREAKPOINT = 768;
const SWIPE_THRESHOLD = 50;
const TRANSITION_DURATION = 225;

// ============================================================================
// Styled Components
// ============================================================================

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: DRAWER_WIDTH,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  '& .MuiDrawer-paper': {
    width: DRAWER_WIDTH,
    boxSizing: 'border-box',
    backgroundColor: 'var(--color-background)',
    borderRight: `1px solid ${theme.palette.divider}`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: TRANSITION_DURATION,
    }),
  },
}));

const SidebarHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2),
  minHeight: 64,
  justifyContent: 'center',
}));

const NavigationList = styled(List)({
  padding: 0,
  '& .MuiListItem-root': {
    marginBottom: 4,
  },
});

const NavItem = styled(ListItem)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  margin: '4px 8px',
  '&.Mui-selected': {
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-text)',
    '&:hover': {
      backgroundColor: 'var(--color-primary)',
    },
  },
}));

// ============================================================================
// Types & Interfaces
// ============================================================================

interface SidebarProps {
  /** Controls sidebar visibility */
  open: boolean;
  /** Callback when sidebar should close */
  onClose: () => void;
  /** Sidebar display variant based on screen size */
  variant: 'permanent' | 'temporary';
  /** Enable touch gesture support for mobile */
  enableTouchGestures?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Enhanced sidebar component with security, accessibility, and responsive features
 */
const Sidebar: React.FC<SidebarProps> = React.memo(({
  open,
  onClose,
  variant,
  enableTouchGestures = true,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, userRoles } = useAuth();
  const touchStartX = useRef<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filter navigation items based on user roles and authentication
  const navigationItems = useMemo(() => {
    return routes.filter(route => {
      if (route.requiresAuth && !isAuthenticated) return false;
      if (route.roles && !route.roles.some(role => userRoles?.includes(role))) {
        return false;
      }
      return true;
    });
  }, [isAuthenticated, userRoles]);

  // Handle touch gestures for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableTouchGestures) return;
    touchStartX.current = e.touches[0].clientX;
  }, [enableTouchGestures]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enableTouchGestures || !touchStartX.current) return;

    const touchEndX = e.touches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX > 0 && !open) {
        onClose();
      } else if (deltaX < 0 && open) {
        onClose();
      }
    }
  }, [enableTouchGestures, open, onClose]);

  // Simulate loading state
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Handle navigation with analytics tracking
  const handleNavigation = useCallback((path: string) => {
    navigate(path);
    // Track navigation event
    window.dispatchEvent(new CustomEvent('navigation', {
      detail: { path, timestamp: Date.now() }
    }));
  }, [navigate]);

  return (
    <StyledDrawer
      variant={variant}
      open={open}
      onClose={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      role="navigation"
      aria-label="Main navigation"
    >
      <SidebarHeader>
        {isLoading ? (
          <Skeleton variant="rectangular" width={120} height={32} />
        ) : (
          <h1>Task Manager</h1>
        )}
      </SidebarHeader>

      <Divider />

      <NavigationList>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <ListItem key={index}>
              <Skeleton variant="rectangular" width={DRAWER_WIDTH - 32} height={48} />
            </ListItem>
          ))
        ) : (
          navigationItems.map((item) => (
            <NavItem
              key={item.path}
              button
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              aria-current={location.pathname === item.path ? 'page' : undefined}
            >
              <ListItemIcon>{/* Icon component would go here */}</ListItemIcon>
              <ListItemText 
                primary={item.path.slice(1).charAt(0).toUpperCase() + item.path.slice(2)}
                primaryTypographyProps={{
                  style: { fontWeight: location.pathname === item.path ? 600 : 400 }
                }}
              />
            </NavItem>
          ))
        )}
      </NavigationList>
    </StyledDrawer>
  );
});

// Display name for debugging
Sidebar.displayName = 'Sidebar';

export default Sidebar;