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
                document.getElementById('auth-gate').style.display = 'none';
                document.getElementById('admin-panel').style.display = 'block';

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
        document.getElementById('auth-gate').style.display = 'flex';
        document.getElementById('admin-panel').style.display = 'none';

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
                    <th style="width: 30%;">User</th>
                    <th style="width: 35%;">Spotify Account</th>
                    <th style="width: 12%;">Status</th>
                    <th style="width: 11%;">Created</th>
                    <th style="width: 12%;">Last Login</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td style="padding: 4px 12px;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <img src="${user.photo_url || ''}"
                                     alt="${user.display_name || 'User'}"
                                     style="width: 60px; height: 60px; border-radius: 50%; flex-shrink: 0;"
                                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22%3E%3Cpath fill=%22%23666%22 d=%22M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z%22/%3E%3C/svg%3E'">
                                <div style="min-width: 0; flex: 1;">
                                    <div style="font-weight: 600; color: #fff; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                        ${escapeHtml(user.display_name || 'Unknown')}
                                    </div>
                                    <div style="color: #8899a6; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                        ${escapeHtml(user.email || '')}
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td style="padding: 4px 12px;">
                            ${user.spotify_product ? `
                                <a href="${user.spotify_profile_url || '#'}"
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   style="display: flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; transition: opacity 0.2s;"
                                   onmouseover="this.style.opacity='0.7'"
                                   onmouseout="this.style.opacity='1'">
                                    ${user.spotify_profile_photo ? `
                                        <img src="${escapeHtml(user.spotify_profile_photo)}"
                                             alt="Spotify"
                                             style="width: 60px; height: 60px; border-radius: 50%; flex-shrink: 0;"
                                             onerror="this.style.display='none'">
                                    ` : `<div style="width: 60px; height: 60px; border-radius: 50%; background: #282828; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><i class="fa-brands fa-spotify" style="color: #1db954; font-size: 26px;"></i></div>`}
                                    <div style="min-width: 0; flex: 1;">
                                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                                            ${user.spotify_display_name ? `<span style="font-weight: 500; font-size: 13px; color: #fff;">${escapeHtml(user.spotify_display_name)}</span>` : ''}
                                            <span class="badge" style="background: ${user.spotify_product === 'premium' ? '#1db954' : '#535353'}; padding: 2px 6px; font-size: 10px; text-transform: uppercase;">
                                                ${escapeHtml(user.spotify_product)}
                                            </span>
                                        </div>
                                        ${user.spotify_email ? `<div style="color: #8899a6; font-size: 11px; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(user.spotify_email)}</div>` : ''}
                                        <div style="color: #8899a6; font-size: 11px; line-height: 1.4;">
                                            ${user.spotify_country ? `<span>📍 ${escapeHtml(user.spotify_country)}</span>` : ''}
                                            ${user.spotify_followers !== undefined ? `<span style="margin-left: ${user.spotify_country ? '8px' : '0'};">👥 ${user.spotify_followers}</span>` : ''}
                                        </div>
                                    </div>
                                </a>
                            ` : '<span style="color: #535353; font-size: 12px;">—</span>'}
                        </td>
                        <td style="padding: 4px 12px;">
                            <div style="display: flex; flex-direction: column; gap: 3px;">
                                ${user.is_admin ? '<span class="badge-admin" style="font-size: 10px; padding: 3px 6px;">Admin</span>' : ''}
                                ${user.email_verified ? '<span class="badge-verified" style="font-size: 10px; padding: 3px 6px;">Verified</span>' : '<span class="badge unverified" style="font-size: 10px; padding: 3px 6px;">Unverified</span>'}
                            </div>
                        </td>
                        <td style="padding: 4px 12px; font-size: 12px; color: #8899a6; white-space: nowrap; cursor: help;"
                            title="${formatDate(user.created_at)}">
                            ${formatDateCompact(user.created_at)}
                        </td>
                        <td style="padding: 4px 12px; font-size: 12px; color: #8899a6; white-space: nowrap; cursor: help;"
                            title="${formatDate(user.last_login_at)}">
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
 * Load audit logs from API
 */
async function loadAuditLogs() {
    const container = document.getElementById('audit-logs-table-container');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Loading audit logs...</div>';

    try {
        const data = await apiRequest('/api/admin/audit-logs?limit=100');
        allLogs = data.logs;

        // Render logs table
        renderAuditLogsTable(allLogs);
    } catch (error) {
        console.error('Error loading audit logs:', error);
        container.innerHTML = `<div class="error">Failed to load audit logs: ${error.message}</div>`;
    }
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
                    <th>Timestamp</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Changes</th>
                </tr>
            </thead>
            <tbody>
                ${logs.map(log => `
                    <tr>
                        <td class="timestamp">${formatAuditDate(log.timestamp)}</td>
                        <td>
                            <div class="user-email">${escapeHtml(log.user_email || 'Unknown')}</div>
                        </td>
                        <td>
                            <span class="action-badge ${getActionClass(log.action)}">${escapeHtml(log.action)}</span>
                        </td>
                        <td>
                            <div>${escapeHtml(log.resource_type || 'N/A')}</div>
                            ${log.resource_name ? `<div style="font-size: 12px; color: #8899a6;">${escapeHtml(log.resource_name)}</div>` : ''}
                        </td>
                        <td>
                            ${formatChanges(log.changes)}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

/**
 * Get CSS class for action type
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
function formatChanges(changes) {
    if (!changes) return '-';

    const entries = Object.entries(changes);
    if (entries.length === 0) return '-';

    return entries.map(([key, value]) => {
        let displayValue = value;

        // Truncate long strings
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

// Search functionality
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

    // Log search
    const logSearch = document.getElementById('log-search');
    if (logSearch) {
        logSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allLogs.filter(log =>
                (log.user_email && log.user_email.toLowerCase().includes(query)) ||
                (log.action && log.action.toLowerCase().includes(query)) ||
                (log.resource_name && log.resource_name.toLowerCase().includes(query))
            );
            renderAuditLogsTable(filtered);
        });
    }
});
