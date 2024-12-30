/**
 * @fileoverview Comprehensive test suite for the Dashboard component
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react';

import Dashboard from '../../src/pages/dashboard/Dashboard';
import { useAuth } from '../../src/hooks/useAuth';
import { useWebSocket } from '../../src/hooks/useWebSocket';
import { configureStore } from '@reduxjs/toolkit';
import { UI_CONFIG } from '../../src/config/constants';

// Mock dependencies
vi.mock('../../src/hooks/useAuth');
vi.mock('../../src/hooks/useWebSocket');
vi.mock('../../src/components/dashboard/ActivityFeed', () => ({
  __esModule: true,
  default: () => <div data-testid="activity-feed">Activity Feed</div>
}));
vi.mock('../../src/components/dashboard/OverviewStats', () => ({
  __esModule: true,
  default: () => <div data-testid="overview-stats">Overview Stats</div>
}));
vi.mock('../../src/components/dashboard/ProjectProgress', () => ({
  __esModule: true,
  default: () => <div data-testid="project-progress">Project Progress</div>
}));
vi.mock('../../src/components/dashboard/TeamMembers', () => ({
  __esModule: true,
  default: () => <div data-testid="team-members">Team Members</div>
}));

// Test data
const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  roles: ['user'],
  preferences: {
    theme: 'light',
    notifications: true
  }
};

const mockWebSocketData = {
  isConnected: true,
  messageQueue: [
    {
      type: 'DASHBOARD_METRICS',
      payload: {
        taskCompletionRate: 75,
        activeProjects: 5,
        teamUtilization: 80,
        overdueTasks: 2
      }
    }
  ]
};

// Helper function to create a test store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: (state = { user: mockUser }) => state,
      dashboard: (state = initialState) => state
    }
  });
};

// Helper function to render component with all providers
const renderWithProviders = (
  ui: React.ReactElement,
  { 
    initialState = {},
    store = createTestStore(initialState),
    ...renderOptions
  } = {}
) => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  );
  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

describe('Dashboard Component Integration', () => {
  beforeAll(() => {
    // Setup global test environment
    vi.useFakeTimers();
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  });

  beforeEach(() => {
    // Setup mocks before each test
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    (useWebSocket as jest.Mock).mockReturnValue(mockWebSocketData);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering and Layout', () => {
    it('renders dashboard with all required components and proper layout', async () => {
      renderWithProviders(<Dashboard />);

      // Verify core components are present
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByTestId('overview-stats')).toBeInTheDocument();
      expect(screen.getByTestId('project-progress')).toBeInTheDocument();
      expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
      expect(screen.getByTestId('team-members')).toBeInTheDocument();

      // Verify welcome message
      expect(screen.getByText(/Welcome/i)).toBeInTheDocument();
      expect(screen.getByText(mockUser.name)).toBeInTheDocument();

      // Verify layout structure
      const mainContainer = screen.getByRole('main');
      expect(mainContainer).toHaveClass('dashboard-container');
      expect(window.getComputedStyle(mainContainer).display).toBe('grid');
    });

    it('applies responsive layout based on screen size', async () => {
      const { container } = renderWithProviders(<Dashboard />);

      // Test desktop layout
      window.innerWidth = UI_CONFIG.BREAKPOINTS.DESKTOP;
      fireEvent(window, new Event('resize'));
      await waitFor(() => {
        expect(container.firstChild).toHaveStyle({
          gridTemplateColumns: 'repeat(12, 1fr)'
        });
      });

      // Test mobile layout
      window.innerWidth = UI_CONFIG.BREAKPOINTS.MOBILE;
      fireEvent(window, new Event('resize'));
      await waitFor(() => {
        expect(container.firstChild).toHaveStyle({
          gridTemplateColumns: '1fr'
        });
      });
    });
  });

  describe('Real-time Updates', () => {
    it('handles WebSocket connection status correctly', async () => {
      renderWithProviders(<Dashboard />);
      
      // Verify connection indicator
      const connectionIndicator = screen.getByRole('img', { hidden: true });
      expect(connectionIndicator).toHaveAttribute('aria-hidden', 'true');
      
      // Test disconnection
      (useWebSocket as jest.Mock).mockReturnValue({ ...mockWebSocketData, isConnected: false });
      renderWithProviders(<Dashboard />);
      expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument();
    });

    it('updates metrics when receiving WebSocket messages', async () => {
      const { rerender } = renderWithProviders(<Dashboard />);

      // Simulate new metrics via WebSocket
      const newMetrics = {
        ...mockWebSocketData,
        messageQueue: [
          {
            type: 'DASHBOARD_METRICS',
            payload: {
              taskCompletionRate: 80,
              activeProjects: 6,
              teamUtilization: 85,
              overdueTasks: 1
            }
          }
        ]
      };

      (useWebSocket as jest.Mock).mockReturnValue(newMetrics);
      rerender(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('overview-stats')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when an error occurs', async () => {
      const errorMessage = 'Failed to load dashboard data';
      renderWithProviders(<Dashboard />);

      // Simulate error
      fireEvent.error(window, new ErrorEvent('error', { message: errorMessage }));

      expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);

      // Test error dismissal
      fireEvent.click(screen.getByRole('alert'));
      await waitFor(() => {
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('renders within performance budget', async () => {
      const startTime = performance.now();
      renderWithProviders(<Dashboard />);
      const endTime = performance.now();
      
      // Verify render time is under 200ms
      expect(endTime - startTime).toBeLessThan(200);
    });

    it('optimizes re-renders with React.memo', async () => {
      const renderCount = vi.fn();
      const TestWrapper = () => {
        renderCount();
        return <Dashboard />;
      };

      const { rerender } = renderWithProviders(<TestWrapper />);
      rerender(<TestWrapper />);
      
      expect(renderCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 Level AA requirements', async () => {
      const { container } = renderWithProviders(<Dashboard />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      renderWithProviders(<Dashboard />);
      const user = userEvent.setup();

      // Tab through interactive elements
      await user.tab();
      expect(document.activeElement).toHaveAttribute('role', 'button');

      // Verify focus indicators
      expect(document.activeElement).toHaveStyle({
        outline: expect.stringContaining('2px solid')
      });
    });
  });
});