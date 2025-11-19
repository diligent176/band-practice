# Phase 6+7: PLAYER View (3rd View in SPA)

## Overview

Build the **PLAYER view** as the **third and final view** in the Band Practice Pro v3 SPA. This completes the app's core functionality: Collections → Songs → **Player**.

**Key Architecture Principle**: This is a **SPA**. No page reloads. Instant view switching. Fast keyboard navigation.

---

## Current Architecture (What's Already Built)

### ✅ Existing Files

```
webapp_v3/
├── templates/
│   └── home.html                    # Single HTML file with 3 views
├── static/
│   ├── js/
│   │   ├── common.js                # Reusable utilities (BPP namespace)
│   │   └── viewManager.js           # View switching logic
│   └── css/
│       ├── base.css                 # Base styles
│       ├── home.css                 # Collections view styles
│       └── songs.css                # Songs view styles
```

### ✅ Existing Views (1 & 2)

1. **Collections View** (`#collections-view`) - Grid of collections
2. **Songs View** (`#songs-view`) - Grid of songs in collection

### ✅ Existing Utilities (common.js)

- `BPP.showDialog()` / `BPP.hideDialog()`
- `BPP.apiCall()` - Authenticated API calls
- `BPP.showToast()` - Toast notifications
- `BPP.showLoading()` / `BPP.hideLoading()`
- `BPP.debounce()` / `BPP.throttle()`
- `BPP.handleKeyboard()` - Keyboard shortcut handler

### ✅ Existing ViewManager (viewManager.js)

- `ViewManager.showView(viewName)` - Instant view switching
- `ViewManager.openCollection(collectionId)` - Load and show songs
- Keyboard navigation for Songs view
- State management (`currentCollection`, `allSongs`, `filteredSongs`)

---

## What We're Building (View #3)

### Player View Components

```
┌─────────────────────────────────────────────────────────────┐
│ PLAYER TOP NAV (Fixed at top)                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Album Art] Song Title - Artist                         │ │
│ │ BPM: 120 [⚫ Flasher]                                    │ │
│ │ [<< Prev (B)] [▶ Play (Space)] [Next >> (F)]           │ │
│ │ [━━━━━━━━━━━━━━━━━━━━━] 2:34 / 3:45                     │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ MAIN CONTENT (Lyrics + Notes, side-by-side)                │
│ ┌────────────────────────┬──────────────────────────────┐  │
│ │ LYRICS (70%)           │ NOTES (30%)                  │  │
│ │ [3 columns by default] │ [Color-coded cards]          │  │
│ │                        │                              │  │
│ │ 1. Lyric line...       │ ▸ Note 1 (Lines 5-8)        │  │
│ │ 2. Lyric line...       │   [Color: #ff6b6b]           │  │
│ │ 3. Highlighted line    │   "Watch for key change"     │  │
│ │ 4. Highlighted line    │                              │  │
│ │                        │ ▸ Note 2 (Lines 12-15)      │  │
│ │ [Verse 1]              │   [Color: #4ecdc4]           │  │
│ │ 5. Lyric line...       │   "Drums enter"              │  │
│ │                        │                              │  │
│ │                        │ [+ Add Note (N)]             │  │
│ └────────────────────────┴──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

KEYBOARD SHORTCUTS:
X = Back to Collections
S = Back to Songs
B = Previous song
F = Next song
Space = Play/Pause
T = Restart track
M = Mute
← → = Skip -5s / +5s
C = Toggle columns (1/2/3)
Alt+Up/Down = Font size
E = Edit lyrics
N = Edit notes
I = Toggle BPM indicator
. = BPM tap trainer
? = Help
```

---

## Implementation Plan

### **STEP 1: Add Player View HTML** ✅

**Goal:** Add `<div id="player-view">` to [home.html](c:\github\band-practice\webapp_v3\templates\home.html)

**Tasks:**

1. Add Player View container after Songs View (before closing `#main-app`):
   ```html
   <!-- PLAYER VIEW -->
   <div id="player-view" class="view">
       <!-- Player Top Nav -->
       <div class="player-top-nav">
           <!-- Song metadata, playback controls -->
       </div>

       <!-- Player Main Content -->
       <div class="player-main">
           <!-- Lyrics Panel (70%) -->
           <div class="player-lyrics-panel">
               <!-- Lyrics with line numbers -->
           </div>

           <!-- Notes Panel (30%) -->
           <div class="player-notes-panel">
               <!-- Notes cards -->
           </div>
       </div>
   </div>
   ```

2. Structure of Player Top Nav:
   - Album art (48x48)
   - Song title + artist
   - BPM display + flasher icon
   - Prev/Play/Next buttons
   - Progress bar
   - Current time / Duration

3. Structure of Player Main:
   - Lyrics panel (scrollable, multi-column CSS grid)
   - Notes panel (scrollable, cards with colors)

**Testing:**
- View should be hidden by default (no `.active` class)
- CSS class `.view` handles display toggling

---

### **STEP 2: Add Player CSS** ✅

**Goal:** Create `player.css` with all player-specific styles

**Tasks:**

1. Create `webapp_v3/static/css/player.css`

2. Key CSS components:
   ```css
   .player-top-nav {
       position: fixed;
       top: 0;
       left: 0;
       right: 0;
       height: 80px;
       background: var(--bg-secondary);
       border-bottom: 1px solid var(--border);
       z-index: 100;
       display: flex;
       align-items: center;
       padding: 0 1rem;
       gap: 1rem;
   }

   .player-main {
       margin-top: 80px; /* Height of top nav */
       display: flex;
       height: calc(100vh - 80px);
   }

   .player-lyrics-panel {
       flex: 0 0 70%;
       overflow-y: auto;
       padding: 2rem;
   }

   .player-notes-panel {
       flex: 0 0 30%;
       overflow-y: auto;
       padding: 1rem;
       border-left: 1px solid var(--border);
   }

   /* Lyrics columns (1/2/3) */
   .lyrics-columns-1 { columns: 1; }
   .lyrics-columns-2 { columns: 2; column-gap: 2rem; }
   .lyrics-columns-3 { columns: 3; column-gap: 1.5rem; }

   /* Note colors (5 colors, cycle through) */
   .note-card-1 { border-left: 3px solid var(--note-color-1); }
   .note-card-2 { border-left: 3px solid var(--note-color-2); }
   .note-card-3 { border-left: 3px solid var(--note-color-3); }
   .note-card-4 { border-left: 3px solid var(--note-color-4); }
   .note-card-5 { border-left: 3px solid var(--note-color-5); }

   /* BPM flasher animation */
   @keyframes bpm-pulse {
       0%, 100% { opacity: 1; transform: scale(1); }
       50% { opacity: 0.5; transform: scale(0.9); }
   }
   .bpm-flasher.active {
       animation: bpm-pulse 0.5s ease-in-out;
   }
   ```

3. Add CSS variables for note colors in `base.css`:
   ```css
   :root {
       --note-color-1: #ff6b6b;
       --note-color-2: #4ecdc4;
       --note-color-3: #45b7d1;
       --note-color-4: #f9ca24;
       --note-color-5: #a29bfe;
   }
   ```

4. Link CSS in home.html:
   ```html
   <link rel="stylesheet" href="{{ url_for('static', filename='css/player.css') }}">
   ```

**Testing:**
- Styles load correctly
- Layout is responsive
- Columns toggle smoothly

---

### **STEP 3: Update ViewManager for Player** ✅

**Goal:** Extend `viewManager.js` to support player view

**Tasks:**

1. Add player view to `ViewManager.views`:
   ```javascript
   views: {
       collections: null,
       songs: null,
       player: null  // NEW
   }
   ```

2. Cache player view element in `init()`:
   ```javascript
   this.views.player = document.getElementById('player-view');
   ```

3. Update `openSong()` method (currently shows toast):
   ```javascript
   openSong(index) {
       if (index < 0 || index >= this.state.filteredSongs.length) return;

       const song = this.state.filteredSongs[index];
       this.state.currentSong = song;

       // Load player view
       PlayerManager.loadSong(song);
       this.showView('player');
   }
   ```

4. Add player state to `ViewManager.state`:
   ```javascript
   state: {
       currentCollection: null,
       allSongs: [],
       filteredSongs: [],
       selectedSongIndex: -1,
       sortMode: localStorage.getItem('v3_songsSortMode') || 'title',
       currentSong: null  // NEW
   }
   ```

**Testing:**
- Pressing Enter on a song switches to player view
- Player view renders (even if empty initially)

---

### **STEP 4: Create PlayerManager Module** ✅

**Goal:** Create `player.js` to handle player logic

**Tasks:**

1. Create `webapp_v3/static/js/player.js`:
   ```javascript
   const PlayerManager = {
       currentSong: null,
       columnMode: 2, // Default: 2 columns
       fontSize: 1.0, // Default: 1.0x scale
       bpmIndicatorEnabled: true,

       init() {
           this.setupEventListeners();
           console.log('✅ PlayerManager initialized');
       },

       setupEventListeners() {
           // Back button
           document.getElementById('player-back-btn')?.addEventListener('click', () => {
               ViewManager.showView('songs');
           });

           // Playback controls
           document.getElementById('player-play-btn')?.addEventListener('click', () => {
               this.togglePlayback();
           });

           // Column toggle
           document.getElementById('player-toggle-columns')?.addEventListener('click', () => {
               this.toggleColumns();
           });

           // Font size controls
           document.getElementById('player-font-increase')?.addEventListener('click', () => {
               this.adjustFontSize(0.1);
           });
           document.getElementById('player-font-decrease')?.addEventListener('click', () => {
               this.adjustFontSize(-0.1);
           });
       },

       async loadSong(song) {
           this.currentSong = song;
           console.log('🎵 Loading song:', song.title);

           // Update top nav metadata
           this.renderTopNav();

           // Render lyrics
           this.renderLyrics();

           // Render notes
           this.renderNotes();

           // Load Spotify preview (if available)
           this.loadSpotifyPreview();
       },

       renderTopNav() {
           // Update album art, title, artist, BPM
           document.getElementById('player-album-art').src = this.currentSong.album_art_url || '/static/favicon.svg';
           document.getElementById('player-song-title').textContent = this.currentSong.title;
           document.getElementById('player-artist').textContent = this.currentSong.artist;
           document.getElementById('player-bpm').textContent = this.currentSong.bpm ? `BPM: ${this.currentSong.bpm}` : 'BPM: --';
       },

       renderLyrics() {
           const lyricsPanel = document.querySelector('.player-lyrics-panel');
           const lyrics = this.currentSong.lyrics || 'No lyrics available';

           // Split into lines, add line numbers
           const lines = lyrics.split('\n');
           const html = lines.map((line, index) => {
               const lineNum = index + 1;
               const isSection = line.trim().match(/^\[.*\]$/);
               return `<div class="lyric-line ${isSection ? 'section-header' : ''}" data-line="${lineNum}">
                   <span class="line-number">${lineNum}</span>
                   <span class="line-text">${this.escapeHtml(line)}</span>
               </div>`;
           }).join('');

           lyricsPanel.innerHTML = html;
           this.applyColumnMode();
       },

       renderNotes() {
           const notesPanel = document.querySelector('.player-notes-panel');
           const notes = this.currentSong.notes || [];

           if (notes.length === 0) {
               notesPanel.innerHTML = '<div class="empty-state"><p>No notes yet. Press N to add notes.</p></div>';
               return;
           }

           const html = notes.map((note, index) => {
               const colorClass = `note-card-${(index % 5) + 1}`;
               return `<div class="note-card ${colorClass}" data-note-index="${index}">
                   <div class="note-header">
                       <span class="note-line-range">Lines ${note.line_start}-${note.line_end}</span>
                   </div>
                   <div class="note-content">${this.escapeHtml(note.content)}</div>
               </div>`;
           }).join('');

           notesPanel.innerHTML = html + '<button class="btn btn-ghost" onclick="PlayerManager.addNote()">+ Add Note</button>';
       },

       toggleColumns() {
           // Cycle: 2 → 3 → 1 → 2
           this.columnMode = this.columnMode === 2 ? 3 : (this.columnMode === 3 ? 1 : 2);
           this.applyColumnMode();
           BPP.showToast(`Columns: ${this.columnMode}`, 'info');
           localStorage.setItem('v3_playerColumnMode', this.columnMode);
       },

       applyColumnMode() {
           const lyricsPanel = document.querySelector('.player-lyrics-panel');
           lyricsPanel.className = 'player-lyrics-panel';
           lyricsPanel.classList.add(`lyrics-columns-${this.columnMode}`);
       },

       adjustFontSize(delta) {
           this.fontSize = Math.max(0.5, Math.min(2.5, this.fontSize + delta));
           document.querySelector('.player-lyrics-panel').style.fontSize = `${this.fontSize}rem`;
           localStorage.setItem('v3_playerFontSize', this.fontSize);
       },

       togglePlayback() {
           // TODO: Implement Spotify playback
           BPP.showToast('Playback coming soon', 'info');
       },

       escapeHtml(text) {
           const div = document.createElement('div');
           div.textContent = text;
           return div.innerHTML;
       }
   };

   // Initialize when DOM ready
   if (document.readyState === 'loading') {
       document.addEventListener('DOMContentLoaded', () => PlayerManager.init());
   } else {
       PlayerManager.init();
   }

   window.PlayerManager = PlayerManager;
   ```

2. Load `player.js` in home.html:
   ```html
   <script src="{{ url_for('static', filename='js/player.js') }}"></script>
   ```

**Testing:**
- Open a song → player view loads
- Song metadata renders in top nav
- Lyrics render with line numbers
- Notes render (if any)

---

### **STEP 5: Player Keyboard Navigation** ✅

**Goal:** Implement ALL keyboard shortcuts for player

**Tasks:**

1. Add keyboard handler to `PlayerManager`:
   ```javascript
   setupKeyboardForView(viewName) {
       // ... existing code ...

       if (viewName === 'player') {
           this.currentKeyboardHandler = (e) => this.handlePlayerKeyboard(e);
           document.addEventListener('keydown', this.currentKeyboardHandler);
       }
   },

   handlePlayerKeyboard(e) {
       const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

       // NEVER block these (work even when typing)
       if (e.altKey && e.key === 'Enter') {
           e.preventDefault();
           this.toggleFullscreen();
           return;
       }
       if (e.altKey && e.key === 'ArrowUp') {
           e.preventDefault();
           PlayerManager.adjustFontSize(0.1);
           return;
       }
       if (e.altKey && e.key === 'ArrowDown') {
           e.preventDefault();
           PlayerManager.adjustFontSize(-0.1);
           return;
       }

       // Don't handle if typing (except specific keys)
       if (isTyping) return;

       const handlers = {
           'x': () => ViewManager.showView('collections'),
           's': () => ViewManager.showView('songs'),
           'b': () => PlayerManager.previousSong(),
           'f': () => PlayerManager.nextSong(),
           ' ': () => PlayerManager.togglePlayback(),
           't': () => PlayerManager.restartTrack(),
           'm': () => PlayerManager.toggleMute(),
           'arrowleft': () => PlayerManager.skipBackward(5),
           'arrowright': () => PlayerManager.skipForward(5),
           'c': () => PlayerManager.toggleColumns(),
           'e': () => PlayerManager.editLyrics(),
           'n': () => PlayerManager.editNotes(),
           'i': () => PlayerManager.toggleBpmIndicator(),
           '.': () => PlayerManager.openBpmTapTrainer(),
           '?': () => this.togglePlayerHelpCard(),
           'escape': () => ViewManager.showView('songs')
       };

       BPP.handleKeyboard(e, handlers);
   }
   ```

2. Implement navigation methods:
   ```javascript
   previousSong() {
       const allSongs = ViewManager.state.allSongs;
       const currentIndex = allSongs.findIndex(s => s.id === this.currentSong.id);
       if (currentIndex > 0) {
           const prevSong = allSongs[currentIndex - 1];
           this.loadSong(prevSong);
           BPP.showToast(`◀ ${prevSong.title}`, 'info');
       } else {
           BPP.showToast('Already at first song', 'info');
       }
   },

   nextSong() {
       const allSongs = ViewManager.state.allSongs;
       const currentIndex = allSongs.findIndex(s => s.id === this.currentSong.id);
       if (currentIndex < allSongs.length - 1) {
           const nextSong = allSongs[currentIndex + 1];
           this.loadSong(nextSong);
           BPP.showToast(`${nextSong.title} ▶`, 'info');
       } else {
           BPP.showToast('Already at last song', 'info');
       }
   }
   ```

**Testing:**
- All keyboard shortcuts work
- X returns to collections
- S returns to songs
- B/F navigate prev/next song
- C toggles columns
- Alt+Up/Down adjusts font
- Esc returns to songs

---

### **STEP 6: Edit Lyrics Dialog** ✅

**Goal:** Allow users to edit lyrics with `e` key

**Tasks:**

1. Add lyrics editor dialog to home.html:
   ```html
   <!-- Edit Lyrics Dialog -->
   <div id="edit-lyrics-dialog" class="dialog-overlay hidden">
       <div class="dialog dialog-large">
           <div class="dialog-header">
               <h3 class="dialog-title">Edit Lyrics</h3>
               <button class="dialog-close" onclick="BPP.hideDialog('edit-lyrics-dialog')">✕</button>
           </div>
           <div class="dialog-body">
               <textarea id="lyrics-editor" class="lyrics-textarea" rows="30"></textarea>
           </div>
           <div class="dialog-footer">
               <button class="btn btn-secondary" onclick="BPP.hideDialog('edit-lyrics-dialog')">Cancel</button>
               <button class="btn btn-primary" onclick="PlayerManager.saveLyrics()">Save</button>
           </div>
       </div>
   </div>
   ```

2. Implement edit methods in PlayerManager:
   ```javascript
   editLyrics() {
       const editor = document.getElementById('lyrics-editor');
       editor.value = this.currentSong.lyrics || '';
       BPP.showDialog('edit-lyrics-dialog');
       editor.focus();
   },

   async saveLyrics() {
       const newLyrics = document.getElementById('lyrics-editor').value;

       try {
           await BPP.apiCall(`/api/v3/songs/${this.currentSong.id}`, {
               method: 'PUT',
               body: JSON.stringify({ lyrics: newLyrics })
           });

           this.currentSong.lyrics = newLyrics;
           this.renderLyrics();
           BPP.hideDialog('edit-lyrics-dialog');
           BPP.showToast('Lyrics updated!', 'success');
       } catch (error) {
           BPP.showToast('Failed to save lyrics', 'error');
       }
   }
   ```

**Testing:**
- Press `e` → dialog opens
- Edit lyrics → Save → lyrics update in player view
- API call works

---

### **STEP 7: Edit Notes Dialog** ✅

**Goal:** Allow users to edit notes with `n` key

**Tasks:**

1. Add notes editor dialog:
   ```html
   <!-- Edit Notes Dialog -->
   <div id="edit-notes-dialog" class="dialog-overlay hidden">
       <div class="dialog dialog-large">
           <div class="dialog-header">
               <h3 class="dialog-title">Edit Practice Notes</h3>
               <button class="dialog-close" onclick="BPP.hideDialog('edit-notes-dialog')">✕</button>
           </div>
           <div class="dialog-body">
               <div class="text-sm text-secondary mb-md">
                   <strong>Note Format:</strong><br>
                   <code>5: Your note here</code><br>
                   <code>10-15: Another note</code><br>
                   <code>START: Note for beginning</code><br>
                   <code>END: Note for ending</code>
               </div>
               <textarea id="notes-editor" class="notes-textarea" rows="20"></textarea>
           </div>
           <div class="dialog-footer">
               <button class="btn btn-secondary" onclick="BPP.hideDialog('edit-notes-dialog')">Cancel</button>
               <button class="btn btn-primary" onclick="PlayerManager.saveNotes()">Save</button>
           </div>
       </div>
   </div>
   ```

2. Implement notes edit/save:
   ```javascript
   editNotes() {
       const notes = this.currentSong.notes || [];
       const text = notes.map(n => {
           const range = n.line_end ? `${n.line_start}-${n.line_end}` : n.line_start;
           return `${range}: ${n.content}`;
       }).join('\n');

       document.getElementById('notes-editor').value = text;
       BPP.showDialog('edit-notes-dialog');
   },

   async saveNotes() {
       const text = document.getElementById('notes-editor').value;
       const notes = this.parseNotes(text);

       try {
           await BPP.apiCall(`/api/v3/songs/${this.currentSong.id}`, {
               method: 'PUT',
               body: JSON.stringify({ notes })
           });

           this.currentSong.notes = notes;
           this.renderNotes();
           BPP.hideDialog('edit-notes-dialog');
           BPP.showToast('Notes updated!', 'success');
       } catch (error) {
           BPP.showToast('Failed to save notes', 'error');
       }
   },

   parseNotes(text) {
       const lines = text.split('\n').filter(l => l.trim());
       return lines.map(line => {
           const match = line.match(/^(\d+|\d+-\d+|START|END):\s*(.+)$/);
           if (!match) return null;

           const [_, range, content] = match;
           let line_start, line_end;

           if (range === 'START') {
               line_start = 1;
               line_end = 1;
           } else if (range === 'END') {
               line_start = 9999;
               line_end = 9999;
           } else if (range.includes('-')) {
               [line_start, line_end] = range.split('-').map(Number);
           } else {
               line_start = line_end = Number(range);
           }

           return { line_start, line_end, content };
       }).filter(Boolean);
   }
   ```

**Testing:**
- Press `n` → notes dialog opens
- Edit notes → Save → notes update
- Note colors are assigned correctly

---

### **STEP 8: BPM Controls** ✅

**Goal:** BPM display, indicator, and editing

**Tasks:**

1. BPM flasher in top nav (HTML):
   ```html
   <div class="bpm-display">
       <span id="player-bpm">BPM: 120</span>
       <button id="bpm-flasher" class="bpm-flasher" title="Toggle BPM indicator (I)">
           <i class="fa-solid fa-circle"></i>
       </button>
   </div>
   ```

2. Toggle BPM indicator:
   ```javascript
   toggleBpmIndicator() {
       this.bpmIndicatorEnabled = !this.bpmIndicatorEnabled;
       if (this.bpmIndicatorEnabled) {
           this.startBpmFlasher();
           BPP.showToast('BPM indicator ON', 'info');
       } else {
           this.stopBpmFlasher();
           BPP.showToast('BPM indicator OFF', 'info');
       }
       localStorage.setItem('v3_bpmIndicatorEnabled', this.bpmIndicatorEnabled);
   },

   startBpmFlasher() {
       if (!this.currentSong.bpm) return;

       const interval = (60 / this.currentSong.bpm) * 1000; // ms per beat
       const flasher = document.getElementById('bpm-flasher');

       this.bpmInterval = setInterval(() => {
           flasher.classList.add('active');
           setTimeout(() => flasher.classList.remove('active'), 100);
       }, interval);
   },

   stopBpmFlasher() {
       if (this.bpmInterval) {
           clearInterval(this.bpmInterval);
           this.bpmInterval = null;
       }
   }
   ```

3. BPM Tap Trainer dialog (add to home.html):
   ```html
   <!-- BPM Tap Trainer Dialog -->
   <div id="bpm-tap-dialog" class="dialog-overlay hidden">
       <div class="dialog">
           <div class="dialog-header">
               <h3 class="dialog-title">BPM Tap Trainer</h3>
               <button class="dialog-close" onclick="BPP.hideDialog('bpm-tap-dialog')">✕</button>
           </div>
           <div class="dialog-body">
               <p class="text-center mb-md">Tap the <kbd>.</kbd> key to the beat</p>
               <div id="bpm-detected" class="bpm-display-large">--</div>
               <p class="text-center text-sm text-muted">Tap at least 4 times</p>
           </div>
           <div class="dialog-footer">
               <button class="btn btn-secondary" onclick="BPP.hideDialog('bpm-tap-dialog')">Cancel</button>
               <button class="btn btn-primary" onclick="PlayerManager.saveBpmFromTap()">Use This BPM</button>
           </div>
       </div>
   </div>
   ```

4. Implement tap trainer logic (see BPPv2 for reference)

**Testing:**
- Press `i` → BPM indicator toggles
- Flasher pulses at correct BPM
- Press `.` → tap trainer opens
- Tap detection works

---

### **STEP 9: Spotify Playback (Optional for MVP)** ⚠️

**Goal:** Integrate Spotify Web Playback SDK (if time allows)

**Note:** This can be deferred to post-MVP. For now, stub out playback methods.

**Tasks:**

1. Add Spotify SDK script to home.html:
   ```html
   <script src="https://sdk.scdn.co/spotify-player.js"></script>
   ```

2. Create `spotifyPlayer.js` (separate module):
   ```javascript
   const SpotifyPlayer = {
       player: null,
       deviceId: null,

       async init(accessToken) {
           window.onSpotifyWebPlaybackSDKReady = () => {
               this.player = new Spotify.Player({
                   name: 'Band Practice Pro',
                   getOAuthToken: cb => cb(accessToken),
                   volume: 1.0
               });

               this.player.connect();
           };
       },

       play(trackUri) {
           // TODO: Play track
       },

       pause() {
           // TODO: Pause
       },

       seek(positionMs) {
           // TODO: Seek to position
       }
   };

   window.SpotifyPlayer = SpotifyPlayer;
   ```

**Testing:**
- Deferred to Phase 8 (Spotify integration)

---

### **STEP 10: Help Card for Player** ✅

**Goal:** Show keyboard shortcuts help with `?` key

**Tasks:**

1. Add help card HTML to player view:
   ```html
   <div class="keyboard-shortcuts-help" id="player-help-toggle">
       <i class="fa-solid fa-circle-question"></i>
       <div class="help-card" id="player-help-card">
           <!-- Similar structure to songs help card -->
           <div class="help-card-header">
               <i class="fa-solid fa-keyboard"></i>
               <span>Keyboard Shortcuts</span>
           </div>
           <div class="help-card-content">
               <!-- Two columns: Navigation & Playback, Editing & View -->
           </div>
       </div>
   </div>
   ```

2. Implement toggle:
   ```javascript
   togglePlayerHelpCard() {
       const helpCard = document.getElementById('player-help-card');
       const visible = helpCard.classList.toggle('visible');
       // Similar to songs help card toggle
   }
   ```

**Testing:**
- Press `?` → help opens
- Press `?` again → help closes
- Click outside → help closes

---

## Summary of Files to Create/Modify

### ✅ Files to Modify

1. **[home.html](c:\github\band-practice\webapp_v3\templates\home.html)**
   - Add `<div id="player-view">` with full structure
   - Add edit lyrics dialog
   - Add edit notes dialog
   - Add BPM tap trainer dialog
   - Link `player.css` and `player.js`

2. **[viewManager.js](c:\github\band-practice\webapp_v3\static\js\viewManager.js)**
   - Add `player` to `views` object
   - Update `openSong()` to call `PlayerManager.loadSong()`
   - Add `handlePlayerKeyboard()` method

### ✅ Files to Create

1. **`webapp_v3/static/css/player.css`** - All player styles
2. **`webapp_v3/static/js/player.js`** - PlayerManager module

---

## Testing Checklist

### Navigation
- [ ] X key → Collections view
- [ ] S key → Songs view
- [ ] Esc → Songs view
- [ ] B key → Previous song
- [ ] F key → Next song
- [ ] Enter on song → Player view

### Lyrics
- [ ] Lyrics render with line numbers
- [ ] Section headers styled distinctly
- [ ] C key → Toggle columns (1/2/3)
- [ ] Alt+Up/Down → Font size
- [ ] E key → Edit lyrics dialog
- [ ] Save lyrics → Updates in player

### Notes
- [ ] Notes render with colors
- [ ] N key → Edit notes dialog
- [ ] Save notes → Updates in player
- [ ] Note colors cycle correctly

### BPM
- [ ] BPM displays in top nav
- [ ] I key → Toggle BPM indicator
- [ ] Flasher pulses at correct rate
- [ ] . key → Tap trainer opens
- [ ] Tap detection works

### Misc
- [ ] ? key → Help card toggles
- [ ] All keyboard shortcuts work
- [ ] No page reloads (SPA)
- [ ] View switching is instant

---

## Next Steps (Post-MVP)

- **Phase 8:** Spotify Web Playback SDK integration
- **Phase 9:** Advanced features (search, bulk ops)
- **Phase 10:** Mobile optimization
- **Phase 11:** Production deployment

---

## Core Principles (NEVER FORGET)

1. ✅ **SPA FIRST** - No page reloads, ever
2. ✅ **FAST & EFFICIENT** - Instant view switching, no waiting
3. ✅ **CODE REUSE** - Use BPP.* utilities, ViewManager patterns
4. ✅ **KEYBOARD-FIRST** - All features accessible via keyboard
5. ✅ **CONSISTENT PATTERNS** - Follow existing code style (Collections/Songs views)

---

**Ready to build?** Let's start with Step 1: Adding Player View HTML to home.html! 🎸
