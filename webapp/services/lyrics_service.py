"""
Service for fetching and syncing lyrics from Spotify/Genius
"""

import lyricsgenius
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import os
import re
from urllib.parse import urlparse


class LyricsService:
    def __init__(self, firestore_service):
        """Initialize Spotify and Genius clients"""
        self.firestore = firestore_service

        # Initialize Spotify
        self.spotify = spotipy.Spotify(
            auth_manager=SpotifyClientCredentials(
                client_id=os.getenv('SPOTIFY_CLIENT_ID'),
                client_secret=os.getenv('SPOTIFY_CLIENT_SECRET')
            )
        )

        # Initialize Genius
        self.genius = lyricsgenius.Genius(os.getenv('GENIUS_ACCESS_TOKEN'))
        self.genius.remove_section_headers = False
        self.genius.skip_non_songs = True
        self.genius.excluded_terms = ["(Remix)", "(Live)"]

    def extract_playlist_id(self, playlist_url):
        """Extract playlist ID from Spotify URL"""
        parsed = urlparse(playlist_url)
        path_parts = parsed.path.split('/')
        if 'playlist' in path_parts:
            playlist_index = path_parts.index('playlist')
            if len(path_parts) > playlist_index + 1:
                playlist_id = path_parts[playlist_index + 1].split('?')[0]
                return playlist_id
        raise ValueError("Invalid Spotify playlist URL")

    def sync_playlist(self, playlist_url):
        """Sync all songs from Spotify playlist"""
        playlist_id = self.extract_playlist_id(playlist_url)

        # Get playlist tracks
        results = self.spotify.playlist_tracks(playlist_id)
        tracks = results['items']

        # Handle pagination
        while results['next']:
            results = self.spotify.next(results)
            tracks.extend(results['items'])

        stats = {'total': len(tracks), 'added': 0, 'updated': 0, 'failed': 0}

        for item in tracks:
            track = item['track']
            if not track:
                continue

            title = track['name']
            artist = track['artists'][0]['name']
            album = track['album']['name']
            year = track['album']['release_date'][:4] if track['album'].get('release_date') else 'Unknown'

            # Create song ID
            song_id = self._create_song_id(title, artist)

            try:
                # Check if song exists
                exists = self.firestore.song_exists(song_id)

                # Fetch lyrics from Genius
                lyrics_data = self._fetch_lyrics(title, artist)

                # Prepare song data
                song_data = {
                    'title': title,
                    'artist': artist,
                    'album': album,
                    'year': year,
                    'spotify_uri': track['uri'],
                    'lyrics': lyrics_data['lyrics'],
                    'lyrics_numbered': lyrics_data['lyrics_numbered'],
                    'bpm': 'N/A'  # Could add BPM fetching if available
                }

                # Save to Firestore
                self.firestore.create_or_update_song(song_id, song_data)

                if exists:
                    stats['updated'] += 1
                else:
                    stats['added'] += 1

            except Exception as e:
                print(f"Failed to sync {artist} - {title}: {e}")
                stats['failed'] += 1

        return stats

    def fetch_and_update_song(self, song_id, title, artist):
        """Fetch and update lyrics for a single song"""
        lyrics_data = self._fetch_lyrics(title, artist)

        song_data = {
            'lyrics': lyrics_data['lyrics'],
            'lyrics_numbered': lyrics_data['lyrics_numbered']
        }

        self.firestore.create_or_update_song(song_id, song_data)
        return self.firestore.get_song(song_id)

    def _fetch_lyrics(self, title, artist):
        """Fetch lyrics from Genius and format them"""
        try:
            song = self.genius.search_song(title, artist)

            if not song or not song.lyrics:
                return {
                    'lyrics': f"Lyrics not found for {title} by {artist}",
                    'lyrics_numbered': f"Lyrics not found for {title} by {artist}"
                }

            # Clean up lyrics
            lyrics = song.lyrics
            lyrics = re.sub(r'.*?Lyrics', '', lyrics, count=1)  # Remove "XXXLyrics" header
            lyrics = re.sub(r'\d+Embed$', '', lyrics)  # Remove "XXEmbed" footer
            lyrics = re.sub(r'You might also like', '', lyrics)
            lyrics = lyrics.strip()

            # Create numbered version
            lyrics_numbered = self._add_line_numbers(lyrics)

            return {
                'lyrics': lyrics,
                'lyrics_numbered': lyrics_numbered
            }

        except Exception as e:
            print(f"Error fetching lyrics: {e}")
            return {
                'lyrics': f"Error fetching lyrics: {str(e)}",
                'lyrics_numbered': f"Error fetching lyrics: {str(e)}"
            }

    def _add_line_numbers(self, lyrics):
        """Add line numbers to lyrics (skip section headers)"""
        lines = lyrics.split('\n')
        formatted_lines = []
        line_num = 1

        for line in lines:
            # Check if line is a section header like [Verse 1], [Chorus]
            if re.match(r'^\[.*\]', line.strip()):
                formatted_lines.append(f'\n**{line.strip()}**')
            elif line.strip():
                formatted_lines.append(f'{line_num:3d}  {line}')
                line_num += 1
            else:
                formatted_lines.append('')

        return '\n'.join(formatted_lines)

    def _create_song_id(self, title, artist):
        """Create a consistent song ID from title and artist"""
        # Remove special characters and create ID
        clean_title = re.sub(r'[^\w\s]', '', title)
        clean_artist = re.sub(r'[^\w\s]', '', artist)
        song_id = f"{clean_title}__{clean_artist}".replace(' ', '_')
        return song_id
