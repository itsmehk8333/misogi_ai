import { apiClient, handleApiResponse, handleApiError } from './api';

export const reportService = {
  // Get all reports
  getAllReports: async (params = {}) => {
    try {
      const response = await apiClient.get('/reports', { params });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get report by ID
  getReportById: async (id) => {
    try {
      const response = await apiClient.get(`/reports/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Generate adherence report
  generateAdherenceReport: async (params = {}) => {
    try {
      const response = await apiClient.post('/reports/adherence', params);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Generate medication report
  generateMedicationReport: async (medicationId, params = {}) => {
    try {
      const response = await apiClient.post(`/reports/medication/${medicationId}`, params);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },
  // Generate side effects report
  generateSideEffectsReport: async (params = {}) => {
    try {
      const response = await apiClient.post('/reports/side-effects', params);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },
  
  // Get weekly trends data
  getWeeklyTrends: async () => {
    try {
      const response = await apiClient.get('/reports/weekly-trends');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },
  
  // Get adherence statistics
  getAdherenceStats: async (period = 'month') => {
    try {
      const params = { period };
      const response = await apiClient.get('/reports/adherence-stats', { params });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get calendar heatmap data
  getCalendarHeatmap: async (year = 2024) => {
    try {
      const response = await apiClient.get('/reports/calendar-heatmap', {
        params: { year }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get weekly adherence trends
  getWeeklyTrends: async (weeks = 12) => {
    try {
      const response = await apiClient.get('/reports/weekly-trends', {
        params: { weeks }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get monthly adherence trends
  getMonthlyTrends: async (months = 6) => {
    try {
      const response = await apiClient.get('/reports/monthly-trends', {
        params: { months }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get medication adherence comparison
  getMedicationComparison: async (medicationIds, period = 'month') => {
    try {
      const response = await apiClient.post('/reports/medication-comparison', {
        medications: medicationIds,
        period
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get adherence by time of day
  getAdherenceByTime: async (days = 30) => {
    try {
      const response = await apiClient.get('/reports/adherence-by-time', {
        params: { days }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get adherence by day of week
  getAdherenceByDayOfWeek: async (weeks = 12) => {
    try {
      const response = await apiClient.get('/reports/adherence-by-day', {
        params: { weeks }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get streak analysis
  getStreakAnalysis: async () => {
    try {
      const response = await apiClient.get('/reports/streak-analysis');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get improvement suggestions
  getImprovementSuggestions: async () => {
    try {
      const response = await apiClient.get('/reports/improvement-suggestions');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },
  // Export adherence report as PDF
  exportAdherenceToPDF: async (reportData, filename = 'adherence-report.pdf') => {
    try {
      const response = await apiClient.get('/reports/adherence', {
        params: {
          startDate: reportData.startDate,
          endDate: reportData.endDate,
          format: 'pdf'
        },
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'PDF downloaded successfully' };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Export dose logs as PDF
  exportDoseLogsToPDF: async (reportData, filename = 'dose-logs.pdf') => {
    try {
      const response = await apiClient.get('/reports/dose-logs/export', {
        params: {
          startDate: reportData.startDate,
          endDate: reportData.endDate,
          format: 'pdf'
        },
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'PDF downloaded successfully' };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Export medication list as PDF
  exportMedicationListToPDF: async (filename = 'medication-list.pdf') => {
    try {
      const response = await apiClient.get('/reports/medication-list/export', {
        params: {
          format: 'pdf'
        },
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'PDF downloaded successfully' };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Export missed doses as PDF
  exportMissedDosesToPDF: async (reportData, filename = 'missed-doses.pdf') => {
    try {
      const response = await apiClient.get('/reports/missed-doses/export', {
        params: {
          startDate: reportData.startDate,
          endDate: reportData.endDate,
          format: 'pdf'
        },
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'PDF downloaded successfully' };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Export calendar data as PDF
  exportCalendarDataToPDF: async (reportData, filename = 'calendar-data.pdf') => {
    try {
      const response = await apiClient.get('/reports/calendar-data/export', {
        params: {
          startDate: reportData.startDate,
          endDate: reportData.endDate,
          format: 'pdf'
        },
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'PDF downloaded successfully' };
    } catch (error) {
      throw handleApiError(error);
    }
  },
  // Generic export function that delegates to appropriate service
  exportToPDF: async (reportType, reportData, filename) => {
    console.log('exportToPDF called with reportType:', reportType);
    switch (reportType) {
      case 'adherence':
        return reportService.exportAdherenceToPDF(reportData, filename);
      case 'dose_logs':
        return reportService.exportDoseLogsToPDF(reportData, filename);
      case 'medication_list':
        return reportService.exportMedicationListToPDF(filename);
      case 'missed_doses':
        return reportService.exportMissedDosesToPDF(reportData, filename);
      case 'calendar_data':
        return reportService.exportCalendarDataToPDF(reportData, filename);
      default:
        console.log('Unsupported report type received:', reportType);
        throw new Error('Unsupported report type for PDF export');
    }
  },
  // Export adherence report as CSV
  exportAdherenceToCSV: async (reportData, filename = 'adherence-report.csv') => {
    try {
      const response = await apiClient.get('/reports/adherence', {
        params: {
          startDate: reportData.startDate,
          endDate: reportData.endDate,
          format: 'csv'
        },
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'CSV downloaded successfully' };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Export dose logs as CSV
  exportDoseLogsToCSV: async (reportData, filename = 'dose-logs.csv') => {
    try {
      const response = await apiClient.get('/reports/dose-logs/export', {
        params: {
          startDate: reportData.startDate,
          endDate: reportData.endDate,
          format: 'csv'
        },
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'CSV downloaded successfully' };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Export medication list as CSV
  exportMedicationListToCSV: async (filename = 'medication-list.csv') => {
    try {
      const response = await apiClient.get('/reports/medication-list/export', {
        params: {
          format: 'csv'
        },
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'CSV downloaded successfully' };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Export missed doses as CSV
  exportMissedDosesToCSV: async (reportData, filename = 'missed-doses.csv') => {
    try {
      const response = await apiClient.get('/reports/missed-doses/export', {
        params: {
          startDate: reportData.startDate,
          endDate: reportData.endDate,
          format: 'csv'
        },
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'CSV downloaded successfully' };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Export calendar data as CSV
  exportCalendarDataToCSV: async (reportData, filename = 'calendar-data.csv') => {
    try {
      const response = await apiClient.get('/reports/calendar-data/export', {
        params: {
          startDate: reportData.startDate,
          endDate: reportData.endDate,
          format: 'csv'
        },
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'CSV downloaded successfully' };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Generic CSV export function that delegates to appropriate service
  exportToCSV: async (reportType, reportData, filename) => {
    switch (reportType) {
      case 'adherence':
        return reportService.exportAdherenceToCSV(reportData, filename);
      case 'dose_logs':
        return reportService.exportDoseLogsToCSV(reportData, filename);
      case 'medication_list':
        return reportService.exportMedicationListToCSV(filename);
      case 'missed_doses':
        return reportService.exportMissedDosesToCSV(reportData, filename);
      case 'calendar_data':
        return reportService.exportCalendarDataToCSV(reportData, filename);
      default:
        throw new Error('Unsupported report type for CSV export');
    }
  },

  // Export report as Excel
  exportToExcel: async (reportData, filename = 'adherence-report.xlsx') => {
    try {
      const response = await apiClient.post('/reports/export/excel', reportData, {
        responseType: 'blob'
      });
      
      // Create download link
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return { success: true, message: 'Excel file downloaded successfully' };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Share report
  shareReport: async (reportId, shareData) => {
    try {
      const response = await apiClient.post(`/reports/${reportId}/share`, shareData);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get shared report
  getSharedReport: async (shareToken) => {
    try {
      const response = await apiClient.get(`/reports/shared/${shareToken}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Delete report
  deleteReport: async (id) => {
    try {
      const response = await apiClient.delete(`/reports/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Schedule report generation
  scheduleReport: async (reportConfig) => {
    try {
      const response = await apiClient.post('/reports/schedule', reportConfig);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get scheduled reports
  getScheduledReports: async () => {
    try {
      const response = await apiClient.get('/reports/scheduled');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update scheduled report
  updateScheduledReport: async (id, updates) => {
    try {
      const response = await apiClient.put(`/reports/scheduled/${id}`, updates);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Cancel scheduled report
  cancelScheduledReport: async (id) => {
    try {
      const response = await apiClient.delete(`/reports/scheduled/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get report templates
  getReportTemplates: async () => {
    try {
      const response = await apiClient.get('/reports/templates');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Create custom report template
  createReportTemplate: async (templateData) => {
    try {
      const response = await apiClient.post('/reports/templates', templateData);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update report template
  updateReportTemplate: async (id, updates) => {
    try {
      const response = await apiClient.put(`/reports/templates/${id}`, updates);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Delete report template
  deleteReportTemplate: async (id) => {
    try {
      const response = await apiClient.delete(`/reports/templates/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get most missed medications
  getMostMissedMedications: async () => {
    try {
      const response = await apiClient.get('/reports/most-missed-medications');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  }
};

export default reportService;
