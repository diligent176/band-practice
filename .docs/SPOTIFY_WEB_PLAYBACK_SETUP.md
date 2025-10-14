# Spotify Web Playback SDK Setup

## Overview

The Spotify Web Playback SDK allows in-browser music playback but requires:

- **Spotify Premium account** (required for SDK)
- **User OAuth** with specific scopes (not client credentials)
- Redirect URI configured in Spotify Developer Dashboard

## Current Setup vs Required Setup

### Current (Client Credentials - Read Only)

```python
# In lyrics_service.py
SpotifyClientCredentials(
    client_id=os.getenv('SPOTIFY_CLIENT_ID'),
    client_secret=os.getenv('SPOTIFY_CLIENT_SECRET')
)
```

✅ Can read playlists, tracks, metadata
❌ Cannot control playback
❌ No user context

### Required (Authorization Code - User OAuth)

```python
SpotifyOAuth(
    client_id=os.getenv('SPOTIFY_CLIENT_ID'),
    client_secret=os.getenv('SPOTIFY_CLIENT_SECRET'),
    redirect_uri=os.getenv('SPOTIFY_REDIRECT_URI'),
    scope="streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state"
)
```

✅ Full playback control
✅ User context and permissions
✅ Access to user's active devices

## Setup Steps

### 1. Update Spotify Developer Dashboard

1. Go to https://developer.spotify.com/dashboard
2. Select your app
3. Click "Edit Settings"
4. Add Redirect URI:
   - For local dev: `http://127.0.0.1:8080/callback`
   - For production: `https://your-app-domain.com/callback`
5. Save settings

### 2. Add Environment Variables

```bash
# Add to .env
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/callback  # For local dev
SPOTIFY_SCOPES=streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state
```

### 3. Implementation Architecture

```
User Flow:
1. User clicks "Connect Spotify" button
2. Redirects to Spotify OAuth consent page
3. User grants permissions
4. Spotify redirects back to /callback with auth code
5. Backend exchanges code for access token
6. Frontend receives token and initializes Web Playback SDK
7. User can now play/pause with spacebar
```

## Dual-Client Pattern (Recommended)

Keep both authentication methods:

```python
class LyricsService:
    def __init__(self, firestore_service):
        # Client Credentials for playlist/metadata (no user needed)
        self.spotify_client = spotipy.Spotify(
            auth_manager=SpotifyClientCredentials(...)
        )

        # Will be set per-user session for playback
        self.spotify_user = None  # Set during OAuth flow
```

This allows:

- Background operations (playlist imports) to work without user OAuth
- Playback features only for authenticated users

## Security Considerations

- Store refresh tokens in Firestore per-user
- Tokens expire after 1 hour (auto-refresh needed)
- Never expose tokens in frontend (use backend proxy)
- Scope: Request minimal permissions needed

## Alternative: Use Spotify Embed Player (No OAuth Required)

If you want to avoid OAuth complexity, you can use the Spotify Embed iframe:

```html
<iframe
  src="https://open.spotify.com/embed/track/{track_id}"
  width="300"
  height="80"
  frameborder="0"
  allowtransparency="true"
  allow="encrypted-media"
>
</iframe>
```

Pros:

- No OAuth needed
- Works without Premium
- Simple implementation

Cons:

- No keyboard control (spacebar won't work)
- No programmatic play/pause
- Must be visible on page (not mini player)

## Implementation Priority

**Quick Fix (Recommended for MVP)**:

1. Remove Web Playback SDK code
2. Add Spotify Embed iframe that appears when song is selected
3. Keep spacebar for other navigation only

**Full Solution (Future Enhancement)**:

1. Implement OAuth flow with backend endpoints
2. Store user tokens in Firestore
3. Initialize SDK with user token
4. Enable spacebar playback control
