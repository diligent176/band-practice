# Genius API Integration

This document explains how the Band Practice App integrates with the Genius API to fetch song lyrics.

## Overview

The app uses a hybrid approach to fetch lyrics:

1. **Genius Search API** - to find the song URL
2. **Web Scraping** - to extract lyrics from the Genius webpage
3. **ScraperAPI (optional)** - to bypass IP blocking when scraping

## Implementation

All lyrics fetching logic is in `webapp/services/lyrics_service.py`.

### 1. Genius Search API

The official Genius API provides search functionality:

**Endpoint**: `https://api.genius.com/search`

**Authentication**: Bearer token (from `GENIUS_ACCESS_TOKEN` env var)

**Example Request**:

```python
search_url = 'https://api.genius.com/search'
headers = {'Authorization': f'Bearer {self.genius_token}'}
params = {'q': 'Song Title Artist Name'}

response = requests.get(search_url, headers=headers, params=params)
```

**Response** (simplified):

```json
{
  "response": {
    "hits": [
      {
        "result": {
          "title": "Song Title",
          "primary_artist": {
            "name": "Artist Name"
          },
          "url": "https://genius.com/Artist-song-lyrics"
        }
      }
    ]
  }
}
```

### 2. Web Scraping

The Genius API **does not provide lyrics content** - only metadata and URLs. To get the actual lyrics, we scrape the webpage.

**Why Scraping is Necessary**:

- Genius removed the lyrics endpoint from their API
- Lyrics are only available on the HTML page
- Scraping is the only way to get lyrics programmatically

**Implementation** (`_scrape_lyrics_from_page` method):

1. Fetch HTML from the Genius song URL
2. Use BeautifulSoup to parse HTML
3. Find lyrics divs by `data-lyrics-container="true"` attribute
4. Extract text and clean up formatting
5. Add line numbers for practice notes

**Lyrics Container Detection**:

```python
# Primary method: data attribute
lyrics_divs = soup.find_all('div', {'data-lyrics-container': 'true'})

# Fallback: class name
if not lyrics_divs:
    lyrics_divs = soup.find_all('div', class_=re.compile('Lyrics__Container'))
```

### 3. IP Blocking Problem

**Issue**: Genius blocks requests from cloud IPs (like Google Cloud Run) with 403 Forbidden errors.

**Solution**: Use ScraperAPI as a proxy to rotate IPs and bypass blocks.

See [SCRAPERAPI_SETUP.md](SCRAPERAPI_SETUP.md) for details.

## Configuration

### Required Environment Variables

```bash
# Genius API Token (for search)
GENIUS_ACCESS_TOKEN=your_genius_token

# Optional: ScraperAPI for bypassing IP blocks
SCRAPER_API_KEY=your_scraper_api_key
```

### Getting a Genius API Token

1. Go to https://genius.com/api-clients
2. Sign in with your Genius account (or create one)
3. Click "New API Client"
4. Fill in app details:
   - **App Name**: Band Practice App
   - **App Website URL**: Your Cloud Run URL or GitHub repo
   - **Redirect URI**: Not needed (leave blank or use homepage)
5. Click "Generate Access Token"
6. Copy the token and add to your `.env` file

**Note**: The Genius API documentation at https://docs.genius.com/ may be outdated or unavailable. The search endpoint is the main one we use.

## How Lyrics Fetching Works

### Full Flow (`_fetch_lyrics` method in lyrics_service.py)

```
1. Search Genius API
   ├─ Query: "{song_title} {artist}"
   └─ Get: song URL, verified title/artist

2. Scrape Lyrics Page
   ├─ If SCRAPER_API_KEY set: Use ScraperAPI
   └─ Else: Direct request with browser headers

3. Parse HTML
   ├─ Find lyrics containers
   ├─ Extract text with line breaks
   └─ Clean up formatting

4. Process Lyrics
   ├─ Remove headers/footers
   ├─ Remove advertising text
   ├─ Preserve section headers ([Verse 1], [Chorus])
   └─ Add line numbers (skip headers and empty lines)

5. Return Result
   ├─ lyrics: Plain text with section headers
   └─ lyrics_numbered: Numbered version for UI
```

### Fallback Behavior

The scraper has multiple fallback mechanisms:

1. **Primary**: `data-lyrics-container="true"` attribute
2. **Fallback**: `class` matching `Lyrics__Container` regex
3. **Error handling**: If scraping fails, returns error message instead of crashing

**Example Error Response**:

```python
{
    'lyrics': 'Could not retrieve lyrics for Song by Artist',
    'lyrics_numbered': 'Could not retrieve lyrics for Song by Artist'
}
```

## Testing the Integration

### Test Locally

```bash
# In your .env file
GENIUS_ACCESS_TOKEN=your_token
SCRAPER_API_KEY=your_key  # Optional

# Run the app
run-local.bat

# Open browser to http://127.0.0.1:8080
# Try syncing a playlist or refreshing a song's lyrics
```

### Check Logs

```python
# Success logs
print(f"Found on Genius: {song_title} by {song_artist}")
print(f"Using ScraperAPI to fetch {url}")  # If ScraperAPI is enabled

# Error logs
print(f"Error fetching lyrics: {e}")
print(f"Error scraping lyrics from {url}: {e}")
```

## Troubleshooting

### 403 Forbidden Errors

**Symptom**: `Error scraping lyrics from https://genius.com/...: 403 Client Error: Forbidden`

**Cause**: Genius is blocking your IP address

**Solutions**:

1. **Use ScraperAPI** (recommended for Cloud Run)

   - See [SCRAPERAPI_SETUP.md](SCRAPERAPI_SETUP.md)
   - Free tier: 1,000 requests/month

2. **Use a VPN** (for local testing)

   - Some IPs are blocked, others aren't
   - Try connecting through different locations

3. **Wait and retry**
   - Sometimes blocks are temporary
   - Try again in a few hours

### Empty Lyrics

**Symptom**: Lyrics field is empty or shows "Could not retrieve lyrics"

**Possible Causes**:

1. Song not found on Genius
2. Lyrics container structure changed
3. Scraping failed silently

**Debug Steps**:

```bash
# Check Cloud Run logs
gcloud logs read "resource.type=cloud_run_revision" --limit=50 --project=your-project-id

# Look for:
# - "Found on Genius: ..." (search succeeded)
# - "Using ScraperAPI to fetch..." (scraping attempt)
# - "Error scraping lyrics..." (scraping failed)
```

### Incorrect Song Matched

**Symptom**: Wrong song's lyrics are shown

**Cause**: Genius search returned different song (similar title/artist)

**Solutions**:

1. Check the song title/artist in Firestore
2. Manually update if needed
3. Refresh lyrics for that specific song
4. Genius search favors popular songs, so lesser-known tracks might match incorrectly

### Rate Limiting

**Symptom**: Multiple songs failing in sequence

**Cause**: Hit Genius API rate limit or ScraperAPI limit

**Genius API Limits**:

- Not officially documented
- Generally generous for personal use
- If hitting limits, space out sync operations

**ScraperAPI Limits**:

- Free tier: 1,000 requests/month
- Paid tiers: Higher limits
- Check dashboard at https://www.scraperapi.com/dashboard

## Code Structure

### LyricsService Class Methods

| Method                                          | Purpose                              |
| ----------------------------------------------- | ------------------------------------ |
| `sync_playlist(playlist_url)`                   | Sync all songs from Spotify playlist |
| `fetch_and_update_song(song_id, title, artist)` | Refresh lyrics for one song          |
| `_fetch_lyrics(title, artist)`                  | Main lyrics fetching logic           |
| `_search_genius(query)`                         | Search Genius API                    |
| `_scrape_lyrics_from_page(url)`                 | Scrape lyrics from webpage           |
| `_scrape_with_scraperapi(url)`                  | Use ScraperAPI to fetch URL          |
| `_add_line_numbers(lyrics)`                     | Add line numbers to lyrics           |
| `_create_song_id(title, artist)`                | Generate consistent song IDs         |

### Key Dependencies

```python
import requests           # HTTP requests
import spotipy           # Spotify API
from bs4 import BeautifulSoup  # HTML parsing
import re                # Regular expressions for text processing
```

## API Reference Links

- **Genius API Clients**: https://genius.com/api-clients
- **Genius API (limited docs)**: https://docs.genius.com/ (may be unavailable)
- **ScraperAPI Docs**: https://docs.scraperapi.com/
- **Beautiful Soup Docs**: https://www.crummy.com/software/BeautifulSoup/bs4/doc/

## Related Documentation

- [SCRAPERAPI_SETUP.md](SCRAPERAPI_SETUP.md) - Setting up ScraperAPI for IP rotation
- [lyrics_service.py](../webapp/services/lyrics_service.py) - Implementation code
- [README.md](../README.md) - Project overview
