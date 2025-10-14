# Lazy Lyrics Loading Implementation

## Problem

Importing songs from Spotify playlists was taking 30-40 seconds for just 6 songs because the system was sequentially fetching lyrics from Genius API for each song during the import process (~5-7 seconds per song).

## Solution

Implemented lazy loading pattern where lyrics are fetched only when a song is first opened by the user.

## Changes Made

### 1. Backend Changes (`webapp/services/lyrics_service.py`)

#### Import Process (Optimized)

- **Modified**: `import_selected_songs_stream()` method
- **Change**: Removed `lyrics_data = self._fetch_lyrics(title, artist)` call during import
- **New behavior**:
  - Creates songs with empty lyrics: `lyrics: ''` and `lyrics_numbered: ''`
  - Sets flag: `lyrics_fetched: false`
  - Import now completes in ~5 seconds instead of 30-40 seconds

#### Lyrics Fetching (On-Demand)

- **Modified**: `fetch_and_update_song()` method
- **Change**: Added `lyrics_fetched: True` flag after successful lyrics fetch
- **Purpose**: Marks that lyrics have been loaded so they won't be fetched again

### 2. Frontend Changes (`webapp/static/js/app.js`)

#### Auto-Fetch on Song Load

- **Modified**: `loadSong()` function
- **New logic**:
  ```javascript
  // Fetch lyrics in background if they haven't been fetched yet
  if (currentSong.lyrics_fetched === false) {
    fetchLyricsInBackground(
      currentSong.id,
      currentSong.title,
      currentSong.artist
    );
  }
  ```

#### Background Fetch Function

- **Created**: `fetchLyricsInBackground(songId, title, artist)` function
- **Behavior**:
  - Shows "Loading lyrics..." status message
  - Calls `/api/songs/${songId}/refresh` endpoint
  - Updates `currentSong` object with fetched lyrics
  - Re-renders the song to display lyrics
  - Updates status to "Song loaded • Lyrics updated"
  - Handles errors gracefully without disrupting UX

#### UI Loading State

- **Modified**: `renderLyrics()` function
- **New behavior**: When `lyrics_fetched === false`:
  ```
  🕐 Loading lyrics...
  ```
  Shows hourglass icon and loading message instead of empty state

## User Experience Flow

### Before (Slow Import)

1. User clicks Import Playlist
2. System fetches 6 songs sequentially
3. For each song:
   - Fetch song metadata (fast)
   - Fetch lyrics from Genius API (~5-7 seconds)
   - Save to Firestore
4. **Total time**: 30-40 seconds ⏱️
5. User waits impatiently 😴

### After (Fast Import + Lazy Loading)

1. User clicks Import Playlist
2. System fetches 6 songs in ~5 seconds
   - Fetch song metadata (fast)
   - Save to Firestore with `lyrics_fetched: false`
3. **Import complete in 5 seconds** ⚡
4. User opens a song
5. Lyrics automatically fetch in background (~5 seconds)
6. Song view updates with lyrics
7. Subsequent opens of same song are instant (lyrics cached)

## Technical Details

### Song Document Structure

```javascript
{
  id: "collection_id__artist__title",
  title: "Song Title",
  artist: "Artist Name",
  lyrics: "",                    // Empty until fetched
  lyrics_numbered: "",           // Empty until fetched
  lyrics_fetched: false,         // NEW FLAG
  is_customized: false,
  // ... other fields
}
```

### API Endpoint Used

- **Endpoint**: `POST /api/songs/<song_id>/refresh`
- **Already existed**: No new endpoint needed
- **Parameters**: `{ force_overwrite: false }`
- **Returns**: Updated song object with lyrics

### Performance Metrics

- **Import time**: 40 seconds → 5 seconds (87% reduction)
- **First song open**: +5 seconds for lyrics fetch
- **Subsequent opens**: Instant (no re-fetch needed)
- **Net user experience**: Much better - import is fast, lyrics load as needed

## Edge Cases Handled

1. **User switches songs during lyrics fetch**: Check `currentSong.id === songId` before updating
2. **Lyrics fetch fails**: Show "Failed to fetch lyrics" error, don't break UI
3. **Song already has customized lyrics**: Backend returns `requires_confirmation`, frontend handles it
4. **Multiple collections with same song**: Each copy has independent lyrics (thanks to composite IDs)

## Future Enhancements

### Potential Optimizations

- **Prefetch next song**: When user opens song N, fetch lyrics for song N+1 in background
- **Batch lyrics fetch**: Offer "Fetch all lyrics" button to populate entire collection
- **Cache Genius API responses**: Store raw HTML to avoid re-scraping
- **Parallel fetching**: Fetch lyrics for multiple songs simultaneously (with rate limiting)

### UI Improvements

- **Progress indicator**: Show "3 of 15 songs have lyrics" in collection view
- **Manual fetch button**: Let user trigger lyrics fetch from empty state
- **Retry button**: Allow manual retry if fetch fails
- **Cancel button**: Let user cancel in-progress fetch

## Testing Checklist

- [x] Import playlist with 6 songs completes in ~5 seconds
- [ ] Open song shows "Loading lyrics..." indicator
- [ ] Lyrics appear after ~5 seconds
- [ ] Re-opening same song shows lyrics instantly
- [ ] Song in different collection fetches independently
- [ ] Error handling works (test with invalid song)
- [ ] Status messages update correctly
- [ ] allSongs array updates with fetched lyrics

## Related Files

- `webapp/services/lyrics_service.py` - Backend lyrics fetching logic
- `webapp/app.py` - API endpoint `/api/songs/<song_id>/refresh`
- `webapp/static/js/app.js` - Frontend lazy loading logic
- `COLLECTIONS_FEATURE.md` - Original collections feature design
- `IMPORT_SPEED_ANALYSIS.md` - Initial performance investigation
