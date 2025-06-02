const mongoose = require('mongoose');

const doseLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  regimen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Regimen',
    required: true
  },
  medication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    required: true
  },
  scheduledTime: {
    type: Date,
    required: [true, 'Scheduled time is required']
  },
  actualTime: {
    type: Date
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['taken', 'missed', 'skipped', 'delayed', 'pending'],
    default: 'pending'
  },
  dosage: {
    amount: {
      type: Number,
      required: [true, 'Dosage amount is required']
    },
    unit: {
      type: String,
      required: [true, 'Dosage unit is required']
    }
  },
  notes: {
    type: String,
    trim: true
  },
  sideEffects: [{
    type: String,
    trim: true
  }],
  effectiveness: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    notes: String
  },
  location: {
    type: String,
    trim: true
  },
  withFood: {
    type: Boolean
  },
  mood: {
    type: String,
    enum: ['excellent', 'good', 'okay', 'poor', 'terrible']
  },
  symptoms: [{
    name: String,
    severity: {
      type: Number,
      min: 1,
      max: 10
    }
  }],
  reminderSent: {
    type: Boolean,
    default: false
  },
  takenLate: {
    type: Boolean,
    default: false
  },
  minutesLate: {
    type: Number,
    default: 0
  },
  // Enhanced late logging support
  lateLogging: {
    isLate: { type: Boolean, default: false },
    warningShown: { type: Boolean, default: false },
    maxLateMinutes: { type: Number, default: 240 }, // 4 hours
    isWithinWindow: { type: Boolean, default: true }
  },
  // Enhanced rewards system
  rewards: {
    points: {
      type: Number,
      default: 0
    },
    streak: {
      type: Number,
      default: 0
    },
    achievements: [String],
    bonusPoints: {
      type: Number,
      default: 0
    },
    reasonForBonus: String
  },
  // Photo/proof of taking medication
  photo: {
    url: String,
    timestamp: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
doseLogSchema.index({ user: 1, scheduledTime: -1 });
doseLogSchema.index({ user: 1, regimen: 1, scheduledTime: -1 });
doseLogSchema.index({ user: 1, status: 1, scheduledTime: -1 });

// Pre-save middleware to calculate if dose was taken late and assign rewards
doseLogSchema.pre('save', function(next) {
  if (this.status === 'taken' && this.actualTime && this.scheduledTime) {
    const diffInMinutes = Math.floor((this.actualTime - this.scheduledTime) / (1000 * 60));
    this.minutesLate = Math.max(0, diffInMinutes);
    this.takenLate = diffInMinutes > 30; // Consider late if more than 30 minutes
    
    // Late logging logic
    this.lateLogging.isLate = diffInMinutes > 0;
    this.lateLogging.isWithinWindow = diffInMinutes <= this.lateLogging.maxLateMinutes;
    
    // Enhanced reward system
    if (diffInMinutes <= 15) {
      this.rewards.points = 15; // Perfect timing
      this.rewards.bonusPoints = 5;
      this.rewards.reasonForBonus = 'Perfect timing';
    } else if (diffInMinutes <= 30) {
      this.rewards.points = 12; // On time
    } else if (diffInMinutes <= 60) {
      this.rewards.points = 8; // Slightly late
      this.lateLogging.warningShown = true;
    } else if (diffInMinutes <= 240) {
      this.rewards.points = 3; // Late but within window
      this.lateLogging.warningShown = true;
    } else {
      this.rewards.points = 1; // Very late, outside window
      this.lateLogging.isWithinWindow = false;
    }
    
    // Bonus points for consistency
    if (this.rewards.streak >= 7) {
      this.rewards.bonusPoints += 10;
      this.rewards.reasonForBonus = '7-day streak bonus';
    }
    if (this.rewards.streak >= 30) {
      this.rewards.bonusPoints += 25;
      this.rewards.reasonForBonus = '30-day streak bonus';
    }
  }
  
  next();
});

// Static method to get adherence stats for a user
// Get adherence statistics for a user within a time period
// Get adherence statistics for a user within a time period
doseLogSchema.statics.getAdherenceStats = async function(userId, startDate, endDate) {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Get all scheduled doses in the time period
    const totalDoses = await this.countDocuments({
      user: userObjectId,
      scheduledTime: { $gte: start, $lte: end }
    });
    
    // Get taken doses (both on time and late)
    const takenDoses = await this.countDocuments({
      user: userObjectId,
      scheduledTime: { $gte: start, $lte: end },
      status: 'taken'
    });
    
    // Get missed doses
    const missedDoses = await this.countDocuments({
      user: userObjectId,
      scheduledTime: { $gte: start, $lte: end },
      status: 'missed'
    });
    
    // Get skipped doses
    const skippedDoses = await this.countDocuments({
      user: userObjectId,
      scheduledTime: { $gte: start, $lte: end },
      status: 'skipped'
    });
    
    // Get late doses (approximate by checking if actualTime > scheduledTime + 30 minutes)
    const lateDoses = await this.countDocuments({
      user: userObjectId,
      scheduledTime: { $gte: start, $lte: end },
      status: 'taken',
      takenLate: true
    });
    
    // Calculate rates
    const adherenceRate = totalDoses > 0 ? (takenDoses / totalDoses) * 100 : 0;
    const takenRate = totalDoses > 0 ? (takenDoses / totalDoses) * 100 : 0;
    const takenOnTimeRate = totalDoses > 0 ? ((takenDoses - lateDoses) / totalDoses) * 100 : 0;
    const takenLateRate = totalDoses > 0 ? (lateDoses / totalDoses) * 100 : 0;
    const missedRate = totalDoses > 0 ? (missedDoses / totalDoses) * 100 : 0;
    const skippedRate = totalDoses > 0 ? (skippedDoses / totalDoses) * 100 : 0;
    
    return {
      totalDoses,
      takenDoses,
      missedDoses,
      skippedDoses,
      lateDoses,
      adherenceRate,
      takenRate,
      takenOnTimeRate,
      takenLateRate,
      missedRate,
      skippedRate
    };
  } catch (error) {
    console.error('Error in getAdherenceStats:', error);
    return {
      totalDoses: 0,
      takenDoses: 0,
      missedDoses: 0,      skippedDoses: 0,      lateDoses: 0,
      adherenceRate: 0,
      takenRate: 0,
      takenOnTimeRate: 0,
      takenLateRate: 0,
      missedRate: 0,
      skippedRate: 0
    };
  }
};

// Get adherence statistics
doseLogSchema.statics.getAdherenceStats = async function(userId, startDate, endDate) {
  try {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Get all scheduled doses in the time period
    const totalDoses = await this.countDocuments({
      user: userObjectId,
      scheduledTime: { $gte: start, $lte: end }
    });
    
    // Get taken doses (both on time and late)
    const takenDoses = await this.countDocuments({
      user: userObjectId,
      scheduledTime: { $gte: start, $lte: end },
      status: 'taken'
    });
    
    // Get taken doses that were on time
    const takenOnTimeDoses = await this.countDocuments({
      user: userObjectId,
      scheduledTime: { $gte: start, $lte: end },
      status: 'taken',
      takenLate: { $ne: true }
    });
    
    // Get taken doses that were late
    const takenLateDoses = await this.countDocuments({
      user: userObjectId,
      scheduledTime: { $gte: start, $lte: end },
      status: 'taken',
      takenLate: true
    });
    
    // Get missed doses
    const missedDoses = await this.countDocuments({
      user: userObjectId,
      scheduledTime: { $gte: start, $lte: end },
      status: 'missed'
    });
    
    // Get skipped doses
    const skippedDoses = await this.countDocuments({
      user: userObjectId,
      scheduledTime: { $gte: start, $lte: end },
      status: 'skipped'
    });
    
    // Calculate rates
    const adherenceRate = totalDoses > 0 ? (takenDoses / totalDoses) * 100 : 0;
    const takenRate = totalDoses > 0 ? (takenDoses / totalDoses) * 100 : 0;
    const takenOnTimeRate = totalDoses > 0 ? (takenOnTimeDoses / totalDoses) * 100 : 0;
    const takenLateRate = totalDoses > 0 ? (takenLateDoses / totalDoses) * 100 : 0;
    const missedRate = totalDoses > 0 ? (missedDoses / totalDoses) * 100 : 0;
    const skippedRate = totalDoses > 0 ? (skippedDoses / totalDoses) * 100 : 0;
    
    return {
      totalDoses,
      takenDoses,
      takenOnTimeDoses,
      takenLateDoses,
      missedDoses,
      skippedDoses,
      adherenceRate,
      takenRate,
      takenOnTimeRate,
      takenLateRate,
      missedRate,
      skippedRate
    };
  } catch (error) {
    console.error('Error calculating adherence stats:', error);
    return {
      totalDoses: 0,
      takenDoses: 0,
      takenOnTimeDoses: 0,
      takenLateDoses: 0,
      missedDoses: 0,
      skippedDoses: 0,
      adherenceRate: 0,
      takenRate: 0,
      takenOnTimeRate: 0,
      takenLateRate: 0,
      missedRate: 0,
      skippedRate: 0
    };
  }
};

// Get streak information
doseLogSchema.statics.getStreakInfo = async function(userId) {
  try {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
      // Get daily adherence data for the past year
    const dailyData = await this.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          scheduledTime: { $gte: startOfYear }
        }
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$scheduledTime' }
            }
          },
          totalDoses: { $sum: 1 },
          takenDoses: {
            $sum: {
              $cond: [{ $eq: ['$status', 'taken'] }, 1, 0]
            }
          },
          missedDoses: {
            $sum: {
              $cond: [{ $eq: ['$status', 'missed'] }, 1, 0]
            }
          }
        }
      },
      {
        $addFields: {
          isPerfect: {
            $cond: [
              { $eq: ['$missedDoses', 0] },
              true,
              false
            ]
          },
          date: '$_id.date'
        }
      },
      {
        $sort: { date: 1 }
      }
    ]);
    
    // Process streak information
    let currentStreak = 0;
    let bestStreak = 0;
    let totalPerfectDays = 0;
    let tempStreak = 0;
    
    // Convert to map for easier lookup
    const dateMap = new Map();
    dailyData.forEach(day => {
      dateMap.set(day.date, day.isPerfect);
      if (day.isPerfect) totalPerfectDays++;
    });
    
    // Calculate current streak (consecutive perfect days up to today)
    const today_str = today.toISOString().split('T')[0];
    let currentDate = new Date(today);
    
    // Check if today has entries and is perfect
    if (dateMap.has(today_str)) {
      if (dateMap.get(today_str)) {
        currentStreak = 1;
      }
    }
    
    // Count backward from yesterday
    for (let i = 1; i <= 365; i++) {
      currentDate.setDate(currentDate.getDate() - 1);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      if (!dateMap.has(dateStr) || !dateMap.get(dateStr)) {
        break;
      }
      
      currentStreak++;
    }
    
    // Calculate best streak
    dailyData.forEach((day, i) => {
      if (day.isPerfect) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });
    
    return {
      currentStreak,
      bestStreak,
      totalPerfectDays
    };
  } catch (error) {
    console.error('Error calculating streak info:', error);
    return {
      currentStreak: 0,
      bestStreak: 0,
      totalPerfectDays: 0
    };
  }
};

module.exports = mongoose.model('DoseLog', doseLogSchema);
