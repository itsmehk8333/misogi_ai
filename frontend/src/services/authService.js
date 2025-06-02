import { apiClient, handleApiResponse, handleApiError } from './api';

export const authService = {
  // Register a new user
  register: async (userData) => {
    try {
      const response = await apiClient.post('/auth/register', userData);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Login user
  login: async (credentials) => {
    try {
      const response = await apiClient.post('/auth/login', credentials);
      const data = handleApiResponse(response);
      
      // Store token and user data
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('authUser', JSON.stringify(data.user));
      }
      
      return data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Logout user
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    } finally {
      // Always clear local storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
    }
  },
  // Get current user profile
  getCurrentUser: async () => {
    try {
      const response = await apiClient.get('/auth/me');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get user profile (alias for getCurrentUser)
  getProfile: async () => {
    try {
      const response = await apiClient.get('/auth/me');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },
  // Update user profile
  updateProfile: async (profileData) => {
    try {
      const response = await apiClient.put('/auth/me', profileData);
      const data = handleApiResponse(response);
      
      // Update stored user data
      localStorage.setItem('authUser', JSON.stringify(data.user || data));
      
      return data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Change password
  changePassword: async (passwordData) => {
    try {
      const response = await apiClient.put('/auth/change-password', passwordData);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Request password reset
  requestPasswordReset: async (email) => {
    try {
      const response = await apiClient.post('/auth/forgot-password', { email });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Reset password
  resetPassword: async (token, newPassword) => {
    try {
      const response = await apiClient.post('/auth/reset-password', {
        token,
        password: newPassword
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Verify email
  verifyEmail: async (token) => {
    try {
      const response = await apiClient.post('/auth/verify-email', { token });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Resend verification email
  resendVerification: async () => {
    try {
      const response = await apiClient.post('/auth/resend-verification');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },

  // Get stored user data
  getStoredUser: () => {
    const user = localStorage.getItem('authUser');
    return user ? JSON.parse(user) : null;
  },

  // Get stored token
  getStoredToken: () => {
    return localStorage.getItem('authToken');
  }
};

export default authService;
