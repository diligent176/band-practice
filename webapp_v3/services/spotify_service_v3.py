"""
Band Practice Pro v3 - Spotify Service
Handles Spotify API interactions using Client Credentials flow
"""

import os
import logging
from typing import Dict, List, Optional
from spotipy import Spotify
from spotipy.oauth2 import SpotifyClientCredentials

logger = logging.getLogger(__name__)


class SpotifyServiceV3:
    """Service for Spotify API interactions (Client Credentials flow)"""

    def __init__(self):
        """
        Initialize Spotify client with Client Credentials flow
        This flow is used for backend operations that don't require user authentication
        """
        client_id = os.getenv('SPOTIFY_CLIENT_ID')
        client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')

        if not client_id or not client_secret:
            raise ValueError("Missing Spotify credentials. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables")

        # Client Credentials flow - no user authentication required
        auth_manager = SpotifyClientCredentials(
            client_id=client_id,
            client_secret=client_secret
        )

        self.spotify = Spotify(auth_manager=auth_manager)
        logger.info("SpotifyServiceV3 initialized with Client Credentials flow")

    def get_playlist_metadata(self, playlist_id: str) -> Optional[Dict]:
        """
        Fetch playlist metadata from Spotify

        Args:
            playlist_id: Spotify playlist ID

        Returns:
            Dict with playlist metadata or None if error
        """
        try:
            playlist = self.spotify.playlist(playlist_id, fields='name,description,owner.display_name,images,tracks.total,external_urls.spotify')

            # Get artwork URL (use largest image if available)
            image_url = None
            if playlist.get('images'):
                images = sorted(playlist['images'], key=lambda x: x.get('height', 0) or 0, reverse=True)
                image_url = images[0]['url'] if images else None

            return {
                'playlist_id': playlist_id,
                'playlist_name': playlist['name'],
                'playlist_owner': playlist['owner']['display_name'],
                'track_count': playlist['tracks']['total'],
                'image_url': image_url,
                'playlist_url': playlist['external_urls']['spotify'],
                'description': playlist.get('description', '')
            }

        except Exception as e:
            logger.error(f"Error fetching playlist metadata for {playlist_id}: {e}")
            return None

    def get_playlist_tracks(self, playlist_id: str, limit: int = 100) -> List[Dict]:
        """
        Fetch all tracks from a Spotify playlist

        Args:
            playlist_id: Spotify playlist ID
            limit: Number of tracks to fetch per request (max 100)

        Returns:
            List of track dicts with metadata
        """
        try:
            tracks = []
            offset = 0

            while True:
                results = self.spotify.playlist_tracks(
                    playlist_id,
                    offset=offset,
                    limit=limit,
                    fields='items(track(name,artists,album,duration_ms,external_urls.spotify,id)),next'
                )

                for item in results['items']:
                    track = item.get('track')
                    if not track:
                        continue

                    # Extract artist names
                    artists = [artist['name'] for artist in track.get('artists', [])]

                    track_data = {
                        'spotify_track_id': track.get('id'),
                        'title': track.get('name'),
                        'artist': ', '.join(artists),
                        'album': track['album'].get('name'),
                        'duration_ms': track.get('duration_ms'),
                        'spotify_url': track['external_urls'].get('spotify')
                    }

                    tracks.append(track_data)

                # Check if there are more tracks
                if not results.get('next'):
                    break

                offset += limit

            logger.info(f"Fetched {len(tracks)} tracks from playlist {playlist_id}")
            return tracks

        except Exception as e:
            logger.error(f"Error fetching playlist tracks for {playlist_id}: {e}")
            return []

    def search_track(self, title: str, artist: str = None, limit: int = 1) -> Optional[Dict]:
        """
        Search for a track on Spotify

        Args:
            title: Track title
            artist: Optional artist name for better matching
            limit: Number of results to return

        Returns:
            First matching track dict or None
        """
        try:
            query = f'track:{title}'
            if artist:
                query += f' artist:{artist}'

            results = self.spotify.search(q=query, type='track', limit=limit)

            if results['tracks']['items']:
                track = results['tracks']['items'][0]
                artists = [artist['name'] for artist in track.get('artists', [])]

                return {
                    'spotify_track_id': track.get('id'),
                    'title': track.get('name'),
                    'artist': ', '.join(artists),
                    'album': track['album'].get('name'),
                    'duration_ms': track.get('duration_ms'),
                    'spotify_url': track['external_urls'].get('spotify')
                }

            return None

        except Exception as e:
            logger.error(f"Error searching for track '{title}' by '{artist}': {e}")
            return None
