const express = require('express');
const auth = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const User = require('../models/User');
const DoseLog = require('../models/DoseLog');

const router = express.Router();

// @route   GET /api/notifications/upcoming
// @desc    Get upcoming dose reminders
// @access  Private
router.get('/upcoming', auth, async (req, res) => {
  try {
    const minutesAhead = parseInt(req.query.minutes) || 60;
    const reminderTime = new Date(Date.now() + minutesAhead * 60 * 1000);
    
    const upcomingDoses = await DoseLog.find({
      userId: req.user._id,
      scheduledTime: {
        $gte: new Date(),
        $lte: reminderTime
      },
      status: 'pending'
    }).populate('regimen').populate('regimen.medication');

    res.json(upcomingDoses);
  } catch (error) {
    console.error('Get upcoming notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/notifications/overdue
// @desc    Get overdue doses
// @access  Private
router.get('/overdue', auth, async (req, res) => {
  try {
    const overdueDoses = await DoseLog.find({
      userId: req.user._id,
      scheduledTime: { $lt: new Date() },
      status: 'pending'
    }).populate('regimen').populate('regimen.medication');

    res.json(overdueDoses);
  } catch (error) {
    console.error('Get overdue notifications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/notifications/subscribe
// @desc    Subscribe to push notifications
// @access  Private
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Valid subscription required' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      pushSubscription: subscription
    });

    res.json({ message: 'Successfully subscribed to push notifications' });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/notifications/subscribe
// @desc    Unsubscribe from push notifications
// @access  Private
router.delete('/subscribe', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: { pushSubscription: 1 }
    });

    res.json({ message: 'Successfully unsubscribed from push notifications' });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/notifications/preferences
// @desc    Update notification preferences
// @access  Private
router.put('/preferences', auth, async (req, res) => {
  try {
    const { notifications } = req.body;
    
    if (!notifications) {
      return res.status(400).json({ message: 'Notification preferences required' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        'settings.notifications': {
          ...req.user.settings?.notifications,
          ...notifications
        }
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Notification preferences updated successfully',
      notifications: user.settings.notifications
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/notifications/test
// @desc    Test notification sending (for development)
// @access  Private
router.post('/test', auth, async (req, res) => {
  try {
    const { type } = req.body; // 'email' or 'push'
    
    if (!['email', 'push'].includes(type)) {
      return res.status(400).json({ message: 'Type must be email or push' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }    const testDose = {
      _id: 'test-dose-id',
      scheduledTime: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
      regimen: {
        medication: { 
          name: 'Aspirin 81mg',
          description: 'Daily low-dose aspirin for heart health'
        },
        dosage: { amount: 1, unit: 'tablet' },
        frequency: 'Once daily with breakfast'
      }
    };

    let result;
    
    if (type === 'email') {
      if (!user.settings?.notifications?.email) {
        return res.status(400).json({ message: 'Email notifications are disabled in your settings' });
      }
      
      if (!user.email) {
        return res.status(400).json({ message: 'No email address found in your profile' });
      }
        result = await notificationService.sendEmail(
        user.email,
        'Medication Reminder Test - MisoGiao',
        `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">🏥 Medication Reminder Test</h2>
            <p>This is a test of your medication reminder notifications.</p>
            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <h3 style="margin-top: 0; color: #1e40af;">📋 Medication Details:</h3>
              <p><strong>💊 Medication:</strong> ${testDose.regimen.medication.name}</p>
              <p><strong>💉 Dosage:</strong> ${testDose.regimen.dosage.amount} ${testDose.regimen.dosage.unit}</p>
              <p><strong>📅 Frequency:</strong> ${testDose.regimen.frequency}</p>
              <p><strong>⏰ Scheduled Time:</strong> ${testDose.scheduledTime.toLocaleString()}</p>
            </div>
            <div style="background-color: #ecfdf5; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
              <p style="margin: 0; color: #065f46;">
                ✅ <strong>Success!</strong> Your email notifications are working correctly. 
                You'll receive reminders like this for your actual medications.
              </p>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
              This is an automated test from MisoGiao - Your Medication Tracking Companion.
            </p>
          </div>
        `,
        `Medication Reminder Test - ${testDose.regimen.medication.name} (${testDose.regimen.dosage.amount} ${testDose.regimen.dosage.unit}) scheduled for ${testDose.scheduledTime.toLocaleString()}. Your email notifications are working correctly!`
      );
    } else if (type === 'push') {
      if (!user.settings?.notifications?.push) {
        return res.status(400).json({ message: 'Push notifications are disabled in your settings' });
      }
      
      if (!user.pushSubscription) {
        return res.status(400).json({ 
          message: 'No push subscription found. Please enable push notifications in your browser first.' 
        });
      }
        const payload = {
        title: '💊 Medication Reminder Test',
        body: `Time to take your ${testDose.regimen.medication.name} - This is a test notification`,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: 'medication-test',
        data: {
          type: 'medication-test',
          doseId: testDose._id,
          medicationName: testDose.regimen.medication.name,
          dosage: `${testDose.regimen.dosage.amount} ${testDose.regimen.dosage.unit}`,
          scheduledTime: testDose.scheduledTime.toISOString(),
          timestamp: new Date().toISOString()
        },
        actions: [
          {
            action: 'mark-taken',
            title: '✅ Mark as Taken'
          },
          {
            action: 'snooze',
            title: '⏰ Remind me in 10 min'
          }
        ]
      };
      
      result = await notificationService.sendPushNotification(user.pushSubscription, payload);
    }

    if (result.success) {
      res.json({
        message: `Test ${type} notification sent successfully!`,
        result
      });
    } else {
      res.status(500).json({
        message: `Failed to send test ${type} notification`,
        error: result.error || result.message
      });
    }
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ 
      message: 'Server error while sending test notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// @route   GET /api/notifications/vapid-key
// @desc    Get VAPID public key for push notifications
// @access  Public
router.get('/vapid-key', (req, res) => {
  try {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    
    if (!vapidPublicKey) {
      return res.status(500).json({ message: 'VAPID key not configured' });
    }

    res.json({ vapidPublicKey });
  } catch (error) {
    console.error('Get VAPID key error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
