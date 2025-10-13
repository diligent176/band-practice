// Band Practice App - Frontend JavaScript

let currentSong = null;
let allSongs = [];
let isEditMode = false;

// Reference to the apiCall function from viewer.html
// This will be passed in when initializeApp is called
let authenticatedApiCall = null;

// DOM Elements
const songSelect = document.getElementById('song-select');
const lyricsContent = document.getElementById('lyrics-content');
const lyricsContentInner = document.getElementById('lyrics-content-inner');
const notesView = document.getElementById('notes-view');
const notesEdit = document.getElementById('notes-edit');
const notesTextarea = document.getElementById('notes-textarea');
const songMetadata = document.getElementById('song-metadata');
const statusMessage = document.getElementById('status-message');

const editNotesBtn = document.getElementById('edit-notes-btn');
const saveNotesBtn = document.getElementById('save-notes-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const refreshSongBtn = document.getElementById('refresh-song-btn');
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
    songSelect.addEventListener('change', handleSongChange);
    editNotesBtn.addEventListener('click', enterEditMode);
    saveNotesBtn.addEventListener('click', saveNotes);
    cancelEditBtn.addEventListener('click', exitEditMode);
    refreshSongBtn.addEventListener('click', refreshCurrentSong);
    editLyricsBtn.addEventListener('click', openLyricsEditor);
    deleteSongBtn.addEventListener('click', deleteCurrentSong);
    lyricsEditorSaveBtn.addEventListener('click', saveLyrics);
    lyricsEditorCancelBtn.addEventListener('click', closeLyricsEditor);

    // Confirmation dialog close buttons
    confirmDialogCancelBtn.addEventListener('click', hideConfirmDialog);

    // Close dialogs when clicking outside
    lyricsEditorDialog.addEventListener('click', (e) => {
        if (e.target === lyricsEditorDialog) {
            closeLyricsEditor();
        }
    });

    toggleColumnsBtn.addEventListener('click', toggleColumns);
    fontSizeSelect.addEventListener('change', handleFontSizeChange);
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
            populateSongSelect();
            setStatus(`${allSongs.length} songs loaded`, 'success');
        } else {
            showToast('Failed to load songs', 'error');
        }
    } catch (error) {
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
            refreshSongBtn.disabled = false;
            editNotesBtn.disabled = false;
            editLyricsBtn.disabled = false;
            deleteSongBtn.disabled = false;
            setStatus('Song loaded', 'success');

            // Load panel split for this song
            loadPanelSplit(currentSong.id);
        } else {
            showToast('Failed to load song', 'error');
        }
    } catch (error) {
        showToast('Error loading song: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
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

    if (!confirm(`Are you sure you want to delete "${songTitle}" from the database?\n\nThis action cannot be undone.`)) {
        return;
    }

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

            // Disable buttons
            refreshSongBtn.disabled = true;
            editNotesBtn.disabled = true;
            deleteSongBtn.disabled = true;

            // Clear displays
            lyricsContentInner.innerHTML = '<div class="empty-state"><p>Select a song to view lyrics</p></div>';
            notesView.innerHTML = '<div class="empty-state"><p>Select a song to view notes</p></div>';
            songMetadata.innerHTML = '';

            // Reset song selector
            songSelect.value = '';

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

// Rendering Functions
function populateSongSelect() {
    songSelect.innerHTML = '<option value="">-- Select a song --</option>';

    allSongs.forEach(song => {
        const option = document.createElement('option');
        option.value = song.id;
        option.textContent = `${song.title} - ${song.artist}`;
        songSelect.appendChild(option);
    });
}

function renderSong() {
    if (!currentSong) return;

    renderMetadata();
    renderLyrics();
    renderNotes();
}

function renderMetadata() {
    const metadata = [
        { label: 'Artist', value: currentSong.artist },
        { label: 'Album', value: currentSong.album },
        { label: 'Year', value: currentSong.year },
        { label: 'BPM', value: currentSong.bpm || 'N/A' }
    ];

    songMetadata.innerHTML = metadata.map(item =>
        `<div class="metadata-item"><strong>${item.label}:</strong> ${item.value}</div>`
    ).join('<div class="metadata-item">|</div>');
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
        notesView.innerHTML = '<div class="empty-state"><p>No notes yet. Click Edit to add drummer notes.</p></div>';
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

        const lineMatch = line.match(/^(Lines?\s+\d+(-\d+)?):(.*)$/i);
        if (lineMatch) {
            if (currentBlock) {
                blocks.push({
                    header: currentBlock,
                    content: currentContent.join('\n').trim(),
                    ...extractLineNumbers(currentBlock)
                });
            }

            currentBlock = lineMatch[1];
            currentContent = [lineMatch[3].trim()];
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
                line.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });
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
}

function exitEditMode() {
    isEditMode = false;
    notesView.style.display = 'block';
    notesEdit.style.display = 'none';
    editNotesBtn.style.display = 'inline-flex';
    saveNotesBtn.style.display = 'none';
    cancelEditBtn.style.display = 'none';
}

// Event Handlers
function handleSongChange(e) {
    const songId = e.target.value;
    if (songId) {
        loadSong(songId);
    }
}

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
        toggleColumnsBtn.innerHTML = '<span class="icon">⚙</span> 2 Col';
    } else {
        lyricsContentInner.classList.remove('lyrics-columns-2');
        lyricsContentInner.classList.add('lyrics-columns-1');
        toggleColumnsBtn.innerHTML = '<span class="icon">⚙</span> 1 Col';
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
    } else {
        customizationBadge.style.display = 'none';
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

    // Set up scroll sync and line number updates
    setupLyricsEditorScrollSync();
}

function updateLyricsEditorLineNumbers() {
    const lineNumbersDiv = document.getElementById('lyrics-editor-line-numbers');
    const lines = lyricsEditorTextarea.value.split('\n');
    const lineCount = lines.length;

    let lineNumbersText = '';
    for (let i = 1; i <= lineCount; i++) {
        lineNumbersText += i + '\n';
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
function showConfirmDialog(title, message, onConfirm) {
    confirmDialogTitle.textContent = title;
    confirmDialogMessage.textContent = message;
    confirmDialog.style.display = 'flex';

    // Remove any existing event listeners and add new one
    const newConfirmBtn = confirmDialogConfirmBtn.cloneNode(true);
    confirmDialogConfirmBtn.parentNode.replaceChild(newConfirmBtn, confirmDialogConfirmBtn);

    // Update the global reference
    window.confirmDialogConfirmBtn = newConfirmBtn;

    newConfirmBtn.addEventListener('click', () => {
        hideConfirmDialog();
        onConfirm();
    });
}

function hideConfirmDialog() {
    confirmDialog.style.display = 'none';
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
}

function closeImportDialog() {
    importDialog.style.display = 'none';
    importDialogState = {
        playlistUrl: '',
        playlist: null,
        songs: [],
        selectedSongIds: new Set()
    };
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

            // Auto-select non-conflict songs
            data.songs.forEach(song => {
                if (!song.has_conflict) {
                    importDialogState.selectedSongIds.add(song.id);
                }
            });

            renderPlaylistDetails();
            renderSongList();

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

function renderSongList() {
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
    renderSongList();
    updateSelectionCount();
}

function selectNoneSongs() {
    importDialogState.selectedSongIds.clear();
    renderSongList();
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

        // Start import
        const response = await authenticatedApiCall('/api/playlist/import', {
            method: 'POST',
            body: JSON.stringify({
                playlist_url: importDialogState.playlistUrl,
                selected_songs: selectedIds
            })
        });

        const data = await response.json();

        if (data.success) {
            // Update progress for each result
            let completed = 0;
            data.results.forEach(result => {
                completed++;
                const percentage = (completed / selectedIds.length) * 100;
                document.getElementById('import-progress-fill').style.width = `${percentage}%`;
                document.getElementById('import-progress-text').textContent = `${completed} / ${selectedIds.length}`;

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
            });

            // Show done button
            importDoneBtn.style.display = 'inline-flex';

            // Show summary toast
            const stats = data.stats;
            showToast(
                `Import complete! Added: ${stats.added}, Updated: ${stats.updated}, Skipped: ${stats.skipped}, Failed: ${stats.failed}`,
                stats.failed > 0 ? 'error' : 'success'
            );
        } else {
            showToast('Import failed: ' + data.error, 'error');
            importDoneBtn.style.display = 'inline-flex';
        }
    } catch (error) {
        showToast('Error importing songs: ' + error.message, 'error');
        importDoneBtn.style.display = 'inline-flex';
    }
}

async function finishImport() {
    closeImportDialog();
    await loadSongs(); // Reload song list
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
