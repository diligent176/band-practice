// Band Practice App - Frontend JavaScript

let currentSong = null;
let allSongs = [];
let isEditMode = false;

// Reference to the apiCall function from viewer.html
// This will be available globally after auth is set up
let apiCall = null;

// DOM Elements
const songSelect = document.getElementById('song-select');
const lyricsContent = document.getElementById('lyrics-content');
const notesView = document.getElementById('notes-view');
const notesEdit = document.getElementById('notes-edit');
const notesTextarea = document.getElementById('notes-textarea');
const songMetadata = document.getElementById('song-metadata');
const statusMessage = document.getElementById('status-message');

const editNotesBtn = document.getElementById('edit-notes-btn');
const saveNotesBtn = document.getElementById('save-notes-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const syncPlaylistBtn = document.getElementById('sync-playlist-btn');
const refreshSongBtn = document.getElementById('refresh-song-btn');
const changePlaylistBtn = document.getElementById('change-playlist-btn');

const playlistDialog = document.getElementById('playlist-dialog');
const playlistUrlInput = document.getElementById('playlist-url-input');
const playlistSaveBtn = document.getElementById('playlist-save-btn');
const playlistCancelBtn = document.getElementById('playlist-cancel-btn');

// Initialize - called from viewer.html after auth is complete
window.initializeApp = function(apiCallFunction) {
    console.log('🎸 Initializing app with authenticated API calls');
    apiCall = apiCallFunction;
    loadUserInfo();
    loadSongs();
    setupEventListeners();
};

function setupEventListeners() {
    songSelect.addEventListener('change', handleSongChange);
    editNotesBtn.addEventListener('click', enterEditMode);
    saveNotesBtn.addEventListener('click', saveNotes);
    cancelEditBtn.addEventListener('click', exitEditMode);
    syncPlaylistBtn.addEventListener('click', syncPlaylist);
    refreshSongBtn.addEventListener('click', refreshCurrentSong);
    changePlaylistBtn.addEventListener('click', showPlaylistDialog);
    playlistSaveBtn.addEventListener('click', syncNewPlaylist);
    playlistCancelBtn.addEventListener('click', hidePlaylistDialog);
}

// API Functions
async function loadUserInfo() {
    try {
        const response = await apiCall('/api/user');
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
        const response = await apiCall('/api/songs');
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
        const response = await apiCall(`/api/songs/${songId}`);
        const data = await response.json();

        if (data.success) {
            currentSong = data.song;
            renderSong();
            refreshSongBtn.disabled = false;
            editNotesBtn.disabled = false;
            setStatus('Song loaded', 'success');
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

        const response = await apiCall(`/api/songs/${currentSong.id}/notes`, {
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

async function syncPlaylist() {
    if (!confirm('Sync all songs from Spotify playlist? This may take a few minutes.')) {
        return;
    }

    try {
        showLoading('Syncing playlist from Spotify...');

        const response = await apiCall('/api/playlist/sync', {
            method: 'POST',
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (data.success) {
            showToast(data.message, 'success');
            setStatus(`Synced: +${data.added} new, ${data.updated} updated`, 'success');
            await loadSongs(); // Reload song list
        } else {
            showToast('Sync failed: ' + data.error, 'error');
        }
    } catch (error) {
        showToast('Error syncing playlist: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function refreshCurrentSong() {
    if (!currentSong) return;

    if (!confirm('Refresh lyrics for this song?')) {
        return;
    }

    try {
        showLoading('Refreshing lyrics...');

        const response = await apiCall(`/api/songs/${currentSong.id}/refresh`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            currentSong = data.song;
            renderSong();
            showToast('Lyrics refreshed!', 'success');
        } else {
            showToast('Failed to refresh lyrics', 'error');
        }
    } catch (error) {
        showToast('Error refreshing lyrics: ' + error.message, 'error');
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
        option.textContent = `${song.artist} - ${song.title}`;
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
        `<div class="metadata-item"><strong>${item.label}:</strong>${item.value}</div>`
    ).join('');
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

    lyricsContent.innerHTML = html || '<div class="empty-state"><p>No lyrics available</p></div>';
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
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
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

// Playlist Dialog Functions
function showPlaylistDialog() {
    playlistDialog.style.display = 'flex';
    playlistUrlInput.focus();
}

function hidePlaylistDialog() {
    playlistDialog.style.display = 'none';
    playlistUrlInput.value = '';
}

async function syncNewPlaylist() {
    const playlistUrl = playlistUrlInput.value.trim();

    if (!playlistUrl) {
        showToast('Please enter a playlist URL', 'error');
        return;
    }

    if (!playlistUrl.includes('spotify.com/playlist/')) {
        showToast('Invalid Spotify playlist URL', 'error');
        return;
    }

    hidePlaylistDialog();

    try {
        showLoading('Syncing new playlist from Spotify...');

        const response = await apiCall('/api/playlist/sync', {
            method: 'POST',
            body: JSON.stringify({ playlist_url: playlistUrl })
        });

        const data = await response.json();

        if (data.success) {
            showToast(data.message, 'success');
            setStatus(`Synced: +${data.added} new, ${data.updated} updated`, 'success');
            await loadSongs(); // Reload song list
        } else {
            showToast('Sync failed: ' + data.error, 'error');
        }
    } catch (error) {
        showToast('Error syncing playlist: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
