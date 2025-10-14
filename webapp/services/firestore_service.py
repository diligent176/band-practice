"""
Firestore service for managing songs and notes
"""

from google.cloud import firestore
from datetime import datetime
import os


class FirestoreService:
    def __init__(self):
        """Initialize Firestore client"""
        project_id = os.getenv('GCP_PROJECT_ID')
        self.db = firestore.Client(project=project_id) if project_id else firestore.Client()
        self.songs_collection = 'songs'
        self.playlist_memory_collection = 'playlist_memory'
        self.collections_collection = 'collections'

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
        lyrics_numbered = LyricsService._add_line_numbers_static(lyrics)

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
        Delete a collection (does not delete associated songs)
        
        Args:
            collection_id: Collection document ID
        """
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
