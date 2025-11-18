"""
Band Practice Pro v3 - Main Flask Application
Clean architecture, PWA support, Spotify Web Playback SDK integration
"""

import logging
import os
from pathlib import Path

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

@app.route('/songs')
def songs():
    """Songs view - shows all songs in a collection"""
    logger.info('Songs page accessed')
    return render_template('songs.html')

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

        def sort_key(song):
            playlist_ids = song.get('source_playlist_ids', [])
            playlist_positions = song.get('playlist_positions', {})

            if not playlist_ids:
                return (999999, 999999)

            # Get first playlist and its order in collection
            first_playlist = playlist_ids[0]
            collection_order = playlist_order.get(first_playlist, 999999)
            position_in_playlist = playlist_positions.get(first_playlist, 999999)

            return (collection_order, position_in_playlist)

        songs.sort(key=sort_key)

        return jsonify({
            'songs': songs,
            'collection': collection_data
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

        # Start background lyrics fetching for this collection
        # This runs in a separate thread so it doesn't block the response
        import threading
        from services.lyrics_service_v3 import LyricsServiceV3
        
        def fetch_lyrics_background():
            try:
                logger.info(f"Starting background lyrics fetch for collection {collection_id}")
                lyrics_service = LyricsServiceV3()
                lyrics_service.batch_fetch_lyrics_for_collection(collection_id)
                logger.info(f"Completed background lyrics fetch for collection {collection_id}")
            except Exception as e:
                logger.error(f"Error in background lyrics fetch: {e}")
        
        # Start background thread (daemon=True so it doesn't block app shutdown)
        lyrics_thread = threading.Thread(target=fetch_lyrics_background, daemon=True)
        lyrics_thread.start()
        logger.info("Background lyrics fetching started")

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

# Songs endpoints (to be implemented in Phase 4+)
@app.route('/api/v3/songs/<song_id>', methods=['GET', 'PUT'])
def song(song_id):
    """Get or update a song"""
    # TODO: Implement in Phase 5+
    return jsonify({'error': 'Not implemented yet'}), 501

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
            return jsonify({
                'message': 'Lyrics fetched successfully',
                'song_id': song_id,
                'was_customized': song_data.get('is_customized', False),
                'force_customized': force_customized
            }), 200
        else:
            return jsonify({
                'error': 'Failed to fetch lyrics',
                'is_customized': song_data.get('is_customized', False),
                'hint': 'Use ?force_customized=true to overwrite customized lyrics'
            }), 400
            
    except Exception as e:
        logger.error(f"Error fetching lyrics for song {song_id}: {e}")
        return jsonify({'error': str(e)}), 500

# Spotify endpoints (to be implemented in Phase 6)
@app.route('/api/v3/spotify/auth-url', methods=['GET'])
def spotify_auth_url():
    """Get Spotify OAuth URL"""
    # TODO: Implement in Phase 6
    return jsonify({'error': 'Not implemented yet'}), 501

@app.route('/api/v3/spotify/callback', methods=['POST'])
def spotify_callback():
    """Handle Spotify OAuth callback"""
    # TODO: Implement in Phase 6
    return jsonify({'error': 'Not implemented yet'}), 501

@app.route('/api/v3/spotify/token', methods=['GET'])
def spotify_token():
    """Get user's Spotify token"""
    # TODO: Implement in Phase 6
    return jsonify({'error': 'Not implemented yet'}), 501

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
