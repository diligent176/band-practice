"""
Band Practice Pro v3 - Main Flask Application
Clean architecture, PWA support, Spotify Web Playback SDK integration
"""

import logging
import os
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv

# Load .env from parent directory (project root) - same as v2
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from functools import wraps

# Import services
from services.auth_service_v3 import AuthService, initialize_firebase_admin, require_auth
from services.user_service_v3 import UserService
from services.collections_service_v3 import CollectionsService
from services.playlist_service_v3 import PlaylistServiceV3
from services.spotify_playback_service_v3 import SpotifyPlaybackService

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['FIREBASE_API_KEY'] = os.getenv('FIREBASE_API_KEY')
app.config['FIREBASE_AUTH_DOMAIN'] = os.getenv('FIREBASE_AUTH_DOMAIN')
app.config['FIREBASE_PROJECT_ID'] = os.getenv('FIREBASE_PROJECT_ID', os.getenv('GCP_PROJECT_ID'))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = app.logger

# Development mode
DEBUG = os.environ.get('FLASK_ENV') == 'development'

# Initialize Firebase Admin SDK on startup
try:
    initialize_firebase_admin()
    logger.info("✅ Firebase Admin SDK initialized")
except Exception as e:
    logger.error(f"❌ Failed to initialize Firebase Admin SDK: {e}")
    logger.warning("App will start but authentication will not work")

# ============================================================================
# ROUTES - Main Views
# ============================================================================

@app.route('/')
def index():
    """Main entry point - Shows auth gate (if not logged in) or collections (if logged in)"""
    logger.info('Index page accessed')
    return render_template('home.html')

# ============================================================================
# API ROUTES - v3 Endpoints
# ============================================================================

@app.route('/api/v3/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'version': 'v3',
        'message': 'Band Practice Pro v3 API'
    }), 200

# Auth endpoints
@app.route('/api/v3/auth/login', methods=['POST'])
def login():
    """Handle user login after Firebase authentication"""
    try:
        # Get user info from token
        user_info = AuthService.require_auth(request)

        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401

        # Get or create user in Firestore
        user = UserService.get_or_create_user(
            uid=user_info['uid'],
            email=user_info['email'],
            display_name=user_info.get('display_name'),
            photo_url=user_info.get('photo_url')
        )

        logger.info(f"User logged in: {user['email']}")

        return jsonify({
            'success': True,
            'user': user
        }), 200

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/auth/verify', methods=['POST'])
def verify_token():
    """Verify Firebase ID token"""
    try:
        data = request.get_json()
        id_token = data.get('idToken')

        if not id_token:
            return jsonify({'error': 'No token provided'}), 400

        user_info = AuthService.get_user_from_token(id_token)

        if not user_info:
            return jsonify({'error': 'Invalid token'}), 401

        return jsonify({
            'success': True,
            'user': user_info
        }), 200

    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return jsonify({'error': str(e)}), 500

# User endpoints
@app.route('/api/v3/users/me', methods=['GET'])
def get_current_user():
    """Get current user profile"""
    try:
        user_info = AuthService.require_auth(request)

        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401

        user = UserService.get_user(user_info['uid'])

        if not user:
            return jsonify({'error': 'User not found'}), 404

        return jsonify(user), 200

    except Exception as e:
        logger.error(f"Get user error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/users/<uid>', methods=['GET'])
def get_user_by_uid(uid):
    """Get user profile by UID (for displaying collaborator info)"""
    try:
        user_info = AuthService.require_auth(request)

        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401

        user = UserService.get_user(uid)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Return only public fields (don't expose sensitive data)
        public_user_data = {
            'uid': user.get('uid'),
            'display_name': user.get('display_name'),
            'photo_url': user.get('photo_url'),
            'email': user.get('email')
        }

        return jsonify(public_user_data), 200

    except Exception as e:
        logger.error(f"Get user by UID error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/users/me', methods=['PUT'])
def update_current_user():
    """Update current user profile"""
    try:
        user_info = AuthService.require_auth(request)

        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.get_json()
        updated_user = UserService.update_user(user_info['uid'], data)

        return jsonify(updated_user), 200

    except Exception as e:
        logger.error(f"Update user error: {e}")
        return jsonify({'error': str(e)}), 500

# Collections endpoints
@app.route('/api/v3/collections', methods=['GET', 'POST'])
def collections():
    """List all collections or create new collection"""
    try:
        user_info = AuthService.require_auth(request)
        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401

        collections_service = CollectionsService()

        if request.method == 'GET':
            # Ensure Personal Collection exists FIRST
            collections_service.get_or_create_personal_collection(user_info['uid'])

            # Get all collections for user (owned + shared)
            all_collections = collections_service.get_user_collections(user_info['uid'])

            return jsonify(all_collections), 200

        elif request.method == 'POST':
            # Create new collection
            data = request.get_json()
            name = data.get('name')
            description = data.get('description', '')
            is_public = data.get('is_public', False)

            if not name:
                return jsonify({'error': 'Collection name is required'}), 400

            new_collection = collections_service.create_collection(
                user_id=user_info['uid'],
                name=name,
                description=description,
                is_public=is_public
            )

            return jsonify(new_collection), 201

    except Exception as e:
        logger.error(f"Collections endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/collections/<collection_id>', methods=['GET', 'PUT', 'DELETE'])
def collection(collection_id):
    """Get, update, or delete a specific collection"""
    try:
        user_info = AuthService.require_auth(request)
        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401

        collections_service = CollectionsService()

        if request.method == 'GET':
            # Get single collection
            collection_data = collections_service.get_collection(collection_id, user_info['uid'])

            if not collection_data:
                return jsonify({'error': 'Collection not found or not authorized'}), 404

            return jsonify(collection_data), 200

        elif request.method == 'PUT':
            # Update collection
            data = request.get_json()
            updated_collection = collections_service.update_collection(
                collection_id=collection_id,
                user_id=user_info['uid'],
                updates=data
            )

            return jsonify(updated_collection), 200

        elif request.method == 'DELETE':
            # Delete collection
            collections_service.delete_collection(collection_id, user_info['uid'])
            return jsonify({'success': True}), 200

    except PermissionError as e:
        return jsonify({'error': str(e)}), 403
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Collection endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/collections/public', methods=['GET'])
def public_collections():
    """Get all public collections (excluding user's own and ones they're already collaborating on)"""
    try:
        user_info = AuthService.require_auth(request)
        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401

        collections_service = CollectionsService()
        public_collections = collections_service.get_public_collections(user_info['uid'])

        return jsonify({'collections': public_collections}), 200

    except Exception as e:
        logger.error(f"Public collections endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/collections/<collection_id>/request-access', methods=['POST'])
def request_collaboration(collection_id):
    """Request collaboration access to a public collection"""
    try:
        user_info = AuthService.require_auth(request)
        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401

        collections_service = CollectionsService()
        collections_service.request_collaboration(
            collection_id=collection_id,
            user_id=user_info['uid'],
            user_email=user_info['email'],
            user_name=user_info.get('name', user_info['email'])
        )

        return jsonify({'success': True, 'message': 'Collaboration request sent'}), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Request collaboration endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/collections/<collection_id>/accept-collaborator', methods=['POST'])
def accept_collaborator(collection_id):
    """Accept a collaboration request (owner only)"""
    try:
        user_info = AuthService.require_auth(request)
        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.get_json()
        requester_uid = data.get('requester_uid')

        if not requester_uid:
            return jsonify({'error': 'requester_uid is required'}), 400

        collections_service = CollectionsService()
        collections_service.accept_collaboration_request(
            collection_id=collection_id,
            owner_uid=user_info['uid'],
            requester_uid=requester_uid
        )

        return jsonify({'success': True, 'message': 'Collaboration request accepted'}), 200

    except PermissionError as e:
        return jsonify({'error': str(e)}), 403
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Accept collaborator endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/collections/<collection_id>/deny-collaborator', methods=['POST'])
def deny_collaborator(collection_id):
    """Deny a collaboration request (owner only)"""
    try:
        user_info = AuthService.require_auth(request)
        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.get_json()
        requester_uid = data.get('requester_uid')

        if not requester_uid:
            return jsonify({'error': 'requester_uid is required'}), 400

        collections_service = CollectionsService()
        collections_service.deny_collaboration_request(
            collection_id=collection_id,
            owner_uid=user_info['uid'],
            requester_uid=requester_uid
        )

        return jsonify({'success': True, 'message': 'Collaboration request denied'}), 200

    except PermissionError as e:
        return jsonify({'error': str(e)}), 403
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Deny collaborator endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/collections/<collection_id>/songs', methods=['GET'])
def get_collection_songs(collection_id):
    """Get all songs in a collection, sorted by playlist order"""
    try:
        user_info = AuthService.require_auth(request)
        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401

        # Initialize services
        from services.songs_service_v3 import SongsService
        collections_service = CollectionsService()
        songs_service = SongsService()

        # Verify user has access to this collection
        collection_data = collections_service.get_collection(collection_id, user_info['uid'])

        if not collection_data:
            return jsonify({'error': 'Collection not found or not authorized'}), 404

        # Get songs in this collection (unsorted from DB)
        songs = songs_service.get_songs_in_collection(collection_id)

        # Sort songs by collection's playlist order
        linked_playlists = collection_data.get('linked_playlists', [])
        playlist_order = {p['playlist_id']: idx for idx, p in enumerate(linked_playlists)}
        playlist_names = {p['playlist_id']: p.get('playlist_name', 'Unknown') for p in linked_playlists}

        # Expand songs: create one entry per playlist appearance (for playlist sort mode)
        # This allows duplicates to show when a song is in multiple playlists
        expanded_songs = []
        for song in songs:
            playlist_ids = song.get('source_playlist_ids', [])
            playlist_positions = song.get('playlist_positions', {})

            if not playlist_ids:
                # Song not linked to any playlist - include once
                expanded_songs.append(song)
            else:
                # Create an entry for each playlist the song appears in
                for pid in playlist_ids:
                    if pid in playlist_order:  # Only include if playlist is still linked
                        song_copy = dict(song)
                        song_copy['_display_playlist_id'] = pid
                        song_copy['_display_playlist_name'] = playlist_names.get(pid, 'Unknown')
                        song_copy['_display_position'] = playlist_positions.get(pid, 999999)
                        expanded_songs.append(song_copy)

        def sort_key(song):
            display_pid = song.get('_display_playlist_id')
            if display_pid:
                collection_order = playlist_order.get(display_pid, 999999)
                position_in_playlist = song.get('_display_position', 999999)
            else:
                collection_order = 999999
                position_in_playlist = 999999

            return (collection_order, position_in_playlist)

        expanded_songs.sort(key=sort_key)
        songs = expanded_songs

        # Get user's access level for this collection
        access_level = collections_service.check_user_access_level(collection_id, user_info['uid'])

        return jsonify({
            'songs': songs,
            'collection': collection_data,
            'access_level': access_level
        }), 200

    except Exception as e:
        logger.error(f"Error getting collection songs: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# Playlist endpoints
# ============================================================================

@app.route('/api/v3/playlists/recent', methods=['GET'])
@require_auth
def get_recent_playlists():
    """Get user's recent playlists from playlist memory"""
    try:
        user_id = request.user_id

        # Initialize playlist service
        from firebase_admin import firestore
        db = firestore.client()
        playlist_service = PlaylistServiceV3(db)

        # Get recent playlists
        playlists = playlist_service.get_recent_playlists(user_id, limit=10)

        return jsonify({
            'playlists': playlists
        }), 200

    except Exception as e:
        logger.error(f"Error getting recent playlists: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/playlists/import', methods=['POST'])
@require_auth
def import_playlist():
    """Import Spotify playlist to a collection"""
    try:
        user_id = request.user_id
        data = request.get_json()

        collection_id = data.get('collection_id')
        playlist_url = data.get('playlist_url')

        if not collection_id or not playlist_url:
            return jsonify({'error': 'collection_id and playlist_url required'}), 400

        # Initialize services
        from firebase_admin import firestore
        from datetime import datetime
        db = firestore.client()

        # Verify user owns the collection
        collections_service = CollectionsService()
        collection = collections_service.get_collection(collection_id, user_id)

        if not collection:
            return jsonify({'error': 'Collection not found'}), 404

        if collection['owner_uid'] != user_id:
            return jsonify({'error': 'You do not own this collection'}), 403

        # Initialize services
        playlist_service = PlaylistServiceV3(db)
        playlist_id = playlist_service.extract_playlist_id(playlist_url)

        if not playlist_id:
            return jsonify({'error': 'Invalid Spotify playlist URL'}), 400

        # Fetch playlist metadata from Spotify
        from services.spotify_service_v3 import SpotifyServiceV3
        spotify_service = SpotifyServiceV3()

        playlist_metadata = spotify_service.get_playlist_metadata(playlist_id)
        if not playlist_metadata:
            return jsonify({'error': 'Failed to fetch playlist from Spotify'}), 500

        # Fetch playlist tracks
        tracks = spotify_service.get_playlist_tracks(playlist_id)

        # Save playlist memory
        playlist_service.save_playlist_memory(user_id, playlist_id, playlist_metadata)

        # Create songs using SongsService batch operation (much faster!)
        from services.songs_service_v3 import SongsService
        songs_service = SongsService()
        
        # Prepare tracks data with positions
        tracks_with_positions = [
            {'track': track, 'position': position}
            for position, track in enumerate(tracks)
        ]
        
        # Batch create/update all songs in one operation
        result = songs_service.batch_create_or_update_songs(
            collection_id=collection_id,
            playlist_id=playlist_id,
            tracks_data=tracks_with_positions,
            user_id=user_id
        )
        
        logger.info(f"Batch import: {result['created']} created, {result['updated']} updated")

        # Calculate actual song count from database (after deduplication)
        all_songs = songs_service.get_songs_in_collection(collection_id)
        actual_song_count = len(all_songs)

        # Update collection's linked_playlists and song_count
        collection_ref = db.collection('collections_v3').document(collection_id)
        collection_ref.update({
            'linked_playlists': firestore.ArrayUnion([{
                'playlist_id': playlist_id,
                'playlist_name': playlist_metadata['playlist_name'],
                'playlist_owner': playlist_metadata['playlist_owner'],
                'playlist_url': playlist_metadata['playlist_url'],
                'image_url': playlist_metadata.get('image_url', ''),
                'track_count': len(tracks),
                'linked_at': datetime.utcnow(),
                'last_synced_at': datetime.utcnow()  # For future re-sync feature
            }]),
            'song_count': actual_song_count,
            'updated_at': datetime.utcnow()
        })

        # Start background lyrics and BPM fetching for this collection
        # This runs in a separate thread so it doesn't block the response
        import threading
        from services.lyrics_service_v3 import LyricsServiceV3
        
        def fetch_lyrics_and_bpm_background():
            try:
                lyrics_service = LyricsServiceV3()
                
                logger.info(f"Starting background lyrics fetch for collection {collection_id}")
                lyrics_service.batch_fetch_lyrics_for_collection(collection_id)
                logger.info(f"Completed background lyrics fetch for collection {collection_id}")
                
                logger.info(f"Starting background BPM fetch for collection {collection_id}")
                lyrics_service.batch_fetch_bpm_for_collection(collection_id)
                logger.info(f"Completed background BPM fetch for collection {collection_id}")
                
            except Exception as e:
                logger.error(f"Error in background lyrics/BPM fetch: {e}")
        
        # Start background thread (daemon=True so it doesn't block app shutdown)
        background_thread = threading.Thread(target=fetch_lyrics_and_bpm_background, daemon=True)
        background_thread.start()
        logger.info("Background lyrics and BPM fetching started")

        return jsonify({
            'message': 'Playlist imported successfully',
            'playlist_id': playlist_id,
            'playlist_name': playlist_metadata['playlist_name'],
            'songs_created': result['created'],
            'songs_updated': result['updated'],
            'track_count': len(tracks),
            'total_songs_in_collection': actual_song_count
        }), 200

    except Exception as e:
        logger.error(f"Error importing playlist: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/collections/<collection_id>/unlink-playlist', methods=['POST'])
@require_auth
def unlink_playlist(collection_id):
    """Unlink a playlist from a collection and remove songs that are no longer referenced"""
    try:
        user_id = request.user_id
        data = request.get_json()
        playlist_id = data.get('playlist_id')

        if not playlist_id:
            return jsonify({'error': 'playlist_id required'}), 400

        # Verify user owns the collection
        collections_service = CollectionsService()
        collection = collections_service.get_collection(collection_id, user_id)

        if not collection:
            return jsonify({'error': 'Collection not found'}), 404

        if collection['owner_uid'] != user_id:
            return jsonify({'error': 'You do not own this collection'}), 403

        # Remove playlist references from songs (deletes songs with no other references)
        from services.songs_service_v3 import SongsService
        songs_service = SongsService()
        song_stats = songs_service.delete_songs_for_playlist(collection_id, playlist_id)

        # Remove playlist from linked_playlists array
        from firebase_admin import firestore
        from datetime import datetime
        db = firestore.client()

        # Get current linked playlists
        linked_playlists = collection.get('linked_playlists', [])

        # Filter out the playlist to unlink
        updated_playlists = [p for p in linked_playlists if p.get('playlist_id') != playlist_id]

        # Calculate actual song count from database
        remaining_songs = songs_service.get_songs_in_collection(collection_id)
        new_song_count = len(remaining_songs)

        # Update collection
        collection_ref = db.collection('collections_v3').document(collection_id)
        collection_ref.update({
            'linked_playlists': updated_playlists,
            'song_count': new_song_count,
            'updated_at': datetime.utcnow()
        })

        return jsonify({
            'message': 'Playlist unlinked successfully',
            'playlist_id': playlist_id,
            'songs_deleted': song_stats['deleted'],
            'songs_updated': song_stats['updated'],
            'remaining_songs': new_song_count
        }), 200

    except Exception as e:
        logger.error(f"Error unlinking playlist: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/collections/<collection_id>/reorder-playlists', methods=['POST'])
@require_auth
def reorder_playlists(collection_id):
    """Reorder linked playlists in a collection"""
    try:
        user_id = request.user_id
        data = request.get_json()
        playlist_ids = data.get('playlist_ids', [])

        if not playlist_ids:
            return jsonify({'error': 'playlist_ids required'}), 400

        # Verify user owns the collection
        collections_service = CollectionsService()
        collection = collections_service.get_collection(collection_id, user_id)

        if not collection:
            return jsonify({'error': 'Collection not found'}), 404

        if collection['owner_uid'] != user_id:
            return jsonify({'error': 'You do not own this collection'}), 403

        # Get current linked playlists
        linked_playlists = collection.get('linked_playlists', [])
        
        # Create a map of playlist_id to playlist data
        playlist_map = {p['playlist_id']: p for p in linked_playlists}
        
        # Reorder playlists according to new order
        reordered_playlists = []
        for playlist_id in playlist_ids:
            if playlist_id in playlist_map:
                reordered_playlists.append(playlist_map[playlist_id])
        
        # Update collection with new order
        from firebase_admin import firestore
        from datetime import datetime
        db = firestore.client()
        collection_ref = db.collection('collections_v3').document(collection_id)
        collection_ref.update({
            'linked_playlists': reordered_playlists,
            'updated_at': datetime.utcnow()
        })

        logger.info(f"Reordered playlists for collection {collection_id}: {playlist_ids}")

        return jsonify({
            'message': 'Playlist order updated successfully',
            'playlist_ids': playlist_ids
        }), 200

    except Exception as e:
        logger.error(f"Error reordering playlists: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/v3/collections/<collection_id>/sync-playlists', methods=['POST'])
@require_auth
def sync_playlists(collection_id):
    """
    Sync all playlists in collection - add new songs, mark removed songs as orphaned.
    Never overwrites custom lyrics or BPM.
    """
    try:
        user_id = request.user_id
        
        # Verify user has access to collection
        collections_service = CollectionsService()
        collection = collections_service.get_collection(collection_id, user_id)

        if not collection:
            return jsonify({'error': 'Collection not found'}), 404

        # Get access level
        access_level = collections_service.check_user_access_level(collection_id, user_id)
        
        if access_level not in ['owner', 'collaborator']:
            return jsonify({'error': 'You must be owner or collaborator to sync playlists'}), 403

        # Get linked playlists
        linked_playlists = collection.get('linked_playlists', [])
        
        if not linked_playlists:
            return jsonify({'message': 'No playlists to sync', 'added': 0, 'removed': 0, 'orphaned': 0}), 200

        # Initialize Spotify client
        from services.spotify_service_v3 import SpotifyServiceV3
        from services.songs_service_v3 import SongsService
        
        spotify_service = SpotifyServiceV3()
        songs_service = SongsService()
        
        added_count = 0
        updated_count = 0
        
        # Track all current track IDs from playlists
        current_track_ids_in_playlists = set()
        
        # Sync each playlist
        for playlist_info in linked_playlists:
            playlist_id = playlist_info.get('playlist_id')
            
            if not playlist_id:
                continue
                
            try:
                # Fetch current tracks from Spotify
                tracks_data = spotify_service.get_playlist_tracks(playlist_id)
                
                logger.info(f"Fetched {len(tracks_data)} tracks from playlist {playlist_id}")
                
                # Transform to expected format with position
                tracks_with_position = []
                for idx, track_data in enumerate(tracks_data):
                    tracks_with_position.append({
                        'track': track_data,
                        'position': idx
                    })
                    # Add to current tracks set
                    spotify_track_id = track_data.get('spotify_track_id')
                    if spotify_track_id:
                        current_track_ids_in_playlists.add(spotify_track_id)
                
                logger.info(f"Current track IDs set now has {len(current_track_ids_in_playlists)} tracks")
                
                # Batch import/update songs
                result = songs_service.batch_create_or_update_songs(
                    collection_id=collection_id,
                    playlist_id=playlist_id,
                    tracks_data=tracks_with_position,
                    user_id=user_id
                )
                
                added_count += result.get('created', 0)
                updated_count += result.get('updated', 0)
                
                logger.info(f"Synced playlist {playlist_id}: {result}")
                
            except Exception as e:
                logger.error(f"Error syncing playlist {playlist_id}: {e}")
                continue
        
        # Find orphaned songs (songs in collection but not in any playlist anymore)
        from firebase_admin import firestore
        db = firestore.client()
        
        logger.info(f"Starting orphan check. Current track IDs set has {len(current_track_ids_in_playlists)} tracks")
        
        # Get all songs in this collection
        collection_songs_query = db.collection('songs_v3').where('collection_id', '==', collection_id)
        collection_songs = list(collection_songs_query.stream())
        
        logger.info(f"Found {len(collection_songs)} total songs in collection")
        
        orphaned_count = 0
        batch = db.batch()
        batch_count = 0
        
        for song_doc in collection_songs:
            song_data = song_doc.to_dict()
            spotify_track_id = song_data.get('spotify_track_id')
            song_ref = db.collection('songs_v3').document(song_doc.id)
            
            if spotify_track_id:
                # Check if this song is still in any playlist
                is_in_playlists = spotify_track_id in current_track_ids_in_playlists
                logger.debug(f"Song {song_data.get('title')} - Track ID {spotify_track_id} - In playlists: {is_in_playlists}")
                
                if not is_in_playlists:
                    # Mark as orphaned (only if not already marked)
                    if not song_data.get('is_orphaned'):
                        batch.update(song_ref, {
                            'is_orphaned': True,
                            'orphaned_at': datetime.utcnow()
                        })
                        orphaned_count += 1
                        batch_count += 1
                        logger.info(f"Marking as orphaned: {song_data.get('title')}")
                else:
                    # Unmark if it was orphaned but is now back in a playlist
                    if song_data.get('is_orphaned'):
                        batch.update(song_ref, {
                            'is_orphaned': False,
                            'orphaned_at': None
                        })
                        batch_count += 1
                        logger.info(f"Unmarking orphan: {song_data.get('title')}")
                
                # Commit batch every 500 operations
                if batch_count >= 500:
                    batch.commit()
                    batch = db.batch()
                    batch_count = 0
        
        # Commit remaining operations
        if batch_count > 0:
            batch.commit()
        
        logger.info(f"Playlist sync complete for collection {collection_id}: {added_count} added, {updated_count} updated, {orphaned_count} orphaned")
        
        # Update collection metadata (song_count and updated_at)
        # Count all non-orphaned songs in the collection
        all_songs_query = db.collection('songs_v3').where('collection_id', '==', collection_id)
        all_songs = list(all_songs_query.stream())
        non_orphaned_count = sum(1 for song in all_songs if not song.to_dict().get('is_orphaned'))
        
        collection_ref = db.collection('collections_v3').document(collection_id)
        collection_ref.update({
            'song_count': non_orphaned_count,
            'updated_at': datetime.utcnow()
        })
        
        logger.info(f"Updated collection {collection_id} song_count to {non_orphaned_count}")
        
        # Start background lyrics and BPM fetching if new songs were added
        if added_count > 0:
            import threading
            from services.lyrics_service_v3 import LyricsServiceV3
            
            def fetch_lyrics_and_bpm_background():
                try:
                    lyrics_service = LyricsServiceV3()
                    
                    logger.info(f"Starting background lyrics fetch for collection {collection_id} after sync")
                    lyrics_service.batch_fetch_lyrics_for_collection(collection_id)
                    logger.info(f"Completed background lyrics fetch for collection {collection_id}")
                    
                    logger.info(f"Starting background BPM fetch for collection {collection_id}")
                    lyrics_service.batch_fetch_bpm_for_collection(collection_id)
                    logger.info(f"Completed background BPM fetch for collection {collection_id}")
                    
                except Exception as e:
                    logger.error(f"Error in background lyrics/BPM fetch after sync: {e}")
            
            # Start background thread
            background_thread = threading.Thread(target=fetch_lyrics_and_bpm_background, daemon=True)
            background_thread.start()
            logger.info("Background lyrics and BPM fetching started after sync")
        
        return jsonify({
            'message': 'Playlists synced successfully',
            'added': added_count,
            'updated': updated_count,
            'orphaned': orphaned_count
        }), 200

    except Exception as e:
        logger.error(f"Error syncing playlists: {e}")
        return jsonify({'error': str(e)}), 500

# Songs endpoints
@app.route('/api/v3/songs/<song_id>', methods=['GET', 'PUT', 'DELETE'])
@require_auth
def song(song_id):
    """Get, update, or delete a song"""
    try:
        user_id = request.user_id
        from firebase_admin import firestore
        from services.collections_service_v3 import CollectionsService

        db = firestore.client()
        song_ref = db.collection('songs_v3').document(song_id)
        song_doc = song_ref.get()

        if not song_doc.exists:
            return jsonify({'error': 'Song not found'}), 404

        song_data = song_doc.to_dict()
        collection_id = song_data.get('collection_id')

        # Verify user has access to the collection
        collections_service = CollectionsService()
        collection = collections_service.get_collection(collection_id, user_id)

        if not collection:
            return jsonify({'error': 'Collection not found or access denied'}), 403

        if request.method == 'GET':
            # Return song data
            song_data['id'] = song_id
            return jsonify(song_data)

        elif request.method == 'DELETE':
            # Check if user is owner (only owners can delete)
            access_level = collections_service.check_user_access_level(collection_id, user_id)
            
            if access_level != 'owner':
                return jsonify({'error': 'Only collection owner can delete songs'}), 403
            
            # Verify song is orphaned before allowing deletion
            if not song_data.get('is_orphaned'):
                return jsonify({'error': 'Can only delete orphaned songs (removed from all playlists)'}), 400
            
            # Delete the song
            song_ref.delete()
            
            # Update collection song count
            all_songs_query = db.collection('songs_v3').where('collection_id', '==', collection_id)
            all_songs = list(all_songs_query.stream())
            non_orphaned_count = sum(1 for s in all_songs if not s.to_dict().get('is_orphaned'))
            
            collection_ref = db.collection('collections_v3').document(collection_id)
            collection_ref.update({
                'song_count': non_orphaned_count,
                'updated_at': datetime.utcnow()
            })
            
            logger.info(f"User {user_id} deleted orphaned song {song_id} from collection {collection_id}")
            
            return jsonify({'message': 'Song deleted successfully'}), 200

        elif request.method == 'PUT':
            # Check if user has edit permissions (owner or collaborator)
            access_level = collections_service.check_user_access_level(collection_id, user_id)
            
            if access_level not in ['owner', 'collaborator']:
                return jsonify({'error': 'You do not have permission to edit this song'}), 403

            # Update song
            data = request.get_json()

            # Build update dict with allowed fields
            update_data = {}
            allowed_fields = ['lyrics', 'custom_lyrics', 'notes', 'bpm']

            for field in allowed_fields:
                if field in data:
                    update_data[field] = data[field]

            # Special handling for lyrics - renumber if updated
            if 'lyrics' in update_data:
                from services.lyrics_service_v3 import LyricsServiceV3
                lyrics_service = LyricsServiceV3()

                # Renumber lyrics
                numbered_lyrics = lyrics_service.renumber_lyrics(update_data['lyrics'])
                update_data['lyrics_numbered'] = numbered_lyrics

                # Mark as custom if explicitly set
                if data.get('custom_lyrics'):
                    update_data['custom_lyrics'] = True

            if update_data:
                song_ref.update(update_data)

                app.logger.info(f"Updated song {song_id} by user {user_id}: {list(update_data.keys())}")

                # Return updated song
                updated_song = song_ref.get().to_dict()
                updated_song['id'] = song_id
                return jsonify(updated_song)
            else:
                return jsonify({'error': 'No valid fields to update'}), 400

    except Exception as e:
        app.logger.error(f"Error in song endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v3/songs/<song_id>/fetch-lyrics', methods=['POST'])
@require_auth
def fetch_song_lyrics(song_id):
    """Manually trigger lyrics fetch for a song (collection owner only)"""
    try:
        user_id = request.user_id
        
        # Get force_customized flag from query params
        force_customized = request.args.get('force_customized', 'false').lower() == 'true'
        
        # Get song to verify collection ownership
        from firebase_admin import firestore
        from services.lyrics_service_v3 import LyricsServiceV3
        from services.collections_service_v3 import CollectionsService
        
        db = firestore.client()
        song_ref = db.collection('songs_v3').document(song_id)
        song_doc = song_ref.get()
        
        if not song_doc.exists:
            return jsonify({'error': 'Song not found'}), 404
            
        song_data = song_doc.to_dict()
        collection_id = song_data.get('collection_id')
        
        # Verify user owns the collection
        collections_service = CollectionsService()
        collection = collections_service.get_collection(collection_id, user_id)
        
        if not collection:
            return jsonify({'error': 'Collection not found'}), 404
            
        if collection['owner_uid'] != user_id:
            return jsonify({'error': 'Only collection owner can refresh lyrics'}), 403
        
        # Fetch lyrics with appropriate flags
        lyrics_service = LyricsServiceV3()
        success = lyrics_service.fetch_and_update_song_lyrics(
            song_id=song_id,
            force=True,  # Always force refresh for manual fetch
            force_customized=force_customized
        )
        
        if success:
            # Reload song to get updated lyrics
            song_doc = song_ref.get()
            song_data = song_doc.to_dict()
            
            return jsonify({
                'message': 'Lyrics fetched successfully',
                'song_id': song_id,
                'was_customized': song_data.get('is_customized', False),
                'force_customized': force_customized
            }), 200
        else:
            # Reload song to get error details
            song_doc = song_ref.get()
            song_data = song_doc.to_dict()
            error_msg = song_data.get('lyrics_fetch_error', 'Unknown error')
            
            error_messages = {
                'NOT_FOUND': 'Song not found on Genius',
                'SCRAPE_FAILED': 'Failed to scrape lyrics from Genius page (possible IP block or page format change)',
            }
            
            user_friendly_msg = error_messages.get(error_msg, f'Failed to fetch lyrics: {error_msg}')
            
            return jsonify({
                'error': user_friendly_msg,
                'error_code': error_msg,
                'is_customized': song_data.get('is_customized', False),
                'hint': 'Try again in a few minutes, or use Edit Lyrics (L key) to add lyrics manually'
            }), 400
            
    except Exception as e:
        logger.error(f"Error fetching lyrics for song {song_id}: {e}")
        return jsonify({'error': str(e)}), 500

# ============================================================================
# PWA Support
# ============================================================================

@app.route('/manifest.json')
def manifest():
    """Serve PWA manifest"""
    from flask import send_from_directory
    return send_from_directory('static', 'manifest.json')

@app.route('/service-worker.js')
def service_worker():
    """Serve service worker"""
    from flask import send_from_directory
    return send_from_directory('static', 'service-worker.js')

# ============================================================================
# Spotify Web Playback SDK - OAuth Routes
# ============================================================================

# Initialize Spotify Playback service
spotify_playback = SpotifyPlaybackService()

@app.route('/api/v3/spotify/auth-url', methods=['GET'])
@require_auth
def get_spotify_auth_url():
    """
    Get Spotify OAuth URL for user authentication
    Returns URL to redirect user to Spotify login
    """
    try:
        user_info = request.user_info
        uid = user_info['uid']

        # Use UID as state for CSRF protection
        auth_url = spotify_playback.get_auth_url(state=uid)

        return jsonify({'auth_url': auth_url}), 200

    except Exception as e:
        logger.error(f"Get Spotify auth URL error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/v3/spotify/callback', methods=['GET'])
def spotify_callback():
    """
    Handle Spotify OAuth callback
    Exchanges authorization code for tokens and closes popup
    """
    code = request.args.get('code')
    state = request.args.get('state')  # Should match UID
    error = request.args.get('error')

    if error:
        logger.warning(f"Spotify OAuth error: {error}")
        return f"""
        <html>
        <body>
            <script>
                window.opener.postMessage({{type: 'spotify-error', error: '{error}'}}, '*');
                window.close();
            </script>
            <p>Spotify authorization denied. Closing window...</p>
        </body>
        </html>
        """

    if not code or not state:
        return jsonify({'error': 'Missing code or state parameter'}), 400

    try:
        # Exchange code for token
        token_data = spotify_playback.exchange_code_for_token(code)

        # Check if user has Premium (required for Web Playback SDK)
        is_premium = spotify_playback.check_premium_status(token_data['access_token'])

        # Save token for user (state = uid)
        spotify_playback.save_user_token(state, token_data)

        # Close popup and notify parent window
        return f"""
        <html>
        <body>
            <script>
                window.opener.postMessage({{
                    type: 'spotify-connected',
                    isPremium: {str(is_premium).lower()}
                }}, '*');
                window.close();
            </script>
            <p>Spotify connected! Closing window...</p>
        </body>
        </html>
        """

    except Exception as e:
        logger.error(f"Spotify callback error: {e}")
        return f"""
        <html>
        <body>
            <script>
                window.opener.postMessage({{type: 'spotify-error', error: 'Connection failed'}}, '*');
                window.close();
            </script>
            <p>Failed to connect Spotify. Closing window...</p>
        </body>
        </html>
        """


@app.route('/api/v3/spotify/token', methods=['GET'])
@require_auth
def get_spotify_token():
    """
    Get current Spotify access token for user
    Auto-refreshes if expired
    """
    try:
        user_info = request.user_info
        uid = user_info['uid']

        access_token = spotify_playback.get_user_token(uid)

        return jsonify({'access_token': access_token}), 200

    except ValueError as e:
        # User has not connected Spotify
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        logger.error(f"Get Spotify token error: {e}")
        return jsonify({'error': 'Failed to get Spotify token'}), 500


@app.route('/api/v3/spotify/disconnect', methods=['POST'])
@require_auth
def disconnect_spotify():
    """
    Disconnect Spotify for user (remove tokens)
    """
    try:
        user_info = request.user_info
        uid = user_info['uid']

        spotify_playback.disconnect_user(uid)

        return jsonify({'success': True}), 200

    except Exception as e:
        logger.error(f"Disconnect Spotify error: {e}")
        return jsonify({'error': str(e)}), 500


# ============================================================================
# Error Handlers
# ============================================================================

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Endpoint not found'}), 404
    return render_template('index.html'), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f'Internal error: {error}')
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Internal server error'}), 500
    return render_template('index.html'), 500

# ============================================================================
# Development Server
# ============================================================================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    logger.info(f'Starting Band Practice Pro v3 on port {port}')
    logger.info(f'Debug mode: {DEBUG}')
    app.run(host='0.0.0.0', port=port, debug=DEBUG)
