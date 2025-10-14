"""
Band Practice PRO - Flask Web Application
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
from services.auth_service import require_auth, optional_auth

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


@app.route('/')
def index():
    """Main viewer page with Firebase auth"""
    # Return the HTML that includes Firebase Auth UI
    return render_template('viewer.html')


@app.route('/api/songs', methods=['GET'])
@require_auth
def get_songs():
    """Get all songs from Firestore, optionally filtered by collection_id"""
    try:
        collection_id = request.args.get('collection_id')
        logger.info(f"User {g.user.get('email')} requested songs (collection_id={collection_id})")
        songs = firestore.get_all_songs(collection_id=collection_id)
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
    """Update drummer notes for a song"""
    try:
        data = request.get_json()
        notes = data.get('notes', '')

        logger.info(f"User {g.user.get('email')} updating notes for song {song_id}")
        firestore.update_notes(song_id, notes)
        return jsonify({'success': True, 'message': 'Notes updated successfully'})
    except Exception as e:
        logger.error(f"Error updating notes for song {song_id} by user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/songs/<song_id>/lyrics', methods=['PUT'])
@require_auth
def update_lyrics(song_id):
    """Update lyrics for a song and mark as customized"""
    try:
        data = request.get_json()
        lyrics = data.get('lyrics', '')

        logger.info(f"User {g.user.get('email')} updating lyrics for song {song_id}")

        # Update lyrics and mark as customized
        firestore.update_lyrics(song_id, lyrics, is_customized=True)

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
    """Fetch BPM for a specific song (called asynchronously from frontend)"""
    try:
        song = firestore.get_song(song_id)
        if not song:
            return jsonify({'error': 'Song not found', 'success': False}), 404

        logger.info(f"User {g.user.get('email')} fetching BPM for song {song_id}")
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
    """Manually update BPM for a song (user override)"""
    try:
        data = request.get_json()
        bpm_value = data.get('bpm')

        if bpm_value is None:
            return jsonify({'error': 'BPM value is required', 'success': False}), 400

        # Validate BPM value
        if isinstance(bpm_value, str):
            if bpm_value not in ['N/A', 'NOT_FOUND']:
                return jsonify({'error': 'Invalid BPM value', 'success': False}), 400
        else:
            try:
                bpm_int = int(bpm_value)
                if bpm_int <= 0 or bpm_int > 300:
                    return jsonify({'error': 'BPM must be between 1 and 300', 'success': False}), 400
                bpm_value = bpm_int
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid BPM value', 'success': False}), 400

        song = firestore.get_song(song_id)
        if not song:
            return jsonify({'error': 'Song not found', 'success': False}), 404

        logger.info(f"User {g.user.get('email')} manually updating BPM for song {song_id} to {bpm_value}")
        firestore.update_bpm(song_id, bpm_value, is_manual=True)

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
    """Delete a song from the database"""
    try:
        song = firestore.get_song(song_id)
        if not song:
            return jsonify({'error': 'Song not found', 'success': False}), 404

        logger.info(f"User {g.user.get('email')} deleting song {song_id}: {song.get('title')} by {song.get('artist')}")
        firestore.delete_song(song_id)

        return jsonify({
            'success': True,
            'message': f"Deleted '{song.get('title')}' by {song.get('artist')}"
        })
    except Exception as e:
        logger.error(f"Error deleting song {song_id} for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/user', methods=['GET'])
@require_auth
def get_user_info():
    """Get current user information"""
    logger.info(f"User info requested: {g.user}")
    return jsonify({
        'user': g.user,
        'success': True
    })


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
    """Get all collections for the current user"""
    try:
        user_id = g.user.get('email')
        logger.info(f"User {user_id} requested collections")

        collections = firestore.get_user_collections(user_id)

        return jsonify({
            'success': True,
            'collections': collections
        })
    except Exception as e:
        logger.error(f"Error getting collections for user {g.user.get('email')}: {e}")
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

        # Verify the collection belongs to this user
        if collection.get('user_id') != user_id:
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
    """Update a collection's name and/or description"""
    try:
        user_id = g.user.get('email')
        data = request.get_json()

        # Verify the collection belongs to this user
        collection = firestore.get_collection(collection_id)
        if not collection:
            return jsonify({'error': 'Collection not found', 'success': False}), 404

        if collection.get('user_id') != user_id:
            return jsonify({'error': 'Unauthorized', 'success': False}), 403

        name = data.get('name')
        description = data.get('description')

        logger.info(f"User {user_id} updating collection {collection_id}")

        firestore.update_collection(collection_id, name=name, description=description)

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
    """Delete a collection and all its associated songs"""
    try:
        user_id = g.user.get('email')

        # Verify the collection belongs to this user
        collection = firestore.get_collection(collection_id)
        if not collection:
            return jsonify({'error': 'Collection not found', 'success': False}), 404

        if collection.get('user_id') != user_id:
            return jsonify({'error': 'Unauthorized', 'success': False}), 403

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


@app.route('/health')
def health():
    """Health check endpoint for Cloud Run"""
    return jsonify({'status': 'We healthy as heck - yeah! Get Band Practice PRO!'}), 200


@app.route('/health2')
def health_check():
    return {"status": "healthy", "message": "Band Practice PRO is up and running!"}, 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')
