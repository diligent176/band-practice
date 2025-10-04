"""
Band Practice Lyrics Viewer - Flask Web Application
"""

from flask import Flask, render_template, request, jsonify
from services.firestore_service import FirestoreService
from services.lyrics_service import LyricsService
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# Initialize services
firestore = FirestoreService()
lyrics_service = LyricsService(firestore)


@app.route('/')
def index():
    """Main viewer page"""
    return render_template('viewer.html')


@app.route('/api/songs', methods=['GET'])
def get_songs():
    """Get all songs from Firestore"""
    try:
        songs = firestore.get_all_songs()
        return jsonify({'songs': songs, 'success': True})
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/songs/<song_id>', methods=['GET'])
def get_song(song_id):
    """Get a specific song with lyrics and notes"""
    try:
        song = firestore.get_song(song_id)
        if not song:
            return jsonify({'error': 'Song not found', 'success': False}), 404
        return jsonify({'song': song, 'success': True})
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/songs/<song_id>/notes', methods=['PUT'])
def update_notes(song_id):
    """Update drummer notes for a song"""
    try:
        data = request.get_json()
        notes = data.get('notes', '')

        firestore.update_notes(song_id, notes)
        return jsonify({'success': True, 'message': 'Notes updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/playlist/sync', methods=['POST'])
def sync_playlist():
    """Fetch/update all songs from Spotify playlist"""
    try:
        data = request.get_json()
        playlist_url = data.get('playlist_url', os.getenv('SPOTIFY_PLAYLIST_URL'))

        if not playlist_url:
            return jsonify({'error': 'No playlist URL provided', 'success': False}), 400

        result = lyrics_service.sync_playlist(playlist_url)
        return jsonify({
            'success': True,
            'message': f"Synced {result['total']} songs",
            'added': result['added'],
            'updated': result['updated'],
            'failed': result['failed']
        })
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/songs/<song_id>/refresh', methods=['POST'])
def refresh_song(song_id):
    """Refresh lyrics for a specific song"""
    try:
        song = firestore.get_song(song_id)
        if not song:
            return jsonify({'error': 'Song not found', 'success': False}), 404

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
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/health')
def health():
    """Health check endpoint for Cloud Run"""
    return jsonify({'status': 'healthy'}), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_ENV') == 'development')
