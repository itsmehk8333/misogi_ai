import { apiClient, handleApiResponse, handleApiError } from './api';

export const medicationService = {
  // Get all medications
  getAllMedications: async (params = {}) => {
    try {
      const response = await apiClient.get('/medications', { params });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get medication by ID
  getMedicationById: async (id) => {
    try {
      const response = await apiClient.get(`/medications/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Create new medication
  createMedication: async (medicationData) => {
    try {
      const response = await apiClient.post('/medications', medicationData);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update medication
  updateMedication: async (id, updates) => {
    try {
      const response = await apiClient.put(`/medications/${id}`, updates);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Delete medication
  deleteMedication: async (id) => {
    try {
      const response = await apiClient.delete(`/medications/${id}`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Search medications
  searchMedications: async (query, params = {}) => {
    try {
      const response = await apiClient.get('/medications/search', {
        params: { q: query, ...params }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get medications by category
  getMedicationsByCategory: async (category, params = {}) => {
    try {
      const response = await apiClient.get(`/medications/category/${category}`, { params });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get medication categories
  getCategories: async () => {
    try {
      const response = await apiClient.get('/medications/categories');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get medication statistics
  getMedicationStats: async (id) => {
    try {
      const response = await apiClient.get(`/medications/${id}/stats`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Upload medication image
  uploadMedicationImage: async (id, imageFile) => {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await apiClient.post(`/medications/${id}/image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Delete medication image
  deleteMedicationImage: async (id) => {
    try {
      const response = await apiClient.delete(`/medications/${id}/image`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get medication interaction warnings
  checkInteractions: async (medicationIds) => {
    try {
      const response = await apiClient.post('/medications/check-interactions', {
        medications: medicationIds
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Add medication to favorites
  addToFavorites: async (id) => {
    try {
      const response = await apiClient.post(`/medications/${id}/favorite`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Remove medication from favorites
  removeFromFavorites: async (id) => {
    try {
      const response = await apiClient.delete(`/medications/${id}/favorite`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get favorite medications
  getFavorites: async () => {
    try {
      const response = await apiClient.get('/medications/favorites');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Bulk import medications
  bulkImport: async (medications) => {
    try {
      const response = await apiClient.post('/medications/bulk-import', {
        medications
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Export medications
  exportMedications: async (format = 'json', params = {}) => {
    try {
      const response = await apiClient.get('/medications/export', {
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

export default medicationService;
