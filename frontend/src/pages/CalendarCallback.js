import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, LoadingSpinner, Alert } from '../components';
import { calendarService } from '../services/calendarService';

const CalendarCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Connecting to Google Calendar...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const state = searchParams.get('state');

        if (error) {
          throw new Error(`Google Calendar authorization failed: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received from Google');
        }

        // Handle the OAuth callback
        const result = await calendarService.handleCallback(code);
        
        setStatus('success');
        setMessage('Google Calendar connected successfully!');        // Notify parent window if opened in popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_CALENDAR_AUTH_SUCCESS',
            calendars: result.calendars
          }, window.location.origin);
          
          // Add automatic refresh for the parent window
          setTimeout(() => {
            window.opener.location.reload();
          }, 500);
          
          window.close();
          return;
        }

        // Redirect after 2 seconds if not in popup and refresh the page
        setTimeout(() => {
          navigate('/settings?tab=calendar', { 
            state: { message: 'Google Calendar connected successfully!' }
          });
          // Also refresh the page to ensure UI updates
          window.location.reload();
        }, 2000);

      } catch (error) {
        console.error('Calendar callback error:', error);
        setStatus('error');
        setMessage(error.message || 'Failed to connect Google Calendar');

        // Notify parent window if opened in popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_CALENDAR_AUTH_ERROR',
            error: error.message
          }, window.location.origin);
          window.close();
          return;
        }

        // Redirect after 3 seconds if not in popup
        setTimeout(() => {
          navigate('/settings?tab=calendar');
        }, 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  const getIcon = () => {
    switch (status) {
      case 'processing':
        return <LoadingSpinner size="lg" />;
      case 'success':
        return (
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8">
        <div className="text-center">
          {getIcon()}
          
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            Google Calendar Integration
          </h3>
          
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {message}
          </p>

          {status === 'success' && (
            <Alert
              type="success"
              message="You can now sync your medication schedule with Google Calendar!"
              className="mt-4"
            />
          )}

          {status === 'error' && (
            <Alert
              type="error"
              message="Please try connecting again from the Settings page."
              className="mt-4"
            />
          )}

          {status === 'processing' && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Please wait while we establish the connection...
              </p>
            </div>
          )}

          {status !== 'processing' && !window.opener && (
            <div className="mt-6">
              <button
                onClick={() => navigate('/settings?tab=calendar')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-medical-600 hover:bg-medical-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-medical-500"
              >
                Go to Settings
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CalendarCallback;
