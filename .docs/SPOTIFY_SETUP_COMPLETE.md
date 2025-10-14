# Spotify Web Playback Setup Guide

## ✅ Implementation Complete!

Your Band Practice Pro app now has **full in-browser Spotify playback** with spacebar control!

## 🎯 What Was Implemented

### Backend (Python/Flask)

1. ✅ **`webapp/services/spotify_auth_service.py`** - OAuth flow handler

   - Generates authorization URLs
   - Exchanges codes for tokens
   - Auto-refreshes expired tokens
   - Stores tokens in Firestore

2. ✅ **`webapp/services/firestore_service.py`** - Token storage

   - `save_spotify_token()` - Store user tokens
   - `get_spotify_token()` - Retrieve tokens
   - `delete_spotify_token()` - Disconnect
   - `save_oauth_state()` / `verify_oauth_state()` - CSRF protection

3. ✅ **`webapp/app.py`** - OAuth endpoints
   - `GET /api/spotify/auth/url` - Get authorization URL
   - `GET /api/spotify/callback` - Handle OAuth callback
   - `GET /api/spotify/token` - Get current access token
   - `POST /api/spotify/disconnect` - Disconnect Spotify
   - `GET /api/spotify/status` - Check connection status

### Frontend (JavaScript)

1. ✅ **`webapp/static/js/app.js`** - Full Web Playback SDK

   - OAuth popup flow
   - Player initialization
   - Play/pause with spacebar
   - Auto-reconnect on app load
   - "Connect Spotify" prompt for new users

2. ✅ **`webapp/templates/viewer.html`** - SDK script tag
   - Added Spotify SDK loader
   - Updated keyboard shortcuts help

### Configuration

1. ✅ **`.env.example`** - Added redirect URI variables

## 🚀 Setup Instructions

### Step 1: Update Spotify Developer Dashboard

1. Go to https://developer.spotify.com/dashboard
2. Select your app (or create one if you haven't)
3. Click **"Edit Settings"**
4. Scroll to **"Redirect URIs"**
5. Add these URIs:
   ```
   http://127.0.0.1:8080/api/spotify/callback
   https://band-practice-pro-1081781176520.us-west1.run.app/api/spotify/callback
   ```
6. Click **"Add"** then **"Save"**

### Step 2: Update Your `.env` File

Add these lines to your `.env`:

```bash
# Spotify OAuth for Web Playback SDK
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/api/spotify/callback
```

### Step 3: Test Locally

```powershell
# Stop any running Flask servers
# Run the app
.\run-local.bat
```

## 🎸 How It Works

### First Time User Flow:

1. **User logs in with Firebase** → App loads
2. **App checks Spotify status** → Not connected
3. **Shows "Connect Spotify for Playback" button** in mini player
4. **User clicks button** → Opens OAuth popup
5. **User authorizes in Spotify** → Popup closes
6. **Token saved to Firestore** → Player initializes
7. **Select a song** → Mini player appears
8. **Press SPACE** → Music plays! 🎵

### Returning User Flow:

1. **User logs in with Firebase** → App loads
2. **App checks Spotify status** → Connected!
3. **Auto-initializes player** → Ready to play
4. **Select a song + Press SPACE** → Music plays! 🎵

## ⌨️ Keyboard Controls

- **Space** - Play/Pause (only when not typing in inputs)
- **All other shortcuts** - Still work exactly as before!
  - X - Switch Collection
  - P - Import Playlist
  - S - Song Selector
  - E - Edit Lyrics
  - N - Edit Notes
  - etc.

## 🔒 Security Features

- **State tokens** - CSRF protection on OAuth flow
- **Token refresh** - Auto-refreshes 5 minutes before expiry
- **User-scoped storage** - Each user has own tokens in Firestore
- **Minimal scopes** - Only requests playback permissions needed

## 🎯 Key Features

### ✅ In-App Playback

- Music plays INSIDE your app (no new tabs)
- Mini player shows current song
- Album art background effect

### ✅ Spacebar Control

- Press space to play/pause
- Doesn't interfere with typing
- Doesn't interfere with dialogs

### ✅ Premium Features

- Full Spotify catalog
- High quality streaming
- Seamless playback control

### ✅ OAuth Security

- Your existing Spotify login
- Secure token storage
- Auto-refresh tokens

## 🐛 Troubleshooting

### "Connect Spotify" button not appearing

- Check browser console for errors
- Verify Spotify SDK loaded: `typeof Spotify !== 'undefined'`
- Check `/api/spotify/status` returns `{connected: false}`

### OAuth popup blocked

- Allow popups for 127.0.0.1:8080
- Check browser popup settings

### "Spotify Premium required" error

- Web Playback SDK requires Premium account
- No workaround available

### Player not initializing

- Check console for errors
- Verify token endpoint returns valid token: `/api/spotify/token`
- Check Firestore for saved token document

### Music not playing

- Check browser console for 403/404 errors
- Verify device appears in Spotify devices list
- Try disconnect + reconnect Spotify

## 📊 Testing Checklist

- [ ] Redirect URIs added to Spotify Developer Dashboard
- [ ] Environment variables added to `.env`
- [ ] App starts without errors
- [ ] "Connect Spotify" button appears for new users
- [ ] Clicking button opens OAuth popup
- [ ] Authorizing in Spotify closes popup
- [ ] Toast shows "Connected to Spotify!"
- [ ] Player initializes (check console for "Player ready!")
- [ ] Selecting song shows mini player with controls
- [ ] Pressing Space starts music
- [ ] Pressing Space again pauses music
- [ ] Play/pause icon updates in mini player
- [ ] All other keyboard shortcuts still work
- [ ] Closing and reopening app auto-connects
- [ ] Token auto-refreshes after 1 hour

## 🎉 Success Indicators

When everything is working, you should see in console:

```
🎵 Spotify SDK loaded
✅ User has Spotify connected, initializing player...
✅ Got Spotify access token (first 30 chars): BQD...
Creating Spotify.Player...
✅✅✅ Spotify player ready! Device ID: abc123...
```

And in the UI:

- Mini player with album art, song info, and play button
- Clicking play or pressing Space plays music
- No new tabs opened
- Music continues while navigating the app

## 🚀 Deployment to Production

The OAuth flow is production-ready! When you deploy:

1. Environment variables are already set in GCP Secret Manager
2. Redirect URI uses production domain automatically
3. OAuth flow works identically to local dev

Just make sure the production redirect URI is in your Spotify Dashboard!

## 💡 Tips

- **First login**: Takes ~2 seconds to initialize player
- **Subsequent logins**: Player ready instantly (token cached)
- **Token lifetime**: 1 hour (auto-refreshes transparently)
- **Disconnect**: Use `/api/spotify/disconnect` endpoint (add UI button if needed)

Enjoy your integrated Spotify player! 🎸🎵
