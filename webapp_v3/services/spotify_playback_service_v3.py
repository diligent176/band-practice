"""
Spotify Web Playback SDK OAuth Service
Handles user-level Spotify authentication for playback in browser

This service enables unlimited users to play Spotify music by:
- Using Spotify Web Playback SDK (no 25-user quota limit)
- Each user authenticates with their own Spotify Premium account
- Tokens stored per-user in Firestore
- Automatic token refresh before expiry
"""

import os
import requests
import logging
from datetime import datetime, timedelta
from firebase_admin import firestore
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class SpotifyPlaybackService:
    """Manages Spotify OAuth for Web Playback SDK"""

    def __init__(self):
        self.client_id = os.getenv('SPOTIFY_CLIENT_ID')
        self.client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
        self.redirect_uri = os.getenv('SPOTIFY_PLAYBACK_REDIRECT_URI')
        self.db = firestore.client()

        if not self.client_id or not self.client_secret:
            logger.warning("Spotify credentials not configured - playback will not work")

        # Scopes required for Web Playback SDK
        self.scopes = [
            'streaming',                    # Play music in browser
            'user-read-email',              # Get user email
            'user-read-private',            # Get user subscription type (Premium check)
            'user-read-playback-state',     # Read current playback state
            'user-modify-playback-state'    # Control playback (play, pause, seek, etc.)
        ]

    def get_auth_url(self, state: str) -> str:
        """
        Generate Spotify OAuth authorization URL

        Args:
            state: CSRF protection token (use Firebase UID)

        Returns:
            OAuth authorization URL to redirect user to
        """
        scope_string = ' '.join(self.scopes)

        return (
            f"https://accounts.spotify.com/authorize"
            f"?client_id={self.client_id}"
            f"&response_type=code"
            f"&redirect_uri={self.redirect_uri}"
            f"&scope={scope_string}"
            f"&state={state}"
            f"&show_dialog=true"  # Always show consent screen for clarity
        )

    def exchange_code_for_token(self, code: str) -> Dict:
        """
        Exchange authorization code for access/refresh tokens

        Args:
            code: Authorization code from OAuth callback

        Returns:
            Token data with access_token, refresh_token, expires_in, scope
        """
        token_url = 'https://accounts.spotify.com/api/token'

        response = requests.post(token_url, data={
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': self.redirect_uri,
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }, timeout=10)

        response.raise_for_status()
        return response.json()

    def refresh_access_token(self, refresh_token: str) -> Dict:
        """
        Refresh an expired access token

        Args:
            refresh_token: Refresh token from previous authorization

        Returns:
            New token data with access_token, expires_in, scope
        """
        token_url = 'https://accounts.spotify.com/api/token'

        response = requests.post(token_url, data={
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }, timeout=10)

        response.raise_for_status()
        return response.json()

    def save_user_token(self, uid: str, token_data: Dict):
        """
        Save or update Spotify token for user in Firestore

        Args:
            uid: Firebase user ID
            token_data: Token data from Spotify OAuth
        """
        expires_at = datetime.utcnow() + timedelta(seconds=token_data['expires_in'])

        doc_ref = self.db.collection('spotify_tokens_v3').document(uid)

        # Get existing data to preserve refresh_token if not in new response
        existing_doc = doc_ref.get()
        existing_data = existing_doc.to_dict() if existing_doc.exists else {}

        update_data = {
            'uid': uid,
            'access_token': token_data['access_token'],
            'expires_at': expires_at,
            'scopes': token_data['scope'].split(' '),
            'updated_at': datetime.utcnow()
        }

        # Refresh token may not be present on token refresh
        if 'refresh_token' in token_data:
            update_data['refresh_token'] = token_data['refresh_token']
        elif 'refresh_token' in existing_data:
            update_data['refresh_token'] = existing_data['refresh_token']

        # Save token data
        doc_ref.set(update_data, merge=True)

        # Update user record to mark Spotify as connected (use set with merge to avoid errors if user doc doesn't exist)
        self.db.collection('users_v3').document(uid).set({
            'spotify_connected': True,
            'spotify_token_ref': f'spotify_tokens_v3/{uid}',
            'updated_at': datetime.utcnow()
        }, merge=True)

        logger.info(f"Saved Spotify token for user {uid}")

    def get_user_token(self, uid: str) -> str:
        """
        Get valid access token for user (auto-refresh if expired)

        Args:
            uid: Firebase user ID

        Returns:
            Valid Spotify access token

        Raises:
            ValueError: If user has not connected Spotify
        """
        doc = self.db.collection('spotify_tokens_v3').document(uid).get()

        if not doc.exists:
            raise ValueError("User has not connected Spotify")

        token_data = doc.to_dict()

        # Convert expires_at to offset-naive datetime for comparison
        expires_at = token_data['expires_at']
        if hasattr(expires_at, 'replace'):
            # If it's a datetime object with timezone, convert to naive UTC
            expires_at = expires_at.replace(tzinfo=None)

        # Check if token is expired (with 5-minute buffer for safety)
        if datetime.utcnow() >= expires_at - timedelta(minutes=5):
            logger.info(f"Refreshing expired Spotify token for user {uid}")

            # Refresh token
            new_token_data = self.refresh_access_token(token_data['refresh_token'])
            self.save_user_token(uid, new_token_data)

            # Re-fetch updated token
            doc = self.db.collection('spotify_tokens_v3').document(uid).get()
            token_data = doc.to_dict()

        return token_data['access_token']

    def disconnect_user(self, uid: str):
        """
        Disconnect Spotify for user (remove tokens)

        Args:
            uid: Firebase user ID
        """
        # Delete token document
        self.db.collection('spotify_tokens_v3').document(uid).delete()

        # Update user record
        self.db.collection('users_v3').document(uid).update({
            'spotify_connected': False,
            'spotify_token_ref': None,
            'updated_at': datetime.utcnow()
        })

        logger.info(f"Disconnected Spotify for user {uid}")

    def check_premium_status(self, access_token: str) -> bool:
        """
        Check if user has Spotify Premium (required for Web Playback SDK)

        Args:
            access_token: Spotify access token

        Returns:
            True if user has Premium, False otherwise
        """
        try:
            response = requests.get(
                'https://api.spotify.com/v1/me',
                headers={'Authorization': f'Bearer {access_token}'},
                timeout=10
            )
            response.raise_for_status()

            user_data = response.json()
            product = user_data.get('product', 'free')

            return product == 'premium'
        except Exception as e:
            logger.error(f"Error checking Spotify Premium status: {e}")
            return False
