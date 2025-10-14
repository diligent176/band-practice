# Spotify OAuth Implementation Guide

This guide shows how to implement full Spotify Web Playback SDK with OAuth to enable in-browser music control.

## Prerequisites

- Spotify Premium account (required for Web Playback SDK)
- Spotify Developer App configured with redirect URIs
- Understanding of OAuth 2.0 Authorization Code flow

## Step 1: Environment Variables

Add to `.env`:

```bash
# OAuth Settings
SPOTIFY_REDIRECT_URI=http://localhost:8080/api/spotify/callback
SPOTIFY_REDIRECT_URI_PROD=https://your-production-domain.com/api/spotify/callback
SPOTIFY_SCOPES=streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state
```

## Step 2: Update Spotify Developer Dashboard

1. Go to https://developer.spotify.com/dashboard
2. Select your app
3. Click "Edit Settings"
4. Add Redirect URIs:
   - `http://localhost:8080/api/spotify/callback` (local dev)
   - `https://your-production-domain.com/api/spotify/callback` (production)
5. Save

## Step 3: Backend Implementation

### Add to `requirements.txt`:

```
spotipy>=2.23.0
```

### Update `webapp/services/spotify_auth_service.py` (NEW FILE):

```python
"""
Spotify OAuth Service - Handle user authentication for Web Playback SDK
"""
import os
from spotipy.oauth2 import SpotifyOAuth
from datetime import datetime, timedelta

class SpotifyAuthService:
    def __init__(self, firestore_service):
        self.firestore = firestore_service
        self.scopes = os.getenv('SPOTIFY_SCOPES', 'streaming user-read-email user-read-private')

        # Determine redirect URI based on environment
        self.redirect_uri = os.getenv('SPOTIFY_REDIRECT_URI_PROD') if os.getenv('FLASK_ENV') == 'production' else os.getenv('SPOTIFY_REDIRECT_URI')

    def get_auth_url(self, user_id):
        """Generate Spotify OAuth authorization URL"""
        sp_oauth = SpotifyOAuth(
            client_id=os.getenv('SPOTIFY_CLIENT_ID'),
            client_secret=os.getenv('SPOTIFY_CLIENT_SECRET'),
            redirect_uri=self.redirect_uri,
            scope=self.scopes,
            state=user_id,  # Use user_id as state to track who initiated auth
            show_dialog=False
        )

        return sp_oauth.get_authorize_url()

    def handle_callback(self, code, user_id):
        """Exchange authorization code for access token"""
        sp_oauth = SpotifyOAuth(
            client_id=os.getenv('SPOTIFY_CLIENT_ID'),
            client_secret=os.getenv('SPOTIFY_CLIENT_SECRET'),
            redirect_uri=self.redirect_uri,
            scope=self.scopes
        )

        # Exchange code for token
        token_info = sp_oauth.get_access_token(code, as_dict=True, check_cache=False)

        # Save token to Firestore
        self.save_user_token(user_id, token_info)

        return token_info

    def save_user_token(self, user_id, token_info):
        """Save Spotify token to Firestore"""
        token_data = {
            'access_token': token_info['access_token'],
            'refresh_token': token_info['refresh_token'],
            'expires_at': token_info['expires_at'],
            'updated_at': datetime.utcnow()
        }

        self.firestore.save_spotify_token(user_id, token_data)

    def get_user_token(self, user_id):
        """Get valid Spotify token for user (refresh if expired)"""
        token_data = self.firestore.get_spotify_token(user_id)

        if not token_data:
            return None

        # Check if token is expired
        expires_at = token_data.get('expires_at', 0)
        if datetime.utcnow().timestamp() >= expires_at - 300:  # Refresh 5 min before expiry
            # Token expired, refresh it
            token_data = self.refresh_token(user_id, token_data['refresh_token'])

        return token_data.get('access_token')

    def refresh_token(self, user_id, refresh_token):
        """Refresh expired Spotify token"""
        sp_oauth = SpotifyOAuth(
            client_id=os.getenv('SPOTIFY_CLIENT_ID'),
            client_secret=os.getenv('SPOTIFY_CLIENT_SECRET'),
            redirect_uri=self.redirect_uri
        )

        # Refresh the token
        token_info = sp_oauth.refresh_access_token(refresh_token)

        # Save updated token
        self.save_user_token(user_id, token_info)

        return token_info
```

### Update `webapp/services/firestore_service.py`:

Add these methods to `FirestoreService` class:

```python
def save_spotify_token(self, user_id, token_data):
    """Save Spotify OAuth token for user"""
    doc_ref = self.db.collection('spotify_tokens').document(user_id)
    doc_ref.set(token_data)

def get_spotify_token(self, user_id):
    """Get Spotify OAuth token for user"""
    doc_ref = self.db.collection('spotify_tokens').document(user_id)
    doc = doc_ref.get()

    if doc.exists:
        return doc.to_dict()
    return None

def delete_spotify_token(self, user_id):
    """Delete Spotify OAuth token (disconnect)"""
    doc_ref = self.db.collection('spotify_tokens').document(user_id)
    doc_ref.delete()
```

### Update `webapp/app.py`:

```python
from services.spotify_auth_service import SpotifyAuthService

# Initialize service
spotify_auth = SpotifyAuthService(firestore)

@app.route('/api/spotify/auth/url', methods=['GET'])
@require_auth
def get_spotify_auth_url():
    """Get Spotify OAuth authorization URL"""
    try:
        user_id = g.user.get('email')
        auth_url = spotify_auth.get_auth_url(user_id)

        return jsonify({
            'success': True,
            'auth_url': auth_url
        })
    except Exception as e:
        logger.error(f"Error generating Spotify auth URL: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/spotify/callback', methods=['GET'])
def spotify_callback():
    """Handle Spotify OAuth callback"""
    try:
        code = request.args.get('code')
        state = request.args.get('state')  # This is the user_id we passed
        error = request.args.get('error')

        if error:
            return f"<script>window.close(); window.opener.postMessage({{type: 'spotify-auth-error', error: '{error}'}}, '*');</script>"

        if not code or not state:
            return "Invalid callback", 400

        # Exchange code for token
        token_info = spotify_auth.handle_callback(code, state)

        # Close popup and notify parent window
        return """
        <script>
            window.opener.postMessage({type: 'spotify-auth-success'}, '*');
            window.close();
        </script>
        """
    except Exception as e:
        logger.error(f"Error in Spotify callback: {e}")
        return f"<script>window.close(); window.opener.postMessage({{type: 'spotify-auth-error', error: 'Authentication failed'}}, '*');</script>"


@app.route('/api/spotify/token', methods=['GET'])
@require_auth
def get_spotify_user_token():
    """Get Spotify access token for authenticated user"""
    try:
        user_id = g.user.get('email')
        access_token = spotify_auth.get_user_token(user_id)

        if access_token:
            return jsonify({
                'success': True,
                'access_token': access_token
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Not authenticated with Spotify',
                'needs_auth': True
            }), 401
    except Exception as e:
        logger.error(f"Error getting Spotify token: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/spotify/disconnect', methods=['POST'])
@require_auth
def disconnect_spotify():
    """Disconnect Spotify account"""
    try:
        user_id = g.user.get('email')
        firestore.delete_spotify_token(user_id)

        return jsonify({
            'success': True,
            'message': 'Spotify disconnected'
        })
    except Exception as e:
        logger.error(f"Error disconnecting Spotify: {e}")
        return jsonify({'error': str(e), 'success': False}), 500
```

## Step 4: Frontend Implementation

### Update `webapp/static/js/app.js`:

```javascript
//=============================================================================
// SPOTIFY WEB PLAYBACK SDK WITH OAUTH
//=============================================================================

let spotifyPlayer = null;
let spotifyDeviceId = null;
let spotifyAccessToken = null;
let spotifyPlayerReady = false;
let spotifyAuthWindow = null;

// Initialize after user authenticates with Spotify
window.onSpotifyWebPlaybackSDKReady = () => {
  console.log("🎵 Spotify SDK loaded");
  // Don't auto-initialize - wait for user to connect
};

// Connect Spotify button handler
async function connectSpotify() {
  try {
    // Get auth URL
    const response = await authenticatedApiCall("/api/spotify/auth/url");
    const data = await response.json();

    if (data.success && data.auth_url) {
      // Open OAuth popup
      const width = 600;
      const height = 800;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      spotifyAuthWindow = window.open(
        data.auth_url,
        "Spotify Login",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for auth completion
      window.addEventListener("message", handleSpotifyAuthMessage);
    }
  } catch (error) {
    console.error("Error connecting Spotify:", error);
    showToast("Failed to connect Spotify", "error");
  }
}

function handleSpotifyAuthMessage(event) {
  if (event.data.type === "spotify-auth-success") {
    window.removeEventListener("message", handleSpotifyAuthMessage);
    showToast("Connected to Spotify!", "success");

    // Initialize player
    initializeSpotifyPlayer();
  } else if (event.data.type === "spotify-auth-error") {
    window.removeEventListener("message", handleSpotifyAuthMessage);
    showToast("Spotify authentication failed", "error");
  }
}

async function initializeSpotifyPlayer() {
  try {
    // Get access token
    const response = await authenticatedApiCall("/api/spotify/token");
    const data = await response.json();

    if (!data.success) {
      if (data.needs_auth) {
        // User needs to connect Spotify
        showSpotifyConnectPrompt();
      }
      return;
    }

    spotifyAccessToken = data.access_token;
    console.log("✅ Got Spotify access token");

    // Create player
    spotifyPlayer = new Spotify.Player({
      name: "Band Practice Pro",
      getOAuthToken: (cb) => {
        cb(spotifyAccessToken);
      },
      volume: 0.7,
    });

    // Error handling
    spotifyPlayer.addListener("authentication_error", ({ message }) => {
      console.error("Spotify auth error:", message);
      showToast("Spotify Premium required", "error");
    });

    spotifyPlayer.addListener("account_error", ({ message }) => {
      console.error("Spotify account error:", message);
      showToast("Spotify Premium required", "error");
    });

    // Ready
    spotifyPlayer.addListener("ready", ({ device_id }) => {
      console.log("✅ Spotify player ready!");
      spotifyDeviceId = device_id;
      spotifyPlayerReady = true;
      updateSpotifyConnectionUI(true);
    });

    // Player state changed
    spotifyPlayer.addListener("player_state_changed", (state) => {
      if (!state) return;
      updatePlayerUI(state);
    });

    // Connect
    await spotifyPlayer.connect();
  } catch (error) {
    console.error("Error initializing Spotify player:", error);
  }
}

function showSpotifyConnectPrompt() {
  // Add a "Connect Spotify" button to the mini player
  const connectBtn = document.createElement("button");
  connectBtn.className = "btn btn-primary";
  connectBtn.innerHTML = '<i class="fa-brands fa-spotify"></i> Connect Spotify';
  connectBtn.onclick = connectSpotify;

  miniPlayer.innerHTML = "";
  miniPlayer.appendChild(connectBtn);
  miniPlayer.style.display = "flex";
}

function updateSpotifyConnectionUI(isConnected) {
  // Update UI to show connected state
  if (isConnected) {
    // Hide connect button, show player controls
    renderMiniPlayer();
  }
}

// Toggle play/pause
async function toggleAudioPlayback() {
  if (!currentSong) {
    showToast("No song selected", "info");
    return;
  }

  if (!spotifyPlayerReady) {
    // Offer to connect Spotify
    const shouldConnect = confirm(
      "Connect your Spotify account to play music in the app. Continue?"
    );
    if (shouldConnect) {
      await connectSpotify();
    }
    return;
  }

  const state = await spotifyPlayer.getCurrentState();

  if (!state) {
    // Start playing current song
    const spotifyUri = currentSong.spotify_uri;
    if (spotifyUri) {
      await playSpotifyTrack(spotifyUri);
    }
  } else if (state.paused) {
    await spotifyPlayer.resume();
  } else {
    await spotifyPlayer.pause();
  }
}

async function playSpotifyTrack(uri) {
  if (!spotifyDeviceId || !spotifyAccessToken) {
    showToast("Player not ready", "error");
    return;
  }

  try {
    await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`,
      {
        method: "PUT",
        body: JSON.stringify({ uris: [uri] }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      }
    );
  } catch (error) {
    console.error("Error playing track:", error);
    showToast("Failed to play", "error");
  }
}

function updatePlayerUI(state) {
  const icon = miniPlayerPlayBtn.querySelector("i");

  if (state.paused) {
    icon.className = "fa-solid fa-play";
  } else {
    icon.className = "fa-solid fa-pause";
  }
}

// Auto-initialize on app load (if user has token)
async function autoInitializeSpotify() {
  const response = await authenticatedApiCall("/api/spotify/token");
  const data = await response.json();

  if (data.success && data.access_token) {
    // User has valid token, initialize player
    initializeSpotifyPlayer();
  }
}

// Call after app initialization
window.addEventListener("load", () => {
  setTimeout(autoInitializeSpotify, 1000);
});
```

### Add to `viewer.html`:

```html
<!-- Re-add Spotify SDK -->
<script src="https://sdk.scdn.co/spotify-player.js"></script>
```

## Step 5: Terraform/Firestore Setup

Add index for `spotify_tokens` collection in `terraform/firestore.tf`:

```hcl
# Spotify tokens collection (per-user OAuth tokens)
resource "google_firestore_document" "spotify_tokens_sample" {
  project     = var.project_id
  database    = "(default)"
  collection  = "spotify_tokens"
  document_id = "_sample"

  fields = jsonencode({
    user_id = { stringValue = "user@example.com" }
    access_token = { stringValue = "" }
    refresh_token = { stringValue = "" }
    expires_at = { integerValue = 0 }
  })

  lifecycle {
    ignore_changes = all
  }
}
```

## Security Best Practices

1. **Token Storage**: Tokens are stored in Firestore with user-level security rules
2. **Token Refresh**: Tokens auto-refresh 5 minutes before expiry
3. **Scope Minimization**: Only request scopes actually needed
4. **HTTPS Required**: OAuth redirects must use HTTPS in production

## Testing

1. Click "Connect Spotify" button
2. Authorize in popup
3. Popup closes, player initializes
4. Select song and press spacebar
5. Music plays in browser!

## Troubleshooting

- **"Spotify Premium required"**: Web Playback SDK only works with Premium accounts
- **OAuth popup blocked**: Allow popups for your domain
- **Token expired**: Should auto-refresh, check Firestore rules
- **No sound**: Check browser audio permissions
