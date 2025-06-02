import { apiClient, handleApiResponse, handleApiError } from './api';
import toast from 'react-hot-toast';

export const notificationService = {
  // Get pending notifications
  getNotifications: async () => {
    try {
      const response = await apiClient.get('/notifications');
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Mark notification as read
  markAsRead: async (notificationId) => {
    try {
      const response = await apiClient.patch(`/notifications/${notificationId}/read`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get upcoming dose reminders
  getUpcomingReminders: async (minutesAhead = 60) => {
    try {
      const response = await apiClient.get('/notifications/upcoming', {
        params: { minutes: minutesAhead }
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Snooze a reminder
  snoozeReminder: async (reminderId, snoozeMinutes = 15) => {
    try {
      const response = await apiClient.patch(`/notifications/reminders/${reminderId}/snooze`, {
        minutes: snoozeMinutes
      });
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Dismiss a reminder
  dismissReminder: async (reminderId) => {
    try {
      const response = await apiClient.patch(`/notifications/reminders/${reminderId}/dismiss`);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update notification preferences
  updatePreferences: async (preferences) => {
    try {
      const response = await apiClient.put('/notifications/preferences', preferences);
      return handleApiResponse(response);
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Show in-app notification using react-hot-toast
  showToast: (type, message, options = {}) => {
    const toastOptions = {
      duration: options.duration || 5000,
      position: options.position || 'top-right',
      ...options
    };

    switch (type) {
      case 'success':
        return toast.success(message, toastOptions);
      case 'error':
        return toast.error(message, toastOptions);
      case 'loading':
        return toast.loading(message, toastOptions);
      case 'reminder':
        return toast(message, {
          ...toastOptions,
          icon: '💊',
          style: {
            background: '#dbeafe',
            color: '#1e40af',
            border: '1px solid #60a5fa'
          }
        });
      default:
        return toast(message, toastOptions);
    }
  },

  // Show dose reminder notification
  showDoseReminder: (dose, minutesUntil = 0) => {
    const medicationName = dose.regimen?.medication?.name || dose.medication?.name || 'Medication';
    const dosage = dose.dosage || `${dose.regimen?.dosage?.amount} ${dose.regimen?.dosage?.unit}`;
    
    let message;
    if (minutesUntil <= 0) {
      message = `Time to take your ${medicationName} (${dosage})`;
    } else {
      message = `${medicationName} reminder: Due in ${minutesUntil} minutes`;
    }

    return notificationService.showToast('reminder', message, {
      duration: 8000,
      action: {
        label: 'Mark Taken',
        onClick: () => {
          // This will be handled by the component that shows the notification
          return true;
        }
      }
    });
  },
  // Request browser notification permission
  requestPermission: async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  },
  // Convert base64 string to Uint8Array for VAPID key
  base64ToUint8Array: (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  },
  // Subscribe to push notifications
  subscribeToPush: async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Push messaging is not supported in this browser');
      }

      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;
      console.log('Service worker ready for push subscription');
      
      // Get VAPID public key from server
      const response = await apiClient.get('/notifications/vapid-key');
      const { vapidPublicKey } = handleApiResponse(response);
      
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not received from server');
      }
      
      console.log('VAPID public key received from server');

      // Convert base64 VAPID key to Uint8Array
      const applicationServerKey = notificationService.base64ToUint8Array(vapidPublicKey);
      console.log('VAPID key converted to Uint8Array');      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });
      
      console.log('Push subscription created successfully:', subscription);

      // Properly serialize the subscription for the server
      const subscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.getKey('p256dh') ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))) : null,
          auth: subscription.getKey('auth') ? btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))) : null
        }
      };

      console.log('Subscription data prepared for server:', subscriptionData);

      // Send subscription to server
      await apiClient.post('/notifications/subscribe', { subscription: subscriptionData });
      console.log('Push subscription sent to server successfully');

      return { success: true, subscription };
    } catch (error) {
      console.error('Push subscription failed:', error);
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.message.includes('not supported')) {
        errorMessage = 'Push notifications are not supported in this browser. Please use Chrome, Firefox, or Safari.';
      } else if (error.message.includes('applicationServerKey')) {
        errorMessage = 'Invalid server configuration for push notifications. Please contact support.';
      } else if (error.message.includes('permission')) {
        errorMessage = 'Push notification permission was denied. Please allow notifications in your browser settings.';
      }
      
      throw new Error(errorMessage);
    }
  },

  // Unsubscribe from push notifications
  unsubscribeFromPush: async () => {
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers not supported');
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await apiClient.delete('/notifications/subscribe');
      }

      return { success: true };
    } catch (error) {
      console.error('Push unsubscribe failed:', error);
      throw handleApiError(error);
    }
  },

  // Check if push notifications are supported and subscribed
  isPushSupported: () => {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  },
  // Get current push subscription status
  getPushSubscription: async () => {
    try {
      if (!notificationService.isPushSupported()) {
        console.log('Push notifications not supported');
        return null;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        console.log('Found existing push subscription:', subscription.endpoint);
      } else {
        console.log('No existing push subscription found');
      }
      
      return subscription;
    } catch (error) {
      console.error('Get push subscription failed:', error);
      return null;
    }
  },

  // Show browser notification
  showBrowserNotification: (title, options = {}) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        icon: '/medication-icon.png', // Add this icon to public folder
        badge: '/medication-badge.png',
        ...options
      });

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    }
    return null;
  },

  // Check for overdue doses and show notifications
  checkOverdueDoses: async () => {
    try {
      const response = await apiClient.get('/notifications/overdue');
      const overdueDoses = handleApiResponse(response);
      
      overdueDoses.forEach(dose => {
        const minutesLate = Math.floor((new Date() - new Date(dose.scheduledTime)) / (1000 * 60));
        const medicationName = dose.regimen?.medication?.name || dose.medication?.name;
        
        notificationService.showToast('error', 
          `${medicationName} is ${minutesLate} minutes overdue`, 
          {
            duration: 10000,
            id: `overdue-${dose._id}` // Prevent duplicate notifications
          }
        );
      });
      
      return overdueDoses;
    } catch (error) {
      console.error('Failed to check overdue doses:', error);
      return [];
    }
  }
};

export default notificationService;
