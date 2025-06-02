import React, { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import { doseService } from '../services/doseService';
import Button from './Button';

const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleDoseAction = async (dose, action) => {
    try {
      const regimenId = dose.regimen?._id || dose.regimen;
      const timestamp = dose.scheduledTime || new Date();

      switch (action) {
        case 'taken':
          await doseService.markDoseTaken(regimenId, timestamp);
          notificationService.showToast('success', 'Dose marked as taken!');
          break;
        case 'missed':
          await doseService.markDoseMissed(regimenId, timestamp);
          notificationService.showToast('info', 'Dose marked as missed');
          break;
        case 'snooze':
          notificationService.showToast('info', 'Reminder snoozed for 15 minutes');
          break;
        default:
          break;
      }
      fetchNotifications();
    } catch (error) {
      console.error('Failed to perform dose action:', error);
      notificationService.showToast('error', 'Failed to update dose status');
    }
  };

  const getNotificationBg = (type) => {
    switch (type) {
      case 'dose_reminder':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'dose_overdue':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'refill_reminder':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'achievement':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'dose_reminder': return '💊';
      case 'dose_overdue': return '⚠️';
      case 'refill_reminder': return '📦';
      case 'achievement': return '🏆';
      default: return '🔔';
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 dark:bg-red-600 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Notifications
            </h3>
          </div>

          <div className="max-h-[32rem] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v1M9 7h1m-1 4h1m4-4h1m-1 4h1" />
                </svg>
                <p>No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`p-4 border-b last:border-b-0 ${getNotificationBg(notification.type)} ${
                    !notification.isRead ? 'font-medium' : ''
                  }`}
                  onClick={() => !notification.isRead && markAsRead(notification._id)}
                >
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">{getNotificationIcon(notification.type)}</span>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white">
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                          {notification.message}
                        </p>
                      )}
                      
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {new Date(notification.createdAt).toLocaleTimeString()}
                      </p>

                      {/* Dose Action Buttons */}
                      {notification.type === 'dose_reminder' && notification.doseData && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDoseAction(notification.doseData, 'taken');
                            }}
                          >
                            Mark Taken
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDoseAction(notification.doseData, 'snooze');
                            }}
                          >
                            Snooze 15m
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDoseAction(notification.doseData, 'missed');
                            }}
                          >
                            Mark Missed
                          </Button>
                        </div>
                      )}
                    </div>

                    {!notification.isRead && (
                      <div className="w-2 h-2 bg-medical-500 dark:bg-medical-400 rounded-full"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-25 dark:bg-opacity-50"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default NotificationCenter;
