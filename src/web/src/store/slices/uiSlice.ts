import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../store'; // Type-only import for state typing

// Type definitions
type Breakpoint = 'mobile' | 'tablet' | 'desktop';
type Theme = 'light' | 'dark' | 'system';
type ModalData = Record<string, unknown> | null;

/**
 * Interface defining the shape of the UI slice state
 * Implements comprehensive UI state management with strict typing
 */
interface UIState {
  isSidebarOpen: boolean;
  activeModal: string | null;
  modalData: ModalData;
  loadingStates: Record<string, boolean>;
  errors: Record<string, string | null>;
  breakpoint: Breakpoint;
  theme: Theme;
  lastInteraction: number;
}

/**
 * Initial state with safe defaults and accessibility considerations
 */
const initialState: UIState = {
  isSidebarOpen: window.innerWidth >= 1024, // Default open on desktop
  activeModal: null,
  modalData: null,
  loadingStates: {},
  errors: {},
  breakpoint: 'desktop',
  theme: 'system',
  lastInteraction: Date.now(),
};

/**
 * UI slice implementation with Redux Toolkit
 * Manages global UI state with performance optimizations
 * @version Redux Toolkit ^1.9.0
 */
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    /**
     * Toggle sidebar visibility with accessibility updates
     */
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
      state.lastInteraction = Date.now();
    },

    /**
     * Set explicit sidebar state
     */
    setSidebarState: (state, action: PayloadAction<boolean>) => {
      state.isSidebarOpen = action.payload;
      state.lastInteraction = Date.now();
    },

    /**
     * Open modal with data and accessibility support
     */
    openModal: (
      state,
      action: PayloadAction<{ modalId: string; data?: Record<string, unknown> }>
    ) => {
      state.activeModal = action.payload.modalId;
      state.modalData = action.payload.data || null;
      state.lastInteraction = Date.now();
    },

    /**
     * Close active modal and clean up state
     */
    closeModal: (state) => {
      state.activeModal = null;
      state.modalData = null;
      state.lastInteraction = Date.now();
    },

    /**
     * Update loading state for specific component
     */
    setLoading: (
      state,
      action: PayloadAction<{ componentId: string; isLoading: boolean }>
    ) => {
      const { componentId, isLoading } = action.payload;
      state.loadingStates[componentId] = isLoading;
    },

    /**
     * Set error state for specific component
     */
    setError: (
      state,
      action: PayloadAction<{ componentId: string; error: string | null }>
    ) => {
      const { componentId, error } = action.payload;
      state.errors[componentId] = error;
    },

    /**
     * Update current breakpoint based on window size
     */
    setBreakpoint: (state, action: PayloadAction<Breakpoint>) => {
      state.breakpoint = action.payload;
    },

    /**
     * Update theme preference
     */
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
      state.lastInteraction = Date.now();
    },

    /**
     * Clear all error states
     */
    clearErrors: (state) => {
      state.errors = {};
    },

    /**
     * Reset loading states
     */
    resetLoadingStates: (state) => {
      state.loadingStates = {};
    },
  },
});

// Export actions
export const {
  toggleSidebar,
  setSidebarState,
  openModal,
  closeModal,
  setLoading,
  setError,
  setBreakpoint,
  setTheme,
  clearErrors,
  resetLoadingStates,
} = uiSlice.actions;

// Memoized selectors for efficient state access
export const selectSidebarState = (state: RootState) => state.ui.isSidebarOpen;
export const selectActiveModal = (state: RootState) => ({
  modalId: state.ui.activeModal,
  modalData: state.ui.modalData,
});
export const selectLoadingState = (componentId: string) => 
  (state: RootState) => state.ui.loadingStates[componentId] || false;
export const selectError = (componentId: string) => 
  (state: RootState) => state.ui.errors[componentId] || null;
export const selectBreakpoint = (state: RootState) => state.ui.breakpoint;
export const selectTheme = (state: RootState) => state.ui.theme;

// Export reducer as default
export default uiSlice.reducer;