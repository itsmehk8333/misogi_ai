import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import RewardService from '../services/rewardService';

const useRewardsStore = create(
  persist(
    (set, get) => ({
      // State
      userRewards: {
        totalPoints: 0,
        currentLevel: 1,
        pointsToNextLevel: 100,
        currentStreak: 0,
        recentRewards: [],
        achievements: [],
        dailyProgress: { total: 0, completed: 0, percentage: 0 },
        weeklyProgress: { total: 0, completed: 0, percentage: 0 }
      },
      achievements: [],
      dailyRewardClaimed: false,
      lastDailyRewardDate: null,
      loading: false,
      error: null,

      // Actions
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // Fetch user rewards from API with caching
      fetchUserRewards: async (userId, forceRefresh = false) => {
        const state = get();
        
        // Skip if already loading or data exists and not forcing refresh
        if (state.loading || (!forceRefresh && state.userRewards?.totalPoints !== undefined && state.userRewards.generatedAt)) {
          const cacheAge = Date.now() - new Date(state.userRewards.generatedAt).getTime();
          const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
          
          if (cacheAge < CACHE_DURATION) {
            return state.userRewards;
          }
        }
        
        set({ loading: true, error: null });
        try {
          const rewardsData = await RewardService.getUserRewards(userId);
          set({ 
            userRewards: rewardsData,
            loading: false 
          });
          return rewardsData;
        } catch (error) {
          console.error('🎯 fetchUserRewards error:', error);
          set({ 
            error: error.message || 'Failed to fetch rewards data', 
            loading: false 
          });
          throw error;
        }
      },

      // Fetch achievements with caching
      fetchUserAchievements: async (userId, forceRefresh = false) => {
        const state = get();
        
        // Skip if already loading or data exists and not forcing refresh
        if (state.loading || (!forceRefresh && state.achievements?.length > 0)) {
          return state.achievements;
        }
        
        set({ loading: true, error: null });
        try {
          const achievementsData = await RewardService.getUserAchievements(userId);
          set({ 
            achievements: achievementsData,
            loading: false 
          });
          return achievementsData;
        } catch (error) {
          console.error('🏆 fetchUserAchievements error:', error);
          set({ 
            error: error.message || 'Failed to fetch achievements', 
            loading: false 
          });
          throw error;
        }
      },

      // OPTIMIZED: Fetch all rewards data in one consolidated API call
      fetchAllUserRewardsConsolidated: async (userId, forceRefresh = false) => {
        const state = get();
        
        // Check cache validity
        if (!forceRefresh && state.userRewards?.generatedAt) {
          const cacheAge = Date.now() - new Date(state.userRewards.generatedAt).getTime();
          const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
          
          if (cacheAge < CACHE_DURATION) {
            return { 
              rewards: state.userRewards, 
              achievements: state.achievements || state.userRewards.achievements 
            };
          }
        }
        
        set({ loading: true, error: null });
        
        try {
          // Single API call to get everything
          const consolidatedData = await RewardService.getAllUserRewardsConsolidated(userId);
          
          set({ 
            userRewards: {
              totalPoints: consolidatedData.totalPoints,
              currentLevel: consolidatedData.currentLevel,
              pointsToNextLevel: consolidatedData.pointsToNextLevel,
              currentStreak: consolidatedData.currentStreak,
              recentRewards: consolidatedData.recentRewards,
              dailyProgress: consolidatedData.dailyProgress,
              weeklyProgress: consolidatedData.weeklyProgress,
              canClaimDailyReward: consolidatedData.canClaimDailyReward,
              generatedAt: consolidatedData.generatedAt
            },
            achievements: consolidatedData.achievements,
            loading: false 
          });
          
          return { 
            rewards: {
              totalPoints: consolidatedData.totalPoints,
              currentLevel: consolidatedData.currentLevel,
              pointsToNextLevel: consolidatedData.pointsToNextLevel,
              currentStreak: consolidatedData.currentStreak,
              recentRewards: consolidatedData.recentRewards,
              dailyProgress: consolidatedData.dailyProgress,
              weeklyProgress: consolidatedData.weeklyProgress,
              canClaimDailyReward: consolidatedData.canClaimDailyReward,
              generatedAt: consolidatedData.generatedAt
            }, 
            achievements: consolidatedData.achievements 
          };
        } catch (error) {
          console.error('🚀 fetchAllUserRewardsConsolidated error:', error);
          set({ 
            error: error.message || 'Failed to fetch consolidated rewards data', 
            loading: false 
          });
          throw error;
        }
      },

      // LEGACY: Fetch both rewards and achievements efficiently in parallel (fallback)
      fetchAllUserRewards: async (userId, forceRefresh = false) => {
        const state = get();
        const hasRewards = state.userRewards?.totalPoints !== undefined && state.userRewards.generatedAt;
        const hasAchievements = state.achievements?.length > 0;
        
        // Skip if data exists and not forcing refresh
        if (!forceRefresh && hasRewards && hasAchievements) {
          const cacheAge = Date.now() - new Date(state.userRewards.generatedAt).getTime();
          const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
          
          if (cacheAge < CACHE_DURATION) {
            return { 
              rewards: state.userRewards, 
              achievements: state.achievements 
            };
          }
        }
        
        set({ loading: true, error: null });
        
        try {
          // Fetch both in parallel to reduce total API calls
          const [rewardsData, achievementsData] = await Promise.all([
            state.userRewards?.totalPoints === undefined || forceRefresh ? 
              RewardService.getUserRewards(userId) : Promise.resolve(state.userRewards),
            state.achievements?.length === 0 || forceRefresh ? 
              RewardService.getUserAchievements(userId) : Promise.resolve(state.achievements)
          ]);
          
          set({ 
            userRewards: rewardsData,
            achievements: achievementsData,
            loading: false 
          });
          
          return { rewards: rewardsData, achievements: achievementsData };
        } catch (error) {
          console.error('🎯🏆 fetchAllUserRewards error:', error);
          set({ 
            error: error.message || 'Failed to fetch rewards data', 
            loading: false 
          });
          throw error;
        }
      },

      // Claim daily reward
      claimDailyReward: async () => {
        set({ loading: true, error: null });
        try {
          const result = await RewardService.claimReward('daily_check_in');
          
          // Update local state
          set((state) => ({
            userRewards: {
              ...state.userRewards,
              totalPoints: state.userRewards.totalPoints + result.points,
              currentLevel: Math.floor((state.userRewards.totalPoints + result.points) / 100) + 1,
              pointsToNextLevel: (Math.floor((state.userRewards.totalPoints + result.points) / 100) + 1) * 100 - (state.userRewards.totalPoints + result.points),
              recentRewards: [
                {
                  title: 'Daily Check-in',
                  description: 'Daily login bonus',
                  points: result.points,
                  timestamp: new Date(),
                  type: 'daily'
                },
                ...state.userRewards.recentRewards.slice(0, 9)
              ]
            },
            dailyRewardClaimed: true,
            lastDailyRewardDate: new Date().toDateString(),
            loading: false
          }));
          
          return result;
        } catch (error) {
          console.error('💰 claimDailyReward error:', error);
          set({ 
            error: error.message || 'Failed to claim daily reward', 
            loading: false 
          });
          throw error;
        }
      },

      // Add reward when dose is logged
      addDoseReward: (reward) => {
        set((state) => ({
          userRewards: {
            ...state.userRewards,
            totalPoints: state.userRewards.totalPoints + reward.points + (reward.bonusPoints || 0),
            currentLevel: Math.floor((state.userRewards.totalPoints + reward.points + (reward.bonusPoints || 0)) / 100) + 1,
            pointsToNextLevel: (Math.floor((state.userRewards.totalPoints + reward.points + (reward.bonusPoints || 0)) / 100) + 1) * 100 - (state.userRewards.totalPoints + reward.points + (reward.bonusPoints || 0)),
            recentRewards: [
              {
                title: reward.reasonForBonus || 'Medication Logged',
                description: `Earned ${reward.points}${reward.bonusPoints ? ' + ' + reward.bonusPoints + ' bonus' : ''} points`,
                points: reward.points + (reward.bonusPoints || 0),
                timestamp: reward.timestamp || new Date(),
                type: reward.bonusPoints ? 'bonus' : 'regular'
              },
              ...state.userRewards.recentRewards.slice(0, 9)
            ]
          }
        }));
      },

      // Update streak
      updateStreak: (streak) => {
        set((state) => ({
          userRewards: {
            ...state.userRewards,
            currentStreak: streak
          }
        }));
      },

      // Check if daily reward can be claimed
      canClaimDailyReward: () => {
        const { dailyRewardClaimed, lastDailyRewardDate } = get();
        const today = new Date().toDateString();
        return !dailyRewardClaimed || lastDailyRewardDate !== today;
      },

      // Get level progress percentage
      getLevelProgress: () => {
        const { userRewards } = get();
        const pointsInCurrentLevel = userRewards.totalPoints % 100;
        return (pointsInCurrentLevel / 100) * 100;
      },

      // Get recent achievements
      getRecentAchievements: (limit = 3) => {
        const { achievements } = get();
        return achievements
          .filter(achievement => achievement.unlocked)
          .sort((a, b) => new Date(b.unlockedAt) - new Date(a.unlockedAt))
          .slice(0, limit);
      },

      // Reset daily reward status at start of new day
      resetDailyReward: () => {
        const today = new Date().toDateString();
        const { lastDailyRewardDate } = get();
        
        if (lastDailyRewardDate !== today) {
          set({
            dailyRewardClaimed: false,
            lastDailyRewardDate: today
          });
        }
      }
    }),
    {
      name: 'rewards-storage',
      partialize: (state) => ({
        userRewards: state.userRewards,
        achievements: state.achievements,
        dailyRewardClaimed: state.dailyRewardClaimed,
        lastDailyRewardDate: state.lastDailyRewardDate
      })
    }
  )
);

export default useRewardsStore;
