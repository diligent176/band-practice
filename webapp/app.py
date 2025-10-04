"""
Band Practice Lyrics Viewer - Flask Web Application
"""

from flask import Flask, render_template, request, jsonify, g
from services.firestore_service import FirestoreService
from services.lyrics_service import LyricsService
from services.auth_service import require_auth, optional_auth
import os
from dotenv import load_dotenv
import logging

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# Initialize services
firestore = FirestoreService()
lyrics_service = LyricsService(firestore)


@app.route('/')
@require_auth
def index():
    """Main viewer page"""
    logger.info(f"User {g.user.get('email')} accessed the main page")
    return render_template('viewer.html', user=g.user)


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
        song = firestore.get_song(song_id)
        if not song:
            return jsonify({'error': 'Song not found', 'success': False}), 404

        logger.info(f"User {g.user.get('email')} refreshing lyrics for song {song_id}")
        updated_song = lyrics_service.fetch_and_update_song(
            song_id,
            song['title'],
            song['artist']
        )

        return jsonify({
            'success': True,
            'message': 'Song lyrics refreshed',
            'song': updated_song
        })
    except Exception as e:
        logger.error(f"Error refreshing song {song_id} for user {g.user.get('email')}: {e}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/user', methods=['GET'])
@require_auth
def get_user_info():
    """Get current user information"""
    return jsonify({
        'user': g.user,
        'success': True
    })


@app.route('/health')
def health():
    """Health check endpoint for Cloud Run"""
    return jsonify({'status': 'healthy'}), 200

@app.route('/health2')
def health_check():
    return {"status": "healthy", "message": "App is running!"}, 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')
