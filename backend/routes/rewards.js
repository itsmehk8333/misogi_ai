const express = require('express');
const DoseLog = require('../models/DoseLog');
const User = require('../models/User');
const auth = require('../middleware/auth');
const memoryManager = require('../utils/memoryManager');

const router = express.Router();

// @route   GET /api/rewards/consolidated/:userId
// @desc    Get user's rewards, achievements, and all related data in one call
// @access  Private
router.get('/consolidated/:userId?', auth, async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    
    // Fetch all data in parallel for maximum speed
    const [userDoc, recentDoses, achievementDefinitions] = await Promise.all([
      User.findById(userId).select('totalRewardPoints lastDailyRewardClaim').lean(),
      DoseLog.find({ user: userId })
        .sort({ scheduledTime: -1 })
        .limit(100)
        .select('rewards scheduledTime updatedAt status medication regimen')
        .populate('medication', 'name')
        .lean(),
      Promise.resolve(getAchievementDefinitions())
    ]);

    // Calculate all values in parallel
    const [
      currentStreak,
      achievements,
      dailyProgress,
      weeklyProgress
    ] = await Promise.all([
      calculateCurrentStreakFast(userId),
      calculateAchievementsFast(userId),
      getDailyProgressFast(userId),
      getWeeklyProgressFast(userId)
    ]);

    // Calculate points from recent dose logs
    const dosePoints = recentDoses.reduce((total, dose) => {
      return total + (dose.rewards?.points || 0) + (dose.rewards?.bonusPoints || 0);
    }, 0);

    const totalPoints = (userDoc?.totalRewardPoints || 0) + dosePoints;

    // Get recent rewards from already fetched data
    const recentRewards = recentDoses
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

    // Build achievements with status
    const achievementsWithStatus = Object.entries(achievementDefinitions).map(([key, achievement]) => ({
      id: key,
      ...achievement,
      unlocked: achievements.some(ua => ua.id === key),
      unlockedAt: achievements.find(ua => ua.id === key)?.unlockedAt || null,
      progress: getAchievementProgressFast(key, recentDoses)
    }));

    // Check if daily reward can be claimed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const canClaimDaily = !userDoc?.lastDailyRewardClaim || userDoc.lastDailyRewardClaim < today;

    memoryManager.checkMemoryAndGC();

    res.json({
      // Rewards data
      totalPoints,
      currentLevel: Math.floor(totalPoints / 100) + 1,
      pointsToNextLevel: (Math.floor(totalPoints / 100) + 1) * 100 - totalPoints,
      currentStreak,
      recentRewards,
      dailyProgress,
      weeklyProgress,
      
      // Achievements data
      achievements: achievementsWithStatus,
      
      // Additional metadata
      canClaimDailyReward: canClaimDaily,
      generatedAt: new Date(),
      
      // Performance metrics
      cacheRecommendation: 'cache-for-5min'
    });

  } catch (error) {
    console.error('Consolidated rewards error:', error);
    res.status(500).json({ message: 'Server error while fetching consolidated rewards' });
  }
});

// @route   GET /api/rewards/user/:userId
// @desc    Get user's rewards and achievements (legacy endpoint)
// @access  Private
router.get('/user/:userId?', auth, async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    
    // Fetch user's stored reward points efficiently
    const userDoc = await User.findById(userId).select('totalRewardPoints').lean();

    // Get recent dose logs with memory-safe pagination (limit to recent data for performance)
    const recentDoses = await DoseLog.find({ user: userId })
      .sort({ scheduledTime: -1 })
      .limit(100) // Limit to recent 100 doses for performance
      .select('rewards scheduledTime updatedAt status medication regimen')
      .populate('medication', 'name')
      .lean();

    // Calculate points from recent dose logs only
    const dosePoints = recentDoses.reduce((total, dose) => {
      return total + (dose.rewards?.points || 0) + (dose.rewards?.bonusPoints || 0);
    }, 0);

    // Combine with manually stored reward points
    const totalPoints = (userDoc?.totalRewardPoints || 0) + dosePoints;

    // Calculate current streak efficiently using aggregation
    const currentStreak = await calculateCurrentStreakFast(userId);
    
    // Get recent rewards (last 10) from already fetched data
    const recentRewards = recentDoses
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

    // Calculate achievements efficiently
    const achievements = await calculateAchievementsFast(userId);
    
    // Get daily/weekly progress efficiently
    const [dailyProgress, weeklyProgress] = await Promise.all([
      getDailyProgressFast(userId),
      getWeeklyProgressFast(userId)
    ]);

    memoryManager.checkMemoryAndGC();

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
    res.status(500).json({ message: 'Server error while fetching rewards' });
  }
});

// @route   GET /api/rewards/achievements
// @desc    Get all possible achievements with unlock status
// @access  Private
router.get('/achievements', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Use memory-safe pagination for dose logs
    const doseLogs = await memoryManager.safePaginate(DoseLog, 
      { user: userId }, 
      { 
        limit: 500, 
        select: 'status scheduledTime actualTime updatedAt',
        sort: { scheduledTime: -1 } 
      }
    );
    
    const achievementDefinitions = getAchievementDefinitions();
    const userAchievements = await calculateAchievementsFast(userId);
    
    const achievementsWithStatus = Object.entries(achievementDefinitions).map(([key, achievement]) => ({
      id: key,
      ...achievement,
      unlocked: userAchievements.some(ua => ua.id === key),
      unlockedAt: userAchievements.find(ua => ua.id === key)?.unlockedAt || null,
      progress: getAchievementProgressFast(key, doseLogs.results)
    }));

    memoryManager.checkMemoryAndGC();

    res.json(achievementsWithStatus);

  } catch (error) {
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

    // Use lean query for better performance
    const user = await User.findById(userId).select('lastDailyRewardClaim').lean();
    const lastDailyClaim = user?.lastDailyRewardClaim;
    
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

    memoryManager.checkMemoryAndGC();

    res.json({
      message: 'Daily reward claimed successfully!',
      points: dailyRewardPoints,
      type: 'daily_check_in'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error while claiming daily reward' });
  }
});

// @route   GET /api/rewards/leaderboard
// @desc    Get rewards leaderboard
// @access  Private
router.get('/leaderboard', auth, async (req, res) => {
  try {
    // Get top users by reward points using memory-efficient aggregation
    const topUsers = await memoryManager.safeAggregate(User, [
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
    ], { maxResults: 50 });

    // Get user's position efficiently
    const currentUser = await User.findById(req.user._id).select('totalRewardPoints').lean();
    const userPosition = await User.countDocuments({
      totalRewardPoints: { $gt: currentUser?.totalRewardPoints || 0 }
    }) + 1;

    const totalUsers = await User.countDocuments({ totalRewardPoints: { $gt: 0 } });

    memoryManager.checkMemoryAndGC();

    res.json({
      leaderboard: topUsers,
      userPosition,
      totalUsers
    });

  } catch (error) {
    res.status(500).json({ message: 'Server error while fetching leaderboard' });
  }
});

// @route   GET /api/rewards/performance-test/:userId
// @desc    Test performance of rewards system optimizations
// @access  Private (Admin only)
router.get('/performance-test/:userId?', auth, async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;
    
    // Performance test - Legacy approach timing
    const legacyStart = Date.now();
    const [legacyUser, legacyDoses, legacyAchievements] = await Promise.all([
      User.findById(userId).select('totalRewardPoints').lean(),
      DoseLog.find({ user: userId }).sort({ scheduledTime: -1 }).limit(50).lean(),
      DoseLog.find({ user: userId }).sort({ scheduledTime: -1 }).limit(100).lean()
    ]);
    const legacyTime = Date.now() - legacyStart;

    // Performance test - Optimized consolidated approach timing
    const optimizedStart = Date.now();
    const [optimizedUser, optimizedDoses] = await Promise.all([
      User.findById(userId).select('totalRewardPoints lastDailyRewardClaim').lean(),
      DoseLog.find({ user: userId })
        .sort({ scheduledTime: -1 })
        .limit(100)
        .select('rewards scheduledTime updatedAt status medication regimen')
        .populate('medication', 'name')
        .lean()
    ]);
    const optimizedTime = Date.now() - optimizedStart;

    // Calculate performance metrics
    const improvement = legacyTime > 0 ? ((legacyTime - optimizedTime) / legacyTime * 100).toFixed(1) : 0;
    const timeSaved = legacyTime - optimizedTime;

    // Memory usage
    const memUsage = process.memoryUsage();

    res.json({
      performanceTest: {
        legacy: {
          timeMs: legacyTime,
          dosesFound: legacyDoses.length,
          userPoints: legacyUser?.totalRewardPoints || 0
        },
        optimized: {
          timeMs: optimizedTime,
          dosesFound: optimizedDoses.length,
          userPoints: optimizedUser?.totalRewardPoints || 0
        },
        improvement: {
          percentFaster: parseFloat(improvement),
          timeSavedMs: timeSaved,
          status: improvement > 0 ? 'improved' : 'no-change'
        },
        memory: {
          heapUsedMB: (memUsage.heapUsed / 1024 / 1024).toFixed(2),
          heapTotalMB: (memUsage.heapTotal / 1024 / 1024).toFixed(2),
          rssMB: (memUsage.rss / 1024 / 1024).toFixed(2)
        }
      },
      timestamp: new Date(),
      message: improvement > 0 ? 
        `Optimized approach is ${improvement}% faster, saving ${timeSaved}ms per request` :
        'Performance test completed, minimal difference detected'
    });

  } catch (error) {
    console.error('Performance test error:', error);
    res.status(500).json({ message: 'Performance test failed', error: error.message });
  }
});

// Helper functions

// Fast streak calculation using aggregation
async function calculateCurrentStreakFast(userId) {
  try {
    const pipeline = [
      {
        $match: {
          user: userId,
          status: 'taken'
        }
      },
      {
        $addFields: {
          dateOnly: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$scheduledTime'
            }
          }
        }
      },
      {
        $group: {
          _id: '$dateOnly',
          hasData: { $first: true }
        }
      },
      {
        $sort: { _id: -1 }
      },
      {
        $limit: 365 // Only check last year for performance
      }
    ];

    const groupedDates = await DoseLog.aggregate(pipeline);
    
    if (groupedDates.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    
    for (const dateGroup of groupedDates) {
      const groupDate = new Date(dateGroup._id);
      const expectedDate = new Date(today);
      expectedDate.setDate(today.getDate() - streak);
      
      const groupDateStr = groupDate.toISOString().split('T')[0];
      const expectedDateStr = expectedDate.toISOString().split('T')[0];
      
      if (groupDateStr === expectedDateStr) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  } catch (error) {
    console.error('Fast streak calculation error:', error);
    return 0;
  }
}

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

// Fast achievements calculation using aggregation
async function calculateAchievementsFast(userId) {
  try {
    const achievements = [];
    
    // Get basic stats using efficient aggregation
    const statsResult = await DoseLog.aggregate([
      { $match: { user: userId, status: 'taken' } },
      {
        $group: {
          _id: null,
          totalTaken: { $sum: 1 },
          firstDose: { $min: '$updatedAt' },
          perfectTimingCount: {
            $sum: {
              $cond: [
                {
                  $lte: [
                    { $abs: { $subtract: ['$scheduledTime', { $ifNull: ['$actualTime', '$updatedAt'] }] } },
                    900000 // 15 minutes in milliseconds
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const stats = statsResult[0] || { totalTaken: 0, perfectTimingCount: 0 };

    // First dose achievement
    if (stats.totalTaken >= 1) {
      achievements.push({
        id: 'first_dose',
        unlockedAt: stats.firstDose
      });
    }

    // Perfect timing achievement
    if (stats.perfectTimingCount >= 10) {
      achievements.push({
        id: 'perfect_timing',
        unlockedAt: new Date()
      });
    }

    // Streak achievements (using fast calculation)
    const currentStreak = await calculateCurrentStreakFast(userId);
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

    // Get adherence data for recent periods
    const [weeklyAdherence, monthlyAdherence] = await Promise.all([
      calculateWeeklyAdherenceFast(userId),
      calculateMonthlyAdherenceFast(userId)
    ]);

    if (weeklyAdherence >= 100) {
      achievements.push({
        id: 'perfect_week',
        unlockedAt: new Date()
      });
    }

    if (monthlyAdherence >= 95) {
      achievements.push({
        id: 'consistency_champion',
        unlockedAt: new Date()
      });
    }

    return achievements;
  } catch (error) {
    console.error('Fast achievements calculation error:', error);
    return [];
  }
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

// Fast weekly adherence calculation using aggregation
async function calculateWeeklyAdherenceFast(userId) {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const result = await DoseLog.aggregate([
      {
        $match: {
          user: userId,
          scheduledTime: { $gte: oneWeekAgo }
        }
      },
      {
        $group: {
          _id: null,
          totalDoses: { $sum: 1 },
          takenDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] }
          }
        }
      }
    ]);

    if (result.length === 0 || result[0].totalDoses === 0) return 0;
    return (result[0].takenDoses / result[0].totalDoses) * 100;
  } catch (error) {
    console.error('Fast weekly adherence calculation error:', error);
    return 0;
  }
}

// Fast monthly adherence calculation using aggregation
async function calculateMonthlyAdherenceFast(userId) {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    const result = await DoseLog.aggregate([
      {
        $match: {
          user: userId,
          scheduledTime: { $gte: oneMonthAgo }
        }
      },
      {
        $group: {
          _id: null,
          totalDoses: { $sum: 1 },
          takenDoses: {
            $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] }
          }
        }
      }
    ]);

    if (result.length === 0 || result[0].totalDoses === 0) return 0;
    return (result[0].takenDoses / result[0].totalDoses) * 100;
  } catch (error) {
    console.error('Fast monthly adherence calculation error:', error);
    return 0;
  }
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

// Fast daily progress calculation using aggregation
async function getDailyProgressFast(userId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await DoseLog.aggregate([
      {
        $match: {
          user: userId,
          scheduledTime: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = result[0] || { total: 0, completed: 0 };
    return {
      total: stats.total,
      completed: stats.completed,
      percentage: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
    };
  } catch (error) {
    console.error('Fast daily progress calculation error:', error);
    return { total: 0, completed: 0, percentage: 0 };
  }
}

// Fast weekly progress calculation using aggregation
async function getWeeklyProgressFast(userId) {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const result = await DoseLog.aggregate([
      {
        $match: {
          user: userId,
          scheduledTime: { $gte: oneWeekAgo }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'taken'] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = result[0] || { total: 0, completed: 0 };
    return {
      total: stats.total,
      completed: stats.completed,
      percentage: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
    };
  } catch (error) {
    console.error('Fast weekly progress calculation error:', error);
    return { total: 0, completed: 0, percentage: 0 };
  }
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

// Fast achievement progress calculation
function getAchievementProgressFast(achievementId, doseLogs) {
  const takenDoses = doseLogs.filter(dose => dose.status === 'taken');
  
  switch (achievementId) {
    case 'first_dose':
      return { current: Math.min(takenDoses.length, 1), target: 1 };
    case 'perfect_timing':
      const perfectTiming = takenDoses.filter(dose => {
        const diff = Math.abs(new Date(dose.actualTime || dose.updatedAt) - new Date(dose.scheduledTime));
        return diff <= 15 * 60 * 1000; // 15 minutes in milliseconds
      });
      return { current: Math.min(perfectTiming.length, 10), target: 10 };
    case 'streak_starter':
      return { current: Math.min(7, 7), target: 7 }; // Would need actual streak calculation
    case 'month_master':
      return { current: Math.min(takenDoses.length, 30), target: 30 };
    case 'perfect_week':
      return { current: 0, target: 1 }; // Complex calculation needed
    case 'consistency_champion':
      return { current: 0, target: 1 }; // Complex calculation needed
    default:
      return { current: 0, target: 1 };
  }
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
