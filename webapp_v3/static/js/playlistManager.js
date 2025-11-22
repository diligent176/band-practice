/**
 * Playlist Manager
 * Handles all playlist dialog operations:
 * - Showing/loading playlist dialog
 * - Linking/unlinking playlists
 * - Playlist drag-and-drop reordering
 * - Keyboard navigation in playlist dialog
 * - Recent playlist memory display
 */

const PlaylistManager = {
    // State
    selectedPlaylistIndex: -1,
    playlistElements: [],
    currentPlaylistSection: null, // 'linked' or 'other'
    draggedElement: null,
    draggedIndex: null,

    init() {
        console.log('Initializing PlaylistManager...');
        this.setupEventListeners();
        this.setupKeyboardNavigation();
        this.setupDialogObserver();
    },

    setupEventListeners() {
        // Add Playlist button
        document.getElementById('add-playlist-btn').addEventListener('click', () => {
            this.addPlaylistToCollection();
        });

        // Enter key in playlist URL input
        document.getElementById('playlist-url').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addPlaylistToCollection();
            }
        });
    },

    setupKeyboardNavigation() {
        // Keyboard navigation in playlist dialog
        document.addEventListener('keydown', (e) => {
            const dialogOpen = !document.getElementById('link-playlist-dialog').classList.contains('hidden');
            if (!dialogOpen) return;

            const urlInput = document.getElementById('playlist-url');
            const isInputFocused = e.target.id === 'playlist-url';

            console.log(`Playlist dialog key: ${e.key}, inputFocused: ${isInputFocused}, currentIndex: ${this.selectedPlaylistIndex}`);

            switch(e.key) {
                case 'Tab':
                    // Allow Tab to move between input and list
                    if (isInputFocused && !e.shiftKey) {
                        e.preventDefault();
                        // Tab from input to first playlist
                        const items = this.getAllPlaylistElements();
                        if (items.length > 0) {
                            urlInput.blur();
                            this.selectedPlaylistIndex = 0;
                            this.updatePlaylistFocus();
                        }
                    } else if (!isInputFocused && e.shiftKey && this.selectedPlaylistIndex === 0) {
                        e.preventDefault();
                        // Shift+Tab from first playlist back to input
                        this.selectedPlaylistIndex = -1;
                        this.updatePlaylistFocus();
                        urlInput.focus();
                    }
                    break;

                case 'ArrowDown':
                case 'ArrowUp':
                    e.preventDefault();

                    // Get current playlist items
                    const allItems = this.getAllPlaylistElements();
                    if (allItems.length === 0) return;

                    // If input is focused, blur it and start navigating
                    if (isInputFocused) {
                        urlInput.blur();
                        this.selectedPlaylistIndex = e.key === 'ArrowDown' ? 0 : allItems.length - 1;
                    } else {
                        // Navigate through playlists
                        if (e.key === 'ArrowDown') {
                            this.selectedPlaylistIndex = this.selectedPlaylistIndex < 0 ? 0 : Math.min(this.selectedPlaylistIndex + 1, allItems.length - 1);
                        } else {
                            this.selectedPlaylistIndex = this.selectedPlaylistIndex < 0 ? allItems.length - 1 : Math.max(this.selectedPlaylistIndex - 1, 0);
                        }
                    }

                    this.updatePlaylistFocus();
                    break;

                case 'Enter':
                    // If input is focused, let the existing Enter handler deal with it
                    if (isInputFocused) {
                        return;
                    }

                    // Otherwise, link/unlink selected playlist
                    e.preventDefault();
                    const currentItems = this.getAllPlaylistElements();

                    if (this.selectedPlaylistIndex >= 0 && this.selectedPlaylistIndex < currentItems.length) {
                        const selected = currentItems[this.selectedPlaylistIndex];
                        const section = selected.dataset.section;

                        if (section === 'linked') {
                            // Unlink the playlist
                            const playlistId = selected.dataset.playlistId;
                            if (playlistId) {
                                this.unlinkPlaylist(playlistId);
                            }
                        } else if (section === 'other') {
                            // Link the playlist
                            const playlistUrl = selected.dataset.playlistUrl;
                            if (playlistUrl) {
                                this.linkPlaylistFromMemory(playlistUrl);
                            }
                        }
                    }
                    break;

                case 'Home':
                case 'End':
                    e.preventDefault();

                    // Blur input if focused
                    if (isInputFocused) {
                        urlInput.blur();
                    }

                    // Jump to first/last
                    const homeEndItems = this.getAllPlaylistElements();
                    if (homeEndItems.length > 0) {
                        this.selectedPlaylistIndex = e.key === 'Home' ? 0 : homeEndItems.length - 1;
                        this.updatePlaylistFocus();
                    }
                    break;

                case 'Escape':
                    // Clear selection visual when closing
                    this.selectedPlaylistIndex = -1;
                    this.updatePlaylistFocus();
                    break;
            }
        });
    },

    setupDialogObserver() {
        // Reset playlist selection when dialog closes
        const linkPlaylistDialog = document.getElementById('link-playlist-dialog');
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const isHidden = linkPlaylistDialog.classList.contains('hidden');
                    if (isHidden) {
                        // Dialog closed - reset selection
                        this.selectedPlaylistIndex = -1;
                        this.currentPlaylistSection = null;
                        this.refreshPlaylistElements();
                        this.updatePlaylistFocus();
                    }
                }
            });
        });
        observer.observe(linkPlaylistDialog, { attributes: true });
    },

    async showLinkPlaylistDialog(collectionId) {
        try {
            // Set collection ID
            document.getElementById('link-playlist-collection-id').value = collectionId;

            // Clear previous URL
            document.getElementById('playlist-url').value = '';

            // Reset playlist selection
            this.selectedPlaylistIndex = -1;
            this.currentPlaylistSection = null;

            // Load collection data to get linked playlists
            const collectionData = await BPP.apiCall(`/api/v3/collections/${collectionId}`);

            // Load recent playlists
            await this.loadPlaylistSections(collectionData);

            // Show dialog
            BPP.showDialog('link-playlist-dialog');

            // Focus on URL input after dialog is shown
            setTimeout(() => {
                document.getElementById('playlist-url').focus();
            }, 100);
        } catch (error) {
            console.error('Error loading playlist data:', error);
            BPP.showToast('Failed to load playlist data', 'error');
        }
    },

    async loadPlaylistSections(collectionData) {
        try {
            // 1. Render LINKED playlists for this collection
            const linkedPlaylists = collectionData.linked_playlists || [];
            console.log('Linked playlists:', linkedPlaylists);
            if (linkedPlaylists.length > 0) {
                document.getElementById('linked-playlists-section').style.display = 'block';
                const linkedContainer = document.getElementById('linked-playlists-list');
                linkedContainer.innerHTML = linkedPlaylists.map((playlist, index) => {
                    const hasArtwork = playlist.image_url && playlist.image_url.trim() !== '';
                    return `
                    <div class="recent-playlist-item playlist-draggable" data-playlist-id="${this.escapeHtml(playlist.playlist_id)}" data-section="linked" data-index="${index}" draggable="true">
                        ${hasArtwork
                            ? `<img src="${this.escapeHtml(playlist.image_url)}" alt="${this.escapeHtml(playlist.playlist_name)} artwork" class="playlist-artwork" loading="lazy">`
                            : `<div class="playlist-artwork-placeholder">
                                <i class="fa-brands fa-spotify"></i>
                               </div>`
                        }
                        <div class="recent-playlist-info">
                            <div class="recent-playlist-text">
                                <div class="recent-playlist-name">${this.escapeHtml(playlist.playlist_name || 'Untitled Playlist')}</div>
                                <div class="recent-playlist-meta text-xs text-muted">${playlist.track_count || 0} tracks</div>
                            </div>
                        </div>
                        <div class="recent-playlist-actions">
                            <button class="btn-icon btn-ghost unlink-playlist-btn" data-playlist-id="${this.escapeHtml(playlist.playlist_id)}" title="Unlink playlist">
                                <i class="fa-solid fa-unlink"></i>
                            </button>
                        </div>
                    </div>
                `}).join('');

                // Add click handlers for unlink buttons
                linkedContainer.querySelectorAll('.unlink-playlist-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const playlistId = btn.dataset.playlistId;
                        if (playlistId) {
                            this.unlinkPlaylist(playlistId);
                        }
                    });
                });
                
                // Setup drag-and-drop for reordering
                this.setupPlaylistDragAndDrop();
            } else {
                document.getElementById('linked-playlists-section').style.display = 'none';
            }

            // 2. Render OTHER recent playlists (not linked to this collection)
            const recentData = await BPP.apiCall('/api/v3/playlists/recent');
            const linkedIds = new Set(linkedPlaylists.map(p => p.playlist_id));
            const otherPlaylists = (recentData.playlists || []).filter(p => !linkedIds.has(p.id));

            if (otherPlaylists.length > 0) {
                document.getElementById('other-playlists-section').style.display = 'block';
                const otherContainer = document.getElementById('other-playlists-list');
                otherContainer.innerHTML = otherPlaylists.map(playlist => {
                    const hasArtwork = playlist.image_url && playlist.image_url.trim() !== '';
                    return `
                    <div class="recent-playlist-item" data-playlist-url="${this.escapeHtml(playlist.playlist_url)}" data-section="other">
                        ${hasArtwork
                            ? `<img src="${this.escapeHtml(playlist.image_url)}" alt="${this.escapeHtml(playlist.playlist_name)} artwork" class="playlist-artwork" loading="lazy">`
                            : `<div class="playlist-artwork-placeholder">
                                <i class="fa-brands fa-spotify"></i>
                               </div>`
                        }
                        <div class="recent-playlist-info">
                            <div class="recent-playlist-text">
                                <div class="recent-playlist-name">${this.escapeHtml(playlist.playlist_name)}</div>
                                <div class="recent-playlist-meta text-xs text-muted">${playlist.track_count || 0} tracks</div>
                            </div>
                        </div>
                        <div class="recent-playlist-actions">
                            <button class="btn-icon btn-ghost link-playlist-btn" data-playlist-url="${this.escapeHtml(playlist.playlist_url)}" title="Link playlist">
                                <i class="fa-solid fa-link"></i>
                            </button>
                        </div>
                    </div>
                `}).join('');

                // Add click handlers for link buttons
                otherContainer.querySelectorAll('.link-playlist-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const playlistUrl = btn.dataset.playlistUrl;
                        if (playlistUrl) {
                            this.linkPlaylistFromMemory(playlistUrl);
                        }
                    });
                });

                // Add click handlers for other playlists (select on click)
                otherContainer.querySelectorAll('.recent-playlist-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const url = item.dataset.playlistUrl;
                        document.getElementById('playlist-url').value = url;
                    });
                });
            } else {
                document.getElementById('other-playlists-section').style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading playlist sections:', error);
            document.getElementById('linked-playlists-section').style.display = 'none';
            document.getElementById('other-playlists-section').style.display = 'none';
        }
    },

    async addPlaylistToCollection() {
        const collectionId = document.getElementById('link-playlist-collection-id').value;
        const playlistUrl = document.getElementById('playlist-url').value.trim();

        if (!playlistUrl) {
            BPP.showToast('Please enter a Spotify playlist URL', 'error');
            return;
        }

        // Validate Spotify URL format
        if (!playlistUrl.includes('spotify.com/playlist/')) {
            BPP.showToast('Invalid Spotify playlist URL', 'error');
            return;
        }

        try {
            BPP.showLoading('Adding playlist...');

            await BPP.apiCall('/api/v3/playlists/import', {
                method: 'POST',
                body: JSON.stringify({
                    collection_id: collectionId,
                    playlist_url: playlistUrl
                })
            });

            BPP.hideLoading();
            BPP.showToast('Playlist added successfully!', 'success');

            // Clear URL input
            document.getElementById('playlist-url').value = '';

            // Reload playlist sections to show the newly added playlist
            const collectionData = await BPP.apiCall(`/api/v3/collections/${collectionId}`);
            await this.loadPlaylistSections(collectionData);

            // Reload collections to update counts
            CollectionsManager.loadCollections();

            // Refocus on input
            document.getElementById('playlist-url').focus();

        } catch (error) {
            BPP.hideLoading();
            console.error('Error adding playlist:', error);
            BPP.showToast('Failed to add playlist', 'error');
        }
    },

    async unlinkPlaylist(playlistId) {
        const collectionId = document.getElementById('link-playlist-collection-id').value;

        try {
            BPP.showLoading('Unlinking playlist...');

            await BPP.apiCall(`/api/v3/collections/${collectionId}/unlink-playlist`, {
                method: 'POST',
                body: JSON.stringify({ playlist_id: playlistId })
            });

            BPP.hideLoading();
            BPP.showToast('Playlist unlinked', 'success');

            // Reload playlist sections
            const collectionData = await BPP.apiCall(`/api/v3/collections/${collectionId}`);
            await this.loadPlaylistSections(collectionData);

            // Reload collections to update counts
            CollectionsManager.loadCollections();

            // Reset selection
            this.selectedPlaylistIndex = -1;
            this.refreshPlaylistElements();

        } catch (error) {
            BPP.hideLoading();
            console.error('Error unlinking playlist:', error);
            BPP.showToast('Failed to unlink playlist', 'error');
        }
    },

    async linkPlaylistFromMemory(playlistUrl) {
        const collectionId = document.getElementById('link-playlist-collection-id').value;

        try {
            BPP.showLoading('Linking playlist...');

            await BPP.apiCall('/api/v3/playlists/import', {
                method: 'POST',
                body: JSON.stringify({
                    collection_id: collectionId,
                    playlist_url: playlistUrl
                })
            });

            BPP.hideLoading();
            BPP.showToast('Playlist linked!', 'success');

            // Reload playlist sections
            const collectionData = await BPP.apiCall(`/api/v3/collections/${collectionId}`);
            await this.loadPlaylistSections(collectionData);

            // Reload collections to update counts
            CollectionsManager.loadCollections();

            // Reset selection
            this.selectedPlaylistIndex = -1;
            this.refreshPlaylistElements();

        } catch (error) {
            BPP.hideLoading();
            console.error('Error linking playlist:', error);
            BPP.showToast('Failed to link playlist', 'error');
        }
    },

    // ============================================================================
    // PLAYLIST DRAG-AND-DROP REORDERING
    // ============================================================================

    setupPlaylistDragAndDrop() {
        const linkedContainer = document.getElementById('linked-playlists-list');
        if (!linkedContainer) return;

        const playlistItems = linkedContainer.querySelectorAll('.playlist-draggable');

        playlistItems.forEach((item) => {
            item.addEventListener('dragstart', (e) => this.handleDragStart(e));
            item.addEventListener('dragend', (e) => this.handleDragEnd(e));
            item.addEventListener('dragover', (e) => this.handleDragOver(e));
            item.addEventListener('drop', (e) => this.handleDrop(e));
            item.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        });
    },

    handleDragStart(e) {
        this.draggedElement = e.currentTarget;
        this.draggedIndex = parseInt(e.currentTarget.getAttribute('data-index'));
        e.currentTarget.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    },

    handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        document.querySelectorAll('.playlist-draggable.drag-over').forEach(item => {
            item.classList.remove('drag-over');
        });
    },

    handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';

        const item = e.currentTarget;
        if (item !== this.draggedElement && item.classList.contains('playlist-draggable')) {
            item.classList.add('drag-over');
        }

        return false;
    },

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    },

    async handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        e.preventDefault();

        const dropTarget = e.currentTarget;
        dropTarget.classList.remove('drag-over');

        if (this.draggedElement !== dropTarget && dropTarget.classList.contains('playlist-draggable')) {
            const dropIndex = parseInt(dropTarget.getAttribute('data-index'));
            const collectionId = document.getElementById('link-playlist-collection-id').value;

            // Get current playlist IDs in order
            const linkedContainer = document.getElementById('linked-playlists-list');
            const playlistItems = Array.from(linkedContainer.querySelectorAll('.playlist-draggable'));
            const playlistIds = playlistItems.map(item => item.dataset.playlistId);

            // Reorder array
            const [movedId] = playlistIds.splice(this.draggedIndex, 1);
            playlistIds.splice(dropIndex, 0, movedId);

            // Save new order to backend
            await this.savePlaylistOrder(collectionId, playlistIds);
        }

        return false;
    },

    async savePlaylistOrder(collectionId, playlistIds) {
        try {
            BPP.showLoading('Saving order...');

            await BPP.apiCall(`/api/v3/collections/${collectionId}/reorder-playlists`, {
                method: 'POST',
                body: JSON.stringify({ playlist_ids: playlistIds })
            });

            BPP.hideLoading();
            BPP.showToast('Playlist order saved', 'success');

            // Reload to reflect new order
            const collectionData = await BPP.apiCall(`/api/v3/collections/${collectionId}`);
            await this.loadPlaylistSections(collectionData);

            // Reload collections to update artwork (first playlist determines collection art)
            CollectionsManager.loadCollections();

        } catch (error) {
            BPP.hideLoading();
            console.error('Error saving playlist order:', error);
            BPP.showToast('Failed to save order', 'error');

            // Reload to restore original order
            const collectionData = await BPP.apiCall(`/api/v3/collections/${collectionId}`);
            await this.loadPlaylistSections(collectionData);
        }
    },

    // ============================================================================
    // KEYBOARD NAVIGATION HELPERS
    // ============================================================================

    getAllPlaylistElements() {
        // Get all playlist items in both sections (visible only)
        const linkedSection = document.getElementById('linked-playlists-section');
        const otherSection = document.getElementById('other-playlists-section');
        const allItems = [];

        if (linkedSection && linkedSection.style.display !== 'none') {
            allItems.push(...Array.from(linkedSection.querySelectorAll('.recent-playlist-item')));
        }

        if (otherSection && otherSection.style.display !== 'none') {
            allItems.push(...Array.from(otherSection.querySelectorAll('.recent-playlist-item')));
        }

        return allItems;
    },

    refreshPlaylistElements() {
        this.playlistElements = this.getAllPlaylistElements();
        console.log(`Refreshed playlist elements: ${this.playlistElements.length} found`);
    },

    updatePlaylistFocus() {
        // Get fresh list of all playlist items
        const allItems = this.getAllPlaylistElements();

        // Remove previous focus from all items
        allItems.forEach(el => el.classList.remove('keyboard-selected'));

        // Add focus to selected (with bounds check)
        if (allItems.length > 0 && this.selectedPlaylistIndex >= 0 && this.selectedPlaylistIndex < allItems.length) {
            const selected = allItems[this.selectedPlaylistIndex];
            selected.classList.add('keyboard-selected');
            selected.scrollIntoView({ block: 'nearest', behavior: 'instant' }); // Instant, not smooth!
            this.currentPlaylistSection = selected.dataset.section;
            console.log(`Focused playlist ${this.selectedPlaylistIndex} (total: ${allItems.length}) in section: ${this.currentPlaylistSection}`);
        } else if (this.selectedPlaylistIndex >= allItems.length && allItems.length > 0) {
            // Selection out of bounds (e.g., after unlinking) - reset
            this.selectedPlaylistIndex = allItems.length - 1;
            const selected = allItems[this.selectedPlaylistIndex];
            selected.classList.add('keyboard-selected');
            selected.scrollIntoView({ block: 'nearest', behavior: 'instant' }); // Instant, not smooth!
            this.currentPlaylistSection = selected.dataset.section;
            console.log(`Reset to last playlist ${this.selectedPlaylistIndex}`);
        }
    },

    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Export to window for access from other scripts
window.PlaylistManager = PlaylistManager;
