# Band Practice Pro v3 - Comprehensive Build Plan

## 🎯 Project Goals

**Primary Objective:** Rebuild BPPv3 from scratch with thoughtful architecture, solving the 25-user Spotify limit while improving UX.

**Key Principles:**

- ✅ Spotify Web Playback SDK (Premium users, no 25-user limit)
- ✅ Progressive Web App (PWA) - installable, full-screen
- ✅ New Firestore collections (v2 remains untouched)
- ✅ Clean, reusable CSS architecture (no hacks)
- ✅ Dark, classy design for TV screens in dark rooms
- ✅ Keyboard-first navigation (desktop priority)
- ✅ Built in `/webapp_v3/` (v2 untouched)
- ✅ Incremental, testable development

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Band Practice Pro v3 - High-Level Architecture              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend (PWA)                                             │
│  ├── Auth Gate (Google Firebase Auth)                      │
│  ├── HOME View (Collections Management)                    │
│  ├── SONGS View (Song Chooser)                             │
│  └── PLAYER View (Lyrics + Notes + Music)                  │
│                                                             │
│  Backend (Flask)                                            │
│  ├── Authentication (Firebase token verification)          │
│  ├── Spotify Integration                                   │
│  │   ├── Client Credentials (playlist import)              │
│  │   └── User OAuth (Web Playback SDK tokens)              │
│  ├── Lyrics Service (Genius API)                           │
│  └── Firestore Service (all data operations)               │
│                                                             │
│  Database (Firestore v3 Collections)                       │
│  ├── users_v3                                              │
│  ├── collections_v3                                        │
│  ├── songs_v3                                              │
│  ├── playlist_memory_v3                                    │
│  └── spotify_tokens_v3                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema (Firestore v3)

### Collection: `users_v3`

```javascript
{
  uid: "firebase-uid",                    // Document ID
  email: "user@example.com",
  display_name: "John Doe",
  photo_url: "https://...",               // Google profile photo
  is_admin: false,
  spotify_connected: false,               // Has connected Spotify Premium
  spotify_token_ref: null,                // Reference to spotify_tokens_v3
  preferences: {
    default_font_size: 16,
    default_column_mode: 3,
    theme: "dark",
    email_notifications: true             // For collaboration requests
  },
  created_at: timestamp,
  last_login_at: timestamp
}
```

### Collection: `collections_v3`

```javascript
{
  id: "auto-generated-id",                // Document ID
  name: "Rock Classics",
  description: "Greatest rock songs",
  icon_url: "https://...",                // Collection artwork (first album art or custom)
  owner_uid: "firebase-uid",
  collaborators: ["uid1", "uid2"],        // Array of UIDs with edit access
  visibility: "private",                  // "private" | "shared" | "public"
  collaboration_requests: [               // For public collections
    { uid: "uid3", requested_at: timestamp }
  ],
  linked_playlists: [                     // Embedded playlist metadata
    {
      playlist_id: "spotify-playlist-id",  // Spotify playlist ID
      playlist_name: "Today's Top Hits",
      playlist_owner: "Spotify",
      playlist_url: "https://open.spotify.com/playlist/...",
      image_url: "https://...",
      track_count: 50,
      linked_at: timestamp,
      last_synced_at: timestamp            // For re-sync feature
    }
  ],
  song_count: 25,                         // Actual unique songs (after dedup)
  created_at: timestamp,
  updated_at: timestamp
}
```

### Collection: `playlist_memory_v3`

```javascript
{
  id: "spotify-playlist-id",              // Document ID = Spotify playlist ID
  user_uid: "firebase-uid",               // User who accessed this playlist
  playlist_url: "https://open.spotify.com/playlist/...",
  playlist_name: "Summer Hits 2024",
  playlist_owner: "Spotify",
  track_count: 50,
  image_url: "https://...",
  last_accessed_at: timestamp,            // When user last imported/viewed
  access_count: 3                         // How many times user accessed it
}
```

**Purpose:** User's recent playlist history for quick re-linking without re-pasting URLs.
Never deleted even after unlinking from collections.

### Collection: `songs_v3`

```javascript
{
  id: "auto-generated-id",                // Document ID
  collection_id: "collection-doc-id",     // Parent collection

  // Spotify metadata
  spotify_track_id: "3n3Ppam7vgaVa1iaRUc9Lp",
  spotify_uri: "spotify:track:...",
  title: "Mr. Brightside",
  artist: "The Killers",
  album: "Hot Fuss",
  album_art_url: "https://...",
  duration_ms: 222000,
  isrc: "USIR20400274",                   // For cross-platform matching

  // Lyrics (from Genius)
  lyrics: "Coming out of my cage...",     // Full text with sections
  lyrics_source: "genius",
  lyrics_fetched_at: timestamp,

  // User customizations
  custom_sections: [                      // User-defined section markers
    { line: 0, label: "[Intro]" },
    { line: 5, label: "[Verse 1]" }
  ],

  // Practice notes
  notes: [
    {
      id: "note-1",
      line_start: 5,
      line_end: 8,
      section_label: "[Verse 1]",
      content: "Watch for key change here!",
      color: "#ff6b6b",                   // For visual relationship
      created_at: timestamp,
      updated_at: timestamp
    }
  ],

  // Song metadata
  bpm: 148,
  key: "D major",
  chords: [                               // Chord progression
    { position: "intro", chord: "D" },
    { position: "verse", chord: "G" },
    { position: "verse", chord: "Bm" },
    { position: "chorus", chord: "A" }
  ],

  created_at: timestamp,
  updated_at: timestamp
}
```

### Collection: `spotify_tokens_v3`

```javascript
{
  uid: "firebase-uid",                    // Document ID
  access_token: "encrypted-token",        // Encrypted at rest
  refresh_token: "encrypted-token",
  expires_at: timestamp,
  scope: ["streaming", "user-read-private", ...],
  created_at: timestamp,
  updated_at: timestamp
}
```

---

## 🎨 CSS Architecture (Reusable Base Classes)

### Design System

```css
/* Color palette - CSS variables */
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #2a2a2a;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --text-muted: #707070;
  --accent-primary: #1db954; /* Spotify green */
  --accent-secondary: #1ed760;
  --border: #333333;
  --error: #ff4444;
  --warning: #ffa500;
  --success: #1db954;

  /* Note colors for lyric-note relationship */
  --note-color-1: #ff6b6b;
  --note-color-2: #4ecdc4;
  --note-color-3: #45b7d1;
  --note-color-4: #f9ca24;
  --note-color-5: #a29bfe;

  /* Image/artwork styles */
  --border-radius-sm: 4px; /* Small elements */
  --border-radius-md: 8px; /* Cards, images */
  --border-radius-lg: 12px; /* Large elements */
  --border-radius-circle: 50%; /* User avatars */
}

/* Base classes (reusable) */
.btn {
  /* base button */
}
.btn-primary {
  /* accent colored */
}
.btn-secondary {
  /* subtle */
}
.card {
  /* base card container */
}
.input {
  /* base input field */
}
.modal {
  /* base modal */
}
.list-item {
  /* base list item */
}

/* Image/Artwork components */
.album-art {
  /* square album artwork */
}
.album-art-sm {
  /* 48x48 */
}
.album-art-md {
  /* 120x120 */
}
.album-art-lg {
  /* 240x240 */
}
.user-avatar {
  /* circular user photo */
}
.user-avatar-sm {
  /* 32x32 */
}
.user-avatar-md {
  /* 64x64 */
}
.playlist-icon {
  /* playlist artwork */
}
.collection-icon {
  /* collection artwork */
}

/* Layout classes */
.container {
  /* max-width wrapper */
}
.flex-row {
  /* flex row */
}
.flex-col {
  /* flex column */
}
.grid-2 {
  /* 2-column grid */
}
.grid-3 {
  /* 3-column grid */
}

/* Typography */
.text-lg {
  /* large text */
}
.text-md {
  /* medium text */
}
.text-sm {
  /* small text */
}
.text-muted {
  /* muted color */
}

/* Spacing (consistent) */
.p-1 {
  padding: 0.5rem;
}
.p-2 {
  padding: 1rem;
}
.m-1 {
  margin: 0.5rem;
}
/* etc. */
```

---

## 🚀 Build Plan - 8 Phases

### **PHASE 0: Project Setup & Infrastructure** ✅ START HERE

**Goal:** Set up clean project structure, PWA basics (fullscreen mode), and Firebase connection

**Tasks:**

1. Create `/webapp_v3/` directory structure
2. Set up Flask app skeleton (`app.py`)
3. Create PWA manifest with `"display": "fullscreen"` for TV screens
4. Create service worker for offline support
5. Set up Firebase configuration (reuse v2 credentials)
6. Create base HTML template with PWA meta tags
7. Set up CSS architecture (variables + base classes + image/artwork styles)
8. Create development environment (`run-local-v3.bat`)
9. Update Terraform for v3 Firestore collections

**Deliverable:** Empty app that loads, shows "BPPv3 Coming Soon", installable as PWA

**Testing:**

- Load locally on `localhost:8080`
- Install as PWA
- Verify Firebase connection

---

### **PHASE 1: Authentication Gate**

**Goal:** Users can log in with Google, stored in `users_v3`

**Tasks:**

1. Create auth gate UI (Firebase UI or custom - dark, classy design)
2. Implement Google OAuth flow
3. Retrieve user photo from Google profile
4. Create `auth_service_v3.py` (token verification)
5. Create `user_service_v3.py` (user CRUD)
6. Store user in `users_v3` collection on first login
7. Create session management (JWT or Firebase session)
8. Redirect to HOME view after successful auth

**Deliverable:** Functional login → HOME screen

**Testing:**

- Login with Google
- Verify user created in `users_v3`
- Logout and re-login
- Check session persistence

---

### **PHASE 2: HOME View - Collections Management**

**Goal:** Users can create, view, and manage collections

**Tasks:**

1. Create HOME view HTML template
2. Implement collections list UI (owned + shared sections)
3. Show collection cards with icon/artwork (first album art or default)
4. Create `collections_service_v3.py`
5. API endpoints:
   - `GET /api/v3/collections` (list user's collections)
   - `POST /api/v3/collections` (create new)
   - `PUT /api/v3/collections/:id` (update)
   - `DELETE /api/v3/collections/:id` (delete)
6. Create collection card component (CSS)
7. Implement "New Collection" modal
8. Implement collection settings modal (name, description, visibility)
9. Keyboard navigation for collections list
   - Arrow keys to navigate
   - Enter to open
   - 'n' to create new

**Deliverable:** Functional collections management

**Testing:**

- Create new collection
- Edit collection details
- Delete collection
- Keyboard navigation works

---

### **PHASE 3: Spotify Playlist Import**

**Goal:** Users can paste Spotify playlist URL, songs imported

**Tasks:**

1. Create `spotify_service_v3.py`
2. Implement Client Credentials flow (backend)
3. API endpoint: `POST /api/v3/playlists/import` (paste URL)
4. Parse Spotify playlist ID from URL
5. Fetch playlist tracks via Spotify API
6. Save playlist to user's `playlist_memory_v3` (for recent history)
7. Create songs in `songs_v3` with `source_playlist_ids` tracking (metadata only, no lyrics yet)
8. Add playlist metadata to collection's `linked_playlists` array (embedded)
9. UI: "Link Playlist" button in collection settings
10. Show import progress (loading indicator)

**Deliverable:** Playlist import working, songs appear in collection with proper deduplication

**Testing:**

- Paste public Spotify playlist URL
- Verify playlist stored in `playlists_v3`
- Verify songs created in `songs_v3`
- Check collection → playlist → songs relationship

---

### **PHASE 4: Background Lyrics Fetching**

**Goal:** Lyrics automatically fetched for all songs in background

**Tasks:**

1. Create `lyrics_service_v3.py` (reuse v2 logic if useful)
2. API endpoint: `POST /api/v3/songs/:id/fetch-lyrics`
3. Background job: Fetch lyrics for all songs without lyrics
4. Store lyrics in `songs_v3.lyrics`
5. Parse section headers from Genius (`[Verse]`, `[Chorus]`, etc.)
6. Store custom sections in `songs_v3.custom_sections`
7. Handle errors (lyrics not found)
8. UI: Show lyrics status indicator on songs

**Deliverable:** Lyrics auto-fetch working

**Testing:**

- Import playlist
- Wait for lyrics to fetch
- Verify lyrics stored in Firestore
- Check section parsing accuracy

---

### **PHASE 5: SONGS View - Song Chooser**

**Goal:** Full-screen song list with keyboard navigation and filtering

**Tasks:**

1. Create SONGS view HTML template
2. Display all songs in current collection
3. Show: album art, title, artist, lyrics status
4. Implement instant search filter (type to filter)
5. Keyboard navigation:
   - Up/Down arrows
   - Page Up/Down
   - Home/End
   - Enter to open song in PLAYER
   - Esc to return to HOME
6. Create song list item component (CSS)
7. API endpoint: `GET /api/v3/collections/:id/songs`
8. Order songs by playlist order (hierarchy)
9. Visual indicator for current selection

**Deliverable:** Functional song chooser with keyboard nav

**Testing:**

- Open collection → songs view
- Type to filter songs
- Navigate with keyboard
- Enter to open song (stub for now)

---

### **PHASE 6: Spotify Web Playback SDK Integration**

**Goal:** Users can connect Spotify Premium, play music

**Tasks:**

1. Create `spotify_auth_service_v3.py`
2. Implement user OAuth flow (popup window)
3. API endpoints:
   - `GET /api/v3/spotify/auth-url` (get OAuth URL)
   - `POST /api/v3/spotify/callback` (handle callback)
   - `GET /api/v3/spotify/token` (get user's token)
4. Store tokens in `spotify_tokens_v3` (encrypted)
5. Frontend: Load Spotify Web Playback SDK
6. Create `spotifyPlayer.js` module
7. Initialize player on app load (if user has token)
8. Handle "Connect Spotify Premium" flow
9. Store user preference in `users_v3.spotify_connected`
10. Handle token refresh

**Deliverable:** Spotify authentication working, SDK initialized

**Testing:**

- Click "Connect Spotify Premium"
- Authenticate via popup
- Verify token stored in Firestore
- Check SDK initializes successfully

---

### **PHASE 7: PLAYER View - Lyrics & Notes (No Music Yet)**

**Goal:** Full-screen lyrics display with practice notes

**Tasks:**

1. Create PLAYER view HTML template
2. Display song metadata (title, artist, album art, key, BPM)
3. Render lyrics with line numbers
4. Implement 1/2/3 column layout toggle ('c' key)
5. Auto-fit font size to viewport
6. Render practice notes with color coding
7. Visual relationship: note color → lyric section background
8. Keyboard navigation through notes (Tab / Shift+Tab)
9. Implement edit mode for lyrics ('e' key)
10. Implement edit mode for notes ('n' key)
11. Save edits: API `PUT /api/v3/songs/:id`
12. Keyboard shortcuts in PLAYER view:
    - 'c' = toggle columns
    - 'e' = edit lyrics
    - 'n' = edit notes
    - Esc = cancel / close player / return to SONGS view
13. Keyboard shortcuts in PLAYER view:
    - Section heading insertion like v2 (ALT+C ALT+V ALT+B ALT+I ALT+O etc)
    - Tighten function (remove empty lines ALT+T)
    - Ctrl+Enter = save

**Deliverable:** Full lyrics + notes editing, no music

**Testing:**

- Open song in player
- Verify lyrics render correctly
- Toggle column modes
- Edit lyrics and save
- Add practice note
- Verify note-to-lyric color relationship

---

### **PHASE 8: PLAYER View - Music Playback**

**Goal:** Spotify playback integrated with full keyboard control

**Tasks:**

1. Integrate Spotify Web Playback SDK into PLAYER
2. Load track when song opens
3. Create playback controls UI (compact)
4. Implement playback controls:
   - Play/Pause (Space)
   - Restart ('r' key)
   - Skip +10s (→ arrow)
   - Skip -10s (← arrow)
   - Next song (Ctrl+Space or 'n')
   - Previous song ('p')
5. Display playback progress bar
6. Display current time / duration
7. BPM indicator (manual entry)
8. BPM flasher toggle ('i' key)
9. Sync BPM flasher to beat (if possible)
10. Handle playback errors gracefully
11. Auto-advance to next song (optional)

**Deliverable:** Complete PLAYER with music + lyrics + notes

**Testing:**

- Open song in player
- Music plays automatically
- Test all keyboard shortcuts
- Skip forward/backward 10s
- Restart song
- Navigate to next/previous song
- BPM flasher works

---

## 📋 Additional Features (Post-MVP)

### **PHASE 9: Collection Sharing & Collaboration**

- Public collections (read-only)
- Collaboration requests (with email notifications)
- Accept/deny requests
- Email notifications for collaboration requests
- Real-time sync for collaborators
- Notification preferences in user settings

### **PHASE 10: Advanced Features**

- Playlist re-sync (update songs from Spotify)
- Bulk song operations (delete, move)
- Export collection (JSON/CSV)
- Song versioning (track lyric changes)
- Search across all collections
- Recently played songs
- Favorites/bookmarks

### **PHASE 10.5: Key & Chords Display**

**Goal:** Show song key and chord diagrams in PLAYER view

**Features:**

- Display song key (e.g., "D major") in song metadata
- Toggle chord display with keyboard shortcut (e.g., 'k' key)
- Show chord progression with visual guitar chord diagrams
- Chord diagrams appear as overlay (doesn't disrupt lyrics)
- Similar to HELP card - toggles on/off
- Chords linked to song sections (Intro, Verse, Chorus, etc.)
- Manual chord entry/editing in edit mode
- Chord library with common chord fingerings
- Visual representation: small chord diagram images

**Implementation Notes:**

- Use chord diagram images or SVG library
- Store chord progression in `songs_v3.chords` array
- Keyboard shortcut 'k' to toggle chord overlay
- Chord diagrams positioned above lyrics or in sidebar
- No space consumed when hidden (default)

### **PHASE 11: Mobile Optimization**

- Responsive design for tablets
- Touch gestures
- Simplified UI for small screens
- Toggle lyric/note view on small screens

### **PHASE 12: Firestore Security Rules**

- Write comprehensive security rules
- Prevent unauthorized access
- Validate data writes
- Prevent privilege escalation (is_admin tampering)

---

## 🛠️ Technical Decisions

### File Structure

```
webapp_v3/
├── app.py                          # Main Flask app
├── requirements.txt                # Python dependencies
├── run-local-v3.bat               # Local dev script
│
├── services/                       # Business logic
│   ├── auth_service_v3.py
│   ├── user_service_v3.py
│   ├── collections_service_v3.py
│   ├── songs_service_v3.py
│   ├── playlists_service_v3.py
│   ├── spotify_service_v3.py
│   ├── spotify_auth_service_v3.py
│   ├── lyrics_service_v3.py
│   └── firestore_service_v3.py
│
├── templates/
│   ├── base.html                   # Base template with PWA
│   ├── auth.html                   # Auth gate
│   ├── home.html                   # Collections view
│   ├── songs.html                  # Song chooser
│   └── player.html                 # Player view
│
├── static/
│   ├── manifest.json               # PWA manifest
│   ├── service-worker.js           # PWA service worker
│   │
│   ├── css/
│   │   ├── variables.css           # CSS variables
│   │   ├── base.css               # Base classes
│   │   ├── components.css         # Reusable components
│   │   ├── auth.css               # Auth gate styles
│   │   ├── home.css               # HOME view styles
│   │   ├── songs.css              # SONGS view styles
│   │   └── player.css             # PLAYER view styles
│   │
│   ├── js/
│   │   ├── app.js                 # Main app logic
│   │   ├── auth.js                # Auth handling
│   │   ├── collections.js         # Collections logic
│   │   ├── songs.js               # Song chooser logic
│   │   ├── player.js              # Player logic
│   │   ├── spotifyPlayer.js       # Spotify SDK wrapper
│   │   ├── keyboard.js            # Keyboard shortcuts
│   │   └── api.js                 # API client
│   │
│   ├── images/
│   │   ├── icon-192.png           # PWA icon
│   │   ├── icon-512.png           # PWA icon
│   │   └── logo.png
│   │
│   └── fonts/
│       └── (if custom fonts needed)
│
└── utils/
    ├── encryption.py              # Token encryption
    └── validators.py              # Input validation
```

### Key Technologies

- **Backend:** Flask 3.x, Python 3.11
- **Frontend:** Vanilla JavaScript (no frameworks)
- **Database:** Google Firestore (v3 collections)
- **Auth:** Firebase Authentication (Google OAuth)
- **Music:** Spotify Web Playback SDK
- **Lyrics:** Genius API
- **Deployment:** Google Cloud Run (Docker)
- **IaC:** Terraform (updated for v3)

### Development Workflow

1. Build phase locally
2. Test thoroughly
3. Commit to feature branch
4. Deploy Terraform updates (if needed)
5. Test in production-like environment
6. Merge to main
7. Auto-deploy via GitHub Actions

---

## 🧪 Testing Strategy (Per Phase)

### Manual Testing Checklist

Each phase includes:

- [ ] Feature works as expected
- [ ] Keyboard shortcuts functional
- [ ] Data persists to Firestore
- [ ] Errors handled gracefully
- [ ] Mobile responsive (basic)
- [ ] Console has no errors

### Integration Testing

After each phase:

- [ ] Previous features still work
- [ ] Navigation flow works end-to-end
- [ ] Data relationships intact

---

## 📈 Success Metrics

### Phase Completion Criteria

- ✅ All tasks in phase completed
- ✅ Manual testing passed
- ✅ No blocking bugs
- ✅ Code committed to git

### MVP Definition (Phase 8 Complete)

- ✅ Users can login with Google
- ✅ Users can create collections
- ✅ Users can import Spotify playlists
- ✅ Lyrics auto-fetch
- ✅ Full song player with music + lyrics + notes
- ✅ Keyboard navigation throughout
- ✅ No 25-user Spotify limit
- ✅ Installable as PWA

---

## 🚦 Getting Started

### Immediate Next Steps

1. **Review this plan** - Does this align with your vision?
2. **Begin Phase 0** - Set up project structure
3. **Deploy Firestore collections** - Update Terraform
4. **Test locally** - Ensure Firebase connection works
5. **Proceed incrementally** - One phase at a time

### Estimated Timeline (Rough)

- Phase 0: 2-3 hours
- Phase 1: 3-4 hours
- Phase 2: 4-5 hours
- Phase 3: 3-4 hours
- Phase 4: 2-3 hours
- Phase 5: 4-5 hours
- Phase 6: 5-6 hours (most complex)
- Phase 7: 6-8 hours
- Phase 8: 4-5 hours

**Total MVP:** ~35-45 hours of development

---

## 🎯 Key Improvements Over v2

| Aspect             | v2                 | v3                          |
| ------------------ | ------------------ | --------------------------- |
| Spotify Auth       | ❌ 25-user limit   | ✅ Unlimited (user OAuth)   |
| CSS Architecture   | ❌ Hacked together | ✅ Reusable base classes    |
| Mobile UX          | ❌ Barely usable   | ✅ Responsive (basic)       |
| PWA Support        | ❌ No              | ✅ Yes (installable)        |
| Collections UI     | ⚠️ Confusing       | ✅ Intuitive HOME view      |
| Note Visualization | ⚠️ Not obvious     | ✅ Color-coded relationship |
| Code Quality       | ⚠️ Messy           | ✅ Clean, organized         |
| Database Security  | ⚠️ Unknown         | ✅ Proper security rules    |

---

## 🤝 Ready to Build?

**Shall we start with Phase 0?** I can:

1. Create the `/webapp_v3/` directory structure
2. Set up Flask app skeleton
3. Create PWA manifest and service worker
4. Build base HTML template with CSS architecture
5. Create development script
6. Generate Terraform updates for v3 collections

Just say the word and we'll get building! 🎸
