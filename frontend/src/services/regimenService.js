import { apiClient, handleApiResponse, handleApiError } from './api';

export const regimenService = {
  // Get all regimens (alias for getAllRegimens)
  getRegimens: async (params = {}) => {
    try {
      const response = await apiClient.get('/regimens', { params });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get all regimens
  getAllRegimens: async (params = {}) => {
    try {
      const response = await apiClient.get('/regimens', { params });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get regimen by ID
  getRegimenById: async (id) => {
    try {
      const response = await apiClient.get(`/regimens/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Create new regimen
  createRegimen: async (regimenData) => {
    try {
      const response = await apiClient.post('/regimens', regimenData);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update regimen
  updateRegimen: async (id, updates) => {
    try {
      const response = await apiClient.put(`/regimens/${id}`, updates);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Delete regimen
  deleteRegimen: async (id) => {
    try {
      const response = await apiClient.delete(`/regimens/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get active regimens
  getActiveRegimens: async () => {
    try {
      const response = await apiClient.get('/regimens/active');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get regimens by medication
  getRegimensByMedication: async (medicationId) => {
    try {
      const response = await apiClient.get(`/regimens/medication/${medicationId}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Activate/deactivate regimen
  toggleRegimenStatus: async (id, isActive) => {
    try {
      const response = await apiClient.patch(`/regimens/${id}/status`, { isActive });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get today's doses for all regimens
  getTodaysDoses: async () => {
    try {
      const response = await apiClient.get('/regimens/today-doses');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get upcoming doses
  getUpcomingDoses: async (hours = 24) => {
    try {
      const response = await apiClient.get('/regimens/upcoming-doses', {
        params: { hours }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get missed doses
  getMissedDoses: async (days = 7) => {
    try {
      const response = await apiClient.get('/regimens/missed-doses', {
        params: { days }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update regimen schedule
  updateSchedule: async (id, schedule) => {
    try {
      const response = await apiClient.patch(`/regimens/${id}/schedule`, { schedule });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Add reminder to regimen
  addReminder: async (id, reminder) => {
    try {
      const response = await apiClient.post(`/regimens/${id}/reminders`, reminder);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update reminder
  updateReminder: async (id, reminderId, updates) => {
    try {
      const response = await apiClient.put(`/regimens/${id}/reminders/${reminderId}`, updates);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Delete reminder
  deleteReminder: async (id, reminderId) => {
    try {
      const response = await apiClient.delete(`/regimens/${id}/reminders/${reminderId}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get regimen statistics
  getRegimenStats: async (id, days = 30) => {
    try {
      const response = await apiClient.get(`/regimens/${id}/stats`, {
        params: { days }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get adherence rate for regimen
  getAdherenceRate: async (id, period = 'week') => {
    try {
      const response = await apiClient.get(`/regimens/${id}/adherence`, {
        params: { period }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Clone regimen
  cloneRegimen: async (id, modifications = {}) => {
    try {
      const response = await apiClient.post(`/regimens/${id}/clone`, modifications);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Pause regimen
  pauseRegimen: async (id, resumeDate = null) => {
    try {
      const response = await apiClient.patch(`/regimens/${id}/pause`, { resumeDate });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Resume regimen
  resumeRegimen: async (id) => {
    try {
      const response = await apiClient.patch(`/regimens/${id}/resume`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Archive regimen
  archiveRegimen: async (id) => {
    try {
      const response = await apiClient.patch(`/regimens/${id}/archive`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get archived regimens
  getArchivedRegimens: async () => {
    try {
      const response = await apiClient.get('/regimens/archived');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Restore archived regimen
  restoreRegimen: async (id) => {
    try {
      const response = await apiClient.patch(`/regimens/${id}/restore`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Bulk update regimens
  bulkUpdate: async (updates) => {
    try {
      const response = await apiClient.patch('/regimens/bulk-update', { updates });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Export regimens
  exportRegimens: async (format = 'json', params = {}) => {
    try {
      const response = await apiClient.get('/regimens/export', {
        params: { format, ...params },
        responseType: format === 'csv' ? 'blob' : 'json'
      });
      
      if (format === 'csv') {
        return response.data; // Return blob for CSV
      }
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  }
};

export default regimenService;
