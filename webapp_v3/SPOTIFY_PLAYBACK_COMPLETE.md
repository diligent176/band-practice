# Spotify Playback - Implementation Complete ✅

## What's Been Implemented

The Spotify Web Playback SDK integration is now complete and ready for testing. This enables unlimited users to play music directly in the browser using their Spotify Premium accounts.

### Frontend Components

1. **SpotifyPlayer Module** (`static/js/spotify_player.js`)

   - OAuth connection flow with popup window
   - Spotify Web Playback SDK initialization
   - Playback controls (play, pause, seek, volume)
   - State management and UI updates
   - Premium account detection
   - Fallback for non-Premium users

2. **PlayerManager Integration** (`static/js/player.js`)

   - Automatic SpotifyPlayer initialization on song load
   - Play/pause toggle with real Spotify controls
   - Progress bar click-to-seek
   - Restart track (seek to 0)
   - Mute/unmute toggle
   - Skip forward/backward (5 seconds)
   - Spotify connection prompt UI
   - Real-time progress updates

3. **UI Components** (`templates/home.html`)

   - Spotify connection prompt card
   - Progress bar with clickable seek
   - Play/pause button with dynamic icon
   - Time display (current/duration)
   - Styled connection card with Spotify branding

4. **Styling** (`static/css/player.css`)
   - Spotify connection prompt overlay
   - Connection card with Spotify green (#1DB954)
   - Hover effects and animations

### Backend Components

1. **SpotifyPlaybackService** (`services/spotify_playback_service_v3.py`)

   - OAuth URL generation
   - Token exchange and refresh
   - Token storage in Firestore (`spotify_tokens_v3` collection)
   - Premium status checking
   - Automatic token refresh (5-min buffer)

2. **API Endpoints** (`app.py`)
   - `GET /api/v3/spotify/auth-url` - Get OAuth URL
   - `GET /api/v3/spotify/callback` - Handle OAuth callback
   - `GET /api/v3/spotify/token` - Get current token (auto-refresh)
   - `POST /api/v3/spotify/disconnect` - Remove tokens

### Firestore Structure

```
spotify_tokens_v3/
  {uid}/
    uid: string
    access_token: string
    refresh_token: string
    expires_at: timestamp
    scopes: array<string>
    updated_at: timestamp
```

## Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```bash
# Required for Spotify Web Playback SDK
SPOTIFY_PLAYBACK_REDIRECT_URI=http://127.0.0.1:8080/api/v3/spotify/callback

# Already configured for playlist import
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
```

### 2. Spotify Developer Dashboard

1. Go to https://developer.spotify.com/dashboard
2. Select your app or create a new one
3. Click "Edit Settings"
4. Add these Redirect URIs:
   - **Local Dev**: `http://127.0.0.1:8080/api/v3/spotify/callback`
   - **Production**: `https://your-domain.com/api/v3/spotify/callback`
5. Save changes

### 3. Required Scopes

The app requests these Spotify scopes:

- `streaming` - Play music in browser
- `user-read-email` - Get user email
- `user-read-private` - Check Premium status
- `user-read-playback-state` - Read playback state
- `user-modify-playback-state` - Control playback

## Testing Checklist

### Prerequisites

- [ ] Spotify Premium account (required for Web Playback SDK)
- [ ] `.env` configured with correct redirect URI
- [ ] Spotify Developer Dashboard updated with redirect URIs
- [ ] Flask app running on `http://127.0.0.1:8080`

### Test Flow

1. **Connect Spotify**

   - [ ] Log into Band Practice Pro v3
   - [ ] Navigate to a song (Songs → click any song)
   - [ ] See "Connect Spotify" prompt if not connected
   - [ ] Click "Connect Spotify" button
   - [ ] Popup window opens with Spotify login
   - [ ] Log in with Spotify Premium account
   - [ ] Popup closes automatically
   - [ ] Toast shows "Spotify connected!"
   - [ ] Connection prompt disappears

2. **Playback Controls**

   - [ ] Click Play button (or press Space) - Music starts playing
   - [ ] Play button icon changes to Pause icon
   - [ ] Progress bar shows current position
   - [ ] Time displays update (e.g., "0:12 / 3:45")
   - [ ] Click Pause button - Music pauses
   - [ ] Click progress bar to seek - Position jumps

3. **Keyboard Shortcuts** (all working from v2)

   - [ ] `Space` - Play/Pause
   - [ ] `T` - Restart track (seek to 0:00)
   - [ ] `M` - Mute/Unmute
   - [ ] `←` - Skip backward 5 seconds
   - [ ] `→` - Skip forward 5 seconds
   - [ ] `B` - Previous song
   - [ ] `F` - Next song

4. **Song Navigation**

   - [ ] Press `F` to go to next song - New song loads and plays
   - [ ] Press `B` to go to previous song - Previous song loads and plays
   - [ ] Playback continues seamlessly

5. **Edge Cases**
   - [ ] Song without `spotify_uri` - Shows error toast
   - [ ] Non-Premium user - Shows warning, fallback options
   - [ ] Token expiry (wait 1 hour) - Auto-refreshes transparently
   - [ ] Network error - Shows error toast, doesn't crash

## How It Works

### Connection Flow

1. User clicks "Connect Spotify"
2. Frontend calls `/api/v3/spotify/auth-url`
3. Backend generates OAuth URL with scopes
4. Popup opens to Spotify login
5. User authorizes app
6. Spotify redirects to `/api/v3/spotify/callback?code=...`
7. Backend exchanges code for tokens
8. Backend checks Premium status
9. Backend saves tokens to Firestore
10. Backend sends success message to popup
11. Popup closes, posts message to parent window
12. Frontend initializes Spotify Web Playback SDK

### Playback Flow

1. User loads a song in Player view
2. PlayerManager calls `SpotifyPlayer.init()`
3. SpotifyPlayer checks for saved token
4. If token exists, loads Spotify SDK
5. SDK creates virtual "device" (Band Practice Pro)
6. Device shows in Spotify Connect devices
7. User clicks Play
8. Frontend calls `SpotifyPlayer.play(song.spotify_uri)`
9. Spotify Web API starts playback on our device
10. SDK streams audio directly to browser
11. State updates flow to UI every 500ms

### Token Management

- Tokens stored per-user in `spotify_tokens_v3/{uid}`
- Access token valid for 1 hour
- Refresh token never expires
- Backend auto-refreshes with 5-min buffer
- No manual refresh needed by user

## Architecture Benefits

✅ **Unlimited Users** - No 25-user quota (Web Playback SDK)
✅ **No Approval Needed** - Just OAuth scopes
✅ **Browser-Based** - No native app required
✅ **Full Control** - Play, pause, seek, volume in your app
✅ **Spotify Connect** - Shows as device in Spotify app
✅ **Premium Detection** - Graceful fallback for Free users
✅ **Secure** - Tokens stored in Firestore with security rules
✅ **Reliable** - Auto token refresh, error handling

## Troubleshooting

### "Spotify player not ready"

- Check browser console for SDK errors
- Verify Premium account
- Ensure redirect URI matches exactly

### "Failed to connect Spotify"

- Check Spotify Developer Dashboard redirect URIs
- Verify `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
- Check browser console for CORS errors

### "No Spotify track for this song"

- Song missing `spotify_uri` field
- Import playlist to populate Spotify URIs

### Playback doesn't start

- Check browser console for errors
- Verify Premium account
- Try disconnecting and reconnecting Spotify
- Check Spotify service status

## Next Steps (Optional Enhancements)

- [ ] Volume slider in UI
- [ ] Shuffle and repeat controls
- [ ] Queue management
- [ ] Playlist playback (not just single songs)
- [ ] Lyrics sync with playback position
- [ ] Spotify device picker (switch between devices)
- [ ] Download for offline (Premium feature)

## Files Modified/Created

### New Files

- `webapp_v3/services/spotify_playback_service_v3.py` - Backend OAuth service
- `webapp_v3/static/js/spotify_player.js` - Frontend SDK integration
- `webapp_v3/SPOTIFY_PLAYBACK_COMPLETE.md` - This document

### Modified Files

- `webapp_v3/app.py` - Added 4 Spotify endpoints
- `webapp_v3/static/js/player.js` - Integrated playback controls
- `webapp_v3/templates/home.html` - Added connection prompt UI, script tag
- `webapp_v3/static/css/player.css` - Styled connection prompt
- `.env.example` - Added `SPOTIFY_PLAYBACK_REDIRECT_URI`

## Production Deployment Notes

1. Update `SPOTIFY_PLAYBACK_REDIRECT_URI` to production URL
2. Add production redirect URI to Spotify Developer Dashboard
3. Ensure Firestore security rules allow read/write to `spotify_tokens_v3`
4. Test with multiple users to verify no quota issues
5. Monitor token refresh logs for any errors

---

**Status**: ✅ Complete and ready for testing
**Date**: November 20, 2025
**Version**: Band Practice Pro v3
