import { create } from 'zustand';

const useReportStore = create((set, get) => ({
  // State
  reports: [],
  currentReport: null,
  adherenceStats: null,
  calendarData: {},
  weeklyStats: [],
  monthlyStats: [],
  trends: {},
  loading: false,
  error: null,

  // Actions
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  // Set reports
  setReports: (reports) => set({ reports }),

  // Set current report
  setCurrentReport: (report) => set({ currentReport: report }),

  // Set adherence statistics
  setAdherenceStats: (stats) => set({ adherenceStats: stats }),

  // Set calendar heatmap data
  setCalendarData: (data) => set({ calendarData: data }),

  // Set weekly statistics
  setWeeklyStats: (stats) => set({ weeklyStats: stats }),

  // Set monthly statistics
  setMonthlyStats: (stats) => set({ monthlyStats: stats }),

  // Set trends data
  setTrends: (trends) => set({ trends }),

  // Add report
  addReport: (report) => set((state) => ({
    reports: [report, ...state.reports]
  })),

  // Update report
  updateReport: (reportId, updates) => set((state) => ({
    reports: state.reports.map(report =>
      report._id === reportId ? { ...report, ...updates } : report
    ),
    currentReport: state.currentReport?._id === reportId
      ? { ...state.currentReport, ...updates }
      : state.currentReport
  })),

  // Delete report
  deleteReport: (reportId) => set((state) => ({
    reports: state.reports.filter(report => report._id !== reportId),
    currentReport: state.currentReport?._id === reportId ? null : state.currentReport
  })),

  // Get report by ID
  getReportById: (reportId) => {
    const { reports } = get();
    return reports.find(report => report._id === reportId);
  },

  // Get reports by type
  getReportsByType: (type) => {
    const { reports } = get();
    return reports.filter(report => report.type === type);
  },

  // Get recent reports
  getRecentReports: (limit = 10) => {
    const { reports } = get();
    return reports.slice(0, limit);
  },

  // Calculate overall adherence rate
  calculateOverallAdherence: () => {
    const { adherenceStats } = get();
    if (!adherenceStats) return 0;
    
    const { totalDoses, takenDoses } = adherenceStats;
    return totalDoses > 0 ? (takenDoses / totalDoses) * 100 : 0;
  },

  // Get adherence by medication
  getAdherenceByMedication: () => {
    const { adherenceStats } = get();
    return adherenceStats?.byMedication || [];
  },

  // Get adherence by regimen
  getAdherenceByRegimen: () => {
    const { adherenceStats } = get();
    return adherenceStats?.byRegimen || [];
  },

  // Get calendar data for specific year
  getCalendarDataForYear: (year) => {
    const { calendarData } = get();
    return calendarData[year] || {};
  },

  // Get weekly adherence trend
  getWeeklyTrend: () => {
    const { weeklyStats } = get();
    return weeklyStats.map(week => ({
      week: week.week,
      adherence: week.adherence || 0
    }));
  },

  // Get monthly adherence trend
  getMonthlyTrend: () => {
    const { monthlyStats } = get();
    return monthlyStats.map(month => ({
      month: month.month,
      adherence: month.adherence || 0
    }));
  },

  // Get side effects summary
  getSideEffectsSummary: () => {
    const { adherenceStats } = get();
    return adherenceStats?.sideEffects || [];
  },

  // Get streak information
  getStreakInfo: () => {
    const { adherenceStats } = get();
    return {
      currentStreak: adherenceStats?.currentStreak || 0,
      longestStreak: adherenceStats?.longestStreak || 0,
      totalStreaks: adherenceStats?.totalStreaks || 0
    };
  },

  // Get missed doses statistics
  getMissedDosesStats: () => {
    const { adherenceStats } = get();
    return {
      totalMissed: adherenceStats?.missedDoses || 0,
      missedToday: adherenceStats?.missedToday || 0,
      missedThisWeek: adherenceStats?.missedThisWeek || 0,
      missedThisMonth: adherenceStats?.missedThisMonth || 0
    };
  },

  // Get improvement suggestions
  getImprovementSuggestions: () => {
    const { trends } = get();
    const suggestions = [];
    
    // Analyze trends and provide suggestions
    if (trends.weeklyAdherence && trends.weeklyAdherence.length >= 2) {
      const recent = trends.weeklyAdherence.slice(-2);
      const [previous, current] = recent;
      
      if (current.adherence < previous.adherence) {
        suggestions.push({
          type: 'declining_adherence',
          message: 'Your adherence has decreased this week. Consider setting up more reminders.',
          priority: 'high'
        });
      }
    }
    
    if (trends.commonMissedTimes && trends.commonMissedTimes.length > 0) {
      suggestions.push({
        type: 'missed_times',
        message: `You often miss doses at ${trends.commonMissedTimes[0]}. Consider adjusting your schedule.`,
        priority: 'medium'
      });
    }
    
    if (trends.sideEffectsFrequency && trends.sideEffectsFrequency.length > 0) {
      suggestions.push({
        type: 'side_effects',
        message: 'Consider discussing frequent side effects with your healthcare provider.',
        priority: 'high'
      });
    }
    
    return suggestions;
  },

  // Export data for reports
  getExportData: (format = 'json', dateRange = null) => {
    const state = get();
    const { adherenceStats, weeklyStats, monthlyStats, calendarData } = state;
    
    let exportData = {
      adherenceStats,
      weeklyStats,
      monthlyStats,
      calendarData,
      exportDate: new Date().toISOString(),
      format
    };
    
    if (dateRange) {
      exportData.dateRange = dateRange;
      // Filter data based on date range if needed
    }
    
    return exportData;
  },

  // Generate report summary
  generateReportSummary: (period = 'week') => {
    const state = get();
    const { adherenceStats, weeklyStats, monthlyStats } = state;
    
    if (!adherenceStats) return null;
    
    const stats = period === 'week' ? weeklyStats : monthlyStats;
    const latest = stats[stats.length - 1];
    
    return {
      period,
      adherenceRate: latest?.adherence || 0,
      totalDoses: adherenceStats.totalDoses || 0,
      takenDoses: adherenceStats.takenDoses || 0,
      missedDoses: adherenceStats.missedDoses || 0,
      currentStreak: adherenceStats.currentStreak || 0,
      improvedFromLast: stats.length >= 2 ? 
        latest?.adherence > stats[stats.length - 2]?.adherence : false,
      topMedications: adherenceStats.byMedication?.slice(0, 3) || [],
      recentSideEffects: adherenceStats.sideEffects?.slice(0, 3) || []
    };
  },

  // Clear all report data
  clearReports: () => set({
    reports: [],
    currentReport: null,
    adherenceStats: null,
    calendarData: {},
    weeklyStats: [],
    monthlyStats: [],
    trends: {},
    error: null
  })
}));

export default useReportStore;
