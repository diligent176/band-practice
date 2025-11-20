/**
 * Band Practice Pro v3 - Player Manager
 * Handles player view (lyrics, notes, playback controls, keyboard navigation)
 */

const PlayerManager = {
    currentSong: null,
    columnMode: parseInt(localStorage.getItem('v3_playerColumnMode')) || 3,
    fontSize: parseFloat(localStorage.getItem('v3_playerFontSize')) || 1.0,
    bpmIndicatorEnabled: localStorage.getItem('v3_bpmIndicatorEnabled') !== 'false',
    bpmInterval: null,
    helpCardVisible: false,

    // Note navigation (callout-based system)
    notes: [],
    currentNoteIndex: -1,
    noteCalloutTimeout: null,

    // BPM Tap Trainer
    tapTimes: [],
    detectedBpm: null,

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

        document.getElementById('player-prev-btn')?.addEventListener('click', () => {
            this.previousSong();
        });

        document.getElementById('player-next-btn')?.addEventListener('click', () => {
            this.nextSong();
        });

        // View controls
        document.getElementById('player-toggle-columns')?.addEventListener('click', () => {
            this.toggleColumns();
        });

        document.getElementById('player-font-increase')?.addEventListener('click', () => {
            this.adjustFontSize(0.1);
        });

        document.getElementById('player-font-decrease')?.addEventListener('click', () => {
            this.adjustFontSize(-0.1);
        });

        // BPM flasher toggle
        document.getElementById('bpm-flasher')?.addEventListener('click', () => {
            this.toggleBpmIndicator();
        });

        // Help card
        this.setupPlayerHelpCard();
    },

    setupPlayerHelpCard() {
        const helpToggle = document.getElementById('player-help-toggle');
        const helpCard = document.getElementById('player-help-card');
        if (!helpToggle || !helpCard) return;

        helpToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayerHelpCard();
        });

        document.addEventListener('click', (e) => {
            if (this.helpCardVisible && !e.target.closest('#player-help-toggle')) {
                this.togglePlayerHelpCard();
            }
        });
    },

    togglePlayerHelpCard() {
        const helpCard = document.getElementById('player-help-card');
        if (!helpCard) return;

        this.helpCardVisible = !this.helpCardVisible;

        if (this.helpCardVisible) {
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
     * Load a song into the player
     * @param {Object} song - Song object from Firestore
     */
    async loadSong(song) {
        this.currentSong = song;
        console.log('🎵 Loading song:', song.title);

        // Stop BPM flasher from previous song
        this.stopBpmFlasher();

        // Update top nav metadata
        this.renderTopNav();

        // Render lyrics
        this.renderLyrics();

        // Render notes
        this.renderNotes();

        // Start BPM flasher if enabled
        if (this.bpmIndicatorEnabled) {
            this.startBpmFlasher();
        }

        // TODO: Load Spotify preview (Phase 8)
        // this.loadSpotifyPreview();
    },

    /**
     * Render song metadata in top nav bar
     */
    renderTopNav() {
        const albumArt = document.getElementById('player-album-art');
        const songTitle = document.getElementById('player-song-title');
        const artist = document.getElementById('player-artist');
        const bpm = document.getElementById('player-bpm');

        if (albumArt) {
            albumArt.src = this.currentSong.album_art_url || '/static/favicon.svg';
            albumArt.alt = `${this.currentSong.title} album art`;
        }

        if (songTitle) {
            songTitle.textContent = this.currentSong.title || 'Unknown';
        }

        if (artist) {
            artist.textContent = this.currentSong.artist || 'Unknown Artist';
        }

        if (bpm) {
            if (this.currentSong.bpm && this.currentSong.bpm !== 'N/A') {
                bpm.textContent = `BPM: ${this.currentSong.bpm}`;
            } else {
                bpm.textContent = 'BPM: --';
            }
        }
    },

    /**
     * Render lyrics in lyrics panel
     */
    renderLyrics() {
        const lyricsPanel = document.getElementById('player-lyrics-panel');
        if (!lyricsPanel) return;

        // Use lyrics_numbered which has proper line numbers from backend
        const lyrics = this.currentSong.lyrics_numbered || this.currentSong.lyrics || '';

        if (!lyrics || lyrics.trim() === '') {
            lyricsPanel.innerHTML = '<div class="empty-state"><p>No lyrics available. Press E to add lyrics.</p></div>';
            return;
        }

        // Split into lines, matching v2 rendering logic exactly
        const lines = lyrics.split('\n');
        let html = '';

        lines.forEach(line => {
            if (line.match(/^\[.*\]$/)) {
                // Section header - lines that start and end with square brackets like [Verse 1], [Chorus], etc.
                html += `<div class="lyric-line section-header">${this.escapeHtml(line)}</div>`;
            } else if (line.match(/^\s*\d+\s+/)) {
                // Numbered line
                const match = line.match(/^(\s*)(\d+)(\s+)(.+)/);
                if (match) {
                    const lineNum = match[2].trim();
                    const text = match[4];
                    html += `<div class="lyric-line" data-line="${lineNum}">
                        <span class="line-number">${lineNum}</span>${this.escapeHtml(text)}
                    </div>`;
                }
            } else if (line.trim()) {
                // Non-empty line without number
                html += `<div class="lyric-line">${this.escapeHtml(line)}</div>`;
            }
            // Skip completely blank lines - don't render them
        });

        lyricsPanel.innerHTML = html || '<div class="empty-state"><p>No lyrics available</p></div>';
        this.applyColumnMode();
        this.applyFontSize();
    },

    /**
     * Load notes for navigation (notes shown as callouts only)
     */
    renderNotes() {
        // Store notes in state for navigation
        this.notes = this.currentSong.notes || [];
        this.currentNoteIndex = -1;

        // Hide any visible callout from previous song
        this.hideNoteCallout();
    },

    /**
     * Highlight lyric lines when note is clicked
     * @param {number} lineStart - Starting line number
     * @param {number} lineEnd - Ending line number
     */
    highlightLyricLines(lineStart, lineEnd) {
        // Remove previous highlights
        document.querySelectorAll('.lyric-line.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });

        // Add new highlights
        for (let i = lineStart; i <= lineEnd; i++) {
            const line = document.querySelector(`.lyric-line[data-line="${i}"]`);
            if (line) {
                line.classList.add('highlighted');
                // Scroll first highlighted line into view
                if (i === lineStart) {
                    line.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    },

    /**
     * Navigate to note by direction (arrow key navigation)
     * @param {number} direction - 1 for next, -1 for previous
     */
    navigateToNote(direction) {
        if (this.notes.length === 0) {
            BPP.showToast('No notes for this song', 'info');
            return;
        }

        // Update index (wrap around)
        this.currentNoteIndex += direction;

        if (this.currentNoteIndex >= this.notes.length) {
            this.currentNoteIndex = 0; // Wrap to start
        } else if (this.currentNoteIndex < 0) {
            this.currentNoteIndex = this.notes.length - 1; // Wrap to end
        }

        // Show the note callout
        this.showNoteCallout();

        // Reset fade timer
        this.resetNoteCalloutTimer();
    },

    /**
     * Show note callout for current note
     */
    showNoteCallout() {
        const note = this.notes[this.currentNoteIndex];
        if (!note) return;

        const callout = document.getElementById('note-callout');
        const calloutContent = document.getElementById('note-callout-content');
        if (!callout || !calloutContent) return;

        // Highlight the lyric lines
        this.highlightLyricLines(note.line_start, note.line_end || note.line_start);

        // Get the first highlighted line to position callout
        const firstLine = document.querySelector(`.lyric-line[data-line="${note.line_start}"]`);
        if (!firstLine) return;

        // Format note content
        const lineRange = note.line_end && note.line_end !== note.line_start
            ? `Lines ${note.line_start}-${note.line_end}`
            : `Line ${note.line_start}`;

        calloutContent.innerHTML = `
            <div style="font-weight: 600; color: var(--accent-primary); margin-bottom: 8px;">
                ${this.escapeHtml(lineRange)} (${this.currentNoteIndex + 1}/${this.notes.length})
            </div>
            <div>${this.escapeHtml(note.content)}</div>
        `;

        // Position callout ABOVE the first highlighted line to avoid covering it
        const lineRect = firstLine.getBoundingClientRect();
        const lyricsPanel = document.getElementById('player-lyrics-panel');
        const panelRect = lyricsPanel.getBoundingClientRect();

        // Position relative to lyrics panel - ABOVE the line with some spacing
        callout.style.left = `${lineRect.left - panelRect.left}px`;

        // Calculate position above the line
        // We need to measure callout height first, so show it briefly to get dimensions
        callout.style.visibility = 'hidden';
        callout.classList.remove('hidden');
        const calloutHeight = callout.offsetHeight;
        callout.classList.add('hidden');
        callout.style.visibility = '';

        // Position above the line with 10px gap
        callout.style.top = `${lineRect.top - panelRect.top - calloutHeight - 10}px`;

        // Show callout with fade-in animation
        callout.classList.remove('hidden');
        setTimeout(() => callout.classList.add('visible'), 10);
    },

    /**
     * Hide note callout
     */
    hideNoteCallout() {
        const callout = document.getElementById('note-callout');
        if (!callout) return;

        // Fade out
        callout.classList.remove('visible');
        setTimeout(() => {
            callout.classList.add('hidden');
        }, 300); // Match CSS transition duration

        // Remove lyric highlights
        document.querySelectorAll('.lyric-line.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });

        // Clear timer
        if (this.noteCalloutTimeout) {
            clearTimeout(this.noteCalloutTimeout);
            this.noteCalloutTimeout = null;
        }
    },

    /**
     * Reset auto-fade timer (5 seconds)
     */
    resetNoteCalloutTimer() {
        // Clear existing timer
        if (this.noteCalloutTimeout) {
            clearTimeout(this.noteCalloutTimeout);
        }

        // Set new 5-second timer
        this.noteCalloutTimeout = setTimeout(() => {
            this.hideNoteCallout();
        }, 5000);
    },

    /**
     * Toggle lyrics column mode (1/2/3)
     */
    toggleColumns() {
        // Cycle: 2 → 3 → 1 → 2
        if (this.columnMode === 2) {
            this.columnMode = 3;
        } else if (this.columnMode === 3) {
            this.columnMode = 1;
        } else {
            this.columnMode = 2;
        }

        this.applyColumnMode();
        localStorage.setItem('v3_playerColumnMode', this.columnMode);
    },

    /**
     * Apply current column mode to lyrics panel
     */
    applyColumnMode() {
        const lyricsPanel = document.getElementById('player-lyrics-panel');
        if (!lyricsPanel) return;

        lyricsPanel.classList.remove('lyrics-columns-1', 'lyrics-columns-2', 'lyrics-columns-3');
        lyricsPanel.classList.add(`lyrics-columns-${this.columnMode}`);
    },

    /**
     * Adjust font size
     * @param {number} delta - Amount to change (0.1 or -0.1)
     */
    adjustFontSize(delta) {
        this.fontSize = Math.max(0.5, Math.min(2.5, this.fontSize + delta));
        this.applyFontSize();
        localStorage.setItem('v3_playerFontSize', this.fontSize);
    },

    /**
     * Apply current font size to lyrics panel
     */
    applyFontSize() {
        const lyricsPanel = document.getElementById('player-lyrics-panel');
        if (!lyricsPanel) return;

        // Base font size is 13px, scale it by fontSize multiplier
        const baseFontSize = 13;
        const scaledFontSize = baseFontSize * this.fontSize;

        // Dynamic line height like v2: calc(1.2 + (fontSize * 0.15))
        const lineHeight = 1.2 + (this.fontSize * 0.15);

        lyricsPanel.style.fontSize = `${scaledFontSize}px`;
        lyricsPanel.style.lineHeight = lineHeight;
    },

    /**
     * Edit lyrics
     */
    editLyrics() {
        const editor = document.getElementById('lyrics-editor');
        if (!editor) return;

        editor.value = this.currentSong.lyrics || '';
        BPP.showDialog('edit-lyrics-dialog');
        editor.focus();
    },

    /**
     * Save lyrics
     */
    async saveLyrics() {
        const editor = document.getElementById('lyrics-editor');
        if (!editor) return;

        const newLyrics = editor.value;

        try {
            await BPP.apiCall(`/api/v3/songs/${this.currentSong.id}`, {
                method: 'PUT',
                body: JSON.stringify({ lyrics: newLyrics, custom_lyrics: true })
            });

            this.currentSong.lyrics = newLyrics;
            this.currentSong.custom_lyrics = true;
            this.renderLyrics();
            BPP.hideDialog('edit-lyrics-dialog');
            BPP.showToast('Lyrics updated!', 'success');
        } catch (error) {
            console.error('Failed to save lyrics:', error);
            BPP.showToast('Failed to save lyrics', 'error');
        }
    },

    /**
     * Edit notes
     */
    editNotes() {
        const editor = document.getElementById('notes-editor');
        const lyricsDisplay = document.getElementById('notes-editor-lyrics-display');
        if (!editor || !lyricsDisplay) return;

        // Populate notes editor with existing notes
        const notes = this.currentSong.notes || [];
        const text = notes.map(n => {
            const range = n.line_end && n.line_end !== n.line_start
                ? `${n.line_start}-${n.line_end}`
                : n.line_start;
            return `${range}: ${n.content}`;
        }).join('\n');

        editor.value = text;

        // Render numbered lyrics in left panel (reuse rendering logic)
        const lyrics = this.currentSong.lyrics_numbered || this.currentSong.lyrics || '';

        if (!lyrics || lyrics.trim() === '') {
            lyricsDisplay.innerHTML = '<div class="empty-state"><p>No lyrics available</p></div>';
        } else {
            const lines = lyrics.split('\n');
            let html = '';

            lines.forEach(line => {
                if (line.match(/^\[.*\]$/)) {
                    // Section header
                    html += `<div class="lyric-line section-header">${this.escapeHtml(line)}</div>`;
                } else if (line.match(/^\s*\d+\s+/)) {
                    // Numbered line
                    const match = line.match(/^(\s*)(\d+)(\s+)(.+)/);
                    if (match) {
                        const lineNum = match[2].trim();
                        const text = match[4];
                        html += `<div class="lyric-line">
                            <span class="line-number">${lineNum}</span>${this.escapeHtml(text)}
                        </div>`;
                    }
                } else if (line.trim()) {
                    // Non-empty line without number
                    html += `<div class="lyric-line">${this.escapeHtml(line)}</div>`;
                }
            });

            lyricsDisplay.innerHTML = html || '<div class="empty-state"><p>No lyrics available</p></div>';
        }

        // Show dialog and focus editor
        BPP.showDialog('edit-notes-dialog');

        // Setup keyboard shortcuts for this dialog
        this.setupNotesEditorKeyboard();

        // Focus the textarea
        setTimeout(() => editor.focus(), 100);
    },

    /**
     * Setup keyboard shortcuts for notes editor
     */
    setupNotesEditorKeyboard() {
        const editor = document.getElementById('notes-editor');
        if (!editor) return;

        // Remove existing listener if any
        if (this.notesEditorKeyboardHandler) {
            editor.removeEventListener('keydown', this.notesEditorKeyboardHandler);
        }

        // Create new handler
        this.notesEditorKeyboardHandler = (e) => {
            // Ctrl+Enter or Cmd+Enter = Save
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.saveNotes();
                return;
            }

            // ESC = Cancel
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelNotesEdit();
                return;
            }
        };

        // Attach listener
        editor.addEventListener('keydown', this.notesEditorKeyboardHandler);
    },

    /**
     * Cancel notes editing
     */
    cancelNotesEdit() {
        const editor = document.getElementById('notes-editor');

        // Clean up keyboard listener
        if (this.notesEditorKeyboardHandler && editor) {
            editor.removeEventListener('keydown', this.notesEditorKeyboardHandler);
            this.notesEditorKeyboardHandler = null;
        }

        BPP.hideDialog('edit-notes-dialog');
    },

    /**
     * Save notes
     */
    async saveNotes() {
        const editor = document.getElementById('notes-editor');
        if (!editor) return;

        const text = editor.value;
        const notes = this.parseNotes(text);

        try {
            await BPP.apiCall(`/api/v3/songs/${this.currentSong.id}`, {
                method: 'PUT',
                body: JSON.stringify({ notes })
            });

            this.currentSong.notes = notes;
            this.renderNotes();

            // Clean up keyboard listener
            if (this.notesEditorKeyboardHandler) {
                editor.removeEventListener('keydown', this.notesEditorKeyboardHandler);
                this.notesEditorKeyboardHandler = null;
            }

            BPP.hideDialog('edit-notes-dialog');
            BPP.showToast('Notes updated!', 'success');
        } catch (error) {
            console.error('Failed to save notes:', error);
            BPP.showToast('Failed to save notes', 'error');
        }
    },

    /**
     * Parse notes from text format
     * @param {string} text - Notes in text format
     * @returns {Array} - Array of note objects
     */
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
    },

    /**
     * Toggle BPM indicator
     */
    toggleBpmIndicator() {
        this.bpmIndicatorEnabled = !this.bpmIndicatorEnabled;

        if (this.bpmIndicatorEnabled) {
            this.startBpmFlasher();
        } else {
            this.stopBpmFlasher();
        }

        localStorage.setItem('v3_bpmIndicatorEnabled', this.bpmIndicatorEnabled);
    },

    /**
     * Start BPM flasher animation
     */
    startBpmFlasher() {
        if (!this.currentSong || !this.currentSong.bpm || this.currentSong.bpm === 'N/A') {
            return;
        }

        const bpm = parseFloat(this.currentSong.bpm);
        if (isNaN(bpm) || bpm <= 0) return;

        const interval = (60 / bpm) * 1000; // ms per beat
        const flasher = document.getElementById('bpm-flasher');
        if (!flasher) return;

        this.stopBpmFlasher(); // Stop existing interval

        this.bpmInterval = setInterval(() => {
            flasher.classList.add('active');
            setTimeout(() => flasher.classList.remove('active'), 150);
        }, interval);
    },

    /**
     * Stop BPM flasher animation
     */
    stopBpmFlasher() {
        if (this.bpmInterval) {
            clearInterval(this.bpmInterval);
            this.bpmInterval = null;
        }
    },

    /**
     * Open BPM tap trainer dialog
     */
    openBpmTapTrainer() {
        this.resetTapTrainer();
        BPP.showDialog('bpm-tap-dialog');
    },

    /**
     * Reset tap trainer
     */
    resetTapTrainer() {
        this.tapTimes = [];
        this.detectedBpm = null;

        const bpmDisplay = document.getElementById('bpm-detected');
        const tapCount = document.getElementById('bpm-tap-count');
        const saveBtn = document.getElementById('bpm-tap-save-btn');

        if (bpmDisplay) bpmDisplay.textContent = '--.-';
        if (tapCount) tapCount.textContent = 'Taps: 0';
        if (saveBtn) saveBtn.disabled = true;
    },

    /**
     * Handle tap (called on '.' key press)
     */
    handleTap() {
        const now = Date.now();
        this.tapTimes.push(now);

        // Keep only last 8 taps
        if (this.tapTimes.length > 8) {
            this.tapTimes.shift();
        }

        const tapCount = document.getElementById('bpm-tap-count');
        if (tapCount) {
            tapCount.textContent = `Taps: ${this.tapTimes.length}`;
        }

        // Calculate BPM if we have at least 2 taps
        if (this.tapTimes.length >= 2) {
            const intervals = [];
            for (let i = 1; i < this.tapTimes.length; i++) {
                intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
            }

            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            this.detectedBpm = Math.round((60000 / avgInterval) * 10) / 10; // Round to 1 decimal

            const bpmDisplay = document.getElementById('bpm-detected');
            const saveBtn = document.getElementById('bpm-tap-save-btn');

            if (bpmDisplay) {
                bpmDisplay.textContent = this.detectedBpm.toFixed(1);
            }

            if (saveBtn && this.tapTimes.length >= 4) {
                saveBtn.disabled = false;
            }
        }
    },

    /**
     * Save BPM from tap trainer
     */
    async saveBpmFromTap() {
        if (!this.detectedBpm) {
            BPP.showToast('No BPM detected', 'error');
            return;
        }

        try {
            await BPP.apiCall(`/api/v3/songs/${this.currentSong.id}`, {
                method: 'PUT',
                body: JSON.stringify({ bpm: Math.round(this.detectedBpm) })
            });

            this.currentSong.bpm = Math.round(this.detectedBpm);
            this.renderTopNav();
            BPP.hideDialog('bpm-tap-dialog');
            BPP.showToast(`BPM set to ${this.currentSong.bpm}`, 'success');

            // Restart flasher with new BPM
            if (this.bpmIndicatorEnabled) {
                this.startBpmFlasher();
            }
        } catch (error) {
            console.error('Failed to save BPM:', error);
            BPP.showToast('Failed to save BPM', 'error');
        }
    },

    /**
     * Navigate to previous song
     */
    previousSong() {
        const allSongs = ViewManager.state.allSongs;
        if (!allSongs || allSongs.length === 0) return;

        const currentIndex = allSongs.findIndex(s => s.id === this.currentSong.id);
        if (currentIndex > 0) {
            const prevSong = allSongs[currentIndex - 1];
            this.loadSong(prevSong);
            ViewManager.state.currentSong = prevSong;
        }
    },

    /**
     * Navigate to next song
     */
    nextSong() {
        const allSongs = ViewManager.state.allSongs;
        if (!allSongs || allSongs.length === 0) return;

        const currentIndex = allSongs.findIndex(s => s.id === this.currentSong.id);
        if (currentIndex < allSongs.length - 1) {
            const nextSong = allSongs[currentIndex + 1];
            this.loadSong(nextSong);
            ViewManager.state.currentSong = nextSong;
        }
    },

    /**
     * Playback controls (stubbed for now - will implement in Phase 8)
     */
    togglePlayback() {
        BPP.showToast('Spotify playback coming in Phase 8', 'info');
    },

    restartTrack() {
        BPP.showToast('Restart track (coming soon)', 'info');
    },

    toggleMute() {
        BPP.showToast('Mute toggle (coming soon)', 'info');
    },

    skipBackward(seconds) {
        // Coming in Phase 8 - Spotify playback
    },

    skipForward(seconds) {
        // Coming in Phase 8 - Spotify playback
    },

    /**
     * HTML escape utility
     * @param {string} text - Text to escape
     * @returns {string} - Escaped HTML
     */
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

// Export for global use
window.PlayerManager = PlayerManager;
