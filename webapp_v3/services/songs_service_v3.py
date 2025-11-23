"""
Band Practice Pro v3 - Songs Service
Manages songs with playlist reference tracking
"""

import logging
from datetime import datetime
from typing import Dict, List, Optional
from firebase_admin import firestore

logger = logging.getLogger(__name__)

class SongsService:
    """Service for managing songs in Firestore with playlist reference tracking"""

    def __init__(self):
        self.db = firestore.client()
        self.songs_collection = 'songs_v3'

    def batch_create_or_update_songs(
        self,
        collection_id: str,
        playlist_id: str,
        tracks_data: List[Dict],
        user_id: str
    ) -> Dict[str, int]:
        """
        Batch create or update multiple songs efficiently using Firestore batch operations.
        Much faster than calling create_or_update_song() in a loop.

        Args:
            collection_id: Collection these songs belong to
            playlist_id: Playlist that contains these songs
            tracks_data: List of dicts with track metadata and position
            user_id: User creating the songs

        Returns:
            Dict with 'created' and 'updated' counts
        """
        try:
            created_count = 0
            updated_count = 0

            # Step 1: Query all existing songs in this collection
            # This is ONE query instead of N queries
            existing_songs_query = (self.db.collection(self.songs_collection)
                                   .where('collection_id', '==', collection_id))
            existing_songs = {doc.to_dict()['spotify_track_id']: (doc.id, doc.to_dict()) 
                           for doc in existing_songs_query.stream()}

            # Step 2: Prepare batch write
            batch = self.db.batch()
            batch_count = 0

            for track_info in tracks_data:
                track_data = track_info['track']
                position = track_info['position']
                spotify_track_id = track_data.get('spotify_track_id')

                if not spotify_track_id:
                    logger.warning(f"Skipping track without spotify_track_id: {track_data.get('title')}")
                    continue

                if spotify_track_id in existing_songs:
                    # Song exists - update it
                    song_id, song_data = existing_songs[spotify_track_id]
                    source_playlists = song_data.get('source_playlist_ids', [])
                    playlist_positions = song_data.get('playlist_positions', {})

                    # Add this playlist if not already there
                    if playlist_id not in source_playlists:
                        source_playlists.append(playlist_id)

                    # Update position
                    playlist_positions[playlist_id] = position

                    # Add to batch
                    doc_ref = self.db.collection(self.songs_collection).document(song_id)
                    batch.update(doc_ref, {
                        'source_playlist_ids': source_playlists,
                        'playlist_positions': playlist_positions,
                        'updated_at': datetime.utcnow()
                    })
                    updated_count += 1
                    batch_count += 1

                else:
                    # Create new song
                    song_data = {
                        'collection_id': collection_id,
                        'title': track_data.get('title', 'Unknown'),
                        'artist': track_data.get('artist', 'Unknown'),
                        'album': track_data.get('album', ''),
                        'year': track_data.get('year', ''),
                        'album_art_url': track_data.get('album_art_url', ''),
                        'spotify_track_id': spotify_track_id,
                        'spotify_uri': track_data.get('spotify_uri', ''),
                        'spotify_url': track_data.get('spotify_url', ''),
                        'duration_ms': track_data.get('duration_ms', 0),

                        # Lyrics (to be fetched in Phase 4)
                        'lyrics': '',
                        'lyrics_numbered': '',
                        'lyrics_fetched': False,
                        'is_customized': False,

                        # BPM (to be fetched)
                        'bpm': 'N/A',

                        # Practice notes
                        'notes': '',

                        # Playlist tracking (V2 pattern)
                        'source_playlist_ids': [playlist_id],
                        'playlist_positions': {playlist_id: position},
                        
                        # Orphaned status
                        'is_orphaned': False,

                        # Metadata
                        'created_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow(),
                        'created_by_uid': user_id
                    }

                    # Add to batch
                    doc_ref = self.db.collection(self.songs_collection).document()
                    batch.set(doc_ref, song_data)
                    created_count += 1
                    batch_count += 1

                # Commit batch every 500 operations (Firestore limit)
                if batch_count >= 500:
                    batch.commit()
                    batch = self.db.batch()
                    batch_count = 0

            # Commit remaining operations
            if batch_count > 0:
                batch.commit()

            logger.info(f"Batch imported {created_count} new songs, updated {updated_count} existing songs")
            return {
                'created': created_count,
                'updated': updated_count
            }

        except Exception as e:
            logger.error(f"Error in batch_create_or_update_songs: {e}")
            raise

    def create_or_update_song(
        self, 
        collection_id: str, 
        playlist_id: str, 
        track_data: Dict, 
        position: int,
        user_id: str
    ) -> str:
        """
        Create a new song or update an existing one with playlist reference.
        Songs are identified by collection_id + spotify_track_id to allow same song
        in multiple collections.

        Args:
            collection_id: Collection this song belongs to
            playlist_id: Playlist that contains this song
            track_data: Dict with track metadata (title, artist, spotify_track_id, etc.)
            position: Position in the playlist (for ordering)
            user_id: User creating the song

        Returns:
            Song document ID
        """
        try:
            spotify_track_id = track_data.get('spotify_track_id')
            
            if not spotify_track_id:
                raise ValueError("Missing spotify_track_id in track_data")

            # Query for existing song in this collection with same Spotify track
            query = (self.db.collection(self.songs_collection)
                    .where('collection_id', '==', collection_id)
                    .where('spotify_track_id', '==', spotify_track_id)
                    .limit(1))

            existing_docs = list(query.stream())

            if existing_docs:
                # Song exists - update source_playlist_ids and playlist_positions
                doc = existing_docs[0]
                song_data = doc.to_dict()
                song_id = doc.id

                source_playlists = song_data.get('source_playlist_ids', [])
                playlist_positions = song_data.get('playlist_positions', {})

                # Add this playlist to sources if not already there
                if playlist_id not in source_playlists:
                    source_playlists.append(playlist_id)

                # Update position for this playlist
                playlist_positions[playlist_id] = position

                # Update the document
                self.db.collection(self.songs_collection).document(song_id).update({
                    'source_playlist_ids': source_playlists,
                    'playlist_positions': playlist_positions,
                    'updated_at': datetime.utcnow()
                })

                logger.info(f"Updated song {song_id} with playlist {playlist_id}")
                return song_id

            else:
                # Create new song
                song_data = {
                    'collection_id': collection_id,
                    'title': track_data.get('title', 'Unknown'),
                    'artist': track_data.get('artist', 'Unknown'),
                    'album': track_data.get('album', ''),
                    'year': track_data.get('year', ''),
                    'album_art_url': track_data.get('album_art_url', ''),
                    'spotify_track_id': spotify_track_id,
                    'spotify_uri': track_data.get('spotify_uri', ''),
                    'spotify_url': track_data.get('spotify_url', ''),
                    'duration_ms': track_data.get('duration_ms', 0),
                    
                    # Lyrics (to be fetched in Phase 4)
                    'lyrics': '',
                    'lyrics_numbered': '',
                    'lyrics_fetched': False,
                    'is_customized': False,
                    
                    # BPM (to be fetched)
                    'bpm': 'N/A',
                    
                    # Practice notes
                    'notes': '',
                    
                    # Playlist tracking (V2 pattern)
                    'source_playlist_ids': [playlist_id],
                    'playlist_positions': {playlist_id: position},
                    
                    # Orphaned status
                    'is_orphaned': False,
                    
                    # Metadata
                    'created_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow(),
                    'created_by_uid': user_id
                }

                doc_ref = self.db.collection(self.songs_collection).document()
                doc_ref.set(song_data)

                logger.info(f"Created song {doc_ref.id} for playlist {playlist_id}")
                return doc_ref.id

        except Exception as e:
            logger.error(f"Error creating/updating song: {e}")
            raise

    def remove_playlist_from_song(self, song_id: str, playlist_id: str) -> bool:
        """
        Remove a playlist reference from a song. If the song has no more playlist
        references after removal, delete the song entirely.

        Args:
            song_id: Song document ID
            playlist_id: Playlist ID to remove

        Returns:
            True if song was deleted, False if just updated
        """
        try:
            doc_ref = self.db.collection(self.songs_collection).document(song_id)
            doc = doc_ref.get()

            if not doc.exists:
                logger.warning(f"Song {song_id} not found")
                return False

            song_data = doc.to_dict()
            source_playlists = song_data.get('source_playlist_ids', [])
            playlist_positions = song_data.get('playlist_positions', {})

            # Remove playlist from sources
            if playlist_id in source_playlists:
                source_playlists.remove(playlist_id)

            # Remove position for this playlist
            if playlist_id in playlist_positions:
                del playlist_positions[playlist_id]

            # If no more playlists reference this song, delete it
            if not source_playlists:
                doc_ref.delete()
                logger.info(f"Deleted song {song_id} (no more playlist references)")
                return True
            else:
                # Update the song
                doc_ref.update({
                    'source_playlist_ids': source_playlists,
                    'playlist_positions': playlist_positions,
                    'updated_at': datetime.utcnow()
                })
                logger.info(f"Removed playlist {playlist_id} from song {song_id}")
                return False

        except Exception as e:
            logger.error(f"Error removing playlist from song: {e}")
            raise

    def delete_songs_in_collection(self, collection_id: str) -> int:
        """
        Delete all songs in a collection.

        Args:
            collection_id: Collection ID

        Returns:
            Number of songs deleted
        """
        try:
            # Query all songs in this collection
            query = self.db.collection(self.songs_collection).where('collection_id', '==', collection_id)
            docs = list(query.stream())

            # Delete in batches (Firestore limit is 500 per batch)
            batch = self.db.batch()
            count = 0

            for doc in docs:
                batch.delete(doc.reference)
                count += 1

                # Commit batch every 500 documents
                if count % 500 == 0:
                    batch.commit()
                    batch = self.db.batch()

            # Commit remaining
            if count % 500 != 0:
                batch.commit()

            logger.info(f"Deleted {count} songs from collection {collection_id}")
            return count

        except Exception as e:
            logger.error(f"Error deleting songs in collection: {e}")
            raise

    def delete_songs_for_playlist(self, collection_id: str, playlist_id: str) -> Dict[str, int]:
        """
        Remove playlist reference from all songs in a collection that reference this playlist.
        Deletes songs that have no other playlist references.

        Args:
            collection_id: Collection ID
            playlist_id: Playlist ID to remove

        Returns:
            Dict with 'deleted' and 'updated' counts
        """
        try:
            # Query all songs in this collection that reference this playlist
            # Requires composite index: (collection_id, source_playlist_ids)
            query = (self.db.collection(self.songs_collection)
                    .where('collection_id', '==', collection_id)
                    .where('source_playlist_ids', 'array_contains', playlist_id))
            
            docs = list(query.stream())

            deleted_count = 0
            updated_count = 0

            for doc in docs:
                was_deleted = self.remove_playlist_from_song(doc.id, playlist_id)
                if was_deleted:
                    deleted_count += 1
                else:
                    updated_count += 1

            logger.info(f"Removed playlist {playlist_id}: deleted {deleted_count} songs, updated {updated_count} songs")
            return {
                'deleted': deleted_count,
                'updated': updated_count
            }

        except Exception as e:
            logger.error(f"Error deleting songs for playlist: {e}")
            raise

    def get_songs_in_collection(self, collection_id: str) -> List[Dict]:
        """
        Get all songs in a collection (unsorted).
        Sorting is done by the API endpoint based on collection's linked_playlists order.

        Args:
            collection_id: Collection ID

        Returns:
            List of song dicts with 'id' field
        """
        try:
            query = (self.db.collection(self.songs_collection)
                    .where('collection_id', '==', collection_id))

            docs = list(query.stream())
            songs = []

            for doc in docs:
                song_data = doc.to_dict()
                song_data['id'] = doc.id
                songs.append(song_data)

            logger.info(f"Retrieved {len(songs)} songs from collection {collection_id}")
            return songs

        except Exception as e:
            logger.error(f"Error getting songs in collection: {e}")
            raise
