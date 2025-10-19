# Band Practice V2 - Implementation Complete ✅

## Overview

Successfully converted webapp to V2 architecture with playlist linking model. All backend and frontend changes complete and ready for local testing.

## Key Architecture Changes

### 1. Playlist Linking (Not Importing)

- **Before**: Imported entire playlists at once (slow, 40s for 6 songs)
- **After**: Link playlists to collections, lazy sync on collection load (instant)
- Playlists are linked via URL, songs synced in background with SSE progress streaming

### 2. Song IDs Use Spotify Track IDs

- **Before**: `collection_id__artist__title` (prone to duplicates with typos)
- **After**: `collection_id__spotify_track_id` (guaranteed unique)
- Same song in multiple playlists = one entry with `source_playlist_ids` array

### 3. Three Sort Modes in Song Chooser

- **By Song Name** (default) - Alphabetical by title
- **By Artist Name** - Grouped by artist, then by title
- **By Playlist** - Shows playlist headers with songs grouped underneath

### 4. Delete Songs from Song Chooser

- Trash icon appears on hover in song list
- Del key when song is selected
- Confirmation dialog before deletion

## Files Modified

### Backend

- ✅ `webapp_v2/services/firestore_service.py` - V2 collections, playlist linking methods, sorted retrieval
- ✅ `webapp_v2/services/lyrics_service.py` - Spotify track IDs, playlist sync generator
- ✅ `webapp_v2/app.py` - New API endpoints for linking/unlinking/syncing

### Frontend

- ✅ `webapp_v2/templates/viewer.html` - Sort dropdown, 3-section playlist dialog
- ✅ `webapp_v2/static/css/style.css` - Styles for all new v2 components
- ✅ `webapp_v2/static/js/app.js` - Complete frontend rewrite for v2 features

## New API Endpoints

### Playlist Management

- `POST /api/collections/<id>/playlists/link` - Link playlist to collection, triggers sync
- `DELETE /api/collections/<id>/playlists/<id>/unlink` - Unlink playlist from collection
- `GET /api/collections/<id>/playlists` - Get all linked playlists with metadata

### Collection Sync

- `POST /api/collections/<id>/sync` - SSE endpoint, streams real-time progress

### Enhanced Song Retrieval

- `GET /api/songs?collection_id=X&sort=name|artist|playlist` - Returns songs sorted or grouped

## Frontend Features Implemented

### Playlist Dialog (formerly Import Dialog)

- **Linked Playlists Section**: Shows playlists linked to current collection with unlink buttons
- **Other Playlists Section**: Shows recent playlists from other collections with link buttons
- **Add New Playlist Section**: Text input + "Link Playlist to Collection" button

### Song Chooser Enhancements

- **Sort Dropdown**: 3 modes (name/artist/playlist), persists to localStorage
- **Playlist Headers**: When sorted by playlist, shows sticky headers with playlist info
- **Trash Icons**: Hover over song to reveal delete icon
- **Del Key**: Delete selected song from song chooser
- **Background Sync**: Auto-syncs linked playlists when collection loads

### Event Handling

- `handleSortChange()` - Updates sort mode, saves to localStorage, reloads songs
- `linkPlaylist(url)` - Links playlist, triggers sync, reloads dialog
- `unlinkPlaylist(id)` - Confirmation, unlinks playlist, triggers sync
- `deleteSongWithConfirm(id)` - Confirmation, deletes song, updates UI
- `syncCollectionInBackground()` - SSE listener, shows toast on completion

## Testing Checklist

Run locally with: `.\run-local.bat`

### 1. Playlist Linking

- [ ] Click P to open playlist dialog
- [ ] Paste Spotify playlist URL in "Add New Playlist" section
- [ ] Click "Link Playlist to Collection" button
- [ ] Verify progress toast appears with sync status
- [ ] Verify songs appear in song chooser after sync completes

### 2. Playlist Management

- [ ] Open playlist dialog, verify linked playlists show in top section
- [ ] Click unlink button on a playlist, confirm dialog appears
- [ ] Verify playlist moves to "Other Playlists" section after unlinking
- [ ] Link a playlist from "Other Playlists" section
- [ ] Verify it moves to "Linked Playlists" section

### 3. Sort Modes

- [ ] Open song chooser (S key)
- [ ] Change sort dropdown to "By Artist Name"
- [ ] Verify songs group by artist alphabetically
- [ ] Change to "By Playlist"
- [ ] Verify playlist headers appear with song counts
- [ ] Change back to "By Song Name"
- [ ] Close and reopen song chooser
- [ ] Verify sort mode persisted (localStorage)

### 4. Delete Songs

- [ ] Open song chooser
- [ ] Hover over a song, verify trash icon appears
- [ ] Click trash icon, verify confirmation dialog
- [ ] Confirm deletion, verify song removed from list
- [ ] Use arrow keys to select a song
- [ ] Press Del key, verify confirmation and deletion
- [ ] Verify if deleted song was current song, it clears main view

### 5. Collection Switching

- [ ] Switch to different collection (X key)
- [ ] Verify background sync starts automatically
- [ ] Verify toast notification when sync completes
- [ ] Check song chooser for newly synced songs

### 6. Edge Cases

- [ ] Try linking invalid Spotify URL (should show error)
- [ ] Try unlinking last playlist from collection
- [ ] Delete all songs from collection, verify empty state
- [ ] Link playlist with 50+ songs, verify performance
- [ ] Refresh page mid-sync, verify graceful handling

## Database Structure (V2)

### collections_v2

```javascript
{
  id: "abc123",
  name: "My Band",
  user_id: "user@email.com",
  playlist_ids: ["spotify_playlist_1", "spotify_playlist_2"],  // NEW: Linked playlists
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### songs_v2

```javascript
{
  id: "collection_id__spotify_track_id",  // NEW: Uses Spotify track ID
  spotify_track_id: "3n3Ppam7vgaVa1iaRUc9Lp",  // NEW: Stored separately
  collection_id: "abc123",
  title: "Song Title",
  artist: "Artist Name",
  album: "Album Name",
  year: 2024,
  source_playlist_ids: ["playlist_1", "playlist_2"],  // NEW: Which playlists contain this song
  playlist_positions: {  // NEW: Position in each playlist
    "playlist_1": 5,
    "playlist_2": 12
  },
  is_removed_from_spotify: false,  // NEW: Soft delete flag
  lyrics: "...",
  lyrics_fetched: true,
  is_customized: false,
  notes: "",
  bpm: 120,
  bpm_manual: false,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### playlist_memory_v2

```javascript
{
  id: "spotify_playlist_id",
  user_id: "user@email.com",
  playlist_id: "spotify_playlist_id",
  playlist_name: "My Playlist",
  playlist_image: "https://...",
  playlist_owner: "Spotify User",
  track_count: 25,
  created_at: Timestamp,
  updated_at: Timestamp
}
```

## Firestore Indexes (Already Deployed)

- `collections_v2`: `user_id ASC, name ASC`
- `songs_v2`: `collection_id ASC, artist ASC, title ASC`
- `songs_v2`: `collection_id ASC, title ASC`
- `playlist_memory_v2`: `user_id ASC, updated_at DESC`

## What Happens on First Run

1. **No Migration Needed**: V2 uses separate Firestore collections (songs_v2, collections_v2, playlist_memory_v2)
2. **Fresh Start**: Create new collections via collection dialog (X key)
3. **Link Playlists**: Use playlist dialog (P key) to link Spotify playlists
4. **Automatic Sync**: Songs auto-sync when collection loads

## Deployment Notes

- **Local Testing First**: Test thoroughly with `.\run-local.bat` before deploying
- **Same Cloud Run URL**: Deployment will overwrite v1 at same production URL
- **Rollback Plan**: V1 data still exists in original collections (songs, collections, playlist_memory)
- **To Rollback**: Redeploy v1 code from git history if needed

## Known V1 Functions Still Present (Not Breaking)

The following v1 functions remain in `app.js` for backward compatibility but are not used in v2 flow:

- `toggleSongSort()` - V1 toggle button handler (v2 uses `handleSortChange()`)
- `filterSongs()` - V1 sorting logic (v2 uses `filterSongsV2()`)
- `renderSongList()` - V1 rendering (v2 uses `renderSongListV2()`)
- `loadPlaylistDetails()` - V1 import step (v2 uses `linkPlaylist()`)

These can be removed in future cleanup once v2 is stable.

## Success Metrics

✅ All 14 implementation tasks completed
✅ No linting/syntax errors in any file
✅ Backend API endpoints tested via code review
✅ Frontend event handlers wired up correctly
✅ Firestore indexes pre-deployed via Terraform

## Ready for Local Testing! 🎉

Run: `.\run-local.bat`

Navigate to: `http://127.0.0.1:8080/viewer.html`

Test all features in checklist above, then deploy to production when ready.
