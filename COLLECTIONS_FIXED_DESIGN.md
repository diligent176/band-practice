# Collections Feature - Fixed Design Implementation

## Critical Design Fix Applied

### The Problem You Identified ✅

You correctly identified that the original design was flawed:

- Song ID was `artist__title`
- Collection was just a field in the document
- **Result**: Same song could NOT exist in multiple collections with different notes/lyrics/BPM

### The Solution - Composite Document IDs ✅

**New Song ID Format:**

```
collection_id__artist__title
```

Example:

- Reggae Band version: `abc123__Creedence_Clearwater_Revival__Bad_Moon_Rising`
- Rock Band version: `xyz789__Creedence_Clearwater_Revival__Bad_Moon_Rising`

These are completely separate documents!

## What Was Changed

### 1. Backend - lyrics_service.py ✅

- **`_create_song_id(title, artist, collection_id=None)`**: Now creates collection-prefixed IDs
- **`get_playlist_details_with_conflicts(playlist_url, collection_id=None)`**: Now accepts collection_id for proper conflict detection
- **`import_selected_songs_stream(playlist_url, selected_song_ids, collection_id=None)`**: Uses collection_id in song ID generation

### 2. Backend - app.py ✅

- **`/api/playlist/details`**: Now accepts and passes `collection_id` to lyrics service

### 3. Frontend - app.js ✅

- **`loadPlaylistDetails()`**: Now sends current `collection_id` when loading playlist details
- **`startImport()`**: Already sends `collection_id` when importing songs

## How It Works Now

### Scenario: Same Song in Two Collections

**User imports "Bad Moon Rising" to Reggae Band:**

1. Collection ID: `reggae_collection_abc123`
2. Song ID created: `reggae_collection_abc123__Creedence_Clearwater_Revival__Bad_Moon_Rising`
3. User adds notes: "Slow it down, focus on the off-beat"
4. User sets BPM: 95

**User switches to Rock Band and imports same song:**

1. Collection ID: `rock_collection_xyz789`
2. Song ID created: `rock_collection_xyz789__Creedence_Clearwater_Revival__Bad_Moon_Rising`
3. User adds different notes: "Keep it driving, standard rock beat"
4. User sets different BPM: 180

**Result**: Two completely independent song documents! ✅

### Song Operations

**Import Flow:**

1. User selects collection (stored in `currentCollection`)
2. User clicks "Import Playlist"
3. Frontend sends `collection_id` with playlist URL
4. Backend generates song IDs with format: `collection_id__artist__title`
5. Checks for conflicts within THAT collection only
6. Imports songs with unique IDs per collection

**View Songs:**

1. User is in "Reggae Band" collection
2. Frontend calls `/api/songs?collection_id=reggae_collection_abc123`
3. Backend returns only songs with IDs starting with that collection ID
4. User sees only their Reggae Band songs

**Switch Collections:**

1. User switches to "Rock Band"
2. Frontend clears current songs and loads new ones
3. Backend returns different set of songs (different IDs)
4. User sees completely different song list with independent notes/lyrics/BPM

## Benefits

### ✅ Data Isolation

- Each collection has completely separate song data
- No shared state between collections
- No conflicts or overwrites

### ✅ Flexibility

- Same song can have different:
  - Practice notes
  - Custom lyrics
  - BPM settings
  - Any other metadata

### ✅ Simplicity

- Song ID itself encodes the collection
- No complex queries needed
- Easy to understand and debug

### ✅ Scalability

- Each user can have unlimited collections
- Each collection can have unlimited songs
- No performance issues with data isolation

## Data Migration Required

### Current State

If you have existing songs with old format (`artist__title`), they need migration.

### Migration Options

**Option 1: Delete and Start Fresh (Recommended for testing)**

- Delete the `songs` collection in Firestore
- Start with clean slate
- Import songs to your collections

**Option 2: Migrate Existing Songs (Preserve data)**

- Run a script that:
  1. Gets all songs with old ID format
  2. Gets user's Default collection ID
  3. Creates new documents with format: `default_collection_id__artist__title`
  4. Copies all data (notes, lyrics, BPM, etc.)
  5. Deletes old documents

### Migration Script (if needed)

I can create a migration script that:

- Reads all songs without collection prefix in ID
- Prompts for Default collection ID
- Creates new documents with correct format
- Preserves all your notes, custom lyrics, and BPM data
- Deletes old format documents after verification

## Testing Checklist

- [ ] Delete existing songs collection (or run migration)
- [ ] Verify Default collection is created on login
- [ ] Import songs to Default collection
- [ ] Verify songs have format: `collection_id__artist__title`
- [ ] Create new collection (e.g., "Test Band")
- [ ] Switch to new collection
- [ ] Import same song to new collection
- [ ] Verify two separate documents exist in Firestore
- [ ] Add different notes to each version
- [ ] Switch between collections
- [ ] Verify notes are different and independent
- [ ] Set different BPM for each version
- [ ] Verify BPM is independent per collection

## What's Next

1. **Clean Slate Option**: Delete `songs` collection, test fresh imports
2. **Or Migrate**: I can write a migration script to preserve existing data
3. **Test**: Import songs, create collections, verify independence
4. **Deploy**: Apply Terraform changes for indexes

Let me know if you want me to:

1. Create a migration script to preserve existing songs
2. Just go with clean slate and delete everything
3. Make any other adjustments to the implementation
