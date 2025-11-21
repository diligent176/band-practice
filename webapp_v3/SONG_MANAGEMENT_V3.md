# Song Management in Band Practice Pro v3

## Overview

Songs in v3 use a **playlist reference tracking system** similar to v2, ensuring songs are properly managed when playlists are linked/unlinked and collections are deleted.

## Key Concepts

### 1. Playlist Reference Tracking

Each song tracks which playlists reference it using two fields:

- **`source_playlist_ids`**: Array of playlist IDs that contain this song
- **`playlist_positions`**: Map of `{playlist_id: position}` for ordering songs within each playlist

### 2. Song Deduplication

When the same song appears in multiple playlists within a collection:

- Only ONE song document is created
- The song's `source_playlist_ids` array contains multiple playlist IDs
- Each playlist's position is stored in `playlist_positions`

### 3. Smart Deletion

Songs are deleted ONLY when they have no more playlist references:

- **Unlinking a playlist**: Removes playlist from `source_playlist_ids`, deletes song if array becomes empty
- **Deleting a collection**: Deletes ALL songs in the collection (since collection is gone)

## Database Schema

### Song Document Structure

```javascript
{
  id: "auto-generated",
  collection_id: "collection-id",

  // Spotify metadata
  spotify_track_id: "3n3Ppam7vgaVa1iaRUc9Lp",
  spotify_uri: "spotify:track:...",
  spotify_url: "https://open.spotify.com/track/...",
  title: "Mr. Brightside",
  artist: "The Killers",
  album: "Hot Fuss",
  album_art_url: "https://i.scdn.co/image/...",
  year: "2004",
  duration_ms: 222000,

  // Lyrics (Phase 4)
  lyrics: "",
  lyrics_numbered: "",
  lyrics_fetched: false,

  // Practice data
  bpm: "N/A",
  notes: "",

  // *** Playlist tracking (V2 pattern) ***
  source_playlist_ids: ["playlist-1", "playlist-2"],
  playlist_positions: {
    "playlist-1": 5,
    "playlist-2": 12
  },

  // Metadata
  created_at: timestamp,
  updated_at: timestamp,
  created_by_uid: "user-uid"
}
```

## Services Architecture

### SongsService (`songs_service_v3.py`)

Centralized service for all song operations:

#### `create_or_update_song(collection_id, playlist_id, track_data, position, user_id)`

- Checks if song exists (by `collection_id` + `spotify_track_id`)
- **If exists**: Adds playlist to `source_playlist_ids`, updates `playlist_positions`
- **If new**: Creates song with initial playlist reference

#### `remove_playlist_from_song(song_id, playlist_id)`

- Removes playlist from `source_playlist_ids`
- Removes entry from `playlist_positions`
- **Deletes song** if `source_playlist_ids` becomes empty

#### `delete_songs_for_playlist(collection_id, playlist_id)`

- Finds all songs referencing this playlist
- Calls `remove_playlist_from_song()` for each
- Returns `{deleted: count, updated: count}`

#### `delete_songs_in_collection(collection_id)`

- Deletes ALL songs in a collection (batch operation)
- Used when collection is deleted

#### `get_songs_in_collection(collection_id)`

- Returns all songs in a collection
- Used for calculating actual song count

## API Endpoints

### Import Playlist: `POST /api/v3/playlists/import`

**Process:**

1. Verify user owns collection
2. Fetch playlist metadata from Spotify
3. Fetch all tracks from playlist
4. Save playlist to `playlist_memory_v3` (user's recent history)
5. **For each track**: `SongsService.create_or_update_song()`
   - Handles deduplication automatically
   - Adds playlist reference to existing songs
6. Add playlist metadata to collection's `linked_playlists` array (embedded)
7. **Calculate actual song count** from database (after deduplication)
8. Update collection's `song_count`

**Response:**

```json
{
  "message": "Playlist imported successfully",
  "playlist_id": "...",
  "playlist_name": "...",
  "songs_created": 15, // Songs processed (not necessarily new)
  "track_count": 15, // Tracks in playlist
  "total_songs_in_collection": 25 // Actual unique songs (after dedup)
}
```

### Unlink Playlist: `POST /api/v3/collections/:id/unlink-playlist`

**Process:**

1. Verify user owns collection
2. **Call** `SongsService.delete_songs_for_playlist(collection_id, playlist_id)`
   - Removes playlist reference from each song
   - Deletes songs with no remaining references
3. Remove playlist from collection's `linked_playlists` array
4. **Calculate actual song count** from database
5. Update collection's `song_count`

**Response:**

```json
{
  "message": "Playlist unlinked successfully",
  "playlist_id": "...",
  "songs_deleted": 5, // Songs completely removed
  "songs_updated": 3, // Songs that still exist (in other playlists)
  "remaining_songs": 20 // Total songs left in collection
}
```

### Delete Collection: `DELETE /api/v3/collections/:id`

**Process:**

1. Verify user owns collection
2. Prevent deletion if `is_personal: true`
3. **Call** `SongsService.delete_songs_in_collection(collection_id)`
   - Deletes ALL songs (batch operation)
4. Delete collection document

## Example Scenarios

### Scenario 1: Same Song in Multiple Playlists

**Action:** Link two playlists that both contain "Mr. Brightside"

**Result:**

- First playlist import: Creates song with `source_playlist_ids: ["playlist-1"]`
- Second playlist import: Updates song to `source_playlist_ids: ["playlist-1", "playlist-2"]`
- Collection shows song count = 1 (deduplicated)

### Scenario 2: Unlink Playlist with Shared Songs

**Collection has:**

- Playlist A: 10 songs
- Playlist B: 8 songs
- 3 songs appear in BOTH playlists

**Action:** Unlink Playlist A

**Result:**

- 7 songs deleted (only in Playlist A)
- 3 songs updated (still in Playlist B)
- Response: `{songs_deleted: 7, songs_updated: 3, remaining_songs: 8}`

### Scenario 3: Delete Collection

**Action:** Delete collection with 50 songs across 3 playlists

**Result:**

- ALL 50 songs deleted (batch operation)
- Collection deleted
- Playlists remain in `playlists_v3` (for memory)

## Migration from v2

The v3 song management system is **identical** to v2's approach:

- ✅ Same `source_playlist_ids` array
- ✅ Same `playlist_positions` map
- ✅ Same deduplication logic
- ✅ Same smart deletion behavior

**Difference:** v3 uses a dedicated `SongsService` class instead of inline logic, making it more maintainable and testable.

## Future Enhancements

### Phase 4: Lyrics Fetching

- Background job to fetch lyrics for songs without `lyrics_fetched: true`
- Update `lyrics`, `lyrics_numbered` fields

### Phase 5: Songs View

- Query songs with `source_playlist_ids` to group by playlist
- Sort by `playlist_positions[playlist_id]` for correct order

### Phase 6: BPM Fetching

- Background job to fetch BPM from GetSongBPM API
- Update `bpm` field

## Testing Checklist

- [ ] Import single playlist → verify songs created
- [ ] Import second playlist with overlapping songs → verify deduplication
- [ ] Unlink playlist → verify correct songs deleted
- [ ] Delete collection → verify ALL songs deleted
- [ ] Create collection, link playlist, delete collection → verify cleanup
- [ ] Check song counts match actual database counts
