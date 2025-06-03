import { apiClient, handleApiResponse, handleApiError } from './api';

// Calendar status cache for performance optimization
let calendarStatusCache = {
  data: null,
  timestamp: null,
  isValid: function() {
    if (!this.data || !this.timestamp) return false;
    const cacheAge = Date.now() - this.timestamp;
    const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes as recommended by backend
    return cacheAge < CACHE_DURATION;
  }
};

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
      // Clear cache after connection changes
      calendarStatusCache.data = null;
      calendarStatusCache.timestamp = null;
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Check calendar connection status (OPTIMIZED with caching)
  getConnectionStatus: async (forceRefresh = false) => {
    try {
      // Return cached data if valid and not forcing refresh
      if (!forceRefresh && calendarStatusCache.isValid()) {
        return calendarStatusCache.data;
      }

      const response = await apiClient.get('/calendar/status');
      const data = handleApiResponse(response);
      
      // Cache the response
      calendarStatusCache.data = data;
      calendarStatusCache.timestamp = Date.now();
      
      return data;
    } catch (error) {
      throw handleApiError(error);
    }
  },
  // Clear calendar status cache (useful after connection changes)
  clearStatusCache: () => {
    calendarStatusCache.data = null;
    calendarStatusCache.timestamp = null;
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
      const response = await apiClient.post('/calendar/sync-all');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
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
