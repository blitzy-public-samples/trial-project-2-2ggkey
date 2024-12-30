import { defineConfig } from 'vite'; // ^4.4.0
import react from '@vitejs/plugin-react'; // ^4.0.0
import path from 'path';

// Vite configuration for React frontend application
export default defineConfig({
  // React plugin configuration with optimized settings
  plugins: [
    react({
      // Enable fast refresh for development
      fastRefresh: true,
      // Babel configuration for optimal JSX transformation
      babel: {
        plugins: [
          ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]
        ]
      }
    })
  ],

  // Development server configuration
  server: {
    port: 3000,
    host: true,
    strictPort: true,
    hmr: {
      overlay: true
    },
    watch: {
      usePolling: true
    }
  },

  // Production build configuration
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true
      }
    },
    // Code splitting configuration for optimal loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunk
          vendor: ['react', 'react-dom', '@mui/material'],
          // State management chunk
          redux: ['@reduxjs/toolkit', 'react-redux'],
          // Utility libraries chunk
          utils: ['lodash', 'date-fns'],
          // Form handling chunk
          forms: ['react-hook-form', 'yup']
        }
      }
    }
  },

  // Path resolution and aliases
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
      '@store': path.resolve(__dirname, './src/store'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@api': path.resolve(__dirname, './src/api'),
      '@layouts': path.resolve(__dirname, './src/layouts'),
      '@constants': path.resolve(__dirname, './src/constants')
    }
  },

  // CSS processing configuration
  css: {
    modules: {
      localsConvention: 'camelCase',
      scopeBehaviour: 'local'
    },
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@styles/variables.scss";',
        sourceMap: true
      }
    },
    postcss: {
      plugins: ['autoprefixer']
    }
  },

  // Dependency optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@reduxjs/toolkit',
      'react-redux',
      'lodash',
      'date-fns'
    ],
    exclude: ['@testing-library/react']
  },

  // ESBuild configuration for browser compatibility
  esbuild: {
    jsxInject: "import React from 'react'",
    target: ['es2020', 'chrome90', 'firefox88', 'safari14']
  }
});