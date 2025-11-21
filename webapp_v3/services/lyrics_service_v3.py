"""
Band Practice Pro v3 - Lyrics Service
Fetches lyrics from Genius using official API + web scraping

This service integrates with:
1. Genius API - to search for songs
2. Web scraping - to extract lyrics from Genius pages  
3. ScraperAPI (optional) - to bypass IP blocking

ScraperAPI Integration:
- If SCRAPER_API_KEY environment variable is set, uses ScraperAPI
- If not set, falls back to direct requests with browser headers
- Sign up at https://www.scraperapi.com/ for 1000 free requests/month
"""

import requests
import os
import re
import logging
from typing import Dict, Optional
from datetime import datetime
from firebase_admin import firestore

logger = logging.getLogger(__name__)


class LyricsServiceV3:
    """Service for fetching lyrics from Genius"""

    def __init__(self):
        """Initialize Genius API client"""
        # Genius API configuration
        self.genius_token = os.getenv('GENIUS_ACCESS_TOKEN')
        if not self.genius_token:
            logger.warning("GENIUS_ACCESS_TOKEN not set - lyrics fetching will fail")
        
        self.genius_base_url = 'https://api.genius.com'
        self.genius_headers = {
            'Authorization': f'Bearer {self.genius_token}'
        }

        # ScraperAPI configuration (optional - for bypassing IP blocks)
        self.scraper_api_key = os.getenv('SCRAPER_API_KEY')
        self.use_scraper_api = bool(self.scraper_api_key)

        # Firestore
        self.db = firestore.client()

        # GetSongBPM API configuration
        self.getsongbpm_api_key = os.getenv('GETSONGBPM_API_KEY')
        if not self.getsongbpm_api_key:
            logger.warning("GETSONGBPM_API_KEY not set - BPM fetching will fail")

    def _search_genius(self, query: str) -> Optional[Dict]:
        """Search Genius API for a song"""
        try:
            search_url = f'{self.genius_base_url}/search'
            params = {'q': query}

            response = requests.get(search_url, headers=self.genius_headers, params=params, timeout=10)
            response.raise_for_status()

            return response.json()
        except Exception as e:
            logger.error(f"Error searching Genius: {e}")
            return None

    def _scrape_with_scraperapi(self, url: str) -> Optional[str]:
        """Use ScraperAPI to fetch a URL (bypasses IP blocking)"""
        try:
            payload = {
                'api_key': self.scraper_api_key,
                'url': url,
                'render': 'false'  # Set to 'true' if JavaScript rendering needed
            }

            response = requests.get('http://api.scraperapi.com', params=payload, timeout=30)
            response.raise_for_status()
            return response.text
        except Exception as e:
            logger.error(f"Error using ScraperAPI: {e}")
            return None

    def _scrape_lyrics_from_page(self, url: str) -> Optional[str]:
        """
        Scrape lyrics from Genius page using BeautifulSoup
        Uses ScraperAPI if available, otherwise direct request with headers
        """
        try:
            from bs4 import BeautifulSoup

            # Try ScraperAPI first if available
            if self.use_scraper_api:
                logger.info(f"Using ScraperAPI to fetch {url}")
                html_content = self._scrape_with_scraperapi(url)
                if not html_content:
                    return None
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

            # Clean up - add newlines around section headers
            lyrics = re.sub(r'\[.*?\]', lambda m: f'\n{m.group(0)}\n', lyrics)
            lyrics = re.sub(r'\n\n+', '\n\n', lyrics)  # Remove excessive newlines
            lyrics = lyrics.strip()

            return lyrics

        except Exception as e:
            logger.error(f"Error scraping lyrics from {url}: {e}")
            return None

    def _add_line_numbers(self, lyrics: str) -> str:
        """Add line numbers to lyrics (skip section headers)"""
        lines = lyrics.split('\n')
        formatted_lines = []
        line_num = 1

        for line in lines:
            # Check if line is a section header like [Verse 1], [Chorus]
            if re.match(r'^\[.*\]', line.strip()):
                # Keep section headers as-is
                formatted_lines.append(f'\n{line.strip()}')
            elif line.strip():
                formatted_lines.append(f'{line_num:3d}  {line}')
                line_num += 1
            else:
                formatted_lines.append('')

        return '\n'.join(formatted_lines)

    def renumber_lyrics(self, lyrics: str) -> str:
        """
        Public method to renumber lyrics (wraps _add_line_numbers)
        Used when user manually edits lyrics

        Args:
            lyrics: Raw lyrics text

        Returns:
            Lyrics with line numbers added
        """
        return self._add_line_numbers(lyrics)

    def fetch_lyrics(self, title: str, artist: str) -> Dict[str, str]:
        """
        Fetch lyrics from Genius using official API + scraping
        
        Args:
            title: Song title
            artist: Artist name
            
        Returns:
            Dict with 'lyrics' and 'lyrics_numbered' keys
        """
        try:
            # Search for the song
            query = f"{title} {artist}"
            search_results = self._search_genius(query)

            if not search_results or not search_results.get('response', {}).get('hits'):
                logger.warning(f"No Genius results for: {title} by {artist}")
                return {
                    'lyrics': '',
                    'lyrics_numbered': '',
                    'error': 'NOT_FOUND'
                }

            # Get the first result
            first_hit = search_results['response']['hits'][0]['result']
            song_url = first_hit.get('url')
            song_title = first_hit.get('title')
            song_artist = first_hit.get('primary_artist', {}).get('name')

            logger.info(f"Found on Genius: {song_title} by {song_artist}")

            # Scrape lyrics from the song page
            lyrics = self._scrape_lyrics_from_page(song_url)

            if not lyrics:
                logger.warning(f"Could not scrape lyrics for: {title} by {artist}")
                return {
                    'lyrics': '',
                    'lyrics_numbered': '',
                    'error': 'SCRAPE_FAILED'
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
                'lyrics_numbered': lyrics_numbered,
                'error': None
            }

        except Exception as e:
            logger.error(f"Error fetching lyrics for {title} by {artist}: {e}")
            return {
                'lyrics': '',
                'lyrics_numbered': '',
                'error': str(e)
            }

    def fetch_and_update_song_lyrics(self, song_id: str, force: bool = False, force_customized: bool = False) -> bool:
        """
        Fetch lyrics for a song and update it in Firestore
        
        Args:
            song_id: Song document ID
            force: If True, fetch even if already fetched
            force_customized: If True, allow overwriting customized lyrics (requires explicit user action)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get song from Firestore
            song_ref = self.db.collection('songs_v3').document(song_id)
            song_doc = song_ref.get()

            if not song_doc.exists:
                logger.error(f"Song {song_id} not found")
                return False

            song_data = song_doc.to_dict()
            
            # Block customized lyrics unless explicitly forced by collection owner
            if song_data.get('is_customized', False) and not force_customized:
                logger.warning(f"Song {song_id} has customized lyrics - use force_customized=True to override")
                return False
            
            # Skip if already fetched (unless force=True)
            if song_data.get('lyrics_fetched', False) and not force:
                logger.info(f"Song {song_id} already has lyrics (use force=True to refresh)")
                return True
            
            title = song_data.get('title')
            artist = song_data.get('artist')

            if not title or not artist:
                logger.error(f"Song {song_id} missing title or artist")
                return False

            logger.info(f"Fetching lyrics for: {title} by {artist}")

            # Fetch lyrics
            lyrics_data = self.fetch_lyrics(title, artist)

            # Update song in Firestore
            update_data = {
                'lyrics': lyrics_data['lyrics'],
                'lyrics_numbered': lyrics_data['lyrics_numbered'],
                'lyrics_fetched': True,
                'lyrics_fetch_error': lyrics_data.get('error'),
                'lyrics_fetched_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            
            # If we're overwriting customized lyrics, reset the flag
            if force_customized:
                update_data['is_customized'] = False
                logger.info(f"Resetting is_customized flag for song {song_id}")

            song_ref.update(update_data)
            logger.info(f"Updated lyrics for song {song_id}")
            return True

        except Exception as e:
            logger.error(f"Error updating lyrics for song {song_id}: {e}")
            return False

    def batch_fetch_lyrics_for_collection(self, collection_id: str, max_songs: int = None):
        """
        Fetch lyrics for all unfetched songs in a collection
        Runs synchronously - call from background thread if needed
        
        Args:
            collection_id: Collection ID
            max_songs: Optional limit on number of songs to fetch
        """
        try:
            # Query unfetched songs in this collection (lyrics_fetched == False)
            query = (self.db.collection('songs_v3')
                    .where('collection_id', '==', collection_id)
                    .where('lyrics_fetched', '==', False))
            
            if max_songs:
                query = query.limit(max_songs)

            unfetched_songs = list(query.stream())
            total = len(unfetched_songs)

            logger.info(f"Fetching lyrics for {total} songs in collection {collection_id}")

            for i, doc in enumerate(unfetched_songs, 1):
                song_data = doc.to_dict()
                
                # Skip customized songs - NEVER overwrite user customizations
                if song_data.get('is_customized', False):
                    logger.info(f"Skipping customized song: {song_data.get('title')} by {song_data.get('artist')}")
                    continue
                    
                logger.info(f"Progress: {i}/{total}")
                self.fetch_and_update_song_lyrics(doc.id)

            logger.info(f"Completed lyrics fetch for collection {collection_id}")

        except Exception as e:
            logger.error(f"Error in batch_fetch_lyrics_for_collection: {e}")

    def _fetch_bpm(self, title: str, artist: str) -> str:
        """
        Fetch BPM (tempo) from GetSongBPM API
        
        Args:
            title: Song title
            artist: Artist name
            
        Returns:
            BPM as string (integer), 'N/A' if unavailable, or 'NOT_FOUND' if API lookup failed
        """
        try:
            # Check if API key is configured
            if not self.getsongbpm_api_key:
                logger.warning("GetSongBPM API key not configured")
                return 'N/A'

            # Search for the song using GetSongBPM API
            search_url = 'https://api.getsong.co/search/'
            
            # Try searching with just the title first (works better than "artist title")
            params = {
                'api_key': self.getsongbpm_api_key,
                'type': 'song',
                'lookup': title
            }

            response = requests.get(search_url, params=params, timeout=10)

            if response.status_code == 200:
                data = response.json()
                
                # Check if we got results
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
                                    bpm = int(round(float(tempo)))
                                    logger.info(f"Found BPM for {title} by {artist}: {bpm}")
                                    return str(bpm)
                                except (ValueError, TypeError):
                                    pass
                    
                    # If no artist match found, use first result's tempo if available
                    first_result = data['search'][0]
                    tempo = first_result.get('tempo')
                    if tempo:
                        try:
                            bpm = int(round(float(tempo)))
                            logger.info(f"Found BPM for {title} (no artist match): {bpm}")
                            return str(bpm)
                        except (ValueError, TypeError):
                            pass
                
                logger.warning(f"No BPM found for {title} by {artist}")
                return 'NOT_FOUND'
            else:
                logger.error(f"GetSongBPM API returned status {response.status_code}")
                return 'N/A'

        except Exception as e:
            logger.error(f"Error fetching BPM for {title} by {artist}: {e}")
            return 'N/A'

    def fetch_and_update_song_bpm(self, song_id: str) -> bool:
        """
        Fetch and update BPM for a single song
        
        Args:
            song_id: Song document ID
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Get song from Firestore
            song_ref = self.db.collection('songs_v3').document(song_id)
            song_doc = song_ref.get()

            if not song_doc.exists:
                logger.error(f"Song {song_id} not found")
                return False

            song_data = song_doc.to_dict()
            
            # Skip if BPM already set (and not N/A or NOT_FOUND)
            current_bpm = song_data.get('bpm', 'N/A')
            if current_bpm not in ['N/A', 'NOT_FOUND']:
                logger.info(f"Song {song_id} already has BPM: {current_bpm}")
                return True
            
            # Skip if previously marked as NOT_FOUND
            if current_bpm == 'NOT_FOUND':
                logger.info(f"Song {song_id} previously marked as NOT_FOUND - skipping")
                return True

            title = song_data.get('title')
            artist = song_data.get('artist')

            if not title or not artist:
                logger.error(f"Song {song_id} missing title or artist")
                return False

            logger.info(f"Fetching BPM for: {title} by {artist}")

            # Fetch BPM
            bpm = self._fetch_bpm(title, artist)

            # Update song in Firestore
            update_data = {
                'bpm': bpm,
                'updated_at': datetime.utcnow()
            }

            song_ref.update(update_data)
            logger.info(f"Updated BPM for song {song_id}: {bpm}")
            return True

        except Exception as e:
            logger.error(f"Error updating BPM for song {song_id}: {e}")
            return False

    def batch_fetch_bpm_for_collection(self, collection_id: str, max_songs: int = None):
        """
        Fetch BPM for all songs in a collection that don't have it yet
        Runs synchronously - call from background thread if needed
        
        Args:
            collection_id: Collection ID
            max_songs: Optional limit on number of songs to fetch
        """
        try:
            # Query songs without BPM in this collection
            query = (self.db.collection('songs_v3')
                    .where('collection_id', '==', collection_id)
                    .where('bpm', 'in', ['N/A', 'NOT_FOUND']))
            
            if max_songs:
                query = query.limit(max_songs)

            songs_without_bpm = list(query.stream())
            total = len(songs_without_bpm)

            logger.info(f"Fetching BPM for {total} songs in collection {collection_id}")

            for i, doc in enumerate(songs_without_bpm, 1):
                song_data = doc.to_dict()
                
                # Skip if previously marked as NOT_FOUND
                if song_data.get('bpm') == 'NOT_FOUND':
                    continue
                    
                logger.info(f"Progress: {i}/{total}")
                self.fetch_and_update_song_bpm(doc.id)

            logger.info(f"Completed BPM fetch for collection {collection_id}")

        except Exception as e:
            logger.error(f"Error in batch_fetch_bpm_for_collection: {e}")

