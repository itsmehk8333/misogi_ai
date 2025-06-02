import api from './api';

class RewardService {
  // Get user rewards from backend
  static async getUserRewards(userId) {
    console.log('🌐 RewardService.getUserRewards called with userId:', userId);
    try {
      // If userId is undefined or null, let the backend use the authenticated user's ID
      const endpoint = userId ? `/rewards/user/${userId}` : '/rewards/user';
      console.log('🌐 Making API call to:', endpoint);
      const response = await api.get(endpoint);
      console.log('🌐 API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🌐 RewardService.getUserRewards error:', error);
      console.error('🌐 Error response:', error.response?.data);
      throw error.response?.data || { message: 'Failed to fetch rewards' };
    }
  }

  // Get user achievements from backend  
  static async getUserAchievements(userId) {
    console.log('🌐 RewardService.getUserAchievements called with userId:', userId);
    try {
      // userId is not actually used in this endpoint as the backend uses the authenticated user
      console.log('🌐 Making API call to /rewards/achievements');
      const response = await api.get('/rewards/achievements');
      console.log('🌐 Achievements API response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🌐 RewardService.getUserAchievements error:', error);
      console.error('🌐 Error response:', error.response?.data);
      throw error.response?.data || { message: 'Failed to fetch achievements' };
    }
  }

  // Claim daily reward
  static async claimReward(rewardType = 'daily_check_in') {
    console.log('🌐 RewardService.claimReward called with type:', rewardType);
    try {
      let endpoint;
      switch (rewardType) {
        case 'daily_check_in':
          endpoint = '/rewards/claim-daily';
          break;
        default:
          throw new Error('Invalid reward type');
      }
      
      console.log('🌐 Making API call to:', endpoint);
      const response = await api.post(endpoint);
      console.log('🌐 Claim response:', response.data);
      return response.data;
    } catch (error) {
      console.error('🌐 RewardService.claimReward error:', error);
      console.error('🌐 Error response:', error.response?.data);
      throw error.response?.data || { message: 'Failed to claim reward' };
    }
  }

  // Get leaderboard
  static async getLeaderboard() {
    try {
      const response = await api.get('/rewards/leaderboard');
      return response.data;
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error.response?.data || { message: 'Failed to fetch leaderboard' };
    }
  }

  // Calculate current adherence streak
  static calculateCurrentStreak(doseHistory) {
    if (!doseHistory || doseHistory.length === 0) return 0;

    const sortedDoses = doseHistory
      .filter(dose => dose.status === 'taken')
      .sort((a, b) => new Date(b.scheduledTime) - new Date(a.scheduledTime));

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(23, 59, 59, 999);

    for (const dose of sortedDoses) {
      const doseDate = new Date(dose.scheduledTime);
      doseDate.setHours(23, 59, 59, 999);
      
      const daysDiff = Math.floor((currentDate - doseDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === streak) {
        streak++;
      } else if (daysDiff > streak) {
        break;
      }
    }

    return streak;
  }

  // Check if all doses for today are completed
  static isAllDosesTodayCompleted(doseHistory) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysDoses = doseHistory.filter(dose => {
      const doseDate = new Date(dose.scheduledTime);
      return doseDate >= today && doseDate < tomorrow;
    });

    if (todaysDoses.length === 0) return false;

    const completedDoses = todaysDoses.filter(dose => dose.status === 'taken');
    return completedDoses.length === todaysDoses.length;
  }

  // Check for various achievements
  static checkAchievements(dose, userHistory) {
    const achievements = [];

    // First dose achievement
    if (userHistory.filter(d => d.status === 'taken').length === 1) {
      achievements.push('first_dose');
    }

    // Perfect timing achievement (10 doses within 15 minutes)
    const perfectTimingDoses = userHistory.filter(d => {
      if (d.status !== 'taken') return false;
      const diff = Math.floor((new Date(d.actualTime || d.timestamp) - new Date(d.scheduledTime)) / (1000 * 60));
      return diff <= 15;
    });

    if (perfectTimingDoses.length >= 10) {
      achievements.push('perfect_timing');
    }

    // Early bird achievement (morning doses before 8 AM for 5 days)
    const morningDoses = userHistory.filter(d => {
      if (d.status !== 'taken') return false;
      const hour = new Date(d.scheduledTime).getHours();
      const actualHour = new Date(d.actualTime || d.timestamp).getHours();
      return hour < 8 && actualHour < 8;
    });

    if (morningDoses.length >= 5) {
      achievements.push('early_bird');
    }

    // Weekly perfect achievement
    const weeklyAdherence = this.calculateWeeklyAdherence(userHistory);
    if (weeklyAdherence >= 100) {
      achievements.push('perfect_week');
    }

    // Consistency champion (95% adherence for 30 days)
    const monthlyAdherence = this.calculateMonthlyAdherence(userHistory);
    if (monthlyAdherence >= 95) {
      achievements.push('consistency_champion');
    }

    return achievements;
  }

  // Calculate weekly adherence percentage
  static calculateWeeklyAdherence(doseHistory) {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const weeklyDoses = doseHistory.filter(dose => 
      new Date(dose.scheduledTime) >= oneWeekAgo
    );

    if (weeklyDoses.length === 0) return 0;

    const takenDoses = weeklyDoses.filter(dose => dose.status === 'taken');
    return (takenDoses.length / weeklyDoses.length) * 100;
  }

  // Calculate monthly adherence percentage
  static calculateMonthlyAdherence(doseHistory) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    const monthlyDoses = doseHistory.filter(dose => 
      new Date(dose.scheduledTime) >= oneMonthAgo
    );

    if (monthlyDoses.length === 0) return 0;

    const takenDoses = monthlyDoses.filter(dose => dose.status === 'taken');
    return (takenDoses.length / monthlyDoses.length) * 100;
  }

  // Get user's level based on total points
  static getUserLevel(totalPoints) {
    return Math.floor(totalPoints / 100) + 1;
  }

  // Get points needed for next level
  static getPointsToNextLevel(totalPoints) {
    const currentLevel = this.getUserLevel(totalPoints);
    const nextLevelPoints = currentLevel * 100;
    return nextLevelPoints - totalPoints;
  }

  // Achievement definitions with detailed rewards
  static getAchievementDefinitions() {
    return {
      first_dose: {
        title: 'First Steps',
        description: 'Log your first medication dose',
        icon: '🎯',
        points: 50,
        category: 'milestone',
        rarity: 'common'
      },
      perfect_week: {
        title: 'Perfect Week',
        description: 'Take all medications on time for 7 days',
        icon: '⭐',
        points: 150,
        category: 'streak',
        rarity: 'rare'
      },
      early_bird: {
        title: 'Early Bird',
        description: 'Take morning medications before 8 AM for 5 days',
        icon: '🌅',
        points: 100,
        category: 'timing',
        rarity: 'uncommon'
      },
      consistency_champion: {
        title: 'Consistency Champion',
        description: 'Maintain 95% adherence for 30 days',
        icon: '🏆',
        points: 300,
        category: 'adherence',
        rarity: 'legendary'
      },
      month_master: {
        title: 'Month Master',
        description: 'Complete 30 days of medication logging',
        icon: '📅',
        points: 200,
        category: 'milestone',
        rarity: 'rare'
      },
      perfect_timing: {
        title: 'Perfect Timing',
        description: 'Take 10 doses within 15 minutes of scheduled time',
        icon: '⏰',
        points: 120,
        category: 'timing',
        rarity: 'uncommon'
      },
      streak_starter: {
        title: 'Streak Starter',
        description: 'Complete a 7-day adherence streak',
        icon: '🔥',
        points: 75,
        category: 'streak',
        rarity: 'common'
      },
      weekend_warrior: {
        title: 'Weekend Warrior',
        description: 'Maintain adherence over 2 consecutive weekends',
        icon: '💪',
        points: 90,
        category: 'special',
        rarity: 'uncommon'
      },
      daily_complete: {
        title: 'Daily Hero',
        description: 'Complete all doses scheduled for today',
        icon: '✅',
        points: 25,
        category: 'daily',
        rarity: 'common'
      }
    };
  }

  // Daily reward suggestions based on user progress
  static getDailyRewardSuggestions(userHistory) {
    const suggestions = [];
    
    // Daily login reward
    suggestions.push({
      type: 'daily_check',
      title: 'Daily Check-in Bonus',
      description: 'Visit the app daily to stay on track',
      points: 5,
      icon: '📱',
      canClaim: true
    });

    // Dose completion rewards
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysDoses = userHistory.filter(dose => {
      const doseDate = new Date(dose.scheduledTime);
      return doseDate >= today;
    });

    if (todaysDoses.length > 0) {
      const completedToday = todaysDoses.filter(dose => dose.status === 'taken').length;
      const totalToday = todaysDoses.length;
      
      if (completedToday === totalToday && totalToday > 0) {
        suggestions.push({
          type: 'daily_complete',
          title: 'Perfect Day!',
          description: 'All medications taken today',
          points: 50,
          icon: '🎉',
          canClaim: true
        });
      }
    }

    return suggestions;
  }
}

export default RewardService;
