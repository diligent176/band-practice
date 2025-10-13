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
    """Get all songs from Firestore"""
    try:
        logger.info(f"User {g.user.get('email')} requested all songs")
        songs = firestore.get_all_songs()
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

        if not playlist_url:
            return jsonify({'error': 'No playlist URL provided', 'success': False}), 400

        logger.info(f"User {g.user.get('email')} requested detailed playlist info")
        details = lyrics_service.get_playlist_details_with_conflicts(playlist_url)
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
    """Import selected songs from playlist"""
    try:
        data = request.get_json()
        playlist_url = data.get('playlist_url')
        selected_songs = data.get('selected_songs', [])

        if not playlist_url or not selected_songs:
            return jsonify({'error': 'Invalid request', 'success': False}), 400

        logger.info(f"User {g.user.get('email')} importing {len(selected_songs)} songs")
        result = lyrics_service.import_selected_songs(playlist_url, selected_songs)
        return jsonify({
            'success': True,
            **result
        })
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
