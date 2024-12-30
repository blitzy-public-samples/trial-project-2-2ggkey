// ESLint configuration for Task Management System web frontend
// Using TypeScript 5.0+, React 18.2+, and modern JavaScript features

// External package versions:
// @typescript-eslint/parser@^6.0.0
// @typescript-eslint/eslint-plugin@^6.0.0
// eslint-plugin-react@^7.33.0
// eslint-plugin-react-hooks@^4.6.0
// eslint-plugin-import@^2.27.0
// eslint-config-prettier@^8.8.0

const config = {
  // Prevent ESLint from looking for configs in parent folders
  root: true,

  // Environment configuration
  env: {
    browser: true,    // Enable browser globals
    es2022: true,     // Enable ES2022 globals and features
    node: true,       // Enable Node.js globals
    jest: true,       // Enable Jest testing globals
  },

  // Extended configurations
  extends: [
    'eslint:recommended',                       // ESLint recommended rules
    'plugin:@typescript-eslint/recommended',     // TypeScript recommended rules
    'plugin:react/recommended',                 // React recommended rules
    'plugin:react-hooks/recommended',           // React Hooks recommended rules
    'plugin:import/errors',                     // Import plugin error rules
    'plugin:import/warnings',                   // Import plugin warning rules
    'plugin:import/typescript',                 // Import plugin TypeScript support
    'prettier',                                 // Prettier compatibility
  ],

  // Parser configuration
  parser: '@typescript-eslint/parser',          // Use TypeScript parser
  parserOptions: {
    ecmaVersion: 'latest',                      // Use latest ECMAScript version
    sourceType: 'module',                       // Use ECMAScript modules
    ecmaFeatures: {
      jsx: true,                                // Enable JSX
    },
    project: './tsconfig.json',                 // TypeScript configuration file
  },

  // Plugin configurations
  plugins: [
    '@typescript-eslint',                       // TypeScript plugin
    'react',                                    // React plugin
    'react-hooks',                              // React Hooks plugin
    'import',                                   // Import plugin
  ],

  // Plugin settings
  settings: {
    react: {
      version: '18.2',                          // React version for plugin
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,                   // Always try to resolve types
        project: './tsconfig.json',             // TypeScript configuration
      },
    },
  },

  // Custom rule configurations
  rules: {
    // React specific rules
    'react/react-in-jsx-scope': 'off',          // Not needed in React 18+
    'react/prop-types': 'off',                  // Using TypeScript for prop validation
    
    // TypeScript specific rules
    '@typescript-eslint/explicit-module-boundary-types': 'off', // Allow implicit return types
    '@typescript-eslint/no-explicit-any': 'warn',              // Warn on 'any' usage
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',                  // Ignore unused args starting with _
      varsIgnorePattern: '^_',                  // Ignore unused vars starting with _
    }],

    // Import organization rules
    'import/order': ['error', {
      groups: [
        'builtin',                              // Node.js built-in modules
        'external',                             // NPM dependencies
        'internal',                             // Internal modules
        'parent',                               // Parent directory imports
        'sibling',                              // Same directory imports
        'index',                                // Index file imports
      ],
      'newlines-between': 'always',             // New line between import groups
      alphabetize: {
        order: 'asc',                           // Alphabetical ordering
        caseInsensitive: true,                  // Case-insensitive ordering
      },
    }],

    // React Hooks rules
    'react-hooks/rules-of-hooks': 'error',      // Enforce Hooks rules
    'react-hooks/exhaustive-deps': 'warn',      // Warn about missing dependencies

    // General rules
    'no-console': ['warn', {
      allow: ['warn', 'error'],                 // Allow console.warn and console.error
    }],
  },
};

export default config;