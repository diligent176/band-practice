# Collections Feature Implementation

## Overview

Added a comprehensive Collections/Bands feature to allow users to organize songs into different collections (e.g., "Reggae Band", "Rock Band", etc.). Each user can create multiple collections and switch between them, with the current collection persisted to localStorage.

## Changes Made

### 1. Database Schema (Terraform)

**File: `terraform/firestore.tf`**

Added three new Firestore indexes:

- **collections_user_name**: Composite index for efficient querying of collections by user_id, sorted by name
- **songs_collection_artist_title**: Composite index for querying songs by collection_id, sorted by artist and title

### 2. Backend - Firestore Service

**File: `webapp/services/firestore_service.py`**

Added new collection management methods:

- `get_or_create_default_collection(user_id)`: Automatically creates "Default" collection for new users
- `get_user_collections(user_id)`: Get all collections for a user
- `get_collection(collection_id)`: Get a specific collection by ID
- `create_collection(user_id, name, description)`: Create a new collection
- `update_collection(collection_id, name, description)`: Update collection details
- `delete_collection(collection_id)`: Delete a collection (prevents deletion of "Default")
- `get_songs_by_collection(collection_id)`: Get all songs in a collection

Modified existing methods:

- `get_all_songs(collection_id=None)`: Now supports filtering by collection_id
- `create_or_update_song()`: Now preserves collection_id when updating existing songs

### 3. Backend - API Endpoints

**File: `webapp/app.py`**

Added REST API endpoints:

- `GET /api/collections`: List all collections for current user
- `POST /api/collections`: Create a new collection
- `GET /api/collections/<id>`: Get a specific collection
- `PUT /api/collections/<id>`: Update a collection
- `DELETE /api/collections/<id>`: Delete a collection (protected: cannot delete "Default")
- `GET /api/collections/default`: Get or create the Default collection

Modified existing endpoints:

- `GET /api/songs`: Now accepts optional `collection_id` query parameter
- `POST /api/playlist/import`: Now accepts `collection_id` in request body to assign imported songs

### 4. Backend - Lyrics Service

**File: `webapp/services/lyrics_service.py`**

Modified import methods:

- `import_selected_songs_stream()`: Now accepts `collection_id` parameter and assigns it to imported songs

### 5. Frontend - HTML

**File: `webapp/templates/viewer.html`**

Added UI elements:

- **Collection button** in header (left of Playlist button) showing current collection name
- **Collection Selector Dialog**: Lists all collections with ability to switch between them
- **New Collection Dialog**: Form to create new collections with name and description
- **Keyboard shortcut**: Alt+C to open collection selector (added to help card)

### 6. Frontend - JavaScript

**File: `webapp/static/js/app.js`**

Added collection management functionality:

- **State management**: `currentCollection` and `allCollections` variables
- **localStorage persistence**: Current collection ID saved and restored across sessions
- **Auto-initialization**: Loads or creates Default collection on app start
- **Collection functions**:
  - `loadCurrentCollection()`: Load collection from localStorage or create Default
  - `showCollectionDialog()`: Display collection selector
  - `switchCollection()`: Switch to a different collection and reload songs
  - `createNewCollection()`: Create a new collection
  - `updateCollectionDisplay()`: Update UI to show current collection name

Modified existing functions:

- `loadSongs()`: Now filters songs by current collection ID
- `startImport()`: Now passes current collection ID when importing songs
- Keyboard handler: Added Alt+C shortcut for collection selector

### 7. Frontend - CSS

**File: `webapp/static/css/style.css`**

Added styles for:

- `.collection-list`: Container for collection items
- `.collection-item`: Individual collection display with icon, name, description
- `.collection-item.active`: Highlighted active collection
- `.collection-selector-content`: Dialog content layout

## User Experience

### Default Behavior

1. New user logs in → automatically gets a "Default" collection
2. All existing functionality works as before within the Default collection
3. Users can import songs, which go into their current active collection

### Creating Collections

1. Click "Collection" button (or press Alt+C)
2. Click "New Collection" button
3. Enter name (e.g., "Reggae Band") and optional description
4. Collection is created and appears in the list

### Switching Collections

1. Click "Collection" button (or press Alt+C)
2. Click on any collection to switch to it
3. Songs list updates to show only songs from that collection
4. Collection choice is saved to localStorage
5. Next time user visits, they'll be in the same collection

### Importing Songs

1. Songs are always imported to the currently active collection
2. User can switch collections before importing to organize songs

## Data Model

### Collection Document

```javascript
{
  id: "auto-generated-id",
  user_id: "user@example.com",
  name: "Reggae Band",
  description: "Songs for my weekend gigs",
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### Song Document (modified)

```javascript
{
  id: "artist-title-hash",
  collection_id: "collection-id",  // NEW FIELD
  title: "Song Title",
  artist: "Artist Name",
  // ... other fields
}
```

## Migration Notes

### Existing Songs

- Existing songs without `collection_id` will show in queries without collection filter
- To migrate existing songs to Default collection, run a one-time script or manually assign them

### Terraform Deployment

```bash
cd terraform
terraform plan
terraform apply
```

This will create the necessary Firestore indexes for efficient collection queries.

## Testing Checklist

- [x] Create Default collection on first login
- [x] Create new custom collections
- [x] Switch between collections
- [x] Import songs to different collections
- [x] Songs filtered by current collection
- [x] Collection persists across browser refresh
- [x] Cannot delete Default collection
- [x] Keyboard shortcut (Alt+C) works
- [x] Collection name displays in header

## Future Enhancements

1. **Bulk move songs**: Move songs between collections
2. **Collection sharing**: Share collections with other band members
3. **Collection stats**: Show song count per collection
4. **Collection search**: Filter collections list
5. **Collection colors/icons**: Custom visual identifiers
6. **Rename Default**: Allow users to rename their Default collection
7. **Delete with songs**: Option to delete collection and all its songs
