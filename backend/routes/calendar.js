const express = require('express');
const { google } = require('googleapis');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Regimen = require('../models/Regimen');
const DoseLog = require('../models/DoseLog');

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
    });

    res.json({ authUrl });
  } catch (error) {
    console.error('Google auth URL error:', error);
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
      }))
    });
  } catch (error) {
    console.error('Google callback error:', error);
    res.status(500).json({ message: 'Failed to connect Google Calendar' });
  }
});

// @route   GET /api/calendar/status
// @desc    Check Google Calendar connection status
// @access  Private
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    const isConnected = user.googleCalendar?.isConnected && 
                       user.googleCalendar?.accessToken &&
                       (!user.googleCalendar?.tokenExpiry || user.googleCalendar.tokenExpiry > Date.now());

    res.json({
      isConnected,
      connectedAt: user.googleCalendar?.connectedAt,
      settings: user.googleCalendar?.settings || {
        syncEnabled: true,
        reminderMinutes: [10, 60],
        calendarId: 'primary'
      }
    });
  } catch (error) {
    console.error('Calendar status error:', error);
    res.status(500).json({ message: 'Failed to check calendar status' });
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
    }).populate('medication');

    if (!regimen) {
      return res.status(404).json({ message: 'Regimen not found' });
    }

    const user = await User.findById(req.user._id);
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

    for (const event of events) {
      try {
        const response = await calendar.events.insert({
          calendarId,
          resource: event
        });
        createdEvents.push({
          googleEventId: response.data.id,
          scheduledTime: event.start.dateTime,
          regimen: regimen._id
        });
      } catch (eventError) {
        console.error('Failed to create calendar event:', eventError);
      }
    }

    // Update regimen with calendar sync info
    await Regimen.findByIdAndUpdate(regimen._id, {
      'calendarSync.isEnabled': true,
      'calendarSync.lastSyncAt': new Date(),
      'calendarSync.eventIds': createdEvents.map(e => e.googleEventId)
    });

    res.json({
      message: `Successfully synced ${createdEvents.length} events to Google Calendar`,
      eventsCreated: createdEvents.length
    });
  } catch (error) {
    console.error('Sync regimen error:', error);
    res.status(500).json({ message: 'Failed to sync regimen to calendar' });
  }
});

// @route   POST /api/calendar/sync-all
// @desc    Sync all active regimens to Google Calendar
// @access  Private
router.post('/sync-all', auth, async (req, res) => {
  try {
    // First check if user has calendar connected
    const user = await User.findById(req.user._id);
    if (!user.googleCalendar?.isConnected) {
      return res.status(400).json({ message: 'Google Calendar not connected' });
    }

    // Validate OAuth credentials
    if (!user.googleCalendar.accessToken) {
      return res.status(400).json({ message: 'Invalid calendar credentials. Please reconnect.' });
    }

    const regimens = await Regimen.find({
      user: req.user._id,
      isActive: true
    }).populate('medication');

    if (regimens.length === 0) {
      return res.json({
        message: 'No active regimens found to sync',
        totalEvents: 0,
        results: []
      });
    }    // Set a reasonable timeout for large sync operations
    const syncTimeout = setTimeout(() => {
      console.warn(`Calendar sync for user ${req.user._id} taking longer than expected`);
    }, 45000); // Warn after 45 seconds

    let totalEvents = 0;
    const results = [];

    try {
      // Process regimens with improved error handling and limits
      console.log(`Starting sync for ${regimens.length} regimens...`);
      
      // Chunk regimens into smaller batches to avoid overwhelming the API
      const chunkSize = 3; // Process 3 regimens at a time
      const chunks = [];
      for (let i = 0; i < regimens.length; i += chunkSize) {
        chunks.push(regimens.slice(i, i + chunkSize));
      }
      
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} regimens...`);
        
        // Process each regimen in the chunk
        for (let i = 0; i < chunk.length; i++) {
          const regimen = chunk[i];
          
          try {
            console.log(`Syncing regimen ${(chunkIndex * chunkSize) + i + 1}/${regimens.length}: ${regimen.medication.name}`);
            
            // Call sync-regimen logic for each regimen with timeout protection
            const syncResult = await Promise.race([
              syncSingleRegimen(regimen, req.user._id),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Regimen sync timeout')), 15000) // 15 second timeout per regimen
              )
            ]);
            
            results.push({
              regimenId: regimen._id,
              medicationName: regimen.medication.name,
              eventsCreated: syncResult.eventsCreated,
              success: true
            });
            totalEvents += syncResult.eventsCreated;
            
          } catch (error) {
            console.error(`Failed to sync regimen ${regimen.medication.name}:`, error.message);
            results.push({
              regimenId: regimen._id,
              medicationName: regimen.medication.name,
              eventsCreated: 0,
              success: false,
              error: error.message
            });
          }
          
          // Add small delay between regimens within chunk to avoid API rate limits
          if (i < chunk.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        // Add delay between chunks to avoid overwhelming the API
        if (chunkIndex < chunks.length - 1) {
          console.log(`Completed chunk ${chunkIndex + 1}/${chunks.length}, waiting before next chunk...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } finally {
      clearTimeout(syncTimeout);
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Calendar sync completed for user ${req.user._id}: ${successCount} success, ${failureCount} failed`);

    res.json({
      message: `Sync completed: ${totalEvents} total events created (${successCount}/${regimens.length} regimens synced successfully)`,
      totalEvents,
      successCount,
      failureCount,
      results
    });
  } catch (error) {
    console.error('Sync all error:', error);
    
    // Provide more specific error messages
    if (error.message.includes('invalid_grant')) {
      return res.status(401).json({ 
        message: 'Calendar access expired. Please reconnect your Google Calendar.',
        reconnectRequired: true
      });
    }
    
    if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
      return res.status(408).json({ 
        message: 'Calendar sync timed out. Please try again or sync regimens individually.',
        suggestion: 'Try syncing regimens one at a time from the Settings page.'
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to sync regimens to calendar',
      error: error.message
    });
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
    });

    if (!regimen) {
      return res.status(404).json({ message: 'Regimen not found' });
    }

    const user = await User.findById(req.user._id);
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

    // Delete existing events
    const eventIds = regimen.calendarSync?.eventIds || [];
    let deletedCount = 0;

    for (const eventId of eventIds) {
      try {
        await calendar.events.delete({
          calendarId,
          eventId
        });
        deletedCount++;
      } catch (error) {
        console.error('Failed to delete calendar event:', error);
      }
    }

    // Update regimen to remove calendar sync
    await Regimen.findByIdAndUpdate(regimen._id, {
      $unset: { calendarSync: 1 }
    });

    res.json({
      message: `Removed ${deletedCount} events from Google Calendar`,
      eventsDeleted: deletedCount
    });
  } catch (error) {
    console.error('Remove regimen error:', error);
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
    });

    res.json({ message: 'Calendar settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
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
    });

    res.json({ message: 'Google Calendar disconnected successfully' });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ message: 'Failed to disconnect Google Calendar' });
  }
});

// @route   GET /api/calendar/upcoming
// @desc    Get upcoming medication events from Google Calendar
// @access  Private
router.get('/upcoming', auth, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const user = await User.findById(req.user._id);

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
      orderBy: 'startTime'
    });

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
    console.error('Get upcoming events error:', error);
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

// Helper function to sync a single regimen (for sync-all)
async function syncSingleRegimen(regimen, userId) {
  try {
    const user = await User.findById(userId);
    if (!user.googleCalendar?.isConnected || !user.googleCalendar.accessToken) {
      throw new Error('Calendar not connected or invalid credentials');
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: user.googleCalendar.accessToken,
      refresh_token: user.googleCalendar.refreshToken
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const calendarId = user.googleCalendar.settings?.calendarId || 'primary';    // Generate events for the next 14 days (reduced from 30 for faster sync)
    const events = generateCalendarEvents(regimen, 14);
    const createdEvents = [];
    const maxRetries = 3;

    // Limit events to prevent overwhelming the API (max 30 events per regimen)
    const eventsToCreate = events.slice(0, 30);
    
    console.log(`Creating ${eventsToCreate.length} calendar events for ${regimen.medication.name}`);

    for (let i = 0; i < eventsToCreate.length; i++) {
      const event = eventsToCreate[i];
      let retryCount = 0;
      let success = false;

      while (retryCount < maxRetries && !success) {
        try {
          const response = await calendar.events.insert({
            calendarId,
            resource: event,
            // Add timeout to prevent hanging
            timeout: 5000
          });
          
          createdEvents.push(response.data.id);
          success = true;
          
          // Add small delay between events to avoid rate limits
          if (i < eventsToCreate.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (error) {
          retryCount++;
          console.error(`Failed to create calendar event (attempt ${retryCount}):`, error.message);
          
          if (error.code === 403 && error.message.includes('Rate Limit')) {
            // Rate limit hit, wait longer
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          } else if (error.code === 401 || error.message.includes('invalid_grant')) {
            // Authentication issue, stop trying
            throw new Error('Calendar authentication expired. Please reconnect.');
          } else if (retryCount >= maxRetries) {
            console.error(`Max retries reached for event creation. Skipping.`);
            break;
          } else {
            // Other error, wait and retry
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }
    }

    // Update regimen with calendar sync info
    await Regimen.findByIdAndUpdate(regimen._id, {
      'calendarSync.isEnabled': true,
      'calendarSync.lastSyncAt': new Date(),
      'calendarSync.eventIds': createdEvents
    });

    console.log(`Successfully created ${createdEvents.length}/${eventsToCreate.length} events for ${regimen.medication.name}`);
    
    return { eventsCreated: createdEvents.length };
  } catch (error) {
    console.error(`Error syncing regimen ${regimen.medication.name}:`, error);
    throw error;
  }
}

module.exports = router;
