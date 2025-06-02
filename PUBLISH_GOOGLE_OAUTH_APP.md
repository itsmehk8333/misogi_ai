# How to Publish Google OAuth App for All Users

## Current Issue
Your Google OAuth app is in "Testing" mode, which only allows specific test users. You want to make it available to all users.

## Solution: Publish the App

### Step 1: Go to OAuth Consent Screen
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `spheric-camera-436214-n7`
3. Navigate to **"APIs & Services"** → **"OAuth consent screen"**

### Step 2: Complete Required Information

Before publishing, make sure you have filled out all required sections:

#### **App Information** (Required)
- ✅ App name: `MedTracker` (or your preferred name)
- ✅ User support email: `harigunnala01@gmail.com`
- ✅ App logo: Upload a logo (optional but recommended)
- ✅ Developer contact information: `harigunnala01@gmail.com`

#### **Scopes** (Important)
1. Click **"ADD OR REMOVE SCOPES"**
2. Add these Google Calendar scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
3. Click **"UPDATE"**

#### **Optional Info** (Recommended)
- App domain: `quiet-daffodil-293b8e.netlify.app`
- Privacy Policy URL: You may need to create one
- Terms of Service URL: You may need to create one

### Step 3: Publish the App
1. After completing all sections, you should see a **"PUBLISH APP"** button
2. Click **"PUBLISH APP"**
3. Confirm that you want to make it public

### Step 4: Verification (If Required)
- For sensitive scopes like Calendar, Google may require verification
- If prompted, follow the verification process
- This can take a few days for Google to review

## Alternative: Quick Fix for Development

If you don't want to go through the full publishing process right now, here's a quicker solution:

### Option A: Use External User Type (Unverified)
1. In OAuth consent screen, make sure **User Type** is set to **"External"**
2. Keep it in "Testing" mode but the app will work for any Google account
3. Users will see a warning but can still proceed

### Option B: Add Specific Test Users
1. In the OAuth consent screen
2. Look for **"Test users"** section (it might be at the bottom)
3. Add your email: `harigunnala01@gmail.com`
4. Save changes

## What Users Will See

### If Published:
- Clean authorization screen
- No warnings
- Professional appearance

### If Not Published (Testing):
- Warning: "This app hasn't been verified by Google"
- Users can click "Advanced" → "Go to MedTracker (unsafe)"
- Still works, just with warnings

## Recommended Approach

For development/testing:
1. ✅ Keep in "Testing" mode
2. ✅ Set User Type to "External" 
3. ✅ Add necessary scopes
4. ✅ Users can still access with warnings

For production:
1. ✅ Complete all required information
2. ✅ Publish the app
3. ✅ Go through verification if required

## Testing After Changes

1. **Clear browser cache** for Google accounts
2. **Try incognito/private browsing**
3. **Test the OAuth flow** from your app
4. **Accept any warnings** if still in testing mode

The key is making sure your **User Type is "External"** - this allows any Google user to access your app, even in testing mode.
