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
    lyricsWidthPercent: parseFloat(localStorage.getItem('v3_lyricsWidthPercent')) || 80,
    isResizing: false,
    isInResizeMode: false,

    // BPM Tap Trainer
    tapTimes: [],
    detectedBpm: null,

    init() {
        this.setupEventListeners();
        this.setupResizer();
        this.applyLyricsWidth();
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

        const lyrics = this.currentSong.lyrics || '';

        if (!lyrics || lyrics.trim() === '') {
            lyricsPanel.innerHTML = '<div class="empty-state"><p>No lyrics available. Press E to add lyrics.</p></div>';
            return;
        }

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
        this.applyFontSize();
    },

    /**
     * Render notes in notes panel
     */
    renderNotes() {
        const notesPanel = document.getElementById('player-notes-panel');
        if (!notesPanel) return;

        const notes = this.currentSong.notes || [];

        if (notes.length === 0) {
            notesPanel.innerHTML = '<div class="empty-state"><p>No notes yet.<br>Press <kbd>N</kbd> to add notes.</p></div>';
            return;
        }

        const html = notes.map((note, index) => {
            const colorClass = `note-card-${(index % 5) + 1}`;
            const lineRange = note.line_end && note.line_end !== note.line_start
                ? `Lines ${note.line_start}-${note.line_end}`
                : `Line ${note.line_start}`;

            return `<div class="note-card ${colorClass}" data-note-index="${index}" data-line-start="${note.line_start}" data-line-end="${note.line_end || note.line_start}">
                <div class="note-header">
                    <span class="note-line-range">${lineRange}</span>
                </div>
                <div class="note-content">${this.escapeHtml(note.content)}</div>
            </div>`;
        }).join('');

        notesPanel.innerHTML = html + `<button class="btn btn-ghost" onclick="PlayerManager.editNotes()">
            <i class="fa-solid fa-plus"></i> Add Note
        </button>`;

        // Add click handlers to notes
        notesPanel.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', () => {
                const lineStart = parseInt(card.dataset.lineStart);
                const lineEnd = parseInt(card.dataset.lineEnd);
                this.highlightLyricLines(lineStart, lineEnd);
            });
        });
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
     * Setup resizable panel splitter
     */
    setupResizer() {
        const handle = document.getElementById('player-resize-handle');
        const lyricsPanel = document.getElementById('player-lyrics-panel');
        const notesPanel = document.getElementById('player-notes-panel');
        const playerMain = document.querySelector('.player-main');
        if (!handle || !lyricsPanel || !notesPanel || !playerMain) return;

        // Mouse drag
        handle.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isResizing) return;

            const containerRect = playerMain.getBoundingClientRect();
            const containerWidth = containerRect.width;
            const mouseX = e.clientX - containerRect.left;

            // Calculate percentage (10% minimum for notes, 90% maximum for lyrics)
            let lyricsPercentage = (mouseX / containerWidth) * 100;
            lyricsPercentage = Math.max(10, Math.min(90, lyricsPercentage));

            const notesPercentage = 100 - lyricsPercentage;

            // Apply flex basis
            lyricsPanel.style.flex = `0 0 ${lyricsPercentage}%`;
            notesPanel.style.flex = `0 0 ${notesPercentage}%`;
        });

        document.addEventListener('mouseup', () => {
            if (!this.isResizing) return;

            this.isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // Save the current split to localStorage
            const lyricsPercentage = (lyricsPanel.getBoundingClientRect().width / playerMain.getBoundingClientRect().width) * 100;
            localStorage.setItem('v3_lyricsWidthPercent', lyricsPercentage);
        });
    },

    /**
     * Set lyrics panel width percentage
     */
    setLyricsWidth(percent) {
        // Constrain between 10% and 90%
        this.lyricsWidthPercent = Math.max(10, Math.min(90, percent));
        this.applyLyricsWidth();
    },

    /**
     * Apply current lyrics width
     */
    applyLyricsWidth() {
        const lyricsPanel = document.getElementById('player-lyrics-panel');
        const notesPanel = document.getElementById('player-notes-panel');
        if (!lyricsPanel || !notesPanel) return;

        const notesPercentage = 100 - this.lyricsWidthPercent;
        lyricsPanel.style.flex = `0 0 ${this.lyricsWidthPercent}%`;
        notesPanel.style.flex = `0 0 ${notesPercentage}%`;
    },

    /**
     * Toggle resize mode (R key)
     */
    toggleResizer() {
        const handle = document.getElementById('player-resize-handle');
        const lyricsPanel = document.getElementById('player-lyrics-panel');
        const notesPanel = document.getElementById('player-notes-panel');
        if (!handle || !lyricsPanel || !notesPanel) return;

        this.isInResizeMode = !this.isInResizeMode;

        if (this.isInResizeMode) {
            // Entering resize mode - highlight handle
            handle.style.background = 'var(--accent-primary)';
            handle.style.width = '12px';
            BPP.showToast('Resize mode: use ← → arrows, ENTER to save', 'info');
        } else {
            this.exitResizeMode();
        }
    },

    /**
     * Exit resize mode and save
     */
    exitResizeMode() {
        const handle = document.getElementById('player-resize-handle');
        if (!handle) return;

        this.isInResizeMode = false;

        // Reset resize handle styling
        handle.style.background = '';
        handle.style.width = '';

        // Save the current split
        const lyricsPanel = document.getElementById('player-lyrics-panel');
        const playerMain = document.querySelector('.player-main');
        if (lyricsPanel && playerMain) {
            const lyricsPercentage = (lyricsPanel.getBoundingClientRect().width / playerMain.getBoundingClientRect().width) * 100;
            localStorage.setItem('v3_lyricsWidthPercent', lyricsPercentage);
        }
    },

    /**
     * Adjust panel split by percentage delta (keyboard resize mode)
     */
    adjustPanelSplit(deltaPercentage) {
        const lyricsPanel = document.getElementById('player-lyrics-panel');
        const notesPanel = document.getElementById('player-notes-panel');
        const playerMain = document.querySelector('.player-main');
        if (!lyricsPanel || !notesPanel || !playerMain) return;

        // Get current lyrics percentage
        const currentLyricsWidth = lyricsPanel.getBoundingClientRect().width;
        const containerWidth = playerMain.getBoundingClientRect().width;
        let lyricsPercentage = (currentLyricsWidth / containerWidth) * 100;

        // Adjust by delta
        lyricsPercentage += deltaPercentage;

        // Clamp to limits (10% minimum for notes, 90% maximum for lyrics)
        lyricsPercentage = Math.max(10, Math.min(90, lyricsPercentage));

        const notesPercentage = 100 - lyricsPercentage;

        // Apply flex basis
        lyricsPanel.style.flex = `0 0 ${lyricsPercentage}%`;
        notesPanel.style.flex = `0 0 ${notesPercentage}%`;
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

        lyricsPanel.style.fontSize = `${this.fontSize}rem`;
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
        if (!editor) return;

        const notes = this.currentSong.notes || [];
        const text = notes.map(n => {
            const range = n.line_end && n.line_end !== n.line_start
                ? `${n.line_start}-${n.line_end}`
                : n.line_start;
            return `${range}: ${n.content}`;
        }).join('\n');

        editor.value = text;
        BPP.showDialog('edit-notes-dialog');
        editor.focus();
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
