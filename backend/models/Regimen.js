const mongoose = require('mongoose');

const regimenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  medication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    required: true
  },
  // User-defined category for organization
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  // Support for family member tracking
  patientInfo: {
    name: { type: String, trim: true }, // For family members
    relationship: String, // 'self', 'child', 'parent', 'spouse', etc.
    isPatient: { type: Boolean, default: true }
  },
  dosage: {
    amount: {
      type: Number,
      required: [true, 'Dosage amount is required']
    },
    unit: {
      type: String,
      required: [true, 'Dosage unit is required'],
      enum: ['tablet', 'capsule', 'ml', 'mg', 'g', 'tsp', 'tbsp', 'puff', 'drop', 'patch']
    }
  },
  frequency: {
    type: String,
    required: [true, 'Frequency is required'],
    enum: ['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'every_other_day', 'weekly', 'as_needed', 'custom']
  },
  customSchedule: [{
    time: {
      type: String, // Format: "HH:MM"
      required: function() {
        return this.frequency === 'custom';
      }
    },
    label: String // e.g., "Morning", "Afternoon", "Evening", "Bedtime"
  }],
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    default: Date.now
  },
  endDate: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v > this.startDate;
      },
      message: 'End date must be after start date'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  prescribedBy: {
    name: String,
    contactInfo: String,
    specialty: String
  },
  purpose: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  // Enhanced reminders
  reminders: {
    enabled: {
      type: Boolean,
      default: true
    },
    timesBefore: [{
      type: Number, // minutes before scheduled time
      default: [30, 10] // 30 minutes and 10 minutes before
    }],
    methods: [{
      type: String,
      enum: ['app', 'email', 'sms', 'calendar'],
      default: ['app']
    }],
    calendarEventId: String // For Google Calendar integration
  },
  adherenceGoal: {
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 80
    }
  },
  refillReminder: {
    enabled: {
      type: Boolean,
      default: true
    },
    daysBeforeEmpty: {
      type: Number,
      default: 7
    },
    currentStock: {
      type: Number,
      default: 0
    }
  },
  // Tracking fields
  adherenceHistory: [{
    date: Date,
    percentage: Number,
    totalDoses: Number,
    takenDoses: Number
  }],
  lastDoseTime: Date,
  nextDueTime: Date,
  
  // Calendar Sync Integration
  calendarSync: {
    isEnabled: { type: Boolean, default: false },
    provider: { type: String, enum: ['google', 'outlook'], default: 'google' },
    calendarId: String,
    eventIds: [String], // Array of calendar event IDs
    lastSyncAt: Date,
    syncErrors: [{
      error: String,
      timestamp: { type: Date, default: Date.now }
    }],
    autoSync: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Index for efficient querying
regimenSchema.index({ user: 1, isActive: 1 });
regimenSchema.index({ user: 1, startDate: 1, endDate: 1 });

// Virtual for getting current schedule times based on frequency
regimenSchema.virtual('scheduleTimes').get(function() {
  if (this.frequency === 'custom') {
    return this.customSchedule.map(item => item.time);
  }
  
  const schedules = {
    'once_daily': ['08:00'],
    'twice_daily': ['08:00', '20:00'],
    'three_times_daily': ['08:00', '14:00', '20:00'],
    'four_times_daily': ['08:00', '12:00', '16:00', '20:00'],
    'every_other_day': ['08:00'],
    'weekly': ['08:00'],
    'as_needed': []
  };
  
  return schedules[this.frequency] || [];
});

// Method to check if regimen is currently active
regimenSchema.methods.isCurrentlyActive = function() {
  const now = new Date();
  const isWithinDateRange = now >= this.startDate && (!this.endDate || now <= this.endDate);
  return this.isActive && isWithinDateRange;
};

// Method to get next dose time
regimenSchema.methods.getNextDoseTime = function() {
  if (!this.isCurrentlyActive()) return null;
  
  const now = new Date();
  const times = this.scheduleTimes;
  
  if (times.length === 0) return null;
  
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                     now.getMinutes().toString().padStart(2, '0');
  
  // Find next time today
  const nextTimeToday = times.find(time => time > currentTime);
  
  if (nextTimeToday) {
    const [hours, minutes] = nextTimeToday.split(':');
    const nextDose = new Date(now);
    nextDose.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return nextDose;
  }
  
  // If no more times today, get first time tomorrow
  if (times.length > 0) {
    const [hours, minutes] = times[0].split(':');
    const nextDose = new Date(now);
    nextDose.setDate(nextDose.getDate() + 1);
    nextDose.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return nextDose;
  }
  
  return null;
};

module.exports = mongoose.model('Regimen', regimenSchema);
