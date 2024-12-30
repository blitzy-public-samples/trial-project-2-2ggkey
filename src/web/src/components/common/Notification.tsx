/**
 * @fileoverview Enhanced notification component with animations, accessibility, and rich content support
 * @version 1.0.0
 * @package @mui/material@5.14.0
 * @package @mui/icons-material@5.14.0
 */

import React, { useCallback, useEffect, useRef, memo } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { Paper, Typography, IconButton, Collapse, Fade } from '@mui/material';
import { Close, CheckCircle, Warning, Info, Error } from '@mui/icons-material';
import {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationContent
} from '../../types/notification.types';
import { useNotification } from '../../hooks/useNotification';

// ============================================================================
// Styled Components
// ============================================================================

const StyledPaper = styled(Paper)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(1.5),
  marginBottom: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  transition: 'all 0.3s ease',
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    boxShadow: theme.shadows[4],
    transform: 'translateY(-1px)',
  },
  '&[data-priority="HIGH"]': {
    borderLeft: `4px solid ${theme.palette.error.main}`,
  },
  '&[data-priority="MEDIUM"]': {
    borderLeft: `4px solid ${theme.palette.warning.main}`,
  },
  '&[data-priority="LOW"]': {
    borderLeft: `4px solid ${theme.palette.info.main}`,
  },
}));

const NotificationContent = styled('div')(({ theme }) => ({
  flex: 1,
  marginLeft: theme.spacing(1.5),
  marginRight: theme.spacing(1.5),
  minWidth: 0,
  wordBreak: 'break-word',
}));

const ActionContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
}));

// ============================================================================
// Types
// ============================================================================

interface NotificationProps {
  notification: Notification;
  onClose: (id: string) => void;
  autoHideDuration?: number;
  className?: string;
  enableAnimations?: boolean;
  groupSimilar?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Returns the appropriate icon based on notification type and priority
 */
const getNotificationIcon = (type: NotificationType, priority: NotificationPriority) => {
  const iconProps = {
    fontSize: 'small',
    'aria-hidden': true,
    sx: { marginRight: 1 }
  };

  switch (type) {
    case NotificationType.SUCCESS:
      return <CheckCircle color="success" {...iconProps} />;
    case NotificationType.WARNING:
      return <Warning color="warning" {...iconProps} />;
    case NotificationType.ERROR:
      return <Error color="error" {...iconProps} />;
    default:
      return <Info color="info" {...iconProps} />;
  }
};

/**
 * Manages notification animation configuration
 */
const getAnimationConfig = (priority: NotificationPriority) => {
  const baseDuration = 300;
  const durationMultiplier = priority === NotificationPriority.HIGH ? 1.5 : 1;

  return {
    enter: baseDuration * durationMultiplier,
    exit: baseDuration * durationMultiplier,
  };
};

// ============================================================================
// Component
// ============================================================================

export const Notification = memo<NotificationProps>(({
  notification,
  onClose,
  autoHideDuration = 5000,
  className,
  enableAnimations = true,
  groupSimilar = true,
}) => {
  const theme = useTheme();
  const { markAsRead } = useNotification();
  const autoHideTimeout = useRef<NodeJS.Timeout>();

  // Handle notification auto-hide
  useEffect(() => {
    if (autoHideDuration && !notification.isRead) {
      autoHideTimeout.current = setTimeout(() => {
        handleClose();
      }, autoHideDuration);
    }

    return () => {
      if (autoHideTimeout.current) {
        clearTimeout(autoHideTimeout.current);
      }
    };
  }, [notification.id, autoHideDuration]);

  // Handle notification close
  const handleClose = useCallback(() => {
    if (autoHideTimeout.current) {
      clearTimeout(autoHideTimeout.current);
    }
    markAsRead(notification.id);
    onClose(notification.id);
  }, [notification.id, onClose, markAsRead]);

  // Handle notification action click
  const handleActionClick = useCallback((actionUrl: string) => {
    if (actionUrl) {
      window.open(actionUrl, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const animationConfig = getAnimationConfig(notification.priority);

  return (
    <Fade
      in={true}
      timeout={enableAnimations ? animationConfig : 0}
      unmountOnExit
    >
      <Collapse in={true}>
        <StyledPaper
          className={className}
          data-priority={notification.priority}
          data-testid="notification"
          role="alert"
          aria-live={notification.priority === NotificationPriority.HIGH ? 'assertive' : 'polite'}
        >
          {getNotificationIcon(notification.type, notification.priority)}
          
          <NotificationContent>
            <Typography
              variant="subtitle1"
              component="h6"
              gutterBottom={!!notification.content.message}
            >
              {notification.content.title}
            </Typography>
            
            {notification.content.message && (
              <Typography variant="body2" color="textSecondary">
                {notification.content.message}
              </Typography>
            )}

            {notification.content.actionUrl && (
              <ActionContainer>
                <Typography
                  variant="button"
                  color="primary"
                  component="button"
                  onClick={() => handleActionClick(notification.content.actionUrl!)}
                  sx={{ cursor: 'pointer', border: 'none', background: 'none' }}
                >
                  {notification.content.actionType || 'View'}
                </Typography>
              </ActionContainer>
            )}
          </NotificationContent>

          <IconButton
            size="small"
            onClick={handleClose}
            aria-label="Close notification"
            edge="end"
          >
            <Close fontSize="small" />
          </IconButton>
        </StyledPaper>
      </Collapse>
    </Fade>
  );
});

Notification.displayName = 'Notification';

export default Notification;