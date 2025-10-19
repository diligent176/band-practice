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
from datetime import datetime


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
            'owner': playlist['owner']['display_name'],
            'image_url': playlist['images'][0]['url'] if playlist.get('images') else ''
        }

    def get_playlist_details_with_conflicts(self, playlist_url, collection_id=None):
        """
        Get detailed playlist information with conflict detection
        
        Args:
            playlist_url: Spotify playlist URL
            collection_id: Optional collection ID to check for conflicts within that collection
        """
        playlist_id = self.extract_playlist_id(playlist_url)

        # Get playlist details
        playlist = self.spotify.playlist(playlist_id)

        # Get playlist tracks - ALL DATA including album art comes from this ONE API call!
        results = self.spotify.playlist_tracks(playlist_id)
        tracks = results['items']

        # Handle pagination
        while results['next']:
            results = self.spotify.next(results)
            tracks.extend(results['items'])

        # OPTIMIZATION: Batch fetch all existing songs in this collection to avoid N individual Firestore reads
        existing_songs_map = {}
        if collection_id:
            # Get all songs in this collection with ONE Firestore query
            existing_songs = self.firestore.get_all_songs(collection_id=collection_id)
            # Build a lookup dictionary for O(1) access
            existing_songs_map = {song['id']: song for song in existing_songs}
            print(f"✅ Optimized: Loaded {len(existing_songs_map)} existing songs in ONE query (instead of {len(tracks)} individual reads)")

        songs_list = []
        for item in tracks:
            track = item['track']
            if not track:
                continue

            title = track['name']
            artist = track['artists'][0]['name']
            album = track['album']['name']
            year = track['album']['release_date'][:4] if track['album'].get('release_date') else 'Unknown'

            # Get album art (smallest available) - already in the tracks response!
            album_art = None
            if track['album'].get('images'):
                # Get the smallest image
                album_art = track['album']['images'][-1]['url']

            # Don't fetch BPM during playlist details - it will be fetched in background when song is selected
            bpm = 'N/A'

            # Create song ID with collection context for conflict detection
            song_id = self._create_song_id(title, artist, collection_id)

            # Check if song exists and has conflicts (using in-memory lookup instead of Firestore calls)
            status = 'new'
            has_conflict = False
            existing_song = existing_songs_map.get(song_id)

            if existing_song:
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

    def import_selected_songs_stream(self, playlist_url, selected_song_ids, collection_id=None):
        """
        Import selected songs from playlist with real-time progress updates.
        This is a generator function that yields progress updates as songs are processed.
        
        Args:
            playlist_url: Spotify playlist URL
            selected_song_ids: List of song IDs to import
            collection_id: Collection ID to assign songs to (optional)
        
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

        for position, item in enumerate(tracks):
            track = item['track']
            if not track:
                continue

            # V2: Extract Spotify track ID (unique identifier)
            spotify_track_id = track['id']
            title = track['name']
            artist = track['artists'][0]['name']
            album = track['album']['name']
            year = track['album']['release_date'][:4] if track['album'].get('release_date') else 'Unknown'

            # Get album art (smallest available)
            album_art_url = None
            if track['album'].get('images'):
                # Get the smallest image
                album_art_url = track['album']['images'][-1]['url']

            # V2: Create song ID using Spotify track ID + collection ID
            song_id = self._create_song_id(spotify_track_id, collection_id)

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

                # Skip lyrics fetching during import for speed - will be loaded on-demand
                print(f"⚡ Importing {artist} - {title} (lyrics will load on-demand)...")
                
                # Prepare song data WITHOUT lyrics for fast import
                song_data = {
                    'spotify_track_id': spotify_track_id,  # V2: Store Spotify's unique track ID
                    'title': title,
                    'artist': artist,
                    'album': album,
                    'year': year,
                    'album_art_url': album_art_url,
                    'spotify_uri': track['uri'],
                    'lyrics': '',  # Empty - will be fetched on first view
                    'lyrics_numbered': '',  # Empty - will be fetched on first view
                    'lyrics_fetched': False,  # Flag to know lyrics haven't been fetched yet
                    'bpm': 'N/A',  # Will be updated by background fetch
                    'source_playlist_ids': [playlist_id],  # V2: Track which playlists contain this song
                    'playlist_positions': {playlist_id: position}  # V2: Track natural order position in each playlist
                }
                
                # Add collection_id if provided
                if collection_id:
                    song_data['collection_id'] = collection_id

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
            'lyrics_numbered': lyrics_data['lyrics_numbered'],
            'lyrics_fetched': True  # Mark as fetched
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
        
        # Clear the manual flag since this is from API lookup
        song_data = {
            'bpm': bpm,
            'bpm_manual': False
        }
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
                response = requests.get(url, headers=headers, timeout=5)  # Reduced from 10 to 5 seconds
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

    @staticmethod
    def _add_line_numbers(lyrics):
        """Add line numbers to lyrics (skip section headers)"""
        lines = lyrics.split('\n')
        formatted_lines = []
        line_num = 1

        for line in lines:
            # Check if line is a section header like [Verse 1], [Chorus]
            if re.match(r'^\[.*\]', line.strip()):
                # Remove brackets and make it a subtle tab header
                section_text = re.sub(r'[\[\]]', '', line.strip())
                formatted_lines.append(f'\n**{section_text}**')
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

    def _create_song_id(self, spotify_track_id, collection_id):
        """
        V2: Create a consistent song ID from Spotify track ID and collection_id
        
        Format: collection_id__spotify_track_id
        
        This ensures:
        - Same Spotify track in multiple playlists within a collection = one song
        - Same Spotify track across different collections = separate songs with independent data
        
        Args:
            spotify_track_id: Spotify's unique track identifier
            collection_id: Collection document ID
            
        Returns:
            Song ID string
        """
        return f"{collection_id}__{spotify_track_id}"

    # =========================================================================
    # V2: Playlist Sync Methods
    # =========================================================================

    def fetch_playlist_tracks_metadata(self, playlist_url):
        """
        V2: Fetch playlist tracks metadata without creating songs
        
        Args:
            playlist_url: Spotify playlist URL
            
        Returns:
            Dict with structure:
            {
                'playlist_id': 'xxx',
                'playlist_name': 'My Playlist',
                'owner': 'User',
                'image_url': '...',
                'tracks': [
                    {
                        'spotify_track_id': 'xxx',
                        'title': '...',
                        'artist': '...',
                        'album': '...',
                        'position': 0
                    },
                    ...
                ]
            }
        """
        playlist_id = self.extract_playlist_id(playlist_url)
        
        # Get playlist details
        playlist = self.spotify.playlist(playlist_id)
        
        # Get playlist cover image
        image_url = ''
        if playlist.get('images') and len(playlist['images']) > 0:
            image_url = playlist['images'][-1]['url']
        
        # Get playlist tracks
        results = self.spotify.playlist_tracks(playlist_id)
        tracks = results['items']
        
        # Handle pagination
        while results['next']:
            results = self.spotify.next(results)
            tracks.extend(results['items'])
        
        # Extract track metadata
        track_list = []
        for position, item in enumerate(tracks):
            track = item['track']
            if not track:
                continue
            
            track_list.append({
                'spotify_track_id': track['id'],
                'title': track['name'],
                'artist': track['artists'][0]['name'] if track.get('artists') else 'Unknown',
                'album': track['album']['name'] if track.get('album') else 'Unknown',
                'year': track['album']['release_date'][:4] if track.get('album', {}).get('release_date') else 'Unknown',
                'album_art_url': track['album']['images'][-1]['url'] if track.get('album', {}).get('images') else None,
                'spotify_uri': track['uri'],
                'position': position
            })
        
        return {
            'playlist_id': playlist_id,
            'playlist_name': playlist['name'],
            'owner': playlist['owner']['display_name'],
            'image_url': image_url,
            'total_tracks': len(track_list),
            'tracks': track_list
        }

    def sync_collection_playlists(self, collection_id, user_id):
        """
        V2: Sync all playlists linked to a collection
        Generator function that yields progress updates
        
        Args:
            collection_id: Collection document ID
            user_id: User email (for playlist memory updates)
            
        Yields:
            dict: Progress updates with format:
                - type: 'progress' | 'complete'
                - message: Status message
                - stats: {'new_songs': 0, 'updated_songs': 0, 'removed_songs': 0}
        """
        # Get collection and its linked playlists
        collection = self.firestore.get_collection(collection_id)
        if not collection:
            yield {'type': 'error', 'message': 'Collection not found'}
            return
        
        playlist_ids = collection.get('playlist_ids', [])
        if not playlist_ids:
            yield {'type': 'complete', 'message': 'No playlists linked to this collection', 'stats': {'new_songs': 0, 'updated_songs': 0, 'removed_songs': 0}}
            return
        
        stats = {'new_songs': 0, 'updated_songs': 0, 'removed_songs': 0}
        
        # Get all existing songs in collection
        existing_songs = self.firestore.get_all_songs(collection_id=collection_id)
        existing_songs_map = {song['spotify_track_id']: song for song in existing_songs if 'spotify_track_id' in song}
        
        # Track which Spotify track IDs are currently in ANY linked playlist
        current_spotify_track_ids = set()
        
        # Process each playlist
        for idx, playlist_id in enumerate(playlist_ids):
            yield {
                'type': 'progress',
                'message': f'Syncing playlist {idx + 1} of {len(playlist_ids)}...',
                'current': idx,
                'total': len(playlist_ids)
            }
            
            try:
                # Get playlist URL from memory
                playlist_memory = self.firestore.db.collection(self.firestore.playlist_memory_collection).document(playlist_id).get()
                if not playlist_memory.exists:
                    continue
                
                playlist_url = playlist_memory.to_dict().get('playlist_url')
                if not playlist_url:
                    continue
                
                # Fetch current playlist tracks
                playlist_data = self.fetch_playlist_tracks_metadata(playlist_url)
                
                # Update playlist memory
                self.firestore.save_playlist_memory(user_id, playlist_id, {
                    'playlist_url': playlist_url,
                    'name': playlist_data['playlist_name'],
                    'owner': playlist_data['owner'],
                    'total_tracks': playlist_data['total_tracks'],
                    'image_url': playlist_data['image_url']
                })
                
                # Process each track
                for track in playlist_data['tracks']:
                    spotify_track_id = track['spotify_track_id']
                    current_spotify_track_ids.add(spotify_track_id)
                    
                    song_id = self._create_song_id(spotify_track_id, collection_id)
                    
                    if song_id in [s['id'] for s in existing_songs]:
                        # Song exists - update playlist associations
                        existing_song = existing_songs_map.get(spotify_track_id)
                        if existing_song:
                            source_playlists = existing_song.get('source_playlist_ids', [])
                            playlist_positions = existing_song.get('playlist_positions', {})
                            
                            # Add this playlist if not already in source
                            if playlist_id not in source_playlists:
                                source_playlists.append(playlist_id)
                            
                            # Update position for this playlist
                            playlist_positions[playlist_id] = track['position']
                            
                            self.firestore.create_or_update_song(song_id, {
                                'source_playlist_ids': source_playlists,
                                'playlist_positions': playlist_positions
                            })
                            stats['updated_songs'] += 1
                    else:
                        # New song - create it (without lyrics for speed)
                        song_data = {
                            'spotify_track_id': spotify_track_id,
                            'collection_id': collection_id,
                            'title': track['title'],
                            'artist': track['artist'],
                            'album': track['album'],
                            'year': track['year'],
                            'album_art_url': track['album_art_url'],
                            'spotify_uri': track['spotify_uri'],
                            'lyrics': '',
                            'lyrics_numbered': '',
                            'lyrics_fetched': False,
                            'bpm': 'N/A',
                            'notes': '',
                            'source_playlist_ids': [playlist_id],
                            'playlist_positions': {playlist_id: track['position']}
                        }
                        
                        self.firestore.create_or_update_song(song_id, song_data)
                        stats['new_songs'] += 1
                
            except Exception as e:
                print(f"Error syncing playlist {playlist_id}: {e}")
                continue
        
        # Mark songs as removed if they're not in any current playlist
        for song in existing_songs:
            spotify_track_id = song.get('spotify_track_id')
            if spotify_track_id and spotify_track_id not in current_spotify_track_ids:
                # Song no longer exists in any linked playlist
                song_id = song['id']
                self.firestore.create_or_update_song(song_id, {
                    'is_removed_from_spotify': True,
                    'removal_detected_at': datetime.utcnow()
                })
                stats['removed_songs'] += 1
        
        yield {
            'type': 'complete',
            'message': f'Sync complete: {stats["new_songs"]} new, {stats["updated_songs"]} updated, {stats["removed_songs"]} removed',
            'stats': stats
        }
