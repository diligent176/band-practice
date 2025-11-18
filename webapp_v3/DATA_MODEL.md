# Band Practice Pro v3 - Data Model

## Firestore Collections

### `users_v3`
User profiles and preferences.

**Document ID**: Firebase UID (auto-generated)

**Fields**:
```javascript
{
  uid: string,                    // Firebase UID (same as document ID)
  email: string,                  // User's email from Google Auth
  display_name: string,           // User's display name
  photo_url: string,              // Profile photo URL
  is_admin: boolean,              // Admin flag (default: false)
  created_at: timestamp,
  last_login_at: timestamp,
  preferences: {
    default_column_mode: number,  // 1, 2, or 3 columns (default: 3)
    default_font_size: number,    // Font size in px (default: 16)
    theme: string,                // 'dark' or 'light' (default: 'dark')
    email_notifications: boolean  // Email notifications (default: true)
  },
  spotify_connected: boolean,     // Has user connected Spotify? (Phase 3+)
  spotify_token_ref: string       // Reference to spotify_tokens_v3 doc (Phase 3+)
}
```

---

### `collections_v3`
Song collections owned by users.

**Document ID**: Auto-generated

**Fields**:
```javascript
{
  owner_uid: string,              // Owner's Firebase UID (references users_v3)
  name: string,                   // Collection name (e.g. "Personal Collection", "Summer Gig 2024")
  description: string,            // Optional description
  is_personal: boolean,           // true for Personal Collection only (cannot be deleted/shared)
  is_public: boolean,             // Can others view this collection?
  collaborators: [string],        // Array of Firebase UIDs who can edit
  linked_playlists: [             // Linked Spotify/YouTube Music playlists (Phase 3+)
    {
      playlist_id: string,        // Playlist ID from source platform
      source: string,             // 'spotify' or 'youtube'
      name: string,               // Playlist name
      linked_at: timestamp
    }
  ],
  song_count: number,             // Count of songs in collection (denormalized)
  created_at: timestamp,
  updated_at: timestamp
}
```

**Indexes Required**:
1. `owner_uid` + `name` (ASC, ASC) - Get user's collections sorted by name
2. `collaborators` (ARRAY_CONTAINS) + `name` (ASC) - Get shared collections
3. `owner_uid` + `is_personal` (ASC, ASC) - Find Personal Collection

**Security Rules**:
- Read: Public collections OR owner OR collaborator
- Create: Authenticated users only, must set `owner_uid` to own UID
- Update/Delete: Owner only
- Personal Collection: Cannot be deleted

---

### `songs_v3`
Songs within collections with lyrics and notes.

**Document ID**: Auto-generated

**Fields**:
```javascript
{
  collection_id: string,          // Parent collection (references collections_v3)
  title: string,                  // Song title
  artist: string,                 // Artist name
  spotify_id: string,             // Spotify track ID (optional)
  youtube_id: string,             // YouTube Music ID (optional)

  lyrics: {
    source: string,               // 'genius', 'manual', 'spotify', etc.
    fetched_at: timestamp,
    sections: [                   // Structured lyrics by section
      {
        type: string,             // 'verse', 'chorus', 'bridge', etc.
        lines: [string]           // Array of lyric lines
      }
    ],
    raw_text: string              // Full lyrics as plain text (for search)
  },

  notes: [                        // Practice notes linked to lyric sections
    {
      section_index: number,      // Which section this note refers to
      line_index: number,         // Which line within section (optional)
      note_text: string,          // The practice note
      created_by_uid: string,     // Who created this note
      created_at: timestamp
    }
  ],

  metadata: {
    bpm: number,                  // Song tempo (optional)
    key: string,                  // Musical key (optional)
    duration_ms: number,          // Song length in milliseconds
    album_art_url: string         // Album artwork URL
  },

  created_at: timestamp,
  updated_at: timestamp,
  created_by_uid: string          // Who added this song to collection
}
```

**Indexes Required**:
1. `collection_id` + `created_at` (ASC, DESC) - Get songs in collection
2. `collection_id` + `title` (ASC, ASC) - Search songs by title

**Security Rules**:
- Read: Inherit from parent collection
- Create/Update: Authenticated users (ownership checked in backend)
- Delete: Collection owner only

---

### `playlists_v3`
Cached playlist metadata from Spotify/YouTube Music.

**Document ID**: Auto-generated

**Fields**:
```javascript
{
  source: string,                 // 'spotify' or 'youtube'
  playlist_id: string,            // Playlist ID from source platform
  name: string,                   // Playlist name
  description: string,            // Playlist description
  owner_name: string,             // Playlist owner (on source platform)
  track_count: number,            // Number of tracks
  tracks: [                       // Cached track list
    {
      track_id: string,           // Track ID on source platform
      title: string,
      artist: string,
      album: string,
      duration_ms: number,
      album_art_url: string
    }
  ],
  imported_by_uid: string,        // Who imported this playlist
  imported_at: timestamp,
  last_synced_at: timestamp       // Last time we refreshed from source
}
```

**Indexes Required**:
1. `source` + `playlist_id` (ASC, ASC) - Find playlist by source ID
2. `imported_by_uid` + `imported_at` (ASC, DESC) - User's import history

---

### `spotify_tokens_v3`
Spotify OAuth tokens (stored securely, separate from users).

**Document ID**: Firebase UID (one-to-one with user)

**Fields**:
```javascript
{
  access_token: string,           // Spotify access token (encrypted)
  refresh_token: string,          // Spotify refresh token (encrypted)
  expires_at: timestamp,          // Token expiration
  scope: string,                  // OAuth scopes granted
  created_at: timestamp,
  updated_at: timestamp
}
```

**Security Rules**:
- Read/Write: Owner only (UID matches document ID)
- NO admin access (security)

---

## Field Naming Conventions

### User References
- `owner_uid` - References the owner's Firebase UID
- `created_by_uid` - References who created the document
- `uid` - The user's own UID (in users_v3)

### IDs
- `collection_id` - References collections_v3 document
- `song_id` - References songs_v3 document
- `spotify_id` - Spotify track/playlist ID
- `youtube_id` - YouTube Music track/playlist ID

### Timestamps
- `created_at` - When document was created
- `updated_at` - When document was last modified
- `last_login_at` - When user last logged in
- `fetched_at` / `imported_at` / `synced_at` - Specific action timestamps

### Booleans
- `is_personal` - Personal Collection flag
- `is_public` - Public visibility flag
- `is_admin` - Admin user flag
- `spotify_connected` - Has Spotify connected

---

## Migration from v2

v2 used `user_id` (email) as the primary identifier. v3 uses `uid` (Firebase UID).

**Do NOT mix**:
- ✅ `owner_uid` - Correct for v3
- ❌ `owner_id` - Wrong, this was v2 pattern

**v2 Collections**:
- `collections_v2` - Old collection format (uses `user_id` email)
- `songs_v2` - Old song format

**v3 Collections** (new, separate):
- `collections_v3` - New collection format (uses `owner_uid`)
- `songs_v3` - New song format
- `users_v3` - User profiles (uses `uid`)

No data migration needed - v2 and v3 run in parallel.
