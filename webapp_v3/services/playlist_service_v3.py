"""
Band Practice Pro v3 - Playlist Service
Handles Spotify playlist import and playlist memory (recent playlists)
"""

from datetime import datetime
from typing import Dict, List, Optional
import hashlib
import re
from google.cloud import firestore


class PlaylistServiceV3:
    """Service for managing Spotify playlist imports and memory"""

    def __init__(self, firestore_db, spotify_client=None):
        """
        Initialize Playlist Service

        Args:
            firestore_db: Firebase Firestore database instance
            spotify_client: Optional Spotipy client for fetching playlist data
        """
        self.db = firestore_db
        self.spotify = spotify_client
        self.playlist_memory_collection = 'playlist_memory_v3'

    def extract_playlist_id(self, playlist_url: str) -> Optional[str]:
        """
        Extract Spotify playlist ID from URL

        Args:
            playlist_url: Spotify playlist URL (various formats supported)

        Returns:
            Playlist ID string or None if invalid
        """
        # Support various URL formats:
        # https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
        # https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
        # spotify:playlist:37i9dQZF1DXcBWIGoYBM5M

        if not playlist_url:
            return None

        # Try URL format
        match = re.search(r'playlist[/:]([a-zA-Z0-9]+)', playlist_url)
        if match:
            return match.group(1)

        # Maybe it's just the ID already?
        if re.match(r'^[a-zA-Z0-9]+$', playlist_url):
            return playlist_url

        return None

    def save_playlist_memory(self, user_uid: str, playlist_id: str, playlist_data: Dict) -> None:
        """
        Save or update playlist memory for a user

        Args:
            user_uid: User's Firebase UID
            playlist_id: Spotify playlist ID
            playlist_data: Dict containing playlist_name, playlist_owner, track_count, image_url, playlist_url
        """
        doc_ref = self.db.collection(self.playlist_memory_collection).document(playlist_id)

        # Get existing document to preserve access_count
        existing = doc_ref.get()
        access_count = 1

        if existing.exists:
            existing_data = existing.to_dict()
            # Only increment if it's the same user
            if existing_data.get('user_uid') == user_uid:
                access_count = existing_data.get('access_count', 0) + 1

        memory_data = {
            'user_uid': user_uid,
            'playlist_url': playlist_data.get('playlist_url', ''),
            'playlist_name': playlist_data.get('playlist_name', 'Untitled Playlist'),
            'playlist_owner': playlist_data.get('playlist_owner', ''),
            'track_count': playlist_data.get('track_count', 0),
            'image_url': playlist_data.get('image_url', ''),
            'last_accessed_at': datetime.utcnow(),
            'access_count': access_count
        }

        doc_ref.set(memory_data, merge=True)

    def get_recent_playlists(self, user_uid: str, limit: int = 10) -> List[Dict]:
        """
        Get user's recent playlists, sorted by last_accessed_at

        Args:
            user_uid: User's Firebase UID
            limit: Max number of playlists to return

        Returns:
            List of playlist memory dicts
        """
        docs = (self.db.collection(self.playlist_memory_collection)
                .where('user_uid', '==', user_uid)
                .order_by('last_accessed_at', direction='DESCENDING')
                .limit(limit)
                .stream())

        playlists = []
        for doc in docs:
            data = doc.to_dict()
            data['id'] = doc.id
            playlists.append(data)

        return playlists

    def fetch_playlist_from_spotify(self, playlist_id: str) -> Optional[Dict]:
        """
        Fetch playlist metadata from Spotify API

        Args:
            playlist_id: Spotify playlist ID

        Returns:
            Dict with playlist metadata or None if error
        """
        if not self.spotify:
            raise ValueError('Spotify client not configured')

        try:
            playlist = self.spotify.playlist(playlist_id)

            return {
                'playlist_id': playlist_id,
                'playlist_url': playlist['external_urls']['spotify'],
                'playlist_name': playlist['name'],
                'playlist_owner': playlist['owner']['display_name'],
                'track_count': playlist['tracks']['total'],
                'image_url': playlist['images'][0]['url'] if playlist['images'] else '',
                'description': playlist.get('description', '')
            }
        except Exception as e:
            print(f'Error fetching playlist from Spotify: {e}')
            return None

    def fetch_playlist_tracks(self, playlist_id: str) -> List[Dict]:
        """
        Fetch all tracks from a Spotify playlist

        Args:
            playlist_id: Spotify playlist ID

        Returns:
            List of track dicts with artist, title, spotify_uri, duration_ms, etc.
        """
        if not self.spotify:
            raise ValueError('Spotify client not configured')

        tracks = []
        offset = 0
        limit = 100  # Max allowed by Spotify API

        while True:
            try:
                results = self.spotify.playlist_tracks(
                    playlist_id,
                    offset=offset,
                    limit=limit,
                    fields='items(track(name,artists,uri,duration_ms,album(name,images),external_urls)),next'
                )

                for item in results['items']:
                    track = item.get('track')
                    if not track:
                        continue

                    # Handle track data
                    artists = ', '.join([artist['name'] for artist in track.get('artists', [])])

                    track_data = {
                        'title': track.get('name', 'Unknown'),
                        'artist': artists or 'Unknown',
                        'spotify_uri': track.get('uri', ''),
                        'spotify_url': track.get('external_urls', {}).get('spotify', ''),
                        'duration_ms': track.get('duration_ms', 0),
                        'album': track.get('album', {}).get('name', ''),
                        'album_art_url': track.get('album', {}).get('images', [{}])[0].get('url', '') if track.get('album', {}).get('images') else ''
                    }

                    tracks.append(track_data)

                # Check if there are more tracks
                if not results.get('next'):
                    break

                offset += limit

            except Exception as e:
                print(f'Error fetching playlist tracks: {e}')
                break

        return tracks

    def import_playlist_to_collection(self, user_uid: str, collection_id: str, playlist_url: str) -> Dict:
        """
        Import a Spotify playlist into a collection
        1. Extract playlist ID from URL
        2. Fetch playlist metadata from Spotify
        3. Save to playlist memory
        4. Fetch all tracks
        5. Create song documents in songs_v3
        6. Update collection's linked_playlists array

        Args:
            user_uid: User's Firebase UID
            collection_id: Collection document ID
            playlist_url: Spotify playlist URL

        Returns:
            Dict with import results (track_count, playlist_name, etc.)
        """
        # Extract playlist ID
        playlist_id = self.extract_playlist_id(playlist_url)
        if not playlist_id:
            raise ValueError('Invalid Spotify playlist URL')

        # Fetch playlist metadata
        playlist_data = self.fetch_playlist_from_spotify(playlist_id)
        if not playlist_data:
            raise ValueError('Failed to fetch playlist from Spotify')

        # Save to playlist memory
        self.save_playlist_memory(user_uid, playlist_id, playlist_data)

        # Fetch tracks
        tracks = self.fetch_playlist_tracks(playlist_id)

        # TODO: Create song documents in songs_v3 collection
        # This will be implemented in Phase 3/4 when we have lyrics service
        # For now, just update the collection's linked_playlists array

        # Update collection
        collection_ref = self.db.collection('collections_v3').document(collection_id)

        # Get current song count and add new tracks
        collection_doc = collection_ref.get()
        if collection_doc.exists:
            current_song_count = collection_doc.to_dict().get('song_count', 0)
            new_song_count = current_song_count + len(tracks)
        else:
            new_song_count = len(tracks)

        collection_ref.update({
            'linked_playlists': firestore.ArrayUnion([{
                'playlist_id': playlist_id,
                'playlist_name': playlist_data['playlist_name'],
                'playlist_url': playlist_url,
                'track_count': len(tracks),
                'image_url': playlist_data.get('image_url', ''),
                'linked_at': datetime.utcnow()
            }]),
            'song_count': new_song_count,
            'updated_at': datetime.utcnow()
        })

        return {
            'playlist_id': playlist_id,
            'playlist_name': playlist_data['playlist_name'],
            'track_count': len(tracks),
            'tracks_imported': len(tracks)
        }
