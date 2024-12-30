/**
 * @fileoverview Enterprise-grade header component with comprehensive security,
 * accessibility, and responsive design features.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import styled from '@emotion/styled';
import { useNavigate } from 'react-router-dom';
import Avatar from '../common/Avatar';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../types/common.types';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface HeaderProps {
  /** Additional CSS classes */
  className?: string;
  /** Theme change callback */
  onThemeChange?: (theme: string) => void;
  /** Enable analytics tracking */
  analyticsEnabled?: boolean;
}

// ============================================================================
// Styled Components
// ============================================================================

const HeaderContainer = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  height: 64px;
  background-color: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  transition: all 0.2s ease-in-out;
  position: sticky;
  top: 0;
  z-index: 1000;
  backdrop-filter: blur(8px);

  @media (max-width: 768px) {
    padding: 1rem;
    height: 56px;
  }
`;

const LogoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const Logo = styled.h1`
  font-size: 1.5rem;
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0;

  @media (max-width: 768px) {
    font-size: 1.25rem;
  }
`;

const NavigationSection = styled.nav`
  display: flex;
  align-items: center;
  gap: 2rem;

  @media (max-width: 768px) {
    gap: 1rem;
  }
`;

const UserSection = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const ThemeToggle = styled(Button)`
  padding: 0.5rem;
  min-width: unset;
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

// ============================================================================
// Component
// ============================================================================

/**
 * Enhanced header component with security, accessibility, and performance optimizations
 */
const Header: React.FC<HeaderProps> = React.memo(({
  className,
  onThemeChange,
  analyticsEnabled = false
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();

  // Security: Monitor session status
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  // Handle theme toggle with analytics
  const handleThemeToggle = useCallback(() => {
    toggleTheme();
    if (analyticsEnabled) {
      // Track theme change event
      window.dispatchEvent(new CustomEvent('theme-change', {
        detail: { theme: isDarkMode ? Theme.LIGHT : Theme.DARK }
      }));
    }
    onThemeChange?.(isDarkMode ? Theme.LIGHT : Theme.DARK);
  }, [toggleTheme, isDarkMode, analyticsEnabled, onThemeChange]);

  // Handle secure logout
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout, navigate]);

  // Memoize theme icon to prevent unnecessary re-renders
  const ThemeIcon = useMemo(() => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {isDarkMode ? (
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
      ) : (
        <circle cx="12" cy="12" r="5" />
      )}
    </svg>
  ), [isDarkMode]);

  return (
    <HeaderContainer
      className={className}
      role="banner"
      aria-label="Main header"
    >
      <LogoSection>
        <Logo>Task Manager</Logo>
      </LogoSection>

      <NavigationSection role="navigation" aria-label="Main navigation">
        <Button
          variant="text"
          onClick={() => navigate('/dashboard')}
          ariaLabel="Go to dashboard"
        >
          Dashboard
        </Button>
        <Button
          variant="text"
          onClick={() => navigate('/tasks')}
          ariaLabel="View tasks"
        >
          Tasks
        </Button>
        <Button
          variant="text"
          onClick={() => navigate('/projects')}
          ariaLabel="View projects"
        >
          Projects
        </Button>
      </NavigationSection>

      <UserSection>
        <ThemeToggle
          variant="outlined"
          onClick={handleThemeToggle}
          ariaLabel={`Switch to ${isDarkMode ? 'light' : 'dark'} theme`}
          dataTestId="theme-toggle"
        >
          {ThemeIcon}
        </ThemeToggle>

        {user && (
          <>
            <Avatar
              src={user.avatarUrl}
              alt={`${user.name}'s profile`}
              name={user.name}
              size="sm"
            />
            <Button
              variant="outlined"
              onClick={handleLogout}
              ariaLabel="Log out"
              dataTestId="logout-button"
            >
              Logout
            </Button>
          </>
        )}
      </UserSection>
    </HeaderContainer>
  );
});

Header.displayName = 'Header';

export default Header;