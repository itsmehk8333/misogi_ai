import { apiClient, handleApiResponse, handleApiError } from './api';

export const doseService = {
  // Get all dose logs
  getAllDoses: async (params = {}) => {
    try {
      const response = await apiClient.get('/doses', { params });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get dose log by ID
  getDoseById: async (id) => {
    try {
      const response = await apiClient.get(`/doses/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Log a dose
  logDose: async (doseData) => {
    try {
      const response = await apiClient.post('/doses/log', doseData);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update dose log
  updateDose: async (id, updates) => {
    try {
      const response = await apiClient.put(`/doses/${id}`, updates);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Delete dose log
  deleteDose: async (id) => {
    try {
      const response = await apiClient.delete(`/doses/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get doses by regimen
  getDosesByRegimen: async (regimenId, params = {}) => {
    try {
      const response = await apiClient.get(`/doses/regimen/${regimenId}`, { params });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get doses by date range
  getDosesByDateRange: async (startDate, endDate, params = {}) => {
    try {
      const response = await apiClient.get('/doses/date-range', {
        params: { startDate, endDate, ...params }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get today's doses
  getTodaysDoses: async () => {
    try {
      const response = await apiClient.get('/doses/today');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },  // Mark dose as taken
  markDoseTaken: async (regimenId, timestamp = new Date(), notes = '') => {
    try {
      console.log('markDoseTaken called with:', { regimenId, timestamp, notes });
      
      // Ensure timestamp is a proper ISO string
      const timestampISO = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
      
      const requestData = {
        regimen: regimenId,
        timestamp: timestampISO,
        notes
      };
      console.log('Sending request to /doses/mark-taken with data:', requestData);
      const response = await apiClient.post('/doses/mark-taken', requestData);
      console.log('Received response from /doses/mark-taken:', response);
      return handleApiResponse(response);
    } catch (error) {
      console.error('Error in markDoseTaken:', error);
      throw handleApiError(error);
    }
  },

  // Mark dose as missed
  markDoseMissed: async (regimenId, timestamp = new Date(), reason = '') => {
    try {
      console.log('markDoseMissed called with:', { regimenId, timestamp, reason });
      
      // Ensure timestamp is a proper ISO string
      const timestampISO = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
      
      const requestData = {
        regimen: regimenId,
        timestamp: timestampISO,
        reason
      };
      console.log('Sending request to /doses/mark-missed with data:', requestData);
      const response = await apiClient.post('/doses/mark-missed', requestData);
      console.log('Received response from /doses/mark-missed:', response);
      return handleApiResponse(response);
    } catch (error) {
      console.error('Error in markDoseMissed:', error);
      throw handleApiError(error);
    }
  },

  // Mark dose as skipped
  markDoseSkipped: async (regimenId, timestamp = new Date(), reason = '') => {
    try {
      console.log('markDoseSkipped called with:', { regimenId, timestamp, reason });
      
      // Ensure timestamp is a proper ISO string
      const timestampISO = timestamp instanceof Date ? timestamp.toISOString() : new Date(timestamp).toISOString();
      
      const requestData = {
        regimen: regimenId,
        timestamp: timestampISO,
        reason
      };
      console.log('Sending request to /doses/mark-skipped with data:', requestData);
      const response = await apiClient.post('/doses/mark-skipped', requestData);
      console.log('Received response from /doses/mark-skipped:', response);
      return handleApiResponse(response);
    } catch (error) {
      console.error('Error in markDoseSkipped:', error);
      throw handleApiError(error);
    }
  },

  // Log side effects
  logSideEffects: async (doseId, sideEffects) => {
    try {
      const response = await apiClient.patch(`/doses/${doseId}/side-effects`, {
        sideEffects
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get dose statistics
  getDoseStats: async (params = {}) => {
    try {
      const response = await apiClient.get('/doses/stats', { params });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get adherence statistics
  getAdherenceStats: async (period = 'week') => {
    try {
      const response = await apiClient.get('/doses/adherence', {
        params: { period }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get streak information
  getStreakInfo: async (regimenId = null) => {
    try {
      const params = regimenId ? { regimenId } : {};
      const response = await apiClient.get('/doses/streak', { params });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get missed doses
  getMissedDoses: async (days = 7) => {
    try {
      const response = await apiClient.get('/doses/missed', {
        params: { days }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Export dose logs
  exportDoses: async (format = 'pdf', params = {}) => {
    try {
      const response = await apiClient.get('/doses/export', {
        params: { format, ...params },
        responseType: format === 'json' ? 'json' : 'blob'
      });
      
      if (format === 'json') {
        return handleApiResponse(response);
      }
      
      // For PDF and CSV, create a download
      const blob = new Blob([response.data], { 
        type: format === 'pdf' ? 'application/pdf' : 'text/csv' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `dose_logs_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return { success: true };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get dose reminders
  getReminders: async () => {
    try {
      const response = await apiClient.get('/doses/reminders');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Snooze reminder
  snoozeReminder: async (reminderId, minutes = 15) => {
    try {
      const response = await apiClient.post(`/doses/reminders/${reminderId}/snooze`, {
        minutes
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Dismiss reminder
  dismissReminder: async (reminderId) => {
    try {
      const response = await apiClient.post(`/doses/reminders/${reminderId}/dismiss`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  }
};

export default doseService;
