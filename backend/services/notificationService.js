const nodemailer = require('nodemailer');
const webpush = require('web-push'); // Enable web-push for push notifications
const User = require('../models/User');
const DoseLog = require('../models/DoseLog');

// Configure email transporter
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Configure web push when VAPID keys are available
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      'mailto:' + (process.env.EMAIL_USER || 'noreply@medtracker.com'),
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    console.log('Web push configured successfully');
  } catch (error) {
    console.warn('Failed to configure web push - invalid VAPID keys:', error.message);
    console.log('Push notifications will be disabled until valid VAPID keys are provided');
    // Don't throw error, just disable push notifications
  }
} else {
  console.warn('VAPID keys not found - push notifications will be disabled');
}

const notificationService = {  // Send email notification
  sendEmail: async (to, subject, html, text) => {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('Email service not configured');
        return { success: false, message: 'Email service not configured' };
      }

      const transporter = createEmailTransporter();
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject,
        html,
        text
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Email sending failed:', error);
      
      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.code === 'EAUTH') {
        errorMessage = 'Email authentication failed. Please check if you are using an App Password for Gmail (not your regular password). Visit https://support.google.com/accounts/answer/185833 to create an App Password.';
      }
      
      return { success: false, error: errorMessage };
    }
  },  // Send push notification
  sendPushNotification: async (subscription, payload) => {
    try {
      if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.warn('Push notification service not configured - VAPID keys missing');
        return { success: false, message: 'Push notification service not configured - VAPID keys missing' };
      }

      if (!subscription || !subscription.endpoint) {
        console.warn('Invalid push subscription provided');
        return { success: false, message: 'Invalid push subscription provided' };
      }

      // Check if webpush is properly configured by testing the VAPID details
      try {
        const result = await webpush.sendNotification(subscription, JSON.stringify(payload));
        console.log('Push notification sent successfully');
        return { success: true, result };
      } catch (vapidError) {
        if (vapidError.message.includes('Vapid') || vapidError.message.includes('VAPID')) {
          console.warn('VAPID configuration error:', vapidError.message);
          return { success: false, message: 'Push notification service misconfigured - invalid VAPID keys' };
        }
        throw vapidError; // Re-throw if it's not a VAPID error
      }
    } catch (error) {
      console.error('Push notification failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Send dose reminder notification
  sendDoseReminder: async (userId, dose, minutesUntil = 0) => {
    try {
      const user = await User.findById(userId);
      if (!user) return { success: false, message: 'User not found' };

      const medicationName = dose.regimen?.medication?.name || dose.medication?.name || 'Medication';
      const dosage = dose.dosage || `${dose.regimen?.dosage?.amount} ${dose.regimen?.dosage?.unit}`;
      
      let subject, message;
      if (minutesUntil <= 0) {
        subject = `Time to take your ${medicationName}`;
        message = `It's time to take your ${medicationName} (${dosage})`;
      } else {
        subject = `${medicationName} reminder`;
        message = `Don't forget to take your ${medicationName} (${dosage}) in ${minutesUntil} minutes`;
      }

      const results = [];

      // Send email notification if enabled
      if (user.settings?.notifications?.email && user.email) {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">${subject}</h2>
            <p>${message}</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Medication Details:</h3>
              <p><strong>Name:</strong> ${medicationName}</p>
              <p><strong>Dosage:</strong> ${dosage}</p>
              <p><strong>Scheduled Time:</strong> ${new Date(dose.scheduledTime).toLocaleString()}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              This is an automated reminder from MisoGiao. 
              Please log into your account to mark this dose as taken.
            </p>
          </div>
        `;
        
        const emailResult = await notificationService.sendEmail(
          user.email,
          subject,
          html,
          message
        );
        results.push({ type: 'email', ...emailResult });
      }

      // Send push notification if enabled and subscription exists
      if (user.settings?.notifications?.push && user.pushSubscription) {
        const payload = {
          title: subject,
          body: message,
          icon: '/medication-icon.png',
          badge: '/medication-badge.png',
          data: {
            doseId: dose._id,
            medicationName,
            scheduledTime: dose.scheduledTime
          }
        };

        const pushResult = await notificationService.sendPushNotification(
          user.pushSubscription,
          payload
        );
        results.push({ type: 'push', ...pushResult });
      }

      return { success: true, results };
    } catch (error) {
      console.error('Dose reminder notification failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Send overdue dose notification
  sendOverdueNotification: async (userId, dose) => {
    try {
      const user = await User.findById(userId);
      if (!user) return { success: false, message: 'User not found' };

      const medicationName = dose.regimen?.medication?.name || dose.medication?.name || 'Medication';
      const minutesLate = Math.floor((new Date() - new Date(dose.scheduledTime)) / (1000 * 60));
      
      const subject = `${medicationName} is overdue`;
      const message = `Your ${medicationName} is ${minutesLate} minutes overdue. Please take it when possible.`;

      const results = [];

      // Send email notification if enabled
      if (user.settings?.notifications?.email && user.email) {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">${subject}</h2>
            <p>${message}</p>
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h3>Overdue Medication:</h3>
              <p><strong>Name:</strong> ${medicationName}</p>
              <p><strong>Was scheduled for:</strong> ${new Date(dose.scheduledTime).toLocaleString()}</p>
              <p><strong>Minutes late:</strong> ${minutesLate}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
              Please log into your account to mark this dose as taken or missed.
            </p>
          </div>
        `;
        
        const emailResult = await notificationService.sendEmail(
          user.email,
          subject,
          html,
          message
        );
        results.push({ type: 'email', ...emailResult });
      }

      // Send push notification if enabled
      if (user.settings?.notifications?.push && user.pushSubscription) {
        const payload = {
          title: subject,
          body: message,
          icon: '/medication-icon.png',
          badge: '/medication-badge.png',
          tag: 'overdue',
          data: {
            doseId: dose._id,
            medicationName,
            scheduledTime: dose.scheduledTime,
            minutesLate
          }
        };

        const pushResult = await notificationService.sendPushNotification(
          user.pushSubscription,
          payload
        );
        results.push({ type: 'push', ...pushResult });
      }

      return { success: true, results };
    } catch (error) {
      console.error('Overdue notification failed:', error);
      return { success: false, error: error.message };
    }
  },

  // Check for upcoming doses and send reminders
  checkUpcomingDoses: async () => {
    try {
      const users = await User.find({
        'settings.notifications.email': true
      }).select('_id email settings');

      for (const user of users) {
        const reminderMinutes = user.settings?.notifications?.reminderMinutes || 15;
        const reminderTime = new Date(Date.now() + reminderMinutes * 60 * 1000);
        
        // Find doses that are due within the reminder window
        const upcomingDoses = await DoseLog.find({
          userId: user._id,
          scheduledTime: {
            $gte: new Date(),
            $lte: reminderTime
          },
          status: 'pending'
        }).populate('regimen').populate('regimen.medication');

        for (const dose of upcomingDoses) {
          const minutesUntil = Math.floor((new Date(dose.scheduledTime) - new Date()) / (1000 * 60));
          await notificationService.sendDoseReminder(user._id, dose, minutesUntil);
        }
      }
    } catch (error) {
      console.error('Check upcoming doses failed:', error);
    }
  },

  // Check for overdue doses
  checkOverdueDoses: async () => {
    try {
      const overdueDoses = await DoseLog.find({
        scheduledTime: { $lt: new Date() },
        status: 'pending'
      }).populate('userId').populate('regimen').populate('regimen.medication');

      for (const dose of overdueDoses) {
        if (dose.userId) {
          await notificationService.sendOverdueNotification(dose.userId._id, dose);
        }
      }
    } catch (error) {
      console.error('Check overdue doses failed:', error);
    }
  }
};

module.exports = notificationService;
