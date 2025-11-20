/**
 * Band Practice Pro v3 - View Manager
 * Handles instant SPA view switching (no page loads!)
 */

const ViewManager = {
    currentView: 'collections',
    views: {
        collections: null,
        songs: null,
        player: null
    },

    // App state
    state: {
        currentCollection: null,
        currentSong: null,
        allSongs: [],
        filteredSongs: [],
        selectedSongIndex: -1,
        sortMode: localStorage.getItem('v3_songsSortMode') || 'playlist'
    },

    init() {
        // Cache view elements
        this.views.collections = document.getElementById('collections-view');
        this.views.songs = document.getElementById('songs-view');
        this.views.player = document.getElementById('player-view');

        // Set up event listeners
        this.setupEventListeners();

        console.log('✅ ViewManager initialized');
    },

    setupEventListeners() {
        // Songs view back button
        const songsBackBtn = document.getElementById('songs-back-btn');
        if (songsBackBtn) {
            songsBackBtn.addEventListener('click', () => this.showView('collections'));
        }

        // Song search with debounce
        const songSearch = document.getElementById('song-search');
        if (songSearch) {
            let searchDebounce;
            songSearch.addEventListener('input', () => {
                clearTimeout(searchDebounce);
                searchDebounce = setTimeout(() => this.filterSongs(), 150);
            });
        }

        // Sort indicator click
        const sortIndicator = document.getElementById('sort-indicator');
        if (sortIndicator) {
            sortIndicator.addEventListener('click', () => this.toggleSortMode());
        }

        // Songs help card
        this.setupSongsHelpCard();
    },

    setupSongsHelpCard() {
        const helpToggle = document.getElementById('songs-help-toggle');
        const helpCard = document.getElementById('songs-help-card');
        this.songsHelpCardVisible = false;

        if (!helpToggle || !helpCard) return;

        // Store reference to help card
        this.songsHelpCard = helpCard;

        helpToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSongsHelpCard();
        });

        document.addEventListener('click', (e) => {
            if (this.songsHelpCardVisible && !e.target.closest('#songs-help-toggle')) {
                this.toggleSongsHelpCard();
            }
        });
    },

    toggleSongsHelpCard() {
        if (!this.songsHelpCard) return;

        this.songsHelpCardVisible = !this.songsHelpCardVisible;
        const helpCard = this.songsHelpCard;

        if (this.songsHelpCardVisible) {
            helpCard.style.opacity = '1';
            helpCard.style.visibility = 'visible';
            helpCard.style.transform = 'translateY(0)';
            helpCard.style.pointerEvents = 'auto';
        } else {
            helpCard.style.opacity = '0';
            helpCard.style.visibility = 'hidden';
            helpCard.style.transform = 'translateY(-8px)';
            helpCard.style.pointerEvents = 'none';
        }
    },

    /**
     * Show a view instantly (no page load!)
     * @param {string} viewName - 'collections', 'songs', or 'player'
     */
    showView(viewName) {
        console.log(`🔄 Switching to ${viewName} view`);

        // Hide all views
        Object.values(this.views).forEach(view => {
            if (view) view.classList.remove('active');
        });

        // Show requested view
        if (this.views[viewName]) {
            this.views[viewName].classList.add('active');
            this.currentView = viewName;
        }

        // Setup keyboard handlers for new view
        this.setupKeyboardForView(viewName);
    },

    /**
     * Open a collection (show songs view)
     */
    async openCollection(collectionId) {
        try {
            console.log('📂 Opening collection:', collectionId);

            // Show loading
            const songsList = document.getElementById('songs-list');
            songsList.innerHTML = '<div class="loading-spinner"></div>';

            // Switch to songs view immediately
            this.showView('songs');

            // Load collection data
            const response = await BPP.apiCall(`/api/v3/collections/${collectionId}/songs`);
            this.state.currentCollection = response.collection;
            this.state.allSongs = response.songs || [];

            // Update header
            document.getElementById('songs-collection-name').textContent = this.state.currentCollection.name;

            // Update sort indicator to match current mode
            this.updateSortIndicator();

            // Filter and render
            this.filterSongs();

        } catch (error) {
            console.error('Error loading collection:', error);
            BPP.showToast('Failed to load songs', 'error');
            this.showView('collections');
        }
    },

    filterSongs() {
        const searchTerm = document.getElementById('song-search').value.toLowerCase();

        // Filter songs
        if (searchTerm) {
            this.state.filteredSongs = this.state.allSongs.filter(song => {
                const title = (song.title || '').toLowerCase();
                const artist = (song.artist || '').toLowerCase();
                const album = (song.album || '').toLowerCase();
                return title.includes(searchTerm) || artist.includes(searchTerm) || album.includes(searchTerm);
            });
        } else {
            this.state.filteredSongs = [...this.state.allSongs];
        }

        // Apply sort
        this.applySortMode();

        // Render
        this.renderSongs();

        // Auto-select first song when filtering
        if (this.state.filteredSongs.length > 0) {
            this.updateSelection(0);
        } else {
            this.state.selectedSongIndex = -1;
        }

        // Update count
        this.updateSongCount();
    },

    applySortMode() {
        const sortMode = this.state.sortMode;

        if (sortMode === 'artist') {
            this.state.filteredSongs.sort((a, b) => {
                const artistCompare = (a.artist || '').localeCompare(b.artist || '');
                return artistCompare !== 0 ? artistCompare : (a.title || '').localeCompare(b.title || '');
            });
        } else if (sortMode === 'title') {
            this.state.filteredSongs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        } else if (sortMode === 'playlist') {
            // Keep natural playlist order from backend
            // Backend already sorted by: collection's linked_playlists order, then position within each playlist
        }
    },

    renderSongs() {
        const container = document.getElementById('songs-list');

        if (this.state.filteredSongs.length === 0) {
            const message = this.state.allSongs.length === 0
                ? 'No songs in this collection yet. Link a playlist to add songs!'
                : 'No songs match your search';
            container.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
            return;
        }

        let html = '';

        // Track which playlists we've seen to show badge on first song only
        const seenPlaylists = new Set();

        // Always render songs in a continuous grid
        this.state.filteredSongs.forEach((song, index) => {
            const isFirstOfPlaylist = this.state.sortMode === 'playlist' &&
                                       song.source_playlist_ids &&
                                       song.source_playlist_ids[0] &&
                                       !seenPlaylists.has(song.source_playlist_ids[0]);

            if (isFirstOfPlaylist) {
                seenPlaylists.add(song.source_playlist_ids[0]);
            }

            html += this.renderSongItem(song, index, isFirstOfPlaylist);
        });

        container.innerHTML = html;

        // Add click handlers
        container.querySelectorAll('.song-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.openSong(index);
            });
        });

        // Reset selection
        this.state.selectedSongIndex = -1;
    },

    renderSongItem(song, index, isFirstOfPlaylist) {
        const selected = index === this.state.selectedSongIndex ? 'selected' : '';
        const hasArtwork = song.album_art_url && song.album_art_url.trim() !== '';
        const hasLyrics = song.lyrics_fetched ? 'has-lyrics' : 'no-lyrics';

        // Get playlist name badge (only for first song of playlist)
        let playlistBadge = '';
        if (isFirstOfPlaylist && this.state.currentCollection.linked_playlists) {
            const playlistId = song.source_playlist_ids && song.source_playlist_ids[0];
            if (playlistId) {
                const playlist = this.state.currentCollection.linked_playlists.find(p => p.playlist_id === playlistId);
                if (playlist) {
                    playlistBadge = `
                        <div class="playlist-badge">
                            <i class="fa-brands fa-spotify"></i>
                            <span class="playlist-badge-name">${this.escapeHtml(playlist.playlist_name)}</span>
                        </div>
                    `;
                }
            }
        }

        return `
            <div class="song-item ${selected} ${hasLyrics}" data-index="${index}" data-song-id="${song.id}">
                <div class="song-art-container">
                    ${hasArtwork
                        ? `<img src="${this.escapeHtml(song.album_art_url)}" alt="Album art" class="song-art" loading="lazy">`
                        : `<div class="song-art-placeholder"><i class="fa-solid fa-music"></i></div>`
                    }
                    ${!song.lyrics_fetched ? '<div class="lyrics-status"><i class="fa-solid fa-hourglass-half"></i></div>' : ''}
                    ${playlistBadge}
                </div>
                <div class="song-info">
                    <div class="song-title">${this.escapeHtml(song.title || 'Unknown')}</div>
                    <div class="song-artist">${this.escapeHtml(song.artist || 'Unknown')}</div>
                </div>
                <div class="song-meta">
                    ${song.bpm && song.bpm !== 'N/A' ? `<span class="song-bpm"><i class="fa-solid fa-drum"></i> ${song.bpm}</span>` : ''}
                </div>
            </div>
        `;
    },

    updateSongCount() {
        const countEl = document.getElementById('songs-count');
        if (this.state.filteredSongs.length === this.state.allSongs.length) {
            countEl.textContent = `${this.state.allSongs.length} ${this.state.allSongs.length === 1 ? 'song' : 'songs'}`;
        } else {
            countEl.textContent = `${this.state.filteredSongs.length} of ${this.state.allSongs.length} songs`;
        }
    },

    toggleSortMode() {
        // Cycle: title → artist → playlist → title
        if (this.state.sortMode === 'title') {
            this.state.sortMode = 'artist';
        } else if (this.state.sortMode === 'artist') {
            this.state.sortMode = 'playlist';
        } else {
            this.state.sortMode = 'title';
        }

        // Save preference
        localStorage.setItem('v3_songsSortMode', this.state.sortMode);

        // Update UI
        this.updateSortIndicator();
        this.filterSongs();
    },

    updateSortIndicator() {
        const indicator = document.getElementById('sort-indicator');
        const text = document.getElementById('sort-mode-text');
        const icon = indicator.querySelector('i');

        if (this.state.sortMode === 'title') {
            icon.className = 'fa-solid fa-arrow-down-a-z';
            text.textContent = 'By Title';
        } else if (this.state.sortMode === 'artist') {
            icon.className = 'fa-solid fa-microphone';
            text.textContent = 'By Artist';
        } else if (this.state.sortMode === 'playlist') {
            icon.className = 'fa-brands fa-spotify';
            text.textContent = 'By Playlist';
        }
    },

    openSong(index) {
        if (index < 0 || index >= this.state.filteredSongs.length) return;

        const song = this.state.filteredSongs[index];
        this.state.currentSong = song;
        console.log('🎵 Opening song:', song.title);

        // Load player view
        if (window.PlayerManager) {
            PlayerManager.loadSong(song);
            this.showView('player');
        } else {
            BPP.showToast('Player not initialized', 'error');
        }
    },

    updateSelection(index) {
        // Remove previous selection
        document.querySelectorAll('.song-item.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Add new selection
        if (index >= 0 && index < this.state.filteredSongs.length) {
            const item = document.querySelector(`.song-item[data-index="${index}"]`);
            if (item) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }

        this.state.selectedSongIndex = index;
    },

    navigateList(direction) {
        if (this.state.filteredSongs.length === 0) return;

        let newIndex = this.state.selectedSongIndex;

        // Get grid info for spatial navigation
        const songsGrid = document.getElementById('songs-list');
        const allSongItems = Array.from(songsGrid.querySelectorAll('.song-item'));

        if (allSongItems.length === 0) return;

        // Calculate columns dynamically
        const gridWidth = songsGrid.offsetWidth;
        const songWidth = allSongItems[0].offsetWidth;
        const gap = 10; // From CSS
        const cols = Math.floor((gridWidth + gap) / (songWidth + gap));

        // Current position in grid
        const currentRow = Math.floor(this.state.selectedSongIndex / cols);
        const currentCol = this.state.selectedSongIndex % cols;

        if (direction === 'left') {
            newIndex = Math.max(this.state.selectedSongIndex - 1, 0);
        } else if (direction === 'right') {
            newIndex = Math.min(this.state.selectedSongIndex + 1, this.state.filteredSongs.length - 1);
        } else if (direction === 'up') {
            // Move up one row, same column
            const targetRow = currentRow - 1;
            if (targetRow >= 0) {
                newIndex = Math.min(targetRow * cols + currentCol, this.state.filteredSongs.length - 1);
            }
        } else if (direction === 'down') {
            // Move down one row, same column
            const targetRow = currentRow + 1;
            const targetIndex = targetRow * cols + currentCol;
            if (targetIndex < this.state.filteredSongs.length) {
                newIndex = targetIndex;
            }
        } else if (direction === 'pageup') {
            // Move up ~3 rows
            const targetRow = Math.max(currentRow - 3, 0);
            newIndex = Math.min(targetRow * cols + currentCol, this.state.filteredSongs.length - 1);
        } else if (direction === 'pagedown') {
            // Move down ~3 rows
            const maxRow = Math.floor((this.state.filteredSongs.length - 1) / cols);
            const targetRow = Math.min(currentRow + 3, maxRow);
            newIndex = Math.min(targetRow * cols + currentCol, this.state.filteredSongs.length - 1);
        } else if (direction === 'home') {
            newIndex = 0;
        } else if (direction === 'end') {
            newIndex = this.state.filteredSongs.length - 1;
        }

        this.updateSelection(newIndex);
    },

    setupKeyboardForView(viewName) {
        // Remove old keyboard handler
        if (this.currentKeyboardHandler) {
            document.removeEventListener('keydown', this.currentKeyboardHandler);
        }

        // Set up new handler based on view
        if (viewName === 'songs') {
            this.currentKeyboardHandler = (e) => this.handleSongsKeyboard(e);
            document.addEventListener('keydown', this.currentKeyboardHandler);
        } else if (viewName === 'player') {
            this.currentKeyboardHandler = (e) => this.handlePlayerKeyboard(e);
            document.addEventListener('keydown', this.currentKeyboardHandler);
        }
    },

    handleSongsKeyboard(e) {
        const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
        const isSearchInput = e.target.id === 'song-search';

        // / or ? - Toggle help card (takes precedence over search)
        if (e.key === '/' || e.key === '?') {
            e.preventDefault();
            this.toggleSongsHelpCard();
            return;
        }

        // ESC - back to collections (even when typing)
        if (e.key === 'Escape') {
            // If help card is open, close it first
            if (this.songsHelpCardVisible) {
                this.toggleSongsHelpCard();
                return;
            }
            // If in search, clear it first
            if (isSearchInput && e.target.value) {
                e.target.value = '';
                this.filterSongs();
                return;
            }
            this.showView('collections');
            return;
        }

        // Arrow keys work even in search input (for navigation)
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigateList('down');
            return;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigateList('up');
            return;
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.navigateList('left');
            return;
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.navigateList('right');
            return;
        }

        // Enter - open selected song (works in search too)
        if (e.key === 'Enter') {
            e.preventDefault();
            if (this.state.selectedSongIndex >= 0) {
                this.openSong(this.state.selectedSongIndex);
            }
            return;
        }

        // Don't handle other keys if typing (except in search)
        if (isTyping && !isSearchInput) return;

        // Page Up/Down, Home/End
        if (e.key === 'PageDown') {
            e.preventDefault();
            this.navigateList('pagedown');
        } else if (e.key === 'PageUp') {
            e.preventDefault();
            this.navigateList('pageup');
        } else if (e.key === 'Home') {
            e.preventDefault();
            this.navigateList('home');
        } else if (e.key === 'End') {
            e.preventDefault();
            this.navigateList('end');
        } else if (e.altKey && (e.key === 't' || e.key === 'T')) {
            e.preventDefault();
            this.toggleSortMode();
        } else if (!isTyping && e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
            // Any alphanumeric key focuses search (only if not already typing)
            document.getElementById('song-search').focus();
        }
    },

    handlePlayerKeyboard(e) {
        const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

        // NEVER block these (work even when typing in dialogs)
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

        // / or ? - Toggle help card (but not when editing notes/lyrics)
        if (e.key === '/' || e.key === '?') {
            // Don't intercept if editing notes or lyrics
            const notesDialog = document.getElementById('edit-notes-dialog');
            const lyricsDialog = document.getElementById('edit-lyrics-dialog');
            const editingNotes = notesDialog && !notesDialog.classList.contains('hidden');
            const editingLyrics = lyricsDialog && !lyricsDialog.classList.contains('hidden');

            if (!editingNotes && !editingLyrics) {
                e.preventDefault();
                PlayerManager.togglePlayerHelpCard();
                return;
            }
        }

        // . (period) - BPM tap (even in tap dialog)
        if (e.key === '.') {
            const tapDialog = document.getElementById('bpm-tap-dialog');
            if (tapDialog && !tapDialog.classList.contains('hidden')) {
                e.preventDefault();
                PlayerManager.handleTap();
                return;
            }
            // If dialog not open, open it
            if (!isTyping) {
                e.preventDefault();
                PlayerManager.openBpmTapTrainer();
                return;
            }
        }

        // Don't handle other keys if typing
        if (isTyping) return;

        // Arrow keys for note navigation
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            PlayerManager.navigateToNote(-1); // Previous note
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            PlayerManager.navigateToNote(1); // Next note
            return;
        }

        // HOME key - Jump to first note
        if (e.key === 'Home') {
            e.preventDefault();
            PlayerManager.jumpToNote(0); // First note
            return;
        }

        // END key - Jump to last note
        if (e.key === 'End') {
            e.preventDefault();
            PlayerManager.jumpToNote(-1); // Last note (-1 means last)
            return;
        }

        // ESC - Close help card first, then go back to songs view
        if (e.key === 'Escape') {
            e.preventDefault();
            // Check if help card is visible using PlayerManager's state variable
            if (PlayerManager.helpCardVisible) {
                // Help card is open - close it
                PlayerManager.togglePlayerHelpCard();
            } else {
                // Help card is closed - go back to songs view
                this.showView('songs');
            }
            return;
        }

        // Handle all other shortcuts
        const handlers = {
            'x': () => this.showView('collections'),
            's': () => this.showView('songs'),
            'b': () => PlayerManager.previousSong(),
            'f': () => PlayerManager.nextSong(),
            ' ': () => PlayerManager.togglePlayback(),
            't': () => PlayerManager.restartTrack(),
            'm': () => PlayerManager.toggleMute(),
            'arrowleft': () => PlayerManager.skipBackward(5),
            'arrowright': () => PlayerManager.skipForward(5),
            'c': () => PlayerManager.toggleColumns(),
            'l': () => PlayerManager.editLyrics(),
            'n': () => PlayerManager.editNotes(),
            'i': () => PlayerManager.toggleBpmIndicator()
        };

        BPP.handleKeyboard(e, handlers);
    },

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                BPP.showToast('Fullscreen not supported', 'error');
            });
        } else {
            document.exitFullscreen();
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Export for global use
window.ViewManager = ViewManager;
