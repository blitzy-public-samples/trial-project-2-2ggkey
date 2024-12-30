/**
 * @fileoverview A reusable, accessible tab component implementing Material Design principles
 * @version 1.0.0
 * @requires react ^18.2.0
 * @requires classnames ^2.3.2
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { Theme } from '../../types/common.types';

import styles from './Tabs.module.css';

// ============================================================================
// Interfaces
// ============================================================================

interface TabItem {
  /** Unique identifier for the tab */
  id: string;
  /** Display text for the tab */
  label: string;
  /** Content to be displayed when tab is active */
  content: React.ReactNode;
  /** Whether the tab is disabled */
  disabled?: boolean;
}

interface TabsProps {
  /** Array of tab items to display */
  tabs: TabItem[];
  /** ID of the currently active tab */
  activeTab?: string;
  /** Callback function when tab changes */
  onChange?: (tabId: string) => void;
  /** Visual style variant of tabs */
  variant?: 'default' | 'contained' | 'pills';
  /** Layout orientation of tabs */
  orientation?: 'horizontal' | 'vertical';
  /** Additional CSS class names */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const KEYBOARD_KEYS = {
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  HOME: 'Home',
  END: 'End',
} as const;

// ============================================================================
// Component
// ============================================================================

/**
 * Tabs component for organizing content into multiple panels
 * Implements WCAG 2.1 Level AA accessibility standards
 */
const Tabs = React.memo<TabsProps>(({
  tabs,
  activeTab: controlledActiveTab,
  onChange,
  variant = 'default',
  orientation = 'horizontal',
  className,
}) => {
  // ============================================================================
  // Refs & State
  // ============================================================================
  
  const tabListRef = useRef<HTMLDivElement>(null);
  const [activeTabId, setActiveTabId] = useState<string>(
    controlledActiveTab || (tabs[0]?.id ?? '')
  );
  const [focusedTabIndex, setFocusedTabIndex] = useState<number>(0);

  // ============================================================================
  // Handlers
  // ============================================================================

  /**
   * Handles tab selection
   */
  const handleTabClick = useCallback((tabId: string) => {
    if (controlledActiveTab === undefined) {
      setActiveTabId(tabId);
    }
    onChange?.(tabId);
  }, [controlledActiveTab, onChange]);

  /**
   * Handles keyboard navigation between tabs
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const isHorizontal = orientation === 'horizontal';
    const tabElements = Array.from(
      tabListRef.current?.querySelectorAll('[role="tab"]:not([disabled])') ?? []
    );
    const currentIndex = focusedTabIndex;
    let newIndex = currentIndex;

    switch (event.key) {
      case isHorizontal ? KEYBOARD_KEYS.LEFT : KEYBOARD_KEYS.UP:
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabElements.length - 1;
        break;
      case isHorizontal ? KEYBOARD_KEYS.RIGHT : KEYBOARD_KEYS.DOWN:
        newIndex = currentIndex < tabElements.length - 1 ? currentIndex + 1 : 0;
        break;
      case KEYBOARD_KEYS.HOME:
        newIndex = 0;
        break;
      case KEYBOARD_KEYS.END:
        newIndex = tabElements.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    setFocusedTabIndex(newIndex);
    (tabElements[newIndex] as HTMLElement)?.focus();
    handleTabClick(tabs[newIndex].id);
  }, [focusedTabIndex, handleTabClick, orientation, tabs]);

  // ============================================================================
  // Effects
  // ============================================================================

  useEffect(() => {
    if (controlledActiveTab) {
      setActiveTabId(controlledActiveTab);
    }
  }, [controlledActiveTab]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      className={classNames(
        styles.tabs,
        styles[`tabs--${variant}`],
        styles[`tabs--${orientation}`],
        className
      )}
      data-testid="tabs-component"
    >
      {/* Tab List */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-orientation={orientation}
        className={styles['tab-list']}
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTabId === tab.id}
            aria-controls={`panel-${tab.id}`}
            aria-disabled={tab.disabled}
            tabIndex={activeTabId === tab.id ? 0 : -1}
            className={classNames(
              styles.tab,
              {
                [styles['tab--active']]: activeTabId === tab.id,
                [styles['tab--disabled']]: tab.disabled,
              }
            )}
            onClick={() => !tab.disabled && handleTabClick(tab.id)}
            disabled={tab.disabled}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTabId !== tab.id}
          className={classNames(
            styles['tab-panel'],
            {
              [styles['tab-panel--active']]: activeTabId === tab.id,
            }
          )}
          tabIndex={0}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// Display Name & Export
// ============================================================================

Tabs.displayName = 'Tabs';

export default Tabs;