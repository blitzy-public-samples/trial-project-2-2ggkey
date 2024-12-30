import { useState, useEffect } from 'react'; // v18.2.0

/**
 * A custom hook that provides a debounced version of a value.
 * Useful for preventing excessive operations like API calls or expensive computations
 * when a value changes rapidly (e.g., search input, form auto-save).
 * 
 * @template T - The type of the value being debounced
 * @param {T} value - The value to debounce
 * @param {number} delay - The delay in milliseconds before updating the debounced value
 * @returns {T} The debounced value
 * 
 * @example
 * // Search input debouncing
 * const searchTerm = "example";
 * const debouncedSearch = useDebounce(searchTerm, 300);
 * 
 * @example
 * // Form auto-save
 * const formData = { name: "John", age: 30 };
 * const debouncedFormData = useDebounce(formData, 500);
 */
function useDebounce<T>(value: T, delay: number): T {
  // Initialize state with the initial value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Create a timeout to update the debounced value after the specified delay
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function to clear the timeout if value changes or component unmounts
    return () => {
      clearTimeout(timeoutId);
    };
    // Only re-run effect if value or delay changes
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;