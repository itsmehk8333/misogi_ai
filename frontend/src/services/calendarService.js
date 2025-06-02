import { apiClient, handleApiResponse, handleApiError } from './api';

export const calendarService = {
  // Initialize Google Calendar integration
  initializeGoogleCalendar: async () => {
    try {
      const response = await apiClient.post('/calendar/google/init');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get Google Calendar auth URL
  getAuthUrl: async () => {
    try {
      const response = await apiClient.get('/calendar/google/auth-url');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Handle OAuth callback
  handleCallback: async (code) => {
    try {
      const response = await apiClient.post('/calendar/google/callback', { code });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Check calendar connection status
  getConnectionStatus: async () => {
    try {
      const response = await apiClient.get('/calendar/status');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Sync medication schedule to Google Calendar
  syncScheduleToCalendar: async (regimenId) => {
    try {
      const response = await apiClient.post(`/calendar/sync-regimen/${regimenId}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Sync all active regimens to calendar
  syncAllRegimens: async () => {
    try {
      // Use extended timeout for sync-all operations
      const response = await apiClient.post('/calendar/sync-all', {}, {
        timeout: 90000 // 90 seconds for bulk sync operations
      });
      return handleApiResponse(response);
    } catch (error) {
      const handledError = handleApiError(error);
      
      // Add specific handling for calendar sync errors
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        handledError.message = 'Calendar sync is taking longer than expected. This may happen with many medications. Try syncing individual medications from Settings.';
        handledError.suggestion = 'Go to Settings > Calendar Integration to sync medications individually';
      }
      
      if (error.response?.data?.reconnectRequired) {
        handledError.reconnectRequired = true;
        handledError.message = 'Your Google Calendar connection has expired. Please reconnect.';
      }
      
      throw handledError;
    }
  },

  // Remove regimen from calendar
  removeFromCalendar: async (regimenId) => {
    try {
      const response = await apiClient.delete(`/calendar/regimen/${regimenId}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update calendar event
  updateCalendarEvent: async (regimenId, updates) => {
    try {
      const response = await apiClient.patch(`/calendar/regimen/${regimenId}`, updates);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get calendar settings
  getCalendarSettings: async () => {
    try {
      const response = await apiClient.get('/calendar/settings');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update calendar settings
  updateCalendarSettings: async (settings) => {
    try {
      const response = await apiClient.put('/calendar/settings', settings);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Disconnect calendar
  disconnect: async () => {
    try {
      const response = await apiClient.delete('/calendar/disconnect');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  disconnectCalendar: async () => {
    try {
      const response = await apiClient.delete('/calendar/disconnect');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Sync all medications to calendar
  syncAllMedications: async () => {
    try {
      const response = await apiClient.post('/calendar/sync-all');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Create a one-time calendar event for missed dose makeup
  createMakeupEvent: async (doseData, newTime) => {
    try {
      const response = await apiClient.post('/calendar/makeup-event', {
        dose: doseData,
        scheduledTime: newTime
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Export medication schedule as iCal file
  exportAsIcal: async (regimenIds = []) => {
    try {
      const response = await apiClient.get('/calendar/export/ical', {
        params: { regimens: regimenIds.join(',') },
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/calendar' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'medication-schedule.ics';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'Calendar file downloaded successfully' };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get upcoming calendar events
  getUpcomingEvents: async (days = 7) => {
    try {
      const response = await apiClient.get('/calendar/upcoming', {
        params: { days }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  }
};

export default calendarService;
