import axios from 'axios';
import { sanitizeForJSON, validateJSON } from '../utils/jsonUtils';

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5001/api";

console.log('🌐 API Base URL:', API_BASE_URL);

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased timeout for remote server
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Explicitly set to false since we're using tokens
});

// Request interceptor to add auth token and validate data
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    console.log('🔌 API: Request to', config.url);
    console.log('🔌 API: Auth token present?', !!token);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔌 API: Authorization header added');
    } else {
      console.warn('🔌 API: No auth token available for request');
    }

    // Sanitize and validate JSON data before sending
    if (config.data && typeof config.data === 'object') {
      try {
        // Sanitize the data first
        config.data = sanitizeForJSON(config.data);
        
        // Validate that it can be serialized to JSON
        if (!validateJSON(config.data)) {
          throw new Error('Data validation failed');
        }
        
        // Log the data being sent for debugging
        console.log('🔌 API: Sending API request:', {
          url: config.url,
          method: config.method,
          data: config.data
        });
        
      } catch (error) {
        console.error('🔌 API: Invalid data being sent to API:', config.data);
        console.error('🔌 API: JSON processing error:', error);
        return Promise.reject(new Error('Invalid data format: ' + error.message));
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    console.log('🔌 API: Successful response from', response.config.url);
    console.log('🔌 API: Status code:', response.status);
    return response;
  },
  (error) => {
    console.error('🔌 API: Error response details:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });
    
    if (error.response?.status === 401) {
      console.warn('🔌 API: 401 Unauthorized - clearing auth data');
      // Token expired or invalid
      localStorage.removeItem('authToken');
      localStorage.removeItem('authUser');
      window.location.href = '/login';
    }
    
    // Handle network errors
    if (!error.response) {
      console.error('🔌 API: Network error - no response received');
      error.message = 'Network error. Please check your connection.';
    }
    
    return Promise.reject(error);
  }
);

// Generic API methods
export const apiClient = {
  get: (url, config = {}) => api.get(url, config),
  post: (url, data = {}, config = {}) => api.post(url, data, config),
  put: (url, data = {}, config = {}) => api.put(url, data, config),
  patch: (url, data = {}, config = {}) => api.patch(url, data, config),
  delete: (url, config = {}) => api.delete(url, config),
};

// Helper function to handle API responses
export const handleApiResponse = (response) => {
  // Handle different response formats
  if (response.data.success) {
    return response.data.data;
  }
  
  // Handle backend format with token, user, and message
  if (response.data.token && response.data.user) {
    return {
      token: response.data.token,
      user: response.data.user,
      message: response.data.message
    };
  }
    // Handle regimens endpoint specifically - extract regimens array
  if (response.data.regimens && Array.isArray(response.data.regimens)) {
    return response.data.regimens;
  }
  
  // Handle single regimen endpoint - extract regimen object
  if (response.data.regimen) {
    return response.data.regimen;
  }
  
  // Handle doses endpoint specifically - extract doses array
  if (response.data.doses && Array.isArray(response.data.doses)) {
    return response.data.doses;
  }
  
  // For other successful responses, return the data directly
  return response.data;
};

// Helper function to handle API errors
export const handleApiError = (error) => {
  const message = error.response?.data?.message || error.message || 'An error occurred';
  const status = error.response?.status;
  const details = error.response?.data?.details;
  
  return {
    message,
    status,
    details,
    isNetworkError: !error.response,
  };
};

export default api;
