/**
 * @fileoverview A reusable tooltip component with enhanced accessibility, positioning, and theme support
 * @version 1.0.0
 * 
 * Features:
 * - WCAG 2.1 Level AA compliance
 * - Dynamic positioning with viewport awareness
 * - Theme-aware styling
 * - Performance optimized with React.memo
 * - Keyboard navigation support
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'; // v18.2.0
import styled from '@emotion/styled'; // v11.11.0
import { Theme } from '../../types/common.types';
import { useTheme } from '../../hooks/useTheme';

// Constants
const TOOLTIP_OFFSET = 8;
const TOOLTIP_SHOW_DELAY = 200;
const TOOLTIP_HIDE_DELAY = 0;

// Types
interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;
  disabled?: boolean;
  id?: string;
}

interface Position {
  top: number;
  left: number;
}

// Styled Components
const TooltipContainer = styled.div<{ isVisible: boolean; theme: Theme }>`
  position: absolute;
  z-index: 1000;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  max-width: 200px;
  word-wrap: break-word;
  pointer-events: none;
  opacity: ${({ isVisible }) => (isVisible ? 1 : 0)};
  transition: opacity 0.2s, transform 0.2s;
  will-change: transform, opacity;

  ${({ theme }) =>
    theme === Theme.LIGHT
      ? `
    background: var(--theme-tooltip-background, #ffffff);
    color: var(--theme-tooltip-text, #333333);
    border: 1px solid var(--theme-tooltip-border, rgba(0, 0, 0, 0.1));
    box-shadow: 0 2px 4px var(--theme-tooltip-shadow, rgba(0, 0, 0, 0.1));
  `
      : `
    background: var(--theme-tooltip-background, #333333);
    color: var(--theme-tooltip-text, #ffffff);
    border: 1px solid var(--theme-tooltip-border, rgba(255, 255, 255, 0.1));
    box-shadow: 0 2px 4px var(--theme-tooltip-shadow, rgba(0, 0, 0, 0.2));
  `}
`;

const TooltipTrigger = styled.div`
  display: inline-block;
`;

/**
 * Calculates optimal tooltip position with viewport boundary awareness
 */
const getTooltipPosition = (
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  preferredPosition: TooltipProps['position']
): Position => {
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };

  let top = 0;
  let left = 0;

  switch (preferredPosition) {
    case 'top':
      top = triggerRect.top - tooltipRect.height - TOOLTIP_OFFSET;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      break;
    case 'bottom':
      top = triggerRect.bottom + TOOLTIP_OFFSET;
      left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
      break;
    case 'left':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.left - tooltipRect.width - TOOLTIP_OFFSET;
      break;
    case 'right':
      top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
      left = triggerRect.right + TOOLTIP_OFFSET;
      break;
  }

  // Viewport boundary checks
  if (left < TOOLTIP_OFFSET) {
    left = TOOLTIP_OFFSET;
  } else if (left + tooltipRect.width > viewport.width - TOOLTIP_OFFSET) {
    left = viewport.width - tooltipRect.width - TOOLTIP_OFFSET;
  }

  if (top < TOOLTIP_OFFSET) {
    top = TOOLTIP_OFFSET;
  } else if (top + tooltipRect.height > viewport.height - TOOLTIP_OFFSET) {
    top = viewport.height - tooltipRect.height - TOOLTIP_OFFSET;
  }

  return { top: top + viewport.scrollY, left: left + viewport.scrollX };
};

/**
 * Tooltip component with accessibility and positioning enhancements
 */
const Tooltip: React.FC<TooltipProps> = React.memo(({
  content,
  children,
  position = 'top',
  delay = TOOLTIP_SHOW_DELAY,
  disabled = false,
  id,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<Position>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout>();
  const { currentTheme } = useTheme();

  // Generate unique ID for ARIA attributes
  const tooltipId = id || `tooltip-${Math.random().toString(36).substr(2, 9)}`;

  const updatePosition = useCallback(() => {
    if (triggerRef.current && tooltipRef.current && isVisible) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const newPosition = getTooltipPosition(triggerRect, tooltipRect, position);
      setTooltipPosition(newPosition);
    }
  }, [isVisible, position]);

  // Handle show/hide with delay
  const showTooltip = useCallback(() => {
    if (disabled) return;
    showTimeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  }, [disabled, delay]);

  const hideTooltip = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  // Update position on scroll/resize
  useEffect(() => {
    const handleUpdate = () => {
      if (isVisible) {
        updatePosition();
      }
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isVisible, updatePosition]);

  // Update position when content changes
  useEffect(() => {
    updatePosition();
  }, [content, updatePosition]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }
    };
  }, []);

  return (
    <TooltipTrigger
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      aria-describedby={isVisible ? tooltipId : undefined}
    >
      {children}
      {isVisible && (
        <TooltipContainer
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          isVisible={isVisible}
          theme={currentTheme}
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
          }}
        >
          {content}
        </TooltipContainer>
      )}
    </TooltipTrigger>
  );
});

Tooltip.displayName = 'Tooltip';

export default Tooltip;