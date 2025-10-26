// Band Practice App - Frontend JavaScript

import { eventListenerFlags, registerDialogKeyboardHandler, unregisterDialogKeyboardHandler } from './dialogHelpers.js';
import { registerDialogBackgroundClose, registerButtonListeners } from './uiHelpers.js';

// Debug logging utility 
// only logs in local dev or if debug flag is set in local storage
const isDebugMode = () => {
    // Check if we're on localhost or have debug flag set
    return window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1' ||
           localStorage.getItem('debugMode') === 'true';
};

const debug = {
    log: (...args) => { if (isDebugMode()) console.log(...args); },
    info: (...args) => { if (isDebugMode()) console.info(...args); },
    warn: (...args) => { if (isDebugMode()) console.warn(...args); },
    error: (...args) => { console.error(...args); } // Always log errors
};

let currentSong = null;
let allSongs = [];
let isEditMode = false;
let songSelectorSortMode = localStorage.getItem('songSelectorSortMode') || 'name';
let filteredSongs = [];
let selectedSongIndex = -1;

// Collection management
let currentCollection = null;
let allCollections = [];

// V2: Playlist management
let linkedPlaylists = [];
let otherPlaylists = [];

// Reference to the apiCall function from viewer.html
// This will be passed in when initializeApp is called
let authenticatedApiCall = null;

// DOM Elements
const openSongSelectorBtn = document.getElementById('open-song-selector-btn');
const songSelectorDialog = document.getElementById('song-selector-dialog');
const songSelectorClose = document.getElementById('song-selector-close');
const songSearchInput = document.getElementById('song-search-input');
const songSelectorList = document.getElementById('song-selector-list');
const songSelectorSort = document.getElementById('song-selector-sort');
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
const toastContainer = document.getElementById('toast-container');

const editNotesBtn = document.getElementById('edit-notes-btn');
const saveNotesBtn = document.getElementById('save-notes-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const refreshSongBtn = document.getElementById('refresh-song-btn');
const fetchBpmBtn = document.getElementById('fetch-bpm-btn');
const editLyricsBtn = document.getElementById('edit-lyrics-btn');
const toggleColumnsBtn = document.getElementById('toggle-columns-btn');
const fontSizeSelect = document.getElementById('font-size-select');
const fullscreenToggleBtn = document.getElementById('fullscreen-toggle-btn');

const lyricsEditorDialog = document.getElementById('lyrics-editor-dialog');
const lyricsEditorTitle = document.getElementById('lyrics-editor-title');
const lyricsEditorTextarea = document.getElementById('lyrics-editor-textarea');
const lyricsEditorLineNumbers = document.getElementById('lyrics-editor-line-numbers');
const lyricsEditorSaveBtn = document.getElementById('lyrics-editor-save-btn');
const lyricsEditorCancelBtn = document.getElementById('lyrics-editor-cancel-btn');
const customizationBadgeMain = document.getElementById('customization-badge-main');
const insertVerseBtn = document.getElementById('insert-verse-btn');
const insertChorusBtn = document.getElementById('insert-chorus-btn');
const insertBridgeBtn = document.getElementById('insert-bridge-btn');
const insertIntroBtn = document.getElementById('insert-intro-btn');
const insertOutroBtn = document.getElementById('insert-outro-btn');
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
const setBpmBtn = document.getElementById('set-bpm-btn');

// BPM Tap Trainer DOM elements
const bpmTapDialog = document.getElementById('bpm-tap-dialog');
const bpmTapSongInfo = document.getElementById('bpm-tap-song-info');
const bpmTapDisplay = document.getElementById('bpm-tap-display');
const bpmTapCount = document.getElementById('bpm-tap-count');
const bpmTapResetBtn = document.getElementById('bpm-tap-reset-btn');
if (bpmTapResetBtn) {
    bpmTapResetBtn.addEventListener('click', resetTapTrainer);
}
const bpmTapSaveBtn = document.getElementById('bpm-tap-save-btn');
const bpmTapCancelBtn = document.getElementById('bpm-tap-cancel-btn');

// Loading overlay DOM elements
const loadingOverlay = document.getElementById('loading-overlay');
const loadingMessage = document.getElementById('loading-message');
const loadingDetails = document.getElementById('loading-details');

// Import dialog DOM elements
const importPlaylistBtn = document.getElementById('import-playlist-btn');
const importDialog = document.getElementById('import-dialog');
const importDialogClose = document.getElementById('import-dialog-close');
const importStepUrl = document.getElementById('import-step-url');
const importStepSelect = document.getElementById('import-step-select');
const importStepProgress = document.getElementById('import-step-progress');
const importPlaylistUrl = document.getElementById('import-playlist-url');
const importLoadBtn = document.getElementById('import-load-btn');
const importPlaylistDetails = document.getElementById('import-playlist-details');
const importSongsList = document.getElementById('import-songs-list');
const importSelectAllBtn = document.getElementById('import-select-all-btn');
const importSelectNewBtn = document.getElementById('import-select-new-btn');
const importSelectNoneBtn = document.getElementById('import-select-none-btn');
const importSelectionCount = document.getElementById('import-selection-count');
const importBackBtn = document.getElementById('import-back-btn');
const importStartBtn = document.getElementById('import-start-btn');
const importProgressFill = document.getElementById('import-progress-fill');
const importProgressText = document.getElementById('import-progress-text');
const importProgressList = document.getElementById('import-progress-list');
const importDoneBtn = document.getElementById('import-done-btn');
const playlistMemorySection = document.getElementById('playlist-memory-section');

// User info DOM elements
const mainApp = document.getElementById('main-app');
const userEmail = document.getElementById('user-email');
// Cache elements that are repeatedly queried
const playlistInfoEl = document.getElementById('playlist-info');
const syncProgressEl = document.getElementById('sync-progress');
const songIcon = document.getElementById('song-icon');

// BPM indicator icon (updated dynamically when song metadata is rendered)
let bpmMetronomeIcon = document.getElementById('bpm-metronome-icon');

// Collection DOM elements
const collectionBtn = document.getElementById('collection-btn');
const currentCollectionName = document.getElementById('current-collection-name');
const collectionDialog = document.getElementById('collection-dialog');
const collectionDialogClose = document.getElementById('collection-dialog-close');
const collectionList = document.getElementById('collection-list');
const syncCollectionBtn = document.getElementById('sync-collection-btn');
const newCollectionBtn = document.getElementById('new-collection-btn');
const newCollectionDialog = document.getElementById('new-collection-dialog');
const editCollectionDialog = document.getElementById('edit-collection-dialog');
const collectionNameInput = document.getElementById('collection-name-input');
const collectionDescriptionInput = document.getElementById('collection-description-input');
const editCollectionNameInput = document.getElementById('edit-collection-name-input');
const editCollectionDescriptionInput = document.getElementById('edit-collection-description-input');
const editCollectionSharedCheckbox = document.getElementById('edit-collection-shared-checkbox');
const collaboratorsSection = document.getElementById('collaborators-section');
const collaboratorList = document.getElementById('collaborator-list');
const addCollaboratorInput = document.getElementById('add-collaborator-input');
const addCollaboratorBtn = document.getElementById('add-collaborator-btn');
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

// Mute state
let isMuted = false;
let volumeBeforeMute = 1.0; // Default volume (0.0 to 1.0)

// BPM animation state tracking (to prevent unnecessary restarts)
let lastBpmAnimationState = {
    isAnimating: false,
    bpm: null,
    isPaused: null
};

// Import shared utility functions
import { debounce, throttle, escapeHtml } from './utils.js';

// Initialize - called from viewer.html after auth is complete
window.initializeApp = function(apiCallFunction) {
    debug.log('🎸 Initializing app with authenticated API calls');
    authenticatedApiCall = apiCallFunction;

    // Initialize BPM indicator element reference
    bpmIndicatorElement = document.getElementById('bpm-indicator');

    loadFontSizePreference();
    loadBpmIndicatorPreference();
    loadUserInfo();
    loadCurrentCollection();  // Load collection first, then songs
    setupEventListeners();

    // NOW check Spotify status (after auth is complete)
    debug.log('🎵 Checking Spotify connection status...');
    checkSpotifyStatus();

    // Start session health check (ping backend every 10 minutes to keep session alive)
    startSessionHealthCheck();
};

function setupEventListeners() {
    // Collection management
    collectionBtn.addEventListener('click', showCollectionDialog);
    collectionDialogClose.addEventListener('click', closeCollectionDialog);
    syncCollectionBtn.addEventListener('click', manualSyncCollection);
    newCollectionBtn.addEventListener('click', showNewCollectionDialog);
    newCollectionSaveBtn.addEventListener('click', createNewCollection);
    newCollectionCancelBtn.addEventListener('click', closeNewCollectionDialog);
    editCollectionSaveBtn.addEventListener('click', saveEditedCollection);
    editCollectionCancelBtn.addEventListener('click', closeEditCollectionDialog);

    // Edit collection shared checkbox toggle
    if (editCollectionSharedCheckbox) {
        editCollectionSharedCheckbox.addEventListener('change', () => {
            const isShared = editCollectionSharedCheckbox.checked;
            const collection = allCollections[selectedCollectionIndex];
            const isDefault = collection && collection.name === 'Default';
            collaboratorsSection.style.display = (isShared && !isDefault) ? 'block' : 'none';
        });
    }

    // Add collaborator button
    if (addCollaboratorBtn) {
        addCollaboratorBtn.addEventListener('click', addCollaborator);
    }

    // Add collaborator on Enter key
    if (addCollaboratorInput) {
        addCollaboratorInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addCollaborator();
            }
        });
    }

    // Song selector
    openSongSelectorBtn.addEventListener('click', openSongSelector);
    songSelectorClose.addEventListener('click', closeSongSelector);
    // V2: Sort dropdown instead of toggle button
    if (songSelectorSort) {
        songSelectorSort.value = songSelectorSortMode;
        songSelectorSort.addEventListener('change', handleSortChange);
    }
    // Debounced input for better performance during fast typing
    songSearchInput.addEventListener('input', debounce(filterSongsV2, 150));

    registerButtonListeners([
        [editNotesBtn, enterEditMode],
        [saveNotesBtn, saveNotes],
        [cancelEditBtn, exitEditMode],
        [refreshSongBtn, refreshCurrentSong],
        [fetchBpmBtn, manuallyFetchBpm],
        [setBpmBtn, openBpmDialog],
        [editLyricsBtn, openLyricsEditor],
        [lyricsEditorSaveBtn, saveLyrics],
        [lyricsEditorCancelBtn, closeLyricsEditor],
        [insertVerseBtn, insertVerse],
        [insertChorusBtn, insertChorus],
        [insertBridgeBtn, insertBridge],
        [insertIntroBtn, insertIntro],
        [insertOutroBtn, insertOutro],
        [tightenLyricsBtn, tightenLyrics],
    ]);

    // BPM dialog handlers
    bpmDialogSaveBtn.addEventListener('click', saveBpm);
    bpmDialogCancelBtn.addEventListener('click', closeBpmDialog);

    // Confirmation dialog close buttons
    confirmDialogCancelBtn.addEventListener('click', hideConfirmDialog);

    // Use shared helper for dialog background click-to-close
    registerDialogBackgroundClose(songSelectorDialog, closeSongSelector);
    registerDialogBackgroundClose(lyricsEditorDialog, closeLyricsEditor);
    registerDialogBackgroundClose(importDialog, closeImportDialog);

    registerDialogBackgroundClose(collectionDialog, closeCollectionDialog);
    registerDialogBackgroundClose(newCollectionDialog, closeNewCollectionDialog);
    registerDialogBackgroundClose(editCollectionDialog, closeEditCollectionDialog);
    registerDialogBackgroundClose(bpmDialog, closeBpmDialog);
    registerDialogBackgroundClose(bpmTapDialog, closeBpmTapTrainer);

    toggleColumnsBtn.addEventListener('click', toggleColumns);
    fontSizeSelect.addEventListener('change', handleFontSizeChange);

    // Fullscreen toggle
    fullscreenToggleBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Back to top button
    backToTopBtn.addEventListener('click', scrollToTop);

    // Player controls
    miniPlayerPlayBtn.addEventListener('click', toggleAudioPlayback);

    // Global keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeyboard);
}

// Global keyboard shortcut handler
function handleGlobalKeyboard(e) {

    // Alt+Enter for fullscreen toggle (works even when typing)
    if (e.altKey && e.key === 'Enter') {
        e.preventDefault();
        toggleFullscreen();
        return;
    }

    // Alt+Up/Down for font size adjustment (works even when typing)
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        adjustFontSize(e.key === 'ArrowUp' ? 1 : -1);
        return;
    }

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

    // . (period) to open BPM Tap Trainer
    if (e.key === '.') {
        // Only if current song exists and no other dialog is open
        if (currentSong && 
            !isEditMode && 
            songSelectorDialog.style.display !== 'flex' &&
            lyricsEditorDialog.style.display !== 'flex' &&
            bpmDialog.style.display !== 'flex' &&
            bpmTapDialog.style.display !== 'flex' &&
            confirmDialog.style.display !== 'flex' &&
            importDialog.style.display !== 'flex' &&
            collectionDialog.style.display !== 'flex') {
            e.preventDefault();
            openBpmTapTrainer();
            return;
        }
    }

    // I to toggle BPM indicator
    if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        toggleBpmIndicator();
        return;
    }

    // B to set BPM
    if (e.key === 'b' || e.key === 'B') {
        if (setBpmBtn && !setBpmBtn.disabled) {
            e.preventDefault();
            setBpmBtn.click();
        }
        return;
    }

    // F to fetch BPM online
    if (e.key === 'f' || e.key === 'F') {
        if (fetchBpmBtn && !fetchBpmBtn.disabled) {
            e.preventDefault();
            fetchBpmBtn.click();
        }
        return;
    }

    // T to restart track (rewind to beginning)
    // Skip if Song Chooser is open (Alt+T cycles sort modes there)
    if (e.key === 't' || e.key === 'T') {
        if (songSelectorDialog.style.display !== 'none') {
            return;  // Let Song Chooser handle it
        }
        if (currentSong && spotifyPlayerReady) {
            e.preventDefault();
            restartTrack();
        }
        return;
    }

    // M to toggle mute
    if (e.key === 'm' || e.key === 'M') {
        if (currentSong && spotifyPlayerReady) {
            e.preventDefault();
            toggleMute();
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

    // ESC to close help card
    if (e.key === 'Escape' && helpCardVisible) {
        e.preventDefault();
        toggleHelpCard(); // Close it
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
                userEmail.textContent = data.user.email;
            }
        }
    } catch (error) {
        debug.error('Error loading user info:', error);
        userEmail.textContent = 'User';
    }
}

async function loadSongs() {
    try {
        showLoading('Loading songs...');
        
        // V2: Build query with collection filter and sort mode
        let url = '/api/songs';
        if (currentCollection && currentCollection.id) {
            url += `?collection_id=${encodeURIComponent(currentCollection.id)}`;
            url += `&sort=${songSelectorSortMode}`;
        }
        
        const response = await authenticatedApiCall(url);
        const data = await response.json();

        if (data.success) {
            // V2: Handle both flat list and grouped by playlist
            if (data.playlists) {
                // Playlist-grouped result - flatten for display
                allSongs = [];
                data.playlists.forEach(playlist => {
                    allSongs.push(...playlist.songs);
                });
                // Store playlist data for rendering
                allSongs._playlistData = data.playlists;
            } else {
                allSongs = data.songs;
            }
            debug.log(`✅ Loaded ${allSongs.length} songs from collection ${currentCollection?.name} (sort: ${songSelectorSortMode})`);
            updateCurrentSongDisplay();
            // If song selector is open, refresh the list
            if (songSelectorDialog && songSelectorDialog.style.display === 'flex') {
                filterSongsV2();
            }
            setStatus(`${allSongs.length} songs loaded`, 'success');
        } else {
            showToast('Failed to load songs', 'error');
        }
    } catch (error) {
        debug.error('Error loading songs:', error);
        showToast('Error loading songs: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Check if current user can edit the current collection
function canEditCurrentCollection() {
    if (!currentCollection || !currentUser) return false;

    const userEmail = currentUser.email;
    const isOwner = currentCollection.user_id === userEmail;
    const isCollaborator = currentCollection.collaborators && currentCollection.collaborators.includes(userEmail);

    return isOwner || (currentCollection.is_shared && isCollaborator);
}

// Check if current user is owner of current collection
function isOwnerOfCurrentCollection() {
    if (!currentCollection || !currentUser) return false;
    return currentCollection.user_id === currentUser.email;
}

// Check if current user can write to current collection (owner or collaborator)
function canWriteToCurrentCollection() {
    if (!currentCollection || !currentUser) return false;
    const userEmail = currentUser.email;
    const isOwner = currentCollection.user_id === userEmail;
    const isCollaborator = currentCollection.collaborators && currentCollection.collaborators.includes(userEmail);
    return isOwner || isCollaborator;
}

async function loadSong(songId) {
    try {
        showLoading('Loading song...');
        const response = await authenticatedApiCall(`/api/songs/${songId}`);
        const data = await response.json();

        if (data.success) {
            currentSong = data.song;

            // Save current song to localStorage for session persistence
            saveCurrentSong(songId);

            renderSong();
            updateCurrentSongDisplay();

            // Enable/disable buttons based on permissions
            const canEdit = canEditCurrentCollection();
            const isOwner = isOwnerOfCurrentCollection();

            refreshSongBtn.disabled = !canEdit;
            editNotesBtn.disabled = !canEdit;
            editLyricsBtn.disabled = !canEdit;
            fetchBpmBtn.disabled = !canEdit;
            setBpmBtn.disabled = !canEdit;

            // Update button titles to show permission status
            if (!canEdit) {
                editNotesBtn.title = 'Edit notes (read-only)';
                editLyricsBtn.title = 'Edit lyrics (read-only)';
                fetchBpmBtn.title = 'Fetch BPM (read-only)';
                setBpmBtn.title = 'Set BPM (read-only)';
            } else {
                editNotesBtn.title = 'Edit notes (N)';
                editLyricsBtn.title = 'Edit lyrics (E)';
                fetchBpmBtn.title = 'Fetch BPM from API';
                setBpmBtn.title = 'Set BPM manually';
            }

            setStatus('Song loaded' + (canEdit ? '' : ' (read-only)'), 'success');

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
        debug.log(`🎵 Fetching BPM for ${title} by ${artist} in background...`);
        const response = await authenticatedApiCall(`/api/songs/${songId}/bpm`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success && currentSong && currentSong.id === songId) {
            // Only update if we're still viewing the same song
            currentSong.bpm = data.bpm;
            currentSong.bpm_manual = false; // Clear manual flag since this is from API
            renderMetadata();
            debug.log(`✅ BPM updated: ${data.bpm}`);
            
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
        debug.error(`Error fetching BPM for ${title}:`, error);
        // Update UI to remove loading indicator even on error
        if (currentSong && currentSong.id === songId) {
            renderMetadata();
        }
        // Silently fail - don't show error to user as this is background operation
    }
}

async function fetchLyricsInBackground(songId, title, artist) {
    try {
        debug.log(`📜 Fetching lyrics for ${title} by ${artist} in background...`);
        
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
            debug.log(`✅ Lyrics loaded successfully`);
            
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
            debug.log(`⚠️ Song already has customized lyrics`);
        } else {
            debug.error(`Failed to fetch lyrics: ${data.error || 'Unknown error'}`);
            if (currentSong && currentSong.id === songId) {
                setStatus('Song loaded • Lyrics not available', 'warning');
            }
        }
    } catch (error) {
        debug.error(`Error fetching lyrics for ${title}:`, error);
        if (currentSong && currentSong.id === songId) {
            setStatus('Song loaded • Failed to fetch lyrics', 'error');
        }
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

async function openSongSelector() {
    songSelectorDialog.style.display = 'flex';
    songSearchInput.value = '';

    // Render the song list from already-loaded songs
    filterSongsV2();

    songSearchInput.focus();

    // Add keyboard handler for song selector using shared helper
    registerDialogKeyboardHandler('songSelector', handleSongSelectorKeyboard);

    // Add event delegation for song clicks (more efficient than individual listeners)
    songSelectorList.addEventListener('click', handleSongListClick);
}

function handleSongListClick(e) {
    // Find the clicked song item (could be the item itself or a child element)
    const songItem = e.target.closest('.song-selector-item');
    if (songItem && songItem.dataset.songId) {
        selectSong(songItem.dataset.songId);
    }
}

function closeSongSelector() {
    songSelectorDialog.style.display = 'none';
    selectedSongIndex = -1;
    
    // Remove keyboard handler using shared helper
    unregisterDialogKeyboardHandler('songSelector', handleSongSelectorKeyboard);
    
    // Remove click delegation handler
    songSelectorList.removeEventListener('click', handleSongListClick);
}

// Show temporary sort mode hint in Song Chooser
function showSortModeHint(mode) {
    // Remove any existing hint
    const existingHint = document.querySelector('.sort-mode-hint');
    if (existingHint) {
        existingHint.remove();
    }

    // Create hint element
    const hint = document.createElement('div');
    hint.className = 'sort-mode-hint';

    const modeLabels = {
        'name': 'Sort: By Song Name',
        'artist': 'Sort: By Artist',
        'playlist': 'Sort: By Playlist'
    };

    hint.textContent = modeLabels[mode] || 'Sort: Unknown';

    // Add to song selector dialog
    songSelectorDialog.appendChild(hint);

    // Remove after 2 seconds
    setTimeout(() => {
        hint.classList.add('fade-out');
        setTimeout(() => hint.remove(), 300);
    }, 2000);
}

// V2: Handle sort dropdown change
function handleSortChange(e) {
    songSelectorSortMode = e.target.value;
    localStorage.setItem('songSelectorSortMode', songSelectorSortMode);
    debug.log(`🔄 Sort mode changed to: ${songSelectorSortMode}`);
    loadSongs();  // Reload songs with new sort
}

async function selectSong(songId) {
    // Stop playback if currently playing
    if (spotifyPlayer && spotifyPlayerReady) {
        try {
            const state = await spotifyPlayer.getCurrentState();
            if (state && !state.paused) {
                await spotifyPlayer.pause();
                debug.log('⏸ Paused playback when switching songs');
            }
        } catch (error) {
            debug.warn('Could not pause playback:', error);
        }
    }
    
    // Clear progress update interval
    if (spotifyProgressInterval) {
        clearInterval(spotifyProgressInterval);
        spotifyProgressInterval = null;
    }

    // Reset mute state when loading a new song
    if (isMuted && spotifyPlayer) {
        try {
            await spotifyPlayer.setVolume(volumeBeforeMute);
            debug.log(`🔊 Unmuted on song change - restored volume to ${volumeBeforeMute}`);
        } catch (error) {
            debug.warn('Could not restore volume:', error);
        }
    }
    isMuted = false;

    // Stop BPM indicator pulsing (but keep toggle state)
    stopBpmIndicatorPulsing();
    
    // Reset animation state tracking when changing songs
    lastBpmAnimationState = {
        isAnimating: false,
        bpm: null,
        isPaused: null
    };

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
    
    // Alt+T to cycle through sort modes (name → artist → playlist)
    if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        e.stopPropagation();  // Prevent 'T' from reaching main viewer (which restarts track)
        const modes = ['name', 'artist', 'playlist'];
        const currentIndex = modes.indexOf(songSelectorSortMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        songSelectorSortMode = modes[nextIndex];
        localStorage.setItem('songSelectorSortMode', songSelectorSortMode);
        songSelectorSort.value = songSelectorSortMode;
        loadSongs();
        showSortModeHint(songSelectorSortMode);
        return;
    }
    
    // V2: Delete key to delete selected song
    if (e.key === 'Delete') {
        e.preventDefault();
        if (selectedSongIndex >= 0 && selectedSongIndex < filteredSongs.length) {
            const song = filteredSongs[selectedSongIndex];
            deleteSongWithConfirm(song.id);
        }
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

function renderSong() {
    if (!currentSong) return;

    renderMetadata();
    renderLyrics();
    renderNotes();
    updateCurrentSongDisplay();
    updatePlayerVisibility();
}

function renderMetadata() {
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
        const manualBadge = isManualBpm ? '<span class="bpm-manual-badge" title="Custom bpm/tempo (B)"><i class="fa-solid fa-pen"></i></span>' : '';
        bpmBlockContent = `<i class="fa-solid fa-drum"></i> ${bpmValue} <i class="fa-solid fa-bars-staggered bpm-metronome-icon" id="bpm-metronome-icon"></i>${manualBadge}`;
    }

    // Add the BPM block with animation container
    metadataHtml += `<div class="bpm-indicator-block" id="bpm-indicator-block">${bpmBlockContent}</div>`;

    // Note: Custom lyric badge is now shown in the header next to song name, not in metadata

    songMetadata.innerHTML = metadataHtml;

    // Re-get the BPM indicator references since we just recreated them
    bpmIndicatorElement = document.getElementById('bpm-indicator-block');
    // Update the metronome icon reference (it was recreated with innerHTML)
    bpmMetronomeIcon = document.getElementById('bpm-metronome-icon');

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
        if (line.match(/^\*\*.*\*\*$/)) {
            // Section header (matches **text** format produced by backend)
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

    // Check if this is a START or END block
    const header = noteBlock.querySelector('.note-header')?.textContent || '';
    
    if (header === 'START') {
        // Highlight line 1
        const line1 = document.querySelector('.lyrics-line[data-line="1"]');
        if (line1) {
            line1.classList.add('highlighted');
            scrollIntoViewIfNeeded(line1);
        }
        return;
    }
    
    if (header === 'END') {
        // Highlight last line
        const lastLine = document.querySelector('.lyrics-line[data-line]:last-of-type');
        if (lastLine) {
            lastLine.classList.add('highlighted');
            scrollIntoViewIfNeeded(lastLine);
        }
        return;
    }

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
    if (!lyricsContent || !element) {
        return;
    }

    // Get container bounds
    const containerRect = lyricsContent.getBoundingClientRect();
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
    const containerHeight = lyricsContent.clientHeight;
    const elementHeight = element.offsetHeight;

    // Get current scroll position and element position relative to the container
    const currentScroll = lyricsContent.scrollTop;
    const elementTop = elementRect.top - containerRect.top;

    // Calculate target scroll to center the element
    const targetScroll = currentScroll + elementTop - (containerHeight / 2) + (elementHeight / 2);

    // Smoothly scroll ONLY the lyrics container, not the page
    lyricsContent.scrollTo({
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
            // Already at first note, going up - highlight line 1 and scroll to top
            highlightSingleLine(1);
            scrollToTop();
            return false;
        } else if (direction > 0 && activeIndex === noteBlocks.length - 1) {
            // Already at last note, going down - highlight last line and scroll to bottom
            const lastLine = document.querySelector('.lyrics-line[data-line]:last-of-type');
            if (lastLine) {
                highlightSingleLine(parseInt(lastLine.dataset.line));
            }
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

function highlightSingleLine(lineNum) {
    // Remove previous highlights
    document.querySelectorAll('.lyrics-line.highlighted').forEach(el => {
        el.classList.remove('highlighted');
    });
    document.querySelectorAll('.note-block.active').forEach(el => {
        el.classList.remove('active');
    });

    // Highlight the specific line
    const line = document.querySelector(`.lyrics-line[data-line="${lineNum}"]`);
    if (line) {
        line.classList.add('highlighted');
    }
}

// Scroll lyrics and notes to bottom
function scrollToBottom() {
    if (lyricsContent) {
        lyricsContent.scrollTo({
            top: lyricsContent.scrollHeight,
            behavior: 'smooth'
        });
    }

    // Also scroll notes panel to bottom to reveal song structure
    if (notesView && notesView.parentElement) {
        notesView.parentElement.scrollTo({
            top: notesView.parentElement.scrollHeight,
            behavior: 'smooth'
        });
    }
}

// Jump to first note and scroll to top
function jumpToFirstNote() {
    const noteBlocks = Array.from(document.querySelectorAll('.note-block'));
    
    if (noteBlocks.length === 0) {
        // No notes - just highlight line 1
        highlightSingleLine(1);
        scrollToTop();
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
        // No notes - highlight last line
        const lastLine = document.querySelector('.lyrics-line[data-line]:last-of-type');
        if (lastLine) {
            highlightSingleLine(parseInt(lastLine.dataset.line));
        }
        scrollToBottom();
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

    // Add keyboard shortcuts for notes editor using shared helper
    registerDialogKeyboardHandler('notesEditor', handleNotesEditorKeyboard);
}

function exitEditMode() {
    isEditMode = false;
    notesView.style.display = 'block';
    notesEdit.style.display = 'none';
    editNotesBtn.style.display = 'inline-flex';
    saveNotesBtn.style.display = 'none';
    cancelEditBtn.style.display = 'none';

    // Remove keyboard shortcuts using shared helper
    unregisterDialogKeyboardHandler('notesEditor', handleNotesEditorKeyboard);
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
    loadingOverlay.style.display = 'flex';
    loadingMessage.textContent = message;
    // Hide details by default
    loadingDetails.style.display = 'none';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
    loadingDetails.style.display = 'none';
}

function showLoadingDetails(playlistInfo) {
    if (playlistInfoEl) playlistInfoEl.innerHTML = playlistInfo;
    loadingDetails.style.display = 'block';
}

function updateSyncProgress(message) {
    if (syncProgressEl) syncProgressEl.textContent = message;
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

    toastContainer.appendChild(toast);

    // Remove toast after animation completes (3s wait + 0.8s animation)
    setTimeout(() => {
        toast.remove();
    }, 3800);
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

// Font scale mapping (name -> CSS variable value)
const fontScales = {
    'small': 0.846,    // 11px lyrics (13 * 0.846)
    'medium': 1.0,     // 13px lyrics (base)
    'large': 1.154,    // 15px lyrics
    'xlarge': 1.308,   // 17px lyrics
    'xxlarge': 1.538,  // 20px lyrics
    'xxxlarge': 1.846  // 24px lyrics
};

// Set font scale via CSS variable
function setFontScale(scale) {
    mainApp.style.setProperty('--font-scale', scale);
}

// Adjust font size incrementally with keyboard shortcuts
function adjustFontSize(direction) {
    // Get current scale from CSS variable or localStorage
    const currentScale = parseFloat(
        getComputedStyle(mainApp).getPropertyValue('--font-scale') ||
        localStorage.getItem('bandPracticeFontScale') ||
        1.0
    );

    // Increment/decrement by 0.05 (5% adjustment)
    const step = 0.05;
    let newScale = currentScale + (direction * step);

    // Clamp between 0.5 and 2.5 (reasonable limits)
    newScale = Math.max(0.5, Math.min(2.5, newScale));
    newScale = Math.round(newScale * 100) / 100; // Round to 2 decimals

    // Apply the new scale
    setFontScale(newScale);

    // Update localStorage
    localStorage.setItem('bandPracticeFontScale', newScale);

    // Update dropdown to closest match (optional - keeps UI in sync)
    updateFontSizeDropdown(newScale);
}

// Update dropdown to nearest matching size
function updateFontSizeDropdown(scale) {
    // Find closest preset
    let closest = 'medium';
    let minDiff = Infinity;

    for (const [name, presetScale] of Object.entries(fontScales)) {
        const diff = Math.abs(scale - presetScale);
        if (diff < minDiff) {
            minDiff = diff;
            closest = name;
        }
    }

    fontSizeSelect.value = closest;
    localStorage.setItem('bandPracticeFontSize', closest);
}

// Font Size Change Function - Now uses CSS variables!
function handleFontSizeChange(e) {
    const fontSize = e.target.value;
    const scale = fontScales[fontSize] || 1.0;

    setFontScale(scale);

    // Save preference to localStorage
    localStorage.setItem('bandPracticeFontSize', fontSize);
    localStorage.setItem('bandPracticeFontScale', scale);
}

// Load saved font size on init
function loadFontSizePreference() {
    const savedSize = localStorage.getItem('bandPracticeFontSize') || 'medium';
    const savedScale = localStorage.getItem('bandPracticeFontScale') || fontScales['medium'];

    fontSizeSelect.value = savedSize;
    setFontScale(savedScale);
}


// Lyrics Editor Functions
function openLyricsEditor() {
    if (!currentSong) return;

    // Set the dialog title with song info
    lyricsEditorTitle.textContent = `Edit Lyrics: ${currentSong.title} - ${currentSong.artist}`;

    // Show customization badge if song is already customized (only on main view, not in editor)
    if (currentSong.is_customized) {
        if (customizationBadgeMain) customizationBadgeMain.style.display = 'inline-flex';
    } else {
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

    // Add keyboard shortcuts for lyrics editor using shared helper
    registerDialogKeyboardHandler('lyricsEditor', handleLyricsEditorKeyboard);
}

function updateLyricsEditorLineNumbers() {
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

    lyricsEditorLineNumbers.textContent = lineNumbersText;
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
    lyricsEditorLineNumbers.scrollTop = lyricsEditorTextarea.scrollTop;
}

function closeLyricsEditor() {
    lyricsEditorDialog.style.display = 'none';
    lyricsEditorTextarea.value = '';

    // Remove keyboard shortcuts using shared helper
    unregisterDialogKeyboardHandler('lyricsEditor', handleLyricsEditorKeyboard);
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

    // Alt+B to insert [Bridge]
    if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        e.stopPropagation();
        insertBridge();
        return;
    }

    // Alt+I to insert [Intro]
    if (e.altKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        e.stopPropagation();
        insertIntro();
        return;
    }

    // Alt+O to insert [Outro]
    if (e.altKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        e.stopPropagation();
        insertOutro();
        return;
    }
}

function tightenLyrics() {
    const lines = lyricsEditorTextarea.value.split('\n');
    const tightenedLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Check if line is a section header like [Verse 1], [Chorus], etc.
        const isHeader = /^\[.*\]/.test(trimmedLine);

        // Check if line is blank
        const isBlank = trimmedLine === '';

        // Check if previous line was a header
        const prevLine = i > 0 ? lines[i - 1].trim() : '';
        const previousLineWasHeader = /^\[.*\]/.test(prevLine);

        // Check if next line is a header
        const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
        const nextLineIsHeader = /^\[.*\]/.test(nextLine);

        // Skip blank lines that are immediately before or after headers
        if (isBlank && (previousLineWasHeader || nextLineIsHeader)) {
            continue;
        }

        // Add the line
        tightenedLines.push(line);
    }

    // Update the textarea with tightened lyrics
    lyricsEditorTextarea.value = tightenedLines.join('\n');

    // Update line numbers to reflect the changes
    updateLyricsEditorLineNumbers();

    // Show feedback
    showToast('Removed blank lines around section headers', 'success');
}

// Generic function to insert section headers in lyrics editor
function insertSectionHeader(headerText) {
    const textarea = lyricsEditorTextarea;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = textarea.value.substring(0, start);
    const textAfter = textarea.value.substring(end);
    
    // Insert header text (replaces selected text if any)
    textarea.value = textBefore + headerText + textAfter;
    
    // Move cursor to end of inserted text
    const newCursorPos = start + headerText.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
    
    // Update line numbers
    updateLyricsEditorLineNumbers();
}

// Convenience wrappers for specific section types
function insertVerse() { insertSectionHeader('[Verse]'); }
function insertChorus() { insertSectionHeader('[Chorus]'); }
function insertBridge() { insertSectionHeader('[Bridge]'); }
function insertIntro() { insertSectionHeader('[Intro]'); }
function insertOutro() { insertSectionHeader('[Outro]'); }

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

    // Add keyboard shortcuts with capture phase (only if not already registered)
    if (!eventListenerFlags.confirmDialog) {
        document.addEventListener('keydown', handleConfirmDialogKeyboard, true);
        eventListenerFlags.confirmDialog = true;
    }
}

function hideConfirmDialog() {
    confirmDialog.style.display = 'none';
    currentConfirmCallback = null;

    // Remove keyboard shortcuts
    if (eventListenerFlags.confirmDialog) {
        document.removeEventListener('keydown', handleConfirmDialogKeyboard, true);
        eventListenerFlags.confirmDialog = false;
    }
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

    // Add keyboard shortcuts using shared helper
    registerDialogKeyboardHandler('bpmDialog', handleBpmDialogKeyboard);
}

function closeBpmDialog() {
    bpmDialog.style.display = 'none';
    bpmInput.value = '';

    // Remove keyboard shortcuts using shared helper
    unregisterDialogKeyboardHandler('bpmDialog', handleBpmDialogKeyboard);
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
            setStatus(`BPM updated to ${bpmRounded.toFixed(1)}`, 'success');
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

    // Add keyboard shortcuts using shared helper
    registerDialogKeyboardHandler('bpmTapDialog', handleBpmTapKeyboard);
}

function closeBpmTapTrainer() {
    bpmTapDialog.style.display = 'none';
    resetTapTrainer();

    // Remove keyboard shortcuts using shared helper
    unregisterDialogKeyboardHandler('bpmTapDialog', handleBpmTapKeyboard);
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

    // Arrow Up to increase BPM by 0.1
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (detectedBpm !== null) {
            detectedBpm = Math.round((detectedBpm + 0.1) * 10) / 10;
            bpmTapDisplay.textContent = detectedBpm.toFixed(1);
            // Enable save button if not already enabled
            if (tapTimes.length >= 1) {
                bpmTapSaveBtn.disabled = false;
            }
        }
        return;
    }

    // Arrow Down to decrease BPM by 0.1
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (detectedBpm !== null && detectedBpm > 0.1) {
            detectedBpm = Math.round((detectedBpm - 0.1) * 10) / 10;
            bpmTapDisplay.textContent = detectedBpm.toFixed(1);
            // Enable save button if not already enabled
            if (tapTimes.length >= 1) {
                bpmTapSaveBtn.disabled = false;
            }
        }
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

// Set up import dialog event listeners in the main setup
document.addEventListener('DOMContentLoaded', () => {
    if (importPlaylistBtn) {
        importPlaylistBtn.addEventListener('click', showImportDialog);
        importDialogClose.addEventListener('click', closeImportDialog);
        // The import button may be named/imported differently in V2 HTML.
        // Try to find by id first, then by class; add listener only if present.
        const importLoadBtn = document.getElementById('import-load-btn') || document.querySelector('.import-playlist-link-btn');
        if (importLoadBtn) {
            importLoadBtn.addEventListener('click', async () => {
                const url = importPlaylistUrl.value.trim();
                if (url) await linkPlaylist(url);
            });
        }
        // importSelectAllBtn.addEventListener('click', selectAllSongs);
        // importSelectNewBtn.addEventListener('click', selectNewSongs);
        // importSelectNoneBtn.addEventListener('click', selectNoneSongs);
        // importBackBtn.addEventListener('click', backToUrlStep);
        // importStartBtn.addEventListener('click', startImport);
        // importDoneBtn.addEventListener('click', finishImport);
    }
});

async function showImportDialog() {
    // V2: Render playlists BEFORE showing dialog (prevents resize flash)
    renderPlaylistDialog();

    importDialog.style.display = 'flex';
    // Only show the single-step URL input in V2
    importStepUrl.style.display = 'flex';

    // Clear the URL input field
    importPlaylistUrl.value = '';

    // Focus the input so user can paste and press Enter
    importPlaylistUrl.focus();

    // Add keyboard shortcuts using shared helper
    registerDialogKeyboardHandler('importDialog', handleImportDialogKeyboard);
}

function closeImportDialog() {
    importDialog.style.display = 'none';
    importDialogState = {
        playlistUrl: '',
        playlist: null,
        songs: [],
        selectedSongIds: new Set()
    };

    // Remove keyboard shortcuts using shared helper
    unregisterDialogKeyboardHandler('importDialog', handleImportDialogKeyboard);
}

async function handleImportDialogKeyboard(e) {
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
    if (
        importStepUrl.style.display === 'flex' &&
        Array.isArray(importDialogState.cachedPlaylists) &&
        importDialogState.cachedPlaylists.length > 0
    ) {
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

    // ENTER should import the playlist URL directly (V2 single-step)
    if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();

        if (importStepUrl.style.display === 'flex') {
            const url = importPlaylistUrl.value.trim();
            if (!url) {
                showToast('Please enter a playlist URL', 'error');
                return;
            }

            // If an import button exists, trigger it; otherwise call linkPlaylist directly
            const importLoadBtn = document.getElementById('import-load-btn') || document.querySelector('.import-playlist-link-btn');
            if (importLoadBtn) {
                importLoadBtn.click();
            } else {
                await linkPlaylist(url);
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
        importProgressFill.style.width = '0%';
        importProgressText.textContent = `0 / ${selectedIds.length}`;
        importProgressList.innerHTML = '';

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
                importProgressList.appendChild(itemDiv);
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
                            debug.log('Stream complete');
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
                                        importProgressFill.style.width = `${percentage}%`;
                                        importProgressText.textContent = `${update.completed} / ${update.total}`;

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
                                        debug.log('Import complete:', update.stats);
                                        
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
                                    debug.error('Error parsing SSE message:', parseError);
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
        debug.error('Import error:', error);
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
            if (playlistMemorySection) playlistMemorySection.style.display = 'none';
        }
    } catch (error) {
        debug.error('Error loading playlist memory:', error);
    }
}

function renderPlaylistMemory(playlists) {
    const listDiv = document.getElementById('playlist-memory-list');

    if (!playlistMemorySection || !listDiv) return;

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
    playlistMemorySection.style.display = 'block';

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
        // Check localStorage for current collection ID FIRST
        const savedCollectionId = localStorage.getItem('bandPracticeCurrentCollection');
        const savedSongId = localStorage.getItem('bandPracticeCurrentSong');
        
        // Determine which collection to load - prefer saved, fallback to default endpoint
        const endpoint = savedCollectionId 
            ? `/api/collections/${savedCollectionId}`
            : '/api/collections/default';
        
        debug.log(`📂 Loading collection from: ${endpoint}`);
        
        const response = await authenticatedApiCall(endpoint);
        const data = await response.json();
        
        if (data.success) {
            currentCollection = data.collection;
            saveCurrentCollection(currentCollection.id);
            updateCollectionDisplay();

            // Load songs for this collection
            await loadSongs();

            // Load playlists for this collection (so dialog opens instantly)
            await loadPlaylistsForDialog();

            // If we have a saved song ID, try to load it
            if (savedSongId) {
                // Check if the saved song exists in the current collection
                const songExists = allSongs.some(song => song.id === savedSongId);
                if (songExists) {
                    debug.log(`🎵 Restoring last viewed song: ${savedSongId}`);
                    await loadSong(savedSongId);
                } else {
                    debug.log(`⚠️ Saved song ${savedSongId} not found in collection`);
                    // Clear the invalid saved song ID
                    localStorage.removeItem('bandPracticeCurrentSong');
                }
            }
        } else {
            showToast('Failed to load collection', 'error');
        }
    } catch (error) {
        debug.error('Error loading current collection:', error);
        showToast('Error loading collection: ' + error.message, 'error');
    }
}

function saveCurrentCollection(collectionId) {
    localStorage.setItem('bandPracticeCurrentCollection', collectionId);
}

function saveCurrentSong(songId) {
    if (songId) {
        localStorage.setItem('bandPracticeCurrentSong', songId);
    } else {
        localStorage.removeItem('bandPracticeCurrentSong');
    }
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

            // Show sync button if user has write access to current collection
            const syncBtn = document.getElementById('sync-collection-btn');
            if (syncBtn && currentCollection && canWriteToCurrentCollection()) {
                syncBtn.style.display = 'inline-flex';
            } else if (syncBtn) {
                syncBtn.style.display = 'none';
            }
        } else {
            showToast('Failed to load collections', 'error');
        }
    } catch (error) {
        debug.error('Error loading collections:', error);
        showToast('Error loading collections: ' + error.message, 'error');
    } finally {
        hideLoading();
    }

    // Add keyboard shortcuts
    if (!eventListenerFlags.collectionDialog) {
        document.addEventListener('keydown', handleCollectionDialogKeyboard);
        eventListenerFlags.collectionDialog = true;
    }
}

function closeCollectionDialog() {
    collectionDialog.style.display = 'none';
    
    if (eventListenerFlags.collectionDialog) {
        document.removeEventListener('keydown', handleCollectionDialogKeyboard);
        eventListenerFlags.collectionDialog = false;
    }
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
}

// Helper function to render a single collection item
function renderCollectionItem(collection, index, section = 'yours') {
    const isActive = currentCollection && collection.id === currentCollection.id;
    const activeClass = isActive ? 'active' : '';
    const canEdit = collection.name !== 'Default';
    const playlistCount = collection.playlist_count || 0;
    const songCount = collection.song_count || 0;

    // Build count text: "3 playlists, 27 songs"
    const countParts = [];
    if (playlistCount > 0) {
        countParts.push(playlistCount === 1 ? '1 playlist' : `${playlistCount} playlists`);
    }
    countParts.push(songCount === 1 ? '1 song' : `${songCount} songs`);
    const countText = countParts.join(', ');

    // Use first playlist image if available, otherwise show icon
    const imageHtml = collection.first_playlist_image
        ? `<img src="${collection.first_playlist_image}" alt="${escapeHtml(collection.name)}">`
        : `<i class="fa-solid fa-layer-group"></i>`;

    // Determine user's role in this collection
    const userEmail = currentUser?.email;
    const isOwner = collection.user_id === userEmail;
    const isCollaborator = collection.collaborators && collection.collaborators.includes(userEmail);
    const isShared = collection.is_shared;

    // Build badges HTML based on section
    let badgesHtml = '';
    if (section === 'yours') {
        // In "Your Collections" section: only show "Shared" badge if this collection is shared
        if (isShared) {
            badgesHtml += '<span class="collection-badge collection-badge-shared" title="Visible to all users"><i class="fa-solid fa-share-nodes"></i> Shared</span>';
        }
    } else if (section === 'shared') {
        // In "Shared With You" section: show role (Collaborator or Read-Only)
        if (isCollaborator) {
            badgesHtml += '<span class="collection-badge collection-badge-collaborator" title="You can edit songs"><i class="fa-solid fa-user-edit"></i> Collaborator</span>';
        } else {
            badgesHtml += '<span class="collection-badge collection-badge-readonly" title="You can view but not edit songs"><i class="fa-solid fa-eye"></i> Read-Only</span>';
        }
    }

    // Build action buttons (stacked vertically)
    let actionButtonsHtml = '';
    if (isOwner) {
        actionButtonsHtml = `
            <div class="collection-item-actions">
                <button class="collection-item-edit" data-collection-id="${collection.id}" title="Edit collection settings"><i class="fa-solid fa-gear"></i></button>
                ${canEdit ? `<button class="collection-item-delete" data-collection-id="${collection.id}" data-collection-name="${escapeHtml(collection.name)}" title="Delete collection (Del)"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        `;
    }

    return `
        <div class="collection-item ${activeClass}" data-collection-id="${collection.id}" data-collection-index="${index}">
            <div class="collection-item-icon">
                ${imageHtml}
            </div>
            <div class="collection-item-info">
                <div class="collection-item-header">
                    <span class="collection-item-name">${escapeHtml(collection.name)}</span>
                    <span class="collection-item-counts">${countText}</span>
                </div>
                ${collection.description ? `<div class="collection-item-description">${escapeHtml(collection.description)}</div>` : ''}
            </div>
            ${badgesHtml ? `<div class="collection-item-badges">${badgesHtml}</div>` : ''}
            ${actionButtonsHtml}
        </div>
    `;
}

function renderCollectionList() {
    if (!allCollections || allCollections.length === 0) {
        collectionList.innerHTML = '<div class="empty-state"><p>No collections found</p></div>';
        return;
    }

    const userEmail = currentUser?.email;

    // Split collections into "Your Collections" and "Shared Collections"
    const yourCollections = allCollections.filter(c => c.user_id === userEmail);
    const sharedCollections = allCollections.filter(c => c.user_id !== userEmail);

    let html = '';

    // Render "Your Collections" section
    if (yourCollections.length > 0) {
        html += `
            <div class="collection-section-header">
                Your Collections
                <span class="collection-badge collection-badge-owner" title="You own these collections"><i class="fa-solid fa-crown"></i> Owner</span>
            </div>
        `;
        yourCollections.forEach((collection, sectionIndex) => {
            const index = allCollections.indexOf(collection);
            html += renderCollectionItem(collection, index, 'yours');
        });
    }

    // Render "Shared Collections" section
    if (sharedCollections.length > 0) {
        html += `
            <div class="collection-section-header">
                Shared With You
                <span class="collection-badge collection-badge-shared" title="Collections shared by others"><i class="fa-solid fa-share-nodes"></i> Shared</span>
            </div>
        `;
        sharedCollections.forEach((collection, sectionIndex) => {
            const index = allCollections.indexOf(collection);
            html += renderCollectionItem(collection, index, 'shared');
        });
    }

    collectionList.innerHTML = html;
    
    // Add click handlers for collection items
    document.querySelectorAll('.collection-item').forEach(item => {
        // Mouse hover to update selection index
        item.addEventListener('mouseenter', () => {
            const index = parseInt(item.dataset.collectionIndex);
            highlightCollectionItem(index);
        });
        
        // Click to select (but not on edit/delete buttons)
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.collection-item-edit') && !e.target.closest('.collection-item-delete')) {
                switchCollection(item.dataset.collectionId);
            }
        });
    });
    
    // Add click handlers for edit buttons
    document.querySelectorAll('.collection-item-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const collectionId = btn.dataset.collectionId;
            // Find the collection in allCollections
            const collection = allCollections.find(c => c.id === collectionId);
            if (collection) {
                selectedCollectionIndex = allCollections.indexOf(collection);
                showEditCollectionDialog();
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
            saveCurrentSong(null); // Clear saved song since it's not in new collection
            lyricsContentInner.innerHTML = '<div class="empty-state"><p>Select a song to view lyrics</p></div>';
            notesView.innerHTML = '<div class="empty-state"><p>Select a song to view notes</p></div>';
            songMetadata.innerHTML = '';

            await loadSongs();

            // Load playlists for this collection (so dialog opens instantly)
            await loadPlaylistsForDialog();

            setStatus(`Switched to collection: ${currentCollection.name}`, 'success');
        } else {
            showToast('Failed to switch collection', 'error');
        }
    } catch (error) {
        debug.error('Error switching collection:', error);
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
        debug.error('Error deleting collection:', error);
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
    if (!eventListenerFlags.newCollectionDialog) {
        document.addEventListener('keydown', handleNewCollectionDialogKeyboard);
        eventListenerFlags.newCollectionDialog = true;
    }
}

function closeNewCollectionDialog() {
    newCollectionDialog.style.display = 'none';
    
    if (eventListenerFlags.newCollectionDialog) {
        document.removeEventListener('keydown', handleNewCollectionDialogKeyboard);
        eventListenerFlags.newCollectionDialog = false;
    }
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
        debug.error('Error creating collection:', error);
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

    // Set shared checkbox (Default collection can't be shared)
    const isDefault = collection.name === 'Default';
    editCollectionSharedCheckbox.checked = collection.is_shared || false;
    editCollectionSharedCheckbox.disabled = isDefault;
    if (isDefault) {
        editCollectionSharedCheckbox.parentElement.parentElement.style.opacity = '0.5';
        editCollectionSharedCheckbox.parentElement.parentElement.title = 'Default collection is always private';
    } else {
        editCollectionSharedCheckbox.parentElement.parentElement.style.opacity = '1';
        editCollectionSharedCheckbox.parentElement.parentElement.title = '';
    }

    // Show/hide collaborators section based on shared status
    collaboratorsSection.style.display = (collection.is_shared && !isDefault) ? 'block' : 'none';

    // Populate collaborator list
    renderCollaboratorList(collection.collaborators || []);

    // Clear add collaborator input
    addCollaboratorInput.value = '';

    editCollectionNameInput.focus();
    editCollectionNameInput.select();

    // Add keyboard shortcuts
    if (!eventListenerFlags.editCollectionDialog) {
        document.addEventListener('keydown', handleEditCollectionDialogKeyboard);
        eventListenerFlags.editCollectionDialog = true;
    }
}

// Render collaborator chips
function renderCollaboratorList(collaborators) {
    collaboratorList.innerHTML = '';

    if (!collaborators || collaborators.length === 0) {
        collaboratorList.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px; font-style: italic;">No collaborators yet</div>';
        return;
    }

    collaborators.forEach(email => {
        const chip = document.createElement('div');
        chip.style.cssText = 'display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--accent); color: white; border-radius: 16px; margin: 4px; font-size: 13px;';
        chip.innerHTML = `
            <span>${email}</span>
            <button onclick="removeCollaborator('${email}')" style="background: none; border: none; color: white; cursor: pointer; padding: 0; font-size: 16px; line-height: 1;" title="Remove collaborator">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        collaboratorList.appendChild(chip);
    });
}

// Add collaborator
function addCollaborator() {
    const collection = allCollections[selectedCollectionIndex];
    if (!collection) return;

    const email = addCollaboratorInput.value.trim().toLowerCase();
    if (!email) return;

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        showToast('Invalid email format', 'error');
        return;
    }

    // Check if already in list
    const collaborators = collection.collaborators || [];
    if (collaborators.includes(email)) {
        showToast('This collaborator is already added', 'error');
        return;
    }

    // Check limit
    if (collaborators.length >= 10) {
        showToast('Maximum 10 collaborators allowed', 'error');
        return;
    }

    // Add to list
    collaborators.push(email);
    collection.collaborators = collaborators;
    renderCollaboratorList(collaborators);
    addCollaboratorInput.value = '';
    addCollaboratorInput.focus();
}

// Remove collaborator
function removeCollaborator(email) {
    const collection = allCollections[selectedCollectionIndex];
    if (!collection) return;

    const collaborators = collection.collaborators || [];
    const index = collaborators.indexOf(email);
    if (index > -1) {
        collaborators.splice(index, 1);
        collection.collaborators = collaborators;
        renderCollaboratorList(collaborators);
    }
}

function closeEditCollectionDialog() {
    editCollectionDialog.style.display = 'none';
    editingCollectionId = null;
    
    if (eventListenerFlags.editCollectionDialog) {
        document.removeEventListener('keydown', handleEditCollectionDialogKeyboard);
        eventListenerFlags.editCollectionDialog = false;
    }
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
    const is_shared = editCollectionSharedCheckbox.checked;
    const collection = allCollections[selectedCollectionIndex];
    const collaborators = collection ? (collection.collaborators || []) : [];

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
            body: JSON.stringify({ name, description, is_shared, collaborators })
        });

        const data = await response.json();

        if (data.success) {
            closeEditCollectionDialog();
            showToast(`Collection '${name}' updated!`, 'success');

            // Update the current collection display if we edited the active one
            if (currentCollection && currentCollection.id === editingCollectionId) {
                currentCollection.name = name;
                currentCollection.description = description;
                currentCollection.is_shared = is_shared;
                currentCollection.collaborators = collaborators;
                updateCollectionDisplay();
            }
            
            // Refresh the collection list
            await showCollectionDialog();
        } else {
            showToast('Failed to update collection: ' + data.error, 'error');
        }
    } catch (error) {
        debug.error('Error updating collection:', error);
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
let spotifyProgressInterval = null;  // For updating progress bar during playback

// Spotify SDK ready callback (called by SDK after loading)
window.onSpotifyWebPlaybackSDKReady = () => {
    debug.log('🎵 Spotify SDK loaded');
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
            debug.log(`⏳ Waiting for authentication before checking Spotify status... (${spotifyStatusCheckRetries}/20)`);
            setTimeout(checkSpotifyStatus, 500);
        } else {
            debug.error('❌ Gave up waiting for authentication');
        }
        return;
    }

    isCheckingSpotifyStatus = true;
    spotifyStatusCheckRetries = 0;  // Reset for next time

    try {
        const response = await authenticatedApiCall('/api/spotify/status');
        const data = await response.json();

        if (data.success && data.connected) {
            debug.log('✅ User has Spotify connected, initializing player...');
            await initializeSpotifyPlayer();
        } else {
            debug.log('ℹ️ User not connected to Spotify');
            showSpotifyConnectPrompt();
        }
    } catch (error) {
        debug.error('Error checking Spotify status:', error);
    } finally {
        isCheckingSpotifyStatus = false;
    }
}

// Show "Connect Spotify" prompt in mini player
function showSpotifyConnectPrompt(showReconnect = false) {
    if (!miniPlayer) return;

    if (showReconnect) {
        // Show reconnect option when there's a permissions issue
        miniPlayer.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px; align-items: center; margin: auto;">
                <button class="btn btn-primary spotify-connect-btn" onclick="reconnectSpotify()" style="margin: 0;">
                    <i class="fa-brands fa-spotify"></i> Reconnect Spotify (Fix Permissions)
                </button>
                <small style="color: #8899a6;">Need to re-approve Spotify permissions</small>
            </div>
        `;
    } else {
        miniPlayer.innerHTML = `
            <button class="btn btn-primary spotify-connect-btn" onclick="connectSpotify()" style="margin: auto;">
                <i class="fa-brands fa-spotify"></i> Connect Spotify for Playback
            </button>
        `;
    }
    miniPlayer.style.display = 'flex';
}

// Reconnect Spotify with forced reauth
async function reconnectSpotify() {
    // First disconnect
    try {
        await authenticatedApiCall('/api/spotify/disconnect', { method: 'POST' });
        debug.log('✅ Disconnected from Spotify');
    } catch (error) {
        debug.warn('⚠️ Error disconnecting:', error);
        // Continue anyway
    }

    // Then connect with force_reauth
    await connectSpotify(true);
}

// Make reconnectSpotify global
window.reconnectSpotify = reconnectSpotify;

// Connect Spotify button handler
async function connectSpotify(forceReauth = false) {
    try {
        debug.log(`🔗 Initiating Spotify connection (forceReauth=${forceReauth})...`);

        // Get auth URL with optional force_reauth parameter
        const url = forceReauth ? '/api/spotify/auth/url?force_reauth=true' : '/api/spotify/auth/url';
        const response = await authenticatedApiCall(url);
        const data = await response.json();

        if (data.success && data.auth_url) {
            debug.log('✅ Got auth URL, opening popup...');

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

            if (forceReauth) {
                showToast('Please approve Spotify permissions in the popup...', 'info');
            } else {
                showToast('Opening Spotify authorization...', 'info');
            }
        } else {
            showToast('Failed to get authorization URL', 'error');
        }
    } catch (error) {
        debug.error('Error connecting Spotify:', error);
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
        debug.log('✅✅✅ Spotify auth success message received!');
        window.removeEventListener('message', handleSpotifyAuthMessage);
        showToast('Connected to Spotify!', 'success');
        
        // Initialize player with new token
        setTimeout(() => {
            initializeSpotifyPlayer();
        }, 500);
        
    } else if (event.data.type === 'spotify-auth-error') {
        debug.error('❌ Spotify auth error:', event.data.error);
        window.removeEventListener('message', handleSpotifyAuthMessage);
        showToast(`Spotify auth failed: ${event.data.error || 'Unknown error'}`, 'error');
    }
}

// Initialize Spotify Web Playback SDK with user token
async function initializeSpotifyPlayer() {
    try {
        debug.log('🎵 Initializing Spotify Web Playback SDK...');
        
        // Get access token
        const response = await authenticatedApiCall('/api/spotify/token');
        const data = await response.json();

        if (!data.success) {
            if (data.needs_auth) {
                debug.log('ℹ️ User needs to connect Spotify');
                showSpotifyConnectPrompt();
            } else {
                debug.error('Failed to get Spotify token:', data);
            }
            return;
        }

        spotifyAccessToken = data.access_token;

        // Check user's Spotify Premium status
        try {
            debug.log('🔍 Checking Spotify Premium status...');
            const profileResponse = await fetch('https://api.spotify.com/v1/me', {
                headers: {
                    'Authorization': `Bearer ${spotifyAccessToken}`
                }
            });

            if (profileResponse.ok) {
                const profile = await profileResponse.json();
                debug.log('📋 Spotify account info:', {
                    email: profile.email,
                    product: profile.product,
                    country: profile.country
                });

                // Save Spotify profile to Firestore user record
                try {
                    const saveResponse = await authenticatedApiCall('/api/user/spotify-profile', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            email: profile.email,
                            product: profile.product,
                            country: profile.country,
                            display_name: profile.display_name,
                            id: profile.id,
                            uri: profile.uri
                        })
                    });

                    if (saveResponse.ok) {
                        const saveData = await saveResponse.json();
                        debug.log('✅ Saved Spotify profile to user record:', saveData);
                    } else {
                        const errorData = await saveResponse.json().catch(() => ({ error: 'Unknown error' }));
                        debug.error('❌ Failed to save Spotify profile. Status:', saveResponse.status, 'Error:', errorData);
                    }
                } catch (error) {
                    debug.error('❌ Exception while saving Spotify profile:', error);
                    // Non-critical, continue anyway
                }

                if (profile.product !== 'premium') {
                    debug.error('❌ Account does not have Premium status. Product type:', profile.product);
                    showToast(`Spotify Premium required for playback. Current plan: ${profile.product}`, 'error');
                    showSpotifyConnectPrompt();
                    return;
                }

                debug.log('✅ Premium status confirmed!');
            } else {
                debug.error('❌ Could not fetch Spotify profile. Status:', profileResponse.status);
                const errorText = await profileResponse.text().catch(() => '');
                debug.error('Error details:', errorText);

                if (profileResponse.status === 403) {
                    // 403 Forbidden - token doesn't have required scopes
                    // User needs to disconnect and reconnect to grant updated permissions
                    debug.error('🔒 Spotify API returned 403 Forbidden. This usually means:');
                    debug.error('   1. The Spotify token lacks required scopes (user-read-email, user-read-private)');
                    debug.error('   2. User needs to re-authorize to grant updated permissions');
                    debug.error('   👉 Solution: Disconnect Spotify and connect again');

                    showToast('Spotify permissions error. Please reconnect your Spotify account to grant updated permissions.', 'error');

                    // Show the reconnect prompt with force_reauth
                    showSpotifyConnectPrompt(true);
                    return;
                }

                // Save minimal profile info - at least mark that they connected Spotify
                try {
                    const saveResponse = await authenticatedApiCall('/api/user/spotify-profile', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            product: 'unknown',  // Mark as unknown since we couldn't fetch it
                            id: null
                        })
                    });

                    if (saveResponse.ok) {
                        debug.log('✅ Saved minimal Spotify connection status');
                    }
                } catch (error) {
                    debug.error('❌ Failed to save minimal Spotify info:', error);
                }

                // Don't continue with player initialization if we can't even read profile
                showToast('Unable to verify Spotify account. Please try again.', 'error');
                return;
            }
        } catch (error) {
            debug.warn('⚠️ Error checking Premium status:', error);
            // Continue anyway - let Spotify SDK handle it
        }

        // Check if SDK is loaded
        if (typeof Spotify === 'undefined') {
            debug.error('❌ Spotify SDK not loaded!');
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
                    debug.warn('⚠️ No Spotify token available, fetching new one...');
                    try {
                        const response = await authenticatedApiCall('/api/spotify/token');
                        const data = await response.json();
                        if (data.success && data.access_token) {
                            spotifyAccessToken = data.access_token;
                            cb(spotifyAccessToken);
                        } else {
                            debug.error('❌ Failed to get Spotify token');
                        }
                    } catch (error) {
                        debug.error('❌ Error getting Spotify token:', error);
                    }
                }
            },
            volume: 0.7,
            enableMediaSession: true
        });

        // Error handling
        spotifyPlayer.addListener('initialization_error', ({ message }) => {
            debug.error('🚨 Spotify init error:', message);
            showToast('Spotify initialization failed', 'error');
        });

        spotifyPlayer.addListener('authentication_error', ({ message }) => {
            debug.error('🚨 Spotify auth error:', message);
            showToast('Spotify auth error - try reconnecting', 'error');
            showSpotifyConnectPrompt();
        });

        spotifyPlayer.addListener('account_error', ({ message }) => {
            debug.error('🚨 Spotify account error:', message);
            showToast('Spotify account error: ' + message, 'error');
        });

        spotifyPlayer.addListener('playback_error', ({ message }) => {
            debug.error('🚨 Playback error:', message);
            showToast('Playback error: ' + message, 'error');
        });

        // Ready
        spotifyPlayer.addListener('ready', ({ device_id }) => {
            debug.log('✅✅✅ Spotify player ready! Device ID:', device_id);
            spotifyDeviceId = device_id;
            spotifyPlayerReady = true;
            updateSpotifyConnectionUI(true);
            // showToast('Spotify player ready!', 'success');
        });

        // Not ready
        spotifyPlayer.addListener('not_ready', ({ device_id }) => {
            debug.log('⚠️ Device has gone offline:', device_id);
        });

        // Player state changed - update UI with smart throttling
        // Progress bar updates frequently, BPM indicator is throttled
        const throttledUpdateBpmIndicator = throttle(updateBpmIndicator, 100);
        spotifyPlayer.addListener('player_state_changed', state => {
            if (!state) return;
            
            updatePlayerUI(state);  // Always update progress bar immediately
            throttledUpdateBpmIndicator();  // Throttle BPM updates only
            
            // Start or stop progress interval based on play state
            if (!state.paused) {
                // Playing - start progress update interval if not already running
                if (!spotifyProgressInterval) {
                    spotifyProgressInterval = setInterval(async () => {
                        const currentState = await spotifyPlayer.getCurrentState();
                        if (currentState && !currentState.paused) {
                            updatePlayerUI(currentState);
                        }
                    }, 500);  // Update every 500ms (twice per second is smooth enough)
                }
            } else {
                // Paused - stop progress interval
                if (spotifyProgressInterval) {
                    clearInterval(spotifyProgressInterval);
                    spotifyProgressInterval = null;
                }
            }
        });

        // Connect to Spotify
        const connected = await spotifyPlayer.connect();
        
        if (connected) {
            debug.log('✅ Connected to Spotify successfully');

            // Set up automatic token refresh every 45 minutes (Spotify tokens expire in 1 hour)
            if (!window.spotifyTokenRefreshInterval) {
                window.spotifyTokenRefreshInterval = setInterval(async () => {
                    try {
                        debug.log('🔄 Refreshing Spotify access token...');
                        const response = await authenticatedApiCall('/api/spotify/token');
                        const data = await response.json();

                        if (data.success && data.access_token) {
                            spotifyAccessToken = data.access_token;
                            debug.log('✅ Spotify token refreshed successfully');
                        } else {
                            debug.error('❌ Failed to refresh Spotify token:', data);
                        }
                    } catch (error) {
                        debug.error('❌ Error refreshing Spotify token:', error);
                    }
                }, 45 * 60 * 1000); // 45 minutes in milliseconds
                debug.log('✅ Spotify token auto-refresh enabled (every 45 minutes)');
            }
        } else {
            debug.error('❌ Failed to connect to Spotify');
            showToast('Failed to connect to Spotify', 'error');
        }

    } catch (error) {
        debug.error('💥 Error initializing Spotify player:', error);
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
            debug.log('Loading new track:', currentSong.title);
            await playSpotifyTrack(spotifyUri);
            // showToast('▶ Playing', 'success');
        } else if (state.paused) {
            // Resume playback of current track
            debug.log('Resuming playback...');
            await spotifyPlayer.resume();
            // showToast('▶ Playing', 'success');
        } else {
            // Pause playback
            debug.log('Pausing playback...');
            await spotifyPlayer.pause();
            // showToast('⏸ Paused', 'success');
        }
    } catch (error) {
        debug.error('Error toggling playback:', error);
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
            debug.error('Load request failed:', playResponse.status, errorText);

            // Try to parse error details
            let errorMessage = 'Failed to load track';
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error && errorData.error.message) {
                    errorMessage = errorData.error.message;
                }
            } catch (e) {
                // If not JSON, use status-based message
                if (playResponse.status === 403) {
                    errorMessage = 'Playback forbidden - check Spotify account status or try reconnecting';
                } else if (playResponse.status === 404) {
                    errorMessage = 'Device not found - try reconnecting';
                }
            }
            showToast(errorMessage, 'error');
            return;
        }

        debug.log('✅ Play command sent, waiting briefly before pausing...');

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
            debug.log('✅ Track loaded and paused, ready to play');
        } else {
            debug.warn('⚠️ Track loaded but pause may have failed');
        }
    } catch (error) {
        debug.error('Error loading track:', error);
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
            debug.error('Play request failed:', response.status, errorText);

            // Try to parse error details
            let errorMessage = 'Failed to play track';
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error && errorData.error.message) {
                    errorMessage = errorData.error.message;
                }
            } catch (e) {
                // If not JSON, use status-based message
                if (response.status === 403) {
                    errorMessage = 'Playback forbidden - check Spotify account status or try reconnecting';
                } else if (response.status === 404) {
                    errorMessage = 'Device not found - try reconnecting';
                }
            }
            showToast(errorMessage, 'error');
        } else {
            debug.log('✅ Play request successful');
        }
    } catch (error) {
        debug.error('Error playing track:', error);
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

    // Note: BPM indicator update is now throttled separately in the player_state_changed listener

    // Update progress bar and time display (needs to be smooth, no throttling)
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
        debug.error('Error restarting track:', error);
        showToast('Failed to restart', 'error');
    }
}

// Toggle mute on/off
async function toggleMute() {
    if (!spotifyPlayer) return;
    
    try {
        if (isMuted) {
            // Unmute - restore previous volume
            await spotifyPlayer.setVolume(volumeBeforeMute);
            isMuted = false;
            setStatus('🔊 Unmuted', 'success');
            debug.log(`🔊 Unmuted - restored volume to ${volumeBeforeMute}`);
        } else {
            // Mute - save current volume and set to 0
            const state = await spotifyPlayer.getCurrentState();
            if (state) {
                // Get current volume (0.0 to 1.0)
                volumeBeforeMute = await spotifyPlayer.getVolume() || 1.0;
            }
            await spotifyPlayer.setVolume(0);
            isMuted = true;
            setStatus('🔇 Muted', 'success');
            debug.log(`🔇 Muted - saved volume ${volumeBeforeMute}`);
        }
    } catch (error) {
        debug.error('Error toggling mute:', error);
        showToast('Failed to toggle mute', 'error');
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
        debug.error('Error seeking:', error);
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
            debug.log(`⏩ Skipped ${seconds > 0 ? 'forward' : 'backward'} ${Math.abs(seconds)}s`);
        }
    } catch (error) {
        debug.error('Error skipping:', error);
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
            debug.log('🎵 Song ready to play:', currentSong.title);
        } else {
            debug.warn('⚠️ No Spotify URI for this song');
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

// Fullscreen API Functions
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        // Enter fullscreen and lock the Escape key
        document.documentElement.requestFullscreen().then(() => {
            debug.log('Entered fullscreen mode');
            updateFullscreenButton(true);

            // Lock the Escape key so it doesn't exit fullscreen
            if (navigator.keyboard && navigator.keyboard.lock) {
                navigator.keyboard.lock(['Escape']).then(() => {
                    debug.log('✅ Escape key locked - will not exit fullscreen');
                }).catch(err => {
                    debug.warn('⚠️ Could not lock Escape key:', err.message);
                });
            } else {
                // Firefox/Safari don't support Keyboard Lock API
                debug.warn('⚠️ Keyboard Lock API not supported (Firefox/Safari)');
                debug.warn('   ESC will exit fullscreen even when dialogs are open');
                debug.warn('   Use Alt+Enter to toggle fullscreen instead');
            }
        }).catch(err => {
            console.error('Error attempting to enable fullscreen:', err);
            setStatus('Fullscreen not available', 'error');
        });
    } else {
        // Exit fullscreen and unlock keyboard
        if (navigator.keyboard && navigator.keyboard.unlock) {
            navigator.keyboard.unlock();
            debug.log('🔓 Keyboard unlocked');
        }

        document.exitFullscreen().then(() => {
            debug.log('Exited fullscreen mode');
            updateFullscreenButton(false);
        }).catch(err => {
            console.error('Error attempting to exit fullscreen:', err);
        });
    }
}

function updateFullscreenButton(isFullscreen) {
    if (!fullscreenToggleBtn) return;

    const icon = fullscreenToggleBtn.querySelector('i');
    if (icon) {
        if (isFullscreen) {
            icon.classList.remove('fa-expand');
            icon.classList.add('fa-compress');
            fullscreenToggleBtn.title = 'Exit Fullscreen (Alt+Enter)';
        } else {
            icon.classList.remove('fa-compress');
            icon.classList.add('fa-expand');
            fullscreenToggleBtn.title = 'Toggle Fullscreen (Alt+Enter)';
        }
    }
}

function handleFullscreenChange() {
    const isFullscreen = !!document.fullscreenElement;

    // If user exited fullscreen, unlock keyboard
    if (!isFullscreen && navigator.keyboard && navigator.keyboard.unlock) {
        navigator.keyboard.unlock();
    }

    updateFullscreenButton(isFullscreen);
}

function updateBpmIndicator() {
    // CRITICAL: This function is called frequently by Spotify state updates
    // We use state tracking to prevent unnecessary animation restarts
    // Animation should ONLY change when: play/pause, BPM change, or song change
    
    // If indicator is disabled, stop and return
    if (!bpmIndicatorEnabled) {
        if (lastBpmAnimationState.isAnimating) {
            stopBpmIndicatorPulsing();
            lastBpmAnimationState.isAnimating = false;
        }
        return;
    }

    // Check if we have a valid BPM
    if (!currentSong || !currentSong.bpm || currentSong.bpm === 'N/A' || currentSong.bpm === 'NOT_FOUND') {
        if (lastBpmAnimationState.isAnimating) {
            stopBpmIndicatorPulsing();
            lastBpmAnimationState.isAnimating = false;
        }
        return;
    }

    // Parse BPM value (supports decimals)
    const bpm = parseFloat(currentSong.bpm);
    if (isNaN(bpm) || bpm <= 0) {
        if (lastBpmAnimationState.isAnimating) {
            stopBpmIndicatorPulsing();
            lastBpmAnimationState.isAnimating = false;
        }
        return;
    }

    // Check if Spotify is playing to start/stop animation
    checkIfPlaying().then(isPlaying => {
        // Check if state actually changed before doing anything
        const stateChanged = (
            isPlaying !== lastBpmAnimationState.isPaused ||
            bpm !== lastBpmAnimationState.bpm
        );

        if (isPlaying && bpmIndicatorEnabled) {
            // Only call startBpmIndicator if state changed
            if (stateChanged || !lastBpmAnimationState.isAnimating) {
                startBpmIndicator(bpm);
                lastBpmAnimationState.isAnimating = true;
                lastBpmAnimationState.isPaused = isPlaying;
                lastBpmAnimationState.bpm = bpm;
            }
            // Otherwise, animation is already running correctly - don't touch it!
        } else {
            // Stop animation when paused (only if currently animating)
            if (lastBpmAnimationState.isAnimating) {
                stopBpmIndicatorPulsing();
                lastBpmAnimationState.isAnimating = false;
                lastBpmAnimationState.isPaused = isPlaying;
            }
        }
    });
}

function stopBpmIndicatorPulsing() {
    // Remove CSS animations from block
    if (bpmIndicatorElement) {
        bpmIndicatorElement.classList.remove('animating');
    }

    // Remove CSS animation from metronome icon
    if (bpmMetronomeIcon) {
        bpmMetronomeIcon.classList.remove('animating');
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

    // Check if duration changed (BPM changed) - only restart if needed
    const currentDuration = bpmIndicatorElement.style.animationDuration;
    const needsRestart = currentDuration !== durationString;

    // Set animation duration
    bpmIndicatorElement.style.animationDuration = durationString;
    if (bpmMetronomeIcon) {
        bpmMetronomeIcon.style.animationDuration = durationString;
    }

    // Only force restart if BPM changed, otherwise let it continue smoothly
    if (needsRestart) {
        // Force synchronization: remove animations, trigger reflow, then add them back
        bpmIndicatorElement.classList.remove('animating');
        if (bpmMetronomeIcon) {
            bpmMetronomeIcon.classList.remove('animating');
        }

        // Trigger reflow to restart animations
        void bpmIndicatorElement.offsetWidth;

        // Add animations back - they will now be in sync
        bpmIndicatorElement.classList.add('animating');
        if (bpmMetronomeIcon) {
            bpmMetronomeIcon.classList.add('animating');
        }
    } else {
        // Just ensure animations are running (no restart needed)
        if (!bpmIndicatorElement.classList.contains('animating')) {
            bpmIndicatorElement.classList.add('animating');
        }
        if (bpmMetronomeIcon && !bpmMetronomeIcon.classList.contains('animating')) {
            bpmMetronomeIcon.classList.add('animating');
        }
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

// =========================================================================
// V2: New Functions for Playlist Linking and Enhanced Song Chooser
// =========================================================================

// V2: Sync collection in background (non-blocking)
async function syncCollectionInBackground(collectionId) {
    try {
        debug.log(`🔄 Starting background sync for collection ${collectionId}...`);
        
        const response = await authenticatedApiCall(`/api/collections/${collectionId}/sync`, {
            method: 'POST'
        });

        if (!response.ok) {
            debug.warn('Background sync failed');
            return;
        }

        // Handle SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.substring(6));
                    
                    if (data.type === 'progress') {
                        debug.log(`📊 Sync progress: ${data.message}`);
                        setStatus(data.message, 'info');
                    } else if (data.type === 'complete') {
                        debug.log(`✅ Sync complete: ${data.message}`);
                        setStatus(data.message, 'success');
                        // Do NOT reload songs or interrupt main UI
                    } else if (data.type === 'error') {
                        debug.error(`❌ Sync error: ${data.error}`);
                        showToast('Sync error: ' + data.error, 'error');
                    }
                }
            }
        }
    } catch (error) {
        debug.error('Background sync error:', error);
        // Silent fail - don't interrupt user experience
    }
}

// Manual sync triggered by user from Collection dialog
async function manualSyncCollection() {
    if (!currentCollection) {
        showToast('No collection selected', 'error');
        return;
    }

    if (!canWriteToCurrentCollection()) {
        showToast('You need owner or collaborator access to sync this collection', 'error');
        return;
    }

    try {
        showToast('Starting sync...', 'info');
        await syncCollectionInBackground(currentCollection.id);
        // Reload songs after sync completes
        await loadSongs();
        showToast('Sync complete! Songs reloaded.', 'success');
    } catch (error) {
        debug.error('Manual sync error:', error);
        showToast('Sync failed: ' + error.message, 'error');
    }
}

// V2: Load linked and other playlists for playlist dialog
async function loadPlaylistsForDialog() {
    try {
        if (!currentCollection || !currentCollection.id) {
            debug.warn('No current collection');
            return;
        }

        // Load linked playlists
        const linkedResponse = await authenticatedApiCall(
            `/api/collections/${currentCollection.id}/playlists`
        );
        const linkedData = await linkedResponse.json();
        linkedPlaylists = linkedData.success ? linkedData.playlists : [];

        // Load all playlist memory
        const memoryResponse = await authenticatedApiCall('/api/playlist/memory');
        const memoryData = await memoryResponse.json();
        const allPlaylists = memoryData.success ? memoryData.playlists : [];

        // Filter out linked playlists from memory
        const linkedIds = linkedPlaylists.map(p => p.id);
        otherPlaylists = allPlaylists.filter(p => !linkedIds.includes(p.id));

        renderPlaylistDialog();
    } catch (error) {
        debug.error('Error loading playlists:', error);
        showToast('Error loading playlists', 'error');
    }
}

// V2: Render playlist dialog with linked/other sections
function renderPlaylistDialog() {
    const linkedList = document.getElementById('linked-playlists-list');
    const otherList = document.getElementById('other-playlists-list');

    if (!linkedList || !otherList) return;

    // Render linked playlists
    if (linkedPlaylists.length === 0) {
        linkedList.innerHTML = '<div class="empty-state-small"><p>No playlists linked to this collection yet</p></div>';
    } else {
        linkedList.innerHTML = linkedPlaylists.map((playlist, index) => `
            <div class="playlist-item draggable" draggable="true" data-playlist-id="${playlist.id}" data-index="${index}">
                <div class="playlist-drag-handle">
                    <i class="fa-solid fa-grip-vertical"></i>
                </div>
                <img src="${playlist.image_url || '/static/icons/playlist-placeholder.png'}"
                     alt="${escapeHtml(playlist.name)}"
                     class="playlist-item-image">
                <div class="playlist-item-info">
                    <span class="playlist-item-name">${escapeHtml(playlist.name)}</span>
                    <span class="playlist-item-meta">${playlist.owner} • ${playlist.total_tracks} track${playlist.total_tracks !== 1 ? 's' : ''}</span>
                </div>
                <div class="playlist-item-actions">
                    <span class="playlist-item-linked-badge">
                        <i class="fa-solid fa-check"></i> Linked
                    </span>
                    <button class="btn-unlink-playlist" data-playlist-id="${playlist.id}">
                        <i class="fa-solid fa-unlink"></i> Unlink
                    </button>
                </div>
            </div>
        `).join('');

        // Add unlink click handlers
        linkedList.querySelectorAll('.btn-unlink-playlist').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const playlistId = e.currentTarget.getAttribute('data-playlist-id');
                await unlinkPlaylist(playlistId);
            });
        });

        // Add drag and drop handlers
        setupPlaylistDragAndDrop();
    }

    // Render other playlists
    if (otherPlaylists.length === 0) {
        otherList.innerHTML = '<div class="empty-state-small"><p>No other playlists in memory</p></div>';
    } else {
        otherList.innerHTML = otherPlaylists.map(playlist => `
            <div class="playlist-item">
                <img src="${playlist.image_url || '/static/icons/playlist-placeholder.png'}"
                     alt="${escapeHtml(playlist.name)}"
                     class="playlist-item-image">
                <div class="playlist-item-info">
                    <span class="playlist-item-name">${escapeHtml(playlist.name)}</span>
                    <span class="playlist-item-meta">${playlist.owner} • ${playlist.total_tracks} track${playlist.total_tracks !== 1 ? 's' : ''}</span>
                </div>
                <div class="playlist-item-actions">
                    <button class="btn-link-playlist" data-playlist-url="${escapeHtml(playlist.playlist_url)}">
                        <i class="fa-solid fa-link"></i> Link to Collection
                    </button>
                </div>
            </div>
        `).join('');

        // Add link click handlers
        otherList.querySelectorAll('.btn-link-playlist').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const playlistUrl = e.currentTarget.getAttribute('data-playlist-url');
                await linkPlaylist(playlistUrl);
            });
        });
    }
}

// V2: Setup drag and drop for linked playlists
let draggedElement = null;
let draggedIndex = null;

function setupPlaylistDragAndDrop() {
    const linkedList = document.getElementById('linked-playlists-list');
    const playlistItems = linkedList.querySelectorAll('.playlist-item.draggable');

    playlistItems.forEach((item) => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragleave', handleDragLeave);
    });
}

function handleDragStart(e) {
    draggedElement = e.currentTarget;
    draggedIndex = parseInt(e.currentTarget.getAttribute('data-index'));
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    // Remove all drag-over classes
    document.querySelectorAll('.playlist-item.drag-over').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    const item = e.currentTarget;
    if (item !== draggedElement && item.classList.contains('draggable')) {
        item.classList.add('drag-over');
    }

    return false;
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    e.preventDefault();

    const dropTarget = e.currentTarget;
    dropTarget.classList.remove('drag-over');

    if (draggedElement !== dropTarget && dropTarget.classList.contains('draggable')) {
        const dropIndex = parseInt(dropTarget.getAttribute('data-index'));

        // Reorder the linkedPlaylists array
        const [movedPlaylist] = linkedPlaylists.splice(draggedIndex, 1);
        linkedPlaylists.splice(dropIndex, 0, movedPlaylist);

        // Re-render the list
        renderPlaylistDialog();

        // Save the new order to the backend
        await savePlaylistOrder();
    }

    return false;
}

// V2: Save playlist order to backend
async function savePlaylistOrder() {
    try {
        if (!currentCollection || !currentCollection.id) {
            showToast('No collection selected', 'error');
            return;
        }

        const playlistIds = linkedPlaylists.map(p => p.id);

        const response = await authenticatedApiCall(
            `/api/collections/${currentCollection.id}/playlists/reorder`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlist_ids: playlistIds })
            }
        );

        const data = await response.json();

        if (data.success) {
            showToast('Playlist order saved', 'success');
            // Collection art will update on next page load (it uses first playlist)
        } else {
            showToast('Failed to save order: ' + (data.error || 'Unknown error'), 'error');
            // Reload to restore original order
            await loadPlaylistsForDialog();
        }
    } catch (error) {
        debug.error('Error saving playlist order:', error);
        showToast('Error saving order: ' + error.message, 'error');
        // Reload to restore original order
        await loadPlaylistsForDialog();
    }
}

// V2: Link a playlist to collection
async function linkPlaylist(playlistUrl) {
    try {
        if (!currentCollection || !currentCollection.id) {
            showToast('No collection selected', 'error');
            return;
        }

        showLoading('Linking playlist...');

        const response = await authenticatedApiCall(
            `/api/collections/${currentCollection.id}/playlists/link`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlist_url: playlistUrl })
            }
        );

        const data = await response.json();

        if (data.success) {
            showToast(data.message, 'success');
            await loadPlaylistsForDialog();
            // Trigger sync (only if user has write access)
            if (canWriteToCurrentCollection()) {
                syncCollectionInBackground(currentCollection.id);
            }
        } else {
            showToast('Failed to link playlist: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        debug.error('Error linking playlist:', error);
        showToast('Error linking playlist: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// V2: Unlink a playlist from collection
async function unlinkPlaylist(playlistId) {
    showConfirmDialog(
        'Unlink Playlist?',
        'Are you sure you want to unlink this playlist?\n\nSongs not in other playlists will be flagged as removed.',
        async () => {
            try {
                showLoading('Unlinking playlist...');

                const response = await authenticatedApiCall(
                    `/api/collections/${currentCollection.id}/playlists/${playlistId}/unlink`,
                    { method: 'DELETE' }
                );

                const data = await response.json();

                if (data.success) {
                    showToast(data.message, 'success');
                    await loadPlaylistsForDialog();
                    // Trigger sync (only if user has write access)
                    if (canWriteToCurrentCollection()) {
                        syncCollectionInBackground(currentCollection.id);
                    }
                } else {
                    showToast('Failed to unlink playlist: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                debug.error('Error unlinking playlist:', error);
                showToast('Error unlinking playlist: ' + error.message, 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

// V2: Update filterSongs to support new sort modes
function filterSongsV2() {
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
            debug.log(`🔍 Search: "${searchTerm}" - ${filteredSongs.length} results`);
        }

        // V2: Sorting is handled by backend, but we still need to sort filtered results
        if (songSelectorSortMode === 'artist') {
            filteredSongs.sort((a, b) => {
                const artistCompare = a.artist.localeCompare(b.artist);
                return artistCompare !== 0 ? artistCompare : a.title.localeCompare(b.title);
            });
        } else if (songSelectorSortMode === 'name') {
            filteredSongs.sort((a, b) => a.title.localeCompare(b.title));
        }
        // playlist sort maintains backend order

        renderSongListV2();
    } catch (error) {
        debug.error('❌ Error in filterSongsV2:', error);
    }
}

// V2: Render song list with playlist headers and trash icons
function renderSongListV2() {
    try {
        const listElement = document.getElementById('song-selector-list');

        if (!listElement) {
            debug.error('❌ song-selector-list element not found!');
            return;
        }

        if (allSongs.length === 0) {
            listElement.innerHTML = '<div class="empty-state"><p>No songs in collection. Link a playlist!</p></div>';
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

        // V2: Render with playlist headers if sorted by playlist
        if (songSelectorSortMode === 'playlist' && allSongs._playlistData) {
            allSongs._playlistData.forEach(playlist => {
                // Filter songs in this playlist
                const playlistSongs = playlist.songs.filter(song => 
                    filteredSongs.find(fs => fs.id === song.id)
                );

                if (playlistSongs.length === 0) return;

                // Playlist header - compact single line
                html += `
                    <div class="song-list-playlist-header" data-playlist-id="${playlist.id}">
                        <span class="song-list-playlist-header-name">${escapeHtml(playlist.name)}</span>
                        <span class="song-list-playlist-header-meta">${playlist.owner} • ${playlistSongs.length} track${playlistSongs.length !== 1 ? 's' : ''}</span>
                    </div>
                `;

                // Songs in this playlist
                playlistSongs.forEach((song, index) => {
                    html += renderSongItem(song, filteredSongs.findIndex(fs => fs.id === song.id));
                });
            });
        } else {
            // Regular rendering
            filteredSongs.forEach((song, index) => {
                html += renderSongItem(song, index);
            });
        }

        listElement.innerHTML = html;

        // Add trash icon click handlers
        listElement.querySelectorAll('.song-item-trash-icon').forEach(icon => {
            icon.addEventListener('click', async (e) => {
                e.stopPropagation();
                const songId = e.currentTarget.getAttribute('data-song-id');
                await deleteSongWithConfirm(songId);
            });
        });

        if (selectedSongIndex >= filteredSongs.length) {
            selectedSongIndex = filteredSongs.length - 1;
        }
    } catch (error) {
        debug.error('❌ Error in renderSongListV2:', error);
        debug.error('Stack:', error.stack);
    }
}

// V2: Helper to render individual song item with trash icon
function renderSongItem(song, index) {
    const selectedClass = index === selectedSongIndex ? 'selected' : '';
    const albumArtHtml = song.album_art_url
        ? `<img src="${escapeHtml(song.album_art_url)}" alt="Album art" class="song-selector-item-art">`
        : `<div class="song-selector-item-art-placeholder">🎵</div>`;

    // Format BPM display with manual indicator if applicable
    let bpmDisplay = song.bpm || 'N/A';
    if (song.bpm && song.bpm !== 'N/A' && song.bpm !== 'NOT_FOUND' && song.bpm_manual) {
        bpmDisplay = `${song.bpm}<span class="bpm-manual-badge-small" title="Custom bpm/tempo (B)"><i class="fa-solid fa-pen"></i></span>`;
    }

    // Show trash icon if flagged removed or not in any playlist (owner only)
    const isOwner = isOwnerOfCurrentCollection();
    const isFlaggedRemoved = song.is_removed_from_spotify === true;
    const isOrphaned = !song.source_playlist_ids || song.source_playlist_ids.length === 0;
    let trashIconHtml = '';
    if (isOwner && (isFlaggedRemoved || isOrphaned)) {
        const trashClass = isFlaggedRemoved ? 'song-item-trash-icon trash-flagged' : 'song-item-trash-icon';
        const trashTitle = isFlaggedRemoved
            ? 'This song was removed from the playlist on Spotify. Click to remove from collection.'
            : 'Remove this song from the collection.';
        trashIconHtml = `
            <div class="${trashClass}" data-song-id="${song.id}" title="${trashTitle}">
                <i class="fa-solid fa-trash"></i>
            </div>
        `;
    }
    return `
        <div class="song-selector-item song-item ${selectedClass}" data-song-index="${index}" data-song-id="${song.id}">
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
            ${trashIconHtml}
        </div>
    `;
}

// V2: Delete song with confirmation
async function deleteSongWithConfirm(songId) {
    const song = allSongs.find(s => s.id === songId);
    if (!song) return;

    showConfirmDialog(
        'Delete Song?',
        `Are you sure you want to permanently delete "${song.title}" by ${song.artist}?\n\nThis will delete all lyrics, notes, and BPM data for this song.`,
        async () => {
            try {
                showLoading('Deleting song...');

                const response = await authenticatedApiCall(`/api/songs/${songId}`, {
                    method: 'DELETE'
                });

                const data = await response.json();

                if (data.success) {
                    showToast(data.message, 'success');

                    // If deleted song was current, clear it
                    if (currentSong && currentSong.id === songId) {
                        currentSong = null;
                        saveCurrentSong(null);
                        lyricsContentInner.innerHTML = '<div class="empty-state"><p>Select a song to view lyrics</p></div>';
                        notesView.innerHTML = '<div class="empty-state"><p>Select a song to view notes</p></div>';
                        songMetadata.innerHTML = '';
                    }

                    // Reload songs
                    await loadSongs();
                } else {
                    showToast('Failed to delete song: ' + (data.error || 'Unknown error'), 'error');
                }
            } catch (error) {
                debug.error('Error deleting song:', error);
                showToast('Error deleting song: ' + error.message, 'error');
            } finally {
                hideLoading();
            }
        }
    );
}

// Session Health Check - Keep session alive and detect auth failures early
let sessionHealthCheckInterval = null;
let consecutiveHealthCheckFailures = 0;

function startSessionHealthCheck() {
    // Clear any existing interval
    if (sessionHealthCheckInterval) {
        clearInterval(sessionHealthCheckInterval);
    }

    // Ping the backend every 10 minutes to keep session alive
    sessionHealthCheckInterval = setInterval(async () => {
        try {
            debug.log('🏥 Running session health check...');
            const response = await authenticatedApiCall('/api/user');

            if (response.ok) {
                consecutiveHealthCheckFailures = 0;
                debug.log('✅ Session health check passed');
            } else if (response.status === 401) {
                consecutiveHealthCheckFailures++;
                debug.warn(`⚠️ Session health check failed with 401 (attempt ${consecutiveHealthCheckFailures})`);

                // If we get 2 consecutive 401s, session is likely dead
                if (consecutiveHealthCheckFailures >= 2) {
                    console.error('❌ Session appears to be invalid - multiple auth failures');
                    showToast('Your session has expired. Please refresh the page.', 'error');
                }
            } else {
                debug.warn(`⚠️ Session health check returned status ${response.status}`);
            }
        } catch (error) {
            consecutiveHealthCheckFailures++;
            debug.error('❌ Session health check error:', error);

            // Only show error if we have multiple consecutive failures
            if (consecutiveHealthCheckFailures >= 3) {
                showToast('Connection issue detected. Check your internet connection.', 'warning');
            }
        }
    }, 10 * 60 * 1000); // 10 minutes in milliseconds

    debug.log('✅ Session health check enabled (every 10 minutes)');
}
