# Fix Google OAuth "Access Denied" Error

## Problem
You're getting this error: 
```
misogo has not completed the Google verification process
Error 403: access_denied
```

This happens because your Google OAuth consent screen is in "Testing" mode and your email isn't added as a test user.

## Solution: Add Test Users

### Step 1: Go to Google Cloud Console
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (`spheric-camera-436214-n7`)

### Step 2: Configure OAuth Consent Screen
1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. You should see your app in "Testing" mode

### Step 3: Add Test Users
1. Scroll down to **"Test users"** section
2. Click **"+ ADD USERS"**
3. Add your email: `harigunnala01@gmail.com`
4. Click **"SAVE"**

### Step 4: Alternative - Publish the App (Optional)
If you want anyone to use it (not recommended for development):
1. Click **"PUBLISH APP"** button
2. **⚠️ Warning**: This will make your app public and requires Google review for sensitive scopes

## Recommended Approach for Development

**Keep it in Testing mode** and just add your test users. This is safer for development.

### Test Users to Add:
- `harigunnala01@gmail.com` (your email)
- Add any other emails you want to test with

## After Adding Test Users

1. **Save the changes** in Google Cloud Console
2. **Wait 5-10 minutes** for changes to propagate
3. **Try the OAuth flow again** from your app
4. You should now be able to authorize successfully

## Quick Test Steps

1. Go to your app: https://quiet-daffodil-293b8e.netlify.app/settings
2. Click "Connect" under Google Calendar Integration
3. You should now see the Google authorization screen
4. Grant permissions
5. You should be redirected back successfully

## If Still Having Issues

1. **Clear browser cache/cookies** for Google accounts
2. **Try incognito/private browsing mode**
3. **Check that the email is exactly the same** in test users and the one you're logging in with
4. **Wait a bit longer** - Google changes can take up to 15 minutes to propagate
