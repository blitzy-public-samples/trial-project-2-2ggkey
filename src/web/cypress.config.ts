// Cypress v12.0.0+ configuration file for Task Management System
import { defineConfig } from 'cypress';

export default defineConfig({
  // Global configuration
  baseUrl: 'http://localhost:3000',
  watchForFileChanges: true,
  defaultCommandTimeout: 5000,
  experimentalMemoryManagement: true,
  numTestsKeptInMemory: 50,

  // End-to-end testing configuration
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    
    // Viewport configuration for desktop testing
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Video recording settings
    video: true,
    videoCompression: 32,
    screenshotOnRunFailure: true,
    
    // Timeout configurations for performance requirements
    defaultCommandTimeout: 5000, // 5 seconds for standard commands
    pageLoadTimeout: 30000,      // 30 seconds for page loads
    requestTimeout: 10000,       // 10 seconds for API requests
    responseTimeout: 30000,      // 30 seconds for API responses
    
    // File watching and security settings
    watchForFileChanges: true,
    chromeWebSecurity: false,
    modifyObstructiveCode: false,
    
    // Memory management for stable test execution
    experimentalMemoryManagement: true,
    numTestsKeptInMemory: 50,
    
    // Environment variables
    env: {
      apiUrl: 'http://localhost:8080/api/v1',
      coverage: false,
      codeCoverage: {
        url: '/api/__coverage__',
        exclude: ['cypress/**/*.*']
      },
      hideXhr: true,
      requestMode: 'cors'
    },
    
    // Retry configuration for stable test execution
    retries: {
      runMode: 2,      // Retry failed tests twice in CI
      openMode: 0      // No retries in interactive mode
    },
    
    // Browser configurations based on compatibility matrix
    browsers: [
      {
        name: 'chrome',
        family: 'chromium',
        channel: 'stable',
        displayName: 'Chrome',
        version: '90',
        path: '',
        minVersion: 90
      },
      {
        name: 'firefox',
        family: 'firefox',
        channel: 'stable',
        displayName: 'Firefox',
        version: '88',
        path: '',
        minVersion: 88
      },
      {
        name: 'edge',
        family: 'chromium',
        channel: 'stable',
        displayName: 'Edge',
        version: '90',
        path: '',
        minVersion: 90
      }
    ]
  },

  // Component testing configuration
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
      viteConfig: {
        optimizeDeps: {
          include: ['react', 'react-dom']
        }
      }
    },
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
    indexHtmlFile: 'cypress/support/component-index.html',
    viewportWidth: 1280,
    viewportHeight: 720
  }
});