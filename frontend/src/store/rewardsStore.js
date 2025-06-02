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

      // Fetch user rewards from API
      fetchUserRewards: async (userId) => {
        console.log('🎯 fetchUserRewards called with userId:', userId);
        set({ loading: true, error: null });
        try {
          console.log('🎯 Calling RewardService.getUserRewards...');
          const rewardsData = await RewardService.getUserRewards(userId);
          console.log('🎯 Rewards data received:', rewardsData);
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

      // Fetch achievements
      fetchUserAchievements: async (userId) => {
        console.log('🏆 fetchUserAchievements called with userId:', userId);
        set({ loading: true, error: null });
        try {
          console.log('🏆 Calling RewardService.getUserAchievements...');
          const achievementsData = await RewardService.getUserAchievements(userId);
          console.log('🏆 Achievements data received:', achievementsData);
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

      // Claim daily reward
      claimDailyReward: async () => {
        console.log('💰 claimDailyReward called');
        set({ loading: true, error: null });
        try {
          console.log('💰 Calling RewardService.claimReward...');
          const result = await RewardService.claimReward('daily_check_in');
          console.log('💰 Claim result:', result);
          
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
