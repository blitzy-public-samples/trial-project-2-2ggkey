/**
 * @fileoverview Enterprise-grade routing configuration with comprehensive security,
 * analytics, and performance features
 * @version 1.0.0
 */

import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';
import { Analytics } from '@analytics/react';
import AuthLayout from '../layouts/AuthLayout';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Enhanced route configuration interface with security and analytics properties
 */
export interface AppRoute extends RouteObject {
  /** Whether route requires authentication */
  requiresAuth: boolean;
  /** Type of layout to be applied */
  layoutType: 'auth' | 'main';
  /** Required permissions for access */
  permissions?: string[];
  /** Analytics tracking ID */
  analyticsId: string;
  /** Whether to wrap in error boundary */
  errorBoundary: boolean;
}

// ============================================================================
// Route Configurations
// ============================================================================

/**
 * Authentication routes configuration
 * Public routes with authentication-specific layout
 */
export const AUTH_ROUTES: AppRoute[] = [
  {
    path: '/login',
    element: lazy(() => import('../pages/auth/Login')),
    layoutType: 'auth',
    requiresAuth: false,
    analyticsId: 'auth_login',
    errorBoundary: true
  },
  {
    path: '/register',
    element: lazy(() => import('../pages/auth/Register')),
    layoutType: 'auth',
    requiresAuth: false,
    analyticsId: 'auth_register',
    errorBoundary: true
  },
  {
    path: '/forgot-password',
    element: lazy(() => import('../pages/auth/ForgotPassword')),
    layoutType: 'auth',
    requiresAuth: false,
    analyticsId: 'auth_forgot_password',
    errorBoundary: true
  },
  {
    path: '/reset-password',
    element: lazy(() => import('../pages/auth/ResetPassword')),
    layoutType: 'auth',
    requiresAuth: false,
    analyticsId: 'auth_reset_password',
    errorBoundary: true
  }
];

/**
 * Main application routes configuration
 * Protected routes requiring authentication
 */
export const MAIN_ROUTES: AppRoute[] = [
  {
    path: '/dashboard',
    element: lazy(() => import('../pages/dashboard/Dashboard')),
    layoutType: 'main',
    requiresAuth: true,
    permissions: ['view_dashboard'],
    analyticsId: 'dashboard_main',
    errorBoundary: true
  },
  {
    path: '/projects',
    element: lazy(() => import('../pages/projects/Projects')),
    layoutType: 'main',
    requiresAuth: true,
    permissions: ['view_projects'],
    analyticsId: 'projects_list',
    errorBoundary: true,
    children: [
      {
        path: ':projectId',
        element: lazy(() => import('../pages/projects/ProjectDetail')),
        analyticsId: 'project_detail',
        errorBoundary: true
      }
    ]
  },
  {
    path: '/tasks',
    element: lazy(() => import('../pages/tasks/Tasks')),
    layoutType: 'main',
    requiresAuth: true,
    permissions: ['view_tasks'],
    analyticsId: 'tasks_list',
    errorBoundary: true,
    children: [
      {
        path: ':taskId',
        element: lazy(() => import('../pages/tasks/TaskDetail')),
        analyticsId: 'task_detail',
        errorBoundary: true
      }
    ]
  },
  {
    path: '/settings',
    element: lazy(() => import('../pages/settings/Settings')),
    layoutType: 'main',
    requiresAuth: true,
    permissions: ['manage_settings'],
    analyticsId: 'user_settings',
    errorBoundary: true
  }
];

// ============================================================================
// Layout Wrapper Components
// ============================================================================

/**
 * Main layout wrapper component to avoid circular dependency
 */
const MainLayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="main-layout">
      <Analytics pageView>
        {children}
      </Analytics>
    </div>
  );
};

// ============================================================================
// Route Generation
// ============================================================================

/**
 * Generates complete route configuration with enhanced security and analytics
 * @returns {AppRoute[]} Complete route configuration
 */
export function getRoutes(): AppRoute[] {
  const routes: AppRoute[] = [
    // Root redirect
    {
      path: '/',
      element: lazy(() => import('../pages/Root')),
      layoutType: 'main',
      requiresAuth: false,
      analyticsId: 'root',
      errorBoundary: true
    },
    
    // Auth routes with AuthLayout wrapper
    {
      path: '/auth',
      element: <AuthLayout csrfToken={process.env.REACT_APP_CSRF_TOKEN || ''} />,
      children: AUTH_ROUTES
    },

    // Main routes with MainLayout wrapper
    {
      path: '/',
      element: <MainLayoutWrapper />,
      children: MAIN_ROUTES
    },

    // 404 catch-all route
    {
      path: '*',
      element: lazy(() => import('../pages/errors/NotFound')),
      layoutType: 'main',
      requiresAuth: false,
      analyticsId: 'error_404',
      errorBoundary: true
    }
  ];

  return routes;
}

export default getRoutes();