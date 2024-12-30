import type { JestConfigWithTsJest } from 'ts-jest';

/**
 * Jest configuration for React frontend application
 * Version compatibility:
 * - jest: ^29.0.0
 * - ts-jest: ^29.0.0
 */
const jestConfig: JestConfigWithTsJest = {
  // Test environment configuration
  testEnvironment: 'jsdom', // Browser-like environment for React components
  verbose: true, // Detailed test output
  testTimeout: 10000, // 10 second timeout for tests

  // Test file discovery
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx)', // Test files in __tests__ directories
    '**/?(*.)+(spec|test).+(ts|tsx)' // Files ending with .spec.ts(x) or .test.ts(x)
  ],

  // TypeScript configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest' // Transform TypeScript files using ts-jest
  },

  // Module resolution and path mapping
  moduleNameMapper: {
    // Path aliases matching tsconfig.json
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@assets/(.*)$': '<rootDir>/src/assets/$1',
    '^@styles/(.*)$': '<rootDir>/src/styles/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',

    // Asset mocks
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 
      '<rootDir>/tests/__mocks__/fileMock.ts'
  },

  // Test setup and environment configuration
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts' // Global test setup file
  ],

  // Code coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}', // Include all TypeScript/TSX files
    '!src/**/*.d.ts', // Exclude declaration files
    '!src/**/index.{ts,tsx}', // Exclude index files
    '!src/vite-env.d.ts' // Exclude Vite environment declarations
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  coverageDirectory: 'coverage'
};

export default jestConfig;