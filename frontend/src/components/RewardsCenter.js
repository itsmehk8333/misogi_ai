import React, { useState, useEffect } from 'react';
import useDoseStore from '../store/doseStore';
import useRewardsStore from '../store/rewardsStore';
import useAuthStore from '../store/authStore';
import RewardService from '../services/rewardService';
import Card from './Card';
import { motion, AnimatePresence } from 'framer-motion';

const RewardsCenter = () => {
  const { rewards, getRecentRewards, doses } = useDoseStore();
  const { 
    userRewards, 
    fetchUserRewards, 
    achievements, 
    claimDailyReward, 
    canClaimDailyReward,
    fetchUserAchievements 
  } = useRewardsStore();
  const { user, token, isAuthenticated, login } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [claimError, setClaimError] = useState('');

  // Fetch rewards and achievements when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    fetchUserRewards()
      .then(data => console.log('Fetched rewards:', data))
      .catch(error => console.error('Error fetching rewards:', error))
      .finally(() => setLoading(false));
    fetchUserAchievements()
      .then(data => console.log('Fetched achievements:', data))
      .catch(error => console.error('Error fetching achievements:', error));
  }, [isAuthenticated]);

  // Use actual rewards data from store, fallback to local calculation
  const totalPoints = userRewards?.totalPoints || rewards.reduce((total, reward) => total + (reward.points || 0), 0);
  const currentLevel = userRewards?.currentLevel || Math.floor(totalPoints / 100) + 1;
  const nextLevelPoints = userRewards?.pointsToNextLevel || (currentLevel * 100);
  const currentStreak = userRewards?.currentStreak || 0;

  // Fallback achievement definitions (in case store doesn't have them)
  const fallbackAchievements = [
    {
      id: 'first_dose',
      title: 'First Steps',
      description: 'Log your first medication dose',
      icon: '🎯',
      points: 50,
      category: 'milestone',
      unlocked: doses.length > 0
    },
    {
      id: 'perfect_week',
      title: 'Perfect Week',
      description: 'Take all medications on time for 7 days',
      icon: '⭐',
      points: 150,
      category: 'streak',
      unlocked: false // This would be calculated based on dose data
    },
    {
      id: 'early_bird',
      title: 'Early Bird',
      description: 'Take morning medications before 8 AM for 5 days',
      icon: '🌅',
      points: 100,
      category: 'timing',
      unlocked: false
    },
    {
      id: 'consistency_champion',
      title: 'Consistency Champion',
      description: 'Maintain 95% adherence for 30 days',
      icon: '🏆',
      points: 300,
      category: 'adherence',
      unlocked: false
    },
    {
      id: 'month_master',
      title: 'Month Master',
      description: 'Complete 30 days of medication logging',
      icon: '📅',
      points: 200,
      category: 'milestone',
      unlocked: false
    },
    {
      id: 'perfect_timing',
      title: 'Perfect Timing',
      description: 'Take 10 doses within 15 minutes of scheduled time',
      icon: '⏰',
      points: 120,
      category: 'timing',
      unlocked: false
    },
    {
      id: 'streak_starter',
      title: 'Streak Starter',
      description: 'Complete a 3-day adherence streak',
      icon: '🔥',
      points: 75,
      category: 'streak',
      unlocked: false
    },
    {
      id: 'weekend_warrior',
      title: 'Weekend Warrior',
      description: 'Maintain adherence over 2 consecutive weekends',
      icon: '💪',
      points: 90,
      category: 'special',
      unlocked: false
    }
  ];

  // Use achievements from store, fallback to local definitions
  const displayAchievements = achievements && achievements.length > 0 ? achievements : fallbackAchievements;

  // Daily/weekly rewards for regular logging
  const regularRewards = [
    {
      type: 'daily_login',
      title: 'Daily Check-in',
      description: 'Log in and check your medications',
      points: 10,
      icon: '📱'
    },
    {
      type: 'on_time_dose',
      title: 'Perfect Timing',
      description: 'Take medication within 15 minutes',
      points: 15,
      icon: '⏰'
    },
    {
      type: 'all_doses_today',
      title: 'Daily Complete',
      description: 'Take all scheduled doses today',
      points: 25,
      icon: '✅'
    },
    {
      type: 'week_completion',
      title: 'Weekly Achievement',
      description: 'Complete all doses this week',
      points: 100,
      icon: '🎊'
    },
    {
      type: 'month_milestone',
      title: 'Monthly Milestone',
      description: '30 days of consistent logging',
      points: 250,
      icon: '🏅'
    }
  ];

  const filteredAchievements = selectedCategory === 'all' 
    ? displayAchievements 
    : displayAchievements.filter(achievement => achievement.category === selectedCategory);

  const categories = [
    { id: 'all', label: 'All', icon: '🏆' },
    { id: 'milestone', label: 'Milestones', icon: '🎯' },
    { id: 'streak', label: 'Streaks', icon: '🔥' },
    { id: 'timing', label: 'Timing', icon: '⏰' },
    { id: 'adherence', label: 'Adherence', icon: '💊' },
    { id: 'special', label: 'Special', icon: '⭐' }
  ];

  const progressPercentage = ((totalPoints % 100) / 100) * 100;

  const handleClaimDailyReward = async () => {
    if (canClaimDailyReward) {
      setClaimError('');
      try {
        setLoading(true);
        await claimDailyReward();
        await fetchUserRewards();
      } catch (error) {
        console.error('Failed to claim daily reward:', error);
        setClaimError(error.message || 'Failed to claim daily reward');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header with Points and Level */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Rewards Center</h1>
            <p className="text-blue-100">Keep logging to unlock amazing rewards!</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{totalPoints}</div>
            <div className="text-blue-100">Total Points</div>
          </div>
        </div>
        
        {/* Level Progress */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>Level {currentLevel}</span>
            <span>{nextLevelPoints - totalPoints} points to Level {currentLevel + 1}</span>
          </div>
          <div className="w-full bg-blue-500 bg-opacity-30 rounded-full h-3">
            <motion.div 
              className="bg-white rounded-full h-3"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>

      {/* Daily Rewards Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <span className="mr-2">🎁</span>
          Daily & Weekly Rewards
        </h2>
        {claimError && <p className="text-red-500 mb-4">{claimError}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {regularRewards.map((reward, index) => (
            <motion.div
              key={reward.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="text-2xl mb-2">{reward.icon}</div>
              <h3 className="font-semibold text-gray-800">{reward.title}</h3>
              <p className="text-sm text-gray-600 mb-2">{reward.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-green-600 font-bold">+{reward.points} pts</span>
                <button
                  onClick={handleClaimDailyReward}
                  className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200"
                >
                  {loading ? 'Processing...' : 'Claim'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Achievement Categories */}
      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
              selectedCategory === category.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{category.icon}</span>
            <span>{category.label}</span>
          </button>
        ))}
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredAchievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`p-6 h-full transition-all duration-300 ${
                achievement.unlocked 
                  ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-300 shadow-lg' 
                  : 'bg-gray-50 border-gray-200 opacity-75'
              }`}>
                <div className="flex items-start justify-between mb-4">
                  <div className={`text-4xl ${achievement.unlocked ? 'filter-none' : 'filter grayscale'}`}>
                    {achievement.icon}
                  </div>
                  {achievement.unlocked && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="bg-green-500 text-white rounded-full p-1"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </motion.div>
                  )}
                </div>
                <h3 className={`font-bold text-lg mb-2 ${
                  achievement.unlocked ? 'text-gray-800' : 'text-gray-500'
                }`}>
                  {achievement.title}
                </h3>
                <p className={`text-sm mb-4 ${
                  achievement.unlocked ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {achievement.description}
                </p>
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${
                    achievement.unlocked ? 'text-yellow-600' : 'text-gray-400'
                  }`}>
                    {achievement.points} points
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    achievement.unlocked 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {achievement.unlocked ? 'Unlocked' : 'Locked'}
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Recent Rewards */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4 flex items-center">
          <span className="mr-2">📈</span>
          Recent Activity
        </h2>
        {rewards.length > 0 ? (
          <div className="space-y-3">
            {getRecentRewards(5).map((reward, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-800">{reward.title || 'Medication Logged'}</p>
                  <p className="text-sm text-gray-600">{reward.description || 'Great job staying on track!'}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">+{reward.points} pts</p>
                  <p className="text-xs text-gray-500">
                    {new Date(reward.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🎯</div>
            <p>Start logging medications to earn your first rewards!</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default RewardsCenter;
