// Band Practice App - Frontend JavaScript

let currentSong = null;
let allSongs = [];
let isEditMode = false;
let songSelectorSortByArtist = false;
let filteredSongs = [];
let selectedSongIndex = -1;

// Collection management
let currentCollection = null;
let allCollections = [];

// Reference to the apiCall function from viewer.html
// This will be passed in when initializeApp is called
let authenticatedApiCall = null;

// DOM Elements
const openSongSelectorBtn = document.getElementById('open-song-selector-btn');
const songSelectorDialog = document.getElementById('song-selector-dialog');
const songSelectorClose = document.getElementById('song-selector-close');
const songSearchInput = document.getElementById('song-search-input');
const songSelectorList = document.getElementById('song-selector-list');
const toggleSortBtn = document.getElementById('toggle-sort-btn');
const sortModeLabel = document.getElementById('sort-mode-label');
const songCountDisplay = document.getElementById('song-count-display');
const backToTopBtn = document.getElementById('back-to-top-btn');

const lyricsContent = document.getElementById('lyrics-content');
const lyricsContentInner = document.getElementById('lyrics-content-inner');
const notesView = document.getElementById('notes-view');
const notesEdit = document.getElementById('notes-edit');
const notesTextarea = document.getElementById('notes-textarea');
const songMetadata = document.getElementById('song-metadata');
const lyricsHeading = document.getElementById('lyrics-heading');
const statusMessage = document.getElementById('status-message');

const editNotesBtn = document.getElementById('edit-notes-btn');
const saveNotesBtn = document.getElementById('save-notes-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const refreshSongBtn = document.getElementById('refresh-song-btn');
const fetchBpmBtn = document.getElementById('fetch-bpm-btn');
const editLyricsBtn = document.getElementById('edit-lyrics-btn');
const deleteSongBtn = document.getElementById('delete-song-btn');
const toggleColumnsBtn = document.getElementById('toggle-columns-btn');
const fontSizeSelect = document.getElementById('font-size-select');

const lyricsEditorDialog = document.getElementById('lyrics-editor-dialog');
const lyricsEditorTitle = document.getElementById('lyrics-editor-title');
const lyricsEditorTextarea = document.getElementById('lyrics-editor-textarea');
const lyricsEditorSaveBtn = document.getElementById('lyrics-editor-save-btn');
const lyricsEditorCancelBtn = document.getElementById('lyrics-editor-cancel-btn');
const customizationBadge = document.getElementById('customization-badge');
const customizationBadgeMain = document.getElementById('customization-badge-main');
const insertVerseBtn = document.getElementById('insert-verse-btn');
const insertChorusBtn = document.getElementById('insert-chorus-btn');
const tightenLyricsBtn = document.getElementById('tighten-lyrics-btn');

const confirmDialog = document.getElementById('confirm-dialog');
const confirmDialogTitle = document.getElementById('confirm-dialog-title');
const confirmDialogMessage = document.getElementById('confirm-dialog-message');
const confirmDialogConfirmBtn = document.getElementById('confirm-dialog-confirm-btn');
const confirmDialogCancelBtn = document.getElementById('confirm-dialog-cancel-btn');

const bpmDialog = document.getElementById('bpm-dialog');
const bpmDialogTitle = document.getElementById('bpm-dialog-title');
const bpmDialogSongInfo = document.getElementById('bpm-dialog-song-info');
const bpmInput = document.getElementById('bpm-input');
const bpmDialogSaveBtn = document.getElementById('bpm-dialog-save-btn');
const bpmDialogCancelBtn = document.getElementById('bpm-dialog-cancel-btn');

// Collection DOM elements
const collectionBtn = document.getElementById('collection-btn');
const currentCollectionName = document.getElementById('current-collection-name');
const collectionDialog = document.getElementById('collection-dialog');
const collectionDialogClose = document.getElementById('collection-dialog-close');
const collectionList = document.getElementById('collection-list');
const newCollectionBtn = document.getElementById('new-collection-btn');
const editCollectionBtn = document.getElementById('edit-collection-btn');
const newCollectionDialog = document.getElementById('new-collection-dialog');
const editCollectionDialog = document.getElementById('edit-collection-dialog');
const collectionNameInput = document.getElementById('collection-name-input');
const collectionDescriptionInput = document.getElementById('collection-description-input');
const editCollectionNameInput = document.getElementById('edit-collection-name-input');
const editCollectionDescriptionInput = document.getElementById('edit-collection-description-input');
const newCollectionSaveBtn = document.getElementById('new-collection-save-btn');
const newCollectionCancelBtn = document.getElementById('new-collection-cancel-btn');
const editCollectionSaveBtn = document.getElementById('edit-collection-save-btn');
const editCollectionCancelBtn = document.getElementById('edit-collection-cancel-btn');

// Track the collection being edited
let editingCollectionId = null;

// Player DOM elements
const audioPlayer = document.getElementById('audio-player');
const miniPlayer = document.getElementById('mini-player');
const miniPlayerArtImg = document.getElementById('mini-player-art-img');
const miniPlayerTitle = document.getElementById('mini-player-title');
const miniPlayerArtist = document.getElementById('mini-player-artist');
const miniPlayerPlayBtn = document.getElementById('mini-player-play-btn');
const albumArtFloat = document.getElementById('album-art-float');
const albumArtImage = document.getElementById('album-art-image');

// BPM Indicator
let bpmIndicatorEnabled = true; // Always start enabled
let bpmIndicatorElement = null;

// Initialize - called from viewer.html after auth is complete
window.initializeApp = function(apiCallFunction) {
    console.log('🎸 Initializing app with authenticated API calls');
    authenticatedApiCall = apiCallFunction;

    // Initialize BPM indicator element reference
    bpmIndicatorElement = document.getElementById('bpm-indicator');

    loadFontSizePreference();
    loadBpmIndicatorPreference();
    loadUserInfo();
    loadCurrentCollection();  // Load collection first, then songs
    setupEventListeners();

    // NOW check Spotify status (after auth is complete)
    console.log('🎵 Checking Spotify connection status...');
    checkSpotifyStatus();
};

function setupEventListeners() {
    // Collection management
    collectionBtn.addEventListener('click', showCollectionDialog);
    collectionDialogClose.addEventListener('click', closeCollectionDialog);
    newCollectionBtn.addEventListener('click', showNewCollectionDialog);
    editCollectionBtn.addEventListener('click', showEditCollectionDialog);
    newCollectionSaveBtn.addEventListener('click', createNewCollection);
    newCollectionCancelBtn.addEventListener('click', closeNewCollectionDialog);
    editCollectionSaveBtn.addEventListener('click', saveEditedCollection);
    editCollectionCancelBtn.addEventListener('click', closeEditCollectionDialog);
    
    // Song selector
    openSongSelectorBtn.addEventListener('click', openSongSelector);
    songSelectorClose.addEventListener('click', closeSongSelector);
    toggleSortBtn.addEventListener('click', toggleSongSort);
    songSearchInput.addEventListener('input', filterSongs);
    songSearchInput.addEventListener('keyup', filterSongs);

    editNotesBtn.addEventListener('click', enterEditMode);
    saveNotesBtn.addEventListener('click', saveNotes);
    cancelEditBtn.addEventListener('click', exitEditMode);
    refreshSongBtn.addEventListener('click', refreshCurrentSong);
    fetchBpmBtn.addEventListener('click', manuallyFetchBpm);
    document.getElementById('set-bpm-btn').addEventListener('click', openBpmDialog);
    editLyricsBtn.addEventListener('click', openLyricsEditor);
    deleteSongBtn.addEventListener('click', deleteCurrentSong);
    lyricsEditorSaveBtn.addEventListener('click', saveLyrics);
    lyricsEditorCancelBtn.addEventListener('click', closeLyricsEditor);
    insertVerseBtn.addEventListener('click', insertVerse);
    insertChorusBtn.addEventListener('click', insertChorus);
    tightenLyricsBtn.addEventListener('click', tightenLyrics);

    // BPM dialog handlers
    bpmDialogSaveBtn.addEventListener('click', saveBpm);
    bpmDialogCancelBtn.addEventListener('click', closeBpmDialog);

    // Confirmation dialog close buttons
    confirmDialogCancelBtn.addEventListener('click', hideConfirmDialog);

    // Close dialogs when clicking outside
    songSelectorDialog.addEventListener('click', (e) => {
        if (e.target === songSelectorDialog) {
            closeSongSelector();
        }
    });

    lyricsEditorDialog.addEventListener('click', (e) => {
        if (e.target === lyricsEditorDialog) {
            closeLyricsEditor();
        }
    });

    toggleColumnsBtn.addEventListener('click', toggleColumns);
    fontSizeSelect.addEventListener('change', handleFontSizeChange);

    // Back to top button
    backToTopBtn.addEventListener('click', scrollToTop);

    // Player controls
    miniPlayerPlayBtn.addEventListener('click', toggleAudioPlayback);

    // Global keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeyboard);
}

// Global keyboard shortcut handler
function handleGlobalKeyboard(e) {
    // Ignore if user is typing in an input field
    const activeElement = document.activeElement;
    const isTyping = activeElement.tagName === 'INPUT' || 
                     activeElement.tagName === 'TEXTAREA' || 
                     activeElement.isContentEditable;

    // Don't process simple key shortcuts if user is typing
    if (isTyping) {
        return;
    }

    // Spacebar to toggle play/pause (only when not typing and when dialogs are closed)
    if (e.key === ' ' || e.code === 'Space') {
        // Check if any dialog is open - spacebar should not work in dialogs
        const dialogsOpen = 
            songSelectorDialog.style.display === 'flex' ||
            lyricsEditorDialog.style.display === 'flex' ||
            importDialog.style.display === 'flex' ||
            collectionDialog.style.display === 'flex' ||
            confirmDialog.style.display === 'flex' ||
            bpmDialog.style.display === 'flex';
        
        if (currentSong && !isTyping && !dialogsOpen) {
            e.preventDefault();
            toggleAudioPlayback();
            return;
        }
    }

    // X for collection selector
    if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        showCollectionDialog();
        return;
    }

    // P for playlist import
    if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        showImportDialog();
        return;
    }

    // S for song selector
    if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        openSongSelector();
        return;
    }

    // E to edit lyrics
    if (e.key === 'e' || e.key === 'E') {
        const editLyricsBtn = document.getElementById('edit-lyrics-btn');
        if (editLyricsBtn && !editLyricsBtn.disabled) {
            e.preventDefault();
            editLyricsBtn.click();
        }
        return;
    }

    // Ctrl+Shift+B to open BPM Tap Trainer
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        openBpmTapTrainer();
        return;
    }

    // Ctrl+B to toggle BPM indicator
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleBpmIndicator();
        return;
    }

    // B to set BPM
    if (e.key === 'b' || e.key === 'B') {
        const setBpmBtn = document.getElementById('set-bpm-btn');
        if (setBpmBtn && !setBpmBtn.disabled) {
            e.preventDefault();
            setBpmBtn.click();
        }
        return;
    }

    // F to fetch BPM online
    if (e.key === 'f' || e.key === 'F') {
        const fetchBpmBtn = document.getElementById('fetch-bpm-btn');
        if (fetchBpmBtn && !fetchBpmBtn.disabled) {
            e.preventDefault();
            fetchBpmBtn.click();
        }
        return;
    }

    // T to restart track (rewind to beginning)
    if (e.key === 't' || e.key === 'T') {
        if (currentSong && spotifyPlayerReady) {
            e.preventDefault();
            restartTrack();
        }
        return;
    }

    // N to edit notes
    if (e.key === 'n' || e.key === 'N') {
        const editNotesBtn = document.getElementById('edit-notes-btn');
        if (editNotesBtn && !editNotesBtn.disabled) {
            e.preventDefault();
            editNotesBtn.click();
        }
        return;
    }

    // C to toggle columns
    if (e.key === 'c' || e.key === 'C') {
        const toggleColumnsBtn = document.getElementById('toggle-columns-btn');
        if (toggleColumnsBtn && !toggleColumnsBtn.disabled) {
            e.preventDefault();
            toggleColumnsBtn.click();
        }
        return;
    }

    // Alt+D to delete song
    if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        const deleteSongBtn = document.getElementById('delete-song-btn');
        if (deleteSongBtn && !deleteSongBtn.disabled) {
            e.preventDefault();
            deleteSongBtn.click();
        }
        return;
    }

    // Arrow keys to navigate through notes OR adjust panel split in resize mode
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (navigateNotes(e.key === 'ArrowDown' ? 1 : -1)) {
            e.preventDefault();
        }
        return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (isInResizeMode) {
            e.preventDefault();
            adjustPanelSplit(e.key === 'ArrowRight' ? 2 : -2); // Adjust by 2% per keypress
        } else if (currentSong && spotifyPlayerReady) {
            // Skip backward 5 seconds with left arrow, forward 5 seconds with right arrow
            e.preventDefault();
            skipSeconds(e.key === 'ArrowRight' ? 5 : -5);
        }
        return;
    }

    // HOME to jump to first note and scroll to top
    if (e.key === 'Home') {
        e.preventDefault();
        jumpToFirstNote();
        return;
    }

    // END to jump to last note and scroll to bottom
    if (e.key === 'End') {
        e.preventDefault();
        jumpToLastNote();
        return;
    }

    // R to enter panel resize mode
    if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        toggleResizeMode();
        return;
    }

    // Enter to exit resize mode
    if (e.key === 'Enter' && isInResizeMode) {
        e.preventDefault();
        exitResizeMode();
        return;
    }

    // Escape to cancel resize mode
    if (e.key === 'Escape' && isInResizeMode) {
        e.preventDefault();
        exitResizeMode();
        return;
    }

    // / or ? to toggle help card
    if (e.key === '/' || e.key === '?') {
        e.preventDefault();
        toggleHelpCard();
        return;
    }
}

// Toggle help card visibility
let helpCardVisible = false;
const keyboardShortcutsHelp = document.querySelector('.keyboard-shortcuts-help');
const helpCard = document.querySelector('.help-card');

function toggleHelpCard() {
    if (!keyboardShortcutsHelp || !helpCard) return;

    helpCardVisible = !helpCardVisible;

    if (helpCardVisible) {
        // Show help card
        helpCard.style.opacity = '1';
        helpCard.style.visibility = 'visible';
        helpCard.style.transform = 'translateY(0)';
        helpCard.style.pointerEvents = 'auto';
    } else {
        // Hide help card
        helpCard.style.opacity = '0';
        helpCard.style.visibility = 'hidden';
        helpCard.style.transform = 'translateY(-10px)';
        helpCard.style.pointerEvents = 'none';
    }
}

// API Functions
async function loadUserInfo() {
    try {
        const response = await authenticatedApiCall('/api/user');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.user) {
                document.getElementById('user-email').textContent = data.user.email;
            }
        }
    } catch (error) {
        console.error('Error loading user info:', error);
        document.getElementById('user-email').textContent = 'User';
    }
}

async function loadSongs() {
    try {
        showLoading('Loading songs...');
        
        // Build query with collection filter
        let url = '/api/songs';
        if (currentCollection && currentCollection.id) {
            url += `?collection_id=${encodeURIComponent(currentCollection.id)}`;
        }
        
        const response = await authenticatedApiCall(url);
        const data = await response.json();

        if (data.success) {
            allSongs = data.songs;
            console.log(`✅ Loaded ${allSongs.length} songs from collection ${currentCollection?.name}`);
            updateCurrentSongDisplay();
            // If song selector is open, refresh the list
            if (songSelectorDialog && songSelectorDialog.style.display === 'flex') {
                filterSongs();
            }
            setStatus(`${allSongs.length} songs loaded`, 'success');
        } else {
            showToast('Failed to load songs', 'error');
        }
    } catch (error) {
        console.error('Error loading songs:', error);
        showToast('Error loading songs: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loadSong(songId) {
    try {
        showLoading('Loading song...');
        const response = await authenticatedApiCall(`/api/songs/${songId}`);
        const data = await response.json();

        if (data.success) {
            currentSong = data.song;
            renderSong();
            updateCurrentSongDisplay();
            refreshSongBtn.disabled = false;
            editNotesBtn.disabled = false;
            editLyricsBtn.disabled = false;
            deleteSongBtn.disabled = false;
            fetchBpmBtn.disabled = false;
            document.getElementById('set-bpm-btn').disabled = false;
            setStatus('Song loaded', 'success');

            // Load saved preferences for this song
            loadColumnPreference(currentSong.id);
            loadPanelSplit(currentSong.id);

            // Fetch lyrics in background if they haven't been fetched yet
            if (currentSong.lyrics_fetched === false) {
                fetchLyricsInBackground(currentSong.id, currentSong.title, currentSong.artist);
            }

            // Fetch BPM in background if not available or if it was marked as not found
            if (!currentSong.bpm || currentSong.bpm === 'N/A' || currentSong.bpm === 'NOT_FOUND') {
                // Only auto-fetch if it's truly missing (N/A), not if it was previously marked NOT_FOUND
                if (currentSong.bpm !== 'NOT_FOUND') {
                    fetchBpmInBackground(currentSong.id, currentSong.title, currentSong.artist);
                }
            }
        } else {
            showToast('Failed to load song', 'error');
        }
    } catch (error) {
        showToast('Error loading song: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function fetchBpmInBackground(songId, title, artist) {
    try {
        console.log(`🎵 Fetching BPM for ${title} by ${artist} in background...`);
        const response = await authenticatedApiCall(`/api/songs/${songId}/bpm`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success && currentSong && currentSong.id === songId) {
            // Only update if we're still viewing the same song
            currentSong.bpm = data.bpm;
            currentSong.bpm_manual = false; // Clear manual flag since this is from API
            renderMetadata();
            console.log(`✅ BPM updated: ${data.bpm}`);
            
            // Update the song in the allSongs array so selector reflects the change
            const songIndex = allSongs.findIndex(s => s.id === songId);
            if (songIndex !== -1) {
                allSongs[songIndex].bpm = data.bpm;
                allSongs[songIndex].bpm_manual = false;
            }
            
            // Update status message based on result (append to existing status)
            if (data.bpm && data.bpm !== 'N/A' && data.bpm !== 'NOT_FOUND') {
                const currentStatus = statusMessage.textContent;
                if (currentStatus) {
                    setStatus(`${currentStatus} • BPM updated: ${data.bpm}`, 'success');
                } else {
                    setStatus(`BPM updated: ${data.bpm}`, 'success');
                }
            } else if (data.bpm === 'NOT_FOUND') {
                const currentStatus = statusMessage.textContent;
                if (currentStatus) {
                    setStatus(`${currentStatus} • BPM not found`, 'info');
                }
            }
        }
    } catch (error) {
        console.error(`Error fetching BPM for ${title}:`, error);
        // Update UI to remove loading indicator even on error
        if (currentSong && currentSong.id === songId) {
            renderMetadata();
        }
        // Silently fail - don't show error to user as this is background operation
    }
}

async function fetchLyricsInBackground(songId, title, artist) {
    try {
        console.log(`📜 Fetching lyrics for ${title} by ${artist} in background...`);
        
        // Show loading indicator in the lyrics panel
        if (currentSong && currentSong.id === songId) {
            setStatus('Loading lyrics...', 'info');
        }

        const response = await authenticatedApiCall(`/api/songs/${songId}/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ force_overwrite: false })
        });

        const data = await response.json();

        if (data.success && currentSong && currentSong.id === songId) {
            // Only update if we're still viewing the same song
            currentSong.lyrics = data.song.lyrics || '';
            currentSong.lyrics_numbered = data.song.lyrics_numbered || '';
            currentSong.lyrics_fetched = true;
            currentSong.is_customized = data.song.is_customized || false;
            
            // Re-render the song to show the lyrics
            renderSong();
            console.log(`✅ Lyrics loaded successfully`);
            
            // Update the song in the allSongs array
            const songIndex = allSongs.findIndex(s => s.id === songId);
            if (songIndex !== -1) {
                allSongs[songIndex].lyrics = currentSong.lyrics;
                allSongs[songIndex].lyrics_numbered = currentSong.lyrics_numbered;
                allSongs[songIndex].lyrics_fetched = true;
                allSongs[songIndex].is_customized = currentSong.is_customized;
            }
            
            setStatus('Song loaded • Lyrics updated', 'success');
        } else if (data.requires_confirmation) {
            // Song has customized lyrics - this shouldn't happen on first fetch, but handle it
            console.log(`⚠️ Song already has customized lyrics`);
        } else {
            console.error(`Failed to fetch lyrics: ${data.error || 'Unknown error'}`);
            if (currentSong && currentSong.id === songId) {
                setStatus('Song loaded • Lyrics not available', 'warning');
            }
        }
    } catch (error) {
        console.error(`Error fetching lyrics for ${title}:`, error);
        if (currentSong && currentSong.id === songId) {
            setStatus('Song loaded • Failed to fetch lyrics', 'error');
        }
        // Don't show toast - this is a background operation
    }
}

async function manuallyFetchBpm() {
    if (!currentSong) return;
    
    // If BPM is manually set, show confirmation dialog
    if (currentSong.bpm_manual === true) {
        showConfirmDialog(
            'Overwrite Manual BPM?',
            `This song has a manually set BPM (${currentSong.bpm}). Fetching will replace it with the automatic lookup.\n\nAre you sure you want to continue?`,
            async () => {
                setStatus('Fetching BPM...', 'info');
                await fetchBpmInBackground(currentSong.id, currentSong.title, currentSong.artist);
            }
        );
        return;
    }
    
    // If not manual, just fetch directly
    setStatus('Fetching BPM...', 'info');
    await fetchBpmInBackground(currentSong.id, currentSong.title, currentSong.artist);
}


async function saveNotes() {
    if (!currentSong) return;

    try {
        showLoading('Saving notes...');
        const notes = notesTextarea.value;

        const response = await authenticatedApiCall(`/api/songs/${currentSong.id}/notes`, {
            method: 'PUT',
            body: JSON.stringify({ notes })
        });

        const data = await response.json();

        if (data.success) {
            currentSong.notes = notes;
            exitEditMode();
            renderNotes();
            // showToast('Notes saved successfully!', 'success');
            setStatus('Notes saved', 'success');
        } else {
            showToast('Failed to save notes', 'error');
        }
    } catch (error) {
        showToast('Error saving notes: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}


async function refreshCurrentSong() {
    if (!currentSong) return;

    // If song is customized, show confirmation dialog
    if (currentSong.is_customized) {
        showConfirmDialog(
            'Overwrite Customized Lyrics?',
            `This song has customized lyrics. Refreshing will overwrite your custom changes with lyrics from Genius.\n\nAre you sure you want to continue?`,
            async () => {
                await performRefresh(true);
            }
        );
        return;
    }

    // If not customized, just refresh directly
    await performRefresh(false);
}

async function performRefresh(forceOverwrite) {
    if (!currentSong) return;

    try {
        showLoading('Refreshing lyrics...');

        const response = await authenticatedApiCall(`/api/songs/${currentSong.id}/refresh`, {
            method: 'POST',
            body: JSON.stringify({ force_overwrite: forceOverwrite })
        });

        const data = await response.json();

        if (data.success) {
            currentSong = data.song;
            renderSong();
            showToast('Lyrics refreshed!', 'success');
            setStatus('Lyrics refreshed', 'success');
        } else if (data.requires_confirmation) {
            // This shouldn't happen now since we check on the client side, but keep as fallback
            showConfirmDialog(
                'Overwrite Customized Lyrics?',
                data.message,
                async () => {
                    await performRefresh(true);
                }
            );
        } else {
            showToast('Failed to refresh lyrics: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error refreshing lyrics: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function deleteCurrentSong() {
    if (!currentSong) return;

    const songTitle = `${currentSong.title} - ${currentSong.artist}`;

    showConfirmDialog(
        'Delete Song?',
        `Are you sure you want to delete "${songTitle}" from the database?\n\nThis action cannot be undone.`,
        async () => {
            try {
                showLoading('Deleting song...');

                const response = await authenticatedApiCall(`/api/songs/${currentSong.id}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    showToast(data.message, 'success');
                    setStatus('Song deleted', 'success');

                    // Clear current song
                    currentSong = null;

                    // Show the "Lyrics" heading again
                    if (lyricsHeading) {
                        lyricsHeading.style.display = 'block';
                        lyricsHeading.textContent = 'Lyrics';
                    }

                    // Disable buttons
                    refreshSongBtn.disabled = true;
                    editNotesBtn.disabled = true;
                    editLyricsBtn.disabled = true;
                    deleteSongBtn.disabled = true;
                    fetchBpmBtn.disabled = true;

                    // Clear displays
                    lyricsContentInner.innerHTML = '<div class="empty-state"><p>Select a song to view lyrics</p></div>';
                    notesView.innerHTML = '<div class="empty-state"><p>Select a song to view notes</p></div>';
                    songMetadata.innerHTML = '';

                    // Update current song display
                    updateCurrentSongDisplay();

                    // Reload song list
                    await loadSongs();
                } else {
                    showToast('Failed to delete song: ' + data.error, 'error');
                }
            } catch (error) {
                showToast('Error deleting song: ' + error.message, 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

function openSongSelector() {
    songSelectorDialog.style.display = 'flex';
    songSearchInput.value = '';

    // Initialize filtered songs with all songs
    filteredSongs = [...allSongs];

    // Sort by title initially
    filteredSongs.sort((a, b) => a.title.localeCompare(b.title));

    renderSongList();

    songSearchInput.focus();

    // Add keyboard handler for song selector
    document.addEventListener('keydown', handleSongSelectorKeyboard);
}

function closeSongSelector() {
    songSelectorDialog.style.display = 'none';
    selectedSongIndex = -1;
    
    // Remove keyboard handler
    document.removeEventListener('keydown', handleSongSelectorKeyboard);
}

function toggleSongSort() {
    songSelectorSortByArtist = !songSelectorSortByArtist;
    sortModeLabel.textContent = songSelectorSortByArtist ? 'Sort: Artist (Alt+T)' : 'Sort: Song (Alt+T)';
    filterSongs();
}

function filterSongs() {
    try {
        const searchTerm = songSearchInput.value.toLowerCase();

        // Filter songs
        filteredSongs = allSongs.filter(song => {
            const title = song.title.toLowerCase();
            const artist = song.artist.toLowerCase();
            return title.includes(searchTerm) || artist.includes(searchTerm);
        });

        // Log search info
        if (searchTerm) {
            console.log(`🔍 Search: "${searchTerm}" - ${filteredSongs.length} results`);
        }

        // Sort songs
        filteredSongs.sort((a, b) => {
            if (songSelectorSortByArtist) {
                const artistCompare = a.artist.localeCompare(b.artist);
                return artistCompare !== 0 ? artistCompare : a.title.localeCompare(b.title);
            } else {
                return a.title.localeCompare(b.title);
            }
        });

        renderSongList();
    } catch (error) {
        console.error('❌ Error in filterSongs:', error);
    }
}

function renderSongList() {
    try {
        const listElement = document.getElementById('song-selector-list');

        if (!listElement) {
            console.error('❌ song-selector-list element not found!');
            return;
        }

        if (allSongs.length === 0) {
            listElement.innerHTML = '<div class="empty-state"><p>No songs in database. Import a playlist!</p></div>';
            if (songCountDisplay) songCountDisplay.textContent = '0 songs';
            return;
        }

        if (filteredSongs.length === 0) {
            listElement.innerHTML = '<div class="empty-state"><p>No songs match your search</p></div>';
            if (songCountDisplay) songCountDisplay.textContent = `0 of ${allSongs.length} songs`;
            return;
        }

        if (songCountDisplay) songCountDisplay.textContent = `${filteredSongs.length} song${filteredSongs.length !== 1 ? 's' : ''}`;

        let html = '';
        filteredSongs.forEach((song, index) => {
            const selectedClass = index === selectedSongIndex ? 'selected' : '';
            const albumArtHtml = song.album_art_url
                ? `<img src="${escapeHtml(song.album_art_url)}" alt="Album art" class="song-selector-item-art">`
                : `<div class="song-selector-item-art-placeholder">🎵</div>`;

            // Format BPM display with manual indicator if applicable
            let bpmDisplay = song.bpm || 'N/A';
            if (song.bpm && song.bpm !== 'N/A' && song.bpm !== 'NOT_FOUND' && song.bpm_manual) {
                bpmDisplay = `${song.bpm}<span class="bpm-manual-badge-small" title="Manually set tempo"><i class="fa-solid fa-pen-to-square"></i></span>`;
            }

            html += `<div class="song-selector-item ${selectedClass}" data-song-index="${index}" data-song-id="${song.id}">
${albumArtHtml}
<div class="song-selector-item-info">
<div class="song-selector-item-main">
<div class="song-selector-item-title">${escapeHtml(song.title)}</div>
<div class="song-selector-item-artist"><i class="fa-solid fa-microphone"></i> ${escapeHtml(song.artist)}</div>
</div>
<div class="song-selector-item-meta">
<div class="song-selector-item-meta-row"><i class="fa-solid fa-compact-disc"></i> ${escapeHtml(song.album || 'N/A')}</div>
<div class="song-selector-item-meta-row"><i class="fa-solid fa-calendar"></i> ${song.year || 'N/A'} • <i class="fa-solid fa-drum"></i> ${bpmDisplay}</div>
</div>
</div>
</div>`;
        });

        listElement.innerHTML = html;

        // Add click handlers
        document.querySelectorAll('.song-selector-item').forEach(item => {
            item.addEventListener('click', () => {
                selectSong(item.dataset.songId);
            });
        });

        if (selectedSongIndex >= filteredSongs.length) {
            selectedSongIndex = filteredSongs.length - 1;
        }
    } catch (error) {
        console.error('❌ Error in renderSongList:', error);
        console.error('Stack:', error.stack);
    }
}

async function selectSong(songId) {
    // Stop playback if currently playing
    if (spotifyPlayer && spotifyPlayerReady) {
        try {
            const state = await spotifyPlayer.getCurrentState();
            if (state && !state.paused) {
                await spotifyPlayer.pause();
                console.log('⏸ Paused playback when switching songs');
            }
        } catch (error) {
            console.warn('Could not pause playback:', error);
        }
    }

    // Stop BPM indicator pulsing (but keep toggle state)
    stopBpmIndicatorPulsing();

    closeSongSelector();
    loadSong(songId);
}

function handleSongSelectorKeyboard(e) {
    // Only handle if song selector is visible
    if (songSelectorDialog.style.display !== 'flex') return;
    
    // ESC to close
    if (e.key === 'Escape') {
        e.preventDefault();
        closeSongSelector();
        return;
    }
    
    // Alt+T to toggle sort
    if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        toggleSongSort();
        return;
    }
    
    // Arrow keys for navigation
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedSongIndex < filteredSongs.length - 1) {
            selectedSongIndex++;
            updateSongListSelection();
        }
        return;
    }
    
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedSongIndex > 0) {
            selectedSongIndex--;
            updateSongListSelection();
        } else if (selectedSongIndex === -1 && filteredSongs.length > 0) {
            selectedSongIndex = 0;
            updateSongListSelection();
        }
        return;
    }
    
    // Enter to select
    if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedSongIndex >= 0 && selectedSongIndex < filteredSongs.length) {
            const song = filteredSongs[selectedSongIndex];
            selectSong(song.id);
        }
        return;
    }
}

function updateSongListSelection() {
    // Remove all selected classes
    document.querySelectorAll('.song-selector-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add selected class to current index
    if (selectedSongIndex >= 0) {
        const items = document.querySelectorAll('.song-selector-item');
        if (items[selectedSongIndex]) {
            items[selectedSongIndex].classList.add('selected');
            items[selectedSongIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

function updateCurrentSongDisplay() {
    if (currentSong) {
        setStatus(`Song loaded: ${currentSong.title} - ${currentSong.artist}`, 'success');
    } else {
        setStatus('', 'info');
    }
}

function populateSongSelect() {
    // No longer needed - keeping for compatibility
    updateCurrentSongDisplay();
}

function handleSongChange(e) {
    // No longer needed - keeping for compatibility
}

function renderSong() {
    if (!currentSong) return;

    renderMetadata();
    renderLyrics();
    renderNotes();
    updateCurrentSongDisplay();
    updatePlayerVisibility();
}

function renderMetadata() {
    const songIcon = document.getElementById('song-icon');

    // Show the song name and icon when a song is selected
    if (lyricsHeading) {
        lyricsHeading.style.display = 'block';
        lyricsHeading.textContent = currentSong.title;

        // Show song icon
        if (songIcon) {
            songIcon.style.display = 'inline';
        }
    }

    // Show/hide customization badge in main view
    if (customizationBadgeMain) {
        if (currentSong.is_customized) {
            customizationBadgeMain.style.display = 'inline-flex';
        } else {
            customizationBadgeMain.style.display = 'none';
        }
    }

    const metadata = [
        { icon: '<i class="fa-solid fa-microphone"></i>', label: 'Artist', value: currentSong.artist || 'N/A' },
        { icon: '<i class="fa-solid fa-compact-disc"></i>', label: 'Album', value: currentSong.album || 'N/A' },
        { icon: '<i class="fa-solid fa-calendar"></i>', label: 'Year', value: currentSong.year || 'N/A' }
    ];

    // Build standard metadata HTML
    let metadataHtml = metadata.map(item =>
        `<div class="metadata-item"><span class="metadata-icon">${item.icon}</span> ${item.value}</div>`
    ).join('');

    // Add BPM as a separate animated block
    const bpmValue = currentSong.bpm || 'N/A';
    const isManualBpm = currentSong.bpm_manual === true;
    let bpmBlockContent;

    if (bpmValue === 'NOT_FOUND') {
        // Show special icon for "not found" status
        bpmBlockContent = '<i class="fa-solid fa-drum"></i> <span style="color: var(--text-muted);" title="BPM lookup failed - click Set BPM to enter manually">⊘</span>';
    } else if (bpmValue === 'N/A') {
        // Show loading indicator for pending lookup
        bpmBlockContent = '<i class="fa-solid fa-drum"></i> N/A <i class="fa-solid fa-hourglass-half bpm-loading"></i>';
    } else {
        // Show BPM block with drum icon, value, animated metronome, and optional manual badge
        const manualBadge = isManualBpm ? '<span class="bpm-manual-badge" title="Manually set tempo"><i class="fa-solid fa-pen-to-square"></i></span>' : '';
        bpmBlockContent = `<i class="fa-solid fa-drum"></i> ${bpmValue} <i class="fa-solid fa-bars-staggered bpm-metronome-icon" id="bpm-metronome-icon"></i>${manualBadge}`;
    }

    // Add the BPM block with animation container
    metadataHtml += `<div class="bpm-indicator-block" id="bpm-indicator-block">${bpmBlockContent}</div>`;

    // Note: Custom lyric badge is now shown in the header next to song name, not in metadata

    songMetadata.innerHTML = metadataHtml;

    // Re-get the BPM indicator block reference since we just recreated it
    bpmIndicatorElement = document.getElementById('bpm-indicator-block');

    // BPM indicator is now persistent in DOM, just update its state
    updateBpmIndicator();
}

function renderLyrics() {
    // Check if lyrics are being fetched
    if (currentSong.lyrics_fetched === false) {
        lyricsContentInner.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-hourglass-half" style="font-size: 2em; color: var(--accent-color); margin-bottom: 1em;"></i>
                <p>Loading lyrics...</p>
            </div>`;
        return;
    }

    const lyrics = currentSong.lyrics_numbered || currentSong.lyrics || '';
    const lines = lyrics.split('\n');
    let html = '';

    lines.forEach(line => {
        if (line.match(/^\*\*\[.*\]\*\*/)) {
            // Section header
            const header = line.replace(/\*\*/g, '').trim();
            html += `<div class="lyrics-line section-header">${header}</div>`;
        } else if (line.match(/^\s*\d+\s+/)) {
            // Numbered line
            const match = line.match(/^(\s*)(\d+)(\s+)(.+)/);
            if (match) {
                const lineNum = match[2].trim();
                const text = match[4];
                html += `<div class="lyrics-line" data-line="${lineNum}">
                    <span class="line-number">${lineNum}</span>${escapeHtml(text)}
                </div>`;
            }
        } else if (line.trim()) {
            html += `<div class="lyrics-line">${escapeHtml(line)}</div>`;
        }
    });

    lyricsContentInner.innerHTML = html || '<div class="empty-state"><p>No lyrics available</p></div>';
}

function renderNotes() {
    const notes = currentSong.notes || '';
    let html = '';

    // Render practice notes if available
    if (!notes.trim()) {
        html += '<div class="empty-state"><p>No notes yet. Click Edit to add practice notes.</p></div>';
    } else {
        const noteBlocks = parseNotes(notes);
        noteBlocks.forEach(block => {
            const dataAttr = block.lineStart ?
                `data-line-start="${block.lineStart}" data-line-end="${block.lineEnd}"` : '';

            html += `
                <div class="note-block" ${dataAttr} onclick="highlightLines(this)">
                    <div class="note-header">${escapeHtml(block.header)}</div>
                    <div class="note-content">${escapeHtml(block.content)}</div>
                </div>
            `;
        });
    }

    // Always add song structure if available (separate from notes)
    const structure = extractSongStructure();
    if (structure.length > 0) {
        html += '<div class="song-structure-section">';
        html += '<div class="song-structure-title">Song Structure</div>';
        html += '<div class="song-structure-blocks">';
        structure.forEach((section, index) => {
            html += `<div class="song-structure-block">${escapeHtml(section)}</div>`;
            // Add arrow between blocks (but not after the last one)
            if (index < structure.length - 1) {
                html += '<i class="fa-solid fa-arrow-right song-structure-arrow"></i>';
            }
        });
        html += '</div>';
        html += '</div>';
    }

    notesView.innerHTML = html;
}

// Extract song structure from lyrics (section headers in square brackets)
function extractSongStructure() {
    if (!currentSong || !currentSong.lyrics) return [];

    const lyrics = currentSong.lyrics;
    const structure = [];
    const regex = /\[([^\]]+)\]/g;
    let match;

    while ((match = regex.exec(lyrics)) !== null) {
        structure.push(match[1]);
    }

    return structure;
}

function parseNotes(notesText) {
    const lines = notesText.split('\n');
    const blocks = [];
    let currentBlock = null;
    let currentContent = [];

    lines.forEach(line => {
        if (line.startsWith('#') || (!currentBlock && !line.trim())) {
            return;
        }

        // Match formats:
        // "START: note" or "END: note"
        // "Line 12: note" or "Lines 45-48: note"
        // "12: note" or "45-48: note"
        const specialMatch = line.match(/^(START|END):(.*)$/i);
        const lineMatch = line.match(/^(Lines?\s+)?(\d+(-\d+)?):(.*)$/i);

        if (specialMatch) {
            if (currentBlock) {
                blocks.push({
                    header: currentBlock,
                    content: currentContent.join('\n').trim(),
                    ...extractLineNumbers(currentBlock)
                });
            }

            currentBlock = specialMatch[1].toUpperCase();
            currentContent = [specialMatch[2].trim()];
        } else if (lineMatch) {
            if (currentBlock) {
                blocks.push({
                    header: currentBlock,
                    content: currentContent.join('\n').trim(),
                    ...extractLineNumbers(currentBlock)
                });
            }

            // Build display header with "Line" or "Lines"
            const lineNumbers = lineMatch[2];
            const isRange = lineNumbers.includes('-');
            const displayHeader = (isRange ? 'Lines ' : 'Line ') + lineNumbers;

            currentBlock = displayHeader;
            currentContent = [lineMatch[4].trim()];
        } else if (currentBlock && line.trim()) {
            currentContent.push(line);
        }
    });

    if (currentBlock) {
        blocks.push({
            header: currentBlock,
            content: currentContent.join('\n').trim(),
            ...extractLineNumbers(currentBlock)
        });
    }

    return blocks;
}

function extractLineNumbers(header) {
    const match = header.match(/(\d+)(-(\d+))?/);
    if (!match) return {};

    return {
        lineStart: match[1],
        lineEnd: match[3] || match[1]
    };
}

function highlightLines(noteBlock) {
    // Remove previous highlights
    document.querySelectorAll('.lyrics-line.highlighted').forEach(el => {
        el.classList.remove('highlighted');
    });
    document.querySelectorAll('.note-block.active').forEach(el => {
        el.classList.remove('active');
    });

    // Add active state
    noteBlock.classList.add('active');

    const lineStart = parseInt(noteBlock.dataset.lineStart);
    const lineEnd = parseInt(noteBlock.dataset.lineEnd);

    if (!lineStart) return;

    // Highlight lines
    const lyricsLines = document.querySelectorAll('.lyrics-line[data-line]');
    lyricsLines.forEach(line => {
        const lineNum = parseInt(line.dataset.line);
        if (lineNum >= lineStart && lineNum <= lineEnd) {
            line.classList.add('highlighted');
            if (lineNum === lineStart) {
                // Only scroll if the line is not visible in the viewport
                scrollIntoViewIfNeeded(line);
            }
        }
    });
}

function scrollIntoViewIfNeeded(element) {
    // Get the scrollable container (lyrics-content which is the panel-content)
    const lyricsContainer = document.getElementById('lyrics-content');
    if (!lyricsContainer || !element) {
        return;
    }

    // Get container bounds
    const containerRect = lyricsContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    
    // Check if element is already fully visible in the container
    const isVisible = (
        elementRect.top >= containerRect.top &&
        elementRect.bottom <= containerRect.bottom
    );
    
    // If already visible, no need to scroll
    if (isVisible) {
        return;
    }
    
    // Calculate how much to scroll
    // We want to center the element in the container
    const containerHeight = lyricsContainer.clientHeight;
    const elementHeight = element.offsetHeight;
    
    // Get current scroll position and element position relative to the container
    const currentScroll = lyricsContainer.scrollTop;
    const elementTop = elementRect.top - containerRect.top;
    
    // Calculate target scroll to center the element
    const targetScroll = currentScroll + elementTop - (containerHeight / 2) + (elementHeight / 2);
    
    // Smoothly scroll ONLY the lyrics container, not the page
    lyricsContainer.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
    });
}

function navigateNotes(direction) {
    // Get all note blocks
    const noteBlocks = Array.from(document.querySelectorAll('.note-block'));
    
    // No notes to navigate
    if (noteBlocks.length === 0) {
        return false;
    }

    // Find currently active note
    const activeIndex = noteBlocks.findIndex(block => block.classList.contains('active'));

    let nextIndex;
    if (activeIndex === -1) {
        // No active note, select first or last based on direction
        nextIndex = direction > 0 ? 0 : noteBlocks.length - 1;
    } else {
        // Check if we're already at a boundary before moving
        if (direction < 0 && activeIndex === 0) {
            // Already at first note, going up - scroll to top
            scrollToTop();
            return false;
        } else if (direction > 0 && activeIndex === noteBlocks.length - 1) {
            // Already at last note, going down - scroll to bottom
            scrollToBottom();
            return false;
        }
        
        // Move to next/previous note
        nextIndex = activeIndex + direction;
    }

    // Highlight the selected note
    const nextNoteBlock = noteBlocks[nextIndex];
    highlightLines(nextNoteBlock);
    
    // Scroll the note block into view in the notes panel
    nextNoteBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    return true;
}

// Scroll lyrics and notes to bottom
function scrollToBottom() {
    const lyricsContainer = document.getElementById('lyrics-content');
    if (lyricsContainer) {
        lyricsContainer.scrollTo({
            top: lyricsContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    // Also scroll notes panel to bottom to reveal song structure
    const notesContainer = document.getElementById('notes-view');
    if (notesContainer && notesContainer.parentElement) {
        notesContainer.parentElement.scrollTo({
            top: notesContainer.parentElement.scrollHeight,
            behavior: 'smooth'
        });
    }
}

// Jump to first note and scroll to top
function jumpToFirstNote() {
    const noteBlocks = Array.from(document.querySelectorAll('.note-block'));
    
    if (noteBlocks.length === 0) {
        return;
    }
    
    // Highlight first note
    const firstNote = noteBlocks[0];
    highlightLines(firstNote);
    
    // Scroll note into view in notes panel
    firstNote.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Scroll lyrics to top
    scrollToTop();
}

// Jump to last note and scroll to bottom
function jumpToLastNote() {
    const noteBlocks = Array.from(document.querySelectorAll('.note-block'));
    
    if (noteBlocks.length === 0) {
        return;
    }
    
    // Highlight last note
    const lastNote = noteBlocks[noteBlocks.length - 1];
    highlightLines(lastNote);
    
    // Scroll note into view in notes panel
    lastNote.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Scroll lyrics to bottom
    scrollToBottom();
}

// Edit Mode Functions
function enterEditMode() {
    isEditMode = true;
    notesTextarea.value = currentSong.notes || '';
    notesView.style.display = 'none';
    notesEdit.style.display = 'flex';
    editNotesBtn.style.display = 'none';
    saveNotesBtn.style.display = 'inline-flex';
    cancelEditBtn.style.display = 'inline-flex';
    notesTextarea.focus();

    // Add keyboard shortcuts for notes editor
    document.addEventListener('keydown', handleNotesEditorKeyboard);
}

function exitEditMode() {
    isEditMode = false;
    notesView.style.display = 'block';
    notesEdit.style.display = 'none';
    editNotesBtn.style.display = 'inline-flex';
    saveNotesBtn.style.display = 'none';
    cancelEditBtn.style.display = 'none';

    // Remove keyboard shortcuts
    document.removeEventListener('keydown', handleNotesEditorKeyboard);
}

function handleNotesEditorKeyboard(e) {
    // Only handle if in edit mode
    if (!isEditMode) return;

    // ESC to cancel
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        exitEditMode();
        return;
    }

    // Ctrl+S or Ctrl+Enter to save
    if (e.ctrlKey && (e.key === 's' || e.key === 'Enter')) {
        e.preventDefault();
        e.stopPropagation();
        saveNotes();
        return;
    }
}

// Event Handlers
// UI Helper Functions
function showLoading(message = 'Loading...') {
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-message').textContent = message;
    // Hide details by default
    document.getElementById('loading-details').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
    document.getElementById('loading-details').style.display = 'none';
}

function showLoadingDetails(playlistInfo) {
    const detailsEl = document.getElementById('loading-details');
    const playlistInfoEl = document.getElementById('playlist-info');
    playlistInfoEl.innerHTML = playlistInfo;
    detailsEl.style.display = 'block';
}

function updateSyncProgress(message) {
    const progressEl = document.getElementById('sync-progress');
    progressEl.textContent = message;
}

function setStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message';
    if (type === 'error') statusMessage.style.color = '#ff6b6b';
    else if (type === 'success') statusMessage.style.color = '#4CAF50';
    else statusMessage.style.color = '#FF9800';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    document.getElementById('toast-container').appendChild(toast);

    // Remove toast after animation completes (3s wait + 0.8s animation)
    setTimeout(() => {
        toast.remove();
    }, 3800);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Column Toggle Function
let isColumnMode2 = false;

function toggleColumns() {
    isColumnMode2 = !isColumnMode2;

    if (isColumnMode2) {
        lyricsContentInner.classList.remove('lyrics-columns-1');
        lyricsContentInner.classList.add('lyrics-columns-2');
    } else {
        lyricsContentInner.classList.remove('lyrics-columns-2');
        lyricsContentInner.classList.add('lyrics-columns-1');
    }

    // Save column preference for this song
    if (currentSong) {
        saveColumnPreference(currentSong.id, isColumnMode2);
    }
}

function saveColumnPreference(songId, is2Column) {
    const preferences = JSON.parse(localStorage.getItem('bandPracticeColumnPreferences') || '{}');
    preferences[songId] = is2Column;
    localStorage.setItem('bandPracticeColumnPreferences', JSON.stringify(preferences));
}

function loadColumnPreference(songId) {
    const preferences = JSON.parse(localStorage.getItem('bandPracticeColumnPreferences') || '{}');
    const is2Column = preferences[songId] !== undefined ? preferences[songId] : true; // Default to 2 columns

    isColumnMode2 = is2Column;

    if (isColumnMode2) {
        lyricsContentInner.classList.remove('lyrics-columns-1');
        lyricsContentInner.classList.add('lyrics-columns-2');
    } else {
        lyricsContentInner.classList.remove('lyrics-columns-2');
        lyricsContentInner.classList.add('lyrics-columns-1');
    }
}

// Font Size Change Function
function handleFontSizeChange(e) {
    const fontSize = e.target.value;
    const mainApp = document.getElementById('main-app');

    // Remove all font size classes
    mainApp.classList.remove('font-size-small', 'font-size-medium', 'font-size-large', 'font-size-xlarge', 'font-size-xxlarge', 'font-size-xxxlarge');

    // Add the selected font size class
    mainApp.classList.add(`font-size-${fontSize}`);

    // Save preference to localStorage
    localStorage.setItem('bandPracticeFontSize', fontSize);
}

// Load saved font size on init
function loadFontSizePreference() {
    const savedSize = localStorage.getItem('bandPracticeFontSize') || 'medium';
    fontSizeSelect.value = savedSize;
    const mainApp = document.getElementById('main-app');
    mainApp.classList.add(`font-size-${savedSize}`);
}


// Lyrics Editor Functions
function openLyricsEditor() {
    if (!currentSong) return;

    // Set the dialog title with song info
    lyricsEditorTitle.textContent = `Edit Lyrics: ${currentSong.title} - ${currentSong.artist}`;

    // Show customization badge if song is already customized
    if (currentSong.is_customized) {
        customizationBadge.style.display = 'block';
        if (customizationBadgeMain) customizationBadgeMain.style.display = 'inline-flex';
    } else {
        customizationBadge.style.display = 'none';
        if (customizationBadgeMain) customizationBadgeMain.style.display = 'none';
    }

    // Populate textarea with current lyrics (without line numbers)
    lyricsEditorTextarea.value = currentSong.lyrics || '';

    // Update line numbers
    updateLyricsEditorLineNumbers();

    // Populate notes pane
    populateLyricsEditorNotes();

    // Show the dialog
    lyricsEditorDialog.style.display = 'flex';
    lyricsEditorTextarea.focus();

    // Set cursor to the beginning of the document
    lyricsEditorTextarea.setSelectionRange(0, 0);
    lyricsEditorTextarea.scrollTop = 0;

    // Set up scroll sync and line number updates
    setupLyricsEditorScrollSync();

    // Add keyboard shortcuts for lyrics editor (on dialog level, not textarea)
    document.addEventListener('keydown', handleLyricsEditorKeyboard);
}

function updateLyricsEditorLineNumbers() {
    const lineNumbersDiv = document.getElementById('lyrics-editor-line-numbers');
    const lines = lyricsEditorTextarea.value.split('\n');

    let lineNumbersText = '';
    let lineNum = 1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Check if line is a section header like [Verse 1], [Chorus], etc.
        const isHeader = /^\[.*\]/.test(trimmedLine);

        // Check if line is blank
        const isBlank = trimmedLine === '';

        if (isHeader || isBlank) {
            // Don't number headers or blank lines, just add empty space
            lineNumbersText += '\n';
        } else {
            // Number regular lyric lines
            lineNumbersText += lineNum + '\n';
            lineNum++;
        }
    }

    lineNumbersDiv.textContent = lineNumbersText;
}

function populateLyricsEditorNotes() {
    const notesDiv = document.getElementById('lyrics-editor-notes');
    const notes = currentSong.notes || '';

    if (!notes.trim()) {
        notesDiv.innerHTML = '<div class="empty-state"><p>No notes for this song</p></div>';
        return;
    }

    const noteBlocks = parseNotes(notes);
    let html = '';

    noteBlocks.forEach(block => {
        html += `
            <div class="note-block" style="margin-bottom: 8px;">
                <div class="note-header">${escapeHtml(block.header)}</div>
                <div class="note-content">${escapeHtml(block.content)}</div>
            </div>
        `;
    });

    notesDiv.innerHTML = html;
}

function setupLyricsEditorScrollSync() {
    // Remove any existing listeners
    lyricsEditorTextarea.removeEventListener('scroll', syncLyricsEditorScroll);
    lyricsEditorTextarea.removeEventListener('input', updateLyricsEditorLineNumbers);

    // Add scroll sync
    lyricsEditorTextarea.addEventListener('scroll', syncLyricsEditorScroll);

    // Add line number update on input
    lyricsEditorTextarea.addEventListener('input', updateLyricsEditorLineNumbers);
}

function syncLyricsEditorScroll() {
    const lineNumbersDiv = document.getElementById('lyrics-editor-line-numbers');
    lineNumbersDiv.scrollTop = lyricsEditorTextarea.scrollTop;
}

function closeLyricsEditor() {
    lyricsEditorDialog.style.display = 'none';
    lyricsEditorTextarea.value = '';

    // Remove keyboard shortcuts
    document.removeEventListener('keydown', handleLyricsEditorKeyboard);
}

function handleLyricsEditorKeyboard(e) {
    // Only handle if lyrics editor dialog is visible
    if (lyricsEditorDialog.style.display !== 'flex') return;

    // ESC to cancel
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeLyricsEditor();
        return;
    }

    // Ctrl+S or Ctrl+Enter to save
    if (e.ctrlKey && (e.key === 's' || e.key === 'Enter')) {
        e.preventDefault();
        e.stopPropagation();
        saveLyrics();
        return;
    }

    // Alt+T to tighten lyrics
    if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        e.stopPropagation();
        tightenLyrics();
        return;
    }

    // Alt+V to insert [Verse]
    if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        e.stopPropagation();
        insertVerse();
        return;
    }

    // Alt+C to insert [Chorus]
    if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        insertChorus();
        return;
    }
}

function tightenLyrics() {
    const lines = lyricsEditorTextarea.value.split('\n');
    const tightenedLines = [];
    let previousLineWasHeader = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Check if line is a section header like [Verse 1], [Chorus], etc.
        const isHeader = /^\[.*\]/.test(trimmedLine);

        // Check if line is blank
        const isBlank = trimmedLine === '';

        if (isBlank && previousLineWasHeader) {
            // Skip blank lines that come immediately after headers
            continue;
        }

        // Add the line
        tightenedLines.push(line);

        // Track if this line was a header
        previousLineWasHeader = isHeader;
    }

    // Update the textarea with tightened lyrics
    lyricsEditorTextarea.value = tightenedLines.join('\n');

    // Update line numbers to reflect the changes
    updateLyricsEditorLineNumbers();

    // Show feedback
    showToast('Removed blank lines after section headers', 'success');
}

function insertVerse() {
    const textarea = lyricsEditorTextarea;
    const cursorPos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPos);
    const textAfter = textarea.value.substring(cursorPos);
    
    // Insert [Verse] followed by a newline
    const textToInsert = '[Verse]';
    textarea.value = textBefore + textToInsert + textAfter;
    
    // Move cursor to end of inserted text
    const newCursorPos = cursorPos + textToInsert.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
    
    // Update line numbers
    updateLyricsEditorLineNumbers();
    
    // Show feedback
    // showToast('[Verse] heading inserted', 'success');
}

function insertChorus() {
    const textarea = lyricsEditorTextarea;
    const cursorPos = textarea.selectionStart;
    const textBefore = textarea.value.substring(0, cursorPos);
    const textAfter = textarea.value.substring(cursorPos);
    
    // Insert [Chorus] followed by a newline
    const textToInsert = '[Chorus]';
    textarea.value = textBefore + textToInsert + textAfter;
    
    // Move cursor to end of inserted text
    const newCursorPos = cursorPos + textToInsert.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
    
    // Update line numbers
    updateLyricsEditorLineNumbers();
    
    // Show feedback
    // showToast('[Chorus] heading inserted', 'success');
}

async function saveLyrics() {
    if (!currentSong) return;

    try {
        showLoading('Saving lyrics...');
        const lyrics = lyricsEditorTextarea.value;

        const response = await authenticatedApiCall(`/api/songs/${currentSong.id}/lyrics`, {
            method: 'PUT',
            body: JSON.stringify({ lyrics })
        });

        const data = await response.json();

        if (data.success) {
            currentSong = data.song;
            renderSong();
            closeLyricsEditor();
            // showToast('Lyrics saved and marked as customized!', 'success');
            setStatus('Lyrics customized', 'success');
        } else {
            showToast('Failed to save lyrics', 'error');
        }
    } catch (error) {
        showToast('Error saving lyrics: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Confirmation Dialog Functions
let currentConfirmCallback = null;

function showConfirmDialog(title, message, onConfirm) {
    confirmDialogTitle.textContent = title;
    confirmDialogMessage.textContent = message;
    confirmDialog.style.display = 'flex';
    currentConfirmCallback = onConfirm;

    // Get the current button (it might have been replaced before)
    const currentBtn = document.getElementById('confirm-dialog-confirm-btn');
    if (currentBtn) {
        // Remove any existing event listeners by cloning
        const newConfirmBtn = currentBtn.cloneNode(true);
        currentBtn.parentNode.replaceChild(newConfirmBtn, currentBtn);

        newConfirmBtn.addEventListener('click', () => {
            hideConfirmDialog();
            onConfirm();
        });
    }

    // Remove any existing keyboard listener first to prevent duplicates
    document.removeEventListener('keydown', handleConfirmDialogKeyboard, true);
    // Add keyboard shortcuts with capture phase to ensure it runs before other handlers
    document.addEventListener('keydown', handleConfirmDialogKeyboard, true);
}

function hideConfirmDialog() {
    confirmDialog.style.display = 'none';
    currentConfirmCallback = null;

    // Remove keyboard shortcuts
    document.removeEventListener('keydown', handleConfirmDialogKeyboard, true);
}

function handleConfirmDialogKeyboard(e) {
    // Only handle if dialog is visible
    if (confirmDialog.style.display !== 'flex') return;

    // ESC to cancel
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation(); // Prevent other dialogs from handling this
        hideConfirmDialog();
        return;
    }
    // ENTER to confirm
    if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation(); // Prevent other dialogs from handling this
        if (currentConfirmCallback) {
            const callback = currentConfirmCallback; // Save callback before hiding
            hideConfirmDialog();
            callback(); // Call it after hiding
        }
        return;
    }
}

//=============================================================================
// BPM Dialog Functions
//=============================================================================

function openBpmDialog() {
    if (!currentSong) return;

    bpmDialogTitle.textContent = 'Set BPM';
    bpmDialogSongInfo.textContent = `${currentSong.title} - ${currentSong.artist}`;
    
    // Pre-fill with current BPM if it's a number
    if (currentSong.bpm && currentSong.bpm !== 'N/A' && currentSong.bpm !== 'NOT_FOUND') {
        bpmInput.value = currentSong.bpm;
    } else {
        bpmInput.value = '';
    }
    
    bpmDialog.style.display = 'flex';
    bpmInput.focus();
    bpmInput.select();

    // Add keyboard shortcuts
    document.addEventListener('keydown', handleBpmDialogKeyboard);
}

function closeBpmDialog() {
    bpmDialog.style.display = 'none';
    bpmInput.value = '';

    // Remove keyboard shortcuts
    document.removeEventListener('keydown', handleBpmDialogKeyboard);
}

function handleBpmDialogKeyboard(e) {
    // Only handle if BPM dialog is visible
    if (bpmDialog.style.display !== 'flex') return;

    // ESC to cancel
    if (e.key === 'Escape') {
        e.preventDefault();
        closeBpmDialog();
        return;
    }

    // ENTER to save
    if (e.key === 'Enter') {
        e.preventDefault();
        saveBpm();
        return;
    }
}

async function saveBpm() {
    if (!currentSong) return;

    const bpmValue = bpmInput.value.trim();

    if (!bpmValue) {
        showToast('Please enter a BPM value', 'error');
        return;
    }

    const bpmNumber = parseFloat(bpmValue);
    if (isNaN(bpmNumber) || bpmNumber <= 0 || bpmNumber > 300) {
        showToast('BPM must be between 1 and 300', 'error');
        return;
    }

    // Round to 1 decimal place
    const bpmRounded = Math.round(bpmNumber * 10) / 10;

    try {
        showLoading('Saving BPM...');

        const response = await authenticatedApiCall(`/api/songs/${currentSong.id}/bpm`, {
            method: 'PUT',
            body: JSON.stringify({ bpm: bpmRounded })
        });

        const data = await response.json();

        if (data.success) {
            currentSong.bpm = bpmRounded;
            currentSong.bpm_manual = true;
            renderMetadata();

            // Update the song in the allSongs array so selector shows the badge
            const songIndex = allSongs.findIndex(s => s.id === currentSong.id);
            if (songIndex !== -1) {
                allSongs[songIndex].bpm = bpmRounded;
                allSongs[songIndex].bpm_manual = true;
            }

            closeBpmDialog();
            // showToast(`BPM set to ${bpmRounded}`, 'success');
            setStatus(`BPM updated to ${bpmRounded}`, 'success');
        } else {
            showToast('Failed to save BPM: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error saving BPM: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

//=============================================================================
// BPM Tap Trainer Dialog
//=============================================================================

const bpmTapDialog = document.getElementById('bpm-tap-dialog');
const bpmTapSongInfo = document.getElementById('bpm-tap-song-info');
const bpmTapDisplay = document.getElementById('bpm-tap-display');
const bpmTapCount = document.getElementById('bpm-tap-count');
const bpmTapResetBtn = document.getElementById('bpm-tap-reset-btn');
const bpmTapCancelBtn = document.getElementById('bpm-tap-cancel-btn');
const bpmTapSaveBtn = document.getElementById('bpm-tap-save-btn');

let tapTimes = [];
let detectedBpm = null;

function openBpmTapTrainer() {
    if (!currentSong) {
        showToast('Please select a song first', 'error');
        return;
    }

    bpmTapSongInfo.textContent = `${currentSong.title} - ${currentSong.artist}`;
    resetTapTrainer();

    bpmTapDialog.style.display = 'flex';

    // Add keyboard shortcuts
    document.addEventListener('keydown', handleBpmTapKeyboard);
}

function closeBpmTapTrainer() {
    bpmTapDialog.style.display = 'none';
    resetTapTrainer();

    // Remove keyboard shortcuts
    document.removeEventListener('keydown', handleBpmTapKeyboard);
}

function resetTapTrainer() {
    tapTimes = [];
    detectedBpm = null;
    bpmTapDisplay.textContent = '--.-';
    bpmTapCount.textContent = 'Taps: 0';
    bpmTapSaveBtn.disabled = true;
}

function handleBpmTapKeyboard(e) {
    // Only handle if tap dialog is visible
    if (bpmTapDialog.style.display !== 'flex') return;

    // Period key to tap
    if (e.key === '.') {
        e.preventDefault();
        recordTap();
        return;
    }

    // ESC to cancel
    if (e.key === 'Escape') {
        e.preventDefault();
        closeBpmTapTrainer();
        return;
    }

    // ENTER to save
    if (e.key === 'Enter') {
        e.preventDefault();
        if (!bpmTapSaveBtn.disabled) {
            saveTappedBpm();
        }
        return;
    }
}

function recordTap() {
    const now = Date.now();
    tapTimes.push(now);

    // Keep up to 24 taps for tracking
    if (tapTimes.length > 24) {
        tapTimes.shift();
    }

    // Update count
    bpmTapCount.textContent = `Taps: ${tapTimes.length}`;

    // Calculate BPM if we have at least 2 taps
    if (tapTimes.length >= 2) {
        calculateBpm();
    }

    // Visual feedback - pulse the display
    bpmTapDisplay.style.transform = 'scale(1.1)';
    setTimeout(() => {
        bpmTapDisplay.style.transform = 'scale(1)';
    }, 100);
}

function calculateBpm() {
    if (tapTimes.length < 2) return;

    // Calculate intervals between taps
    const intervals = [];
    for (let i = 1; i < tapTimes.length; i++) {
        intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }

    // Average interval in milliseconds
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Convert to BPM (60000 ms per minute / interval in ms)
    const bpm = 60000 / avgInterval;

    // Round to 1 decimal place
    detectedBpm = Math.round(bpm * 10) / 10;

    // Update display
    bpmTapDisplay.textContent = detectedBpm.toFixed(1);
    bpmTapDisplay.style.transition = 'transform 0.1s ease';

    // Enable save button if we have at least 4 taps
    if (tapTimes.length >= 4) {
        bpmTapSaveBtn.disabled = false;
    }
}

async function saveTappedBpm() {
    if (!currentSong || !detectedBpm) return;

    try {
        showLoading('Saving BPM...');

        const response = await authenticatedApiCall(`/api/songs/${currentSong.id}/bpm`, {
            method: 'PUT',
            body: JSON.stringify({ bpm: detectedBpm })
        });

        const data = await response.json();

        if (data.success) {
            // Use the BPM from the response or the detected one
            const savedBpm = data.bpm || detectedBpm;
            currentSong.bpm = savedBpm;
            currentSong.bpm_manual = true;
            renderMetadata();

            // Update the song in the allSongs array
            const songIndex = allSongs.findIndex(s => s.id === currentSong.id);
            if (songIndex !== -1) {
                allSongs[songIndex].bpm = savedBpm;
                allSongs[songIndex].bpm_manual = true;
            }

            closeBpmTapTrainer();
            // showToast(`BPM set to ${savedBpm.toFixed(1)}`, 'success');
            setStatus(`BPM updated to ${savedBpm.toFixed(1)}`, 'success');
        } else {
            showToast('Failed to save BPM: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error saving BPM: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Event listeners for tap trainer
if (bpmTapResetBtn) {
    bpmTapResetBtn.addEventListener('click', resetTapTrainer);
}
if (bpmTapCancelBtn) {
    bpmTapCancelBtn.addEventListener('click', closeBpmTapTrainer);
}
if (bpmTapSaveBtn) {
    bpmTapSaveBtn.addEventListener('click', saveTappedBpm);
}

//=============================================================================
// Import Playlist Dialog
//=============================================================================

let importDialogState = {
    playlistUrl: '',
    playlist: null,
    songs: [],
    selectedSongIds: new Set(),
    cachedPlaylists: [],
    selectedPlaylistIndex: -1
};

// DOM Elements for Import Dialog
const importDialog = document.getElementById('import-dialog');
const importDialogClose = document.getElementById('import-dialog-close');
const importStepUrl = document.getElementById('import-step-url');
const importStepSelect = document.getElementById('import-step-select');
const importStepProgress = document.getElementById('import-step-progress');
const importPlaylistUrl = document.getElementById('import-playlist-url');
const importLoadBtn = document.getElementById('import-load-btn');
const importPlaylistBtn = document.getElementById('import-playlist-btn');
const importSelectAllBtn = document.getElementById('import-select-all-btn');
const importSelectNewBtn = document.getElementById('import-select-new-btn');
const importSelectNoneBtn = document.getElementById('import-select-none-btn');
const importBackBtn = document.getElementById('import-back-btn');
const importStartBtn = document.getElementById('import-start-btn');
const importDoneBtn = document.getElementById('import-done-btn');

// Set up import dialog event listeners in the main setup
document.addEventListener('DOMContentLoaded', () => {
    if (importPlaylistBtn) {
        importPlaylistBtn.addEventListener('click', showImportDialog);
        importDialogClose.addEventListener('click', closeImportDialog);
        importLoadBtn.addEventListener('click', loadPlaylistDetails);
        importSelectAllBtn.addEventListener('click', selectAllSongs);
        importSelectNewBtn.addEventListener('click', selectNewSongs);
        importSelectNoneBtn.addEventListener('click', selectNoneSongs);
        importBackBtn.addEventListener('click', backToUrlStep);
        importStartBtn.addEventListener('click', startImport);
        importDoneBtn.addEventListener('click', finishImport);
    }
});

async function showImportDialog() {
    importDialog.style.display = 'flex';
    importStepUrl.style.display = 'flex';
    importStepSelect.style.display = 'none';
    importStepProgress.style.display = 'none';

    // Clear the URL input field
    importPlaylistUrl.value = '';

    // Load playlist memory
    await loadPlaylistMemory();

    importPlaylistUrl.focus();

    // Add keyboard shortcuts
    document.addEventListener('keydown', handleImportDialogKeyboard);
}

function closeImportDialog() {
    importDialog.style.display = 'none';
    importDialogState = {
        playlistUrl: '',
        playlist: null,
        songs: [],
        selectedSongIds: new Set()
    };

    // Remove keyboard shortcuts
    document.removeEventListener('keydown', handleImportDialogKeyboard);
}

function handleImportDialogKeyboard(e) {
    // Only handle if import dialog is visible
    if (importDialog.style.display !== 'flex') return;

    // ESC to close dialog
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeImportDialog();
        return;
    }

    // Step 1: Navigate cached playlists with arrow keys
    if (importStepUrl.style.display === 'flex' && importDialogState.cachedPlaylists.length > 0) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (importDialogState.selectedPlaylistIndex < importDialogState.cachedPlaylists.length - 1) {
                importDialogState.selectedPlaylistIndex++;
                updatePlaylistMemorySelection();
            } else if (importDialogState.selectedPlaylistIndex === -1 && importDialogState.cachedPlaylists.length > 0) {
                // If nothing selected, select first item
                importDialogState.selectedPlaylistIndex = 0;
                updatePlaylistMemorySelection();
            }
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (importDialogState.selectedPlaylistIndex > 0) {
                importDialogState.selectedPlaylistIndex--;
                updatePlaylistMemorySelection();
            } else if (importDialogState.selectedPlaylistIndex === -1 && importDialogState.cachedPlaylists.length > 0) {
                // If nothing selected, select last item
                importDialogState.selectedPlaylistIndex = importDialogState.cachedPlaylists.length - 1;
                updatePlaylistMemorySelection();
            }
            return;
        }
    }

    // ENTER to proceed based on current step
    if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();

        // Step 1: Load playlist (Enter in URL field triggers load OR select cached playlist)
        if (importStepUrl.style.display === 'flex') {
            // If a cached playlist is selected, load it
            if (importDialogState.selectedPlaylistIndex >= 0) {
                const selectedPlaylist = importDialogState.cachedPlaylists[importDialogState.selectedPlaylistIndex];
                if (selectedPlaylist) {
                    importPlaylistUrl.value = selectedPlaylist.playlist_url;
                }
            }
            loadPlaylistDetails();
        }
        // Step 2: Start import (but not if user is in the songs list)
        else if (importStepSelect.style.display === 'flex') {
            if (!importStartBtn.disabled) {
                startImport();
            }
        }
        // Step 3: Finish import
        else if (importStepProgress.style.display === 'flex') {
            if (importDoneBtn.style.display !== 'none') {
                finishImport();
            }
        }
        return;
    }
}

async function loadPlaylistDetails() {
    const playlistUrl = importPlaylistUrl.value.trim();

    if (!playlistUrl) {
        showToast('Please enter a playlist URL', 'error');
        return;
    }

    if (!playlistUrl.includes('spotify.com/playlist/')) {
        showToast('Invalid Spotify playlist URL', 'error');
        return;
    }

    try {
        showLoading('Loading playlist details...');

        const response = await authenticatedApiCall('/api/playlist/details', {
            method: 'POST',
            body: JSON.stringify({ 
                playlist_url: playlistUrl,
                collection_id: currentCollection ? currentCollection.id : null
            })
        });

        const data = await response.json();

        if (data.success) {
            importDialogState.playlistUrl = playlistUrl;
            importDialogState.playlist = data.playlist;
            importDialogState.songs = data.songs;
            importDialogState.selectedSongIds = new Set();

            // Auto-select only new songs by default
            data.songs.forEach(song => {
                if (song.status === 'new') {
                    importDialogState.selectedSongIds.add(song.id);
                }
            });

            renderPlaylistDetails();
            renderImportSongList();

            // Switch to select step
            importStepUrl.style.display = 'none';
            importStepSelect.style.display = 'flex';
        } else {
            showToast('Failed to load playlist: ' + data.error, 'error');
        }
    } catch (error) {
        showToast('Error loading playlist: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderPlaylistDetails() {
    const detailsDiv = document.getElementById('import-playlist-details');
    const { playlist } = importDialogState;

    detailsDiv.innerHTML = `
        <div>
            <h3 style="margin: 0; color: var(--accent-primary);">${escapeHtml(playlist.name)}</h3>
            <p style="margin: 5px 0 0 0; color: var(--text-secondary); font-size: 12px;">
                by ${escapeHtml(playlist.owner)} • ${playlist.total_tracks} songs
            </p>
        </div>
    `;

    updateSelectionCount();
}

function renderImportSongList() {
    const listDiv = document.getElementById('import-songs-list');
    const { songs } = importDialogState;

    let html = '';
    songs.forEach(song => {
        const isSelected = importDialogState.selectedSongIds.has(song.id);
        const conflictClass = song.has_conflict ? 'has-conflict' : '';

        // Build status badges - can show multiple
        let statusBadges = '';
        if (song.status === 'existing') {
            statusBadges += '<span class="import-song-status status-existing"><i class="fa-solid fa-check"></i> In Collection</span>';
        } else if (song.status === 'new') {
            statusBadges += '<span class="import-song-status status-new"><i class="fa-solid fa-star"></i> New</span>';
        }
        
        // Add custom lyrics badge if applicable (can appear with existing or new)
        if (song.status === 'conflict' || song.has_conflict) {
            statusBadges += '<span class="import-song-status status-conflict"><i class="fa-solid fa-triangle-exclamation"></i> Custom Lyrics</span>';
        }

        html += `
            <div class="import-song-item ${conflictClass}">
                <input type="checkbox" class="import-song-checkbox"
                       data-song-id="${song.id}"
                       ${isSelected ? 'checked' : ''}
                       onchange="toggleSongSelection('${song.id}')">
                ${song.album_art ?
                    `<img src="${song.album_art}" class="import-song-art" alt="Album art">` :
                    `<div class="import-song-art-placeholder"><i class="fa-solid fa-music"></i></div>`
                }
                <div class="import-song-info">
                    <div class="import-song-title">${escapeHtml(song.title)}</div>
                    <div class="import-song-artist">
                        <i class="fa-solid fa-user"></i> ${escapeHtml(song.artist)} 
                        <i class="fa-solid fa-compact-disc"></i> ${escapeHtml(song.album)}
                    </div>
                </div>
                <div class="import-song-badges">
                    ${statusBadges}
                </div>
            </div>
        `;
    });

    listDiv.innerHTML = html;
}

function toggleSongSelection(songId) {
    if (importDialogState.selectedSongIds.has(songId)) {
        importDialogState.selectedSongIds.delete(songId);
    } else {
        importDialogState.selectedSongIds.add(songId);
    }

    updateSelectionCount();
}

// Make toggleSongSelection global so it can be called from onclick
window.toggleSongSelection = toggleSongSelection;

function updateSelectionCount() {
    const count = importDialogState.selectedSongIds.size;
    document.getElementById('import-selection-count').textContent =
        `${count} song${count !== 1 ? 's' : ''} selected`;

    importStartBtn.disabled = count === 0;
}

function selectAllSongs() {
    importDialogState.songs.forEach(song => {
        importDialogState.selectedSongIds.add(song.id);
    });
    renderImportSongList();
    updateSelectionCount();
}

function selectNewSongs() {
    importDialogState.selectedSongIds.clear();
    importDialogState.songs.forEach(song => {
        if (song.status === 'new') {
            importDialogState.selectedSongIds.add(song.id);
        }
    });
    renderImportSongList();
    updateSelectionCount();
}

function selectNoneSongs() {
    importDialogState.selectedSongIds.clear();
    renderImportSongList();
    updateSelectionCount();
}

function backToUrlStep() {
    importStepSelect.style.display = 'none';
    importStepUrl.style.display = 'flex';
}

async function startImport() {
    if (importDialogState.selectedSongIds.size === 0) {
        return;
    }

    // Switch to progress step
    importStepSelect.style.display = 'none';
    importStepProgress.style.display = 'flex';

    const selectedIds = Array.from(importDialogState.selectedSongIds);

    try {
        // Reset progress
        document.getElementById('import-progress-fill').style.width = '0%';
        document.getElementById('import-progress-text').textContent = `0 / ${selectedIds.length}`;
        document.getElementById('import-progress-list').innerHTML = '';

        // Create progress items for each song
        const progressItems = {};
        importDialogState.songs.forEach(song => {
            if (importDialogState.selectedSongIds.has(song.id)) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'import-progress-item status-importing';
                itemDiv.innerHTML = `
                    <span class="import-progress-icon">⏳</span>
                    <div class="import-progress-song">
                        <div style="font-weight: 600;">${escapeHtml(song.title)}</div>
                        <div style="color: var(--text-secondary); font-size: 11px;">${escapeHtml(song.artist)}</div>
                    </div>
                    <span class="import-progress-status">Waiting...</span>
                `;
                document.getElementById('import-progress-list').appendChild(itemDiv);
                progressItems[song.id] = itemDiv;
            }
        });

        // Use Server-Sent Events to get real-time progress
        await new Promise((resolve, reject) => {
            // Get auth token for SSE request
            const makeSSERequest = async () => {
                try {
                    const response = await authenticatedApiCall('/api/playlist/import', {
                        method: 'POST',
                        body: JSON.stringify({
                            playlist_url: importDialogState.playlistUrl,
                            selected_songs: selectedIds,
                            collection_id: currentCollection ? currentCollection.id : null
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        
                        if (done) {
                            console.log('Stream complete');
                            break;
                        }

                        // Decode the chunk and add to buffer
                        buffer += decoder.decode(value, { stream: true });

                        // Process complete messages (split by double newline)
                        const messages = buffer.split('\n\n');
                        buffer = messages.pop(); // Keep incomplete message in buffer

                        for (const message of messages) {
                            if (message.startsWith('data: ')) {
                                const jsonStr = message.substring(6);
                                try {
                                    const update = JSON.parse(jsonStr);
                                    
                                    if (update.type === 'progress') {
                                        // Update progress bar
                                        const percentage = (update.completed / update.total) * 100;
                                        document.getElementById('import-progress-fill').style.width = `${percentage}%`;
                                        document.getElementById('import-progress-text').textContent = `${update.completed} / ${update.total}`;

                                        // Update individual song status
                                        const result = update.result;
                                        const itemDiv = progressItems[result.id];
                                        if (itemDiv) {
                                            itemDiv.classList.remove('status-importing');

                                            let icon = '✓';
                                            let statusClass = 'status-success';
                                            let statusText = result.message || 'Success';

                                            if (result.status === 'failed') {
                                                icon = '✗';
                                                statusClass = 'status-error';
                                            } else if (result.status === 'skipped') {
                                                icon = '⊘';
                                                statusClass = 'status-skipped';
                                            }

                                            itemDiv.classList.add(statusClass);
                                            itemDiv.querySelector('.import-progress-icon').textContent = icon;
                                            itemDiv.querySelector('.import-progress-status').textContent = statusText;
                                        }
                                    } else if (update.type === 'complete') {
                                        // Import complete
                                        console.log('Import complete:', update.stats);
                                        
                                        // Show done button
                                        importDoneBtn.style.display = 'inline-flex';

                                        // Show summary toast
                                        const stats = update.stats;
                                        showToast(
                                            `Import complete! Added: ${stats.added}, Updated: ${stats.updated}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`,
                                            stats.failed > 0 ? 'error' : 'success'
                                        );
                                        
                                        resolve();
                                    } else if (update.type === 'error') {
                                        throw new Error(update.error);
                                    }
                                } catch (parseError) {
                                    console.error('Error parsing SSE message:', parseError);
                                }
                            }
                        }
                    }
                } catch (error) {
                    reject(error);
                }
            };

            makeSSERequest();
        });

    } catch (error) {
        console.error('Import error:', error);
        showToast('Error importing songs: ' + error.message, 'error');
        importDoneBtn.style.display = 'inline-flex';
    }
}

async function loadPlaylistMemory() {
    try {
        const response = await authenticatedApiCall('/api/playlist/memory');
        const data = await response.json();

        if (data.success && data.playlists && data.playlists.length > 0) {
            importDialogState.cachedPlaylists = data.playlists;
            importDialogState.selectedPlaylistIndex = -1;
            renderPlaylistMemory(data.playlists);
        } else {
            importDialogState.cachedPlaylists = [];
            importDialogState.selectedPlaylistIndex = -1;
            // Hide the section if no playlists
            const section = document.getElementById('playlist-memory-section');
            if (section) section.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading playlist memory:', error);
    }
}

function renderPlaylistMemory(playlists) {
    const section = document.getElementById('playlist-memory-section');
    const listDiv = document.getElementById('playlist-memory-list');

    if (!section || !listDiv) return;

    let html = '';
    playlists.forEach((playlist, index) => {
        const selectedClass = index === importDialogState.selectedPlaylistIndex ? 'selected' : '';
        const imageHtml = playlist.image_url
            ? `<img src="${escapeHtml(playlist.image_url)}" alt="Playlist cover" class="playlist-memory-item-art">`
            : `<div class="playlist-memory-item-art-placeholder">🎵</div>`;

        html += `<div class="playlist-memory-item ${selectedClass}" data-playlist-index="${index}" data-playlist-url="${escapeHtml(playlist.playlist_url)}">
${imageHtml}
<div class="playlist-memory-item-info">
<div class="playlist-memory-item-title">${escapeHtml(playlist.name)}</div>
<div class="playlist-memory-item-meta">by ${escapeHtml(playlist.owner)} • ${playlist.total_tracks} songs</div>
</div>
<button class="playlist-memory-delete-btn" data-playlist-id="${escapeHtml(playlist.id)}" title="Remove from recent"
        onclick="deletePlaylistFromMemory('${escapeHtml(playlist.id)}', event)">✕</button>
</div>`;
    });

    listDiv.innerHTML = html;
    section.style.display = 'block';

    // Add click handlers to playlist items
    document.querySelectorAll('.playlist-memory-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't trigger if clicking the delete button
            if (e.target.classList.contains('playlist-memory-delete-btn')) return;

            const playlistUrl = item.dataset.playlistUrl;
            importPlaylistUrl.value = playlistUrl;
            loadPlaylistDetails();
        });
    });
}

function updatePlaylistMemorySelection() {
    // Remove all selected classes
    document.querySelectorAll('.playlist-memory-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Add selected class to current index
    if (importDialogState.selectedPlaylistIndex >= 0) {
        const items = document.querySelectorAll('.playlist-memory-item');
        if (items[importDialogState.selectedPlaylistIndex]) {
            items[importDialogState.selectedPlaylistIndex].classList.add('selected');
            items[importDialogState.selectedPlaylistIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

async function deletePlaylistFromMemory(playlistId, event) {
    if (event) {
        event.stopPropagation(); // Prevent triggering the playlist item click
    }

    try {
        const response = await authenticatedApiCall(`/api/playlist/memory/${playlistId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showToast('Removed from recent playlists', 'success');
            // Reload playlist memory
            await loadPlaylistMemory();
        } else {
            showToast('Failed to remove playlist', 'error');
        }
    } catch (error) {
        showToast('Error removing playlist: ' + error.message, 'error');
    }
}

// Make deletePlaylistFromMemory global so it can be called from onclick
window.deletePlaylistFromMemory = deletePlaylistFromMemory;

async function finishImport() {
    closeImportDialog();
    await loadSongs(); // Reload song list

    // Optionally: trigger background BPM fetches for all songs that were just imported
    // This will happen automatically when users view each song
}

//=============================================================================
// Collection Management Functions
//=============================================================================

async function loadCurrentCollection() {
    try {
        // Check localStorage for current collection ID
        const savedCollectionId = localStorage.getItem('bandPracticeCurrentCollection');
        
        if (savedCollectionId) {
            // Try to load the saved collection
            const response = await authenticatedApiCall(`/api/collections/${savedCollectionId}`);
            const data = await response.json();
            
            if (data.success) {
                currentCollection = data.collection;
                updateCollectionDisplay();
                await loadSongs();
                return;
            }
        }
        
        // If no saved collection or failed to load, get/create default collection
        const response = await authenticatedApiCall('/api/collections/default');
        const data = await response.json();
        
        if (data.success) {
            currentCollection = data.collection;
            saveCurrentCollection(currentCollection.id);
            updateCollectionDisplay();
            await loadSongs();
        } else {
            showToast('Failed to load collection', 'error');
        }
    } catch (error) {
        console.error('Error loading current collection:', error);
        showToast('Error loading collection: ' + error.message, 'error');
    }
}

function saveCurrentCollection(collectionId) {
    localStorage.setItem('bandPracticeCurrentCollection', collectionId);
}

function updateCollectionDisplay() {
    if (currentCollection) {
        currentCollectionName.textContent = currentCollection.name;
    } else {
        currentCollectionName.textContent = 'Collection...';
    }
}

async function showCollectionDialog() {
    collectionDialog.style.display = 'flex';
    
    try {
        showLoading('Loading collections...');
        const response = await authenticatedApiCall('/api/collections');
        const data = await response.json();
        
        if (data.success) {
            allCollections = data.collections;
            renderCollectionList();
            
            // Set initial selection to current collection or first item
            if (allCollections.length > 0) {
                const currentIndex = allCollections.findIndex(c => currentCollection && c.id === currentCollection.id);
                highlightCollectionItem(currentIndex >= 0 ? currentIndex : 0);
            }
        } else {
            showToast('Failed to load collections', 'error');
        }
    } catch (error) {
        console.error('Error loading collections:', error);
        showToast('Error loading collections: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
    
    // Remove any existing keyboard listener first to prevent duplicates
    document.removeEventListener('keydown', handleCollectionDialogKeyboard);
    // Add keyboard shortcuts
    document.addEventListener('keydown', handleCollectionDialogKeyboard);
}

function closeCollectionDialog() {
    collectionDialog.style.display = 'none';
    document.removeEventListener('keydown', handleCollectionDialogKeyboard);
}

let selectedCollectionIndex = 0;

function handleCollectionDialogKeyboard(e) {
    if (collectionDialog.style.display !== 'flex') return;
    
    // If confirm dialog is open, don't handle keyboard shortcuts
    if (confirmDialog && confirmDialog.style.display === 'flex') return;
    
    // Don't intercept keyboard shortcuts when typing in an input field
    const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    
    if (e.key === 'Escape') {
        e.preventDefault();
        closeCollectionDialog();
        return;
    }
    
    // Arrow keys and navigation - always work
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (allCollections.length > 0) {
            selectedCollectionIndex = (selectedCollectionIndex + 1) % allCollections.length;
            highlightCollectionItem(selectedCollectionIndex);
        }
        return;
    }
    
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (allCollections.length > 0) {
            selectedCollectionIndex = (selectedCollectionIndex - 1 + allCollections.length) % allCollections.length;
            highlightCollectionItem(selectedCollectionIndex);
        }
        return;
    }
    
    if (e.key === 'Enter') {
        e.preventDefault();
        if (allCollections.length > 0 && allCollections[selectedCollectionIndex]) {
            switchCollection(allCollections[selectedCollectionIndex].id);
        }
        return;
    }
    
    // Only handle these shortcuts when NOT typing in an input field
    if (isTyping) return;
    
    // E key to edit collection
    if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (allCollections.length > 0 && allCollections[selectedCollectionIndex]) {
            const collection = allCollections[selectedCollectionIndex];
            if (collection.name !== 'Default') {
                showEditCollectionDialog();
            } else {
                showToast('Cannot edit Default collection', 'error');
            }
        }
        return;
    }
    
    // N key to create new collection
    if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        showNewCollectionDialog();
        return;
    }
    
    // Delete key to delete collection
    if (e.key === 'Delete' || (e.altKey && (e.key === 'd' || e.key === 'D'))) {
        e.preventDefault();
        if (allCollections.length > 0 && allCollections[selectedCollectionIndex]) {
            const collection = allCollections[selectedCollectionIndex];
            if (collection.name !== 'Default') {
                deleteCollectionWithConfirm(collection.id, collection.name);
            } else {
                showToast('Cannot delete Default collection', 'error');
            }
        }
        return;
    }
}

function highlightCollectionItem(index) {
    selectedCollectionIndex = index;
    
    // Remove highlight from all items
    document.querySelectorAll('.collection-item').forEach(item => {
        item.classList.remove('highlighted');
    });
    
    // Add highlight to selected item
    const items = document.querySelectorAll('.collection-item');
    if (items[index]) {
        items[index].classList.add('highlighted');
        items[index].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Enable/disable edit button based on whether Default collection is selected
    if (allCollections[index]) {
        const isDefault = allCollections[index].name === 'Default';
        editCollectionBtn.disabled = isDefault;
    }
}

function renderCollectionList() {
    if (!allCollections || allCollections.length === 0) {
        collectionList.innerHTML = '<div class="empty-state"><p>No collections found</p></div>';
        return;
    }
    
    let html = '';
    allCollections.forEach((collection, index) => {
        const isActive = currentCollection && collection.id === currentCollection.id;
        const activeClass = isActive ? 'active' : '';
        const canDelete = collection.name !== 'Default';
        const songCount = collection.song_count || 0;
        const songCountText = songCount === 1 ? '1 song' : `${songCount} songs`;
        
        html += `
            <div class="collection-item ${activeClass}" data-collection-id="${collection.id}" data-collection-index="${index}">
                <div class="collection-item-icon">
                    <i class="fa-solid fa-layer-group"></i>
                </div>
                <div class="collection-item-info">
                    <div class="collection-item-header">
                        <span class="collection-item-name">${escapeHtml(collection.name)}</span>
                        <span class="collection-item-song-count">${songCountText}</span>
                    </div>
                    ${collection.description ? `<div class="collection-item-description">${escapeHtml(collection.description)}</div>` : ''}
                </div>
                ${isActive ? '<span class="collection-item-active"><i class="fa-solid fa-check"></i> Active</span>' : ''}
                ${canDelete ? `<button class="collection-item-delete" data-collection-id="${collection.id}" data-collection-name="${escapeHtml(collection.name)}" title="Delete collection (Alt+D)"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        `;
    });
    
    collectionList.innerHTML = html;
    
    // Add click handlers for collection items
    document.querySelectorAll('.collection-item').forEach(item => {
        // Mouse hover to update selection index
        item.addEventListener('mouseenter', () => {
            const index = parseInt(item.dataset.collectionIndex);
            highlightCollectionItem(index);
        });
        
        // Click to select (but not on delete button)
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.collection-item-delete')) {
                switchCollection(item.dataset.collectionId);
            }
        });
    });
    
    // Add click handlers for delete buttons
    document.querySelectorAll('.collection-item-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const collectionId = btn.dataset.collectionId;
            const collectionName = btn.dataset.collectionName;
            deleteCollectionWithConfirm(collectionId, collectionName);
        });
    });
}

async function switchCollection(collectionId) {
    try {
        showLoading('Switching collection...');
        
        const response = await authenticatedApiCall(`/api/collections/${collectionId}`);
        const data = await response.json();
        
        if (data.success) {
            currentCollection = data.collection;
            saveCurrentCollection(collectionId);
            updateCollectionDisplay();
            closeCollectionDialog();
            
            // Clear current song and reload songs for new collection
            currentSong = null;
            lyricsContentInner.innerHTML = '<div class="empty-state"><p>Select a song to view lyrics</p></div>';
            notesView.innerHTML = '<div class="empty-state"><p>Select a song to view notes</p></div>';
            songMetadata.innerHTML = '';
            
            await loadSongs();
            showToast(`Switched to collection: ${currentCollection.name}`, 'success');
        } else {
            showToast('Failed to switch collection', 'error');
        }
    } catch (error) {
        console.error('Error switching collection:', error);
        showToast('Error switching collection: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function deleteCollectionWithConfirm(collectionId, collectionName) {
    showConfirmDialog(
        'Delete Collection?',
        `Are you sure you want to delete "${collectionName}"?\n\nThis will permanently delete the collection AND all songs in it.`,
        async () => {
            await deleteCollection(collectionId, collectionName);
        }
    );
}

async function deleteCollection(collectionId, collectionName) {
    try {
        showLoading('Deleting collection...');
        
        const response = await authenticatedApiCall(`/api/collections/${collectionId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            
            // If we deleted the current collection, switch to Default
            if (currentCollection && currentCollection.id === collectionId) {
                const defaultCollection = allCollections.find(c => c.name === 'Default');
                if (defaultCollection) {
                    await switchCollection(defaultCollection.id);
                }
            } else {
                // Just refresh the collection list
                await showCollectionDialog();
            }
        } else {
            showToast('Failed to delete collection: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error deleting collection:', error);
        showToast('Error deleting collection: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function showNewCollectionDialog() {
    newCollectionDialog.style.display = 'flex';
    collectionNameInput.value = '';
    collectionDescriptionInput.value = '';
    collectionNameInput.focus();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', handleNewCollectionDialogKeyboard);
}

function closeNewCollectionDialog() {
    newCollectionDialog.style.display = 'none';
    document.removeEventListener('keydown', handleNewCollectionDialogKeyboard);
}

function handleNewCollectionDialogKeyboard(e) {
    if (newCollectionDialog.style.display !== 'flex') return;
    
    if (e.key === 'Escape') {
        e.preventDefault();
        closeNewCollectionDialog();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        createNewCollection();
    }
}

async function createNewCollection() {
    const name = collectionNameInput.value.trim();
    const description = collectionDescriptionInput.value.trim();
    
    if (!name) {
        showToast('Collection name is required', 'error');
        collectionNameInput.focus();
        return;
    }
    
    try {
        showLoading('Creating collection...');
        
        const response = await authenticatedApiCall('/api/collections', {
            method: 'POST',
            body: JSON.stringify({ name, description })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeNewCollectionDialog();
            showToast(`Collection '${name}' created!`, 'success');
            
            // Switch to the newly created collection
            const newCollectionId = data.collection.id;
            await switchCollection(newCollectionId);
        } else {
            showToast('Failed to create collection: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error creating collection:', error);
        showToast('Error creating collection: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

function showEditCollectionDialog() {
    const collection = allCollections[selectedCollectionIndex];
    if (!collection) return;
    
    editingCollectionId = collection.id;
    editCollectionDialog.style.display = 'flex';
    editCollectionNameInput.value = collection.name || '';
    editCollectionDescriptionInput.value = collection.description || '';
    editCollectionNameInput.focus();
    editCollectionNameInput.select();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', handleEditCollectionDialogKeyboard);
}

function closeEditCollectionDialog() {
    editCollectionDialog.style.display = 'none';
    editingCollectionId = null;
    document.removeEventListener('keydown', handleEditCollectionDialogKeyboard);
}

function handleEditCollectionDialogKeyboard(e) {
    if (editCollectionDialog.style.display !== 'flex') return;
    
    if (e.key === 'Escape') {
        e.preventDefault();
        closeEditCollectionDialog();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        saveEditedCollection();
    }
}

async function saveEditedCollection() {
    const name = editCollectionNameInput.value.trim();
    const description = editCollectionDescriptionInput.value.trim();
    
    if (!name) {
        showToast('Collection name is required', 'error');
        editCollectionNameInput.focus();
        return;
    }
    
    if (!editingCollectionId) {
        showToast('No collection selected', 'error');
        return;
    }
    
    try {
        showLoading('Updating collection...');
        
        const response = await authenticatedApiCall(`/api/collections/${editingCollectionId}`, {
            method: 'PUT',
            body: JSON.stringify({ name, description })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeEditCollectionDialog();
            showToast(`Collection '${name}' updated!`, 'success');
            
            // Update the current collection display if we edited the active one
            if (currentCollection && currentCollection.id === editingCollectionId) {
                currentCollection.name = name;
                currentCollection.description = description;
                updateCollectionDisplay();
            }
            
            // Refresh the collection list
            await showCollectionDialog();
        } else {
            showToast('Failed to update collection: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Error updating collection:', error);
        showToast('Error updating collection: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

//=============================================================================
// Panel Resizing with localStorage
//=============================================================================

const resizeHandle = document.getElementById('resize-handle');
const lyricsPanel = document.getElementById('lyrics-panel');
const notesPanel = document.getElementById('notes-panel');
const panelsContainer = document.querySelector('.panels');

let isResizing = false;
let isInResizeMode = false;

// Set up resize functionality
if (resizeHandle && lyricsPanel && notesPanel) {
    resizeHandle.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
}

function startResize(e) {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
}

function handleResize(e) {
    if (!isResizing) return;

    const containerRect = panelsContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const mouseX = e.clientX - containerRect.left;

    // Calculate percentage (10% minimum for notes, 90% maximum for lyrics)
    let lyricsPercentage = (mouseX / containerWidth) * 100;
    lyricsPercentage = Math.max(10, Math.min(90, lyricsPercentage));

    const notesPercentage = 100 - lyricsPercentage;

    // Apply flex basis
    lyricsPanel.style.flex = `0 0 ${lyricsPercentage}%`;
    notesPanel.style.flex = `0 0 ${notesPercentage}%`;
}

function stopResize(e) {
    if (!isResizing) return;

    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Save the current split for this song
    if (currentSong) {
        const lyricsPercentage = (lyricsPanel.getBoundingClientRect().width / panelsContainer.getBoundingClientRect().width) * 100;
        savePanelSplit(currentSong.id, lyricsPercentage);
    }
}

function savePanelSplit(songId, lyricsPercentage) {
    const splits = JSON.parse(localStorage.getItem('bandPracticePanelSplits') || '{}');
    splits[songId] = lyricsPercentage;
    localStorage.setItem('bandPracticePanelSplits', JSON.stringify(splits));
}

window.loadPanelSplit = function(songId) {
    if (!lyricsPanel || !notesPanel) return;

    const splits = JSON.parse(localStorage.getItem('bandPracticePanelSplits') || '{}');
    const lyricsPercentage = splits[songId] || 75; // Default to 75% for lyrics, 25% for notes

    const notesPercentage = 100 - lyricsPercentage;

    lyricsPanel.style.flex = `0 0 ${lyricsPercentage}%`;
    notesPanel.style.flex = `0 0 ${notesPercentage}%`;
};

// Keyboard resize mode
function toggleResizeMode() {
    if (!lyricsPanel || !notesPanel) return;

    isInResizeMode = !isInResizeMode;

    if (isInResizeMode) {
        // Entering resize mode
        resizeHandle.style.background = '#18a049';
        resizeHandle.style.width = '12px';
    } else {
        exitResizeMode();
    }
}

function adjustPanelSplit(deltaPercentage) {
    if (!lyricsPanel || !notesPanel || !panelsContainer) return;
    
    // Get current lyrics percentage
    const currentLyricsWidth = lyricsPanel.getBoundingClientRect().width;
    const containerWidth = panelsContainer.getBoundingClientRect().width;
    let lyricsPercentage = (currentLyricsWidth / containerWidth) * 100;
    
    // Adjust by delta
    lyricsPercentage += deltaPercentage;
    
    // Clamp to limits (10% minimum for notes, 90% maximum for lyrics)
    lyricsPercentage = Math.max(10, Math.min(90, lyricsPercentage));
    
    const notesPercentage = 100 - lyricsPercentage;
    
    // Apply flex basis
    lyricsPanel.style.flex = `0 0 ${lyricsPercentage}%`;
    notesPanel.style.flex = `0 0 ${notesPercentage}%`;
}

function exitResizeMode() {
    isInResizeMode = false;
    
    // Reset resize handle styling
    resizeHandle.style.background = '';
    resizeHandle.style.width = '';
    
    // Save the current split for this song
    if (currentSong) {
        const lyricsPercentage = (lyricsPanel.getBoundingClientRect().width / panelsContainer.getBoundingClientRect().width) * 100;
        savePanelSplit(currentSong.id, lyricsPercentage);
        // showToast('Panel split saved', 'success', 'toast-panel-split');
    }
}

//=============================================================================
// Back to Top Button
//=============================================================================

function scrollToTop() {
    // Find all elements with scrollTop > 0 and scroll them back to top
    const allElements = document.querySelectorAll('*');

    allElements.forEach(element => {
        if (element.scrollTop > 0) {
            element.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

//=============================================================================
// SPOTIFY WEB PLAYBACK SDK WITH OAUTH
//=============================================================================

let spotifyPlayer = null;
let spotifyDeviceId = null;
let spotifyAccessToken = null;
let spotifyPlayerReady = false;
let spotifyAuthWindow = null;
let isCheckingSpotifyStatus = false;

// Spotify SDK ready callback (called by SDK after loading)
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('🎵 Spotify SDK loaded');
    // Don't auto-initialize - wait for token check
};

// Check Spotify connection status on app load
let spotifyStatusCheckRetries = 0;
async function checkSpotifyStatus() {
    if (isCheckingSpotifyStatus) return;

    // Wait for authentication to complete (max 20 retries = 10 seconds)
    if (!authenticatedApiCall) {
        if (spotifyStatusCheckRetries < 20) {
            spotifyStatusCheckRetries++;
            console.log(`⏳ Waiting for authentication before checking Spotify status... (${spotifyStatusCheckRetries}/20)`);
            setTimeout(checkSpotifyStatus, 500);
        } else {
            console.error('❌ Gave up waiting for authentication');
        }
        return;
    }

    isCheckingSpotifyStatus = true;
    spotifyStatusCheckRetries = 0;  // Reset for next time

    try {
        const response = await authenticatedApiCall('/api/spotify/status');
        const data = await response.json();

        if (data.success && data.connected) {
            console.log('✅ User has Spotify connected, initializing player...');
            await initializeSpotifyPlayer();
        } else {
            console.log('ℹ️ User not connected to Spotify');
            showSpotifyConnectPrompt();
        }
    } catch (error) {
        console.error('Error checking Spotify status:', error);
    } finally {
        isCheckingSpotifyStatus = false;
    }
}

// Show "Connect Spotify" prompt in mini player
function showSpotifyConnectPrompt() {
    if (!miniPlayer) return;

    miniPlayer.innerHTML = `
        <button class="btn btn-primary spotify-connect-btn" onclick="connectSpotify()" style="margin: auto;">
            <i class="fa-brands fa-spotify"></i> Connect Spotify for Playback
        </button>
    `;
    miniPlayer.style.display = 'flex';
}

// Connect Spotify button handler
async function connectSpotify() {
    try {
        console.log('🔗 Initiating Spotify connection...');
        
        // Get auth URL
        const response = await authenticatedApiCall('/api/spotify/auth/url');
        const data = await response.json();
        
        if (data.success && data.auth_url) {
            console.log('✅ Got auth URL, opening popup...');
            
            // Open OAuth popup (centered on screen)
            const width = 600;
            const height = 800;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;
            
            spotifyAuthWindow = window.open(
                data.auth_url,
                'Spotify Login',
                `width=${width},height=${height},left=${left},top=${top}`
            );
            
            // Listen for auth completion message from popup
            window.addEventListener('message', handleSpotifyAuthMessage);
            
            showToast('Opening Spotify authorization...', 'info');
        } else {
            showToast('Failed to get authorization URL', 'error');
        }
    } catch (error) {
        console.error('Error connecting Spotify:', error);
        showToast('Failed to connect Spotify', 'error');
    }
}

// Make connectSpotify global so onclick can call it
window.connectSpotify = connectSpotify;

// Handle messages from OAuth popup
function handleSpotifyAuthMessage(event) {
    // Security: verify origin if needed
    // if (event.origin !== window.location.origin) return;
    
    if (event.data.type === 'spotify-auth-success') {
        console.log('✅✅✅ Spotify auth success message received!');
        window.removeEventListener('message', handleSpotifyAuthMessage);
        showToast('Connected to Spotify!', 'success');
        
        // Initialize player with new token
        setTimeout(() => {
            initializeSpotifyPlayer();
        }, 500);
        
    } else if (event.data.type === 'spotify-auth-error') {
        console.error('❌ Spotify auth error:', event.data.error);
        window.removeEventListener('message', handleSpotifyAuthMessage);
        showToast(`Spotify auth failed: ${event.data.error || 'Unknown error'}`, 'error');
    }
}

// Initialize Spotify Web Playback SDK with user token
async function initializeSpotifyPlayer() {
    try {
        console.log('🎵 Initializing Spotify Web Playback SDK...');
        
        // Get access token
        const response = await authenticatedApiCall('/api/spotify/token');
        const data = await response.json();

        if (!data.success) {
            if (data.needs_auth) {
                console.log('ℹ️ User needs to connect Spotify');
                showSpotifyConnectPrompt();
            } else {
                console.error('Failed to get Spotify token:', data);
            }
            return;
        }

        spotifyAccessToken = data.access_token;

        // Check if SDK is loaded
        if (typeof Spotify === 'undefined') {
            console.error('❌ Spotify SDK not loaded!');
            showToast('Spotify SDK not available', 'error');
            return;
        }

        // Create player
        spotifyPlayer = new Spotify.Player({
            name: 'Band Practice Pro',
            getOAuthToken: async cb => {
                // Always get the latest token (could have been refreshed)
                if (spotifyAccessToken) {
                    cb(spotifyAccessToken);
                } else {
                    console.warn('⚠️ No Spotify token available, fetching new one...');
                    try {
                        const response = await authenticatedApiCall('/api/spotify/token');
                        const data = await response.json();
                        if (data.success && data.access_token) {
                            spotifyAccessToken = data.access_token;
                            cb(spotifyAccessToken);
                        } else {
                            console.error('❌ Failed to get Spotify token');
                        }
                    } catch (error) {
                        console.error('❌ Error getting Spotify token:', error);
                    }
                }
            },
            volume: 0.7,
            enableMediaSession: true
        });

        // Error handling
        spotifyPlayer.addListener('initialization_error', ({ message }) => {
            console.error('🚨 Spotify init error:', message);
            showToast('Spotify initialization failed', 'error');
        });

        spotifyPlayer.addListener('authentication_error', ({ message }) => {
            console.error('🚨 Spotify auth error:', message);
            showToast('Spotify auth error - try reconnecting', 'error');
            showSpotifyConnectPrompt();
        });

        spotifyPlayer.addListener('account_error', ({ message }) => {
            console.error('🚨 Spotify account error:', message);
            showToast('Spotify Premium required for playback', 'error');
        });

        spotifyPlayer.addListener('playback_error', ({ message }) => {
            console.error('🚨 Playback error:', message);
            showToast('Playback error: ' + message, 'error');
        });

        // Ready
        spotifyPlayer.addListener('ready', ({ device_id }) => {
            console.log('✅✅✅ Spotify player ready! Device ID:', device_id);
            spotifyDeviceId = device_id;
            spotifyPlayerReady = true;
            updateSpotifyConnectionUI(true);
            // showToast('Spotify player ready!', 'success');
        });

        // Not ready
        spotifyPlayer.addListener('not_ready', ({ device_id }) => {
            console.log('⚠️ Device has gone offline:', device_id);
        });

        // Player state changed
        spotifyPlayer.addListener('player_state_changed', state => {
            if (!state) return;
            updatePlayerUI(state);
        });

        // Connect to Spotify
        const connected = await spotifyPlayer.connect();
        
        if (connected) {
            console.log('✅ Connected to Spotify successfully');

            // Set up automatic token refresh every 45 minutes (Spotify tokens expire in 1 hour)
            if (!window.spotifyTokenRefreshInterval) {
                window.spotifyTokenRefreshInterval = setInterval(async () => {
                    try {
                        console.log('🔄 Refreshing Spotify access token...');
                        const response = await authenticatedApiCall('/api/spotify/token');
                        const data = await response.json();

                        if (data.success && data.access_token) {
                            spotifyAccessToken = data.access_token;
                            console.log('✅ Spotify token refreshed successfully');
                        } else {
                            console.error('❌ Failed to refresh Spotify token:', data);
                        }
                    } catch (error) {
                        console.error('❌ Error refreshing Spotify token:', error);
                    }
                }, 45 * 60 * 1000); // 45 minutes in milliseconds
                console.log('✅ Spotify token auto-refresh enabled (every 45 minutes)');
            }
        } else {
            console.error('❌ Failed to connect to Spotify');
            showToast('Failed to connect to Spotify', 'error');
        }

    } catch (error) {
        console.error('💥 Error initializing Spotify player:', error);
        showToast('Error initializing Spotify: ' + error.message, 'error');
    }
}

// Update UI after successful connection
function updateSpotifyConnectionUI(isConnected) {
    if (isConnected && miniPlayer) {
        // Replace connect button with actual player
        renderMiniPlayer();
    }
}

// Render the mini player with controls
function renderMiniPlayer() {
    if (!miniPlayer || !currentSong) return;

    const artUrl = currentSong.album_art || currentSong.album_art_url || '';

    miniPlayer.innerHTML = `
        <div class="mini-player-art">
            ${artUrl ? `<img src="${artUrl}" alt="Album art">` : '<i class="fa-solid fa-music"></i>'}
        </div>
        <div class="mini-player-main">
            <div class="mini-player-top">
                <div class="mini-player-info">
                    <div class="mini-player-title">${currentSong.title || 'Unknown'}</div>
                    <div class="mini-player-artist">${currentSong.artist || 'Unknown'}</div>
                </div>
                <div class="mini-player-controls">
                    <button class="mini-player-btn mini-player-btn-small" onclick="restartTrack()" title="Restart (T)">
                        <i class="fa-solid fa-rotate-left"></i>
                    </button>
                    <button class="mini-player-btn mini-player-btn-play" onclick="toggleAudioPlayback()" title="Play/Pause (SPACE)">
                        <i class="fa-solid fa-play"></i>
                    </button>
                </div>
            </div>
            <div class="mini-player-progress">
                <input type="range" class="mini-player-slider" id="progress-slider" min="0" max="100" value="0" onchange="seekToPosition(this.value)">
            </div>
        </div>
    `;
    miniPlayer.style.display = 'flex';
}

// Toggle play/pause with spacebar or button click
async function toggleAudioPlayback() {
    if (!currentSong) {
        showToast('No song selected', 'info');
        return;
    }

    if (!spotifyPlayerReady) {
        // Prompt to connect Spotify
        showToast('Connect Spotify to play music', 'info');
        await connectSpotify();
        return;
    }

    try {
        const state = await spotifyPlayer.getCurrentState();
        const spotifyUri = currentSong.spotify_uri;

        if (!spotifyUri) {
            showToast('No Spotify link for this song', 'warning');
            return;
        }

        // Check if we need to switch to a different track
        const currentTrackUri = state?.track_window?.current_track?.uri;
        const needsNewTrack = !state || currentTrackUri !== spotifyUri;

        if (needsNewTrack) {
            // Load and play the new track
            console.log('Loading new track:', currentSong.title);
            await playSpotifyTrack(spotifyUri);
            // showToast('▶ Playing', 'success');
        } else if (state.paused) {
            // Resume playback of current track
            console.log('Resuming playback...');
            await spotifyPlayer.resume();
            // showToast('▶ Playing', 'success');
        } else {
            // Pause playback
            console.log('Pausing playback...');
            await spotifyPlayer.pause();
            // showToast('⏸ Paused', 'success');
        }
    } catch (error) {
        console.error('Error toggling playback:', error);
        showToast('Playback error', 'error');
    }
}

// Load a specific Spotify track in paused state (ready to play)
async function loadSpotifyTrack(uri) {
    if (!spotifyDeviceId || !spotifyAccessToken) {
        showToast('Player not ready', 'error');
        return;
    }

    try {

        // Use the play endpoint to queue the track, then immediately pause
        const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
            method: 'PUT',
            body: JSON.stringify({
                uris: [uri],
                position_ms: 0
            }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${spotifyAccessToken}`
            }
        });

        if (!playResponse.ok) {
            const errorText = await playResponse.text();
            console.error('Load request failed:', playResponse.status, errorText);

            // Handle specific errors
            if (playResponse.status === 403) {
                showToast('Spotify Premium required', 'error');
            } else if (playResponse.status === 404) {
                showToast('Device not found - try reconnecting', 'error');
            } else {
                showToast('Failed to load track', 'error');
            }
            return;
        }

        console.log('✅ Play command sent, waiting briefly before pausing...');

        // Wait a bit longer for the track to actually start before pausing
        await new Promise(resolve => setTimeout(resolve, 300));

        // Now pause the track
        const pauseResponse = await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${spotifyDeviceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${spotifyAccessToken}`
            }
        });

        if (pauseResponse.ok) {
            console.log('✅ Track loaded and paused, ready to play');
        } else {
            console.warn('⚠️ Track loaded but pause may have failed');
        }
    } catch (error) {
        console.error('Error loading track:', error);
        showToast('Failed to load', 'error');
    }
}

// Play a specific Spotify track
async function playSpotifyTrack(uri) {
    if (!spotifyDeviceId || !spotifyAccessToken) {
        showToast('Player not ready', 'error');
        return;
    }

    try {

        const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
            method: 'PUT',
            body: JSON.stringify({ uris: [uri] }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${spotifyAccessToken}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Play request failed:', response.status, errorText);

            // Handle specific errors
            if (response.status === 403) {
                showToast('Spotify Premium required', 'error');
            } else if (response.status === 404) {
                showToast('Device not found - try reconnecting', 'error');
            } else {
                showToast('Failed to play track', 'error');
            }
        } else {
            console.log('✅ Play request successful');
        }
    } catch (error) {
        console.error('Error playing track:', error);
        showToast('Failed to play', 'error');
    }
}

// Update player UI based on state
function updatePlayerUI(state) {
    if (!miniPlayer) return;

    const playBtn = miniPlayer.querySelector('.mini-player-btn-play i');
    if (playBtn) {
        if (state.paused) {
            playBtn.className = 'fa-solid fa-play';
        } else {
            playBtn.className = 'fa-solid fa-pause';
        }
    }

    // Update BPM indicator based on play state
    updateBpmIndicator();

    // Update progress bar and time display
    const position = state.position;
    const duration = state.duration;
    
    const progressSlider = document.getElementById('progress-slider');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');
    
    if (progressSlider && duration > 0) {
        const percentage = (position / duration) * 100;
        progressSlider.value = percentage;
    }
    
    if (currentTimeEl) {
        currentTimeEl.textContent = formatTime(position);
    }
    
    if (totalTimeEl) {
        totalTimeEl.textContent = formatTime(duration);
    }
}

// Format milliseconds to MM:SS
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Restart the current track
async function restartTrack() {
    if (!spotifyPlayer) return;
    
    try {
        await spotifyPlayer.seek(0);
        showToast('⏮ Restarted', 'success');
    } catch (error) {
        console.error('Error restarting track:', error);
        showToast('Failed to restart', 'error');
    }
}

// Skip to next track (currently just restarts since we're playing single tracks)
async function skipTrack() {
    // For now, just restart since we're not using playlists
    // In the future, this could advance to the next song in the collection
    showToast('Skip not implemented yet', 'info');
}

// Seek to a specific position in the track
async function seekToPosition(percentage) {
    if (!spotifyPlayer) return;

    try {
        const state = await spotifyPlayer.getCurrentState();
        if (state && state.duration) {
            const position = (percentage / 100) * state.duration;
            await spotifyPlayer.seek(position);
        }
    } catch (error) {
        console.error('Error seeking:', error);
        showToast('Failed to seek', 'error');
    }
}

// Skip forward or backward by specified seconds
async function skipSeconds(seconds) {
    if (!spotifyPlayer) return;

    try {
        const state = await spotifyPlayer.getCurrentState();
        if (state && state.duration) {
            const currentPosition = state.position;
            const newPosition = Math.max(0, Math.min(state.duration, currentPosition + (seconds * 1000)));
            await spotifyPlayer.seek(newPosition);
            console.log(`⏩ Skipped ${seconds > 0 ? 'forward' : 'backward'} ${Math.abs(seconds)}s`);
        }
    } catch (error) {
        console.error('Error skipping:', error);
    }
}

// Show/hide player and album art based on current song
async function updatePlayerVisibility() {

    if (!currentSong) {
        if (miniPlayer) miniPlayer.style.display = 'none';
        if (albumArtFloat) albumArtFloat.style.display = 'none';
        return;
    }

    // If player is ready, render mini player with controls
    if (spotifyPlayerReady) {
        renderMiniPlayer();

        // Just update the UI - don't load the track yet
        // Track will be loaded when user presses play
        if (currentSong.spotify_uri) {
            console.log('🎵 Song ready to play:', currentSong.title);
        } else {
            console.warn('⚠️ No Spotify URI for this song');
        }
    } else {
        // Show connect prompt if not connected
        showSpotifyConnectPrompt();
    }

    // Update album art floating background
    const artUrl = currentSong.album_art || currentSong.album_art_url;

    if (artUrl && albumArtImage && albumArtFloat) {
        albumArtImage.src = artUrl;
        albumArtFloat.style.setProperty('display', 'block', 'important');
        albumArtFloat.style.opacity = '0.2';
    } else {
        if (albumArtFloat) {
            albumArtFloat.style.display = 'none';
        }
    }
}

//=============================================================================
// BPM Indicator Functions
//=============================================================================

function loadBpmIndicatorPreference() {
    const saved = localStorage.getItem('bpmIndicatorEnabled');
    // Default to true if not set
    bpmIndicatorEnabled = saved === null ? true : saved === 'true';
}

function toggleBpmIndicator() {
    bpmIndicatorEnabled = !bpmIndicatorEnabled;
    localStorage.setItem('bpmIndicatorEnabled', bpmIndicatorEnabled.toString());
    
    // Show status message
    setStatus(bpmIndicatorEnabled ? 'BPM Indicator Enabled' : 'BPM Indicator Disabled', 'success');
    
    updateBpmIndicator();
}

function updateBpmIndicator() {
    // Stop any existing animations
    stopBpmIndicatorPulsing();

    // If indicator is disabled, keep it stopped
    if (!bpmIndicatorEnabled) {
        return;
    }

    // Check if we have a valid BPM
    if (!currentSong || !currentSong.bpm || currentSong.bpm === 'N/A' || currentSong.bpm === 'NOT_FOUND') {
        return;
    }

    // Parse BPM value (supports decimals)
    const bpm = parseFloat(currentSong.bpm);
    if (isNaN(bpm) || bpm <= 0) {
        return;
    }

    // Check if Spotify is playing to start/stop animation
    checkIfPlaying().then(isPlaying => {
        if (isPlaying && bpmIndicatorEnabled) {
            // Animate indicator when playing
            startBpmIndicator(bpm);
        } else {
            // Stop animation when paused
            stopBpmIndicatorPulsing();
        }
    });
}

function stopBpmIndicatorPulsing() {
    // Remove CSS animations from block
    if (bpmIndicatorElement) {
        bpmIndicatorElement.classList.remove('animating');
    }

    // Remove CSS animation from metronome icon
    const metronomeIcon = document.getElementById('bpm-metronome-icon');
    if (metronomeIcon) {
        metronomeIcon.classList.remove('animating');
    }
}

function startBpmIndicator(bpm) {
    if (!bpmIndicatorElement) {
        return;
    }

    // Calculate beat duration in seconds (60 seconds per minute / BPM)
    // Double the duration so animation alternates: ON for one beat, OFF for next beat
    const beatDuration = 60 / bpm;
    const animationDuration = beatDuration * 2;
    const durationString = `${animationDuration}s`;

    // Get the metronome icon
    const metronomeIcon = document.getElementById('bpm-metronome-icon');

    // Set animation duration
    bpmIndicatorElement.style.animationDuration = durationString;
    if (metronomeIcon) {
        metronomeIcon.style.animationDuration = durationString;
    }

    // Force synchronization: remove animations, trigger reflow, then add them back
    bpmIndicatorElement.classList.remove('animating');
    if (metronomeIcon) {
        metronomeIcon.classList.remove('animating');
    }

    // Trigger reflow to restart animations
    void bpmIndicatorElement.offsetWidth;

    // Add animations back - they will now be in sync
    bpmIndicatorElement.classList.add('animating');
    if (metronomeIcon) {
        metronomeIcon.classList.add('animating');
    }
}

// Old JavaScript-based timing functions removed - now using pure CSS animations
// This ensures rock-solid timing that won't drift based on browser activity

async function checkIfPlaying() {
    if (!spotifyPlayer || !spotifyPlayerReady) {
        return false;
    }

    try {
        const state = await spotifyPlayer.getCurrentState();
        return state && !state.paused;
    } catch (error) {
        return false;
    }
}

// Spotify status check is now called ONLY from initializeApp() after auth succeeds
// DO NOT auto-check on page load - wait for authentication first

