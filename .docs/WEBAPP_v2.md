# Band Practice Pro - V2 Implementation Plan

**Status:** Draft for Review
**Created:** 2025-10-19
**Goal:** Major data model revamp - Collections as Playlist Links (not imports)

---

## Executive Summary

**Core Concept Change:**
- **V1:** Import playlist → Copy all songs into Firestore → Disconnect from Spotify
- **V2:** Link playlist → Store playlist IDs → Sync on-demand → Keep connection to Spotify

**Benefits:**
1. No duplicate data storage (playlist metadata lives in Spotify)
2. Automatic sync detection when loading collections
3. Same song across collections maintains separate notes/lyrics/BPM per collection
4. Preserves user customizations even when tracks removed from Spotify
5. Playlist memory works globally across all collections

---

## 1. NEW FIRESTORE DATA MODEL (v2)

### A. `collections_v2` Collection
**Document ID:** Auto-generated
**Fields:**
```json
{
  "user_id": "user@example.com",
  "name": "My Band Setlist",
  "description": "Spring 2025 Tour",
  "linked_playlists": [
    {
      "playlist_id": "spotify_playlist_id_1",
      "name": "Rock Classics",
      "owner": "Spotify User",
      "total_tracks": 42,
      "image_url": "https://...",
      "added_at": Timestamp,
      "last_synced_at": Timestamp,
      "sync_status": "synced" | "pending" | "error"
    },
    {
      "playlist_id": "spotify_playlist_id_2",
      "name": "Modern Hits",
      "owner": "Another User",
      "total_tracks": 38,
      "image_url": "https://...",
      "added_at": Timestamp,
      "last_synced_at": Timestamp,
      "sync_status": "synced"
    }
  ],
  "created_at": Timestamp,
  "updated_at": Timestamp
}
```

**Design Notes:**
- One collection can link to MULTIPLE playlists
- Playlist metadata stored in collection for fast display (no Spotify API call needed)
- `sync_status` tracks whether playlist needs refresh from Spotify

---

### B. `songs_v2` Collection
**Document ID Format:** `collection_id__spotify_track_id`
*(Changed from v1's `collection_id__artist__title` to use Spotify's unique track ID)*

**Fields:**
```json
{
  "collection_id": "abc123",
  "spotify_track_id": "7ouMYWpwJ422jRcDASZB7P",

  // Spotify metadata (cached from API)
  "title": "Bohemian Rhapsody",
  "artist": "Queen",
  "album": "A Night at the Opera",
  "year": "1975",
  "album_art_url": "https://...",
  "spotify_uri": "spotify:track:7ouMYWpwJ422jRcDASZB7P",
  "duration_ms": 354320,

  // User customizations (collection-specific)
  "lyrics": "Is this the real life?...",
  "lyrics_numbered": "  1  Is this the real life?...",
  "lyrics_fetched": true,
  "is_customized": false,  // User manually edited lyrics?

  "notes": "Chorus: Watch the key change!\nLine 42: Brian's solo",
  "notes_updated_at": Timestamp,

  "bpm": 72,
  "bpm_manual": true,
  "bpm_updated_at": Timestamp,

  // Sync tracking
  "source_playlists": [
    {
      "playlist_id": "playlist_id_1",
      "position": 5  // 0-indexed position in Spotify playlist for "Sort by Playlist" feature
    },
    {
      "playlist_id": "playlist_id_2",
      "position": 12
    }
  ],
  "is_removed_from_spotify": false,  // Flagged when track disappears from all playlists
  "removal_detected_at": null,  // Timestamp when first detected removed

  // Timestamps
  "created_at": Timestamp,
  "updated_at": Timestamp,
  "lyrics_updated_at": Timestamp
}
```

**Design Notes:**
- Same Spotify track in 2 collections = 2 separate documents with different notes/lyrics/BPM
- `source_playlists` array tracks which playlists contain this song AND position within each playlist
- If same track appears in multiple linked playlists, only stored ONCE per collection
- Position stored per playlist enables "Sort by Playlist" feature in song chooser
- `is_removed_from_spotify` flag preserves user data instead of deleting

---

### C. `playlist_memory_v2` Collection
**Document ID:** `spotify_playlist_id`
*(Global across all users/collections)*

**Fields:**
```json
{
  "playlist_id": "37i9dQZF1DXcBWIGoYBM5M",
  "user_id": "user@example.com",
  "playlist_url": "https://open.spotify.com/playlist/...",
  "name": "Today's Top Hits",
  "owner": "Spotify",
  "total_tracks": 50,
  "image_url": "https://...",

  // Usage tracking
  "last_accessed": Timestamp,
  "access_count": 12,

  // Collection tracking (NEW)
  "used_in_collections": ["collection_id_1", "collection_id_3"],  // Which collections link this playlist

  "created_at": Timestamp,
  "updated_at": Timestamp
}
```

**Design Notes:**
- Remembers ALL playlists user has ever linked (any collection)
- Shows in playlist chooser dialog regardless of current collection
- `used_in_collections` array helps UI show "Already linked to: Band A, Band B"

---

### D. Keep Existing Collections (no changes)
- `spotify_tokens` - OAuth tokens (REUSE as-is)
- `oauth_states` - CSRF protection (REUSE as-is)

---

## 2. FIRESTORE INDEXES (Terraform)

**New Composite Indexes:**

```hcl
# Query: Get all songs in collection, sorted by artist/title
resource "google_firestore_index" "songs_v2_collection_artist_title" {
  collection = "songs_v2"
  fields {
    field_path = "collection_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "artist"
    order      = "ASCENDING"
  }
  fields {
    field_path = "title"
    order      = "ASCENDING"
  }
}

# Query: Get removed songs for review
resource "google_firestore_index" "songs_v2_collection_removed" {
  collection = "songs_v2"
  fields {
    field_path = "collection_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "is_removed_from_spotify"
    order      = "ASCENDING"
  }
  fields {
    field_path = "removal_detected_at"
    order      = "DESCENDING"
  }
}

# Query: Playlist memory by user, sorted by last accessed
resource "google_firestore_index" "playlist_memory_v2_user_last_accessed" {
  collection = "playlist_memory_v2"
  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "last_accessed"
    order      = "DESCENDING"
  }
}

# Query: Collections by user, sorted by name
resource "google_firestore_index" "collections_v2_user_name" {
  collection = "collections_v2"
  fields {
    field_path = "user_id"
    order      = "ASCENDING"
  }
  fields {
    field_path = "name"
    order      = "ASCENDING"
  }
}
```

---

## 3. BACKEND API CHANGES (Flask)

### 3.1 New Endpoints

#### Collections API
- `GET /api/v2/collections` - List user's collections with metadata
  - Returns: collection name, description, total unique songs, linked playlist count

- `POST /api/v2/collections` - Create new collection
  - Body: `{ "name": "...", "description": "..." }`

- `PUT /api/v2/collections/<id>` - Update collection metadata

- `DELETE /api/v2/collections/<id>` - Delete collection + all songs_v2 docs

- `GET /api/v2/collections/<id>` - Get single collection with full details

#### Playlist Linking API
- `POST /api/v2/collections/<id>/playlists` - Link a playlist to collection
  - Body: `{ "playlist_url": "..." }`
  - Process:
    1. Fetch playlist metadata from Spotify
    2. Add to `linked_playlists` array in collection doc
    3. Trigger sync (fetch all tracks from Spotify)
    4. Create/update `songs_v2` documents
    5. Update `playlist_memory_v2`
    6. Return sync progress via SSE stream

- `DELETE /api/v2/collections/<id>/playlists/<playlist_id>` - Unlink playlist
  - **Important:** Does NOT delete songs! Only removes from `linked_playlists` array
  - Updates `source_playlists` for affected songs (removes playlist from array)
  - If song's `source_playlists` array becomes empty, flag `is_removed_from_spotify: true`

- `POST /api/v2/collections/<id>/playlists/<playlist_id>/sync` - Force sync single playlist
  - Fetch latest tracks from Spotify
  - Compare with existing `songs_v2` docs
  - Add new tracks, flag removed tracks
  - Return sync report

#### Songs API (V2)
- `GET /api/v2/songs?collection_id=<id>` - Get all songs in collection
  - Optionally filter: `?removed=true` to show only flagged songs

- `GET /api/v2/songs/<id>` - Get single song

- `PUT /api/v2/songs/<id>/notes` - Update notes (same as v1)

- `PUT /api/v2/songs/<id>/lyrics` - Update lyrics + mark `is_customized: true`

- `PUT /api/v2/songs/<id>/bpm` - Manual BPM override

- `POST /api/v2/songs/<id>/bpm` - Auto-fetch BPM

- `DELETE /api/v2/songs/<id>` - Permanently delete song
  - Only allowed if `is_removed_from_spotify: true` OR user confirms

- `POST /api/v2/songs/<id>/restore` - Restore flagged song
  - Sets `is_removed_from_spotify: false`
  - Clears `removal_detected_at`

#### Sync Detection API
- `GET /api/v2/collections/<id>/sync-status` - Check if any linked playlists need sync
  - Returns: list of playlists with changes detected
  - **Called automatically when collection first loads**

- `POST /api/v2/collections/<id>/sync-all` - Sync all linked playlists
  - SSE stream with progress updates
  - Returns summary: X new songs, Y removed songs

#### Playlist Memory API
- `GET /api/v2/playlist/memory` - Get user's recent playlists (all collections)
  - Sorted by `last_accessed` DESC
  - Shows which collections each playlist is linked to

- `DELETE /api/v2/playlist/memory/<playlist_id>` - Remove from memory

---

### 3.2 Service Layer Refactoring

**File:** `/webapp_v2/services/firestore_service_v2.py`

**Key Functions:**
```python
# Collections
def create_collection(user_id, name, description)
def get_collections(user_id)
def get_collection(collection_id)
def update_collection(collection_id, name, description)
def delete_collection(collection_id)  # Cascade delete songs_v2

# Playlist Linking
def link_playlist_to_collection(collection_id, playlist_metadata)
def unlink_playlist_from_collection(collection_id, playlist_id)
def get_linked_playlists(collection_id)

# Songs
def get_songs_by_collection(collection_id, include_removed=False)
def get_song(song_id)
def create_or_update_song(collection_id, spotify_track_id, song_data)
def update_song_notes(song_id, notes)
def update_song_lyrics(song_id, lyrics, is_customized)
def update_song_bpm(song_id, bpm, is_manual)
def delete_song(song_id)
def flag_song_removed(song_id)
def restore_song(song_id)

# Sync
def get_songs_by_spotify_track_ids(collection_id, track_ids)  # Batch lookup
def update_source_playlists(song_id, source_playlists)  # Update array with {playlist_id, position}
```

**File:** `/webapp_v2/services/spotify_sync_service.py` (NEW)

**Key Functions:**
```python
def fetch_playlist_metadata(playlist_id) -> dict
    """Get playlist name, owner, image, total_tracks from Spotify API"""

def fetch_playlist_tracks(playlist_id) -> list[dict]
    """Paginate all tracks, return list of track metadata"""

def sync_playlist_to_collection(collection_id, playlist_id) -> SyncReport
    """
    1. Fetch all tracks from Spotify (with positions)
    2. Get existing songs_v2 for this collection
    3. Compare track IDs
    4. Add new tracks (create songs_v2 docs with source_playlists array)
    5. Update existing tracks (add/update position in source_playlists array)
    6. Flag removed tracks (is_removed_from_spotify: True if source_playlists becomes empty)
    7. Return: { added: 5, removed: 2, unchanged: 38 }
    """

def detect_playlist_changes(collection_id, playlist_id) -> dict
    """
    Quick check if playlist has changed since last sync
    Compare: total_tracks, last_synced_at
    Return: { has_changes: true, current_count: 50, last_synced_count: 45 }
    """

def sync_all_playlists_in_collection(collection_id) -> dict
    """Sync all linked playlists, return aggregated report"""
```

**File:** `/webapp_v2/services/lyrics_service_v2.py`

**Changes from V1:**
- Remove import logic (no longer importing, only syncing)
- Keep: Genius API search, lyrics scraping, BPM lookup
- Add: Batch lyrics fetch for newly synced songs

---

## 4. FRONTEND CHANGES (UI/UX)

### 4.1 Updated Dialogs

#### A. Playlist Chooser Dialog (Shortcut 'P')
**New Behavior:**

**Title:** "Link Playlist to Collection"

**Step 1: Enter URL or Select Recent**
- Shows ALL playlists from `playlist_memory_v2` (not just current collection)
- Each playlist card shows:
  - Cover art, name, owner, track count
  - **NEW:** Badge showing "Linked to: Band A, Band B" (from `used_in_collections`)
  - **NEW:** If already linked to current collection, show green checkmark + "Already Linked"
- Manual URL input field

**Step 2: Preview Playlist**
- Shows playlist metadata
- Shows sample tracks (first 10)
- **NEW:** "This playlist has X tracks. Y are already in this collection."
- Button: "Link Playlist" (instead of "Import")

**Step 3: Linking Progress**
- SSE stream shows real-time progress
- "Syncing 42 tracks..."
- "Added 38 new songs, 4 already existed"
- "Flagged 2 removed songs for review"
- Success message: "Playlist linked! Collection now has X unique songs."

**Key Difference from V1:**
- No song selection checkboxes (all tracks synced automatically)
- No conflict detection (sync handles duplicates via `spotify_track_id`)
- Faster (no lyrics fetching during sync)

---

#### B. Collection Selector Dialog (Shortcut 'X')
**New Display:**

Each collection card shows:
- Name, description
- **NEW:** Linked playlists count: "3 playlists linked"
- **NEW:** Total unique songs: "127 songs"
- **NEW:** Sync status indicator:
  - Green: "Synced"
  - Yellow: "Needs sync (5 changes detected)"
  - Red: "Sync error"
- Click to switch collection

---

#### C. Song Selector Dialog (Shortcut 'S')
**New Features:**

**Sort Options (Toggle Button):**
- "Sort by Song Title" (default)
- "Sort by Artist Name"
- "Sort by Playlist" (uses Spotify playlist ordering, shows playlist headers)

**Filter Toggle:**
- "Show All Songs" (default)
- "Show Removed Songs Only" (flagged songs)

**Removed Song Indicator:**
- Songs with `is_removed_from_spotify: true` show warning icon
- Badge: "Removed from Spotify on [date]"
- Trash icon button: Click to permanently delete (with confirmation)
- Confirmation dialog: "Are you sure you want to permanently delete this song? Your notes and lyrics will be lost."

---

#### D. NEW: Linked Playlists Manager Dialog
**Shortcut:** Alt+P (or button in collection view)

**Display:**
- List of all linked playlists for current collection
- Each playlist shows:
  - Cover art, name, owner
  - Track count: "42 tracks (38 in collection)" *(some tracks may be duplicates)*
  - Last synced: "2 hours ago"
  - Sync status: Green/Yellow/Red
  - Actions:
    - "Sync Now" button
    - "Unlink" button (with confirmation)

**Sync Now:**
- Triggers single playlist sync
- Shows progress dialog
- Updates collection

**Unlink:**
- Confirmation: "Unlinking will NOT delete songs. Songs will be flagged as removed if not in other playlists."
- Removes playlist from `linked_playlists` array
- Updates `source_playlist_ids` for affected songs

---

### 4.2 Main View Updates

#### Collection Info Bar (Top of Page)
**Display:**
```
Collection: My Band Setlist  |  3 playlists linked  |  127 songs  |  [Manage Playlists]
```

**Auto-Sync on Load:**
- When collection first loads, background API call: `GET /api/v2/collections/<id>/sync-status`
- If changes detected, show toast notification:
  - "Playlist 'Rock Classics' has 5 new tracks. [Sync Now] [Dismiss]"
- User can choose to sync immediately or ignore

#### Song Display (No Changes)
- Lyrics panel, notes panel, BPM indicator (same as v1)
- Keyboard shortcuts same as v1

#### Removed Song Warning
- If viewing a flagged song, show banner at top:
  - "⚠️ This song was removed from Spotify on [date]. Your notes and lyrics are preserved."
  - Actions: [Restore] [Delete Permanently]

---

## 5. FOLDER STRUCTURE

```
/webapp_v2/
├── app_v2.py                    # Flask app with v2 API routes
│
├── /services/
│   ├── firestore_service_v2.py       # Firestore CRUD for v2 collections
│   ├── spotify_sync_service.py       # NEW: Playlist sync logic
│   ├── lyrics_service_v2.py          # Genius API (reuse from v1, minor changes)
│   ├── spotify_auth_service.py       # REUSE from v1 (no changes)
│   └── auth_service.py               # REUSE from v1 (no changes)
│
├── /templates/
│   └── viewer_v2.html                # Single-page app (updated dialogs)
│
├── /static/
│   ├── /js/
│   │   └── app_v2.js                 # Frontend state management (major refactor)
│   │
│   └── /css/
│       └── style_v2.css              # Styling (mostly reuse, minor additions)
│
└── requirements.txt                  # Python dependencies (same as v1)
```

**Code Duplication from V1:**
- Copy (do NOT symlink) needed services from `/webapp/services/` to `/webapp_v2/services/`
- Duplicate reusable code: `auth_service.py`, `spotify_auth_service.py`
- DO NOT depend on `/webapp/` folder (will be deleted later)
- All V1 features retained: lyrics editor, practice notes, BPM features, font picker, layout toggle, audio player, keyboard shortcuts, themes

---

## 6. MIGRATION STRATEGY

### NO DATA MIGRATION
- V1 collections (`songs`, `collections`) remain untouched
- V2 uses separate Firestore collections (`songs_v2`, `collections_v2`, `playlist_memory_v2`)
- Both apps can run simultaneously (different URLs)

### Deployment Strategy

**Single Cloud Run Service (Same URL, Same Firebase Auth)**
- Deploy `/webapp_v2/` to existing Cloud Run service (replaces v1)
- Uses same Firebase auth configuration
- Uses same GCP project and credentials
- Update GitHub workflows to deploy from `/webapp_v2/` folder instead of `/webapp/`

**Rollback Strategy:**
- If v2 has issues, manually deploy from `/webapp/` folder (v1 code)
- V1 Firestore collections (`songs`, `collections`, `playlist_memory`) remain untouched
- V2 uses separate Firestore collections (`songs_v2`, `collections_v2`, `playlist_memory_v2`)
- Can switch between v1/v2 by deploying different folder

**Important:**
- DO NOT modify `/webapp/` folder
- DO NOT depend on `/webapp/` code (duplicate required code to `/webapp_v2/`)
- V1 folder kept as backup only (will be deleted later after v2 proven stable)

---

## 7. IMPLEMENTATION PHASES

### Phase 1: Infrastructure (Terraform)
**Tasks:**
1. Add v2 Firestore indexes to `terraform/firestore.tf`
2. (Optional) Add second Cloud Run service for v2
3. Run `terraform plan` and `terraform apply`
4. Verify indexes created

**Estimated Time:** 1 hour

---

### Phase 2: Backend Foundation
**Tasks:**
1. Create `/webapp_v2/` folder structure
2. Copy/symlink reusable services (auth, spotify_auth)
3. Implement `firestore_service_v2.py`:
   - Collections CRUD
   - Songs CRUD
   - Playlist linking
4. Implement `spotify_sync_service.py`:
   - Fetch playlist metadata
   - Fetch playlist tracks
   - Sync logic (add new, flag removed)
5. Create `app_v2.py` with API routes:
   - Collections endpoints
   - Playlist linking endpoints
   - Songs endpoints
   - Sync endpoints

**Estimated Time:** 6-8 hours

---

### Phase 3: Sync Logic & Conflict Handling
**Tasks:**
1. Implement track deduplication (same `spotify_track_id` across playlists)
2. Update `source_playlist_ids` arrays correctly
3. Flag removed songs logic
4. Batch operations for performance (sync 100+ tracks efficiently)
5. SSE streaming for real-time progress

**Estimated Time:** 4-6 hours

---

### Phase 4: Frontend - Dialogs
**Tasks:**
1. Update Playlist Chooser dialog (shortcut 'P'):
   - Show all playlists from memory
   - Show "Already Linked" badges
   - Link flow (not import)
2. Update Collection Selector (shortcut 'X'):
   - Show linked playlist count
   - Show sync status
3. Update Song Selector (shortcut 'S'):
   - Filter for removed songs
   - Show removed badges
4. Create Linked Playlists Manager (Alt+P):
   - List linked playlists
   - Sync/unlink actions

**Estimated Time:** 6-8 hours

---

### Phase 5: Frontend - Main View
**Tasks:**
1. Update collection info bar
2. Auto-sync detection on load
3. Toast notifications for sync status
4. Removed song warning banner
5. Restore/delete actions for flagged songs
6. Update keyboard shortcuts (if needed)

**Estimated Time:** 3-4 hours

---

### Phase 6: Testing & Polish
**Tasks:**
1. Test sync with real Spotify playlists
2. Test removed song flagging (manually remove tracks from Spotify)
3. Test unlinking playlists
4. Test collection with 3+ linked playlists
5. Test same song in multiple collections (different notes/lyrics)
6. Performance test with 200+ song collections
7. Mobile responsive testing
8. Error handling (network failures, API rate limits)
9. **Verify all V1 features retained:**
   - Lyrics editor (manual edit, refresh, customization flag)
   - Practice notes (line references, navigation with UP/DOWN)
   - BPM features (manual set, auto-fetch, tap trainer, animated indicator)
   - Font size picker (Alt+↑/↓)
   - Layout toggle (1 col / 2 col)
   - Audio player (Spotify preview playback)
   - All keyboard shortcuts
   - Dark/light theme support
   - Mobile responsive design

**Estimated Time:** 4-6 hours

---

### Phase 7: Deployment
**Tasks:**
1. Update GitHub Actions workflow to deploy from `/webapp_v2/` folder
2. Update Dockerfile path (if needed)
3. Deploy to existing Cloud Run service (same URL, replaces v1)
4. Test in production with real data
5. Monitor logs for errors
6. Update README if needed

**Estimated Time:** 2 hours

---

**Total Estimated Time:** 26-35 hours

---

## 8. KEY TECHNICAL DECISIONS

### 8.1 Why `spotify_track_id` for Song IDs?
**V1 Problem:** `collection_id__artist__title` allowed duplicates if artist/title strings differed slightly (e.g., "Queen" vs "Queen (band)")

**V2 Solution:** Spotify's track ID is globally unique and consistent
- Same track in 10 playlists = same `spotify_track_id`
- Enables perfect deduplication within a collection
- Allows same song in multiple collections with different notes

---

### 8.2 Why Store Playlist Metadata in Collection Doc?
**Alternative:** Store only playlist IDs, fetch metadata on every load

**Chosen Approach:** Store metadata in `linked_playlists` array
- **Pro:** Faster display (no Spotify API call to show playlist list)
- **Pro:** Works even if Spotify API is down
- **Con:** Metadata can become stale (playlist renamed)
- **Solution:** Refresh metadata during sync

---

### 8.3 Why Flag Removed Songs Instead of Deleting?
**User Story:** User spent 30 minutes adding notes to a song. Playlist owner removes it. User's work should NOT be lost.

**Solution:**
- Set `is_removed_from_spotify: true`
- Show warning in UI
- User decides: restore (if re-added to playlist) or delete permanently
- Preserves user's customizations (notes, lyrics, BPM)

---

### 8.4 Why Auto-Sync on Collection Load?
**User Story:** User opens collection. Playlist has 5 new songs added by band leader. User should know.

**Solution:**
- Background API call on collection load: check if playlists changed
- Non-blocking (page loads immediately)
- If changes detected, show toast notification
- User can choose to sync or ignore

---

### 8.5 Why Global Playlist Memory?
**User Story:** User manages 3 bands (3 collections). Same "Classic Rock Hits" playlist used in 2 bands.

**Solution:**
- Playlist memory shows ALL playlists (not scoped to collection)
- Shows which collections each playlist is linked to
- Easy to link same playlist to multiple collections
- No need to re-paste URL

---

## 9. RISKS & MITIGATIONS

### Risk 1: Spotify API Rate Limits
**Problem:** Syncing 10 playlists with 100 tracks each = 1000+ API calls

**Mitigation:**
- Batch track fetches (Spotify API supports up to 50 tracks per request)
- Cache playlist metadata in Firestore
- Only sync when needed (detect changes first)
- Implement exponential backoff on rate limit errors

---

### Risk 2: Large Collections Performance
**Problem:** 500+ songs in collection, all loaded into memory

**Mitigation:**
- Firestore queries with pagination (lazy load songs)
- Frontend: Virtualized song list (only render visible items)
- Cache songs in `localStorage` for faster subsequent loads
- Consider implementing search server-side if >1000 songs

---

### Risk 3: Concurrent Sync Conflicts
**Problem:** User syncs playlist while another user (band member) is editing notes on same song

**Mitigation:**
- Sync ONLY updates Spotify metadata (title, artist, album)
- Sync NEVER overwrites user customizations (notes, lyrics, BPM)
- Use Firestore transactions for atomic updates
- Show warning if song modified during sync

---

### Risk 4: Broken Spotify Links
**Problem:** Playlist deleted, made private, or user loses access

**Mitigation:**
- Detect 404 errors from Spotify API
- Mark playlist as `sync_status: "error"`
- Show error message in UI: "Playlist no longer accessible"
- Allow user to unlink broken playlist
- Songs remain in collection (not deleted)

---

### Risk 5: Duplicate Tracks Across Playlists
**Problem:** Song appears in 3 linked playlists, counted 3 times?

**Mitigation:**
- Use `spotify_track_id` as deduplication key
- Store only ONE `songs_v2` doc per unique track per collection
- `source_playlists` array tracks which playlists contain it (with position in each)
- UI shows: "42 total playlist tracks, 38 unique songs"

---

## 10. FUTURE ENHANCEMENTS (Post-V2)

### A. Real-Time Sync Notifications
- Firebase Cloud Messaging (FCM) to notify when linked playlist changes
- "Band leader added 3 new songs to 'Spring Tour' playlist"

### B. Collaborative Collections
- Share collection with band members (multi-user write access)
- Real-time presence: "John is editing notes on 'Bohemian Rhapsody'"

### C. Smart Sync Scheduling
- Auto-sync daily/weekly (background Cloud Function)
- Email digest: "5 playlists updated this week"

### D. Playlist Diff View
- Show exactly which tracks were added/removed since last sync
- "Compare Versions" button in playlist manager

### E. Offline Mode
- Service worker caches songs for offline viewing
- Sync when reconnected

### F. Export Collection
- Export as PDF setlist
- Export as Spotify playlist (reverse operation)
- Export notes as Markdown

---

## 11. TESTING PLAN

### Unit Tests (Backend)
- `firestore_service_v2.py`: CRUD operations
- `spotify_sync_service.py`: Sync logic, deduplication, flagging
- Edge cases: empty playlists, deleted tracks, API errors

### Integration Tests
- Link 3 playlists to collection → verify unique song count
- Remove track from Spotify → verify flagged in Firestore
- Unlink playlist → verify `source_playlist_ids` updated
- Sync with network failure → verify retry logic

### Manual Testing Checklist
- [ ] Create collection
- [ ] Link 3 playlists
- [ ] Verify unique songs deduplicated
- [ ] Edit notes on song
- [ ] Sync playlist (should NOT overwrite notes)
- [ ] Remove track from Spotify
- [ ] Sync → verify flagged
- [ ] Restore flagged song
- [ ] Unlink playlist
- [ ] Delete collection
- [ ] Playlist memory shows across collections
- [ ] Mobile responsive (phone/tablet)

---

## 12. OPEN QUESTIONS FOR DISCUSSION

### Q1: How should unlinking a playlist work?
**DECIDED:** Flag songs as removed if not in other linked playlists
- When playlist unlinked, remove playlist from each song's `source_playlists` array
- If array becomes empty, set `is_removed_from_spotify: true`
- User can permanently delete via trash icon in song chooser (with confirmation)

### Q2: Should v2 support importing v1 collections?
**Pro:** Users can migrate their existing data
**Con:** Adds complexity, v1 and v2 have different data models
**Recommendation:** Manual migration only (user re-links playlists)

### Q3: Auto-sync frequency?
**Option A:** Only on manual trigger (user clicks "Sync Now")
**Option B:** Auto-sync on collection load (background check)
**Option C:** Daily background sync (Cloud Scheduler)
**Recommendation:** Option B (best UX, no infra changes needed)

### Q4: Should removed songs be auto-hidden or always visible?
**Option A:** Hidden by default, show with filter toggle
**Option B:** Always visible with warning badge
**Recommendation:** Option A (less clutter)

### Q5: Should playlist memory be per-user or global?
**Option A:** Per-user (current v1 behavior)
**Option B:** Global (all users see same playlists)
**Recommendation:** Per-user (privacy)

### Q6: Should we support custom track ordering?
**DECIDED:** Three sort options in song chooser
- Sort by Song Title (default)
- Sort by Artist Name
- Sort by Playlist (respects Spotify playlist ordering, shows playlist section headers)

---

## 13. SUCCESS METRICS

**V2 Launch Success Criteria:**
1. User can link 3+ playlists to a collection
2. Unique songs deduplicated correctly
3. Sync detects added/removed tracks
4. User customizations (notes/lyrics) preserved during sync
5. Playlist memory shows across all collections
6. Same song in 2 collections has separate notes
7. Performance: 100+ song collection loads in <3 seconds
8. Mobile responsive (tested on iPhone/Android)

**Post-Launch Monitoring:**
- Average playlists linked per collection
- Average unique songs per collection
- Sync frequency (how often users sync)
- Removed song restoration rate (% of flagged songs restored vs deleted)
- API error rate (Spotify/Firestore)
- Page load time (P95)

---

## 14. ROLLBACK PLAN

**If V2 Has Critical Bugs:**
1. Manually trigger GitHub Actions workflow with `/webapp/` folder (v1 code)
2. Or: Locally build Docker image from `/webapp/` and deploy to Cloud Run
3. V1 Firestore collections still exist (untouched)
4. V1 app code in `/webapp/` folder (untouched, available as backup)
5. Fix bugs in v2, redeploy from `/webapp_v2/`

**No Risk to Existing Data:**
- V1 data in Firestore (`songs`, `collections`, `playlist_memory`) untouched
- V2 uses separate collections (`songs_v2`, `collections_v2`, `playlist_memory_v2`)
- Can switch between v1/v2 by deploying different source folder

---

## APPENDIX: API ENDPOINT REFERENCE

### Collections
- `GET /api/v2/collections` - List all collections
- `POST /api/v2/collections` - Create collection
- `GET /api/v2/collections/<id>` - Get collection details
- `PUT /api/v2/collections/<id>` - Update collection
- `DELETE /api/v2/collections/<id>` - Delete collection

### Playlist Linking
- `POST /api/v2/collections/<id>/playlists` - Link playlist
- `DELETE /api/v2/collections/<id>/playlists/<playlist_id>` - Unlink playlist
- `POST /api/v2/collections/<id>/playlists/<playlist_id>/sync` - Sync single playlist
- `POST /api/v2/collections/<id>/sync-all` - Sync all playlists
- `GET /api/v2/collections/<id>/sync-status` - Check sync status

### Songs
- `GET /api/v2/songs?collection_id=<id>` - List songs
- `GET /api/v2/songs/<id>` - Get song
- `PUT /api/v2/songs/<id>/notes` - Update notes
- `PUT /api/v2/songs/<id>/lyrics` - Update lyrics
- `PUT /api/v2/songs/<id>/bpm` - Update BPM
- `POST /api/v2/songs/<id>/bpm` - Fetch BPM
- `POST /api/v2/songs/<id>/restore` - Restore flagged song
- `DELETE /api/v2/songs/<id>` - Delete song

### Playlist Memory
- `GET /api/v2/playlist/memory` - List recent playlists
- `DELETE /api/v2/playlist/memory/<id>` - Remove from memory

---

**END OF IMPLEMENTATION PLAN**
