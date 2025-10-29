/**
 * Admin Panel JavaScript
 * Handles authentication and admin UI functionality
 */

// Firebase config is injected by Flask template
const firebaseConfig = window.FIREBASE_CONFIG;

// Global state
let currentUser = null;
let idToken = null;
let allUsers = [];
let allLogs = [];
let displayedLogs = [];
let logsOffset = 0;
let logsLimit = 50;
let hasMoreLogs = true;

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Set persistence
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// FirebaseUI configuration
const uiConfig = {
    signInFlow: 'popup',
    signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID
    ],
    callbacks: {
        signInSuccessWithAuthResult: function(authResult) {
            console.log('Sign-in successful:', authResult.user.email);
            return false; // Prevent redirect
        },
        signInFailure: function(error) {
            console.error('Sign-in failed:', error);
        }
    }
};

// Initialize FirebaseUI
const ui = new firebaseui.auth.AuthUI(auth);

// Auth state observer
auth.onAuthStateChanged(async (user) => {
    console.log('Auth state changed:', user ? user.email : 'null');

    if (user) {
        currentUser = user;

        // Get ID token
        try {
            idToken = await user.getIdToken();
            console.log('Got ID token');

            // Check if user is admin
            const isAdmin = await checkAdminStatus();

            if (isAdmin) {
                // Show admin panel
                document.getElementById('auth-gate').classList.add('hidden');
                document.getElementById('admin-panel').classList.remove('hidden');

                // Set user info in header
                const photoImg = document.getElementById('user-photo');
                photoImg.src = user.photoURL || '';

                // Add error handler for broken images
                photoImg.onerror = function() {
                    this.style.display = 'none';
                };

                document.getElementById('user-name').textContent = user.displayName || 'Admin User';
                document.getElementById('user-email').textContent = user.email;

                // Load initial data
                loadUsers();
                loadAuditLogs();
            } else {
                // Not an admin - show error and sign out
                alert('You do not have admin privileges. Please contact an administrator.');
                await signOut();
            }
        } catch (error) {
            console.error('Error getting token or checking admin status:', error);
            alert('Authentication error. Please try again.');
            await signOut();
        }
    } else {
        // User is signed out
        currentUser = null;
        idToken = null;

        // Show auth gate
        document.getElementById('auth-gate').classList.remove('hidden');
        document.getElementById('admin-panel').classList.add('hidden');

        // Render FirebaseUI
        ui.start('#firebaseui-auth-container', uiConfig);
    }
});

/**
 * Check if current user has admin privileges
 */
async function checkAdminStatus() {
    try {
        console.log('Checking admin status...');
        const response = await fetch('/api/user', {
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            console.error('Failed to get user data:', response.status);
            return false;
        }

        const userData = await response.json();
        console.log('User data:', userData);
        console.log('is_admin value:', userData.is_admin);
        console.log('is_admin === true:', userData.is_admin === true);

        return userData.is_admin === true;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

/**
 * Sign out the current user
 */
async function signOut() {
    try {
        await auth.signOut();
        console.log('Signed out successfully');
    } catch (error) {
        console.error('Sign out error:', error);
    }
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.closest('.tab').classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
        ...options.headers
    };

    const response = await fetch(endpoint, {
        ...options,
        headers
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'API request failed');
    }

    return await response.json();
}

/**
 * Load users from API
 */
async function loadUsers() {
    const container = document.getElementById('users-table-container');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Loading users...</div>';

    try {
        const data = await apiRequest('/api/admin/users');
        allUsers = data.users;

        // Update stats
        document.getElementById('total-users').textContent = allUsers.length;
        document.getElementById('admin-users').textContent = allUsers.filter(u => u.is_admin).length;

        // Calculate active today (logged in within last 24 hours)
        const now = new Date();
        const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
        const activeToday = allUsers.filter(u => {
            if (!u.last_login_at) return false;
            const lastLogin = new Date(u.last_login_at);
            return lastLogin > oneDayAgo;
        }).length;
        document.getElementById('active-today').textContent = activeToday;

        // Render users table
        renderUsersTable(allUsers);
    } catch (error) {
        console.error('Error loading users:', error);
        container.innerHTML = `<div class="error">Failed to load users: ${error.message}</div>`;
    }
}

/**
 * Render users table
 */
function renderUsersTable(users) {
    const container = document.getElementById('users-table-container');

    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>No users found</p>
            </div>
        `;
        return;
    }

    const html = `
        <table>
            <thead>
                <tr>
                    <th class="col-user">User</th>
                    <th class="col-spotify">Spotify Account</th>
                    <th class="col-status">Status</th>
                    <th class="col-created">Created</th>
                    <th class="col-login">Last Login</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>
                            <div class="user-cell">
                                <img src="${user.photo_url || ''}"
                                     alt="${user.display_name || 'User'}"
                                     class="user-avatar"
                                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%23666%22 d=%22M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z%22/%3E%3C/svg%3E'">
                                <div class="user-info">
                                    <div class="user-display-name">
                                        ${escapeHtml(user.display_name || 'Unknown')}
                                    </div>
                                    <div class="user-email-text">
                                        ${escapeHtml(user.email || '')}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td>
                            ${user.spotify_product ? `
                                <a href="${user.spotify_profile_url || '#'}"
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   class="spotify-link">
                                    ${user.spotify_profile_photo ? `
                                        <img src="${escapeHtml(user.spotify_profile_photo)}"
                                             alt="Spotify"
                                             class="spotify-avatar"
                                             onerror="this.style.display='none'">
                                    ` : `<div class="spotify-avatar-placeholder"><i class="fa-brands fa-spotify"></i></div>`}
                                    <div class="spotify-info">
                                        <div class="spotify-name-row">
                                            ${user.spotify_display_name ? `<span class="spotify-display-name">${escapeHtml(user.spotify_display_name)}</span>` : ''}
                                            <span class="badge ${user.spotify_product === 'premium' ? 'badge-premium' : 'badge-free'}">
                                                ${escapeHtml(user.spotify_product)}
                                            </span>
                                        </div>
                                        ${user.spotify_email ? `<div class="spotify-email-text">${escapeHtml(user.spotify_email)}</div>` : ''}
                                        <div class="spotify-details">
                                            ${user.spotify_country ? `<span>📍 ${escapeHtml(user.spotify_country)}</span>` : ''}
                                            ${user.spotify_followers !== undefined ? `<span>👥 ${user.spotify_followers}</span>` : ''}
                                        </div>
                                    </div>
                                </a>
                            ` : '<span class="no-spotify">—</span>'}
                        </td>
                        <td>
                            <div class="status-cell">
                                ${user.is_admin ? '<span class="badge badge-admin">Admin</span>' : ''}
                                ${user.email_verified ? '<span class="badge badge-verified">Verified</span>' : '<span class="badge badge-error">Unverified</span>'}
                            </div>
                        </td>
                        <td class="date-cell" title="${formatDate(user.created_at)}">
                            ${formatDateCompact(user.created_at)}
                        </td>
                        <td class="date-cell" title="${formatDate(user.last_login_at)}">
                            ${formatDateCompact(user.last_login_at)}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

/**
 * Load audit logs from API with pagination
 */
async function loadAuditLogs(reset = false) {
    const container = document.getElementById('audit-logs-table-container');
    const paginationContainer = document.getElementById('audit-logs-pagination');

    if (reset) {
        logsOffset = 0;
        displayedLogs = [];
        hasMoreLogs = true;
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Loading audit logs...</div>';
    }

    try {
        // Build query parameters
        const params = new URLSearchParams({
            limit: logsLimit,
            offset: logsOffset
        });

        // Add date filters if set
        const startDate = document.getElementById('log-start-date')?.value;
        const endDate = document.getElementById('log-end-date')?.value;

        if (startDate) {
            const startDateTime = new Date(startDate);
            startDateTime.setHours(0, 0, 0, 0);
            params.append('start_date', startDateTime.toISOString());
        }

        if (endDate) {
            const endDateTime = new Date(endDate);
            endDateTime.setHours(23, 59, 59, 999);
            params.append('end_date', endDateTime.toISOString());
        }

        const data = await apiRequest(`/api/admin/audit-logs?${params.toString()}`);
        const newLogs = data.logs;

        // Check if we have more logs to load
        hasMoreLogs = newLogs.length === logsLimit;

        // Add new logs to displayed logs
        displayedLogs = displayedLogs.concat(newLogs);
        allLogs = displayedLogs;

        // Update offset for next load
        logsOffset += newLogs.length;

        // Render logs table
        renderAuditLogsTable(displayedLogs);

        // Update pagination controls
        document.getElementById('logs-count').textContent = displayedLogs.length;

        if (hasMoreLogs) {
            paginationContainer.classList.remove('hidden');
            document.getElementById('load-more-logs').disabled = false;
        } else {
            if (displayedLogs.length > 0) {
                paginationContainer.classList.remove('hidden');
            }
            document.getElementById('load-more-logs').disabled = true;
        }
    } catch (error) {
        console.error('Error loading audit logs:', error);
        container.innerHTML = `<div class="error">Failed to load audit logs: ${error.message}</div>`;
    }
}

/**
 * Load more audit logs (pagination)
 */
async function loadMoreLogs() {
    const button = document.getElementById('load-more-logs');
    const originalText = button.innerHTML;

    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    button.disabled = true;

    await loadAuditLogs(false);

    if (!hasMoreLogs) {
        button.innerHTML = '<i class="fas fa-check"></i> All Loaded';
    } else {
        button.innerHTML = originalText;
    }
}

/**
 * Clear date filter
 */
function clearDateFilter() {
    document.getElementById('log-start-date').value = '';
    document.getElementById('log-end-date').value = '';
    loadAuditLogs(true);
}

/**
 * Render audit logs table
 */
function renderAuditLogsTable(logs) {
    const container = document.getElementById('audit-logs-table-container');

    if (logs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
                <p>No audit logs found</p>
            </div>
        `;
        return;
    }

    const html = `
        <table>
            <thead>
                <tr>
                    <th class="col-timestamp">Time</th>
                    <th class="col-user-email">User</th>
                    <th class="col-song">Song</th>
                    <th class="col-changed">Changed</th>
                    <th class="col-old-value">Old Value</th>
                    <th class="col-new-value">New Value</th>
                </tr>
            </thead>
            <tbody>
                ${logs.map(log => {
                    // Extract field name from changes or action
                    const changes = log.changes || {};
                    let field = 'unknown';
                    let oldValue = '';
                    let newValue = '';

                    // Try to get field from action name
                    if (log.action) {
                        if (log.action.includes('lyrics')) field = 'lyrics';
                        else if (log.action.includes('note')) field = 'drummer_notes';
                        else if (log.action.includes('bpm')) field = 'bpm';
                    }

                    // Extract values from changes object
                    if (changes.field) field = changes.field;
                    if (changes.old_value !== undefined) oldValue = changes.old_value;
                    if (changes.new_value !== undefined) newValue = changes.new_value;

                    // Fallback: check for direct field keys
                    const changeKeys = Object.keys(changes);
                    if (changeKeys.length > 0 && !changes.field) {
                        const key = changeKeys[0];
                        if (key !== 'old_value' && key !== 'new_value') {
                            field = key;
                            oldValue = changes.old_value || '';
                            newValue = changes[key] || changes.new_value || '';
                        }
                    }

                    return `
                    <tr>
                        <td class="date-cell" title="${formatDate(log.timestamp)}">${formatAuditDate(log.timestamp)}</td>
                        <td>
                            <div class="user-email-cell">${escapeHtml(log.user_email || 'Unknown')}</div>
                        </td>
                        <td>
                            <div class="resource-name">${escapeHtml(log.resource_name || 'Unknown')}</div>
                        </td>
                        <td>
                            ${getFieldBadge(field)}
                        </td>
                        <td class="value-cell">
                            ${formatValue(oldValue, field)}
                        </td>
                        <td class="value-cell">
                            ${formatValue(newValue, field)}
                            ${shouldShowDiff(field) ? `<div class="diff-link" onclick='openDiffModal(${JSON.stringify(log).replace(/'/g, "&apos;")})'><i class="fas fa-code-compare"></i> View diff</div>` : ''}
                        </td>
                    </tr>
                `}).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

/**
 * Get badge for field type with distinct colors
 */
function getFieldBadge(field) {
    if (!field) return '<span class="field-badge">Unknown</span>';

    const fieldMap = {
        'lyrics': { label: 'LYRICS', class: 'field-badge-lyrics' },
        'notes': { label: 'NOTES', class: 'field-badge-notes' },
        'bpm': { label: 'BPM', class: 'field-badge-bpm' },
        'title': { label: 'TITLE', class: 'field-badge-meta' },
        'artist': { label: 'ARTIST', class: 'field-badge-meta' }
    };

    const config = fieldMap[field] || { label: field.toUpperCase(), class: 'field-badge-default' };
    return `<span class="field-badge ${config.class}">${config.label}</span>`;
}

/**
 * Check if field should show diff viewer
 */
function shouldShowDiff(field) {
    return field === 'lyrics' || field === 'notes';
}

/**
 * Format value for display in table
 */
function formatValue(value, field) {
    if (!value) return '<span class="empty-value">(empty)</span>';

    // For BPM and other short values, show directly
    if (field === 'bpm' || typeof value === 'number') {
        return `<span class="value-short">${escapeHtml(String(value))}</span>`;
    }

    // For long text (lyrics, notes), truncate
    const text = String(value);
    if (text.length > 80) {
        return `<span class="value-long" title="${escapeHtml(text)}">${escapeHtml(text.substring(0, 80))}...</span>`;
    }

    return `<span class="value-short">${escapeHtml(text)}</span>`;
}

/**
 * Get CSS class for action type (deprecated, kept for compatibility)
 */
function getActionClass(action) {
    if (!action) return '';

    if (action.includes('update') || action.includes('edit')) return 'update';
    if (action.includes('delete') || action.includes('remove')) return 'delete';
    if (action.includes('create') || action.includes('add')) return 'create';

    return '';
}

/**
 * Format changes object for display
 */
function formatChanges(changes, log) {
    if (!changes) return '-';

    const entries = Object.entries(changes);
    if (entries.length === 0) return '-';

    // Check if this is a lyrics or notes change (diffable)
    const isDiffable = entries.some(([key]) =>
        key === 'lyrics' || key === 'drummer_notes' || key === 'old_value' || key === 'new_value'
    );

    if (isDiffable) {
        return `<div class="changes-clickable" onclick='openDiffModal(${JSON.stringify(log).replace(/'/g, "&apos;")})'>
            ${entries.map(([key, value]) => {
                let displayValue = value;
                if (typeof value === 'string' && value.length > 100) {
                    displayValue = value.substring(0, 100) + '...';
                }
                return `<div class="changes-details"><strong>${escapeHtml(key)}:</strong> <code>${escapeHtml(String(displayValue))}</code></div>`;
            }).join('')}
            <div class="changes-details" style="color: var(--accent-primary); margin-top: 4px;">
                <i class="fas fa-code-compare"></i> Click to view diff
            </div>
        </div>`;
    }

    return entries.map(([key, value]) => {
        let displayValue = value;
        if (typeof value === 'string' && value.length > 100) {
            displayValue = value.substring(0, 100) + '...';
        }
        return `<div class="changes-details"><strong>${escapeHtml(key)}:</strong> <code>${escapeHtml(String(displayValue))}</code></div>`;
    }).join('');
}

/**
 * Format date/timestamp for display (compact version)
 */
function formatDateCompact(dateStr) {
    if (!dateStr) return '—';

    try {
        const date = new Date(dateStr);

        // Check if date is valid
        if (isNaN(date.getTime())) return '—';

        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / 86400000);

        // If today, show time only
        if (diffDays === 0) {
            return date.toLocaleString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }

        // If this year, show month and day
        if (date.getFullYear() === now.getFullYear()) {
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        }

        // Otherwise show year
        return date.toLocaleString('en-US', {
            month: 'short',
            year: 'numeric'
        });
    } catch (error) {
        return '—';
    }
}

/**
 * Format date/timestamp for display (full version)
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';

    try {
        const date = new Date(dateStr);

        // Check if date is valid
        if (isNaN(date.getTime())) return '-';

        // Show full date and time
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    } catch (error) {
        return '-';
    }
}

/**
 * Format date/timestamp for audit logs (relative time for recent, full date for older)
 */
function formatAuditDate(dateStr) {
    if (!dateStr) return '-';

    try {
        const date = new Date(dateStr);

        // Check if date is valid
        if (isNaN(date.getTime())) return '-';

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        // Relative time for recent dates (audit logs benefit from this)
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        // Otherwise show formatted date
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (error) {
        return '-';
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Store current diff data for view switching
let currentDiffData = null;

/**
 * Open diff viewer modal
 */
function openDiffModal(log) {
    const modal = document.getElementById('diff-modal');
    const changes = log.changes || {};

    // Find the field that changed (lyrics, notes, etc.)
    const field = Object.keys(changes)[0];
    const oldValue = changes.old_value || changes[field]?.old_value || '';
    const newValue = changes.new_value || changes[field]?.new_value || changes[field] || '';

    // Store diff data for view switching
    currentDiffData = {
        oldValue,
        newValue,
        filename: log.resource_name || 'file'
    };

    // Populate modal info
    document.getElementById('diff-field').textContent = field || 'Unknown';
    document.getElementById('diff-action').textContent = log.action || 'Unknown';
    document.getElementById('diff-resource').textContent = log.resource_name || log.resource_type || 'Unknown';
    document.getElementById('diff-user').textContent = log.user_email || 'Unknown';
    document.getElementById('diff-time').textContent = formatDate(log.timestamp);

    // Generate and display both diff views
    displayUnifiedDiff(oldValue, newValue, currentDiffData.filename);
    displaySplitDiff(oldValue, newValue);

    // Apply saved diff view preference (default to 'unified')
    const savedView = localStorage.getItem('diffViewPreference') || 'unified';
    switchDiffView(savedView);

    // Show modal
    modal.classList.remove('hidden');
}

/**
 * Close diff viewer modal
 */
function closeDiffModal() {
    document.getElementById('diff-modal').classList.add('hidden');
}

/**
 * Switch between unified and split diff views
 */
function switchDiffView(view) {
    const unifiedView = document.getElementById('diff-output-unified');
    const splitView = document.getElementById('diff-output-split');
    const buttons = document.querySelectorAll('.view-toggle-btn');

    // Update button states
    buttons.forEach(btn => {
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Toggle views
    if (view === 'unified') {
        unifiedView.classList.remove('hidden');
        splitView.classList.add('hidden');
    } else {
        unifiedView.classList.add('hidden');
        splitView.classList.remove('hidden');
    }

    // Save preference to localStorage
    localStorage.setItem('diffViewPreference', view);
}

/**
 * Display unified diff (git diff style) using jsdiff library
 */
function displayUnifiedDiff(oldText, newText, filename) {
    const container = document.getElementById('diff-output-unified');

    if (!window.Diff) {
        container.innerHTML = '<div class="error">Diff library not loaded</div>';
        return;
    }

    // Create unified diff using jsdiff
    const diff = Diff.createPatch(
        filename,
        oldText || '',
        newText || '',
        'Old',
        'New',
        { context: 3 }
    );

    // Parse and render the unified diff
    renderUnifiedDiff(diff, container);
}

/**
 * Render unified diff output (like git diff)
 */
function renderUnifiedDiff(diffText, container) {
    const lines = diffText.split('\n');
    let html = '<div class="unified-diff">';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip the first few metadata lines from jsdiff output
        if (i < 2) continue;

        if (line.startsWith('@@')) {
            // Hunk header (chunk location info)
            html += `<div class="diff-hunk-header">${escapeHtml(line)}</div>`;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            // Removed line
            html += `<div class="diff-line diff-line-removed"><span class="diff-marker">-</span>${escapeHtml(line.substring(1))}</div>`;
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
            // Added line
            html += `<div class="diff-line diff-line-added"><span class="diff-marker">+</span>${escapeHtml(line.substring(1))}</div>`;
        } else if (line.startsWith(' ')) {
            // Context line (unchanged)
            html += `<div class="diff-line diff-line-context"><span class="diff-marker"> </span>${escapeHtml(line.substring(1))}</div>`;
        } else if (line.startsWith('---') || line.startsWith('+++')) {
            // File header
            html += `<div class="diff-file-header">${escapeHtml(line)}</div>`;
        } else if (line.trim() === '') {
            // Empty line
            html += `<div class="diff-line diff-line-context"><span class="diff-marker"> </span></div>`;
        }
    }

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Display split diff (side-by-side) using jsdiff library
 */
function displaySplitDiff(oldText, newText) {
    const oldContainer = document.getElementById('diff-split-old');
    const newContainer = document.getElementById('diff-split-new');

    if (!window.Diff) {
        oldContainer.innerHTML = '<div class="error">Diff library not loaded</div>';
        newContainer.innerHTML = '<div class="error">Diff library not loaded</div>';
        return;
    }

    // Compute line-by-line diff
    const diffs = Diff.diffLines(oldText || '', newText || '');

    let oldHtml = '';
    let newHtml = '';
    let oldLineNum = 1;
    let newLineNum = 1;

    diffs.forEach(part => {
        const lines = part.value.split('\n');
        // Remove last empty line if present
        if (lines[lines.length - 1] === '') {
            lines.pop();
        }

        if (part.added) {
            // Added lines - show only in new pane
            lines.forEach(line => {
                newHtml += `<div class="split-diff-line split-line-added">`;
                newHtml += `<span class="split-line-number">${newLineNum++}</span>`;
                newHtml += `<span class="split-marker">+</span>`;
                newHtml += `<span class="split-content">${escapeHtml(line)}</span>`;
                newHtml += `</div>`;
            });
        } else if (part.removed) {
            // Removed lines - show only in old pane
            lines.forEach(line => {
                oldHtml += `<div class="split-diff-line split-line-removed">`;
                oldHtml += `<span class="split-line-number">${oldLineNum++}</span>`;
                oldHtml += `<span class="split-marker">-</span>`;
                oldHtml += `<span class="split-content">${escapeHtml(line)}</span>`;
                oldHtml += `</div>`;
            });
        } else {
            // Unchanged lines - show in both panes
            lines.forEach(line => {
                oldHtml += `<div class="split-diff-line">`;
                oldHtml += `<span class="split-line-number">${oldLineNum++}</span>`;
                oldHtml += `<span class="split-marker"> </span>`;
                oldHtml += `<span class="split-content">${escapeHtml(line)}</span>`;
                oldHtml += `</div>`;

                newHtml += `<div class="split-diff-line">`;
                newHtml += `<span class="split-line-number">${newLineNum++}</span>`;
                newHtml += `<span class="split-marker"> </span>`;
                newHtml += `<span class="split-content">${escapeHtml(line)}</span>`;
                newHtml += `</div>`;
            });
        }
    });

    oldContainer.innerHTML = oldHtml || '<div class="split-empty">(empty)</div>';
    newContainer.innerHTML = newHtml || '<div class="split-empty">(empty)</div>';

    // Sync scroll between panes
    syncSplitScroll();
}

/**
 * Synchronize scrolling between split panes
 */
function syncSplitScroll() {
    const oldPane = document.getElementById('diff-split-old');
    const newPane = document.getElementById('diff-split-new');

    if (!oldPane || !newPane) return;

    let isOldScrolling = false;
    let isNewScrolling = false;

    oldPane.addEventListener('scroll', () => {
        if (isNewScrolling) return;
        isOldScrolling = true;
        newPane.scrollTop = oldPane.scrollTop;
        setTimeout(() => { isOldScrolling = false; }, 10);
    });

    newPane.addEventListener('scroll', () => {
        if (isOldScrolling) return;
        isNewScrolling = true;
        oldPane.scrollTop = newPane.scrollTop;
        setTimeout(() => { isNewScrolling = false; }, 10);
    });
}

// Keyboard shortcut to close modal (Escape key)
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('diff-modal');
        if (modal && !modal.classList.contains('hidden')) {
            closeDiffModal();
        }
    }
});

// Search functionality and date filter listeners
document.addEventListener('DOMContentLoaded', () => {
    // User search
    const userSearch = document.getElementById('user-search');
    if (userSearch) {
        userSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allUsers.filter(user =>
                (user.email && user.email.toLowerCase().includes(query)) ||
                (user.display_name && user.display_name.toLowerCase().includes(query)) ||
                (user.spotify_email && user.spotify_email.toLowerCase().includes(query)) ||
                (user.spotify_display_name && user.spotify_display_name.toLowerCase().includes(query))
            );
            renderUsersTable(filtered);
        });
    }

    // Log search (client-side filter on already loaded logs)
    const logSearch = document.getElementById('log-search');
    if (logSearch) {
        logSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = displayedLogs.filter(log =>
                (log.user_email && log.user_email.toLowerCase().includes(query)) ||
                (log.action && log.action.toLowerCase().includes(query)) ||
                (log.resource_name && log.resource_name.toLowerCase().includes(query))
            );
            renderAuditLogsTable(filtered);
        });
    }

    // Date filter listeners
    const startDateInput = document.getElementById('log-start-date');
    const endDateInput = document.getElementById('log-end-date');

    if (startDateInput) {
        startDateInput.addEventListener('change', () => {
            loadAuditLogs(true);
        });
    }

    if (endDateInput) {
        endDateInput.addEventListener('change', () => {
            loadAuditLogs(true);
        });
    }
});
