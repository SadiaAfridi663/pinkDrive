import { createContext, useReducer, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import logger from '../utils/logger';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  token: null,
  loading: true,
  error: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, loading: true, error: null };
    case 'AUTH_SUCCESS':
      return { ...state, user: action.payload.user, token: action.payload.token, loading: false, error: null };
    case 'AUTH_FAILURE':
      return { ...state, user: null, token: null, loading: false, error: action.payload };
    case 'LOGOUT':
      return { ...state, user: null, token: null, loading: false, error: null };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const loadUser = useCallback(async () => {
    try {
      const res = await authAPI.getMe();
      dispatch({ type: 'AUTH_SUCCESS', payload: { user: res.data.data.user, token: res.data.data.token } });
      logger.info('User session loaded');
    } catch {
      dispatch({ type: 'AUTH_FAILURE', payload: null });
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const register = async (userData) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const res = await authAPI.register(userData);
      dispatch({ type: 'AUTH_FAILURE', payload: null });
      logger.info('Registration successful — check email for code');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      throw err;
    }
  };

  const login = async (email, password) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const res = await authAPI.login({ email, password });
      dispatch({ type: 'AUTH_SUCCESS', payload: { user: res.data.data.user, token: res.data.data.token } });
      logger.info('Login successful');
      return res.data;
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // proceed even if server logout fails
    }
    dispatch({ type: 'LOGOUT' });
    logger.info('User logged out');
  };

  const clearError = () => dispatch({ type: 'CLEAR_ERROR' });

  return (
    <AuthContext.Provider
      value={{
        ...state,
        register,
        login,
        logout,
        clearError,
        isAuthenticated: !!state.user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext, AuthProvider };
