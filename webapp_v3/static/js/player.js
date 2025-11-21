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
                // Strip the brackets for display
                const headerText = line.slice(1, -1); // Remove first and last character
                html += `<div class="lyric-line section-header">${this.escapeHtml(headerText)}</div>`;
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

        // Filter to only numbered notes (skip free-form notes)
        const numberedNotes = this.notes
            .map((note, idx) => ({ note, idx }))
            .filter(({ note }) => note.line_start !== null && note.line_start !== undefined);

        if (numberedNotes.length === 0) {
            BPP.showToast('No line-based notes for this song', 'info');
            return;
        }

        // Find current position in numbered notes array
        let currentPos = numberedNotes.findIndex(({ idx }) => idx === this.currentNoteIndex);

        // If not found (first navigation or on free-form note), start from beginning or end
        if (currentPos === -1) {
            currentPos = direction > 0 ? -1 : numberedNotes.length;
        }

        // Move to next/previous numbered note
        currentPos += direction;

        // Wrap around
        if (currentPos >= numberedNotes.length) {
            currentPos = 0;
        } else if (currentPos < 0) {
            currentPos = numberedNotes.length - 1;
        }

        // Set the actual note index
        this.currentNoteIndex = numberedNotes[currentPos].idx;

        // Show the note callout
        this.showNoteCallout();

        // Reset fade timer
        this.resetNoteCalloutTimer();
    },

    /**
     * Jump to specific note by index (HOME/END key navigation)
     * @param {number} index - Note index (0 for first, -1 for last)
     */
    jumpToNote(index) {
        if (this.notes.length === 0) {
            BPP.showToast('No notes for this song', 'info');
            return;
        }

        // Filter to only numbered notes (skip free-form notes)
        const numberedNotes = this.notes
            .map((note, idx) => ({ note, idx }))
            .filter(({ note }) => note.line_start !== null && note.line_start !== undefined);

        if (numberedNotes.length === 0) {
            BPP.showToast('No line-based notes for this song', 'info');
            return;
        }

        // Jump to first or last numbered note
        if (index === -1) {
            // Last numbered note
            this.currentNoteIndex = numberedNotes[numberedNotes.length - 1].idx;
        } else {
            // First numbered note
            this.currentNoteIndex = numberedNotes[0].idx;
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

        // Handle free-form notes (no line reference) - silently skip
        if (note.line_start === null || note.line_start === undefined) {
            return;
        }

        // Highlight the lyric lines
        this.highlightLyricLines(note.line_start, note.line_end || note.line_start);

        // Get the first highlighted line to position callout
        const firstLine = document.querySelector(`.lyric-line[data-line="${note.line_start}"]`);
        if (!firstLine) {
            // Line not found - silently skip
            return;
        }

        // Format note content - show START/END tag if present
        let lineRange;
        if (note.tag === 'START') {
            lineRange = 'START';
        } else if (note.tag === 'END') {
            lineRange = 'END';
        } else if (note.line_end && note.line_end !== note.line_start) {
            lineRange = `Lines ${note.line_start}-${note.line_end}`;
        } else {
            lineRange = `Line ${note.line_start}`;
        }

        calloutContent.innerHTML = `
            <div style="font-weight: 600; color: var(--accent-primary); margin-bottom: 8px;">
                ${this.escapeHtml(lineRange)} (${this.currentNoteIndex + 1}/${this.notes.length})
            </div>
            <div>${this.escapeHtml(note.content)}</div>
        `;

        // Position callout BESIDE the highlighted lines (right side by default, left if would overflow)
        const lineRect = firstLine.getBoundingClientRect();
        const lyricsPanel = document.getElementById('player-lyrics-panel');
        const panelRect = lyricsPanel.getBoundingClientRect();

        // Measure callout dimensions first
        callout.style.visibility = 'hidden';
        callout.classList.remove('hidden');
        const calloutWidth = callout.offsetWidth;
        const calloutHeight = callout.offsetHeight;
        callout.classList.add('hidden');
        callout.style.visibility = '';

        // Determine if we should position on left or right
        const spaceOnRight = panelRect.right - lineRect.right;
        const spaceOnLeft = lineRect.left - panelRect.left;
        const gap = 15; // Gap between line and callout

        let leftPosition, topPosition;
        let arrowOnLeft = true; // Arrow points to the line from the left side of callout

        if (spaceOnRight >= calloutWidth + gap) {
            // Position on RIGHT side (default)
            leftPosition = lineRect.right - panelRect.left + gap;
            arrowOnLeft = true;
            callout.classList.remove('arrow-right');
            callout.classList.add('arrow-left');
        } else if (spaceOnLeft >= calloutWidth + gap) {
            // Position on LEFT side (not enough room on right)
            leftPosition = lineRect.left - panelRect.left - calloutWidth - gap;
            arrowOnLeft = false;
            callout.classList.remove('arrow-left');
            callout.classList.add('arrow-right');
        } else {
            // Not enough room on either side - position on right anyway and let it overflow
            leftPosition = lineRect.right - panelRect.left + gap;
            arrowOnLeft = true;
            callout.classList.remove('arrow-right');
            callout.classList.add('arrow-left');
        }

        // Vertical position: align with the first line, but ensure it doesn't go off top/bottom
        topPosition = lineRect.top - panelRect.top;

        // Adjust if would go off the top
        if (topPosition < 0) {
            topPosition = 10;
        }

        // Adjust if would go off the bottom
        const maxTop = panelRect.height - calloutHeight - 10;
        if (topPosition > maxTop) {
            topPosition = maxTop;
        }

        callout.style.left = `${leftPosition}px`;
        callout.style.top = `${topPosition}px`;

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
        const notesDisplay = document.getElementById('lyrics-editor-notes-display');
        const lineNumbers = document.getElementById('lyrics-line-numbers');
        if (!editor || !notesDisplay || !lineNumbers) return;

        // Populate lyrics editor with RAW lyrics (no numbers)
        editor.value = this.currentSong.lyrics || '';

        // Update line numbers initially
        this.updateLyricsLineNumbers();

        // Update line numbers when user types
        editor.addEventListener('input', () => this.updateLyricsLineNumbers());

        // Sync scroll
        editor.addEventListener('scroll', () => {
            lineNumbers.scrollTop = editor.scrollTop;
        });

        // Render notes in right panel
        const notes = this.currentSong.notes || [];
        if (notes.length === 0) {
            notesDisplay.innerHTML = '<div class="empty-state"><p>No notes for this song</p></div>';
        } else {
            let html = '';
            notes.forEach(note => {
                // Free-form notes (no line reference)
                if (note.line_start === null || note.line_start === undefined) {
                    html += `<div class="note-display free-form-note">
                        <div class="note-content">${this.escapeHtml(note.content)}</div>
                    </div>`;
                    return;
                }

                // START/END tags
                let lineRef = '';
                if (note.tag === 'START') {
                    lineRef = '<span class="note-line-ref start-tag">START</span>';
                } else if (note.tag === 'END') {
                    lineRef = '<span class="note-line-ref end-tag">END</span>';
                } else {
                    // Regular line-based notes
                    const range = note.line_end && note.line_end !== note.line_start
                        ? `${note.line_start}-${note.line_end}`
                        : note.line_start;
                    lineRef = `<span class="note-line-ref">Line ${range}</span>`;
                }

                html += `<div class="note-display">
                    ${lineRef}
                    <div class="note-content">${this.escapeHtml(note.content)}</div>
                </div>`;
            });

            notesDisplay.innerHTML = html;
        }

        // Show dialog and setup keyboard shortcuts
        BPP.showDialog('edit-lyrics-dialog');
        this.setupLyricsEditorKeyboard();

        // Focus the textarea
        setTimeout(() => editor.focus(), 100);
    },

    /**
     * Update line numbers for lyrics editor (matches v2 behavior)
     * Only numbers lyric lines - skips [section headers] and blank lines
     */
    updateLyricsLineNumbers() {
        const editor = document.getElementById('lyrics-editor');
        const lineNumbers = document.getElementById('lyrics-line-numbers');
        if (!editor || !lineNumbers) return;

        const lines = editor.value.split('\n');
        let lineNumbersText = '';
        let lineNum = 1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Check if line is a section header like [Verse 1], [Chorus], etc.
            const isHeader = /^\[.*\]/.test(trimmed);

            // Check if line is blank
            const isBlank = trimmed === '';

            if (isHeader || isBlank) {
                // Don't number headers or blank lines - just add empty line
                lineNumbersText += '\n';
            } else {
                // Number regular lyric lines
                lineNumbersText += lineNum + '\n';
                lineNum++;
            }
        }

        lineNumbers.textContent = lineNumbersText;
    },

    /**
     * Setup keyboard shortcuts for lyrics editor
     */
    setupLyricsEditorKeyboard() {
        const editor = document.getElementById('lyrics-editor');
        if (!editor) return;

        // Remove existing listener if any
        if (this.lyricsEditorKeyboardHandler) {
            editor.removeEventListener('keydown', this.lyricsEditorKeyboardHandler);
        }

        // Create new handler
        this.lyricsEditorKeyboardHandler = (e) => {
            // Ctrl+Enter or Cmd+Enter = Save
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.saveLyrics();
                return;
            }

            // ESC = Cancel
            if (e.key === 'Escape') {
                e.preventDefault();
                this.cancelLyricsEdit();
                return;
            }

            // ALT+T = Tighten lyrics
            if (e.altKey && e.key === 't') {
                e.preventDefault();
                this.tightenLyrics();
                return;
            }

            // ALT+V = Insert [Verse]
            if (e.altKey && e.key === 'v') {
                e.preventDefault();
                this.insertSectionHeader('Verse');
                return;
            }

            // ALT+C = Insert [Chorus]
            if (e.altKey && e.key === 'c') {
                e.preventDefault();
                this.insertSectionHeader('Chorus');
                return;
            }

            // ALT+B = Insert [Bridge]
            if (e.altKey && e.key === 'b') {
                e.preventDefault();
                this.insertSectionHeader('Bridge');
                return;
            }

            // ALT+I = Insert [Intro]
            if (e.altKey && e.key === 'i') {
                e.preventDefault();
                this.insertSectionHeader('Intro');
                return;
            }

            // ALT+O = Insert [Outro]
            if (e.altKey && e.key === 'o') {
                e.preventDefault();
                this.insertSectionHeader('Outro');
                return;
            }
        };

        // Attach listener
        editor.addEventListener('keydown', this.lyricsEditorKeyboardHandler);
    },

    /**
     * Cancel lyrics editing
     */
    cancelLyricsEdit() {
        const editor = document.getElementById('lyrics-editor');

        // Clean up keyboard listener
        if (this.lyricsEditorKeyboardHandler && editor) {
            editor.removeEventListener('keydown', this.lyricsEditorKeyboardHandler);
            this.lyricsEditorKeyboardHandler = null;
        }

        BPP.hideDialog('edit-lyrics-dialog');
    },

    /**
     * Save lyrics
     */
    async saveLyrics() {
        const editor = document.getElementById('lyrics-editor');
        if (!editor) return;

        const newLyrics = editor.value;

        // Update UI immediately for instant feedback (optimistic update)
        this.currentSong.lyrics = newLyrics;
        this.currentSong.custom_lyrics = true;
        this.renderLyrics();

        // Clean up keyboard listener
        if (this.lyricsEditorKeyboardHandler) {
            editor.removeEventListener('keydown', this.lyricsEditorKeyboardHandler);
            this.lyricsEditorKeyboardHandler = null;
        }

        // Hide dialog immediately
        BPP.hideDialog('edit-lyrics-dialog');
        BPP.showToast('Lyrics updated!', 'success');

        // Save to server in background
        try {
            const response = await BPP.apiCall(`/api/v3/songs/${this.currentSong.id}`, {
                method: 'PUT',
                body: JSON.stringify({ lyrics: newLyrics, custom_lyrics: true })
            });

            // Update with numbered lyrics from server
            if (response.lyrics_numbered) {
                this.currentSong.lyrics_numbered = response.lyrics_numbered;
                this.renderLyrics(); // Re-render with numbered lyrics
            }
        } catch (error) {
            console.error('Failed to save lyrics:', error);
            // Revert optimistic update on error
            BPP.showToast('Failed to save lyrics to server', 'error');
            // Could reload song here to restore server state, but leaving local changes for now
        }
    },

    /**
     * Insert section header at cursor position
     */
    insertSectionHeader(section) {
        const editor = document.getElementById('lyrics-editor');
        if (!editor) return;

        const cursorPos = editor.selectionStart;
        const text = editor.value;
        const before = text.substring(0, cursorPos);
        const after = text.substring(cursorPos);

        // Insert [Section] with trailing newline
        const insertion = `[${section}]\n`;
        editor.value = before + insertion + after;

        // Move cursor after insertion
        editor.selectionStart = editor.selectionEnd = cursorPos + insertion.length;
        editor.focus();

        // Update line numbers
        this.updateLyricsLineNumbers();
    },

    /**
     * Tighten lyrics - remove blank lines after headers, add space before headers
     */
    tightenLyrics() {
        const editor = document.getElementById('lyrics-editor');
        if (!editor) return;

        const lines = editor.value.split('\n');
        const result = [];
        let prevWasHeader = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isHeader = line.match(/^\[.*\]$/);
            const isBlank = line.trim() === '';

            // Skip blank lines after headers
            if (isBlank && prevWasHeader) {
                continue;
            }

            // Add blank line before header (unless first line or already preceded by blank)
            if (isHeader && result.length > 0) {
                const lastLine = result[result.length - 1];
                if (lastLine.trim() !== '') {
                    result.push('');
                }
            }

            // Skip multiple consecutive blank lines
            if (isBlank && result.length > 0 && result[result.length - 1].trim() === '') {
                continue;
            }

            result.push(line);
            prevWasHeader = isHeader;
        }

        // Remove trailing blank lines
        while (result.length > 0 && result[result.length - 1].trim() === '') {
            result.pop();
        }

        editor.value = result.join('\n');
        editor.focus();

        // Update line numbers
        this.updateLyricsLineNumbers();
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
            // Free-form notes (no line reference) - return content as-is
            if (n.line_start === null || n.line_start === undefined) {
                return n.content;
            }

            // Check if this is a START/END tag (stored as special marker)
            if (n.tag === 'START') {
                return `START: ${n.content}`;
            } else if (n.tag === 'END') {
                return `END: ${n.content}`;
            }

            // Line-based notes - format with line number(s)
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
                    // Section header - strip the brackets for display
                    const headerText = line.slice(1, -1);
                    html += `<div class="lyric-line section-header">${this.escapeHtml(headerText)}</div>`;
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

        // Update UI immediately for instant feedback
        this.currentSong.notes = notes;
        this.renderNotes();

        // Clean up keyboard listener
        if (this.notesEditorKeyboardHandler) {
            editor.removeEventListener('keydown', this.notesEditorKeyboardHandler);
            this.notesEditorKeyboardHandler = null;
        }

        // Hide dialog immediately
        BPP.hideDialog('edit-notes-dialog');
        BPP.showToast('Notes updated!', 'success');

        // Save to server in background
        try {
            await BPP.apiCall(`/api/v3/songs/${this.currentSong.id}`, {
                method: 'PUT',
                body: JSON.stringify({ notes })
            });
        } catch (error) {
            console.error('Failed to save notes:', error);
            // Revert optimistic update on error
            BPP.showToast('Failed to save notes to server', 'error');
            // Could reload song here to restore server state, but leaving local changes for now
        }
    },

    /**
     * Parse notes from text format
     * @param {string} text - Notes in text format
     * @returns {Array} - Array of note objects
     *
     * Accepts formats:
     * - START: note text (tag preserved, points to first line)
     * - END: note text (tag preserved, points to last line)
     * - 13: note text
     * - 13-16: note text
     * - 13 - 19: note text (with spaces)
     * - Any other text (preserved as free-form note without line reference)
     */
    parseNotes(text) {
        const lines = text.split('\n').filter(l => l.trim());

        // Find actual first and last line numbers from lyrics
        let firstLineNum = 1;
        let lastLineNum = 9999;

        if (this.currentSong && this.currentSong.lyrics_numbered) {
            const lyricsLines = this.currentSong.lyrics_numbered.split('\n');

            // Find first numbered line
            for (const line of lyricsLines) {
                const match = line.match(/^\s*(\d+)\s+/);
                if (match) {
                    firstLineNum = parseInt(match[1]);
                    break;
                }
            }

            // Find last numbered line
            for (let i = lyricsLines.length - 1; i >= 0; i--) {
                const match = lyricsLines[i].match(/^\s*(\d+)\s+/);
                if (match) {
                    lastLineNum = parseInt(match[1]);
                    break;
                }
            }
        }

        return lines.map(line => {
            // Try to match line-based note formats (with flexible spacing around dash)
            const match = line.match(/^(START|END|\d+(?:\s*-\s*\d+)?):\s*(.+)$/i);

            if (match) {
                // Matched a line-based note
                const [_, range, content] = match;
                let line_start, line_end, tag;

                if (range.toUpperCase() === 'START') {
                    line_start = firstLineNum;
                    line_end = firstLineNum;
                    tag = 'START'; // Keep tag for round-trip conversion
                } else if (range.toUpperCase() === 'END') {
                    line_start = lastLineNum;
                    line_end = lastLineNum;
                    tag = 'END'; // Keep tag for round-trip conversion
                } else if (range.includes('-')) {
                    // Handle "13-16" or "13 - 16" (with or without spaces)
                    const parts = range.split('-').map(s => s.trim()).map(Number);
                    line_start = parts[0];
                    line_end = parts[1] || parts[0];
                } else {
                    // Single line number
                    line_start = line_end = Number(range);
                }

                return tag ? { line_start, line_end, content, tag } : { line_start, line_end, content };
            } else {
                // Free-form note (no line reference) - preserve as-is
                // Store with null line numbers so it won't be highlighted, but will be saved
                return { line_start: null, line_end: null, content: line };
            }
        });
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
