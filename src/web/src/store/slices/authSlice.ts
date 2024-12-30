/**
 * @fileoverview Redux Toolkit slice for authentication state management with enhanced security features
 * @version 1.0.0
 * @package @reduxjs/toolkit@1.9.7
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import authApi from '../../api/authApi';
import { 
  AuthState, 
  User, 
  LoginCredentials, 
  RegisterCredentials,
  AuthError,
  AuthErrorType,
  DEFAULT_SESSION_TIMEOUT
} from '../../types/auth.types';

// ============================================================================
// Initial State
// ============================================================================

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  mfaPending: false,
  sessionExpiry: null
};

// ============================================================================
// Async Thunks
// ============================================================================

/**
 * Login thunk with enhanced security and MFA support
 */
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      
      if (!response.success) {
        return rejectWithValue(response.error);
      }

      if (response.data.mfaRequired) {
        return { mfaRequired: true, email: credentials.email };
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        type: AuthErrorType.NETWORK_ERROR,
        message: error.message,
        timestamp: Date.now()
      });
    }
  }
);

/**
 * Register thunk with validation and security checks
 */
export const register = createAsyncThunk(
  'auth/register',
  async (credentials: RegisterCredentials, { rejectWithValue }) => {
    try {
      const response = await authApi.register(credentials);
      
      if (!response.success) {
        return rejectWithValue(response.error);
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        type: AuthErrorType.NETWORK_ERROR,
        message: error.message,
        timestamp: Date.now()
      });
    }
  }
);

/**
 * Logout thunk with secure session cleanup
 */
export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authApi.logout();
    } catch (error: any) {
      return rejectWithValue({
        type: AuthErrorType.NETWORK_ERROR,
        message: error.message,
        timestamp: Date.now()
      });
    }
  }
);

/**
 * Token refresh thunk for session management
 */
export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.refreshToken();
      
      if (!response.success) {
        return rejectWithValue(response.error);
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        type: AuthErrorType.TOKEN_EXPIRED,
        message: 'Session expired. Please login again.',
        timestamp: Date.now()
      });
    }
  }
);

/**
 * MFA setup thunk for enhanced security
 */
export const setupMfa = createAsyncThunk(
  'auth/setupMfa',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.setupMfa();
      
      if (!response.success) {
        return rejectWithValue(response.error);
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        type: AuthErrorType.MFA_INVALID,
        message: error.message,
        timestamp: Date.now()
      });
    }
  }
);

/**
 * MFA validation thunk
 */
export const validateMfa = createAsyncThunk(
  'auth/validateMfa',
  async (mfaToken: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      if (!state.auth.user?.id) {
        throw new Error('User ID not found');
      }

      const response = await authApi.validateMFA(mfaToken, state.auth.user.id);
      
      if (!response.success) {
        return rejectWithValue(response.error);
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        type: AuthErrorType.MFA_INVALID,
        message: error.message,
        timestamp: Date.now()
      });
    }
  }
);

// ============================================================================
// Slice Definition
// ============================================================================

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Reset authentication error state
     */
    clearError: (state) => {
      state.error = null;
    },

    /**
     * Update session expiry
     */
    updateSessionExpiry: (state, action: PayloadAction<number>) => {
      state.sessionExpiry = action.payload;
    },

    /**
     * Reset authentication state
     */
    resetAuth: (state) => {
      return { ...initialState };
    }
  },
  extraReducers: (builder) => {
    // Login reducers
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        if (action.payload.mfaRequired) {
          state.mfaPending = true;
        } else {
          state.user = action.payload.user;
          state.isAuthenticated = true;
          state.sessionExpiry = Date.now() + (DEFAULT_SESSION_TIMEOUT * 60 * 1000);
        }
        state.loading = false;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as AuthError;
      });

    // Register reducers
    builder
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.loading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as AuthError;
      });

    // Logout reducers
    builder
      .addCase(logout.fulfilled, (state) => {
        return { ...initialState };
      });

    // Token refresh reducers
    builder
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.sessionExpiry = Date.now() + (action.payload.expiresIn * 1000);
      })
      .addCase(refreshToken.rejected, (state) => {
        return { ...initialState };
      });

    // MFA reducers
    builder
      .addCase(validateMfa.fulfilled, (state, action) => {
        state.mfaPending = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(validateMfa.rejected, (state, action) => {
        state.error = action.payload as AuthError;
      });
  }
});

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select current authentication state
 */
export const selectAuth = (state: { auth: AuthState }) => state.auth;

/**
 * Select current user
 */
export const selectUser = (state: { auth: AuthState }) => state.auth.user;

/**
 * Select MFA status
 */
export const selectMfaStatus = (state: { auth: AuthState }) => ({
  mfaPending: state.auth.mfaPending,
  mfaEnabled: state.auth.user?.mfaEnabled || false
});

/**
 * Select session status
 */
export const selectSessionStatus = (state: { auth: AuthState }) => ({
  isAuthenticated: state.auth.isAuthenticated,
  sessionExpiry: state.auth.sessionExpiry
});

// Export actions and reducer
export const { clearError, updateSessionExpiry, resetAuth } = authSlice.actions;
export default authSlice.reducer;