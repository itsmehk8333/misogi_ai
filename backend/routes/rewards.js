const express = require('express');
const DoseLog = require('../models/DoseLog');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/rewards/user/:userId
// @desc    Get user's rewards and achievements
// @access  Private
router.get('/user/:userId?', auth, async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    // Fetch user's stored reward points (e.g., from manual claims)
    const userDoc = await User.findById(userId).select('totalRewardPoints');

    // Get all dose logs for the user
    const doseLogs = await DoseLog.find({ user: userId })
      .sort({ scheduledTime: -1 })
      .populate('medication')
      .populate('regimen');

    // Calculate points from dose logs
    const dosePoints = doseLogs.reduce((total, dose) => {
      return total + (dose.rewards?.points || 0) + (dose.rewards?.bonusPoints || 0);
    }, 0);
    // Combine with manually stored reward points
    const totalPoints = (userDoc?.totalRewardPoints || 0) + dosePoints;

    // Calculate current streak
    const currentStreak = await calculateCurrentStreak(userId);
    
    // Get recent rewards (last 10)
    const recentRewards = doseLogs
      .filter(dose => dose.rewards && (dose.rewards.points > 0 || dose.rewards.bonusPoints > 0))
      .slice(0, 10)
      .map(dose => ({
        id: dose._id,
        title: getRewardTitle(dose),
        description: getRewardDescription(dose),
        points: dose.rewards.points + (dose.rewards.bonusPoints || 0),
        timestamp: dose.updatedAt,
        type: dose.rewards.reasonForBonus ? 'bonus' : 'regular',
        medication: dose.medication?.name || 'Unknown'
      }));

    // Calculate achievements
    const achievements = await calculateAchievements(userId, doseLogs);
    
    // Get daily/weekly progress
    const dailyProgress = await getDailyProgress(userId);
    const weeklyProgress = await getWeeklyProgress(userId);

    res.json({
      totalPoints,
      currentLevel: Math.floor(totalPoints / 100) + 1,
      pointsToNextLevel: (Math.floor(totalPoints / 100) + 1) * 100 - totalPoints,
      currentStreak,
      recentRewards,
      achievements,
      dailyProgress,
      weeklyProgress,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Get user rewards error:', error);
    res.status(500).json({ message: 'Server error while fetching rewards' });
  }
});

// @route   GET /api/rewards/achievements
// @desc    Get all possible achievements with unlock status
// @access  Private
router.get('/achievements', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const doseLogs = await DoseLog.find({ user: userId });
    
    const achievementDefinitions = getAchievementDefinitions();
    const userAchievements = await calculateAchievements(userId, doseLogs);
    
    const achievementsWithStatus = Object.entries(achievementDefinitions).map(([key, achievement]) => ({
      id: key,
      ...achievement,
      unlocked: userAchievements.some(ua => ua.id === key),
      unlockedAt: userAchievements.find(ua => ua.id === key)?.unlockedAt || null,
      progress: getAchievementProgress(key, doseLogs)
    }));

    res.json(achievementsWithStatus);

  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({ message: 'Server error while fetching achievements' });
  }
});

// @route   POST /api/rewards/claim-daily
// @desc    Claim daily rewards
// @access  Private
router.post('/claim-daily', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Removed restriction to allow multiple daily claims
    const user = await User.findById(userId);
    const lastDailyClaim = user.lastDailyRewardClaim;
    if (lastDailyClaim && lastDailyClaim >= today) {
      return res.status(400).json({ message: 'Daily reward already claimed today' });
    }

    // Award daily reward points
    const dailyRewardPoints = 10;

    // Update user's last claim date and increment points
    await User.findByIdAndUpdate(userId, {
      lastDailyRewardClaim: new Date(),
      $inc: { totalRewardPoints: dailyRewardPoints }
    });

    res.json({
      message: 'Daily reward claimed successfully!',
      points: dailyRewardPoints,
      type: 'daily_check_in'
    });
  } catch (error) {
    console.error('Claim daily reward error:', error);
    res.status(500).json({ message: 'Server error while claiming daily reward' });
  }
});

// @route   GET /api/rewards/leaderboard
// @desc    Get rewards leaderboard
// @access  Private
router.get('/leaderboard', auth, async (req, res) => {
  try {
    // Get top users by reward points (anonymized)
    const topUsers = await User.aggregate([
      {
        $match: { totalRewardPoints: { $gt: 0 } }
      },
      {
        $project: {
          username: { $concat: [{ $substr: ['$username', 0, 1] }, '***'] },
          totalRewardPoints: 1,
          level: { $add: [{ $floor: { $divide: ['$totalRewardPoints', 100] } }, 1] }
        }
      },
      {
        $sort: { totalRewardPoints: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Get user's position
    const userPosition = await User.countDocuments({
      totalRewardPoints: { $gt: await User.findById(req.user._id).totalRewardPoints || 0 }
    }) + 1;

    res.json({
      leaderboard: topUsers,
      userPosition,
      totalUsers: await User.countDocuments({ totalRewardPoints: { $gt: 0 } })
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ message: 'Server error while fetching leaderboard' });
  }
});

// Helper functions

async function calculateCurrentStreak(userId) {
  const doses = await DoseLog.find({ user: userId, status: 'taken' })
    .sort({ scheduledTime: -1 });

  if (doses.length === 0) return 0;

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(23, 59, 59, 999);

  for (const dose of doses) {
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

async function calculateAchievements(userId, doseLogs) {
  const achievements = [];
  const takenDoses = doseLogs.filter(dose => dose.status === 'taken');

  // First dose achievement
  if (takenDoses.length >= 1) {
    achievements.push({
      id: 'first_dose',
      unlockedAt: takenDoses[takenDoses.length - 1].updatedAt
    });
  }

  // Perfect timing achievement (10 doses within 15 minutes)
  const perfectTimingDoses = takenDoses.filter(dose => {
    const diff = Math.floor((new Date(dose.actualTime || dose.updatedAt) - new Date(dose.scheduledTime)) / (1000 * 60));
    return diff <= 15;
  });

  if (perfectTimingDoses.length >= 10) {
    achievements.push({
      id: 'perfect_timing',
      unlockedAt: perfectTimingDoses[9].updatedAt
    });
  }

  // Streak achievements
  const currentStreak = await calculateCurrentStreak(userId);
  if (currentStreak >= 7) {
    achievements.push({
      id: 'streak_starter',
      unlockedAt: new Date()
    });
  }

  if (currentStreak >= 30) {
    achievements.push({
      id: 'month_master',
      unlockedAt: new Date()
    });
  }

  // Weekly perfect achievement
  const weeklyAdherence = await calculateWeeklyAdherence(userId);
  if (weeklyAdherence >= 100) {
    achievements.push({
      id: 'perfect_week',
      unlockedAt: new Date()
    });
  }

  // Monthly consistency achievement
  const monthlyAdherence = await calculateMonthlyAdherence(userId);
  if (monthlyAdherence >= 95) {
    achievements.push({
      id: 'consistency_champion',
      unlockedAt: new Date()
    });
  }

  return achievements;
}

async function calculateWeeklyAdherence(userId) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const weeklyDoses = await DoseLog.find({
    user: userId,
    scheduledTime: { $gte: oneWeekAgo }
  });

  if (weeklyDoses.length === 0) return 0;

  const takenDoses = weeklyDoses.filter(dose => dose.status === 'taken');
  return (takenDoses.length / weeklyDoses.length) * 100;
}

async function calculateMonthlyAdherence(userId) {
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const monthlyDoses = await DoseLog.find({
    user: userId,
    scheduledTime: { $gte: oneMonthAgo }
  });

  if (monthlyDoses.length === 0) return 0;

  const takenDoses = monthlyDoses.filter(dose => dose.status === 'taken');
  return (takenDoses.length / monthlyDoses.length) * 100;
}

async function getDailyProgress(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaysDoses = await DoseLog.find({
    user: userId,
    scheduledTime: { $gte: today, $lt: tomorrow }
  });

  const completedDoses = todaysDoses.filter(dose => dose.status === 'taken');
  
  return {
    total: todaysDoses.length,
    completed: completedDoses.length,
    percentage: todaysDoses.length > 0 ? (completedDoses.length / todaysDoses.length) * 100 : 0
  };
}

async function getWeeklyProgress(userId) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const weeklyDoses = await DoseLog.find({
    user: userId,
    scheduledTime: { $gte: oneWeekAgo }
  });

  const completedDoses = weeklyDoses.filter(dose => dose.status === 'taken');
  
  return {
    total: weeklyDoses.length,
    completed: completedDoses.length,
    percentage: weeklyDoses.length > 0 ? (completedDoses.length / weeklyDoses.length) * 100 : 0
  };
}

function getRewardTitle(dose) {
  if (dose.rewards?.reasonForBonus) {
    return dose.rewards.reasonForBonus;
  }
  return 'Medication Logged';
}

function getRewardDescription(dose) {
  const points = dose.rewards?.points || 0;
  const bonusPoints = dose.rewards?.bonusPoints || 0;
  
  if (bonusPoints > 0) {
    return `Perfect timing bonus! ${points} base + ${bonusPoints} bonus points`;
  }
  return `Earned ${points} points for taking medication`;
}

function getAchievementDefinitions() {
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
    }
  };
}

function getAchievementProgress(achievementId, doseLogs) {
  const takenDoses = doseLogs.filter(dose => dose.status === 'taken');
  
  switch (achievementId) {
    case 'first_dose':
      return { current: Math.min(takenDoses.length, 1), target: 1 };
    case 'perfect_timing':
      const perfectTiming = takenDoses.filter(dose => {
        const diff = Math.floor((new Date(dose.actualTime || dose.updatedAt) - new Date(dose.scheduledTime)) / (1000 * 60));
        return diff <= 15;
      });
      return { current: Math.min(perfectTiming.length, 10), target: 10 };
    case 'streak_starter':
      return { current: Math.min(7, 7), target: 7 }; // Would need to calculate actual streak
    case 'month_master':
      return { current: Math.min(takenDoses.length, 30), target: 30 };
    default:
      return { current: 0, target: 1 };
  }
}

module.exports = router;
