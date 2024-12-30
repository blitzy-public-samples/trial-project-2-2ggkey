/**
 * @fileoverview Enhanced React hook for managing application theme with security, performance, and accessibility features
 * @version 1.0.0
 * 
 * Features:
 * - System theme detection and synchronization
 * - Secure theme persistence with encryption
 * - Performance-optimized theme application
 * - WCAG 2.1 Level AA compliance
 * - Proper cleanup and error handling
 */

import { useEffect, useCallback, useState } from 'react'; // v18.2.0
import { useDispatch, useSelector } from 'react-redux'; // v8.0.0
import debounce from 'lodash/debounce'; // v4.17.21

import { lightTheme, darkTheme } from '../config/theme';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/storage.utils';
import { Theme } from '../types/common.types';

// Constants
const THEME_STORAGE_KEY = 'theme';
const THEME_TRANSITION_DURATION = 200;
const SYSTEM_DARK_THEME_QUERY = '(prefers-color-scheme: dark)';

// Types
type ThemeType = Extract<Theme, Theme.LIGHT | Theme.DARK>;

interface ThemeHookResult {
  currentTheme: ThemeType;
  isDarkMode: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeType) => void;
  isSystemTheme: boolean;
  themeTransitioning: boolean;
}

/**
 * Enhanced hook for managing application theme with performance optimization,
 * security features, and accessibility support
 * @returns {ThemeHookResult} Theme control functions and state
 */
export function useTheme(): ThemeHookResult {
  const dispatch = useDispatch();
  const currentTheme = useSelector((state: any) => state.theme.current) as ThemeType;
  
  const [isSystemTheme, setIsSystemTheme] = useState<boolean>(true);
  const [themeTransitioning, setThemeTransitioning] = useState<boolean>(false);

  /**
   * Applies theme colors to document root with performance optimization
   * @param theme Theme to apply
   */
  const applyTheme = useCallback((theme: ThemeType) => {
    setThemeTransitioning(true);

    // Use requestAnimationFrame for optimal performance
    requestAnimationFrame(() => {
      const themeConfig = theme === Theme.DARK ? darkTheme : lightTheme;
      const root = document.documentElement;

      // Batch CSS variable updates
      Object.entries(themeConfig.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });

      // Announce theme change for screen readers
      const message = `Theme changed to ${theme} mode`;
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = message;
      document.body.appendChild(announcement);

      // Clean up announcement after reading
      setTimeout(() => {
        document.body.removeChild(announcement);
        setThemeTransitioning(false);
      }, THEME_TRANSITION_DURATION);
    });
  }, []);

  /**
   * Securely persists theme preference with encryption
   * @param theme Theme to persist
   */
  const persistTheme = useCallback(async (theme: ThemeType) => {
    try {
      await setLocalStorageItem(THEME_STORAGE_KEY, theme, true);
      setIsSystemTheme(false);
    } catch (error) {
      console.error('Failed to persist theme preference:', error);
      // Fallback to system theme on storage error
      setIsSystemTheme(true);
    }
  }, []);

  /**
   * Loads persisted theme preference with fallback to system theme
   */
  const loadPersistedTheme = useCallback(async () => {
    try {
      const storedTheme = await getLocalStorageItem<ThemeType>(THEME_STORAGE_KEY, true);
      
      if (storedTheme && Object.values(Theme).includes(storedTheme)) {
        dispatch({ type: 'SET_THEME', payload: storedTheme });
        setIsSystemTheme(false);
        applyTheme(storedTheme);
      } else {
        setIsSystemTheme(true);
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
      setIsSystemTheme(true);
    }
  }, [dispatch, applyTheme]);

  /**
   * Handles system theme changes with debouncing
   */
  const handleSystemThemeChange = useCallback(
    debounce((e: MediaQueryListEvent) => {
      if (isSystemTheme) {
        const systemTheme = e.matches ? Theme.DARK : Theme.LIGHT;
        dispatch({ type: 'SET_THEME', payload: systemTheme });
        applyTheme(systemTheme);
      }
    }, 100),
    [isSystemTheme, dispatch, applyTheme]
  );

  // Initialize theme and system theme detection
  useEffect(() => {
    loadPersistedTheme();

    const mediaQuery = window.matchMedia(SYSTEM_DARK_THEME_QUERY);
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    // Apply initial system theme if no preference is stored
    if (isSystemTheme) {
      const systemTheme = mediaQuery.matches ? Theme.DARK : Theme.LIGHT;
      dispatch({ type: 'SET_THEME', payload: systemTheme });
      applyTheme(systemTheme);
    }

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
      handleSystemThemeChange.cancel();
    };
  }, [dispatch, applyTheme, handleSystemThemeChange, loadPersistedTheme, isSystemTheme]);

  // Theme control functions
  const setTheme = useCallback((theme: ThemeType) => {
    dispatch({ type: 'SET_THEME', payload: theme });
    applyTheme(theme);
    persistTheme(theme);
  }, [dispatch, applyTheme, persistTheme]);

  const toggleTheme = useCallback(() => {
    const newTheme = currentTheme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT;
    setTheme(newTheme);
  }, [currentTheme, setTheme]);

  return {
    currentTheme,
    isDarkMode: currentTheme === Theme.DARK,
    toggleTheme,
    setTheme,
    isSystemTheme,
    themeTransitioning
  };
}