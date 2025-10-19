# V2 Implementation Status

## ✅ COMPLETED - Backend (100%)

### 1. Firestore Service (`webapp_v2/services/firestore_service.py`)

- ✅ Changed collection names to `songs_v2`, `collections_v2`, `playlist_memory_v2`
- ✅ Updated `collections_v2` schema to include `playlist_ids` array
- ✅ Added `link_playlist_to_collection(collection_id, playlist_id, playlist_data)`
- ✅ Added `unlink_playlist_from_collection(collection_id, playlist_id)`
- ✅ Added `get_collection_playlists(collection_id)` - returns linked playlists with metadata
- ✅ Added `_update_playlist_collection_links()` - tracks which collections link to each playlist
- ✅ Added `get_songs_sorted_by_name(collection_id)` - sorts by title ascending
- ✅ Added `get_songs_sorted_by_artist(collection_id)` - sorts by artist, then title
- ✅ Added `get_songs_sorted_by_playlist(collection_id)` - groups by playlist with natural Spotify order

### 2. Lyrics Service (`webapp_v2/services/lyrics_service.py`)

- ✅ Updated `_create_song_id()` to use format: `collection_id__spotify_track_id`
- ✅ Modified `import_selected_songs_stream()` to:
  - Extract `spotify_track_id` from tracks
  - Store `spotify_track_id` in song documents
  - Store `source_playlist_ids` array (which playlists contain this song)
  - Store `playlist_positions` dict (position in each playlist)
- ✅ Added `fetch_playlist_tracks_metadata(playlist_url)` - gets playlist + tracks without importing
- ✅ Added `sync_collection_playlists(collection_id, user_id)` - generator for SSE streaming:
  - Detects new songs (adds them without lyrics)
  - Updates existing songs' playlist associations
  - Marks removed songs with `is_removed_from_spotify: true`
  - Yields progress updates for real-time UI

### 3. API Endpoints (`webapp_v2/app.py`)

- ✅ Enhanced `GET /api/songs?collection_id=X&sort=name|artist|playlist` with sorting
- ✅ Added `GET /api/collections/<id>/playlists` - get linked playlists
- ✅ Added `POST /api/collections/<id>/playlists/link` - link playlist by URL
- ✅ Added `DELETE /api/collections/<id>/playlists/<playlist_id>/unlink` - unlink playlist
- ✅ Added `POST /api/collections/<id>/sync` - SSE stream for playlist sync

## 🚧 TODO - Frontend

### 4. Song Selector Dialog (`webapp_v2/static/js/app.js`)

#### Sort Dropdown

- [ ] Add `songSelectorSortMode` variable (default: 'name')
- [ ] Load/save sort preference from `localStorage`
- [ ] Add sort dropdown UI element
- [ ] Implement sort mode switching:
  - **By Song Name** (default) - alphabetical by title
  - **By Artist Name** - alphabetical by artist, then title
  - **By Playlist** - grouped by playlist with headers showing playlist name/art
- [ ] Update `renderSongSelector()` to handle all 3 sort modes
- [ ] Add playlist section headers when sort='playlist'

#### Delete from Song Chooser

- [ ] Add trash icon to each song in the list
- [ ] Add 'Del' key keyboard shortcut
- [ ] Show confirmation dialog before deleting
- [ ] Call `DELETE /api/songs/<song_id>`
- [ ] Refresh song list after deletion
- [ ] Update `currentSong` if deleted song was active

### 5. Playlist Selector Dialog (`webapp_v2/static/js/app.js`)

#### Update Import Dialog ('p' shortcut)

- [ ] Fetch linked playlists: `GET /api/collections/<id>/playlists`
- [ ] Fetch all playlist memory: `GET /api/playlist/memory`
- [ ] Render 3 sections:
  1. **Linked Playlists** (in this collection) - with ✓ checkmark and unlink button
  2. **Other Recent Playlists** (from memory, not linked) - with link button
  3. **Add New Playlist URL** (text input + Add button)
- [ ] Implement link action: `POST /api/collections/<id>/playlists/link` with `{playlist_url}`
- [ ] Implement unlink action: `DELETE /api/collections/<id>/playlists/<playlist_id>/unlink`
- [ ] Show confirmation for unlink (warns about removed songs)
- [ ] After link/unlink, trigger collection sync

### 6. Collection Sync Trigger (`webapp_v2/static/js/app.js`)

- [ ] Add `syncCollection(collectionId)` function
- [ ] Call sync when:
  - Collection is loaded/switched
  - After linking new playlist
  - After unlinking playlist
- [ ] Handle SSE stream from `POST /api/collections/<id>/sync`
- [ ] Show toast notifications:
  - "Syncing playlists..." (start)
  - "Playlist 1 of 3..." (progress)
  - "Sync complete: X new, Y updated, Z removed" (complete)
- [ ] Refresh song list after sync completes

### 7. HTML UI Elements (`webapp_v2/templates/viewer.html`)

- [ ] Add sort dropdown to song selector dialog:
  ```html
  <select id="song-selector-sort" class="song-sort-dropdown">
    <option value="name">By Song Name</option>
    <option value="artist">By Artist Name</option>
    <option value="playlist">By Playlist</option>
  </select>
  ```
- [ ] Update playlist dialog structure with 3 sections (linked/other/new)
- [ ] Add trash icon SVG/template for song items

### 8. CSS Styles (`webapp_v2/static/css/style.css`)

- [ ] Style `.song-sort-dropdown` - matches existing dropdowns
- [ ] Style `.playlist-section-header` - dividers between linked/other playlists
- [ ] Style `.playlist-header` - headers in song list when sorted by playlist
- [ ] Style `.song-trash-icon` - trash can icon for delete
- [ ] Style `.song-trash-icon:hover` - highlight on hover

## Data Model Changes (V2)

### `collections_v2` Schema

```javascript
{
  id: "firestore_generated_id",
  user_id: "user@example.com",
  name: "My Band",
  description: "Practice songs",
  playlist_ids: ["spotify_playlist_1", "spotify_playlist_2"],  // NEW
  created_at: timestamp,
  updated_at: timestamp
}
```

### `songs_v2` Schema

```javascript
{
  id: "collection_id__spotify_track_id",  // NEW FORMAT
  collection_id: "collection_abc123",
  spotify_track_id: "5W3cjX2J3tjhG8zb6u0qHn",  // NEW: Spotify's unique ID

  // Metadata
  title: "Song Title",
  artist: "Artist Name",
  album: "Album Name",
  year: "2024",
  album_art_url: "https://...",
  spotify_uri: "spotify:track:...",

  // User data
  lyrics: "...",
  lyrics_numbered: "...",
  lyrics_fetched: true,
  is_customized: false,
  notes: "...",
  bpm: 120,
  bpm_manual: false,

  // NEW: Playlist tracking
  source_playlist_ids: ["playlist_1", "playlist_2"],  // Which playlists contain this
  playlist_positions: {"playlist_1": 0, "playlist_2": 15},  // Position in each

  // NEW: Removal tracking
  is_removed_from_spotify: false,
  removal_detected_at: null,

  created_at: timestamp,
  updated_at: timestamp
}
```

### `playlist_memory_v2` Schema

```javascript
{
  id: "spotify_playlist_id",  // Document ID
  user_id: "user@example.com",
  playlist_url: "https://open.spotify.com/...",
  name: "Playlist Name",
  owner: "Owner Name",
  total_tracks: 50,
  image_url: "https://...",
  last_accessed: timestamp,
  access_count: 5,
  linked_collection_ids: ["collection_1", "collection_2"]  // NEW
}
```

## Key Behavior Changes

### 1. Song ID Format

- **V1**: `collection_id__artist__title` (prone to duplicates with typos/features)
- **V2**: `collection_id__spotify_track_id` (guaranteed unique per track)

### 2. Playlist Linking (Not Importing)

- **V1**: Import copies all songs into collection immediately
- **V2**: Link creates association, songs synced lazily on collection load

### 3. Song Deduplication

- Same Spotify track in multiple playlists = **ONE** song in collection
- Lyrics/notes/BPM shared across all playlists in that collection
- Different collections can have same track with independent data

### 4. Removal Handling

- Songs not in ANY linked playlist are **flagged**, not deleted
- User must manually delete flagged songs from Song Chooser
- Prevents accidental data loss

## Testing Checklist

### Backend API Testing

- [x] Create new collection (empty `playlist_ids`)
- [x] Link playlist to collection
- [x] Sync collection (SSE stream works)
- [x] Unlink playlist from collection
- [x] Verify songs marked as removed
- [x] Get songs with sort=name
- [x] Get songs with sort=artist
- [x] Get songs with sort=playlist (grouped result)

### Frontend UI Testing (TODO)

- [ ] Song selector shows sort dropdown
- [ ] Sort by name works
- [ ] Sort by artist works
- [ ] Sort by playlist shows headers
- [ ] Playlist selector shows 3 sections
- [ ] Link playlist button works
- [ ] Unlink playlist button works
- [ ] Trash icon appears on songs
- [ ] Del key deletes song with confirmation
- [ ] Collection sync shows toast notifications

## Deployment Notes

1. **Firestore Indexes Already Deployed** ✅

   - `collections_v2` (user_id, name)
   - `songs_v2` (collection_id, title)
   - `songs_v2` (collection_id, artist, title)
   - `songs_v2` (collection_id, is_removed_from_spotify, removal_detected_at)
   - `playlist_memory_v2` (user_id, last_accessed)

2. **No Migration Needed** ✅

   - V2 uses separate collections
   - V1 data remains untouched
   - Can roll back by redeploying v1 code

3. **Environment Variables** ✅
   - Same `.env` file works for v2
   - No new secrets required

## Next Steps

1. **Complete Frontend Implementation** (todos 9-14)
2. **Local Testing** with `.\run-local.bat`
3. **Deploy to GCP** via GitHub Actions
4. **User Acceptance Testing**
5. **Monitor for Issues**

---

**Backend Status**: ✅ **COMPLETE** (8/8 tasks)  
**Frontend Status**: 🚧 **IN PROGRESS** (0/6 tasks)  
**Overall Progress**: **57%** (8/14 tasks)
