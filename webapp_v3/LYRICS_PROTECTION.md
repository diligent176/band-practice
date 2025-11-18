# Lyrics Protection System - V3

## Overview

The lyrics fetching system protects user customizations while allowing collection owners explicit control.

**Core Principle**:

- ❌ **Automatic processes** (background fetch) NEVER overwrite customized lyrics
- ✅ **Collection owners** CAN force refresh if explicitly requested

## Key Fields

### `lyrics_fetched` (boolean)

- `false`: Lyrics have not been fetched yet (default for new songs)
- `true`: Lyrics have been fetched from Genius API

**Purpose**: Prevents redundant API calls and identifies songs that need lyrics.

### `is_customized` (boolean)

- `false`: Lyrics are from Genius API or empty (default)
- `true`: User has manually edited the lyrics

**Purpose**: Marks songs with user customizations. Automatic fetching skips these. Collection owners can override with explicit action.

## Protection Mechanisms

### 1. Automatic Background Fetch ❌ NO OVERRIDE

When a playlist is imported, background lyrics fetching runs automatically:

```python
# Query only unfetched songs
query = songs_v3.where('lyrics_fetched', '==', False)

# Skip customized songs - automatic process CANNOT override
for doc in unfetched_songs:
    if doc.get('is_customized', False):
        continue  # SKIP - automatic protection
```

**Behavior**: Automatic process always respects `is_customized` flag. No override possible.

### 2. Manual Collection Owner Refresh ✅ CAN OVERRIDE

Collection owners can manually refresh lyrics with granular control:

```python
# Default: respect customization (blocked if is_customized=True)
fetch_and_update_song_lyrics(song_id, force=True)

# Override: collection owner explicitly overwrites
fetch_and_update_song_lyrics(song_id, force=True, force_customized=True)
```

**Behavior**:

- `force=True`: Re-fetch even if already fetched
- `force_customized=True`: Allow overwriting customized lyrics (collection owner only)
- When overwritten, `is_customized` resets to `False`
- Backend verifies collection ownership before allowing override

## User Workflow

### Scenario 1: Normal Import

1. User imports Spotify playlist
2. Songs created with `lyrics_fetched=False`, `is_customized=False`
3. Background thread fetches lyrics from Genius
4. Songs updated with `lyrics_fetched=True`

### Scenario 2: User Edits Lyrics

1. User opens song in PLAYER view
2. User clicks "Edit Lyrics" button
3. User modifies lyrics text
4. Frontend calls `PUT /api/v3/songs/{song_id}` with `is_customized=True`
5. Song now **permanently protected** from automatic fetching

### Scenario 3: Re-import Same Playlist

1. User imports same playlist to different collection
2. Song already exists in another collection (same `spotify_track_id`)
3. If original has `is_customized=True`:
   - New instance created with `is_customized=False` (separate collection)
   - Background fetch fetches fresh lyrics for new instance
   - Original customized lyrics remain unchanged

### Scenario 4: Collection Owner Refreshes Customized Lyrics

1. User has customized lyrics (`is_customized=True`)
2. User clicks "Refresh Lyrics" button
3. Frontend shows warning dialog: "This song has customized lyrics. Replace with Genius lyrics?"
4. User confirms → Frontend calls `POST /api/v3/songs/{song_id}/fetch-lyrics?force_customized=true`
5. Backend verifies user owns the collection (403 error if not owner)
6. Fetches fresh Genius lyrics and resets `is_customized=False`

## Database Schema

```javascript
{
  // ... other fields ...

  lyrics: "",                    // Plain text lyrics
  lyrics_numbered: "",           // Lyrics with line numbers
  lyrics_fetched: false,         // Has lyrics been fetched?
  lyrics_fetch_error: null,      // Error if fetch failed
  lyrics_fetched_at: timestamp,  // When lyrics were fetched
  is_customized: false,          // User edited lyrics?

  // ... other fields ...
}
```

## Implementation Status

### ✅ Backend Complete

- [x] `is_customized` field in song schema
- [x] Automatic fetch skips customized songs (no override)
- [x] Manual fetch respects `is_customized` by default
- [x] `force_customized` parameter for collection owner override
- [x] Collection ownership verification in API
- [x] Reset `is_customized=False` when overwritten
- [x] API endpoint: `POST /api/v3/songs/{song_id}/fetch-lyrics?force_customized=true`

### 🔜 Frontend (Future Phases)

- [ ] "Edit Lyrics" button (PLAYER view)
- [ ] Set `is_customized=True` when user saves edits
- [ ] "Refresh Lyrics" button with smart behavior
- [ ] Confirmation dialog for customized lyrics
- [ ] Visual badge showing "Customized" status
- [ ] Error handling for non-owner attempts

## API Endpoints

### Fetch Lyrics (Default) ✅ IMPLEMENTED

```http
POST /api/v3/songs/{song_id}/fetch-lyrics
Authorization: Bearer <firebase_token>
```

**Behavior**:

- ✅ Fetches if `is_customized=False`
- ❌ Blocked if `is_customized=True`

**Response (blocked)**:

```json
{
  "error": "Failed to fetch lyrics",
  "is_customized": true,
  "hint": "Use ?force_customized=true to overwrite customized lyrics"
}
```

### Force Overwrite (Collection Owner) ✅ IMPLEMENTED

```http
POST /api/v3/songs/{song_id}/fetch-lyrics?force_customized=true
Authorization: Bearer <firebase_token>
```

**Authorization**: Only collection owner (verified by backend)
**Behavior**: Overwrites customized lyrics, resets `is_customized=False`

**Response (success)**:

```json
{
  "message": "Lyrics fetched successfully",
  "song_id": "abc123",
  "was_customized": true,
  "force_customized": true
}
```

**Response (not owner)**:

```json
{
  "error": "Only collection owner can refresh lyrics"
}
```

### Update Lyrics (Manual Edit) 🔜 FUTURE

```http
PUT /api/v3/songs/{song_id}
{
  "lyrics": "User-edited lyrics...",
  "is_customized": true
}
```

## V2 Comparison

### V2 Behavior

- Used `is_customized` flag
- Checked flag before overwriting during import
- Protected songs with notes (even if not customized)

### V3 Improvements

- **Cleaner logic**: Only `is_customized` matters (notes are separate)
- **Background fetching**: Happens automatically after import
- **Query optimization**: Firestore query for `lyrics_fetched == False` is indexed
- **Explicit blocking**: `is_customized` check happens BEFORE any API calls

## Testing Checklist

- [ ] Import playlist → lyrics fetch automatically
- [ ] Re-import same playlist → no redundant fetches (lyrics_fetched=True)
- [ ] Edit lyrics → set `is_customized=True` → try force refresh → blocked
- [ ] Delete and re-import → new songs get fresh lyrics
- [ ] Check logs for "Skipping customized song" messages

## Firestore Indexes Required

```hcl
# terraform/firestore_v3.tf

# Query songs that need lyrics
resource "google_firestore_index" "songs_v3_needs_lyrics" {
  collection = "songs_v3"

  fields {
    field_path = "collection_id"
    order      = "ASCENDING"
  }

  fields {
    field_path = "lyrics_fetched"
    order      = "ASCENDING"
  }
}
```

This index allows efficient querying of unfetched songs without scanning entire collection.
