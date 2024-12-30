import React, { useMemo } from 'react';
import { useDebounce } from 'use-debounce';
import { Card } from '../common/Card';
import { Task, TaskStatus, TaskPriority } from '../../types/task.types';
import { Project, ProjectStatus } from '../../types/project.types';

// Interfaces for component props and state
interface OverviewStatsProps {
  tasks: Task[];
  projects: Project[];
  refreshInterval?: number;
  className?: string;
}

interface StatCardProps {
  title: string;
  value: number | string;
  trend?: number[];
  icon?: React.ReactNode;
  ariaLabel: string;
  className?: string;
}

interface TaskStats {
  totalTasks: number;
  completedTasks: number;
  taskCompletionRate: number;
  taskCompletionTrend: number[];
  priorityDistribution: Record<TaskPriority, number>;
  averageCompletionTime: number;
  overdueTasks: number;
}

interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  projectHealthDistribution: Record<ProjectStatus, number>;
  averageProjectProgress: number;
  teamUtilization: number;
}

// Utility function to calculate task completion trend
const calculateTaskCompletionTrend = (tasks: Task[], days: number = 7): number[] => {
  const now = new Date();
  const trend: number[] = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStart = new Date(date.setHours(0, 0, 0, 0));
    const dayEnd = new Date(date.setHours(23, 59, 59, 999));
    
    const completedTasks = tasks.filter(task => {
      const completionDate = task.completionDate ? new Date(task.completionDate) : null;
      return completionDate && completionDate >= dayStart && completionDate <= dayEnd;
    }).length;
    
    trend.push(completedTasks);
  }
  
  return trend;
};

// StatCard component for displaying individual statistics
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  trend,
  icon,
  ariaLabel,
  className = ''
}) => (
  <Card
    className={`stat-card ${className}`}
    elevation={2}
    testId={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
  >
    <div className="stat-card-content" aria-label={ariaLabel}>
      <div className="stat-card-header">
        {icon && <span className="stat-card-icon">{icon}</span>}
        <h3 className="stat-card-title">{title}</h3>
      </div>
      <div className="stat-card-value">{value}</div>
      {trend && (
        <div className="stat-card-trend" aria-label="7-day trend">
          {trend.map((value, index) => (
            <div
              key={index}
              className="trend-bar"
              style={{ height: `${(value / Math.max(...trend)) * 100}%` }}
            />
          ))}
        </div>
      )}
    </div>
  </Card>
);

// Main OverviewStats component
export const OverviewStats: React.FC<OverviewStatsProps> = ({
  tasks,
  projects,
  refreshInterval = 30000,
  className = ''
}) => {
  // Debounce tasks and projects updates to prevent excessive recalculations
  const [debouncedTasks] = useDebounce(tasks, refreshInterval);
  const [debouncedProjects] = useDebounce(projects, refreshInterval);

  // Calculate task statistics with memoization
  const taskStats = useMemo((): TaskStats => {
    const completedTasks = debouncedTasks.filter(
      task => task.status === TaskStatus.COMPLETED
    ).length;

    const priorityDistribution = debouncedTasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<TaskPriority, number>);

    const completionTimes = debouncedTasks
      .filter(task => task.completionDate && task.startDate)
      .map(task => {
        const start = new Date(task.startDate!);
        const end = new Date(task.completionDate!);
        return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24); // days
      });

    const averageCompletionTime = completionTimes.length
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

    const overdueTasks = debouncedTasks.filter(task => {
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      return dueDate && dueDate < new Date() && task.status !== TaskStatus.COMPLETED;
    }).length;

    return {
      totalTasks: debouncedTasks.length,
      completedTasks,
      taskCompletionRate: (completedTasks / debouncedTasks.length) * 100,
      taskCompletionTrend: calculateTaskCompletionTrend(debouncedTasks),
      priorityDistribution,
      averageCompletionTime,
      overdueTasks
    };
  }, [debouncedTasks]);

  // Calculate project statistics with memoization
  const projectStats = useMemo((): ProjectStats => {
    const activeProjects = debouncedProjects.filter(
      project => project.status === ProjectStatus.IN_PROGRESS
    ).length;

    const healthDistribution = debouncedProjects.reduce((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {} as Record<ProjectStatus, number>);

    const averageProgress = debouncedProjects.reduce(
      (acc, project) => acc + project.progress,
      0
    ) / debouncedProjects.length;

    // Calculate team utilization based on assigned tasks
    const totalTeamMembers = new Set(
      debouncedProjects.flatMap(project => project.teamMemberIds)
    ).size;
    const assignedTasks = debouncedTasks.filter(task => task.assigneeId).length;
    const teamUtilization = (assignedTasks / (totalTeamMembers * 3)) * 100; // Assuming 3 tasks per person is optimal

    return {
      totalProjects: debouncedProjects.length,
      activeProjects,
      projectHealthDistribution: healthDistribution,
      averageProjectProgress: averageProgress,
      teamUtilization: Math.min(teamUtilization, 100) // Cap at 100%
    };
  }, [debouncedProjects, debouncedTasks]);

  return (
    <div className={`overview-stats ${className}`} data-testid="overview-stats">
      <div className="stats-grid">
        {/* Task Statistics */}
        <StatCard
          title="Task Completion Rate"
          value={`${taskStats.taskCompletionRate.toFixed(1)}%`}
          trend={taskStats.taskCompletionTrend}
          ariaLabel="Task completion rate statistics"
        />
        <StatCard
          title="Active Tasks"
          value={taskStats.totalTasks - taskStats.completedTasks}
          ariaLabel="Number of active tasks"
        />
        <StatCard
          title="Overdue Tasks"
          value={taskStats.overdueTasks}
          ariaLabel="Number of overdue tasks"
          className={taskStats.overdueTasks > 0 ? 'warning' : ''}
        />
        <StatCard
          title="Avg. Completion Time"
          value={`${taskStats.averageCompletionTime.toFixed(1)} days`}
          ariaLabel="Average task completion time"
        />

        {/* Project Statistics */}
        <StatCard
          title="Project Progress"
          value={`${projectStats.averageProjectProgress.toFixed(1)}%`}
          ariaLabel="Average project progress"
        />
        <StatCard
          title="Active Projects"
          value={projectStats.activeProjects}
          ariaLabel="Number of active projects"
        />
        <StatCard
          title="Team Utilization"
          value={`${projectStats.teamUtilization.toFixed(1)}%`}
          ariaLabel="Team utilization rate"
        />
      </div>
    </div>
  );
};

// Performance optimization
export default React.memo(OverviewStats);