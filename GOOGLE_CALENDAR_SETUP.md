# Google Calendar Integration Setup Guide

## Overview
This guide will help you set up Google Calendar OAuth integration for MedTracker. The error you're seeing ("OAuth client was not found") occurs because you need to create actual Google OAuth credentials.

## Step 1: Create Google Cloud Project

1. **Visit Google Cloud Console**: Go to [https://console.cloud.google.com/](https://console.cloud.google.com/)

2. **Create a New Project** (or select existing):
   - Click "Select a project" → "New Project"
   - Name: `MedTracker` (or your preferred name)
   - Click "Create"

## Step 2: Enable Google Calendar API

1. **Navigate to APIs & Services**:
   - In the sidebar, go to "APIs & Services" → "Library"

2. **Enable Calendar API**:
   - Search for "Google Calendar API"
   - Click on it and click "ENABLE"

## Step 3: Create OAuth 2.0 Credentials

1. **Go to Credentials**:
   - Navigate to "APIs & Services" → "Credentials"

2. **Create OAuth 2.0 Client ID**:
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Click "Configure Consent Screen" if prompted

3. **Configure OAuth Consent Screen**:
   - Choose "External" (unless you have a Google Workspace)
   - Fill in required fields:
     - App name: `MedTracker`
     - User support email: Your email
     - Developer contact information: Your email
   - Click "Save and Continue"
   - Skip "Scopes" for now
   - Add test users (your email) if needed
   - Click "Save and Continue"

4. **Create OAuth Client**:
   - Application type: "Web application"
   - Name: `MedTracker Web Client`
   - Authorized redirect URIs:
     ```
     https://quiet-daffodil-293b8e.netlify.app/calendar/callback
     http://localhost:3000/calendar/callback
     ```
   - Click "Create"

5. **Copy Credentials**:
   - You'll get a Client ID and Client Secret
   - **Keep these secure!**

## Step 4: Update Environment Variables

Update your `backend/.env` file with the actual credentials:

```env
# Google Calendar Integration
GOOGLE_CLIENT_ID=your-actual-client-id-here
GOOGLE_CLIENT_SECRET=your-actual-client-secret-here
GOOGLE_REDIRECT_URI=https://quiet-daffodil-293b8e.netlify.app/calendar/callback
```

## Step 5: Test the Integration

1. **Restart your backend server**:
   ```bash
   cd backend
   npm start
   ```

2. **Test Calendar Connection**:
   - Go to Settings page
   - Click "Connect" under Google Calendar Integration
   - You should be redirected to Google's authorization page
   - Grant permissions
   - You should be redirected back with success

## Troubleshooting

### Error: "OAuth client was not found"
- **Solution**: Make sure you've copied the correct Client ID and Client Secret from Google Cloud Console

### Error: "redirect_uri_mismatch"
- **Solution**: Ensure the redirect URI in Google Cloud Console exactly matches your GOOGLE_REDIRECT_URI

### Error: "access_denied"
- **Solution**: Make sure you've granted the necessary permissions in the OAuth consent screen

### Error: "invalid_scope"
- **Solution**: The backend automatically requests these scopes:
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/calendar.readonly`

## Security Notes

1. **Keep credentials secure**: Never commit your `.env` file to version control
2. **Use environment variables**: Store credentials as environment variables in production
3. **Limit scope**: Only request the calendar permissions you need
4. **Monitor usage**: Check Google Cloud Console for API usage and quotas

## Next Steps

After successful setup:
1. ✅ Connect your Google Calendar in Settings
2. ✅ Configure sync settings (auto-sync, reminder times, etc.)
3. ✅ Test syncing medications to your calendar
4. ✅ Verify calendar events appear in Google Calendar

## Support

If you encounter issues:
1. Check the browser console for detailed error messages
2. Check the backend logs for API errors
3. Verify your Google Cloud Console configuration
4. Make sure your .env file has the correct credentials
