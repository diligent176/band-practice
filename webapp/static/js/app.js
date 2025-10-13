// Band Practice App - Frontend JavaScript

let currentSong = null;
let allSongs = [];
let isEditMode = false;
let songSelectorSortByArtist = false;
let filteredSongs = [];
let selectedSongIndex = -1;

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
const sortModeDisplay = document.getElementById('sort-mode');
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
const tightenLyricsBtn = document.getElementById('tighten-lyrics-btn');

const confirmDialog = document.getElementById('confirm-dialog');
const confirmDialogTitle = document.getElementById('confirm-dialog-title');
const confirmDialogMessage = document.getElementById('confirm-dialog-message');
const confirmDialogConfirmBtn = document.getElementById('confirm-dialog-confirm-btn');
const confirmDialogCancelBtn = document.getElementById('confirm-dialog-cancel-btn');

// Initialize - called from viewer.html after auth is complete
window.initializeApp = function(apiCallFunction) {
    console.log('🎸 Initializing app with authenticated API calls');
    authenticatedApiCall = apiCallFunction;

    loadFontSizePreference();
    loadUserInfo();
    loadSongs();
    setupEventListeners();
};

function setupEventListeners() {
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
    editLyricsBtn.addEventListener('click', openLyricsEditor);
    deleteSongBtn.addEventListener('click', deleteCurrentSong);
    lyricsEditorSaveBtn.addEventListener('click', saveLyrics);
    lyricsEditorCancelBtn.addEventListener('click', closeLyricsEditor);
    tightenLyricsBtn.addEventListener('click', tightenLyrics);

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

    // P for playlist import
    if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        openImportDialog();
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

    // Arrow keys to navigate through notes
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (navigateNotes(e.key === 'ArrowDown' ? 1 : -1)) {
            e.preventDefault();
        }
        return;
    }

    // T to scroll to top
    if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        scrollToTop();
        return;
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
        const response = await authenticatedApiCall('/api/songs');
        const data = await response.json();

        if (data.success) {
            allSongs = data.songs;
            console.log(`✅ Loaded ${allSongs.length} songs`);
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
            setStatus('Song loaded', 'success');

            // Load saved preferences for this song
            loadColumnPreference(currentSong.id);
            loadPanelSplit(currentSong.id);

            // Fetch BPM in background if not available
            if (!currentSong.bpm || currentSong.bpm === 'N/A') {
                fetchBpmInBackground(currentSong.id, currentSong.title, currentSong.artist);
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
            renderMetadata();
            console.log(`✅ BPM updated: ${data.bpm}`);
            
            // Show toast notification if BPM was found
            if (data.bpm && data.bpm !== 'N/A') {
                showToast(`BPM updated: ${data.bpm}`, 'success');
            } else {
                showToast('BPM not available for this song', 'info');
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

async function manuallyFetchBpm() {
    if (!currentSong) return;
    
    showToast('Fetching BPM...', 'info');
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
            showToast('Notes saved successfully!', 'success');
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
    sortModeDisplay.textContent = songSelectorSortByArtist ? 'Artist' : 'Song';
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

            html += `<div class="song-selector-item ${selectedClass}" data-song-index="${index}" data-song-id="${song.id}">
${albumArtHtml}
<div class="song-selector-item-info">
<div class="song-selector-item-title">${escapeHtml(song.title)}</div>
<div class="song-selector-item-artist">🎤 ${escapeHtml(song.artist)}</div>
<div class="song-selector-item-meta">💿 ${escapeHtml(song.album || 'N/A')} • 📅 ${song.year || 'N/A'} • 🎵 ${song.bpm || 'N/A'}</div>
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

function selectSong(songId) {
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
}

function renderMetadata() {
    // Show the song name in the heading when a song is selected
    if (lyricsHeading) {
        lyricsHeading.style.display = 'block';
        let songName = currentSong.title;
        // Trim to 32 characters with ellipsis if needed
        if (songName.length > 32) {
            songName = songName.substring(0, 32) + '...';
        }
        lyricsHeading.textContent = songName;
    }

    // Show/hide customization badge in main view
    if (customizationBadgeMain) {
        if (currentSong.is_customized) {
            customizationBadgeMain.style.display = 'inline-flex';
        } else {
            customizationBadgeMain.style.display = 'none';
        }
    }

    // Truncate helper function
    const truncate = (text, maxLength = 32) => {
        if (!text) return 'N/A';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    const metadata = [
        { icon: '🎤', label: 'Artist', value: truncate(currentSong.artist) },
        { icon: '💿', label: 'Album', value: truncate(currentSong.album) },
        { icon: '📅', label: 'Year', value: currentSong.year || 'N/A' }
    ];

    // Add BPM with loading indicator if needed
    const bpmValue = currentSong.bpm || 'N/A';
    const bpmDisplay = bpmValue === 'N/A' ? 
        '<span id="bpm-value">N/A <span class="bpm-loading">⏳</span></span>' : 
        `<span id="bpm-value">${bpmValue}</span>`;
    metadata.push({ icon: '🎵', label: 'BPM', value: bpmDisplay });

    let metadataHtml = metadata.map(item =>
        `<div class="metadata-item"><span class="metadata-icon">${item.icon}</span> ${item.value}</div>`
    ).join('');

    // Note: Custom lyric badge is now shown in the header next to song name, not in metadata
    
    songMetadata.innerHTML = metadataHtml;
}

function renderLyrics() {
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

    if (!notes.trim()) {
        notesView.innerHTML = '<div class="empty-state"><p>No notes yet. Click Edit to add practice notes.</p></div>';
        return;
    }

    const noteBlocks = parseNotes(notes);
    let html = '';

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

    notesView.innerHTML = html;
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
        // "Line 12: note" or "Lines 45-48: note"
        // "12: note" or "45-48: note"
        const lineMatch = line.match(/^(Lines?\s+)?(\d+(-\d+)?):(.*)$/i);
        if (lineMatch) {
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
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement;
    const parentRect = parent.getBoundingClientRect();
    
    // Check if element is already fully visible within its parent
    const isVisible = (
        rect.top >= parentRect.top &&
        rect.bottom <= parentRect.bottom
    );
    
    if (!isVisible) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
        // Move to next/previous note
        nextIndex = activeIndex + direction;
        
        // Wrap around
        if (nextIndex < 0) {
            nextIndex = noteBlocks.length - 1;
        } else if (nextIndex >= noteBlocks.length) {
            nextIndex = 0;
        }
    }

    // Highlight the selected note
    const nextNoteBlock = noteBlocks[nextIndex];
    highlightLines(nextNoteBlock);
    
    // Scroll the note block into view in the notes panel
    nextNoteBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    return true;
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

    setTimeout(() => {
        toast.remove();
    }, 4000);
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
    const is2Column = preferences[songId] || false; // Default to 1 column

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
    mainApp.classList.remove('font-size-small', 'font-size-medium', 'font-size-large', 'font-size-xlarge');

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
            showToast('Lyrics saved and marked as customized!', 'success');
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

    // Remove any existing event listeners and add new one
    const newConfirmBtn = confirmDialogConfirmBtn.cloneNode(true);
    confirmDialogConfirmBtn.parentNode.replaceChild(newConfirmBtn, confirmDialogConfirmBtn);

    // Update the global reference
    window.confirmDialogConfirmBtn = newConfirmBtn;

    newConfirmBtn.addEventListener('click', () => {
        hideConfirmDialog();
        onConfirm();
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', handleConfirmDialogKeyboard);
}

function hideConfirmDialog() {
    confirmDialog.style.display = 'none';
    currentConfirmCallback = null;

    // Remove keyboard shortcuts
    document.removeEventListener('keydown', handleConfirmDialogKeyboard);
}

function handleConfirmDialogKeyboard(e) {
    // Only handle if dialog is visible
    if (confirmDialog.style.display !== 'flex') return;

    // ESC to cancel
    if (e.key === 'Escape') {
        e.preventDefault();
        hideConfirmDialog();
    }
    // ENTER to confirm
    if (e.key === 'Enter') {
        e.preventDefault();
        if (currentConfirmCallback) {
            hideConfirmDialog();
            currentConfirmCallback();
        }
    }
}

//=============================================================================
// Import Playlist Dialog
//=============================================================================

let importDialogState = {
    playlistUrl: '',
    playlist: null,
    songs: [],
    selectedSongIds: new Set()
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

function showImportDialog() {
    importDialog.style.display = 'flex';
    importStepUrl.style.display = 'flex';
    importStepSelect.style.display = 'none';
    importStepProgress.style.display = 'none';
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

    // ENTER to proceed based on current step
    if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();

        // Step 1: Load playlist (Enter in URL field triggers load)
        if (importStepUrl.style.display === 'flex') {
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
            body: JSON.stringify({ playlist_url: playlistUrl })
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

        let statusBadge = '';
        if (song.status === 'conflict') {
            statusBadge = '<span class="import-song-status status-conflict">⚠️ Has custom lyrics/notes</span>';
        } else if (song.status === 'existing') {
            statusBadge = '<span class="import-song-status status-existing">✓ In database</span>';
        } else {
            statusBadge = '<span class="import-song-status status-new">New</span>';
        }

        html += `
            <div class="import-song-item ${conflictClass}">
                <input type="checkbox" class="import-song-checkbox"
                       data-song-id="${song.id}"
                       ${isSelected ? 'checked' : ''}
                       onchange="toggleSongSelection('${song.id}')">
                ${song.album_art ?
                    `<img src="${song.album_art}" class="import-song-art" alt="Album art">` :
                    `<div class="import-song-art"></div>`
                }
                <div class="import-song-info">
                    <div class="import-song-title">${escapeHtml(song.title)}</div>
                    <div class="import-song-artist">${escapeHtml(song.artist)} • ${escapeHtml(song.album)}</div>
                </div>
                ${statusBadge}
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
                            selected_songs: selectedIds
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

async function finishImport() {
    closeImportDialog();
    await loadSongs(); // Reload song list
    
    // Optionally: trigger background BPM fetches for all songs that were just imported
    // This will happen automatically when users view each song
}

//=============================================================================
// Panel Resizing with localStorage
//=============================================================================

const resizeHandle = document.getElementById('resize-handle');
const lyricsPanel = document.getElementById('lyrics-panel');
const notesPanel = document.getElementById('notes-panel');
const panelsContainer = document.querySelector('.panels');

let isResizing = false;

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

    // Calculate percentage (20% minimum for each panel, 80% maximum)
    let lyricsPercentage = (mouseX / containerWidth) * 100;
    lyricsPercentage = Math.max(20, Math.min(80, lyricsPercentage));

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
    const lyricsPercentage = splits[songId] || 66.67; // Default to 2/3 for lyrics, 1/3 for notes

    const notesPercentage = 100 - lyricsPercentage;

    lyricsPanel.style.flex = `0 0 ${lyricsPercentage}%`;
    notesPanel.style.flex = `0 0 ${notesPercentage}%`;
};

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
