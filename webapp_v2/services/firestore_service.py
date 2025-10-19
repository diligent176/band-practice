"""
Firestore service for managing songs and notes
"""

from google.cloud import firestore
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)


class FirestoreService:
    def __init__(self):
        """Initialize Firestore client"""
        project_id = os.getenv('GCP_PROJECT_ID')
        self.db = firestore.Client(project=project_id) if project_id else firestore.Client()
        self.songs_collection = 'songs_v2'
        self.playlist_memory_collection = 'playlist_memory_v2'
        self.collections_collection = 'collections_v2'

    def get_all_songs(self, collection_id=None):
        """
        Get all songs, optionally filtered by collection_id, sorted by artist and title
        
        Args:
            collection_id: Optional collection ID to filter by
            
        Returns:
            List of song documents
        """
        if collection_id:
            docs = (self.db.collection(self.songs_collection)
                    .where('collection_id', '==', collection_id)
                    .stream())
        else:
            docs = self.db.collection(self.songs_collection).stream()

        songs = []
        for doc in docs:
            song_data = doc.to_dict()
            song_data['id'] = doc.id
            songs.append(song_data)

        # Sort by artist, then title
        songs.sort(key=lambda x: (x.get('artist', ''), x.get('title', '')))
        return songs

    def get_song(self, song_id):
        """Get a specific song by ID"""
        doc = self.db.collection(self.songs_collection).document(song_id).get()

        if not doc.exists:
            return None

        song_data = doc.to_dict()
        song_data['id'] = doc.id
        return song_data

    def create_or_update_song(self, song_id, song_data):
        """Create or update a song document"""
        doc_ref = self.db.collection(self.songs_collection).document(song_id)

        # Add timestamps
        existing = doc_ref.get()
        if existing.exists:
            song_data['updated_at'] = datetime.utcnow()
            # Preserve existing notes if not in new data
            existing_data = existing.to_dict()
            if 'notes' not in song_data and 'notes' in existing_data:
                song_data['notes'] = existing_data['notes']
            # Preserve existing collection_id if not in new data
            if 'collection_id' not in song_data and 'collection_id' in existing_data:
                song_data['collection_id'] = existing_data['collection_id']
        else:
            song_data['created_at'] = datetime.utcnow()
            song_data['updated_at'] = datetime.utcnow()
            if 'notes' not in song_data:
                song_data['notes'] = ''
            # If no collection_id is provided for a new song, it should be set by the caller
            # (we don't set a default here to avoid issues)

        doc_ref.set(song_data, merge=True)
        return song_id

    def update_notes(self, song_id, notes):
        """Update only the notes field for a song"""
        doc_ref = self.db.collection(self.songs_collection).document(song_id)

        if not doc_ref.get().exists:
            raise ValueError(f"Song {song_id} not found")

        doc_ref.update({
            'notes': notes,
            'notes_updated_at': datetime.utcnow()
        })

    def update_lyrics(self, song_id, lyrics, is_customized=False):
        """Update lyrics for a song and mark as customized"""
        doc_ref = self.db.collection(self.songs_collection).document(song_id)

        if not doc_ref.get().exists:
            raise ValueError(f"Song {song_id} not found")

        # Re-number the lyrics
        from services.lyrics_service import LyricsService
        lyrics_numbered = LyricsService._add_line_numbers(lyrics)

        doc_ref.update({
            'lyrics': lyrics,
            'lyrics_numbered': lyrics_numbered,
            'is_customized': is_customized,
            'lyrics_updated_at': datetime.utcnow()
        })

    def update_bpm(self, song_id, bpm, is_manual=False):
        """Update BPM for a song (manual override or lookup result)"""
        doc_ref = self.db.collection(self.songs_collection).document(song_id)

        if not doc_ref.get().exists:
            raise ValueError(f"Song {song_id} not found")

        doc_ref.update({
            'bpm': bpm,
            'bpm_manual': is_manual,
            'bpm_updated_at': datetime.utcnow()
        })

    def delete_song(self, song_id):
        """Delete a song"""
        self.db.collection(self.songs_collection).document(song_id).delete()

    def song_exists(self, song_id):
        """Check if a song exists"""
        return self.db.collection(self.songs_collection).document(song_id).get().exists

    # Playlist Memory Methods

    def save_playlist_memory(self, user_id, playlist_id, playlist_data):
        """
        Save or update playlist memory for a user

        Args:
            user_id: User's email or ID
            playlist_id: Spotify playlist ID
            playlist_data: Dict containing name, owner, total_tracks, image_url, playlist_url
        """
        doc_ref = self.db.collection(self.playlist_memory_collection).document(playlist_id)

        # Get existing document to preserve access_count
        existing = doc_ref.get()
        access_count = 1

        if existing.exists:
            existing_data = existing.to_dict()
            access_count = existing_data.get('access_count', 0) + 1

        memory_data = {
            'user_id': user_id,
            'playlist_url': playlist_data.get('playlist_url', ''),
            'name': playlist_data.get('name', ''),
            'owner': playlist_data.get('owner', ''),
            'total_tracks': playlist_data.get('total_tracks', 0),
            'image_url': playlist_data.get('image_url', ''),
            'last_accessed': datetime.utcnow(),
            'access_count': access_count
        }

        doc_ref.set(memory_data, merge=True)
        return memory_data

    def get_user_playlist_memory(self, user_id, limit=10):
        """
        Get user's recently accessed playlists

        Args:
            user_id: User's email or ID
            limit: Maximum number of playlists to return (default 10)

        Returns:
            List of playlist memory documents sorted by last_accessed (most recent first)
        """
        docs = (self.db.collection(self.playlist_memory_collection)
                .where('user_id', '==', user_id)
                .order_by('last_accessed', direction=firestore.Query.DESCENDING)
                .limit(limit)
                .stream())

        playlists = []
        for doc in docs:
            playlist_data = doc.to_dict()
            playlist_data['id'] = doc.id
            playlists.append(playlist_data)

        return playlists

    def delete_playlist_memory(self, playlist_id):
        """Delete a playlist from memory"""
        self.db.collection(self.playlist_memory_collection).document(playlist_id).delete()

    # Collection Management Methods

    def get_or_create_default_collection(self, user_id):
        """
        Get or create the Default collection for a user
        
        Args:
            user_id: User's email or ID
            
        Returns:
            Dict containing collection data with 'id' field
        """
        # Query for existing default collection
        query = (self.db.collection(self.collections_collection)
                .where('user_id', '==', user_id)
                .where('name', '==', 'Default')
                .limit(1))
        
        docs = list(query.stream())
        
        if docs:
            # Default collection exists
            collection_data = docs[0].to_dict()
            collection_data['id'] = docs[0].id
            return collection_data
        else:
            # Create default collection
            collection_data = {
                'user_id': user_id,
                'name': 'Default',
                'description': 'Your default song collection',
                'playlist_ids': [],  # V2: Track linked Spotify playlist IDs
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            doc_ref = self.db.collection(self.collections_collection).document()
            doc_ref.set(collection_data)
            
            collection_data['id'] = doc_ref.id
            return collection_data

    def get_user_collections(self, user_id):
        """
        Get all collections for a user, sorted by name
        
        Args:
            user_id: User's email or ID
            
        Returns:
            List of collection documents
        """
        docs = (self.db.collection(self.collections_collection)
                .where('user_id', '==', user_id)
                .order_by('name', direction=firestore.Query.ASCENDING)
                .stream())
        
        collections = []
        for doc in docs:
            collection_data = doc.to_dict()
            collection_data['id'] = doc.id
            collections.append(collection_data)
        
        return collections

    def get_collection(self, collection_id):
        """
        Get a specific collection by ID
        
        Args:
            collection_id: Collection document ID
            
        Returns:
            Dict containing collection data with 'id' field, or None if not found
        """
        doc = self.db.collection(self.collections_collection).document(collection_id).get()
        
        if not doc.exists:
            return None
        
        collection_data = doc.to_dict()
        collection_data['id'] = doc.id
        return collection_data

    def create_collection(self, user_id, name, description=''):
        """
        Create a new collection for a user
        
        Args:
            user_id: User's email or ID
            name: Name of the collection
            description: Optional description
            
        Returns:
            Dict containing the created collection data with 'id' field
        """
        collection_data = {
            'user_id': user_id,
            'name': name,
            'description': description,
            'playlist_ids': [],  # V2: Track linked Spotify playlist IDs
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        doc_ref = self.db.collection(self.collections_collection).document()
        doc_ref.set(collection_data)
        
        collection_data['id'] = doc_ref.id
        return collection_data

    def update_collection(self, collection_id, name=None, description=None):
        """
        Update a collection's name and/or description
        
        Args:
            collection_id: Collection document ID
            name: New name (optional)
            description: New description (optional)
        """
        doc_ref = self.db.collection(self.collections_collection).document(collection_id)
        
        if not doc_ref.get().exists:
            raise ValueError(f"Collection {collection_id} not found")
        
        update_data = {'updated_at': datetime.utcnow()}
        
        if name is not None:
            update_data['name'] = name
        if description is not None:
            update_data['description'] = description
        
        doc_ref.update(update_data)

    def delete_collection(self, collection_id):
        """
        Delete a collection AND all associated songs
        
        Args:
            collection_id: Collection document ID
        """
        # First, delete all songs in this collection
        songs = self.get_songs_by_collection(collection_id)
        for song in songs:
            self.delete_song(song['id'])
        
        # Then delete the collection itself
        self.db.collection(self.collections_collection).document(collection_id).delete()

    def get_songs_by_collection(self, collection_id):
        """
        Get all songs in a specific collection, sorted by artist and title
        
        Args:
            collection_id: Collection document ID
            
        Returns:
            List of song documents
        """
        docs = (self.db.collection(self.songs_collection)
                .where('collection_id', '==', collection_id)
                .order_by('artist', direction=firestore.Query.ASCENDING)
                .order_by('title', direction=firestore.Query.ASCENDING)
                .stream())
        
        songs = []
        for doc in docs:
            song_data = doc.to_dict()
            song_data['id'] = doc.id
            songs.append(song_data)
        
        return songs

    def count_songs_by_collection(self, collection_id):
        """
        Count songs in a specific collection (more efficient than fetching all data)

        Args:
            collection_id: Collection document ID

        Returns:
            Integer count of songs
        """
        # Fetch document IDs only (minimal data transfer) and count
        query = (self.db.collection(self.songs_collection)
                .where('collection_id', '==', collection_id)
                .select([]))  # Empty select = only document IDs, no field data

        return len(list(query.stream()))

    # =========================================================================
    # V2: Playlist Linking Methods
    # =========================================================================

    def link_playlist_to_collection(self, collection_id, playlist_id, playlist_data):
        """
        Link a Spotify playlist to a collection
        
        Args:
            collection_id: Collection document ID
            playlist_id: Spotify playlist ID
            playlist_data: Dict with playlist metadata (name, owner, image_url, etc.)
            
        Returns:
            Updated collection document
        """
        doc_ref = self.db.collection(self.collections_collection).document(collection_id)
        collection = doc_ref.get()
        
        if not collection.exists:
            raise ValueError(f"Collection {collection_id} not found")
        
        collection_data = collection.to_dict()
        playlist_ids = collection_data.get('playlist_ids', [])
        
        # Add playlist_id if not already linked
        if playlist_id not in playlist_ids:
            playlist_ids.append(playlist_id)
            doc_ref.update({
                'playlist_ids': playlist_ids,
                'updated_at': datetime.utcnow()
            })
        
        # Update playlist memory to track which collections link to this playlist
        self._update_playlist_collection_links(playlist_id, collection_id, link=True)
        
        # Return updated collection
        collection_data['playlist_ids'] = playlist_ids
        collection_data['id'] = collection_id
        return collection_data

    def unlink_playlist_from_collection(self, collection_id, playlist_id):
        """
        Unlink a Spotify playlist from a collection
        
        Args:
            collection_id: Collection document ID
            playlist_id: Spotify playlist ID
            
        Returns:
            List of song IDs that were marked as removed
        """
        doc_ref = self.db.collection(self.collections_collection).document(collection_id)
        collection = doc_ref.get()
        
        if not collection.exists:
            raise ValueError(f"Collection {collection_id} not found")
        
        collection_data = collection.to_dict()
        playlist_ids = collection_data.get('playlist_ids', [])
        
        # Remove playlist_id
        if playlist_id in playlist_ids:
            playlist_ids.remove(playlist_id)
            doc_ref.update({
                'playlist_ids': playlist_ids,
                'updated_at': datetime.utcnow()
            })
        
        # Update playlist memory
        self._update_playlist_collection_links(playlist_id, collection_id, link=False)
        
        # Mark songs as removed if they're not in any other linked playlists
        # (This will be handled by the sync logic in lyrics_service)
        
        return playlist_ids

    def get_collection_playlists(self, collection_id):
        """
        Get all playlists linked to a collection with their metadata
        
        Args:
            collection_id: Collection document ID
            
        Returns:
            List of playlist documents with metadata
        """
        collection = self.get_collection(collection_id)
        if not collection:
            return []
        
        playlist_ids = collection.get('playlist_ids', [])
        playlists = []
        
        for playlist_id in playlist_ids:
            doc = self.db.collection(self.playlist_memory_collection).document(playlist_id).get()
            if doc.exists:
                playlist_data = doc.to_dict()
                playlist_data['id'] = doc.id
                playlists.append(playlist_data)
        
        return playlists

    def _update_playlist_collection_links(self, playlist_id, collection_id, link=True):
        """
        Update the linked_collection_ids array in playlist_memory
        
        Args:
            playlist_id: Spotify playlist ID
            collection_id: Collection ID to add/remove
            link: True to add, False to remove
        """
        doc_ref = self.db.collection(self.playlist_memory_collection).document(playlist_id)
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            linked_collections = data.get('linked_collection_ids', [])
            
            if link:
                if collection_id not in linked_collections:
                    linked_collections.append(collection_id)
            else:
                if collection_id in linked_collections:
                    linked_collections.remove(collection_id)
            
            doc_ref.update({
                'linked_collection_ids': linked_collections
            })

    # =========================================================================
    # V2: Song Retrieval with Sorting
    # =========================================================================

    def get_songs_sorted_by_name(self, collection_id):
        """
        Get songs sorted by title (ascending)
        
        Args:
            collection_id: Collection document ID
            
        Returns:
            List of song documents sorted by title
        """
        docs = (self.db.collection(self.songs_collection)
                .where('collection_id', '==', collection_id)
                .order_by('title', direction=firestore.Query.ASCENDING)
                .stream())
        
        songs = []
        for doc in docs:
            song_data = doc.to_dict()
            song_data['id'] = doc.id
            songs.append(song_data)
        
        return songs

    def get_songs_sorted_by_artist(self, collection_id):
        """
        Get songs sorted by artist, then title (ascending)
        
        Args:
            collection_id: Collection document ID
            
        Returns:
            List of song documents sorted by artist and title
        """
        docs = (self.db.collection(self.songs_collection)
                .where('collection_id', '==', collection_id)
                .order_by('artist', direction=firestore.Query.ASCENDING)
                .order_by('title', direction=firestore.Query.ASCENDING)
                .stream())
        
        songs = []
        for doc in docs:
            song_data = doc.to_dict()
            song_data['id'] = doc.id
            songs.append(song_data)
        
        return songs

    def get_songs_sorted_by_playlist(self, collection_id):
        """
        Get songs grouped by playlist, maintaining Spotify's natural order
        
        Args:
            collection_id: Collection document ID
            
        Returns:
            Dict with structure:
            {
                'playlists': [
                    {
                        'id': 'playlist_id',
                        'name': 'Playlist Name',
                        'image_url': '...',
                        'songs': [song1, song2, ...]  # Ordered by playlist_position
                    },
                    ...
                ]
            }
        """
        # Get all songs in collection
        docs = (self.db.collection(self.songs_collection)
                .where('collection_id', '==', collection_id)
                .stream())
        
        songs = []
        for doc in docs:
            song_data = doc.to_dict()
            song_data['id'] = doc.id
            songs.append(song_data)
        
        # Get collection playlists
        playlists_data = self.get_collection_playlists(collection_id)
        
        # Group songs by their source playlists
        result = {'playlists': []}
        
        for playlist in playlists_data:
            playlist_id = playlist['id']
            playlist_songs = []
            
            for song in songs:
                # Check if this playlist is in the song's source_playlist_ids
                source_playlists = song.get('source_playlist_ids', [])
                if playlist_id in source_playlists:
                    # Get the playlist-specific position
                    playlist_positions = song.get('playlist_positions', {})
                    position = playlist_positions.get(playlist_id, 999999)  # Default high number if not found
                    song_copy = song.copy()
                    song_copy['_sort_position'] = position
                    playlist_songs.append(song_copy)
            
            # Sort songs by their position in this playlist
            playlist_songs.sort(key=lambda x: x.get('_sort_position', 999999))
            
            # Remove the temporary sort field
            for song in playlist_songs:
                if '_sort_position' in song:
                    del song['_sort_position']
            
            if playlist_songs:  # Only add playlist if it has songs
                result['playlists'].append({
                    'id': playlist_id,
                    'name': playlist.get('name', 'Unknown Playlist'),
                    'image_url': playlist.get('image_url', ''),
                    'owner': playlist.get('owner', ''),
                    'songs': playlist_songs
                })
        
        return result

    # =========================================================================
    # Spotify OAuth Token Management
    # =========================================================================

    def save_spotify_token(self, user_id, token_data):
        """
        Save Spotify OAuth token for user
        
        Args:
            user_id: User email
            token_data: Dict containing access_token, refresh_token, expires_at, etc.
        """
        doc_ref = self.db.collection('spotify_tokens').document(user_id)
        doc_ref.set(token_data)

    def get_spotify_token(self, user_id):
        """
        Get Spotify OAuth token for user
        
        Args:
            user_id: User email
            
        Returns:
            Dict containing token data or None if not found
        """
        doc_ref = self.db.collection('spotify_tokens').document(user_id)
        doc = doc_ref.get()
        
        if doc.exists:
            return doc.to_dict()
        return None

    def delete_spotify_token(self, user_id):
        """
        Delete Spotify OAuth token (disconnect)
        
        Args:
            user_id: User email
        """
        doc_ref = self.db.collection('spotify_tokens').document(user_id)
        doc_ref.delete()

    def save_oauth_state(self, user_id, state):
        """
        Save OAuth state token for CSRF protection
        
        Args:
            user_id: User email
            state: Random state token
        """
        doc_ref = self.db.collection('oauth_states').document(state)
        doc_ref.set({
            'user_id': user_id,
            'created_at': firestore.SERVER_TIMESTAMP
        })

    def verify_oauth_state(self, state):
        """
        Verify OAuth state token and return associated user_id
        
        Args:
            state: State token to verify
            
        Returns:
            str: User ID if valid, None otherwise
        """
        doc_ref = self.db.collection('oauth_states').document(state)
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            # Delete the state token (one-time use)
            doc_ref.delete()
            
            # Check if token is recent (within 1 hour for now, change to 600 later)
            created_at = data.get('created_at')
            if created_at:
                # Firestore timestamps are timezone-aware, convert to naive UTC for comparison
                now_utc = datetime.utcnow()
                created_utc = created_at.replace(tzinfo=None) if created_at.tzinfo else created_at
                age = (now_utc - created_utc).total_seconds()
                logger.info(f"State token age: {age} seconds")
                if age < 3600:  # 1 HOUR for debugging
                    logger.info(f"✅ State token valid, returning user_id: {data.get('user_id')}")
                    return data.get('user_id')
                else:
                    logger.error(f"❌ State token expired (age: {age}s)")
        
        logger.error(f"❌ State verification failed for token: {state[:20]}...")
        return None
