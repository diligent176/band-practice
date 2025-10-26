"""
Spotify OAuth Service - Handle user authentication for Web Playback SDK

This service manages OAuth 2.0 Authorization Code flow for Spotify, allowing:
- User authentication with Spotify account
- Access token management (save, retrieve, refresh)
- Web Playback SDK initialization for in-browser music playback
"""

import os
import logging
from datetime import datetime, timedelta
from spotipy.oauth2 import SpotifyOAuth
import secrets

logger = logging.getLogger(__name__)


class SpotifyAuthService:
    """Manages Spotify OAuth authentication for Web Playback SDK"""
    
    def __init__(self, firestore_service):
        self.firestore = firestore_service
        
        # Required scopes for Web Playback SDK
        self.scopes = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state'
        
        # Get redirect URI from environment (same variable for local and production)
        self.redirect_uri = os.getenv('SPOTIFY_REDIRECT_URI', 'http://127.0.0.1:8080/api/spotify/callback')
        
        logger.info(f"SpotifyAuthService initialized with redirect_uri: {self.redirect_uri}")
    
    def get_auth_url(self, user_id, force_reauth=False):
        """
        Generate Spotify OAuth authorization URL

        Args:
            user_id: User email to track who initiated auth
            force_reauth: If True, force user to approve permissions again

        Returns:
            str: Authorization URL to redirect user to
        """
        # Generate and save state token for CSRF protection
        state = secrets.token_urlsafe(32)
        self.firestore.save_oauth_state(user_id, state)

        sp_oauth = SpotifyOAuth(
            client_id=os.getenv('SPOTIFY_CLIENT_ID'),
            client_secret=os.getenv('SPOTIFY_CLIENT_SECRET'),
            redirect_uri=self.redirect_uri,
            scope=self.scopes,
            state=state,
            show_dialog=force_reauth  # Force approval screen if requested
        )

        auth_url = sp_oauth.get_authorize_url()
        logger.info(f"Generated auth URL for user {user_id} (force_reauth={force_reauth})")
        return auth_url
    
    def handle_callback(self, code, state):
        """
        Exchange authorization code for access token
        
        Args:
            code: Authorization code from Spotify
            state: State token for verification
            
        Returns:
            dict: Token info with user_id if successful, None otherwise
        """
        # Verify state token
        logger.info(f"Verifying state token: {state[:10]}...")
        user_id = self.firestore.verify_oauth_state(state)
        if not user_id:
            logger.error(f"❌ FAILED: Invalid or expired state token: {state[:20]}...")
            return None
        logger.info(f"✅ State verified for user: {user_id}")
        
        sp_oauth = SpotifyOAuth(
            client_id=os.getenv('SPOTIFY_CLIENT_ID'),
            client_secret=os.getenv('SPOTIFY_CLIENT_SECRET'),
            redirect_uri=self.redirect_uri,
            scope=self.scopes
        )
        
        try:
            # Exchange code for token
            logger.info(f"Exchanging code for token (code: {code[:20]}...)")
            logger.info(f"Using redirect_uri: {self.redirect_uri}")
            token_info = sp_oauth.get_access_token(code, as_dict=True, check_cache=False)
            
            if not token_info:
                logger.error("❌ FAILED: Spotify returned no token")
                return None
            
            # Save token to Firestore
            self.save_user_token(user_id, token_info)
            
            logger.info(f"✅ Successfully authenticated Spotify for user {user_id}")
            return {'user_id': user_id, 'token_info': token_info}
            
        except Exception as e:
            logger.error(f"❌ FAILED: Error exchanging code for token: {e}", exc_info=True)
            return None
    
    def save_user_token(self, user_id, token_info):
        """
        Save Spotify token to Firestore
        
        Args:
            user_id: User email
            token_info: Token dictionary from Spotify
        """
        from google.cloud import firestore as fs
        token_data = {
            'access_token': token_info['access_token'],
            'refresh_token': token_info['refresh_token'],
            'expires_at': token_info['expires_at'],
            'updated_at': fs.SERVER_TIMESTAMP,
            'scope': token_info.get('scope', self.scopes)
        }
        
        self.firestore.save_spotify_token(user_id, token_data)
        logger.info(f"Saved Spotify token for user {user_id}")
    
    def get_user_token(self, user_id):
        """
        Get valid Spotify access token for user (auto-refresh if expired)
        
        Args:
            user_id: User email
            
        Returns:
            str: Valid access token or None if not authenticated
        """
        token_data = self.firestore.get_spotify_token(user_id)
        
        if not token_data:
            logger.info(f"No Spotify token found for user {user_id}")
            return None
        
        # Check if token is expired (refresh 5 minutes before expiry)
        expires_at = token_data.get('expires_at', 0)
        current_time = datetime.utcnow().timestamp()
        
        if current_time >= expires_at - 300:
            # Token expired or expiring soon, refresh it
            logger.info(f"Token expired for user {user_id}, refreshing...")
            token_data = self.refresh_token(user_id, token_data['refresh_token'])
            
            if not token_data:
                logger.error(f"Failed to refresh token for user {user_id}")
                return None
        
        return token_data.get('access_token')
    
    def refresh_token(self, user_id, refresh_token):
        """
        Refresh expired Spotify token

        Args:
            user_id: User email
            refresh_token: Refresh token from previous authentication

        Returns:
            dict: Updated token data or None if refresh failed
        """
        sp_oauth = SpotifyOAuth(
            client_id=os.getenv('SPOTIFY_CLIENT_ID'),
            client_secret=os.getenv('SPOTIFY_CLIENT_SECRET'),
            redirect_uri=self.redirect_uri,
            scope=self.scopes  # IMPORTANT: Include scopes to preserve permissions on refresh
        )

        try:
            # Refresh the token
            logger.info(f"Refreshing Spotify token for user {user_id} with scopes: {self.scopes}")
            token_info = sp_oauth.refresh_access_token(refresh_token)

            # Save updated token
            self.save_user_token(user_id, token_info)

            logger.info(f"Successfully refreshed token for user {user_id}")
            logger.info(f"Refreshed token has scopes: {token_info.get('scope', 'N/A')}")

            return {
                'access_token': token_info['access_token'],
                'refresh_token': token_info.get('refresh_token', refresh_token),  # Some refreshes don't return new refresh token
                'expires_at': token_info['expires_at']
            }

        except Exception as e:
            logger.error(f"Error refreshing token for user {user_id}: {e}")
            return None
    
    def disconnect_user(self, user_id):
        """
        Disconnect Spotify account (delete stored tokens)
        
        Args:
            user_id: User email
        """
        self.firestore.delete_spotify_token(user_id)
        logger.info(f"Disconnected Spotify for user {user_id}")
