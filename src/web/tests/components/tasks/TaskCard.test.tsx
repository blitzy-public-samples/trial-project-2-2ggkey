/**
 * @fileoverview Comprehensive test suite for the TaskCard component verifying rendering,
 * interaction, accessibility, theme compatibility, and responsive behavior.
 * @version 1.0.0
 */

import React from 'react'; // ^18.2.0
import { render, screen, fireEvent, within } from '@testing-library/react'; // ^13.4.0
import userEvent from '@testing-library/user-event'; // ^14.4.3
import { axe, toHaveNoViolations } from 'jest-axe'; // ^4.7.3
import { ThemeProvider } from '@mui/material'; // ^5.0.0
import TaskCard from '../../../src/components/tasks/TaskCard';
import { Task, TaskStatus, TaskPriority } from '../../../src/types/task.types';
import { formatTaskStatus, formatTaskPriority, formatDate } from '../../../src/utils/format.utils';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// ============================================================================
// Test Data
// ============================================================================

const mockTask: Task = {
  id: 'test-task-123',
  title: 'Test Task',
  description: 'This is a test task description',
  projectId: 'project-123',
  creatorId: 'creator-123',
  assigneeId: 'assignee-123',
  status: TaskStatus.IN_PROGRESS,
  priority: TaskPriority.HIGH,
  dueDate: '2024-01-01T00:00:00Z',
  startDate: '2023-12-01T00:00:00Z',
  completionDate: null,
  estimatedHours: 8,
  actualHours: 4,
  attachmentUrls: ['test.pdf'],
  comments: [],
  tags: ['frontend', 'urgent'],
  completionPercentage: 75,
  dependencies: [],
  createdAt: '2023-11-01T00:00:00Z',
  updatedAt: '2023-11-01T00:00:00Z',
  lastModifiedBy: 'modifier-123',
  assignee: {
    id: 'assignee-123',
    name: 'John Doe',
    avatarUrl: 'https://example.com/avatar.jpg'
  }
};

const mockTheme = {
  palette: {
    mode: 'light',
    primary: {
      main: '#2196F3'
    },
    background: {
      paper: '#FFFFFF'
    }
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

const renderTaskCard = (
  task: Task = mockTask,
  onClick?: (taskId: string) => void,
  theme = mockTheme
) => {
  return render(
    <ThemeProvider theme={theme}>
      <TaskCard
        task={task}
        onClick={onClick}
        testId="task-card"
      />
    </ThemeProvider>
  );
};

// ============================================================================
// Test Suites
// ============================================================================

describe('TaskCard Component', () => {
  describe('Rendering', () => {
    it('renders all task information correctly', () => {
      renderTaskCard();

      // Verify title
      expect(screen.getByText(mockTask.title)).toBeInTheDocument();

      // Verify description
      expect(screen.getByText(mockTask.description!)).toBeInTheDocument();

      // Verify status badge
      const statusBadge = screen.getByText(formatTaskStatus(mockTask.status));
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass(`status-${mockTask.status.toLowerCase()}`);

      // Verify priority badge
      const priorityBadge = screen.getByText(formatTaskPriority(mockTask.priority));
      expect(priorityBadge).toBeInTheDocument();
      expect(priorityBadge).toHaveClass(`priority-${mockTask.priority.toLowerCase()}`);

      // Verify progress bar
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', mockTask.completionPercentage.toString());

      // Verify assignee
      const assignee = screen.getByAltText(`Assigned to ${mockTask.assignee?.name}`);
      expect(assignee).toBeInTheDocument();
      expect(assignee).toHaveAttribute('src', mockTask.assignee?.avatarUrl);

      // Verify due date
      const dueDate = screen.getByText(formatDate(mockTask.dueDate!));
      expect(dueDate).toBeInTheDocument();
    });

    it('handles missing optional data gracefully', () => {
      const minimalTask: Task = {
        ...mockTask,
        description: null,
        assigneeId: null,
        assignee: null,
        dueDate: null,
        tags: []
      };

      renderTaskCard(minimalTask);

      // Description should not be rendered
      expect(screen.queryByTestId('task-description')).not.toBeInTheDocument();

      // Assignee should show default avatar with initials
      expect(screen.queryByAltText(/Assigned to/)).not.toBeInTheDocument();

      // Due date should show placeholder
      expect(screen.getByText('No due date')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('handles click events correctly', async () => {
      const handleClick = jest.fn();
      renderTaskCard(mockTask, handleClick);

      const card = screen.getByTestId('task-card');
      await userEvent.click(card);

      expect(handleClick).toHaveBeenCalledWith(mockTask.id);
    });

    it('supports keyboard navigation', async () => {
      const handleClick = jest.fn();
      renderTaskCard(mockTask, handleClick);

      const card = screen.getByTestId('task-card');
      card.focus();

      // Test Enter key
      await userEvent.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledWith(mockTask.id);

      // Test Space key
      await userEvent.keyboard(' ');
      expect(handleClick).toHaveBeenCalledWith(mockTask.id);
    });

    it('shows hover state styles', async () => {
      const { container } = renderTaskCard(mockTask, jest.fn());
      const card = container.firstChild as HTMLElement;

      // Hover state
      await userEvent.hover(card);
      expect(card).toHaveStyle('transform: translateY(-2px)');

      // Un-hover state
      await userEvent.unhover(card);
      expect(card).toHaveStyle('transform: none');
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG accessibility guidelines', async () => {
      const { container } = renderTaskCard();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides appropriate ARIA attributes', () => {
      renderTaskCard();

      // Progress bar
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');

      // Status and priority badges
      const badges = screen.getAllByRole('status');
      expect(badges).toHaveLength(2);

      // Interactive elements
      const card = screen.getByTestId('task-card');
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('maintains focus visibility', async () => {
      renderTaskCard();
      const card = screen.getByTestId('task-card');

      // Tab to focus the card
      await userEvent.tab();
      expect(card).toHaveFocus();
      expect(card).toHaveStyle('outline: 2px solid var(--theme-primary)');
    });
  });

  describe('Theme Support', () => {
    it('renders correctly in light theme', () => {
      const { container } = renderTaskCard(mockTask, undefined, {
        ...mockTheme,
        palette: { ...mockTheme.palette, mode: 'light' }
      });

      expect(container.firstChild).toHaveStyle({
        backgroundColor: 'var(--theme-background)',
        color: 'var(--theme-text)'
      });
    });

    it('renders correctly in dark theme', () => {
      const { container } = renderTaskCard(mockTask, undefined, {
        ...mockTheme,
        palette: { ...mockTheme.palette, mode: 'dark' }
      });

      expect(container.firstChild).toHaveStyle({
        backgroundColor: 'var(--theme-background)',
        color: 'var(--theme-text)'
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('adjusts layout for mobile viewport', () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      const { container } = renderTaskCard();
      expect(container.firstChild).toHaveClass('mobile-view');
    });

    it('handles content overflow appropriately', () => {
      const longTitleTask = {
        ...mockTask,
        title: 'A'.repeat(100),
        description: 'B'.repeat(200)
      };

      renderTaskCard(longTitleTask);

      const title = screen.getByText('A'.repeat(100));
      const description = screen.getByText('B'.repeat(200));

      expect(title).toHaveStyle({ overflow: 'hidden', textOverflow: 'ellipsis' });
      expect(description).toHaveStyle({ overflow: 'hidden', textOverflow: 'ellipsis' });
    });
  });
});