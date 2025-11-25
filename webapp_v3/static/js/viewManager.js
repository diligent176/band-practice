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
        sortMode: localStorage.getItem('v3_songsSortMode') || 'playlist',
        collectionAccessLevel: 'none', // 'owner', 'collaborator', 'viewer', 'none'
        lyricsPollingInterval: null // For checking background fetch progress
    },
    
    // Grid navigator for songs
    songsGridNav: null,

    init() {
        // Cache view elements
        this.views.collections = document.getElementById('collections-view');
        this.views.songs = document.getElementById('songs-view');
        this.views.player = document.getElementById('player-view');
        
        // Initialize grid navigator for songs
        this.songsGridNav = new GridNavigator('#songs-list', '.song-item');

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
            if (this.songsHelpCardVisible && !e.target.closest('#songs-help-toggle') && !e.target.closest('#songs-help-card')) {
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

        // Pause music when leaving player view
        if (this.currentView === 'player' && viewName !== 'player') {
            if (window.PlayerManager) {
                PlayerManager.pausePlayback();
            }
        }

        // Clear song search filter and STOP POLLING when leaving songs view
        if (this.currentView === 'songs' && viewName !== 'songs') {
            const searchInput = document.getElementById('song-search');
            if (searchInput) {
                searchInput.value = '';
            }
            // CRITICAL: Stop lyrics polling when leaving songs view to prevent background API spam
            this.stopLyricsPolling();
        }

        // CRITICAL: Stop lyrics polling when navigating away from songs view (safety net)
        if (viewName !== 'songs') {
            this.stopLyricsPolling();
        }

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
            this.state.collectionAccessLevel = response.access_level || 'none';

            // Update header
            document.getElementById('songs-collection-name').textContent = this.state.currentCollection.name;

            // Update sort indicator to match current mode
            this.updateSortIndicator();

            // If collection is empty, auto-open playlist dialog to save user steps
            if (this.state.allSongs.length === 0) {
                console.log('📂 Collection is empty, opening playlist dialog');
                // Use setTimeout to ensure view is fully rendered before showing dialog
                setTimeout(() => {
                    if (typeof showLinkPlaylistDialog === 'function') {
                        showLinkPlaylistDialog(collectionId);
                    }
                }, 100);
            }

            // Filter and render
            this.filterSongs();
            
            // Start polling for lyrics updates if any songs are pending
            this.startLyricsPolling();

        } catch (error) {
            console.error('Error loading collection:', error);
            BPP.showToast('Failed to load songs', 'error');
            this.showView('collections');
        }
    },
    
    /**
     * Start polling for lyrics updates (lightweight - only when needed)
     */
    startLyricsPolling() {
        // Stop any existing polling
        this.stopLyricsPolling();
        
        // Check if any songs are waiting for lyrics (EXPLICITLY check for false, not just falsy)
        // lyrics_fetched can be true, false, undefined, or null
        // Only poll if EXPLICITLY false (meaning background fetch is in progress)
        const hasPendingLyrics = this.state.allSongs.some(song => song.lyrics_fetched === false);
        
        if (!hasPendingLyrics) {
            console.log('✅ No songs pending lyrics fetch, polling not needed');
            return;
        }
        
        console.log(`🔄 Starting lyrics polling (${this.state.allSongs.filter(s => s.lyrics_fetched === false).length} songs pending fetch)`);
        
        // Poll every 15 seconds (reduced from 5s to minimize performance impact)
        this.state.lyricsPollingInterval = setInterval(async () => {
            try {
                // Only poll if we're still in songs view for this collection
                if (this.currentView !== 'songs' || !this.state.currentCollection) {
                    this.stopLyricsPolling();
                    return;
                }
                
                // Fetch updated song list
                const response = await BPP.apiCall(`/api/v3/collections/${this.state.currentCollection.id}/songs`);
                const updatedSongs = response.songs || [];
                
                // Check if any lyrics statuses changed
                let hasChanges = false;
                for (const updatedSong of updatedSongs) {
                    const oldSong = this.state.allSongs.find(s => s.id === updatedSong.id);
                    if (oldSong && oldSong.lyrics_fetched !== updatedSong.lyrics_fetched) {
                        hasChanges = true;
                        break;
                    }
                }
                
                if (hasChanges) {
                    console.log('✅ Lyrics updates detected, refreshing view');
                    this.state.allSongs = updatedSongs;
                    this.filterSongs(); // Re-render
                }
                
                // Stop polling if all lyrics are fetched (EXPLICITLY check for false)
                const stillPending = updatedSongs.some(song => song.lyrics_fetched === false);
                if (!stillPending) {
                    console.log('✅ All lyrics fetched, stopping polling');
                    this.stopLyricsPolling();
                }
                
            } catch (error) {
                console.error('Error polling for lyrics updates:', error);
                // Don't stop polling on error, just log it
            }
        }, 15000); // Poll every 15 seconds (reduced from 5s for better performance)
    },
    
    /**
     * Stop lyrics polling
     */
    stopLyricsPolling() {
        if (this.state.lyricsPollingInterval) {
            clearInterval(this.state.lyricsPollingInterval);
            this.state.lyricsPollingInterval = null;
            console.log('⏹️ Stopped lyrics polling');
        }
    },

    filterSongs() {
        const searchTerm = document.getElementById('song-search').value.toLowerCase();

        // Filter songs
        if (searchTerm) {
            this.state.filteredSongs = this.state.allSongs.filter(song => {
                const title = (song.title || '').toLowerCase();
                const artist = (song.artist || '').toLowerCase();
                return title.includes(searchTerm) || artist.includes(searchTerm);
            });
        } else {
            this.state.filteredSongs = [...this.state.allSongs];
        }

        // Apply sort
        this.applySortMode();

        // Render
        this.renderSongs();

        // Update count
        this.updateSongCount();
    },

    applySortMode() {
        const sortMode = this.state.sortMode;

        if (sortMode === 'artist' || sortMode === 'title') {
            // For artist/title modes, deduplicate songs (show each song once)
            const seen = new Set();
            this.state.filteredSongs = this.state.filteredSongs.filter(song => {
                const key = song.id;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            if (sortMode === 'artist') {
                this.state.filteredSongs.sort((a, b) => {
                    const artistCompare = (a.artist || '').localeCompare(b.artist || '');
                    return artistCompare !== 0 ? artistCompare : (a.title || '').localeCompare(b.title || '');
                });
            } else {
                this.state.filteredSongs.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
            }
        } else if (sortMode === 'playlist') {
            // Keep natural playlist order from backend (includes duplicates for multi-playlist songs)
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
            // Use _display_playlist_id (set by backend for expanded songs) or fall back to first source playlist
            const displayPlaylistId = song._display_playlist_id || (song.source_playlist_ids && song.source_playlist_ids[0]);

            const isFirstOfPlaylist = this.state.sortMode === 'playlist' &&
                                       displayPlaylistId &&
                                       !seenPlaylists.has(displayPlaylistId);

            if (isFirstOfPlaylist) {
                seenPlaylists.add(displayPlaylistId);
            }

            html += this.renderSongItem(song, index, isFirstOfPlaylist);
        });

        container.innerHTML = html;

        // Add click handlers for song items
        container.querySelectorAll('.song-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Check if click was on orphaned indicator
                if (e.target.closest('.orphaned-indicator')) {
                    e.stopPropagation();
                    const songId = item.dataset.songId;
                    const index = parseInt(item.dataset.index);
                    this.handleOrphanedClick(songId, index);
                    return;
                }
                
                const index = parseInt(item.dataset.index);
                this.openSong(index);
            });
        });
        
        // Reset grid navigation to first item after rendering
        setTimeout(() => {
            if (this.songsGridNav.getItems().length > 0) {
                this.songsGridNav.reset();
            }
        }, 50);
    },
    
    /**
     * Handle click on orphaned song trash icon
     */
    async handleOrphanedClick(songId, index) {
        // Check if user is owner
        if (this.state.collectionAccessLevel !== 'owner') {
            BPP.showToast('Only collection owner can delete orphaned songs', 'error');
            return;
        }
        
        const song = this.state.filteredSongs[index];
        if (!song) return;
        
        // Show confirmation dialog
        document.getElementById('delete-song-id').value = songId;
        document.getElementById('delete-song-title').textContent = song.title;
        
        // Set up confirm button handler
        const confirmBtn = document.getElementById('confirm-delete-song-btn');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.addEventListener('click', async () => {
            BPP.hideDialog('delete-song-dialog');
            
            try {
                await BPP.apiCall(`/api/v3/songs/${songId}`, {
                    method: 'DELETE'
                });
                
                BPP.showToast('Song deleted', 'success');
                
                // Reload collection to refresh UI
                await this.openCollection(this.state.currentCollection.id);
                
            } catch (error) {
                console.error('Error deleting orphaned song:', error);
                BPP.showToast('Failed to delete song', 'error');
            }
        });
        
        BPP.showDialog('delete-song-dialog');
    },

    renderSongItem(song, index, isFirstOfPlaylist) {
        const selected = index === this.state.selectedSongIndex ? 'selected' : '';
        const hasArtwork = song.album_art_url && song.album_art_url.trim() !== '';
        const hasLyrics = song.lyrics_fetched ? 'has-lyrics' : 'no-lyrics';
        const isOrphaned = song.is_orphaned === true ? 'is-orphaned' : '';

        // Get playlist name badge (only for first song of playlist)
        let playlistBadge = '';
        if (isFirstOfPlaylist) {
            // Use _display_playlist_name from backend (for expanded songs) or look up from linked_playlists
            let playlistName = song._display_playlist_name;
            if (!playlistName && this.state.currentCollection.linked_playlists) {
                const playlistId = song._display_playlist_id || (song.source_playlist_ids && song.source_playlist_ids[0]);
                if (playlistId) {
                    const playlist = this.state.currentCollection.linked_playlists.find(p => p.playlist_id === playlistId);
                    playlistName = playlist ? playlist.playlist_name : null;
                }
            }
            if (playlistName) {
                playlistBadge = `
                    <div class="playlist-badge">
                        <i class="fa-brands fa-spotify"></i>
                        <span class="playlist-badge-name">${this.escapeHtml(playlistName)}</span>
                    </div>
                `;
            }
        }

        // Orphaned indicator (trash icon overlay) - only show if explicitly true
        const orphanedIndicator = song.is_orphaned === true ? `
            <div class="orphaned-indicator" title="Song removed from playlist">
                <i class="fa-solid fa-trash"></i>
            </div>
        ` : '';

        return `
            <div class="song-item ${selected} ${hasLyrics} ${isOrphaned}" data-index="${index}" data-song-id="${song.id}">
                <div class="song-art-container">
                    ${hasArtwork
                        ? `<img src="${this.escapeHtml(song.album_art_url)}" alt="Album art" class="song-art" loading="lazy">`
                        : `<div class="song-art-placeholder"><i class="fa-solid fa-music"></i></div>`
                    }
                    ${!song.lyrics_fetched ? '<div class="lyrics-status"><i class="fa-solid fa-hourglass-half"></i></div>' : ''}
                    ${orphanedIndicator}
                    ${playlistBadge}
                </div>
                <div class="song-info">
                    <div class="song-title">${this.escapeHtml(song.title || 'Unknown')}</div>
                    <div class="song-artist">${this.escapeHtml(song.artist || 'Unknown')}</div>
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

    /**
     * Sync playlists in current collection - check for new/removed songs
     */
    async syncPlaylist() {
        if (!this.state.currentCollection) {
            BPP.showToast('No collection selected', 'error');
            return;
        }

        const collection = this.state.currentCollection;
        console.log('🔄 Syncing playlists for collection:', collection.name);

        try {
            BPP.showToast('Syncing playlists...', 'info');

            // Make API call without automatic error handling
            const idToken = window.currentUser ? await window.currentUser.getIdToken() : null;
            const response = await fetch(`/api/v3/collections/${collection.id}/sync-playlists`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    errorData = { error: errorText };
                }
                
                // Check if it's a permissions error
                if (response.status === 403 || errorData.error?.includes('owner or collaborator')) {
                    BPP.showToast('Only collection owner or collaborator can sync playlists', 'warning');
                    return;
                }
                
                // Other errors
                throw new Error(errorData.error || 'Failed to sync playlists');
            }

            const data = await response.json();

            if (data.added || data.removed || data.orphaned) {
                const messages = [];
                if (data.added > 0) messages.push(`${data.added} new song(s)`);
                if (data.removed > 0) messages.push(`${data.removed} removed`);
                if (data.orphaned > 0) messages.push(`${data.orphaned} orphaned`);
                
                BPP.showToast(`Synced: ${messages.join(', ')}`, 'success');
            } else {
                BPP.showToast('Playlists are up to date', 'success');
            }
            
            // Always reload songs to refresh order (even if no adds/removes)
            await this.openCollection(collection.id);
            
            // Also refresh collections list to update artwork/metadata in home view
            if (BPP.collectionsManager) {
                await BPP.collectionsManager.loadCollections();
            }
        } catch (error) {
            console.error('Failed to sync playlists:', error);
            BPP.showToast(error.message || 'Failed to sync playlists', 'error');
        }
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
            e.preventDefault(); // Prevent default ESC behavior
            
            // If help card is open, close it first
            if (this.songsHelpCardVisible) {
                this.toggleSongsHelpCard();
                return;
            }
            // If songs are filtered (fewer filtered songs than all songs), clear filter first
            if (this.state.filteredSongs.length < this.state.allSongs.length) {
                const searchInput = document.getElementById('song-search');
                if (searchInput) {
                    searchInput.value = '';
                }
                this.filterSongs();
                return;
            }
            // Finally, go back to collections
            this.showView('collections');
            return;
        }

        // Arrow keys for navigation
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            this.songsGridNav.navigate(e.key);
            return;
        }

        // Enter - open selected song
        if (e.key === 'Enter') {
            e.preventDefault();
            const selected = this.songsGridNav.getSelected();
            if (selected) {
                selected.click();
            }
            return;
        }

        // Don't handle other keys if typing (except in search)
        if (isTyping && !isSearchInput) return;

        // Home/End navigation
        if (e.key === 'Home') {
            e.preventDefault();
            this.songsGridNav.navigate('Home');
        } else if (e.key === 'End') {
            e.preventDefault();
            this.songsGridNav.navigate('End');
        } else if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            this.toggleSortMode();
        } else if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            this.syncPlaylist();
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

        // . (period) - BPM dialog (tap or open)
        if (e.key === '.') {
            // Check edit permissions before allowing BPM edit
            if (PlayerManager.canEdit === false) {
                if (!isTyping) {
                    BPP.showToast('You do not have permission to edit this song', 'warning');
                }
                return;
            }

            const bpmDialog = document.getElementById('bpm-dialog');
            if (bpmDialog && !bpmDialog.classList.contains('hidden')) {
                e.preventDefault();
                PlayerManager.handleBpmTap();
                return;
            }
            // If dialog not open, open it
            if (!isTyping) {
                e.preventDefault();
                PlayerManager.openBpmDialog();
                return;
            }
        }

        // Arrow keys in BPM dialog for adjustment
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const bpmDialog = document.getElementById('bpm-dialog');
            if (bpmDialog && !bpmDialog.classList.contains('hidden')) {
                e.preventDefault();
                const increment = e.ctrlKey ? 1.0 : 0.1;
                const direction = e.key === 'ArrowUp' ? 1 : -1;
                PlayerManager.adjustBpmValue(increment * direction);
                return;
            }
        }

        // Enter in BPM dialog to save
        if (e.key === 'Enter') {
            const bpmDialog = document.getElementById('bpm-dialog');
            if (bpmDialog && !bpmDialog.classList.contains('hidden')) {
                e.preventDefault();
                PlayerManager.saveBpm();
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

        // ESC - Close BPM dialog first, then help card, then go back to songs view
        if (e.key === 'Escape') {
            e.preventDefault();
            
            // Check if BPM dialog is open
            const bpmDialog = document.getElementById('bpm-dialog');
            if (bpmDialog && !bpmDialog.classList.contains('hidden')) {
                BPP.hideDialog('bpm-dialog');
                return;
            }
            
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
            'r': () => PlayerManager.restartTrack(),
            'm': () => PlayerManager.toggleMute(),
            'h': () => PlayerManager.toggleChords(),
            'arrowleft': () => PlayerManager.skipBackward(5),
            'arrowright': () => PlayerManager.skipForward(5),
            'c': () => PlayerManager.toggleColumns(),
            'shift+p': () => PlayerManager.printLyrics(),
            'l': () => {
                // Check edit permissions before allowing lyrics edit
                if (PlayerManager.canEdit === false) {
                    BPP.showToast('You do not have permission to edit this song', 'warning');
                    return;
                }
                PlayerManager.editLyrics();
            },
            'n': () => {
                // Check edit permissions before allowing notes edit
                if (PlayerManager.canEdit === false) {
                    BPP.showToast('You do not have permission to edit this song', 'warning');
                    return;
                }
                PlayerManager.editNotes();
            },
            'g': () => {
                // Check edit permissions before allowing lyrics fetch
                if (PlayerManager.canEdit === false) {
                    BPP.showToast('You do not have permission to edit this song', 'warning');
                    return;
                }
                PlayerManager.fetchLyricsFromGenius();
            },
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
