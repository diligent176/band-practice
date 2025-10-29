"""
Band Practice Pro - Flask Web Application
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from parent directory (project root)
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

from flask import Flask, render_template, request, jsonify, g
from services.firestore_service import FirestoreService
from services.lyrics_service import LyricsService
from services.auth_service import require_auth, optional_auth, require_admin
from services.spotify_auth_service import SpotifyAuthService
from services.user_service import user_service
from services.audit_service import audit_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['FIREBASE_API_KEY'] = os.getenv('FIREBASE_API_KEY')
app.config['FIREBASE_AUTH_DOMAIN'] = os.getenv('FIREBASE_AUTH_DOMAIN')
app.config['FIREBASE_PROJECT_ID'] = os.getenv('FIREBASE_PROJECT_ID', os.getenv('GCP_PROJECT_ID'))

# Initialize services
firestore = FirestoreService()
lyrics_service = LyricsService(firestore)
spotify_auth = SpotifyAuthService(firestore)


# Helper function for song permissions
def check_song_permission(song_id, user_email, permission_type='write'):
    """
    Check if user has permission to access a song

    Args:
        song_id: Song document ID
        user_email: User's email
        permission_type: 'read', 'write', or 'admin'

    Returns:
        Tuple of (has_permission: bool, song: dict, collection: dict)
    """
    song = firestore.get_song(song_id)
    if not song:
        return False, None, None

    collection_id = song.get('collection_id')
    if not collection_id:
        return False, song, None

    collection = firestore.get_collection(collection_id)
    if not collection:
        return False, song, None

    if permission_type == 'admin':
        return firestore.can_admin_collection(collection_id, user_email), song, collection
    elif permission_type == 'write':
        return firestore.can_write_collection(collection_id, user_email), song, collection
    else:  # read
        return firestore.can_read_collection(collection_id, user_email), song, collection


@app.route('/')
def index():
    """Main viewer page with Firebase auth"""
    # Return the HTML that includes Firebase Auth UI
    return render_template('viewer.html')


@app.route('/api/songs', methods=['GET'])
@require_auth
def get_songs():
    """V2: Get all songs from Firestore with sorting support"""
    try:
        collection_id = request.args.get('collection_id')
        sort_mode = request.args.get('sort', 'name')  # V2: name | artist | playlist
        
        logger.info(f"User {g.user.get('email')} requested songs (collection_id={collection_id}, sort={sort_mode})")
        
        if not collection_id:
            # No collection specified - return empty list
            return jsonify({'songs': [], 'success': True})
        
        # V2: Use appropriate sorting method
        if sort_mode == 'artist':
            songs = firestore.get_songs_sorted_by_artist(collection_id)
            return jsonify({'songs': songs, 'success': True})
        elif sort_mode == 'playlist':
            result = firestore.get_songs_sorted_by_playlist(collection_id)
            return jsonify({'success': True, **result})
        else:  # Default: name
            songs = firestore.get_songs_sorted_by_name(collection_id)
            return jsonify({'songs': songs, 'success': True})
    except Exception as e:
        logger.error(f"Error getting songs for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/songs/<song_id>', methods=['GET'])
@require_auth
def get_song(song_id):
    """Get a specific song with lyrics and notes"""
    try:
        logger.info(f"User {g.user.get('email')} requested song {song_id}")
        song = firestore.get_song(song_id)
        if not song:
            return jsonify({'error': 'Song not found', 'success': False}), 404
        return jsonify({'song': song, 'success': True})
    except Exception as e:
        logger.error(f"Error getting song {song_id} for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/songs/<song_id>/notes', methods=['PUT'])
@require_auth
def update_notes(song_id):
    """Update drummer notes for a song (owner or collaborator)"""
    try:
        user_email = g.user.get('email')
        data = request.get_json()
        notes = data.get('notes', '')

        # Check write permission
        has_permission, song, collection = check_song_permission(song_id, user_email, 'write')
        if not has_permission:
            return jsonify({'error': 'You do not have permission to edit this song', 'success': False}), 403

        # Get old notes for audit log (field is 'notes' in Firestore)
        old_notes = song.get('notes', '') if song else ''

        logger.info(f"User {user_email} updating notes for song {song_id}")
        firestore.update_notes(song_id, notes)

        # Log to audit
        audit_service.log_action(
            user_id=g.user.get('uid'),
            user_email=user_email,
            action='update_notes',
            resource_type='song',
            resource_id=song_id,
            resource_name=f"{song.get('title', '')} - {song.get('artist', '')}" if song else None,
            collection_id=song.get('collection_id') if song else None,
            changes={
                'field': 'notes',
                'old_value': old_notes,
                'new_value': notes
            }
        )

        return jsonify({'success': True, 'message': 'Notes updated successfully'})
    except Exception as e:
        logger.error(f"Error updating notes for song {song_id} by user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/songs/<song_id>/lyrics', methods=['PUT'])
@require_auth
def update_lyrics(song_id):
    """Update lyrics for a song and mark as customized (owner or collaborator)"""
    try:
        user_email = g.user.get('email')
        data = request.get_json()
        lyrics = data.get('lyrics', '')

        # Check write permission
        has_permission, song, collection = check_song_permission(song_id, user_email, 'write')
        if not has_permission:
            return jsonify({'error': 'You do not have permission to edit this song', 'success': False}), 403

        # Get old lyrics for audit log
        old_lyrics = song.get('lyrics', '') if song else ''

        logger.info(f"User {user_email} updating lyrics for song {song_id}")

        # Update lyrics and mark as customized
        firestore.update_lyrics(song_id, lyrics, is_customized=True)

        # Log to audit (store complete lyrics for full diff view)
        audit_service.log_action(
            user_id=g.user.get('uid'),
            user_email=user_email,
            action='update_lyrics',
            resource_type='song',
            resource_id=song_id,
            resource_name=f"{song.get('title', '')} - {song.get('artist', '')}" if song else None,
            collection_id=song.get('collection_id') if song else None,
            changes={
                'field': 'lyrics',
                'old_value': old_lyrics or '',
                'new_value': lyrics or ''
            }
        )

        # Get updated song
        updated_song = firestore.get_song(song_id)

        return jsonify({
            'success': True,
            'message': 'Lyrics updated and marked as customized',
            'song': updated_song
        })
    except Exception as e:
        logger.error(f"Error updating lyrics for song {song_id} by user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/playlist/info', methods=['POST'])
@require_auth
def get_playlist_info():
    """Get playlist information before syncing"""
    try:
        data = request.get_json()
        playlist_url = data.get('playlist_url', os.getenv('SPOTIFY_PLAYLIST_URL'))

        if not playlist_url:
            return jsonify({'error': 'No playlist URL provided', 'success': False}), 400

        logger.info(f"User {g.user.get('email')} requested playlist info")
        info = lyrics_service.get_playlist_info(playlist_url)
        return jsonify({
            'success': True,
            'playlist': info
        })
    except Exception as e:
        logger.error(f"Error getting playlist info for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/playlist/details', methods=['POST'])
@require_auth
def get_playlist_details():
    """Get detailed playlist information with all songs and conflict detection"""
    try:
        data = request.get_json()
        playlist_url = data.get('playlist_url')
        collection_id = data.get('collection_id')  # Get collection_id for proper conflict detection

        if not playlist_url:
            return jsonify({'error': 'No playlist URL provided', 'success': False}), 400

        logger.info(f"User {g.user.get('email')} requested detailed playlist info for collection {collection_id}")
        details = lyrics_service.get_playlist_details_with_conflicts(playlist_url, collection_id)

        # Save playlist to memory for quick recall
        user_id = g.user.get('email')
        playlist_info = details.get('playlist', {})
        playlist_id = playlist_info.get('id')

        if user_id and playlist_id:
            try:
                firestore.save_playlist_memory(user_id, playlist_id, {
                    'playlist_url': playlist_url,
                    'name': playlist_info.get('name', ''),
                    'owner': playlist_info.get('owner', ''),
                    'total_tracks': playlist_info.get('total_tracks', 0),
                    'image_url': playlist_info.get('image_url', '')
                })
            except Exception as mem_error:
                logger.warning(f"Failed to save playlist memory: {mem_error}")

        return jsonify({
            'success': True,
            **details
        })
    except Exception as e:
        logger.error(f"Error getting playlist details for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/playlist/import', methods=['POST'])
@require_auth
def import_selected_songs():
    """Import selected songs from playlist with real-time progress updates using Server-Sent Events"""
    from flask import Response, stream_with_context
    import json
    import time
    
    try:
        data = request.get_json()
        playlist_url = data.get('playlist_url')
        selected_songs = data.get('selected_songs', [])
        collection_id = data.get('collection_id')  # Get collection_id from request

        if not playlist_url or not selected_songs:
            return jsonify({'error': 'Invalid request', 'success': False}), 400

        logger.info(f"User {g.user.get('email')} importing {len(selected_songs)} songs to collection {collection_id}")
        
        def generate():
            """Generator function that yields progress updates"""
            try:
                # Call the generator-based import method with collection_id
                for update in lyrics_service.import_selected_songs_stream(playlist_url, selected_songs, collection_id):
                    # Send progress update as Server-Sent Event
                    yield f"data: {json.dumps(update)}\n\n"
                    
            except Exception as e:
                logger.error(f"Error during import stream: {e}")
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        
        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'  # Disable buffering for nginx
            }
        )
        
    except Exception as e:
        logger.error(f"Error importing songs for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/playlist/sync', methods=['POST'])
@require_auth
def sync_playlist():
    """Fetch/update all songs from Spotify playlist"""
    try:
        data = request.get_json()
        playlist_url = data.get('playlist_url', os.getenv('SPOTIFY_PLAYLIST_URL'))

        if not playlist_url:
            return jsonify({'error': 'No playlist URL provided', 'success': False}), 400

        logger.info(f"User {g.user.get('email')} initiated playlist sync")
        result = lyrics_service.sync_playlist(playlist_url)
        return jsonify({
            'success': True,
            'message': f"Synced {result['total']} songs",
            'added': result['added'],
            'updated': result['updated'],
            'failed': result['failed']
        })
    except Exception as e:
        logger.error(f"Error syncing playlist for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/songs/<song_id>/refresh', methods=['POST'])
@require_auth
def refresh_song(song_id):
    """Refresh lyrics for a specific song"""
    try:
        data = request.get_json() or {}
        force_overwrite = data.get('force_overwrite', False)

        song = firestore.get_song(song_id)
        if not song:
            return jsonify({'error': 'Song not found', 'success': False}), 404

        # Check if song is customized
        if song.get('is_customized') and not force_overwrite:
            return jsonify({
                'success': False,
                'requires_confirmation': True,
                'message': 'This song has customized lyrics. Refreshing will overwrite your changes.',
                'song': song
            })

        logger.info(f"User {g.user.get('email')} refreshing lyrics for song {song_id} (force={force_overwrite})")
        updated_song = lyrics_service.fetch_and_update_song(
            song_id,
            song['title'],
            song['artist'],
            clear_customization=True
        )

        return jsonify({
            'success': True,
            'message': 'Song lyrics refreshed',
            'song': updated_song
        })
    except Exception as e:
        logger.error(f"Error refreshing song {song_id} for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/songs/<song_id>/bpm', methods=['POST'])
@require_auth
def fetch_bpm(song_id):
    """Fetch BPM for a specific song (owner or collaborator)"""
    try:
        user_email = g.user.get('email')

        # Check write permission
        has_permission, _, _ = check_song_permission(song_id, user_email, 'write')
        if not has_permission:
            return jsonify({'error': 'You do not have permission to edit this song', 'success': False}), 403

        song = firestore.get_song(song_id)
        if not song:
            return jsonify({'error': 'Song not found', 'success': False}), 404

        logger.info(f"User {user_email} fetching BPM for song {song_id}")
        result = lyrics_service.fetch_and_update_bpm(
            song_id,
            song['title'],
            song['artist']
        )

        return jsonify({
            'success': True,
            'bpm': result['bpm']
        })
    except Exception as e:
        logger.error(f"Error fetching BPM for song {song_id} by user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/songs/<song_id>/bpm', methods=['PUT'])
@require_auth
def update_bpm(song_id):
    """Manually update BPM for a song (owner or collaborator)"""
    try:
        user_email = g.user.get('email')
        data = request.get_json()
        bpm_value = data.get('bpm')

        if bpm_value is None:
            return jsonify({'error': 'BPM value is required', 'success': False}), 400

        # Check write permission
        has_permission, _, _ = check_song_permission(song_id, user_email, 'write')
        if not has_permission:
            return jsonify({'error': 'You do not have permission to edit this song', 'success': False}), 403

        # Validate BPM value
        if isinstance(bpm_value, str):
            if bpm_value not in ['N/A', 'NOT_FOUND']:
                return jsonify({'error': 'Invalid BPM value', 'success': False}), 400
        else:
            try:
                bpm_float = float(bpm_value)
                if bpm_float <= 0 or bpm_float > 300:
                    return jsonify({'error': 'BPM must be between 1 and 300', 'success': False}), 400
                # Round to 1 decimal place
                bpm_value = round(bpm_float, 1)
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid BPM value', 'success': False}), 400

        song = firestore.get_song(song_id)
        if not song:
            return jsonify({'error': 'Song not found', 'success': False}), 404

        # Get old BPM for audit log
        old_bpm = song.get('bpm')

        logger.info(f"User {user_email} manually updating BPM for song {song_id} to {bpm_value}")
        firestore.update_bpm(song_id, bpm_value, is_manual=True)

        # Log to audit
        audit_service.log_action(
            user_id=g.user.get('uid'),
            user_email=user_email,
            action='update_bpm',
            resource_type='song',
            resource_id=song_id,
            resource_name=f"{song.get('title', '')} - {song.get('artist', '')}",
            collection_id=song.get('collection_id'),
            changes={
                'field': 'bpm',
                'old_value': str(old_bpm) if old_bpm else 'N/A',
                'new_value': str(bpm_value)
            }
        )

        # Get updated song
        updated_song = firestore.get_song(song_id)

        return jsonify({
            'success': True,
            'message': f'BPM updated to {bpm_value}',
            'song': updated_song
        })
    except Exception as e:
        logger.error(f"Error updating BPM for song {song_id} by user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/songs/<song_id>', methods=['DELETE'])
@require_auth
def delete_song(song_id):
    """Delete a song from the database (owner only)"""
    try:
        user_email = g.user.get('email')

        # Check admin permission (owner only can delete)
        has_permission, _, _ = check_song_permission(song_id, user_email, 'admin')
        if not has_permission:
            return jsonify({'error': 'Only collection owner can delete songs', 'success': False}), 403

        song = firestore.get_song(song_id)
        if not song:
            return jsonify({'error': 'Song not found', 'success': False}), 404

        logger.info(f"User {user_email} deleting song {song_id}: {song.get('title')} by {song.get('artist')}")
        firestore.delete_song(song_id)

        return jsonify({
            'success': True,
            'message': f"Deleted '{song.get('title')}' by {song.get('artist')}"
        })
    except Exception as e:
        logger.error(f"Error deleting song {song_id} for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/playlist/memory', methods=['GET'])
@require_auth
def get_playlist_memory():
    """Get user's recently accessed playlists"""
    try:
        user_id = g.user.get('email')
        logger.info(f"User {user_id} requested playlist memory")

        playlists = firestore.get_user_playlist_memory(user_id, limit=10)

        return jsonify({
            'success': True,
            'playlists': playlists
        })
    except Exception as e:
        logger.error(f"Error getting playlist memory for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/playlist/memory/<playlist_id>', methods=['DELETE'])
@require_auth
def delete_playlist_memory(playlist_id):
    """Delete a playlist from memory"""
    try:
        user_id = g.user.get('email')
        logger.info(f"User {user_id} deleting playlist memory for {playlist_id}")

        firestore.delete_playlist_memory(playlist_id)

        return jsonify({
            'success': True,
            'message': 'Playlist removed from memory'
        })
    except Exception as e:
        logger.error(f"Error deleting playlist memory for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/collections', methods=['GET'])
@require_auth
def get_collections():
    """Get all collections for the current user + shared collections"""
    import time
    from concurrent.futures import ThreadPoolExecutor, as_completed

    try:
        user_id = g.user.get('email')
        start_time = time.time()
        logger.info(f"🔄 User {user_id} requested collections")

        # Step 1: Get user's own collections + all shared collections
        fetch_start = time.time()
        user_collections = firestore.get_user_collections(user_id)
        shared_collections = firestore.get_shared_collections()

        # Combine and deduplicate (user's own collections take precedence)
        user_collection_ids = {c['id'] for c in user_collections}
        collections = user_collections + [c for c in shared_collections if c['id'] not in user_collection_ids]

        fetch_time = time.time() - fetch_start
        logger.info(f"⏱️  Fetched {len(user_collections)} user collections + {len(shared_collections)} shared collections in {fetch_time:.3f}s")

        # Step 2: Add counts for each collection IN PARALLEL
        count_start = time.time()

        # Create a function to count songs and get first playlist image for a single collection
        def count_songs_for_collection(collection):
            """Helper to count songs, get playlist count, and first playlist image"""
            song_count = firestore.count_songs_by_collection(collection['id'])
            playlist_ids = collection.get('playlist_ids', [])
            playlist_count = len(playlist_ids)

            # Get first playlist's image URL
            first_playlist_image = None
            if playlist_ids:
                first_playlist = firestore.db.collection(firestore.playlist_memory_collection).document(playlist_ids[0]).get()
                if first_playlist.exists:
                    first_playlist_image = first_playlist.to_dict().get('image_url')

            return collection['id'], song_count, playlist_count, first_playlist_image

        # Execute all count queries in parallel (max 10 concurrent)
        with ThreadPoolExecutor(max_workers=10) as executor:
            # Submit all count jobs at once
            future_to_collection = {
                executor.submit(count_songs_for_collection, c): c
                for c in collections
            }

            # Collect results as they complete
            for future in as_completed(future_to_collection):
                collection = future_to_collection[future]
                try:
                    _, song_count, playlist_count, first_playlist_image = future.result()
                    collection['song_count'] = song_count
                    collection['playlist_count'] = playlist_count
                    collection['first_playlist_image'] = first_playlist_image
                except Exception as e:
                    logger.error(f"❌ Error counting for collection {collection.get('name')}: {e}")
                    collection['song_count'] = 0
                    collection['playlist_count'] = 0
                    collection['first_playlist_image'] = None

        total_count_time = time.time() - count_start
        total_time = time.time() - start_time
        logger.info(f"⏱️  All count queries (PARALLEL) took {total_count_time:.3f}s")
        logger.info(f"⏱️  TOTAL /api/collections took {total_time:.3f}s")

        return jsonify({
            'success': True,
            'collections': collections
        })
    except Exception as e:
        logger.error(f"❌ Error getting collections for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/collections', methods=['POST'])
@require_auth
def create_collection():
    """Create a new collection"""
    try:
        user_id = g.user.get('email')
        data = request.get_json()

        name = data.get('name', '').strip()
        description = data.get('description', '').strip()

        if not name:
            return jsonify({'error': 'Collection name is required', 'success': False}), 400

        logger.info(f"User {user_id} creating collection: {name}")

        collection = firestore.create_collection(user_id, name, description)

        return jsonify({
            'success': True,
            'collection': collection,
            'message': f"Collection '{name}' created"
        })
    except Exception as e:
        logger.error(f"Error creating collection for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/collections/<collection_id>', methods=['GET'])
@require_auth
def get_collection(collection_id):
    """Get a specific collection"""
    try:
        user_id = g.user.get('email')
        logger.info(f"User {user_id} requested collection {collection_id}")

        collection = firestore.get_collection(collection_id)

        if not collection:
            return jsonify({'error': 'Collection not found', 'success': False}), 404

        # Check read permission (owner or shared collection)
        if not firestore.can_read_collection(collection_id, user_id):
            return jsonify({'error': 'Unauthorized', 'success': False}), 403

        return jsonify({
            'success': True,
            'collection': collection
        })
    except Exception as e:
        logger.error(f"Error getting collection {collection_id} for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/collections/<collection_id>', methods=['PUT'])
@require_auth
def update_collection(collection_id):
    """Update a collection's metadata (owner only)"""
    try:
        user_id = g.user.get('email')
        data = request.get_json()

        # Check admin permission (owner only)
        collection = firestore.get_collection(collection_id)
        if not collection:
            return jsonify({'error': 'Collection not found', 'success': False}), 404

        if not firestore.can_admin_collection(collection_id, user_id):
            return jsonify({'error': 'Only collection owner can edit settings', 'success': False}), 403

        # Prevent making Default collection shared
        if collection.get('name') == 'Default' and data.get('is_shared'):
            return jsonify({'error': 'Default collection cannot be shared', 'success': False}), 400

        name = data.get('name')
        description = data.get('description')
        is_shared = data.get('is_shared')
        collaborators = data.get('collaborators')

        # Validate collaborators (if provided)
        if collaborators is not None:
            if not isinstance(collaborators, list):
                return jsonify({'error': 'Collaborators must be a list', 'success': False}), 400
            if len(collaborators) > 10:
                return jsonify({'error': 'Maximum 10 collaborators allowed', 'success': False}), 400
            # Validate email format and prevent self-collaboration
            import re
            email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            for email in collaborators:
                if not re.match(email_regex, email):
                    return jsonify({'error': f'Invalid email format: {email}', 'success': False}), 400
                if email == user_id:
                    return jsonify({'error': 'Cannot add yourself as collaborator', 'success': False}), 400

        logger.info(f"User {user_id} updating collection {collection_id}")

        firestore.update_collection(
            collection_id,
            name=name,
            description=description,
            is_shared=is_shared,
            collaborators=collaborators
        )

        # Get updated collection
        updated_collection = firestore.get_collection(collection_id)

        return jsonify({
            'success': True,
            'collection': updated_collection,
            'message': 'Collection updated'
        })
    except Exception as e:
        logger.error(f"Error updating collection {collection_id} for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/collections/<collection_id>', methods=['DELETE'])
@require_auth
def delete_collection(collection_id):
    """Delete a collection and all its associated songs (owner only)"""
    try:
        user_id = g.user.get('email')

        # Check admin permission (owner only)
        collection = firestore.get_collection(collection_id)
        if not collection:
            return jsonify({'error': 'Collection not found', 'success': False}), 404

        if not firestore.can_admin_collection(collection_id, user_id):
            return jsonify({'error': 'Only collection owner can delete', 'success': False}), 403

        # Prevent deletion of Default collection
        if collection.get('name') == 'Default':
            return jsonify({'error': 'Cannot delete Default collection', 'success': False}), 400

        logger.info(f"User {user_id} deleting collection {collection_id}: {collection.get('name')} and all its songs")

        firestore.delete_collection(collection_id)

        return jsonify({
            'success': True,
            'message': f"Collection '{collection.get('name')}' and all its songs deleted"
        })
    except Exception as e:
        logger.error(f"Error deleting collection {collection_id} for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/collections/default', methods=['GET'])
@require_auth
def get_default_collection():
    """Get or create the Default collection for the current user"""
    try:
        user_id = g.user.get('email')
        logger.info(f"User {user_id} requested default collection")

        collection = firestore.get_or_create_default_collection(user_id)

        return jsonify({
            'success': True,
            'collection': collection
        })
    except Exception as e:
        logger.error(f"Error getting default collection for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


# =========================================================================
# V2: Playlist Linking Endpoints
# =========================================================================

@app.route('/api/collections/<collection_id>/playlists', methods=['GET'])
@require_auth
def get_collection_playlists(collection_id):
    """Get all playlists linked to a collection"""
    try:
        user_id = g.user.get('email')
        
        # Verify collection belongs to user
        collection = firestore.get_collection(collection_id)
        if not collection:
            return jsonify({'error': 'Collection not found', 'success': False}), 404
        if collection.get('user_id') != user_id:
            return jsonify({'error': 'Unauthorized', 'success': False}), 403
        
        logger.info(f"User {user_id} requested playlists for collection {collection_id}")
        playlists = firestore.get_collection_playlists(collection_id)
        
        return jsonify({
            'success': True,
            'playlists': playlists
        })
    except Exception as e:
        logger.error(f"Error getting collection playlists: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/collections/<collection_id>/playlists/link', methods=['POST'])
@require_auth
def link_playlist_to_collection(collection_id):
    """Link a Spotify playlist to a collection"""
    try:
        user_id = g.user.get('email')
        data = request.get_json()
        playlist_url = data.get('playlist_url')
        
        if not playlist_url:
            return jsonify({'error': 'Playlist URL required', 'success': False}), 400
        
        # Verify collection belongs to user
        collection = firestore.get_collection(collection_id)
        if not collection:
            return jsonify({'error': 'Collection not found', 'success': False}), 404
        if collection.get('user_id') != user_id:
            return jsonify({'error': 'Unauthorized', 'success': False}), 403
        
        logger.info(f"User {user_id} linking playlist to collection {collection_id}")
        
        # Get playlist info
        playlist_id = lyrics_service.extract_playlist_id(playlist_url)
        playlist_info = lyrics_service.get_playlist_info(playlist_url)
        
        # Save to playlist memory
        firestore.save_playlist_memory(user_id, playlist_id, {
            'playlist_url': playlist_url,
            'name': playlist_info.get('name', ''),
            'owner': playlist_info.get('owner', ''),
            'total_tracks': playlist_info.get('total_tracks', 0),
            'image_url': playlist_info.get('image_url', '')
        })
        
        # Link playlist to collection
        updated_collection = firestore.link_playlist_to_collection(collection_id, playlist_id, playlist_info)
        
        return jsonify({
            'success': True,
            'message': f'Linked playlist "{playlist_info.get("name")}" to collection',
            'collection': updated_collection,
            'playlist_id': playlist_id
        })
    except Exception as e:
        logger.error(f"Error linking playlist: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/collections/<collection_id>/playlists/<playlist_id>/unlink', methods=['DELETE'])
@require_auth
def unlink_playlist_from_collection(collection_id, playlist_id):
    """Unlink a Spotify playlist from a collection"""
    try:
        user_id = g.user.get('email')

        # Verify collection belongs to user
        collection = firestore.get_collection(collection_id)
        if not collection:
            return jsonify({'error': 'Collection not found', 'success': False}), 404
        if collection.get('user_id') != user_id:
            return jsonify({'error': 'Unauthorized', 'success': False}), 403

        logger.info(f"User {user_id} unlinking playlist {playlist_id} from collection {collection_id}")

        # Unlink playlist
        firestore.unlink_playlist_from_collection(collection_id, playlist_id)

        # Note: Songs will be marked as removed during next sync
        return jsonify({
            'success': True,
            'message': 'Playlist unlinked.'
        })
    except Exception as e:
        logger.error(f"Error unlinking playlist: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/collections/<collection_id>/playlists/reorder', methods=['PUT'])
@require_auth
def reorder_playlists(collection_id):
    """Reorder playlists in a collection"""
    try:
        user_id = g.user.get('email')

        # Verify collection belongs to user
        collection = firestore.get_collection(collection_id)
        if not collection:
            return jsonify({'error': 'Collection not found', 'success': False}), 404
        if collection.get('user_id') != user_id:
            return jsonify({'error': 'Unauthorized', 'success': False}), 403

        # Get new order from request
        data = request.get_json()
        playlist_ids = data.get('playlist_ids', [])

        if not playlist_ids or not isinstance(playlist_ids, list):
            return jsonify({'error': 'Invalid playlist_ids', 'success': False}), 400

        logger.info(f"User {user_id} reordering playlists in collection {collection_id}")

        # Update playlist order in Firestore
        firestore.reorder_collection_playlists(collection_id, playlist_ids)

        return jsonify({
            'success': True,
            'message': 'Playlist order updated'
        })
    except Exception as e:
        logger.error(f"Error reordering playlists: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/collections/<collection_id>/sync', methods=['POST'])
@require_auth
def sync_collection(collection_id):
    """Sync all playlists in a collection - detect new/removed songs"""
    from flask import Response, stream_with_context
    import json

    try:
        user_id = g.user.get('email')

        # Verify user has write access (owner or collaborator)
        collection = firestore.get_collection(collection_id)
        if not collection:
            return jsonify({'error': 'Collection not found', 'success': False}), 404
        if not firestore.can_write_collection(collection_id, user_id):
            return jsonify({'error': 'Unauthorized - you need owner or collaborator access', 'success': False}), 403
        
        logger.info(f"User {user_id} syncing collection {collection_id}")
        
        def generate():
            """Generator function that yields sync progress updates"""
            try:
                for update in lyrics_service.sync_collection_playlists(collection_id, user_id):
                    yield f"data: {json.dumps(update)}\n\n"
            except Exception as e:
                logger.error(f"Error during sync stream: {e}")
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        
        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'
            }
        )
    except Exception as e:
        logger.error(f"Error syncing collection: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/spotify/auth/url', methods=['GET'])
@require_auth
def get_spotify_auth_url():
    """Get Spotify OAuth authorization URL"""
    try:
        user_id = g.user.get('email')
        force_reauth = request.args.get('force_reauth', 'false').lower() == 'true'
        logger.info(f"User {user_id} requesting Spotify auth URL (force_reauth={force_reauth})")
        auth_url = spotify_auth.get_auth_url(user_id, force_reauth=force_reauth)

        return jsonify({
            'success': True,
            'auth_url': auth_url
        })
    except Exception as e:
        logger.error(f"Error generating Spotify auth URL: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/spotify/callback', methods=['GET'])
def spotify_callback():
    """Handle Spotify OAuth callback"""
    try:
        code = request.args.get('code')
        state = request.args.get('state')
        error = request.args.get('error')
        
        logger.info(f"Spotify callback received - code: {bool(code)}, state: {bool(state)}, error: {error}")
        
        if error:
            logger.error(f"Spotify OAuth error: {error}")
            return f"""
            <html>
                <body>
                    <script>
                        window.opener.postMessage({{type: 'spotify-auth-error', error: '{error}'}}, '*');
                        window.close();
                    </script>
                </body>
            </html>
            """
        
        if not code or not state:
            return "Invalid callback - missing code or state", 400
        
        # Exchange code for token
        result = spotify_auth.handle_callback(code, state)
        
        if not result:
            return """
            <html>
                <body>
                    <script>
                        window.opener.postMessage({type: 'spotify-auth-error', error: 'Authentication failed'}, '*');
                        window.close();
                    </script>
                </body>
            </html>
            """
        
        logger.info(f"Spotify OAuth successful for user {result['user_id']}")
        
        # Close popup and notify parent window
        return """
        <html>
            <body>
                <h2>✅ Connected to Spotify!</h2>
                <p>You can close this window.</p>
                <script>
                    window.opener.postMessage({type: 'spotify-auth-success'}, '*');
                    setTimeout(function() { window.close(); }, 2000);
                </script>
            </body>
        </html>
        """
    except Exception as e:
        logger.error(f"Error in Spotify callback: {e}")
        return f"""
        <html>
            <body>
                <script>
                    window.opener.postMessage({{type: 'spotify-auth-error', error: 'Authentication failed'}}, '*');
                    window.close();
                </script>
            </body>
        </html>
        """


@app.route('/api/spotify/token', methods=['GET'])
@require_auth
def get_spotify_user_token():
    """Get Spotify access token for authenticated user"""
    try:
        user_id = g.user.get('email')
        access_token = spotify_auth.get_user_token(user_id)

        if access_token:
            # Debug: Log token scopes for troubleshooting
            token_data = spotify_auth.firestore.get_spotify_token(user_id)
            if token_data:
                logger.info(f"Spotify token for {user_id} has scopes: {token_data.get('scope', 'N/A')}")

            return jsonify({
                'success': True,
                'access_token': access_token
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Not authenticated with Spotify',
                'needs_auth': True
            }), 401
    except Exception as e:
        logger.error(f"Error getting Spotify token for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/spotify/disconnect', methods=['POST'])
@require_auth
def disconnect_spotify():
    """Disconnect Spotify account"""
    try:
        user_id = g.user.get('email')
        logger.info(f"User {user_id} disconnecting Spotify")
        spotify_auth.disconnect_user(user_id)
        
        return jsonify({
            'success': True,
            'message': 'Spotify disconnected'
        })
    except Exception as e:
        logger.error(f"Error disconnecting Spotify for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/spotify/status', methods=['GET'])
@require_auth
def get_spotify_status():
    """Check if user has connected Spotify"""
    try:
        user_id = g.user.get('email')
        token_data = firestore.get_spotify_token(user_id)
        
        return jsonify({
            'success': True,
            'connected': bool(token_data)
        })
    except Exception as e:
        logger.error(f"Error checking Spotify status: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/spotify/preview/<track_id>', methods=['GET'])
@require_auth
def get_spotify_preview(track_id):
    """Get Spotify preview URL for a track"""
    try:
        logger.info(f"User {g.user.get('email')} requesting preview for track {track_id}")

        # Use the lyrics_service's spotify client
        track = lyrics_service.spotify.track(track_id)
        preview_url = track.get('preview_url')

        if preview_url:
            return jsonify({
                'success': True,
                'preview_url': preview_url
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No preview available for this track'
            })

    except Exception as e:
        logger.error(f"Error getting preview for track {track_id}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/health')
def health():
    """Health check endpoint for Cloud Run"""
    return jsonify({'status': 'We healthy as heck - yeah! Get Band Practice Pro!'}), 200


# ============================================================================
# ADMIN ROUTES
# ============================================================================

@app.route('/admin')
def admin_page():
    """Admin panel page - auth handled by frontend"""
    return render_template('admin.html')


@app.route('/api/admin/users', methods=['GET'])
@require_admin
def admin_get_users():
    """Get all users (admin only)"""
    try:
        order_by = request.args.get('order_by', 'created_at')
        limit = int(request.args.get('limit', 1000))

        users = user_service.get_all_users(order_by=order_by, limit=limit)

        logger.info(f"Admin {g.user.get('email')} retrieved {len(users)} users")

        return jsonify({
            'success': True,
            'users': users
        })

    except Exception as e:
        logger.error(f"Error getting users: {e}", exc_info=True)
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/admin/users/<user_id>/admin', methods=['PUT'])
@require_admin
def admin_set_user_admin(user_id):
    """Grant or revoke admin privileges for a user (admin only)"""
    try:
        data = request.get_json()
        is_admin = data.get('is_admin', False)

        success = user_service.set_admin(user_id, is_admin)

        if not success:
            return jsonify({
                'error': 'User not found',
                'success': False
            }), 404

        logger.info(f"Admin {g.user.get('email')} {'granted' if is_admin else 'revoked'} admin privileges for user {user_id}")

        # Log this action
        audit_service.log_action(
            user_id=g.user.get('uid'),
            user_email=g.user.get('email'),
            action='set_admin' if is_admin else 'revoke_admin',
            resource_type='user',
            resource_id=user_id,
            metadata={'is_admin': is_admin}
        )

        return jsonify({
            'success': True,
            'is_admin': is_admin
        })

    except Exception as e:
        logger.error(f"Error setting admin status: {e}", exc_info=True)
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/admin/audit-logs', methods=['GET'])
@require_admin
def admin_get_audit_logs():
    """Get audit logs (admin only)"""
    try:
        from datetime import datetime

        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        user_id = request.args.get('user_id')
        action = request.args.get('action')
        resource_type = request.args.get('resource_type')

        # Parse date filters if provided
        start_date = None
        end_date = None

        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')

        if start_date_str:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            except ValueError:
                pass

        if end_date_str:
            try:
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            except ValueError:
                pass

        logs = audit_service.get_logs(
            limit=limit,
            offset=offset,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            start_date=start_date,
            end_date=end_date
        )

        logger.info(f"Admin {g.user.get('email')} retrieved {len(logs)} audit logs")

        return jsonify({
            'success': True,
            'logs': logs
        })

    except Exception as e:
        logger.error(f"Error getting audit logs: {e}", exc_info=True)
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/user', methods=['GET'])
@require_auth
def get_current_user():
    """Get current user info including admin status"""
    try:
        uid = g.user.get('uid')
        user = user_service.get_user(uid)

        if not user:
            return jsonify({
                'error': 'User not found',
                'success': False
            }), 404

        return jsonify({
            'success': True,
            'uid': user.get('uid'),
            'email': user.get('email'),
            'display_name': user.get('display_name'),
            'photo_url': user.get('photo_url'),
            'is_admin': user.get('is_admin', False),
            'created_at': user.get('created_at'),
            'last_login_at': user.get('last_login_at'),
            'spotify_display_name': user.get('spotify_display_name'),
            'spotify_email': user.get('spotify_email'),
            'spotify_product': user.get('spotify_product'),
            'spotify_profile_photo': user.get('spotify_profile_photo'),
            'spotify_profile_url': user.get('spotify_profile_url'),
            'spotify_country': user.get('spotify_country'),
            'spotify_followers': user.get('spotify_followers')
        })

    except Exception as e:
        logger.error(f"Error getting user info: {e}", exc_info=True)
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/users/community', methods=['GET'])
@require_auth
def get_community_users():
    """Get list of all users (excluding email addresses for privacy)"""
    try:
        # Get all users from the database
        users = user_service.get_all_users(order_by='last_login_at', limit=1000)

        # Filter out sensitive information (email addresses)
        # Only include public profile information
        community_users = []
        for user in users:
            community_users.append({
                'uid': user.get('uid'),
                'display_name': user.get('display_name'),
                'photo_url': user.get('photo_url'),
                'is_admin': user.get('is_admin', False),
                'created_at': user.get('created_at'),
                'last_login_at': user.get('last_login_at'),
                'spotify_display_name': user.get('spotify_display_name'),
                'spotify_product': user.get('spotify_product'),
                'spotify_profile_photo': user.get('spotify_profile_photo'),
                'spotify_profile_url': user.get('spotify_profile_url'),
                'spotify_country': user.get('spotify_country'),
                'spotify_followers': user.get('spotify_followers')
            })

        return jsonify({
            'success': True,
            'users': community_users
        })

    except Exception as e:
        logger.error(f"Error getting community users: {e}", exc_info=True)
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/user/spotify-profile', methods=['POST'])
@require_auth
def update_spotify_profile():
    """Update user's Spotify profile information"""
    try:
        uid = g.user.get('uid')
        data = request.get_json()

        if not data:
            logger.warning(f"Empty request body for Spotify profile update from user {uid}")
            return jsonify({'error': 'No data provided', 'success': False}), 400

        # Extract Spotify profile fields from request
        spotify_data = {
            'uid': uid
        }

        # Map Spotify API fields to our Firestore fields
        if 'email' in data and data['email']:
            spotify_data['spotify_email'] = data['email']
        if 'product' in data and data['product']:
            spotify_data['spotify_product'] = data['product']
        if 'country' in data and data['country']:
            spotify_data['spotify_country'] = data['country']
        if 'display_name' in data and data['display_name']:
            spotify_data['spotify_display_name'] = data['display_name']
        if 'id' in data and data['id']:
            spotify_data['spotify_id'] = data['id']
        if 'uri' in data and data['uri']:
            spotify_data['spotify_uri'] = data['uri']

        # Extract profile photo (first image in the images array)
        if 'images' in data and data['images'] and len(data['images']) > 0:
            spotify_data['spotify_profile_photo'] = data['images'][0].get('url')

        # Extract follower count
        if 'followers' in data and data['followers']:
            spotify_data['spotify_followers'] = data['followers'].get('total', 0)

        # Extract Spotify profile URL
        if 'external_urls' in data and data['external_urls']:
            spotify_data['spotify_profile_url'] = data['external_urls'].get('spotify')

        logger.info(f"Updating Spotify profile for user {uid} with data: {list(spotify_data.keys())}")

        # Update user in Firestore
        updated_user = user_service.create_or_update_user(spotify_data)

        logger.info(f"✅ Updated Spotify profile for user {uid} (product: {spotify_data.get('spotify_product', 'N/A')})")

        return jsonify({
            'success': True,
            'message': 'Spotify profile updated'
        })

    except Exception as e:
        logger.error(f"Error updating Spotify profile for user {g.user.get('uid')}: {e}", exc_info=True)
        return jsonify({'error': str(e), 'success': False}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')
