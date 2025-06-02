import { create } from 'zustand';
import medicationService from '../services/medicationService';

// Stable selectors to prevent unnecessary re-renders
export const medicationSelectors = {
  medications: (state) => state.medications,
  categories: (state) => state.categories,
  selectedMedication: (state) => state.selectedMedication,
  isLoading: (state) => state.isLoading,
  error: (state) => state.error,
  pagination: (state) => state.pagination,
};

const useMedicationStore = create((set, get) => ({
  medications: [],
  categories: [],
  selectedMedication: null,
  isLoading: false,
  error: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNextPage: false,
    hasPrevPage: false  },

  // Actions
  fetchMedications: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await medicationService.getMedications(params);
      set({
        medications: response.medications,
        pagination: response.pagination,
        isLoading: false
      });
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Failed to fetch medications',
        isLoading: false
      });
    }
  },

  fetchCategories: async () => {
    try {
      const response = await medicationService.getCategories();
      set({ categories: response.categories });
    } catch (error) {
      set({ error: error.response?.data?.message || 'Failed to fetch categories' });
    }
  },

  fetchMedication: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await medicationService.getMedication(id);
      set({
        selectedMedication: response.medication,
        isLoading: false
      });
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Failed to fetch medication',
        isLoading: false
      });
    }
  },

  createMedication: async (medicationData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await medicationService.createMedication(medicationData);
      set(state => ({
        medications: [response.medication, ...state.medications],
        isLoading: false
      }));
      return response;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Failed to create medication',
        isLoading: false
      });
      throw error;
    }
  },

  updateMedication: async (id, medicationData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await medicationService.updateMedication(id, medicationData);
      set(state => ({
        medications: state.medications.map(med => 
          med._id === id ? response.medication : med
        ),
        selectedMedication: response.medication,
        isLoading: false
      }));
      return response;
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Failed to update medication',
        isLoading: false
      });
      throw error;
    }
  },

  deleteMedication: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await medicationService.deleteMedication(id);
      set(state => ({
        medications: state.medications.filter(med => med._id !== id),
        selectedMedication: state.selectedMedication?._id === id ? null : state.selectedMedication,
        isLoading: false
      }));
    } catch (error) {
      set({
        error: error.response?.data?.message || 'Failed to delete medication',
        isLoading: false
      });
      throw error;
    }
  },

  searchMedications: async (searchTerm) => {
    return get().fetchMedications({ search: searchTerm });
  },

  clearError: () => set({ error: null }),
  clearSelectedMedication: () => set({ selectedMedication: null })
}));

export default useMedicationStore;
