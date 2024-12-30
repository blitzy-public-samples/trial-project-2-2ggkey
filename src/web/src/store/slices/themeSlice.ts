/**
 * @fileoverview Redux slice for managing application theme state
 * Implements theme preferences, system theme detection, and theme persistence
 * with WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // v1.9.0
import { lightTheme, darkTheme } from '../../config/theme';

// Constants for theme-related functionality
const THEME_STORAGE_KEY = 'task_manager_theme';
const THEME_CHANGE_ANNOUNCEMENT = 'Theme changed to';

/**
 * Interface defining the theme slice state structure
 */
interface ThemeState {
  currentTheme: 'light' | 'dark';
  systemPreference: 'light' | 'dark' | null;
}

/**
 * Helper function to announce theme changes for screen readers
 * @param theme The new theme being applied
 */
const announceThemeChange = (theme: 'light' | 'dark'): void => {
  const announcement = `${THEME_CHANGE_ANNOUNCEMENT} ${theme} mode`;
  const ariaLive = document.createElement('div');
  ariaLive.setAttribute('aria-live', 'polite');
  ariaLive.setAttribute('aria-atomic', 'true');
  ariaLive.classList.add('sr-only'); // Screen reader only
  ariaLive.textContent = announcement;
  document.body.appendChild(ariaLive);
  setTimeout(() => document.body.removeChild(ariaLive), 1000);
};

/**
 * Helper function to apply theme CSS custom properties
 * @param theme The theme configuration to apply
 */
const applyThemeProperties = (theme: 'light' | 'dark'): void => {
  const themeConfig = theme === 'light' ? lightTheme : darkTheme;
  const root = document.documentElement;

  // Apply color properties
  Object.entries(themeConfig.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });

  // Set theme attribute for CSS selectors
  root.setAttribute('data-theme', theme);
};

/**
 * Initial state with system preference detection
 */
const getInitialState = (): ThemeState => {
  // Check for stored theme preference
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as 'light' | 'dark' | null;
  
  // Check system color scheme preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  const systemPreference = prefersDark.matches ? 'dark' : 'light';

  return {
    currentTheme: storedTheme || systemPreference,
    systemPreference
  };
};

/**
 * Theme management slice with reducers for theme updates
 */
export const themeSlice = createSlice({
  name: 'theme',
  initialState: getInitialState(),
  reducers: {
    /**
     * Set theme with accessibility announcements and persistence
     */
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      const newTheme = action.payload;
      state.currentTheme = newTheme;
      
      // Persist theme preference
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      
      // Apply theme properties and announce change
      applyThemeProperties(newTheme);
      announceThemeChange(newTheme);
    },

    /**
     * Update system theme preference with fallback handling
     */
    setSystemPreference: (state, action: PayloadAction<'light' | 'dark' | null>) => {
      const newPreference = action.payload;
      state.systemPreference = newPreference;

      // If no manual theme is set, apply system preference
      if (!localStorage.getItem(THEME_STORAGE_KEY) && newPreference) {
        state.currentTheme = newPreference;
        applyThemeProperties(newPreference);
        announceThemeChange(newPreference);
      }
    }
  }
});

// Export actions and reducer
export const { setTheme, setSystemPreference } = themeSlice.actions;
export default themeSlice.reducer;

/**
 * Theme change media query listener setup
 * @returns Cleanup function for media query listener
 */
export const initializeThemeListener = (): () => void => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleThemeChange = (e: MediaQueryListEvent): void => {
    const newPreference = e.matches ? 'dark' : 'light';
    themeSlice.actions.setSystemPreference(newPreference);
  };

  mediaQuery.addEventListener('change', handleThemeChange);
  return () => mediaQuery.removeEventListener('change', handleThemeChange);
};