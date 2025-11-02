# Gmail Direct OAuth Setup Guide

This guide will help you set up the Direct Gmail OAuth integration, which allows your application to send emails via Gmail API without requiring a Nango subscription.

## Prerequisites

- Google Cloud Console account
- Access to your Supabase project

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID for reference

## Step 2: Enable Gmail API

1. In your Google Cloud project, go to **APIs & Services** > **Library**
2. Search for "Gmail API"
3. Click on it and click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** user type (or Internal if using Google Workspace)
3. Fill in the required information:
   - **App name**: Your application name
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Under **Authorized domains**, add:
   - `supabase.co`
5. Click **Save and Continue**

### Add OAuth Scopes

1. On the **Scopes** page, click **Add or Remove Scopes**
2. Add the following scopes:
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.compose`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
3. Click **Update** and **Save and Continue**

### Test Users (if app is not verified)

1. If your app is in testing mode, add test users
2. Add email addresses that will be allowed to connect
3. Click **Save and Continue**

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Choose **Web application** as the application type
4. Enter a name (e.g., "Gmail Direct OAuth")

### Configure Authorized Redirect URIs

**IMPORTANT**: Add the following redirect URI (replace `kgndpwzqohepotahnfeo` with your Supabase project ID):

```
https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/gmail-oauth-callback
```

For your project, the redirect URI is:
```
https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/gmail-oauth-callback
```

### Configure Authorized JavaScript Origins (Optional)

You can add your app's domain if needed:
```
https://your-app-domain.com
```

5. Click **Create**
6. **Copy the Client ID and Client Secret** - you'll need these next!

## Step 5: Add Credentials to Supabase

The Client ID and Client Secret have already been added to your Supabase secrets as:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

These secrets are now available to your edge functions.

## Step 6: Test the Connection

1. Go to your app's **Integrations** page (`/integrations`)
2. Find the **Gmail (Direct)** card
3. Click **Connect**
4. A popup window will open
5. Sign in with your Google account
6. Grant the requested permissions
7. The popup will close automatically
8. You should see "Gmail connected successfully!"

## Troubleshooting

### "Access blocked: This app's request is invalid"

This means the redirect URI is not correctly configured. Double-check that:
- The redirect URI exactly matches: `https://kgndpwzqohepotahnfeo.supabase.co/functions/v1/gmail-oauth-callback`
- There are no extra spaces or characters
- The protocol is `https://`

### "Popup blocked"

- Enable popups for your site in your browser settings
- Look for a popup blocked icon in your browser's address bar

### "This app hasn't been verified by Google"

This is normal for apps in testing mode. You can:
1. Click "Advanced"
2. Click "Go to [Your App Name] (unsafe)"
3. Grant permissions

To remove this warning, submit your app for Google verification (only needed for production).

### "Failed to get auth URL"

- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correctly set in Supabase secrets
- Verify the edge functions are deployed

## Configuration Options

You can enable/disable different Gmail integrations in `src/config/email-providers.ts`:

```typescript
export const EMAIL_PROVIDER_CONFIG = {
  nango_enabled: true,        // Enable Nango-based Gmail
  gmail_direct_enabled: true, // Enable Direct Gmail OAuth
  default_gmail: 'direct',    // Which one to show by default
  show_both_gmail_options: false, // Show both options
}
```

## Production Considerations

Before launching to production:

1. **App Verification**: Submit your app to Google for verification to remove the "unverified app" warning
2. **Rate Limits**: Be aware of Gmail API quotas:
   - 1 billion quota units per day
   - Each email send = 100 units = 10,000 emails per day per user
3. **Token Refresh**: The system automatically refreshes expired tokens
4. **Security**: Tokens are stored encrypted in your Supabase database with RLS policies

## Support

For issues with:
- Google Cloud Console: [Google Cloud Support](https://cloud.google.com/support)
- Supabase: Check the [Supabase Docs](https://supabase.com/docs)
- This integration: Check the edge function logs in your Supabase dashboard

## Next Steps

Once Gmail is connected:
1. Send test emails from the Integrations page
2. Create email sequences in the Sequences page
3. Monitor email activity in the Campaigns page
4. Check email health metrics

---

**Note**: This Direct Gmail integration is completely independent from Nango. You can use it without any Nango subscription and later switch to Nango if needed by adjusting the config file.
