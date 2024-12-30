/**
 * @fileoverview Custom React hook for type-safe localStorage management with cross-tab sync
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react'; // v18.2.0
import { getLocalStorageItem, setLocalStorageItem } from '../utils/storage.utils';

/**
 * Debounce timeout in milliseconds
 */
const DEBOUNCE_DELAY = 300;

/**
 * Hook state interface including loading and error states
 */
interface LocalStorageState<T> {
  value: T;
  error: Error | null;
  isLoading: boolean;
}

/**
 * Custom hook for managing state that syncs with localStorage
 * @template T - Type of the stored value
 * @param {string} key - Storage key
 * @param {T} initialValue - Initial value if none exists in storage
 * @returns {[T, (value: T | ((val: T) => T)) => void, { error: Error | null, isLoading: boolean }]}
 */
function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, { error: Error | null; isLoading: boolean }] {
  // Validate key
  if (!key || typeof key !== 'string') {
    throw new Error('Storage key must be a non-empty string');
  }

  // Reference to track component mount status
  const isMounted = useRef(true);
  
  // Debounce timer reference
  const debounceTimer = useRef<NodeJS.Timeout>();

  // State for value, loading, and error status
  const [state, setState] = useState<LocalStorageState<T>>({
    value: initialValue,
    error: null,
    isLoading: true
  });

  /**
   * Initialize state from localStorage
   */
  useEffect(() => {
    let mounted = true;

    const initializeState = async () => {
      try {
        const storedValue = await getLocalStorageItem<T>(key);
        
        if (mounted) {
          setState(prev => ({
            value: storedValue !== null ? storedValue : initialValue,
            error: null,
            isLoading: false
          }));
        }
      } catch (error) {
        if (mounted) {
          console.error(`Error initializing localStorage for key "${key}":`, error);
          setState(prev => ({
            ...prev,
            error: error instanceof Error ? error : new Error('Failed to initialize storage'),
            isLoading: false
          }));
        }
      }
    };

    initializeState();

    return () => {
      mounted = false;
    };
  }, [key, initialValue]);

  /**
   * Handle storage events for cross-tab synchronization
   */
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          const newValue = JSON.parse(event.newValue) as T;
          setState(prev => ({
            value: newValue,
            error: null,
            isLoading: false
          }));
        } catch (error) {
          console.error(`Error parsing storage event value for key "${key}":`, error);
        }
      }
    };

    // Listen for storage events from other tabs
    window.addEventListener('storage', handleStorageChange);

    // Custom storage event for same-tab updates
    window.addEventListener('tms-storage-change', ((event: CustomEvent) => {
      if (event.detail.key === key) {
        setState(prev => ({
          value: event.detail.newValue,
          error: null,
          isLoading: false
        }));
      }
    }) as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tms-storage-change', handleStorageChange as EventListener);
    };
  }, [key]);

  /**
   * Memoized setter function for updating state and localStorage
   */
  const setValue = useCallback(
    (valueOrFn: T | ((val: T) => T)) => {
      // Clear any existing debounce timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      try {
        const newValue = valueOrFn instanceof Function ? valueOrFn(state.value) : valueOrFn;

        // Update local state immediately
        setState(prev => ({
          value: newValue,
          error: null,
          isLoading: false
        }));

        // Debounce localStorage updates to prevent quota issues
        debounceTimer.current = setTimeout(async () => {
          try {
            await setLocalStorageItem(key, newValue);
          } catch (error) {
            if (isMounted.current) {
              console.error(`Error updating localStorage for key "${key}":`, error);
              setState(prev => ({
                ...prev,
                error: error instanceof Error ? error : new Error('Failed to update storage')
              }));
            }
          }
        }, DEBOUNCE_DELAY);
      } catch (error) {
        console.error(`Error setting value for key "${key}":`, error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error : new Error('Failed to set value')
        }));
      }
    },
    [key, state.value]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return [
    state.value,
    setValue,
    { error: state.error, isLoading: state.isLoading }
  ];
}

export default useLocalStorage;