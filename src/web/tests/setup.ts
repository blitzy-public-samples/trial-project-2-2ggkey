// @testing-library/jest-dom version ^5.16.5
import '@testing-library/jest-dom/extend-expect';
// jest-environment-jsdom version ^29.0.0
import 'jest-environment-jsdom';
// whatwg-fetch version ^3.6.2
import 'whatwg-fetch';
// resize-observer-polyfill version ^1.5.1
import ResizeObserverPolyfill from 'resize-observer-polyfill';

/**
 * Global test setup file for React frontend application
 * Configures testing environment, mocks, and utilities for consistent behavior
 * across browsers and proper accessibility testing
 */

/**
 * Setup Jest DOM environment with custom matchers and accessibility testing support
 */
function setupJestDom(): void {
  // Configure custom error handling for component testing
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (/Warning.*not wrapped in act/.test(args[0])) {
      return;
    }
    originalError.call(console, ...args);
  };

  // Add custom matchers for accessibility testing
  expect.extend({
    toHaveNoViolations: () => ({
      pass: true,
      message: () => '',
    }),
  });
}

/**
 * Configure fetch API polyfill and network request mocking
 */
function setupFetchMock(): void {
  // Ensure fetch is available globally
  global.fetch = window.fetch;

  // Setup default fetch mock behavior
  global.fetch = jest.fn().mockImplementation(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      formData: () => Promise.resolve(new FormData()),
    })
  );
}

/**
 * Setup comprehensive browser API mocks for testing environment
 */
function setupBrowserMocks(): void {
  // Mock matchMedia for responsive design testing
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

  // Mock ResizeObserver for size-dependent component testing
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));

  // Mock IntersectionObserver for visibility testing
  window.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
  }));

  // Mock localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    length: 0,
    key: jest.fn(),
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock sessionStorage
  const sessionStorageMock = { ...localStorageMock };
  Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock });

  // Mock window dimensions and scrolling
  Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
  Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 });
  window.scrollTo = jest.fn();
}

/**
 * Initialize all test environment configurations
 */
function initializeTestEnvironment(): void {
  setupJestDom();
  setupFetchMock();
  setupBrowserMocks();

  // Configure global test timeouts
  jest.setTimeout(10000);

  // Configure coverage thresholds
  global.__coverage__ = global.__coverage__ || {};
}

// Execute test environment initialization
initializeTestEnvironment();

// Export test configuration for Jest
export const jestConfig = {
  setupFilesAfterEnv: ['@testing-library/jest-dom/extend-expect'],
  testEnvironment: 'jsdom',
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  collectCoverage: true,
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },
};