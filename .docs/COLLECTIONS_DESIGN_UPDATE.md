# Collections Feature - Design Update

## Problem Identified

The original implementation had a critical design flaw:

### Original Design (FLAWED)

- Song ID: `artist__title`
- Collection stored as a field: `collection_id`

**Problems:**

1. ❌ A song can only belong to ONE collection
2. ❌ Different collections can't have different notes/lyrics/BPM for the same song
3. ❌ If user has "Song X" in both "Reggae Band" and "Rock Band", they share the same notes
4. ❌ Can't have different custom lyrics or tempo for the same song in different contexts

### New Design (CORRECT)

- Song ID: `collection_id__artist__title`
- Collection is embedded in the document ID itself

**Benefits:**

1. ✅ Same song can exist independently in multiple collections
2. ✅ Each collection has its own copy with unique notes/lyrics/BPM
3. ✅ Total data isolation between collections
4. ✅ Multiple users can have their own versions
5. ✅ Cleaner data model - collection_id is both the partition key AND part of the ID

## Implementation Changes Required

### 1. Update `_create_song_id()` method ✅

```python
def _create_song_id(self, title, artist, collection_id=None):
    if collection_id:
        return f"{collection_id}__{artist}__{title}"
    else:
        return f"{artist}__{title}"  # Legacy fallback
```

### 2. Update Frontend Song ID Generation

The frontend needs to generate song IDs with collection_id when:

- Displaying playlist details (for conflict detection)
- Sending selected song IDs to import

### 3. Update Import Flow

- `get_playlist_details_with_conflicts()` needs collection_id parameter
- Generate preview IDs with collection_id
- Check for conflicts within the specific collection

### 4. Update All Song Operations

- Song lookup needs collection context
- Song creation embeds collection in ID
- Song deletion works automatically (unique ID per collection)

## Data Migration

Existing songs with format `artist__title` need to be:

1. Identified by checking if ID contains collection_id prefix
2. Recreated with new ID format `collection_id__artist__title`
3. Old documents deleted

## Benefits of This Design

### Scenario: Same Song, Different Bands

**Reggae Band Collection:**

- Song ID: `reggae_band_id__Creedence_Clearwater_Revival__Bad_Moon_Rising`
- Notes: "Slow it down, focus on the off-beat"
- BPM: 95 (slowed down for reggae feel)
- Lyrics: Standard

**Rock Band Collection:**

- Song ID: `rock_band_id__Creedence_Clearwater_Revival__Bad_Moon_Rising`
- Notes: "Keep it driving, standard rock beat"
- BPM: 180 (original tempo)
- Lyrics: Custom version with extended outro

Both versions exist independently!

## API Changes

### Before (FLAWED):

```javascript
// Get songs by collection - songs had collection_id field
GET /api/songs?collection_id=abc123
```

### After (CORRECT):

```javascript
// Get songs by collection - songs are partitioned by ID prefix
GET /api/songs?collection_id=abc123
// Backend queries for song IDs starting with "abc123__"
```

## Migration Strategy

1. **Stop writes** to old format
2. **Deploy new code** that uses collection-prefixed IDs
3. **Run migration script** that:
   - Reads all songs with old format
   - Creates new documents with collection_id prefix
   - Verifies data integrity
   - Deletes old documents
4. **Verify** all collections work correctly
