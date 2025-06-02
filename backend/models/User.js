const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  username: {
    type: String,
    unique: true,
    default: function() { return this.email; }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },  phone: {
    type: String,
    trim: true
  },
  pushSubscription: {
    endpoint: String,
    keys: {
      p256dh: String,
      auth: String
    }
  },
  // Family/Category support
  familyGroup: {
    name: { type: String, trim: true },
    role: { 
      type: String, 
      enum: ['admin', 'caregiver', 'patient'], 
      default: 'patient' 
    },
    members: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
      relationship: String,
      canViewMedications: { type: Boolean, default: false },
      canLogDoses: { type: Boolean, default: false }
    }]
  },
  // User categories for medication organization
  medicationCategories: [{
    name: { type: String, required: true },
    color: { type: String, default: '#3B82F6' },
    description: String
  }],
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      reminderMinutes: { type: Number, default: 15 }
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    timezone: {
      type: String,
      default: () => Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    lateLoggingWindow: {
      type: Number,
      default: 240 // 4 hours in minutes
    },
    autoMarkMissed: {
      type: Boolean,
      default: true
    },
    calendarIntegration: {
      enabled: { type: Boolean, default: false },
      calendarId: String,
      syncType: { type: String, enum: ['google', 'outlook'], default: 'google' }
    }
  },
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      reminderMinutes: { type: Number, default: 15 }
    },
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'light'
      },
      timezone: {
        type: String,
        default: () => Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      lateLoggingWindow: {
        type: Number,
        default: 240 // 4 hours in minutes
      },
      autoMarkMissed: {
        type: Boolean,
        default: true
      }
    },
    privacy: {
      shareData: { type: Boolean, default: false },
      analytics: { type: Boolean, default: true }
    }
  },
  adherenceStats: {
    totalDoses: { type: Number, default: 0 },
    takenDoses: { type: Number, default: 0 },
    missedDoses: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },  rewards: {
    points: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    badges: [String],
    achievements: [{
      name: String,
      description: String,
      earnedAt: Date,
      icon: String
    }]
  },
  // Additional reward tracking fields
  totalRewardPoints: { type: Number, default: 0 },
  lastDailyRewardClaim: { type: Date },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  
  // Google Calendar Integration
  googleCalendar: {
    isConnected: { type: Boolean, default: false },
    accessToken: String,
    refreshToken: String,
    tokenExpiry: Date,
    connectedAt: Date,
    settings: {
      syncEnabled: { type: Boolean, default: true },
      reminderMinutes: { type: [Number], default: [10, 60] },
      calendarId: { type: String, default: 'primary' },
      autoSync: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get full name virtual
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Update adherence stats method
userSchema.methods.updateAdherenceStats = function(taken, missed) {
  this.adherenceStats.totalDoses += (taken + missed);
  this.adherenceStats.takenDoses += taken;
  this.adherenceStats.missedDoses += missed;
  this.adherenceStats.lastUpdated = new Date();
  
  // Calculate streak (simplified - could be more complex)
  if (taken > 0 && missed === 0) {
    this.adherenceStats.streakDays += 1;
  } else if (missed > 0) {
    this.adherenceStats.streakDays = 0;
  }
  
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
