/**
 * @fileoverview Main settings page component with tabbed interface for managing user settings
 * @version 1.0.0
 * @package task-management-system
 */

import React, { useState, useEffect, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import Profile from './Profile';
import Security from './Security';
import Tabs from '../../components/common/Tabs';
import { UI_CONFIG } from '../../config/constants';
import styles from './Settings.module.css';

// =============================================================================
// Types & Interfaces
// =============================================================================

interface SettingsTab {
  id: string;
  label: string;
  path: string;
  component: React.FC;
  icon?: React.ReactNode;
  loadingState: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const SETTINGS_TABS: SettingsTab[] = [
  {
    id: 'profile',
    label: 'Profile',
    path: '/settings/profile',
    component: Profile,
    loadingState: false
  },
  {
    id: 'security',
    label: 'Security',
    path: '/settings/security',
    component: Security,
    loadingState: false
  }
];

// =============================================================================
// Error Fallback Component
// =============================================================================

const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <div className={styles['error-container']} role="alert">
    <h2>Something went wrong:</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

// =============================================================================
// Loading Component
// =============================================================================

const LoadingFallback: React.FC = () => (
  <div className={styles['loading-container']}>
    <div className={styles['loading-spinner']} aria-label="Loading settings" />
  </div>
);

// =============================================================================
// Component Implementation
// =============================================================================

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // =============================================================================
  // Effects
  // =============================================================================

  useEffect(() => {
    // Set active tab based on current path
    const currentTab = SETTINGS_TABS.find(tab => 
      location.pathname.includes(tab.path)
    );
    if (currentTab) {
      setActiveTab(currentTab.id);
    } else {
      // Redirect to profile if no matching tab
      navigate(SETTINGS_TABS[0].path, { replace: true });
    }
  }, [location.pathname, navigate]);

  // =============================================================================
  // Event Handlers
  // =============================================================================

  const handleTabChange = (tabId: string) => {
    setIsLoading(true);
    const selectedTab = SETTINGS_TABS.find(tab => tab.id === tabId);
    
    if (selectedTab) {
      // Update URL and active tab
      navigate(selectedTab.path);
      setActiveTab(tabId);

      // Simulate loading state for smooth transition
      setTimeout(() => {
        setIsLoading(false);
      }, UI_CONFIG.ANIMATION_DURATION);
    }
  };

  // =============================================================================
  // Tab Configuration
  // =============================================================================

  const tabConfig = SETTINGS_TABS.map(tab => ({
    id: tab.id,
    label: tab.label,
    content: (
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onReset={() => {
          setIsLoading(false);
        }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <tab.component />
        </Suspense>
      </ErrorBoundary>
    ),
    disabled: isLoading
  }));

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className={styles['settings-container']} role="main">
      <header className={styles['settings-header']}>
        <h1>Settings</h1>
        <p className={styles['settings-description']}>
          Manage your account settings and preferences
        </p>
      </header>

      <div className={styles['settings-content']}>
        <Tabs
          tabs={tabConfig}
          activeTab={activeTab}
          onChange={handleTabChange}
          variant="contained"
          className={styles['settings-tabs']}
        />
      </div>
    </div>
  );
};

export default React.memo(Settings);