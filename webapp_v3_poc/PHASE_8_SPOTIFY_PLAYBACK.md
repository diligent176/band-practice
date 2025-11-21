# Phase 8: Spotify Playback Implementation

## 🎯 Goal
Enable Spotify playback for **unlimited users** using Spotify Web Playback SDK, bypassing the 25-user quota limitation.

---

## 🎵 Solution: Spotify Web Playback SDK

### Why This Approach?
- ✅ **No 25-user limit** - Works for any authenticated Spotify Premium user
- ✅ **No Spotify app approval needed** - Just OAuth scopes
- ✅ **Full playback control** - Play, pause, seek, volume in your app
- ✅ **Spotify Connect device** - Shows as "Band Practice Pro" in Spotify app
- ✅ **Browser-based** - No native app required

### Requirements
1. User must have **Spotify Premium** (required for Web Playback SDK)
2. User authorizes via **Spotify OAuth** (scopes: `streaming`, `user-read-email`, `user-read-private`)
3. App loads **Spotify Web Playback SDK** JavaScript library
4. Backend issues **Spotify access tokens** with proper scopes

---

## 📐 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Frontend (Browser)                                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User clicks "Connect Spotify" button                    │
│  2. OAuth popup → User authorizes Spotify                   │
│  3. Backend exchanges code for access token                 │
│  4. Frontend loads Spotify Web Playback SDK                 │
│  5. SDK creates a "device" (Band Practice Pro)              │
│  6. Playback starts on this device                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌──────────────────────────────────────────────────────────────┐
│ Backend (Flask)                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  /api/v3/spotify/auth-url → Returns OAuth URL               │
│  /api/v3/spotify/callback → Exchanges code for token        │
│  /api/v3/spotify/token    → Returns current access token    │
│  /api/v3/spotify/refresh  → Refreshes expired token         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌──────────────────────────────────────────────────────────────┐
│ Firestore (spotify_tokens_v3)                                │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  {                                                           │
│    uid: "firebase-user-id",                                 │
│    access_token: "BQD...",        // Valid for 1 hour       │
│    refresh_token: "AQC...",       // Never expires          │
│    expires_at: timestamp,                                   │
│    scopes: ["streaming", "user-read-email", ...],          │
│    created_at: timestamp,                                   │
│    updated_at: timestamp                                    │
│  }                                                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Steps

### **Step 1: Backend - Spotify OAuth Endpoints**

**File:** `webapp_v3/services/spotify_playback_service_v3.py`

```python
"""
Spotify Web Playback SDK OAuth service
Handles user-level Spotify authentication for playback
"""

import os
import requests
from datetime import datetime, timedelta
from firebase_admin import firestore

class SpotifyPlaybackService:
    def __init__(self):
        self.client_id = os.getenv('SPOTIFY_CLIENT_ID')
        self.client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
        self.redirect_uri = os.getenv('SPOTIFY_REDIRECT_URI')  # e.g., https://your-app.com/api/v3/spotify/callback
        self.db = firestore.client()

        # Scopes required for Web Playback SDK
        self.scopes = [
            'streaming',              # Play music in browser
            'user-read-email',        # Get user email
            'user-read-private',      # Get user subscription type (Premium check)
            'user-read-playback-state',  # Read current playback
            'user-modify-playback-state' # Control playback
        ]

    def get_auth_url(self, state: str) -> str:
        """Generate Spotify OAuth authorization URL"""
        scope_string = ' '.join(self.scopes)

        return (
            f"https://accounts.spotify.com/authorize"
            f"?client_id={self.client_id}"
            f"&response_type=code"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope={scope_string}"
            f"&state={state}"
            f"&show_dialog=true"  # Always show consent screen
        )

    def exchange_code_for_token(self, code: str) -> dict:
        """Exchange authorization code for access/refresh tokens"""
        token_url = 'https://accounts.spotify.com/api/token'

        response = requests.post(token_url, data={
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': self.redirect_uri,
            'client_id': self.client_id,
            'client_secret': self.client_secret
        })

        response.raise_for_status()
        return response.json()

    def refresh_access_token(self, refresh_token: str) -> dict:
        """Refresh an expired access token"""
        token_url = 'https://accounts.spotify.com/api/token'

        response = requests.post(token_url, data={
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': self.client_id,
            'client_secret': self.client_secret
        })

        response.raise_for_status()
        return response.json()

    def save_user_token(self, uid: str, token_data: dict):
        """Save or update Spotify token for user"""
        expires_at = datetime.utcnow() + timedelta(seconds=token_data['expires_in'])

        doc_ref = self.db.collection('spotify_tokens_v3').document(uid)
        doc_ref.set({
            'uid': uid,
            'access_token': token_data['access_token'],
            'refresh_token': token_data.get('refresh_token'),  # May not be present on refresh
            'expires_at': expires_at,
            'scopes': token_data['scope'].split(' '),
            'updated_at': datetime.utcnow()
        }, merge=True)

        # Update user record
        self.db.collection('users_v3').document(uid).update({
            'spotify_connected': True,
            'spotify_token_ref': f'spotify_tokens_v3/{uid}'
        })

    def get_user_token(self, uid: str) -> dict:
        """Get valid access token for user (refresh if expired)"""
        doc = self.db.collection('spotify_tokens_v3').document(uid).get()

        if not doc.exists:
            raise ValueError("User has not connected Spotify")

        token_data = doc.to_dict()

        # Check if token is expired (with 5-minute buffer)
        if datetime.utcnow() >= token_data['expires_at'] - timedelta(minutes=5):
            # Refresh token
            new_token_data = self.refresh_access_token(token_data['refresh_token'])
            self.save_user_token(uid, new_token_data)

            # Re-fetch updated token
            doc = self.db.collection('spotify_tokens_v3').document(uid).get()
            token_data = doc.to_dict()

        return token_data['access_token']
```

**File:** `webapp_v3/app.py` (add routes)

```python
from services.spotify_playback_service_v3 import SpotifyPlaybackService

spotify_playback = SpotifyPlaybackService()

@app.route('/api/v3/spotify/auth-url', methods=['GET'])
@require_auth
def get_spotify_auth_url():
    """Get Spotify OAuth URL for user authentication"""
    uid = request.user_id

    # Use UID as state for CSRF protection
    auth_url = spotify_playback.get_auth_url(state=uid)

    return jsonify({'auth_url': auth_url})

@app.route('/api/v3/spotify/callback', methods=['GET'])
def spotify_callback():
    """Handle Spotify OAuth callback"""
    code = request.args.get('code')
    state = request.args.get('state')  # Should match UID
    error = request.args.get('error')

    if error:
        return f"<html><body><script>window.close(); alert('Spotify authorization denied');</script></body></html>"

    try:
        # Exchange code for token
        token_data = spotify_playback.exchange_code_for_token(code)

        # Save token for user (state = uid)
        spotify_playback.save_user_token(state, token_data)

        # Close popup and notify parent window
        return f"""
        <html>
        <body>
            <script>
                window.opener.postMessage({{type: 'spotify-connected'}}, '*');
                window.close();
            </script>
            <p>Spotify connected! Closing window...</p>
        </body>
        </html>
        """
    except Exception as e:
        app.logger.error(f"Spotify callback error: {e}")
        return f"<html><body><script>window.close(); alert('Failed to connect Spotify');</script></body></html>"

@app.route('/api/v3/spotify/token', methods=['GET'])
@require_auth
def get_spotify_token():
    """Get current Spotify access token for user"""
    uid = request.user_id

    try:
        access_token = spotify_playback.get_user_token(uid)
        return jsonify({'access_token': access_token})
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
```

---

### **Step 2: Frontend - Spotify Connection UI**

**Add to Player View** (`home.html`):

```html
<!-- Spotify Connection Card (shown if not connected) -->
<div id="spotify-connect-card" class="spotify-connect-card hidden">
    <div class="spotify-connect-content">
        <i class="fa-brands fa-spotify" style="font-size: 48px; color: #1DB954;"></i>
        <h3>Connect Spotify to Play Music</h3>
        <p>Band Practice Pro uses Spotify Web Playback to play music directly in your browser.</p>
        <p><strong>Requires Spotify Premium</strong></p>
        <button class="btn btn-primary" onclick="SpotifyPlayer.connectSpotify()">
            <i class="fa-brands fa-spotify"></i> Connect Spotify
        </button>
    </div>
</div>
```

---

### **Step 3: Frontend - Spotify Web Playback SDK**

**File:** `webapp_v3/static/js/spotify_player.js`

```javascript
/**
 * Spotify Web Playback SDK Integration
 */

const SpotifyPlayer = {
    player: null,
    deviceId: null,
    accessToken: null,
    isReady: false,
    currentTrackUri: null,

    async init() {
        // Check if user has connected Spotify
        const hasToken = await this.checkSpotifyConnection();

        if (hasToken) {
            await this.loadSDK();
        } else {
            this.showConnectCard();
        }
    },

    async checkSpotifyConnection() {
        try {
            const response = await BPP.apiCall('/api/v3/spotify/token');
            this.accessToken = response.access_token;
            return true;
        } catch (error) {
            return false;
        }
    },

    showConnectCard() {
        document.getElementById('spotify-connect-card').classList.remove('hidden');
    },

    hideConnectCard() {
        document.getElementById('spotify-connect-card').classList.add('hidden');
    },

    async connectSpotify() {
        try {
            // Get OAuth URL
            const response = await BPP.apiCall('/api/v3/spotify/auth-url');
            const authUrl = response.auth_url;

            // Open popup
            const popup = window.open(authUrl, 'Spotify Login', 'width=500,height=700');

            // Listen for callback
            window.addEventListener('message', async (event) => {
                if (event.data.type === 'spotify-connected') {
                    popup.close();
                    BPP.showToast('Spotify connected!', 'success');

                    // Reload and initialize SDK
                    await this.init();
                }
            });
        } catch (error) {
            console.error('Failed to connect Spotify:', error);
            BPP.showToast('Failed to connect Spotify', 'error');
        }
    },

    async loadSDK() {
        return new Promise((resolve) => {
            // Load Spotify Web Playback SDK
            const script = document.createElement('script');
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.async = true;
            document.body.appendChild(script);

            // SDK calls this when ready
            window.onSpotifyWebPlaybackSDKReady = () => {
                this.initializePlayer();
                resolve();
            };
        });
    },

    initializePlayer() {
        this.player = new Spotify.Player({
            name: 'Band Practice Pro',
            getOAuthToken: cb => { cb(this.accessToken); },
            volume: 0.5
        });

        // Ready event - get device ID
        this.player.addListener('ready', ({ device_id }) => {
            console.log('Spotify Player ready with Device ID:', device_id);
            this.deviceId = device_id;
            this.isReady = true;
            this.hideConnectCard();
            BPP.showToast('Spotify player ready!', 'success');
        });

        // Not ready event
        this.player.addListener('not_ready', ({ device_id }) => {
            console.log('Spotify Player offline:', device_id);
            this.isReady = false;
        });

        // Player state changed
        this.player.addListener('player_state_changed', state => {
            if (!state) return;

            console.log('Playback state:', state);

            // Update UI based on state
            // state.paused, state.position, state.duration, etc.
        });

        // Connect player
        this.player.connect();
    },

    async play(spotifyUri) {
        if (!this.isReady) {
            BPP.showToast('Spotify player not ready', 'warning');
            return;
        }

        try {
            // Use Spotify Web API to start playback on our device
            await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uris: [spotifyUri]
                })
            });

            this.currentTrackUri = spotifyUri;
        } catch (error) {
            console.error('Playback error:', error);
            BPP.showToast('Failed to start playback', 'error');
        }
    },

    async pause() {
        await this.player.pause();
    },

    async resume() {
        await this.player.resume();
    },

    async togglePlayPause() {
        await this.player.togglePlay();
    },

    async seek(positionMs) {
        await this.player.seek(positionMs);
    },

    async setVolume(volume) {
        await this.player.setVolume(volume);
    }
};

// Initialize when player view loads
window.SpotifyPlayer = SpotifyPlayer;
```

---

## 🎮 Fallback: Non-Premium Users

For users **without Spotify Premium**, the Web Playback SDK won't work. Fallback options:

### Option A: Open in Spotify App
```javascript
function openInSpotifyApp(spotifyUri) {
    // Try native app first
    window.location.href = spotifyUri; // spotify:track:xxx

    // Fallback to web player after 1 second
    setTimeout(() => {
        window.open(`https://open.spotify.com/track/${trackId}`, '_blank');
    }, 1000);
}
```

### Option B: YouTube Fallback
Search YouTube for "artist - song title" and embed player.

---

## 🧪 Testing Plan

1. **Test with Premium user**: Full playback control
2. **Test with Free user**: Graceful degradation to "Open in Spotify"
3. **Test token refresh**: Ensure seamless experience when token expires
4. **Test multiple devices**: Ensure playback transfers correctly

---

## 📋 TODO Checklist

- [ ] Create `spotify_playback_service_v3.py`
- [ ] Add OAuth routes to `app.py`
- [ ] Create `spotify_player.js` frontend module
- [ ] Add Spotify connection UI to player view
- [ ] Add `SPOTIFY_REDIRECT_URI` to environment variables
- [ ] Update Spotify Developer Dashboard with redirect URI
- [ ] Test OAuth flow end-to-end
- [ ] Test playback with Premium account
- [ ] Implement fallback for non-Premium users
- [ ] Add error handling for common issues (token expired, network errors)
- [ ] Document Spotify setup in deployment guide

---

## 🔐 Security Considerations

1. **State parameter**: Use Firebase UID as state to prevent CSRF
2. **Token storage**: Store in Firestore with proper security rules
3. **Token refresh**: Automatic refresh before expiry
4. **Scope minimal**: Only request necessary scopes

---

## 📚 Resources

- [Spotify Web Playback SDK Docs](https://developer.spotify.com/documentation/web-playback-sdk)
- [Spotify OAuth Guide](https://developer.spotify.com/documentation/general/guides/authorization-guide/)
- [Spotify Web API Reference](https://developer.spotify.com/documentation/web-api/reference/)
