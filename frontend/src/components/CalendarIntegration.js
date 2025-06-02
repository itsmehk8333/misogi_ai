import React, { useState, useEffect } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { Alert } from './Alert';
import { LoadingSpinner } from './LoadingSpinner';
import { calendarService } from '../services/calendarService';
import { notificationService } from '../services/notificationService';

const CalendarIntegration = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState({
    syncEnabled: true,
    reminderMinutes: [10, 60],
    calendarId: 'primary',
    autoSync: true
  });
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [availableCalendars, setAvailableCalendars] = useState([]);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      setLoading(true);
      const status = await calendarService.getConnectionStatus();
      setIsConnected(status.isConnected);
      setConnectionInfo(status);
      if (status.settings) {
        setSettings(status.settings);
      }
    } catch (error) {
      console.error('Failed to check calendar status:', error);
      notificationService.showToast('error', 'Failed to check calendar connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const { authUrl } = await calendarService.getAuthUrl();
      
      // Open Google OAuth in a new window
      const popup = window.open(
        authUrl,
        'googleCalendarAuth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for the callback
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setConnecting(false);
          // Check if connection was successful
          setTimeout(checkConnectionStatus, 1000);
        }
      }, 1000);

      // Handle postMessage from popup (if implementing custom callback handling)
      const handleMessage = (event) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'GOOGLE_CALENDAR_AUTH_SUCCESS') {
          popup.close();
          setIsConnected(true);
          setAvailableCalendars(event.data.calendars || []);
          notificationService.showToast('success', 'Google Calendar connected successfully!');
          checkConnectionStatus();
        } else if (event.data.type === 'GOOGLE_CALENDAR_AUTH_ERROR') {
          popup.close();
          notificationService.showToast('error', 'Failed to connect Google Calendar');
        }
      };

      window.addEventListener('message', handleMessage);
      
      // Cleanup listener when popup closes
      const cleanup = setInterval(() => {
        if (popup.closed) {
          clearInterval(cleanup);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to initiate Google Calendar connection:', error);
      notificationService.showToast('error', 'Failed to connect to Google Calendar');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await calendarService.disconnectCalendar();
      setIsConnected(false);
      setConnectionInfo(null);
      notificationService.showToast('success', 'Google Calendar disconnected');
    } catch (error) {
      console.error('Failed to disconnect calendar:', error);
      notificationService.showToast('error', 'Failed to disconnect Google Calendar');
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      const result = await calendarService.syncAllRegimens();
      notificationService.showToast('success', result.message);
    } catch (error) {
      console.error('Failed to sync regimens:', error);
      notificationService.showToast('error', 'Failed to sync medication schedule to calendar');
    } finally {
      setSyncing(false);
    }
  };

  const handleSettingsUpdate = async (newSettings) => {
    try {
      await calendarService.updateCalendarSettings(newSettings);
      setSettings(newSettings);
      notificationService.showToast('success', 'Calendar settings updated');
    } catch (error) {
      console.error('Failed to update settings:', error);
      notificationService.showToast('error', 'Failed to update calendar settings');
    }
  };

  const handleReminderChange = (minutes, checked) => {
    const newReminders = checked 
      ? [...settings.reminderMinutes, minutes].sort((a, b) => a - b)
      : settings.reminderMinutes.filter(m => m !== minutes);
    
    handleSettingsUpdate({
      ...settings,
      reminderMinutes: newReminders
    });
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-gray-600 dark:text-gray-400">
            Checking calendar connection...
          </span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Google Calendar Integration
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Sync your medication schedule with Google Calendar for reminders
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
          }`}>
            {isConnected ? 'Connected' : 'Not Connected'}
          </div>
        </div>

        {isConnected ? (
          <div className="space-y-4">
            <Alert
              type="success"
              message={`Connected since ${new Date(connectionInfo?.connectedAt).toLocaleDateString()}`}
            />
            
            <div className="flex space-x-3">
              <Button
                onClick={handleSyncAll}
                disabled={syncing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {syncing ? 'Syncing...' : 'Sync All Medications'}
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert
              type="info"
              message="Connect your Google Calendar to automatically create medication reminders"
            />
            
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {connecting ? 'Connecting...' : 'Connect Google Calendar'}
            </Button>
          </div>
        )}
      </Card>

      {/* Calendar Settings */}
      {isConnected && (
        <Card className="p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Calendar Settings
          </h4>
          
          <div className="space-y-6">
            {/* Sync Enabled */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Calendar Sync
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Automatically sync new medications to calendar
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.syncEnabled}
                onChange={(e) => handleSettingsUpdate({
                  ...settings,
                  syncEnabled: e.target.checked
                })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>

            {/* Auto Sync */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto Sync
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Automatically sync when medications are updated
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoSync}
                onChange={(e) => handleSettingsUpdate({
                  ...settings,
                  autoSync: e.target.checked
                })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>

            {/* Calendar Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Calendar
              </label>
              <select
                value={settings.calendarId}
                onChange={(e) => handleSettingsUpdate({
                  ...settings,
                  calendarId: e.target.value
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="primary">Primary Calendar</option>
                {availableCalendars.map(calendar => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.summary}
                  </option>
                ))}
              </select>
            </div>

            {/* Reminder Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Calendar Reminders
              </label>
              <div className="space-y-2">
                {[
                  { minutes: 5, label: '5 minutes before' },
                  { minutes: 10, label: '10 minutes before' },
                  { minutes: 15, label: '15 minutes before' },
                  { minutes: 30, label: '30 minutes before' },
                  { minutes: 60, label: '1 hour before' },
                  { minutes: 120, label: '2 hours before' }
                ].map(({ minutes, label }) => (
                  <div key={minutes} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`reminder-${minutes}`}
                      checked={settings.reminderMinutes.includes(minutes)}
                      onChange={(e) => handleReminderChange(minutes, e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor={`reminder-${minutes}`}
                      className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card className="p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          How it works
        </h4>
        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p>• Your medication schedule will appear as events in your Google Calendar</p>
          <p>• Each medication dose gets its own calendar event with reminders</p>
          <p>• Events are automatically updated when you modify your medication schedule</p>
          <p>• Calendar reminders work alongside app notifications for maximum reliability</p>
          <p>• You can customize reminder timing to suit your needs</p>
        </div>
      </Card>
    </div>
  );
};

export default CalendarIntegration;
