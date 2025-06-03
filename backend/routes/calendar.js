const express = require('express');
const { google } = require('googleapis');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Regimen = require('../models/Regimen');
const DoseLog = require('../models/DoseLog');
const memoryManager = require('../utils/memoryManager');

const router = express.Router();

// OAuth2 client configuration
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL}/calendar/callback`
  );
};

// @route   GET /api/calendar/google/auth-url
// @desc    Get Google Calendar authorization URL
// @access  Private
router.get('/google/auth-url', auth, async (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();
    
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: req.user._id.toString(), // Pass user ID for security
    });    res.json({ authUrl });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate auth URL' });
  }
});

// @route   POST /api/calendar/google/callback
// @desc    Handle Google OAuth callback
// @access  Private
router.post('/google/callback', auth, [
  body('code').notEmpty().withMessage('Authorization code is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }    const { code } = req.body;
    const oauth2Client = getOAuth2Client();

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user profile to verify connection
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarList = await calendar.calendarList.list();

    // Save tokens to user
    await User.findByIdAndUpdate(req.user._id, {
      'googleCalendar.accessToken': tokens.access_token,
      'googleCalendar.refreshToken': tokens.refresh_token,
      'googleCalendar.tokenExpiry': tokens.expiry_date,
      'googleCalendar.isConnected': true,
      'googleCalendar.connectedAt': new Date()
    });

    res.json({ 
      message: 'Google Calendar connected successfully',
      calendars: calendarList.data.items.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary
      }))    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to connect Google Calendar' });
  }
});

// @route   GET /api/calendar/status
// @desc    Check Google Calendar connection status (OPTIMIZED)
// @access  Private
router.get('/status', auth, async (req, res) => {  try {
    const startTime = Date.now();
    
    // Optimized query - only fetch required fields
    const user = await User.findById(req.user._id)
      .select('googleCalendar.isConnected googleCalendar.accessToken googleCalendar.tokenExpiry googleCalendar.connectedAt googleCalendar.settings')
      .lean();
    
    // Fast connection check without unnecessary operations
    const hasValidToken = user.googleCalendar?.accessToken && 
                         (!user.googleCalendar?.tokenExpiry || user.googleCalendar.tokenExpiry > Date.now());
    const isConnected = user.googleCalendar?.isConnected && hasValidToken;

    const responseTime = Date.now() - startTime;
    memoryManager.checkMemoryAndGC();

    res.json({
      isConnected,
      connectedAt: user.googleCalendar?.connectedAt,
      settings: user.googleCalendar?.settings || {
        syncEnabled: true,
        reminderMinutes: [10, 60],
        calendarId: 'primary'
      },
      // Performance metrics
      responseTimeMs: responseTime,
      cacheRecommendation: 'cache-for-2min'
    });
  } catch (error) {
    console.error('Calendar status check error:', error);
    res.status(500).json({ 
      message: 'Failed to check calendar status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   POST /api/calendar/sync-regimen/:regimenId
// @desc    Sync a specific regimen to Google Calendar
// @access  Private
router.post('/sync-regimen/:regimenId', auth, async (req, res) => {
  try {
    const regimen = await Regimen.findOne({
      _id: req.params.regimenId,
      user: req.user._id
    })
    .populate('medication', 'name')
    .lean();

    if (!regimen) {
      return res.status(404).json({ message: 'Regimen not found' });
    }

    const user = await User.findById(req.user._id)
      .select('googleCalendar')
      .lean();
      
    if (!user.googleCalendar?.isConnected) {
      return res.status(400).json({ message: 'Google Calendar not connected' });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: user.googleCalendar.accessToken,
      refresh_token: user.googleCalendar.refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = user.googleCalendar.settings?.calendarId || 'primary';

    // Generate events for the next 30 days
    const events = generateCalendarEvents(regimen, 30);
    const createdEvents = [];

    // Process events in batches to manage memory and API rate limits
    await memoryManager.processInBatches(events, 5, async (eventBatch) => {
      const batchResults = await Promise.all(
        eventBatch.map(async (event) => {
          try {
            const response = await calendar.events.insert({
              calendarId,
              resource: event
            });
            return {
              googleEventId: response.data.id,
              scheduledTime: event.start.dateTime,
              regimen: regimen._id
            };
          } catch (eventError) {
            return null;
          }
        })
      );
      
      return batchResults.filter(result => result !== null);
    });

    // Update regimen with calendar sync info
    await Regimen.findByIdAndUpdate(regimen._id, {
      'calendarSync.isEnabled': true,
      'calendarSync.lastSyncAt': new Date(),
      'calendarSync.eventIds': createdEvents.map(e => e.googleEventId)
    });

    memoryManager.checkMemoryAndGC();

    res.json({
      message: `Successfully synced ${createdEvents.length} events to Google Calendar`,
      eventsCreated: createdEvents.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to sync regimen to calendar' });
  }
});

// @route   POST /api/calendar/sync-all
// @desc    Sync all active regimens to Google Calendar
// @access  Private
router.post('/sync-all', auth, async (req, res) => {
  try {
    memoryManager.checkMemoryAndGC();
    
    const regimens = await Regimen.find({
      user: req.user._id,
      isActive: true
    })
    .populate('medication', 'name')
    .lean();

    let totalEvents = 0;
    const results = [];

    // Process regimens in batches to manage memory
    await memoryManager.processInBatches(regimens, 3, async (regimenBatch) => {
      const batchResults = await Promise.all(
        regimenBatch.map(async (regimen) => {
          try {
            const syncResult = await syncSingleRegimen(regimen, req.user._id);
            totalEvents += syncResult.eventsCreated;
            return {
              regimenId: regimen._id,
              medicationName: regimen.medication.name,
              eventsCreated: syncResult.eventsCreated,
              success: true
            };
          } catch (error) {
            return {
              regimenId: regimen._id,
              medicationName: regimen.medication.name,
              eventsCreated: 0,
              success: false,
              error: error.message
            };
          }
        })
      );
      
      results.push(...batchResults);
      return batchResults;
    });

    memoryManager.checkMemoryAndGC();

    res.json({
      message: `Sync completed: ${totalEvents} total events created`,
      totalEvents,
      results
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to sync regimens to calendar' });
  }
});

// @route   DELETE /api/calendar/regimen/:regimenId
// @desc    Remove regimen events from Google Calendar
// @access  Private
router.delete('/regimen/:regimenId', auth, async (req, res) => {
  try {
    const regimen = await Regimen.findOne({
      _id: req.params.regimenId,
      user: req.user._id
    })
    .select('calendarSync')
    .lean();

    if (!regimen) {
      return res.status(404).json({ message: 'Regimen not found' });
    }

    const user = await User.findById(req.user._id)
      .select('googleCalendar')
      .lean();
      
    if (!user.googleCalendar?.isConnected) {
      return res.status(400).json({ message: 'Google Calendar not connected' });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: user.googleCalendar.accessToken,
      refresh_token: user.googleCalendar.refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = user.googleCalendar.settings?.calendarId || 'primary';

    // Delete existing events in batches
    const eventIds = regimen.calendarSync?.eventIds || [];
    let deletedCount = 0;

    if (eventIds.length > 0) {
      await memoryManager.processInBatches(eventIds, 5, async (eventIdBatch) => {
        const batchResults = await Promise.all(
          eventIdBatch.map(async (eventId) => {
            try {
              await calendar.events.delete({
                calendarId,
                eventId
              });
              return true;
            } catch (error) {
              return false;
            }
          })
        );
        
        const successCount = batchResults.filter(result => result).length;
        deletedCount += successCount;
        return batchResults;
      });
    }

    // Update regimen to remove calendar sync
    await Regimen.findByIdAndUpdate(regimen._id, {
      $unset: { calendarSync: 1 }
    });

    memoryManager.checkMemoryAndGC();

    res.json({
      message: `Removed ${deletedCount} events from Google Calendar`,
      eventsDeleted: deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove regimen from calendar' });
  }
});

// @route   PUT /api/calendar/settings
// @desc    Update calendar settings
// @access  Private
router.put('/settings', auth, [
  body('syncEnabled').isBoolean().withMessage('syncEnabled must be a boolean'),
  body('reminderMinutes').isArray().withMessage('reminderMinutes must be an array'),
  body('calendarId').optional().isString().withMessage('calendarId must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { syncEnabled, reminderMinutes, calendarId } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      'googleCalendar.settings': {
        syncEnabled,
        reminderMinutes,
        calendarId: calendarId || 'primary'
      }
    });    res.json({ message: 'Calendar settings updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update calendar settings' });
  }
});

// @route   DELETE /api/calendar/disconnect
// @desc    Disconnect Google Calendar
// @access  Private
router.delete('/disconnect', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: { googleCalendar: 1 }
    });    res.json({ message: 'Google Calendar disconnected successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to disconnect Google Calendar' });
  }
});

// @route   GET /api/calendar/upcoming
// @desc    Get upcoming medication events from Google Calendar
// @access  Private
router.get('/upcoming', auth, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const user = await User.findById(req.user._id)
      .select('googleCalendar')
      .lean();

    if (!user.googleCalendar?.isConnected) {
      return res.status(400).json({ message: 'Google Calendar not connected' });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: user.googleCalendar.accessToken,
      refresh_token: user.googleCalendar.refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = user.googleCalendar.settings?.calendarId || 'primary';

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const response = await calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      q: 'medication reminder', // Search for medication events
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100 // Limit results for performance
    });

    memoryManager.checkMemoryAndGC();

    res.json({
      events: response.data.items.map(event => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        reminders: event.reminders
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get upcoming events' });
  }
});

// Helper function to generate calendar events
function generateCalendarEvents(regimen, days) {
  const events = [];
  const startDate = new Date();
  const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // Get schedule times
  let scheduleTimes = [];
  if (regimen.frequency === 'custom' && regimen.customSchedule) {
    scheduleTimes = regimen.customSchedule.map(cs => cs.time);
  } else {
    const schedules = {
      'once_daily': ['08:00'],
      'twice_daily': ['08:00', '20:00'],
      'three_times_daily': ['08:00', '14:00', '20:00'],
      'four_times_daily': ['08:00', '12:00', '16:00', '20:00']
    };
    scheduleTimes = schedules[regimen.frequency] || ['08:00'];
  }

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    // Check if regimen should be taken today
    if (shouldTakeToday(regimen, currentDate)) {
      scheduleTimes.forEach(time => {
        const [hours, minutes] = time.split(':');
        const eventStart = new Date(currentDate);
        eventStart.setHours(parseInt(hours), parseInt(minutes), 0, 0);

        const eventEnd = new Date(eventStart);
        eventEnd.setMinutes(eventEnd.getMinutes() + 15); // 15-minute duration

        events.push({
          summary: `💊 ${regimen.medication.name}`,
          description: `Medication reminder: Take ${regimen.dosage.amount} ${regimen.dosage.unit} of ${regimen.medication.name}`,
          start: {
            dateTime: eventStart.toISOString(),
            timeZone: 'UTC'
          },
          end: {
            dateTime: eventEnd.toISOString(),
            timeZone: 'UTC'
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 10 },
              { method: 'popup', minutes: 60 }
            ]
          }
        });
      });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return events;
}

// Helper function to determine if regimen should be taken today
function shouldTakeToday(regimen, date) {
  const startDate = new Date(regimen.startDate);
  const daysDiff = Math.floor((date - startDate) / (1000 * 60 * 60 * 24));

  switch (regimen.frequency) {
    case 'every_other_day':
      return daysDiff % 2 === 0;
    case 'weekly':
      return daysDiff % 7 === 0;
    default:
      return true;
  }
}

// Helper function to sync a single regimen (for sync-all) - Memory optimized
async function syncSingleRegimen(regimen, userId) {
  const user = await User.findById(userId)
    .select('googleCalendar')
    .lean();
    
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.googleCalendar.accessToken,
    refresh_token: user.googleCalendar.refreshToken
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const calendarId = user.googleCalendar.settings?.calendarId || 'primary';

  const events = generateCalendarEvents(regimen, 30);
  const createdEvents = [];

  // Process events in smaller batches to manage memory
  await memoryManager.processInBatches(events, 3, async (eventBatch) => {
    const batchResults = await Promise.all(
      eventBatch.map(async (event) => {
        try {
          const response = await calendar.events.insert({
            calendarId,
            resource: event
          });
          return response.data.id;
        } catch (error) {
          return null;
        }
      })
    );
    
    const validIds = batchResults.filter(id => id !== null);
    createdEvents.push(...validIds);
    return validIds;
  });

  // Update regimen with calendar sync info
  await Regimen.findByIdAndUpdate(regimen._id, {
    'calendarSync.isEnabled': true,
    'calendarSync.lastSyncAt': new Date(),
    'calendarSync.eventIds': createdEvents
  });

  return { eventsCreated: createdEvents.length };
}

module.exports = router;
