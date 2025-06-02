import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import doseService from '../services/doseService';

const useDoseStore = create(
  persist(
    (set, get) => ({
      // State
      doses: [],
      todayDoses: [],
      streaks: {},
      rewards: [],
      loading: false,
      error: null,      // Actions
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),      // Fetch today's doses from API
      fetchTodaysDoses: async () => {
        set({ loading: true, error: null });
        try {
          const todayDoses = await doseService.getTodaysDoses();
          // Ensure todayDoses is always an array
          const dosesArray = Array.isArray(todayDoses) ? todayDoses : [];
          set({ todayDoses: dosesArray, loading: false });
          return dosesArray;
        } catch (error) {
          set({ 
            error: error.message || 'Failed to fetch today\'s doses', 
            loading: false,
            todayDoses: [] // Ensure it's an array even on error
          });
          throw error;
        }
      },

      // Fetch dose logs from API
      fetchDoses: async (params = {}) => {
        set({ loading: true, error: null });
        try {
          const dosesResponse = await doseService.getDoses(params);
          const doses = dosesResponse.doses || dosesResponse;
          set({ doses, loading: false });
          return doses;
        } catch (error) {
          set({ 
            error: error.message || 'Failed to fetch doses', 
            loading: false 
          });
          throw error;
        }
      },      // Log dose via API
      logDoseAPI: async (doseData) => {
        set({ loading: true, error: null });
        try {
          const newDose = await doseService.logDose(doseData);
          set((state) => ({
            doses: [newDose, ...state.doses],
            todayDoses: isToday(newDose.timestamp) 
              ? [newDose, ...state.todayDoses]
              : state.todayDoses,
            loading: false
          }));
          return newDose;
        } catch (error) {
          set({ 
            error: error.message || 'Failed to log dose', 
            loading: false 
          });
          throw error;
        }
      },      // Mark dose as skipped
      markDoseSkipped: async (regimenId, timestamp, reason = '') => {
        set({ loading: true, error: null });
        try {
          const newDose = await doseService.markDoseSkipped(regimenId, timestamp, reason);
          set((state) => ({
            doses: [newDose, ...state.doses],
            todayDoses: isToday(newDose.timestamp) 
              ? [newDose, ...state.todayDoses]
              : state.todayDoses,
            loading: false
          }));
          return newDose;
        } catch (error) {
          set({ 
            error: error.message || 'Failed to mark dose as skipped', 
            loading: false 
          });
          throw error;
        }
      },

      // Mark dose as taken
      markDoseTaken: async (regimenId, timestamp, notes = '') => {
        set({ loading: true, error: null });
        try {
          const newDose = await doseService.markDoseTaken(regimenId, timestamp, notes);
          set((state) => ({
            doses: [newDose, ...state.doses],
            todayDoses: isToday(newDose.timestamp) 
              ? [newDose, ...state.todayDoses]
              : state.todayDoses,
            loading: false
          }));
          return newDose;
        } catch (error) {
          set({ 
            error: error.message || 'Failed to mark dose as taken', 
            loading: false 
          });
          throw error;
        }
      },

      // Mark dose as missed
      markDoseMissed: async (regimenId, timestamp, reason = '') => {
        set({ loading: true, error: null });
        try {
          const newDose = await doseService.markDoseMissed(regimenId, timestamp, reason);
          set((state) => ({
            doses: [newDose, ...state.doses],
            todayDoses: isToday(newDose.timestamp) 
              ? [newDose, ...state.todayDoses]
              : state.todayDoses,
            loading: false
          }));
          return newDose;
        } catch (error) {
          set({ 
            error: error.message || 'Failed to mark dose as missed', 
            loading: false 
          });
          throw error;
        }
      },      // Set doses (with shallow comparison)
      setDoses: (doses) => set((state) => 
        state.doses !== doses ? { doses } : state
      ),

      // Set today's doses (with shallow comparison)
      setTodayDoses: (todayDoses) => set((state) => 
        state.todayDoses !== todayDoses ? { todayDoses } : state
      ),

      // Set streaks (with shallow comparison)
      setStreaks: (streaks) => set((state) => 
        state.streaks !== streaks ? { streaks } : state
      ),

      // Set rewards (with shallow comparison)
      setRewards: (rewards) => set((state) => 
        state.rewards !== rewards ? { rewards } : state
      ),

      // Add dose log
      addDose: (dose) => set((state) => ({
        doses: [dose, ...state.doses],
        todayDoses: isToday(dose.timestamp) 
          ? [dose, ...state.todayDoses]
          : state.todayDoses
      })),

      // Update dose
      updateDose: (doseId, updates) => set((state) => ({
        doses: state.doses.map(dose =>
          dose._id === doseId ? { ...dose, ...updates } : dose
        ),
        todayDoses: state.todayDoses.map(dose =>
          dose._id === doseId ? { ...dose, ...updates } : dose
        )
      })),

      // Delete dose
      deleteDose: (doseId) => set((state) => ({
        doses: state.doses.filter(dose => dose._id !== doseId),
        todayDoses: state.todayDoses.filter(dose => dose._id !== doseId)
      })),

      // Log a dose
      logDose: (regimenId, status = 'taken', notes = '', sideEffects = []) => {
        const newDose = {
          regimen: regimenId,
          timestamp: new Date(),
          status,
          notes,
          sideEffects,
          _id: Date.now().toString() // Temporary ID until saved to backend
        };
        
        set((state) => ({
          doses: [newDose, ...state.doses],
          todayDoses: [newDose, ...state.todayDoses]
        }));
        
        return newDose;
      },

      // Get doses by regimen
      getDosesByRegimen: (regimenId) => {
        const { doses } = get();
        return doses.filter(dose => dose.regimen === regimenId);
      },

      // Get doses by date range
      getDosesByDateRange: (startDate, endDate) => {
        const { doses } = get();
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return doses.filter(dose => {
          const doseDate = new Date(dose.timestamp);
          return doseDate >= start && doseDate <= end;
        });
      },

      // Get today's doses
      getTodayDoses: () => {
        return get().todayDoses;
      },

      // Get missed doses for today
      getTodayMissedDoses: () => {
        const { todayDoses } = get();
        return todayDoses.filter(dose => dose.status === 'missed');
      },

      // Get taken doses for today
      getTodayTakenDoses: () => {
        const { todayDoses } = get();
        return todayDoses.filter(dose => dose.status === 'taken');
      },

      // Calculate adherence rate
      calculateAdherenceRate: (regimenId, days = 7) => {
        const doses = get().getDosesByRegimen(regimenId);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const recentDoses = doses.filter(dose => 
          new Date(dose.timestamp) >= cutoffDate
        );
        
        if (recentDoses.length === 0) return 0;
        
        const takenDoses = recentDoses.filter(dose => dose.status === 'taken');
        return (takenDoses.length / recentDoses.length) * 100;
      },

      // Get current streak
      getCurrentStreak: (regimenId) => {
        const { streaks } = get();
        return streaks[regimenId] || 0;
      },

      // Update streak
      updateStreak: (regimenId, streak) => set((state) => ({
        streaks: {
          ...state.streaks,
          [regimenId]: streak
        }
      })),

      // Add reward
      addReward: (reward) => set((state) => ({
        rewards: [reward, ...state.rewards]
      })),

      // Get recent rewards
      getRecentRewards: (limit = 5) => {
        const { rewards } = get();
        return rewards.slice(0, limit);
      },

      // Get calendar heatmap data
      getCalendarHeatmapData: (year) => {
        const { doses } = get();
        const heatmapData = {};
        
        // Filter doses for the specified year
        const yearDoses = doses.filter(dose => {
          const doseYear = new Date(dose.timestamp).getFullYear();
          return doseYear === year;
        });
        
        // Group doses by date
        yearDoses.forEach(dose => {
          const dateKey = new Date(dose.timestamp).toISOString().split('T')[0];
          if (!heatmapData[dateKey]) {
            heatmapData[dateKey] = { taken: 0, missed: 0, total: 0 };
          }
          
          heatmapData[dateKey].total++;
          if (dose.status === 'taken') {
            heatmapData[dateKey].taken++;
          } else if (dose.status === 'missed') {
            heatmapData[dateKey].missed++;
          }
        });
        
        // Calculate adherence percentage for each date
        Object.keys(heatmapData).forEach(date => {
          const data = heatmapData[date];
          data.adherence = data.total > 0 ? (data.taken / data.total) * 100 : 0;
        });
        
        return heatmapData;
      },

      // Get weekly stats
      getWeeklyStats: (weeks = 4) => {
        const { doses } = get();
        const stats = [];
        const now = new Date();
        
        for (let i = 0; i < weeks; i++) {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          
          const weekDoses = doses.filter(dose => {
            const doseDate = new Date(dose.timestamp);
            return doseDate >= weekStart && doseDate <= weekEnd;
          });
          
          const taken = weekDoses.filter(dose => dose.status === 'taken').length;
          const total = weekDoses.length;
          const adherence = total > 0 ? (taken / total) * 100 : 0;
          
          stats.unshift({
            week: `Week ${weeks - i}`,
            weekStart: weekStart.toISOString().split('T')[0],
            weekEnd: weekEnd.toISOString().split('T')[0],
            taken,
            missed: total - taken,
            total,
            adherence
          });
        }
        
        return stats;
      },

      // Clear all doses
      clearDoses: () => set({
        doses: [],
        todayDoses: [],
        streaks: {},
        rewards: [],
        error: null
      })
    }),
    {
      name: 'dose-store',
      partialize: (state) => ({
        doses: state.doses,
        streaks: state.streaks,
        rewards: state.rewards
      })
    }
  )
);

// Helper function to check if a date is today
const isToday = (date) => {
  const today = new Date();
  const checkDate = new Date(date);
  return today.toDateString() === checkDate.toDateString();
};

// Stable selectors to prevent unnecessary re-renders
export const doseSelectors = {
  doses: (state) => state.doses,
  todayDoses: (state) => state.todayDoses,
  loading: (state) => state.loading,
  error: (state) => state.error,
  streaks: (state) => state.streaks,
  rewards: (state) => state.rewards,
  
  // Memoized selectors for computed values
  getTodayMissedDoses: (state) => state.todayDoses.filter(dose => dose.status === 'missed'),
  getTodayTakenDoses: (state) => state.todayDoses.filter(dose => dose.status === 'taken'),
  getRecentRewards: (limit = 5) => (state) => state.rewards.slice(0, limit),
};

export default useDoseStore;
