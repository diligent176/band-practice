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

    def get_all_songs(self):
        """Get all songs sorted by artist and title"""
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
        else:
            song_data['created_at'] = datetime.utcnow()
            song_data['updated_at'] = datetime.utcnow()
            if 'notes' not in song_data:
                song_data['notes'] = ''

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

    def delete_song(self, song_id):
        """Delete a song"""
        self.db.collection(self.songs_collection).document(song_id).delete()

    def song_exists(self, song_id):
        """Check if a song exists"""
        return self.db.collection(self.songs_collection).document(song_id).get().exists
