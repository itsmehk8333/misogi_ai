import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import regimenService from '../services/regimenService';

const useRegimenStore = create(
  persist(
    (set, get) => ({
      // State
      regimens: [],
      currentRegimen: null,
      loading: false,
      error: null,      // Actions
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),      // Fetch regimens from API
      fetchRegimens: async () => {
        set({ loading: true, error: null });
        try {
          const regimens = await regimenService.getRegimens();
          // Ensure regimens is always an array
          const regimensArray = Array.isArray(regimens) ? regimens : [];
          set({ regimens: regimensArray, loading: false });
          return regimensArray;
        } catch (error) {
          set({ 
            error: error.message || 'Failed to fetch regimens', 
            loading: false 
          });
          throw error;
        }
      },

      // Create new regimen
      createRegimen: async (regimenData) => {
        set({ loading: true, error: null });
        try {
          const newRegimen = await regimenService.createRegimen(regimenData);
          set((state) => ({ 
            regimens: [...state.regimens, newRegimen],
            loading: false 
          }));
          return newRegimen;
        } catch (error) {
          set({ 
            error: error.message || 'Failed to create regimen', 
            loading: false 
          });
          throw error;
        }
      },

      // Update existing regimen
      updateRegimenAPI: async (regimenId, updates) => {
        set({ loading: true, error: null });
        try {
          const updatedRegimen = await regimenService.updateRegimen(regimenId, updates);
          set((state) => ({
            regimens: state.regimens.map(regimen =>
              regimen._id === regimenId ? updatedRegimen : regimen
            ),
            currentRegimen: state.currentRegimen?._id === regimenId
              ? updatedRegimen
              : state.currentRegimen,
            loading: false
          }));
          return updatedRegimen;
        } catch (error) {
          set({ 
            error: error.message || 'Failed to update regimen', 
            loading: false 
          });
          throw error;
        }
      },

      // Delete regimen via API
      deleteRegimenAPI: async (regimenId) => {
        set({ loading: true, error: null });
        try {
          await regimenService.deleteRegimen(regimenId);
          set((state) => ({
            regimens: state.regimens.filter(regimen => regimen._id !== regimenId),
            currentRegimen: state.currentRegimen?._id === regimenId ? null : state.currentRegimen,
            loading: false
          }));
        } catch (error) {
          set({ 
            error: error.message || 'Failed to delete regimen', 
            loading: false 
          });
          throw error;
        }
      },

      // Set regimens
      setRegimens: (regimens) => set({ regimens }),

      // Set current regimen
      setCurrentRegimen: (regimen) => set({ currentRegimen: regimen }),

      // Add regimen
      addRegimen: (regimen) => set((state) => ({
        regimens: [...state.regimens, regimen]
      })),

      // Update regimen
      updateRegimen: (regimenId, updates) => set((state) => ({
        regimens: state.regimens.map(regimen =>
          regimen._id === regimenId ? { ...regimen, ...updates } : regimen
        ),
        currentRegimen: state.currentRegimen?._id === regimenId
          ? { ...state.currentRegimen, ...updates }
          : state.currentRegimen
      })),

      // Delete regimen
      deleteRegimen: (regimenId) => set((state) => ({
        regimens: state.regimens.filter(regimen => regimen._id !== regimenId),
        currentRegimen: state.currentRegimen?._id === regimenId ? null : state.currentRegimen
      })),

      // Get regimen by ID
      getRegimenById: (regimenId) => {
        const { regimens } = get();
        return regimens.find(regimen => regimen._id === regimenId);
      },

      // Get active regimens
      getActiveRegimens: () => {
        const { regimens } = get();
        return regimens.filter(regimen => regimen.isActive);
      },

      // Get regimens by medication
      getRegimensByMedication: (medicationId) => {
        const { regimens } = get();
        return regimens.filter(regimen => regimen.medication === medicationId);
      },      // Get upcoming doses for today
      getUpcomingDoses: () => {
        const { regimens } = get();
        const today = new Date();
        
        const upcomingDoses = [];
        
        regimens.forEach(regimen => {
          if (!regimen.isActive) return;
          
          regimen.schedule.times.forEach(time => {
            const [hours, minutes] = time.split(':');
            const doseTime = new Date(today);
            doseTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            if (doseTime > new Date()) {
              upcomingDoses.push({
                regimen,
                time: doseTime,
                timeString: time
              });
            }
          });
        });
        
        return upcomingDoses.sort((a, b) => a.time - b.time);
      },

      // Get missed doses for today
      getMissedDoses: () => {
        const { regimens } = get();
        const today = new Date();
        
        const missedDoses = [];
        
        regimens.forEach(regimen => {
          if (!regimen.isActive) return;
          
          regimen.schedule.times.forEach(time => {
            const [hours, minutes] = time.split(':');
            const doseTime = new Date(today);
            doseTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            
            if (doseTime < new Date()) {
              // Check if this dose was logged
              // This would typically involve checking with the dose store
              missedDoses.push({
                regimen,
                time: doseTime,
                timeString: time
              });
            }
          });
        });
        
        return missedDoses;
      },

      // Calculate adherence rate
      calculateAdherenceRate: (regimenId, days = 7) => {
        const regimen = get().getRegimenById(regimenId);
        if (!regimen) return 0;
        
        // This would typically involve checking dose logs
        // For now, return a placeholder
        return 0;
      },

      // Clear all regimens
      clearRegimens: () => set({
        regimens: [],
        currentRegimen: null,
        error: null
      })
    }),
    {
      name: 'regimen-store',
      partialize: (state) => ({
        regimens: state.regimens,
        currentRegimen: state.currentRegimen
      })
    }
  )
);

export default useRegimenStore;
