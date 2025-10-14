"""
Lyrics Service - Fetch lyrics from Genius using official API + web scraping

This service integrates with:
1. Spotify API - to sync playlist tracks
2. Genius API - to search for songs
3. Web scraping - to extract lyrics from Genius pages
4. ScraperAPI (optional) - to bypass IP blocking

ScraperAPI Integration:
- If SCRAPER_API_KEY environment variable is set, uses ScraperAPI for web scraping
- If not set, falls back to direct requests with browser headers
- Sign up at https://www.scraperapi.com/ for 1000 free requests/month

ScraperAPI Benefits:
- Rotates IPs from a pool of millions
- Handles headers and cookies automatically
- Bypasses CAPTCHAs
- Manages retries
"""

import requests
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import os
import re
from urllib.parse import urlparse, quote


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

        # Genius API configuration
        self.genius_token = os.getenv('GENIUS_ACCESS_TOKEN')
        self.genius_base_url = 'https://api.genius.com'
        self.genius_headers = {
            'Authorization': f'Bearer {self.genius_token}'
        }

        # ScraperAPI configuration (optional - only for scraping)
        self.scraper_api_key = os.getenv('SCRAPER_API_KEY')
        self.use_scraper_api = bool(self.scraper_api_key)

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

    def get_playlist_info(self, playlist_url):
        """Get basic playlist information without syncing"""
        playlist_id = self.extract_playlist_id(playlist_url)

        # Get playlist details
        playlist = self.spotify.playlist(playlist_id)

        return {
            'name': playlist['name'],
            'total_tracks': playlist['tracks']['total'],
            'description': playlist.get('description', ''),
            'owner': playlist['owner']['display_name']
        }

    def get_playlist_details_with_conflicts(self, playlist_url):
        """Get detailed playlist information with conflict detection"""
        playlist_id = self.extract_playlist_id(playlist_url)

        # Get playlist details
        playlist = self.spotify.playlist(playlist_id)

        # Get playlist tracks
        results = self.spotify.playlist_tracks(playlist_id)
        tracks = results['items']

        # Handle pagination
        while results['next']:
            results = self.spotify.next(results)
            tracks.extend(results['items'])

        songs_list = []
        for item in tracks:
            track = item['track']
            if not track:
                continue

            title = track['name']
            artist = track['artists'][0]['name']
            album = track['album']['name']
            year = track['album']['release_date'][:4] if track['album'].get('release_date') else 'Unknown'

            # Get album art (smallest available)
            album_art = None
            if track['album'].get('images'):
                # Get the smallest image
                album_art = track['album']['images'][-1]['url']

            # Don't fetch BPM during playlist details - it will be fetched in background when song is selected
            bpm = 'N/A'

            # Create song ID
            song_id = self._create_song_id(title, artist)

            # Check if song exists and has conflicts
            status = 'new'
            has_conflict = False
            existing_song = None

            if self.firestore.song_exists(song_id):
                existing_song = self.firestore.get_song(song_id)
                status = 'existing'

                # Check for conflicts (customized lyrics or notes)
                if existing_song.get('is_customized'):
                    has_conflict = True
                    status = 'conflict'
                elif existing_song.get('notes', '').strip():
                    has_conflict = True
                    status = 'conflict'

            song_data = {
                'id': song_id,
                'title': title,
                'artist': artist,
                'album': album,
                'year': year,
                'album_art': album_art,
                'spotify_uri': track['uri'],
                'bpm': bpm,
                'status': status,
                'has_conflict': has_conflict
            }

            songs_list.append(song_data)

        # Get playlist cover image
        image_url = ''
        if playlist.get('images') and len(playlist['images']) > 0:
            # Get the smallest image (last in list)
            image_url = playlist['images'][-1]['url']

        return {
            'playlist': {
                'id': playlist_id,
                'name': playlist['name'],
                'description': playlist.get('description', ''),
                'owner': playlist['owner']['display_name'],
                'total_tracks': len(songs_list),
                'image_url': image_url
            },
            'songs': songs_list
        }

    def import_selected_songs(self, playlist_url, selected_song_ids):
        """Import only selected songs from playlist"""
        playlist_id = self.extract_playlist_id(playlist_url)

        # Get playlist tracks
        results = self.spotify.playlist_tracks(playlist_id)
        tracks = results['items']

        # Handle pagination
        while results['next']:
            results = self.spotify.next(results)
            tracks.extend(results['items'])

        stats = {'total': len(selected_song_ids), 'added': 0, 'updated': 0, 'skipped': 0, 'failed': 0}
        results_list = []

        for item in tracks:
            track = item['track']
            if not track:
                continue

            title = track['name']
            artist = track['artists'][0]['name']
            album = track['album']['name']
            year = track['album']['release_date'][:4] if track['album'].get('release_date') else 'Unknown'

            # Get album art (smallest available)
            album_art_url = None
            if track['album'].get('images'):
                # Get the smallest image
                album_art_url = track['album']['images'][-1]['url']

            # Create song ID
            song_id = self._create_song_id(title, artist)

            # Skip if not in selected list
            if song_id not in selected_song_ids:
                continue

            result = {
                'id': song_id,
                'title': title,
                'artist': artist,
                'status': 'importing',
                'message': ''
            }

            try:
                # Check if song exists
                exists = self.firestore.song_exists(song_id)

                # Check for conflicts and skip if found
                if exists:
                    existing_song = self.firestore.get_song(song_id)
                    if existing_song.get('is_customized') or existing_song.get('notes', '').strip():
                        result['status'] = 'skipped'
                        result['message'] = 'Song has custom lyrics or notes - skipped'
                        stats['skipped'] += 1
                        results_list.append(result)
                        continue

                # Fetch lyrics from Genius
                lyrics_data = self._fetch_lyrics(title, artist)

                # Prepare song data (BPM will be fetched in background via separate API call)
                song_data = {
                    'title': title,
                    'artist': artist,
                    'album': album,
                    'year': year,
                    'album_art_url': album_art_url,
                    'spotify_uri': track['uri'],
                    'lyrics': lyrics_data['lyrics'],
                    'lyrics_numbered': lyrics_data['lyrics_numbered'],
                    'bpm': 'N/A'  # Will be updated by background fetch
                }

                # Save to Firestore
                self.firestore.create_or_update_song(song_id, song_data)

                if exists:
                    result['status'] = 'updated'
                    result['message'] = 'Updated successfully'
                    stats['updated'] += 1
                else:
                    result['status'] = 'added'
                    result['message'] = 'Added successfully'
                    stats['added'] += 1

            except Exception as e:
                print(f"Failed to import {artist} - {title}: {e}")
                result['status'] = 'failed'
                result['message'] = str(e)
                stats['failed'] += 1

            results_list.append(result)

        return {
            'stats': stats,
            'results': results_list
        }

    def import_selected_songs_stream(self, playlist_url, selected_song_ids):
        """
        Import selected songs from playlist with real-time progress updates.
        This is a generator function that yields progress updates as songs are processed.
        
        Yields:
            dict: Progress updates with format:
                - type: 'progress' | 'complete' | 'error'
                - completed: number of songs completed so far
                - total: total number of songs
                - result: details about the current song (for 'progress' type)
                - stats: final statistics (for 'complete' type)
                - results: all results (for 'complete' type)
        """
        playlist_id = self.extract_playlist_id(playlist_url)

        # Get playlist tracks
        results = self.spotify.playlist_tracks(playlist_id)
        tracks = results['items']

        # Handle pagination
        while results['next']:
            results = self.spotify.next(results)
            tracks.extend(results['items'])

        stats = {'total': len(selected_song_ids), 'added': 0, 'updated': 0, 'skipped': 0, 'failed': 0}
        results_list = []
        completed = 0

        for item in tracks:
            track = item['track']
            if not track:
                continue

            title = track['name']
            artist = track['artists'][0]['name']
            album = track['album']['name']
            year = track['album']['release_date'][:4] if track['album'].get('release_date') else 'Unknown'

            # Get album art (smallest available)
            album_art_url = None
            if track['album'].get('images'):
                # Get the smallest image
                album_art_url = track['album']['images'][-1]['url']

            # Create song ID
            song_id = self._create_song_id(title, artist)

            # Skip if not in selected list
            if song_id not in selected_song_ids:
                continue

            result = {
                'id': song_id,
                'title': title,
                'artist': artist,
                'status': 'importing',
                'message': ''
            }

            try:
                # Check if song exists
                exists = self.firestore.song_exists(song_id)

                # Check for conflicts and skip if found
                if exists:
                    existing_song = self.firestore.get_song(song_id)
                    if existing_song.get('is_customized') or existing_song.get('notes', '').strip():
                        result['status'] = 'skipped'
                        result['message'] = 'Song has custom lyrics or notes - skipped'
                        stats['skipped'] += 1
                        results_list.append(result)
                        completed += 1
                        
                        # Yield progress update
                        yield {
                            'type': 'progress',
                            'completed': completed,
                            'total': stats['total'],
                            'result': result
                        }
                        continue

                # Fetch lyrics from Genius
                lyrics_data = self._fetch_lyrics(title, artist)

                # Prepare song data (BPM will be fetched in background via separate API call)
                song_data = {
                    'title': title,
                    'artist': artist,
                    'album': album,
                    'year': year,
                    'album_art_url': album_art_url,
                    'spotify_uri': track['uri'],
                    'lyrics': lyrics_data['lyrics'],
                    'lyrics_numbered': lyrics_data['lyrics_numbered'],
                    'bpm': 'N/A'  # Will be updated by background fetch
                }

                # Save to Firestore
                self.firestore.create_or_update_song(song_id, song_data)

                if exists:
                    result['status'] = 'updated'
                    result['message'] = 'Updated successfully'
                    stats['updated'] += 1
                else:
                    result['status'] = 'added'
                    result['message'] = 'Added successfully'
                    stats['added'] += 1

            except Exception as e:
                print(f"Failed to import {artist} - {title}: {e}")
                result['status'] = 'failed'
                result['message'] = str(e)
                stats['failed'] += 1

            results_list.append(result)
            completed += 1
            
            # Yield progress update after each song
            yield {
                'type': 'progress',
                'completed': completed,
                'total': stats['total'],
                'result': result
            }

        # Yield final completion update
        yield {
            'type': 'complete',
            'stats': stats,
            'results': results_list
        }

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

            # Get album art (smallest available)
            album_art_url = None
            if track['album'].get('images'):
                # Get the smallest image
                album_art_url = track['album']['images'][-1]['url']

            # Create song ID
            song_id = self._create_song_id(title, artist)

            try:
                # Check if song exists
                exists = self.firestore.song_exists(song_id)

                # Skip if song is customized
                if exists:
                    existing_song = self.firestore.get_song(song_id)
                    if existing_song.get('is_customized'):
                        print(f"Skipping customized song: {artist} - {title}")
                        continue

                # Fetch lyrics from Genius
                lyrics_data = self._fetch_lyrics(title, artist)

                # Prepare song data (BPM will be fetched in background via separate API call)
                song_data = {
                    'title': title,
                    'artist': artist,
                    'album': album,
                    'year': year,
                    'album_art_url': album_art_url,
                    'spotify_uri': track['uri'],
                    'lyrics': lyrics_data['lyrics'],
                    'lyrics_numbered': lyrics_data['lyrics_numbered'],
                    'bpm': 'N/A'  # Will be updated by background fetch
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

    def fetch_and_update_song(self, song_id, title, artist, clear_customization=False):
        """Fetch and update lyrics for a single song"""
        lyrics_data = self._fetch_lyrics(title, artist)

        song_data = {
            'lyrics': lyrics_data['lyrics'],
            'lyrics_numbered': lyrics_data['lyrics_numbered']
        }

        # Clear customization flag if requested
        if clear_customization:
            song_data['is_customized'] = False

        self.firestore.create_or_update_song(song_id, song_data)
        return self.firestore.get_song(song_id)

    def fetch_and_update_bpm(self, song_id, title, artist):
        """Fetch and update BPM for a single song (called asynchronously from frontend)"""
        # Check if BPM was already marked as not found
        existing_song = self.firestore.get_song(song_id)
        if existing_song and existing_song.get('bpm') == 'NOT_FOUND':
            print(f"BPM previously marked as NOT_FOUND for '{title}' by {artist} - skipping lookup")
            return {'bpm': 'NOT_FOUND'}
        
        bpm = self._fetch_bpm(title, artist)
        
        # If BPM is N/A, mark it as NOT_FOUND to avoid repeated lookups
        if bpm == 'N/A':
            bpm = 'NOT_FOUND'
        
        song_data = {'bpm': bpm}
        self.firestore.create_or_update_song(song_id, song_data)
        
        return {'bpm': bpm}

    def _search_genius(self, query):
        """Search Genius API for a song"""
        search_url = f'{self.genius_base_url}/search'
        params = {'q': query}

        response = requests.get(search_url, headers=self.genius_headers, params=params)
        response.raise_for_status()

        return response.json()

    def _scrape_with_scraperapi(self, url):
        """Use ScraperAPI to fetch a URL"""
        payload = {
            'api_key': self.scraper_api_key,
            'url': url,
            'render': 'false'  # Set to 'true' if JavaScript rendering needed
        }

        response = requests.get('http://api.scraperapi.com', params=payload, timeout=30)
        response.raise_for_status()
        return response.text

    def _scrape_lyrics_from_page(self, url):
        """
        Scrape lyrics from Genius page using BeautifulSoup
        Uses ScraperAPI if available, otherwise direct request with headers
        """
        try:
            from bs4 import BeautifulSoup
            import re

            # Try ScraperAPI first if available
            if self.use_scraper_api:
                print(f"Using ScraperAPI to fetch {url}")
                html_content = self._scrape_with_scraperapi(url)
            else:
                # Fallback to direct request with browser headers
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Cache-Control': 'max-age=0',
                }
                response = requests.get(url, headers=headers, timeout=10)
                response.raise_for_status()
                html_content = response.text

            soup = BeautifulSoup(html_content, 'html.parser')

            # Find lyrics container - Genius uses data-lyrics-container attribute
            lyrics_divs = soup.find_all('div', {'data-lyrics-container': 'true'})

            if not lyrics_divs:
                # Fallback: try finding by class
                lyrics_divs = soup.find_all('div', class_=re.compile('Lyrics__Container'))

            if not lyrics_divs:
                return None

            # Extract text from all lyrics containers
            lyrics_parts = []
            for div in lyrics_divs:
                # Get text with line breaks preserved
                for br in div.find_all('br'):
                    br.replace_with('\n')
                text = div.get_text()
                lyrics_parts.append(text)

            lyrics = '\n'.join(lyrics_parts)

            # Clean up
            lyrics = re.sub(r'\[.*?\]', lambda m: f'\n{m.group(0)}\n', lyrics)  # Add newlines around section headers
            lyrics = re.sub(r'\n\n+', '\n\n', lyrics)  # Remove excessive newlines
            lyrics = lyrics.strip()

            return lyrics

        except Exception as e:
            print(f"Error scraping lyrics from {url}: {e}")
            return None

    def _fetch_lyrics(self, title, artist):
        """Fetch lyrics from Genius using official API + scraping"""
        try:
            # Search for the song
            query = f"{title} {artist}"
            search_results = self._search_genius(query)

            if not search_results.get('response', {}).get('hits'):
                return {
                    'lyrics': f"Lyrics not found for {title} by {artist}",
                    'lyrics_numbered': f"Lyrics not found for {title} by {artist}"
                }

            # Get the first result
            first_hit = search_results['response']['hits'][0]['result']
            song_url = first_hit.get('url')
            song_title = first_hit.get('title')
            song_artist = first_hit.get('primary_artist', {}).get('name')

            print(f"Found on Genius: {song_title} by {song_artist}")

            # Scrape lyrics from the song page
            lyrics = self._scrape_lyrics_from_page(song_url)

            if not lyrics:
                return {
                    'lyrics': f"Could not retrieve lyrics for {title} by {artist}",
                    'lyrics_numbered': f"Could not retrieve lyrics for {title} by {artist}"
                }

            # Clean up lyrics
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
        return self._add_line_numbers_static(lyrics)

    @staticmethod
    def _add_line_numbers_static(lyrics):
        """Static method to add line numbers to lyrics (skip section headers)"""
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

    def _fetch_bpm(self, title, artist):
        """
        Fetch BPM (tempo) from GetSongBPM API

        NOTE: Spotify's audio_features API was deprecated in November 2024
        and now returns 403 errors for all new applications.

        Args:
            title: Song title
            artist: Artist name

        Returns:
            BPM as integer, or 'N/A' if unavailable
        """
        try:
            # Check if GetSongBPM API key is configured
            api_key = os.getenv('GETSONGBPM_API_KEY')
            if not api_key:
                print("GetSongBPM API key not configured - BPM will be 'N/A'")
                return 'N/A'

            # Search for the song - use CORRECT base URL: api.getsong.co
            search_url = 'https://api.getsong.co/search/'
            
            # Try searching with just the title first (works better than "artist title")
            params = {
                'api_key': api_key,
                'type': 'song',
                'lookup': title
            }

            response = requests.get(search_url, params=params, timeout=10)

            if response.status_code == 200:
                data = response.json()
                # Check if we got results (search is an array when successful)
                if data.get('search') and isinstance(data['search'], list) and len(data['search']) > 0:
                    # Try to find a match with the artist name
                    for result in data['search']:
                        result_artist = result.get('artist', {})
                        if isinstance(result_artist, dict):
                            result_artist_name = result_artist.get('name', '').lower()
                        else:
                            result_artist_name = ''
                        
                        # Check if artist name matches (case-insensitive partial match)
                        if artist.lower() in result_artist_name or result_artist_name in artist.lower():
                            tempo = result.get('tempo')
                            if tempo:
                                try:
                                    bpm = int(float(tempo))
                                    print(f"Fetched BPM from GetSongBPM: {bpm} for '{title}' by {artist}")
                                    return bpm
                                except (ValueError, TypeError):
                                    pass
                    
                    # If no artist match, use first result with valid tempo
                    first_result = data['search'][0]
                    tempo = first_result.get('tempo')
                    if tempo:
                        try:
                            bpm = int(float(tempo))
                            print(f"Fetched BPM from GetSongBPM: {bpm} for '{title}' (used first result)")
                            return bpm
                        except (ValueError, TypeError):
                            pass

            print(f"No BPM found for '{title}' by {artist}")
            return 'N/A'

        except Exception as e:
            print(f"Error fetching BPM for '{title}' by {artist}: {e}")
            return 'N/A'

    def _create_song_id(self, title, artist):
        """Create a consistent song ID from title and artist"""
        # Remove special characters and create ID
        clean_title = re.sub(r'[^\w\s]', '', title)
        clean_artist = re.sub(r'[^\w\s]', '', artist)
        song_id = f"{clean_title}__{clean_artist}".replace(' ', '_')
        return song_id
