/**
 * Band Practice Pro v3 - Collections Manager
 * Handles collections loading, rendering, and CRUD operations
 */

const CollectionsManager = {
    // Keyboard navigation state
    selectedCollectionIndex: -1,
    collectionElements: [],

    // Help card state
    helpCardVisible: false,

    /**
     * Initialize collections manager
     */
    init() {
        this.setupEventListeners();
        console.log('✅ CollectionsManager initialized');
    },

    /**
     * Setup event listeners for collections view
     */
    setupEventListeners() {
        // New Collection Button
        document.getElementById('new-collection-btn').addEventListener('click', () => {
            BPP.showDialog('new-collection-dialog');
        });

        // Create Collection Button
        document.getElementById('create-collection-btn').addEventListener('click', async () => {
            await this.createCollection();
        });

        // Save Collection Button (Edit)
        document.getElementById('save-collection-btn').addEventListener('click', async () => {
            await this.saveCollection();
        });

        // Confirm Delete Button
        document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
            await this.confirmDelete();
        });

        // Confirm Request Access Button
        document.getElementById('confirm-request-access-btn').addEventListener('click', async () => {
            await this.requestCollaborationAccess();
        });

        // Enter key handlers for dialogs
        this.setupDialogEnterKeys();

        // ESC to close dialogs
        BPP.addEscapeHandler('new-collection-dialog');
        BPP.addEscapeHandler('edit-collection-dialog');
        BPP.addEscapeHandler('delete-collection-dialog');
        BPP.addEscapeHandler('request-access-dialog');
        BPP.addEscapeHandler('view-collaborators-dialog');

        // Help card
        this.setupHelpCard();

        // Keyboard navigation
        this.setupKeyboardNavigation();
    },

    /**
     * Setup Enter key handlers for dialog inputs
     */
    setupDialogEnterKeys() {
        // Enter key submits New Collection dialog
        const newDialogInputs = ['collection-name', 'collection-description'];
        newDialogInputs.forEach(inputId => {
            document.getElementById(inputId).addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('create-collection-btn').click();
                }
            });
        });

        // Enter key submits Edit Collection dialog
        const editDialogInputs = ['edit-collection-name', 'edit-collection-description'];
        editDialogInputs.forEach(inputId => {
            document.getElementById(inputId).addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('save-collection-btn').click();
                }
            });
        });

        // ENTER key on confirm delete button triggers delete
        document.getElementById('confirm-delete-btn').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById('confirm-delete-btn').click();
            }
        });

        // ENTER key on confirm request access button triggers request
        document.getElementById('confirm-request-access-btn').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById('confirm-request-access-btn').click();
            }
        });
    },

    /**
     * Setup help card toggle
     */
    setupHelpCard() {
        const helpCard = document.getElementById('help-card');

        // Click to toggle help
        document.getElementById('help-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleHelpCard();
        });

        // Click outside to close help
        document.addEventListener('click', (e) => {
            if (this.helpCardVisible && !e.target.closest('.keyboard-shortcuts-help')) {
                this.toggleHelpCard();
            }
        });
    },

    /**
     * Toggle help card visibility
     */
    toggleHelpCard() {
        const helpCard = document.getElementById('help-card');
        this.helpCardVisible = !this.helpCardVisible;
        
        if (this.helpCardVisible) {
            helpCard.style.opacity = '1';
            helpCard.style.visibility = 'visible';
            helpCard.style.transform = 'translateY(0)';
        } else {
            helpCard.style.opacity = '0';
            helpCard.style.visibility = 'hidden';
            helpCard.style.transform = 'translateY(-8px)';
        }
    },

    /**
     * Load all collections (owned, shared, public)
     */
    async loadCollections() {
        try {
            console.log('📦 Loading collections...');
            const data = await BPP.apiCall('/api/v3/collections');

            console.log('📦 Collections loaded:', data);

            // Render owned collections
            this.renderCollections(data.owned, 'owned-collections');

            // Render shared collections
            if (data.shared && data.shared.length > 0) {
                this.renderCollections(data.shared, 'shared-collections');
            } else {
                document.getElementById('shared-collections').innerHTML = '<p class="text-muted text-center">No shared collections yet</p>';
            }

            // Load public collections
            await this.loadPublicCollections();

        } catch (error) {
            console.error('Error loading collections:', error);
            BPP.showToast('Failed to load collections', 'error');
        }
    },

    /**
     * Load public collections
     */
    async loadPublicCollections() {
        try {
            const data = await BPP.apiCall('/api/v3/collections/public');
            const publicCollections = data.collections || [];

            if (publicCollections.length > 0) {
                this.renderPublicCollections(publicCollections, 'public-collections');
            } else {
                document.getElementById('public-collections').innerHTML = '<p class="text-muted text-center">No public collections available</p>';
            }
        } catch (error) {
            console.error('Error loading public collections:', error);
            document.getElementById('public-collections').innerHTML = '<p class="text-muted text-center">Failed to load public collections</p>';
        }
    },

    /**
     * Render collections (owned or shared)
     */
    renderCollections(collections, containerId) {
        const container = document.getElementById(containerId);

        if (!collections || collections.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No collections yet</p>';
            return;
        }

        const currentUserUid = window.currentUser?.uid;

        container.innerHTML = collections.map(collection => {
            // Get artwork from first linked playlist, or use fallback icon
            const firstPlaylist = collection.linked_playlists?.[0];
            const artworkUrl = firstPlaylist?.image_url;
            const hasArtwork = artworkUrl && artworkUrl.trim() !== '';
            
            // Check if current user is the owner
            const isOwner = collection.owner_uid === currentUserUid;

            return `
            <div class="collection-card card card-clickable" data-collection-id="${collection.id}">
                <div class="collection-artwork-container">
                    ${hasArtwork
                        ? `<img src="${this.escapeHtml(artworkUrl)}" alt="${this.escapeHtml(collection.name)} artwork" class="collection-artwork" loading="lazy">`
                        : `<div class="collection-artwork-placeholder">
                            <img src="/static/favicon.svg" alt="Guitar" style="width: 80%; height: 80%; opacity: 0.6;">
                           </div>`
                    }
                </div>
                <div class="collection-content">
                    <div class="collection-header">
                        <div class="collection-title-row">
                            <h3 class="collection-name">${this.escapeHtml(collection.name)}</h3>
                        </div>
                    </div>
                    <div class="collection-description-row">
                        ${collection.description ? `<p class="collection-description">${this.escapeHtml(collection.description)}</p>` : '<p class="collection-description"></p>'}
                        <div class="collection-badges">
                            ${collection.is_personal
                                ? '<span class="collection-badge">Personal</span>'
                                : collection.is_public
                                    ? '<span class="collection-badge collection-badge-public">Public</span>'
                                    : '<span class="collection-badge collection-badge-private"><i class="fa-solid fa-lock"></i></span>'
                            }
                        </div>
                    </div>
                    <div class="collection-meta-and-actions">
                        <div class="collection-meta">
                            <span class="collection-meta-item">
                                <i class="fa-solid fa-music"></i>
                                ${collection.song_count || 0} ${(collection.song_count || 0) === 1 ? 'song' : 'songs'}
                            </span>
                            <span class="collection-meta-item">
                                <i class="fa-solid fa-list"></i>
                                ${collection.linked_playlists?.length || 0} ${(collection.linked_playlists?.length || 0) === 1 ? 'playlist' : 'playlists'}
                            </span>
                        </div>
                        <div class="collection-actions">
                            ${isOwner ? `
                            <button class="btn-icon btn-ghost collection-link-playlist-btn" data-collection-id="${collection.id}" title="Link Spotify playlist" aria-label="Link Spotify playlist">
                                <i class="fa-brands fa-spotify"></i>
                            </button>
                            ` : ''}
                            ${collection.collaboration_requests && collection.collaboration_requests.length > 0 ? `
                            <button class="btn-icon btn-ghost collection-requests-btn" data-collection-id="${collection.id}" title="${collection.collaboration_requests.length} pending request(s)" aria-label="View collaboration requests" style="position: relative;">
                                <i class="fa-solid fa-user-plus"></i>
                                <span class="badge" style="position: absolute; top: -4px; right: -4px; background: var(--accent-primary); color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 11px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${collection.collaboration_requests.length}</span>
                            </button>
                            ` : ''}
                            ${collection.collaborators && collection.collaborators.length > 0 && isOwner ? `
                            <button class="btn-icon btn-ghost collection-collaborators-btn" data-collection-id="${collection.id}" title="${collection.collaborators.length} collaborator(s)" aria-label="Manage collaborators" style="position: relative;">
                                <i class="fa-solid fa-user-group"></i>
                                <span class="badge" style="position: absolute; top: -4px; right: -4px; background: var(--text-secondary); color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 11px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${collection.collaborators.length}</span>
                            </button>
                            ` : ''}
                            ${!isOwner && (collection.collaborators && collection.collaborators.includes(currentUserUid)) ? `
                            <button class="btn-icon btn-ghost collection-view-team-btn" data-collection-id="${collection.id}" title="View collection team" aria-label="View owner and collaborators" style="position: relative;">
                                <i class="fa-solid fa-user-group"></i>
                                <span class="badge" style="position: absolute; top: -4px; right: -4px; background: var(--text-secondary); color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 11px; display: flex; align-items: center; justify-content: center; font-weight: bold;">${(collection.collaborators.length || 0) + 1}</span>
                            </button>
                            ` : ''}
                            ${collection.is_personal ? `
                            <button class="btn-icon btn-ghost" disabled title="Cannot edit Personal Collection" aria-label="Cannot edit Personal Collection" style="opacity: 0.5; cursor: not-allowed; position: relative;">
                                <i class="fa-solid fa-gear"></i>
                                <i class="fa-solid fa-slash" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.2em;"></i>
                            </button>
                            ` : isOwner ? `
                            <button class="btn-icon btn-ghost collection-edit-btn" data-collection-id="${collection.id}" title="Edit collection" aria-label="Edit collection">
                                <i class="fa-solid fa-gear"></i>
                            </button>
                            ` : ''}
                            ${!collection.is_personal && isOwner ? `
                            <button class="btn-icon btn-ghost collection-delete-btn" data-collection-id="${collection.id}" title="Delete collection" aria-label="Delete collection">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');

        // Add click handlers for cards
        container.querySelectorAll('.collection-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't open if clicking action buttons
                if (e.target.closest('.collection-actions')) {
                    return;
                }
                const collectionId = card.dataset.collectionId;
                this.openCollection(collectionId);
            });
        });

        // Add click handlers for edit buttons
        container.querySelectorAll('.collection-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collectionId = btn.dataset.collectionId;
                this.editCollection(collectionId);
            });
        });

        // Add click handlers for delete buttons
        container.querySelectorAll('.collection-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collectionId = btn.dataset.collectionId;
                this.deleteCollection(collectionId);
            });
        });

        // Add click handlers for link playlist buttons
        container.querySelectorAll('.collection-link-playlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collectionId = btn.dataset.collectionId;
                // Call PlaylistDialogManager (will be created in Chunk 3)
                if (typeof showLinkPlaylistDialog === 'function') {
                    showLinkPlaylistDialog(collectionId);
                }
            });
        });

        // Add click handlers for collaboration requests buttons
        container.querySelectorAll('.collection-requests-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collectionId = btn.dataset.collectionId;
                this.showCollaborationRequests(collectionId);
            });
        });

        // Add click handlers for manage collaborators buttons
        container.querySelectorAll('.collection-collaborators-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collectionId = btn.dataset.collectionId;
                this.showManageCollaborators(collectionId);
            });
        });

        // Add click handlers for view team buttons (shared collections)
        container.querySelectorAll('.collection-view-team-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collectionId = btn.dataset.collectionId;
                this.showViewCollaborators(collectionId);
            });
        });
    },

    /**
     * Render public collections
     */
    renderPublicCollections(collections, containerId) {
        const container = document.getElementById(containerId);

        if (!collections || collections.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No public collections available</p>';
            return;
        }

        container.innerHTML = collections.map(collection => {
            // Get artwork from first linked playlist, or use fallback icon
            const firstPlaylist = collection.linked_playlists?.[0];
            const artworkUrl = firstPlaylist?.image_url;
            const hasArtwork = artworkUrl && artworkUrl.trim() !== '';

            return `
            <div class="collection-card card card-clickable" data-collection-id="${collection.id}">
                <div class="collection-artwork-container">
                    ${hasArtwork
                        ? `<img src="${this.escapeHtml(artworkUrl)}" alt="${this.escapeHtml(collection.name)} artwork" class="collection-artwork" loading="lazy">`
                        : `<div class="collection-artwork-placeholder">
                            <img src="/static/favicon.svg" alt="Guitar" style="width: 80%; height: 80%; opacity: 0.6;">
                           </div>`
                    }
                </div>
                <div class="collection-content">
                    <div class="collection-header">
                        <div class="collection-title-row">
                            <h3 class="collection-name">${this.escapeHtml(collection.name)}</h3>
                        </div>
                    </div>
                    <div class="collection-description-row">
                        ${collection.description ? `<p class="collection-description">${this.escapeHtml(collection.description)}</p>` : '<p class="collection-description"></p>'}
                        <div class="collection-badges">
                            <span class="collection-badge collection-badge-public"><i class="fa-solid fa-globe"></i> Public</span>
                        </div>
                    </div>
                    <div class="collection-meta-and-actions">
                        <div class="collection-meta">
                            <span class="collection-meta-item">
                                <i class="fa-solid fa-music"></i>
                                ${collection.song_count || 0} ${(collection.song_count || 0) === 1 ? 'song' : 'songs'}
                            </span>
                        </div>
                        <div class="collection-actions">
                            ${collection.access_requested
                                ? `<button class="btn btn-sm btn-secondary" disabled title="Request pending">
                                    <i class="fa-solid fa-clock"></i> Pending
                                   </button>`
                                : `<button class="btn btn-sm btn-primary request-access-btn" data-collection-id="${collection.id}" title="Request collaborator access">
                                    <i class="fa-solid fa-user-plus"></i> Request Access
                                   </button>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');

        // Add click handlers for cards (open as read-only)
        container.querySelectorAll('.collection-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't open if clicking action buttons
                if (e.target.closest('.collection-actions')) {
                    return;
                }
                const collectionId = card.dataset.collectionId;
                this.openCollection(collectionId);
            });
        });

        // Add click handlers for request access buttons
        container.querySelectorAll('.request-access-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const collectionId = btn.dataset.collectionId;
                const collection = collections.find(c => c.id === collectionId);
                this.showRequestAccessDialog(collection);
            });
        });
    },

    /**
     * Open collection (navigate to songs view)
     */
    openCollection(collectionId) {
        ViewManager.openCollection(collectionId);
    },

    /**
     * Create new collection
     */
    async createCollection() {
        const name = document.getElementById('collection-name').value.trim();
        const description = document.getElementById('collection-description').value.trim();
        const isPublic = document.getElementById('collection-public').checked;

        if (!name) {
            BPP.showToast('Please enter a collection name', 'error');
            return;
        }

        try {
            BPP.showLoading('Creating collection...');

            await BPP.apiCall('/api/v3/collections', {
                method: 'POST',
                body: JSON.stringify({ name, description, is_public: isPublic })
            });

            BPP.hideLoading();
            BPP.hideDialog('new-collection-dialog');
            BPP.showToast('Collection created!', 'success');

            // Clear form
            document.getElementById('collection-name').value = '';
            document.getElementById('collection-description').value = '';
            document.getElementById('collection-public').checked = false;

            // Reload collections
            this.loadCollections();

        } catch (error) {
            BPP.hideLoading();
            console.error('Error creating collection:', error);
        }
    },

    /**
     * Edit collection
     */
    async editCollection(collectionId) {
        try {
            // Fetch collection data
            const data = await BPP.apiCall(`/api/v3/collections/${collectionId}`);

            // Populate form
            document.getElementById('edit-collection-id').value = collectionId;
            document.getElementById('edit-collection-name').value = data.name;
            document.getElementById('edit-collection-description').value = data.description || '';
            document.getElementById('edit-collection-public').checked = data.is_public || false;

            // Show dialog
            BPP.showDialog('edit-collection-dialog');

            // Focus and select the collection name input
            setTimeout(() => {
                const nameInput = document.getElementById('edit-collection-name');
                nameInput.focus();
                nameInput.select();
            }, 100);
        } catch (error) {
            console.error('Error fetching collection:', error);
            BPP.showToast('Failed to load collection', 'error');
        }
    },

    /**
     * Save collection edits
     */
    async saveCollection() {
        const collectionId = document.getElementById('edit-collection-id').value;
        const name = document.getElementById('edit-collection-name').value.trim();
        const description = document.getElementById('edit-collection-description').value.trim();
        const isPublic = document.getElementById('edit-collection-public').checked;

        if (!name) {
            BPP.showToast('Please enter a collection name', 'error');
            return;
        }

        try {
            BPP.showLoading('Saving changes...');

            await BPP.apiCall(`/api/v3/collections/${collectionId}`, {
                method: 'PUT',
                body: JSON.stringify({ name, description, is_public: isPublic })
            });

            BPP.hideLoading();
            BPP.hideDialog('edit-collection-dialog');
            BPP.showToast('Collection updated!', 'success');

            // Reload collections
            this.loadCollections();

        } catch (error) {
            BPP.hideLoading();
            console.error('Error updating collection:', error);
            BPP.showToast('Failed to update collection', 'error');
        }
    },

    /**
     * Delete collection (show confirmation dialog)
     */
    async deleteCollection(collectionId) {
        try {
            // Fetch collection to get name
            const data = await BPP.apiCall(`/api/v3/collections/${collectionId}`);

            // Set collection name in dialog
            document.getElementById('delete-collection-id').value = collectionId;
            document.getElementById('delete-collection-name').textContent = data.name;

            // Show confirmation dialog
            BPP.showDialog('delete-collection-dialog');

            // Focus the delete button so user can hit ENTER to confirm or ESC to cancel
            setTimeout(() => {
                document.getElementById('confirm-delete-btn').focus();
            }, 100);
        } catch (error) {
            console.error('Error fetching collection:', error);
            BPP.showToast('Failed to load collection', 'error');
        }
    },

    /**
     * Confirm delete collection
     */
    async confirmDelete() {
        const collectionId = document.getElementById('delete-collection-id').value;

        try {
            BPP.showLoading('Deleting collection...');

            await BPP.apiCall(`/api/v3/collections/${collectionId}`, {
                method: 'DELETE'
            });

            BPP.hideLoading();
            BPP.hideDialog('delete-collection-dialog');
            BPP.showToast('Collection deleted', 'success');

            // Reload collections
            this.loadCollections();

        } catch (error) {
            BPP.hideLoading();
            console.error('Error deleting collection:', error);
            BPP.showToast('Failed to delete collection', 'error');
        }
    },

    /**
     * Show request access dialog
     */
    showRequestAccessDialog(collection) {
        // Store collection ID in hidden field
        document.getElementById('request-access-collection-id').value = collection.id;
        
        // Populate owner information
        const ownerInfoDiv = document.getElementById('request-access-owner-info');
        const ownerName = collection.owner_name || 'Unknown';
        const ownerEmail = collection.owner_email || '';
        const ownerPhotoUrl = collection.owner_photo_url;
        
        ownerInfoDiv.innerHTML = `
            <div class="collab-user-avatar">
                ${ownerPhotoUrl
                    ? `<img src="${this.escapeHtml(ownerPhotoUrl)}" alt="${this.escapeHtml(ownerName)}" class="avatar-img">`
                    : `<div class="avatar-placeholder">
                        <i class="fa-solid fa-user"></i>
                       </div>`
                }
            </div>
            <div class="collab-user-info">
                <div class="collab-user-text">
                    <div class="collab-user-name">${this.escapeHtml(ownerName)}</div>
                    ${ownerEmail ? `<div class="collab-user-email">${this.escapeHtml(ownerEmail)}</div>` : ''}
                </div>
                <span class="collab-badge collab-badge-owner">Owner</span>
            </div>
        `;
        
        // Show dialog
        BPP.showDialog('request-access-dialog');
        
        // Focus the confirm button so Enter works
        setTimeout(() => {
            document.getElementById('confirm-request-access-btn').focus();
        }, 100);
    },

    /**
     * Request collaboration access
     */
    async requestCollaborationAccess() {
        try {
            // Get collection ID from hidden field
            const collectionId = document.getElementById('request-access-collection-id').value;
            
            // Hide dialog first
            BPP.hideDialog('request-access-dialog');
            
            BPP.showLoading('Sending request...');

            await BPP.apiCall(`/api/v3/collections/${collectionId}/request-access`, {
                method: 'POST'
            });

            BPP.hideLoading();
            BPP.showToast('Collaboration request sent!', 'success');

            // Reload public collections to update the UI
            await this.loadPublicCollections();

        } catch (error) {
            BPP.hideLoading();
            console.error('Error requesting collaboration:', error);
            BPP.showToast(error.message || 'Failed to send request', 'error');
        }
    },

    /**
     * Show collaboration requests dialog
     */
    async showCollaborationRequests(collectionId) {
        try {
            // Fetch collection data to get requests
            const collection = await BPP.apiCall(`/api/v3/collections/${collectionId}`);
            const requests = collection.collaboration_requests || [];

            document.getElementById('collaboration-collection-id').value = collectionId;

            const requestsList = document.getElementById('collaboration-requests-list');

            if (requests.length === 0) {
                // No requests left - close the dialog
                BPP.hideDialog('collaboration-requests-dialog');
                return;
            }

            // Fetch user data for each request to get photo_url
            const requestsWithUserData = await Promise.all(requests.map(async req => {
                try {
                    const userData = await BPP.apiCall(`/api/v3/users/${req.user_uid}`);
                    return { ...req, photo_url: userData?.photo_url };
                } catch (error) {
                    console.error(`Failed to fetch user data for ${req.user_uid}:`, error);
                    return req;
                }
            }));

            requestsList.innerHTML = requestsWithUserData.map(req => `
                    <div class="collaboration-request-item">
                        <div class="collab-request-content">
                            <div class="collab-user-avatar">
                                ${req.photo_url ? 
                                    `<img src="${this.escapeHtml(req.photo_url)}" alt="${this.escapeHtml(req.user_name)}" class="avatar-img">` :
                                    `<div class="avatar-placeholder"><i class="fa-solid fa-user"></i></div>`
                                }
                            </div>
                            <div class="collab-user-info">
                                <div class="collab-user-name">${this.escapeHtml(req.user_name)}</div>
                                <div class="collab-user-email">${this.escapeHtml(req.user_email)}</div>
                                <div class="collab-request-time">${this.formatDate(req.requested_at)}</div>
                            </div>
                            <div class="collab-actions">
                                <button class="btn btn-primary accept-request-btn" data-requester-uid="${req.user_uid}" title="Accept request">
                                    <i class="fa-solid fa-check"></i> Accept
                                </button>
                                <button class="btn btn-secondary deny-request-btn" data-requester-uid="${req.user_uid}" title="Deny request">
                                    <i class="fa-solid fa-times"></i> Deny
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');

            // Add click handlers for accept/deny buttons
            requestsList.querySelectorAll('.accept-request-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const requesterUid = btn.dataset.requesterUid;
                    await this.acceptCollaborationRequest(collectionId, requesterUid);
                });
            });

            requestsList.querySelectorAll('.deny-request-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const requesterUid = btn.dataset.requesterUid;
                    await this.denyCollaborationRequest(collectionId, requesterUid);
                });
            });

            BPP.showDialog('collaboration-requests-dialog');

        } catch (error) {
            console.error('Error loading collaboration requests:', error);
            BPP.showToast('Failed to load requests', 'error');
        }
    },

    /**
     * Accept collaboration request
     */
    async acceptCollaborationRequest(collectionId, requesterUid) {
        try {
            BPP.showLoading('Accepting request...');

            await BPP.apiCall(`/api/v3/collections/${collectionId}/accept-collaborator`, {
                method: 'POST',
                body: JSON.stringify({ requester_uid: requesterUid })
            });

            BPP.hideLoading();
            BPP.showToast('Collaboration request accepted!', 'success');

            // Reload the requests dialog
            await this.showCollaborationRequests(collectionId);

            // Reload collections to update counts
            this.loadCollections();

        } catch (error) {
            BPP.hideLoading();
            console.error('Error accepting request:', error);
            BPP.showToast('Failed to accept request', 'error');
        }
    },

    /**
     * Deny collaboration request
     */
    async denyCollaborationRequest(collectionId, requesterUid) {
        try {
            BPP.showLoading('Denying request...');

            await BPP.apiCall(`/api/v3/collections/${collectionId}/deny-collaborator`, {
                method: 'POST',
                body: JSON.stringify({ requester_uid: requesterUid })
            });

            BPP.hideLoading();
            BPP.showToast('Collaboration request denied', 'success');

            // Reload the requests dialog
            await this.showCollaborationRequests(collectionId);

            // Reload collections to update counts and remove badge if no more requests
            this.loadCollections();

        } catch (error) {
            BPP.hideLoading();
            console.error('Error denying request:', error);
            BPP.showToast('Failed to deny request', 'error');
        }
    },

    /**
     * Show manage collaborators dialog
     */
    async showManageCollaborators(collectionId) {
        try {
            // Fetch collection data to get collaborators
            const collection = await BPP.apiCall(`/api/v3/collections/${collectionId}`);
            const collaborators = collection.collaborators || [];

            document.getElementById('manage-collaborators-collection-id').value = collectionId;

            const collaboratorsList = document.getElementById('collaborators-list');

            if (collaborators.length === 0) {
                collaboratorsList.innerHTML = '<p class="text-muted text-center">No collaborators</p>';
                BPP.showDialog('manage-collaborators-dialog');
                return;
            }

            // Fetch user data for each collaborator to get photo_url
            const collaboratorsWithUserData = await Promise.all(collaborators.map(async collaboratorUid => {
                try {
                    const userData = await BPP.apiCall(`/api/v3/users/${collaboratorUid}`);
                    return {
                        user_uid: collaboratorUid,
                        user_name: userData?.display_name || userData?.email || 'Unknown',
                        user_email: userData?.email || '',
                        photo_url: userData?.photo_url
                    };
                } catch (error) {
                    console.error(`Failed to fetch user data for ${collaboratorUid}:`, error);
                    return {
                        user_uid: collaboratorUid,
                        user_name: 'Unknown User',
                        user_email: '',
                        photo_url: null
                    };
                }
            }));

            collaboratorsList.innerHTML = collaboratorsWithUserData.map(collaborator => `
                    <div class="collaboration-request-item">
                        <div class="collab-request-content">
                            <div class="collab-user-avatar">
                                ${collaborator.photo_url ?
                                    `<img src="${this.escapeHtml(collaborator.photo_url)}" alt="${this.escapeHtml(collaborator.user_name)}" class="avatar-img">` :
                                    `<div class="avatar-placeholder"><i class="fa-solid fa-user"></i></div>`
                                }
                            </div>
                            <div class="collab-user-info">
                                <div class="collab-user-name">${this.escapeHtml(collaborator.user_name)}</div>
                                <div class="collab-user-email">${this.escapeHtml(collaborator.user_email)}</div>
                            </div>
                            <div class="collab-actions">
                                <button class="btn btn-danger remove-collaborator-btn" data-collaborator-uid="${collaborator.user_uid}" title="Remove collaborator">
                                    <i class="fa-solid fa-user-minus"></i> Remove
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');

            // Add click handlers for remove buttons
            collaboratorsList.querySelectorAll('.remove-collaborator-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const collaboratorUid = btn.dataset.collaboratorUid;
                    await this.removeCollaborator(collectionId, collaboratorUid);
                });
            });

            BPP.showDialog('manage-collaborators-dialog');

        } catch (error) {
            console.error('Error loading collaborators:', error);
            BPP.showToast('Failed to load collaborators', 'error');
        }
    },

    /**
     * Show view collaborators dialog (read-only for shared collections)
     */
    async showViewCollaborators(collectionId) {
        try {
            // Fetch collection data to get owner and collaborators
            const collection = await BPP.apiCall(`/api/v3/collections/${collectionId}`);
            const collaborators = collection.collaborators || [];
            const ownerUid = collection.owner_uid;

            document.getElementById('view-collaborators-collection-id').value = collectionId;

            const collaboratorsList = document.getElementById('view-collaborators-list');

            // Fetch owner data
            let ownerData = null;
            try {
                ownerData = await BPP.apiCall(`/api/v3/users/${ownerUid}`);
            } catch (error) {
                console.error(`Failed to fetch owner data for ${ownerUid}:`, error);
            }

            // Fetch user data for each collaborator
            const collaboratorsWithUserData = await Promise.all(collaborators.map(async collaboratorUid => {
                try {
                    const userData = await BPP.apiCall(`/api/v3/users/${collaboratorUid}`);
                    return {
                        user_uid: collaboratorUid,
                        user_name: userData?.display_name || userData?.email || 'Unknown',
                        user_email: userData?.email || '',
                        photo_url: userData?.photo_url
                    };
                } catch (error) {
                    console.error(`Failed to fetch user data for ${collaboratorUid}:`, error);
                    return {
                        user_uid: collaboratorUid,
                        user_name: 'Unknown User',
                        user_email: '',
                        photo_url: null
                    };
                }
            }));

            // Build HTML with owner first, then collaborators
            let html = '';

            // Owner section
            if (ownerData) {
                html += `
                    <div class="collaboration-request-item" style="border: 2px solid var(--accent-primary);">
                        <div class="collab-request-content">
                            <div class="collab-user-avatar">
                                ${ownerData.photo_url ?
                                    `<img src="${this.escapeHtml(ownerData.photo_url)}" alt="${this.escapeHtml(ownerData.display_name || ownerData.email)}" class="avatar-img">` :
                                    `<div class="avatar-placeholder"><i class="fa-solid fa-user"></i></div>`
                                }
                            </div>
                            <div class="collab-user-info">
                                <div class="collab-user-text">
                                    <div class="collab-user-name">${this.escapeHtml(ownerData.display_name || ownerData.email || 'Unknown')}</div>
                                    <div class="collab-user-email">${this.escapeHtml(ownerData.email || '')}</div>
                                </div>
                                <span class="collab-badge collab-badge-owner">Owner</span>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Collaborators section
            if (collaboratorsWithUserData.length > 0) {
                html += collaboratorsWithUserData.map(collaborator => `
                    <div class="collaboration-request-item">
                        <div class="collab-request-content">
                            <div class="collab-user-avatar">
                                ${collaborator.photo_url ?
                                    `<img src="${this.escapeHtml(collaborator.photo_url)}" alt="${this.escapeHtml(collaborator.user_name)}" class="avatar-img">` :
                                    `<div class="avatar-placeholder"><i class="fa-solid fa-user"></i></div>`
                                }
                            </div>
                            <div class="collab-user-info">
                                <div class="collab-user-text">
                                    <div class="collab-user-name">${this.escapeHtml(collaborator.user_name)}</div>
                                    <div class="collab-user-email">${this.escapeHtml(collaborator.user_email)}</div>
                                </div>
                                <span class="collab-badge collab-badge-collaborator">Collaborator</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            collaboratorsList.innerHTML = html;

            BPP.showDialog('view-collaborators-dialog');

        } catch (error) {
            console.error('Error loading collection team:', error);
            BPP.showToast('Failed to load collection team', 'error');
        }
    },

    /**
     * Remove collaborator
     */
    async removeCollaborator(collectionId, collaboratorUid) {
        try {
            const confirmed = await BPP.confirmDialog('Remove this collaborator? They will lose edit access to this collection.');
            if (!confirmed) return;

            BPP.showLoading('Removing collaborator...');

            await BPP.apiCall(`/api/v3/collections/${collectionId}/remove-collaborator`, {
                method: 'POST',
                body: JSON.stringify({ collaborator_uid: collaboratorUid })
            });

            BPP.hideLoading();
            BPP.showToast('Collaborator removed', 'success');

            // Reload the collaborators dialog
            await this.showManageCollaborators(collectionId);

            // Reload collections to update counts
            this.loadCollections();

        } catch (error) {
            BPP.hideLoading();
            console.error('Error removing collaborator:', error);
            BPP.showToast('Failed to remove collaborator', 'error');
        }
    },

    /**
     * Setup keyboard navigation for collections grid
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Don't handle if not in collections view
            const inCollectionsView = ViewManager.currentView === 'collections';

            // Don't handle if ANY dialog is open or user is typing
            const dialogOpen = BPP.isAnyDialogVisible();
            const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

            // Special case: / or ? key toggles help even if typing (but not in dialogs)
            if ((e.key === '/' || e.key === '?') && !dialogOpen && inCollectionsView) {
                e.preventDefault();
                this.toggleHelpCard();
                return;
            }

            if (!inCollectionsView || dialogOpen || isTyping) return;

            switch(e.key) {
                case 'n':
                case 'N':
                    e.preventDefault();
                    document.getElementById('new-collection-btn').click();
                    break;

                case 'e':
                case 'E':
                    e.preventDefault();
                    if (this.selectedCollectionIndex >= 0 && this.selectedCollectionIndex < this.collectionElements.length) {
                        const selectedCard = this.collectionElements[this.selectedCollectionIndex];
                        const editBtn = selectedCard.querySelector('.collection-edit-btn');
                        if (editBtn) {
                            editBtn.click();
                        }
                    }
                    break;

                case 'p':
                case 'P':
                    e.preventDefault();
                    if (this.selectedCollectionIndex >= 0 && this.selectedCollectionIndex < this.collectionElements.length) {
                        const selectedCard = this.collectionElements[this.selectedCollectionIndex];
                        const playlistBtn = selectedCard.querySelector('.collection-link-playlist-btn');
                        if (playlistBtn) {
                            playlistBtn.click();
                        }
                    }
                    break;

                case 'Delete':
                    e.preventDefault();
                    if (this.selectedCollectionIndex >= 0 && this.selectedCollectionIndex < this.collectionElements.length) {
                        const selectedCard = this.collectionElements[this.selectedCollectionIndex];
                        const deleteBtn = selectedCard.querySelector('.collection-delete-btn');
                        if (deleteBtn) {
                            deleteBtn.click();
                        } else {
                            BPP.showToast('Personal collection cannot be deleted', 'info');
                        }
                    }
                    break;

                case 'ArrowRight':
                case 'ArrowLeft':
                case 'ArrowDown':
                case 'ArrowUp':
                case 'Home':
                case 'End':
                    this.handleArrowKey(e);
                    break;

                case 'Enter':
                    e.preventDefault();
                    if (this.selectedCollectionIndex >= 0 && this.selectedCollectionIndex < this.collectionElements.length) {
                        this.collectionElements[this.selectedCollectionIndex].click();
                    }
                    break;

                case 'Escape':
                    // ESC closes help card
                    if (this.helpCardVisible) {
                        e.preventDefault();
                        this.toggleHelpCard();
                    }
                    break;
            }
        });

        // Initialize first collection as selected
        setTimeout(() => {
            this.refreshCollectionElements();
            if (this.collectionElements.length > 0) {
                this.selectedCollectionIndex = 0;
                this.updateCollectionFocus();
            }
        }, 500); // Wait for collections to load
    },

    /**
     * Handle arrow key navigation
     */
    handleArrowKey(e) {
        e.preventDefault();
        this.refreshCollectionElements();
        if (this.collectionElements.length === 0) return;

        const cols = this.getGridColumns();

        switch(e.key) {
            case 'ArrowRight':
                const currentRow = Math.floor(this.selectedCollectionIndex / cols);
                const currentCol = this.selectedCollectionIndex % cols;
                const isLastInRow = currentCol === cols - 1 || this.selectedCollectionIndex === this.collectionElements.length - 1;
                if (!isLastInRow) {
                    this.selectedCollectionIndex = Math.min(this.selectedCollectionIndex + 1, this.collectionElements.length - 1);
                }
                break;

            case 'ArrowLeft':
                const col = this.selectedCollectionIndex % cols;
                const isFirstInRow = col === 0;
                if (!isFirstInRow) {
                    this.selectedCollectionIndex = Math.max(this.selectedCollectionIndex - 1, 0);
                }
                break;

            case 'ArrowDown':
                const newIndexDown = this.selectedCollectionIndex + cols;
                if (newIndexDown < this.collectionElements.length) {
                    this.selectedCollectionIndex = newIndexDown;
                } else {
                    this.selectedCollectionIndex = this.collectionElements.length - 1;
                }
                break;

            case 'ArrowUp':
                const newIndexUp = this.selectedCollectionIndex - cols;
                if (newIndexUp >= 0) {
                    this.selectedCollectionIndex = newIndexUp;
                } else {
                    this.selectedCollectionIndex = 0;
                }
                break;

            case 'Home':
                this.selectedCollectionIndex = 0;
                break;

            case 'End':
                this.selectedCollectionIndex = this.collectionElements.length - 1;
                break;
        }

        this.updateCollectionFocus();
    },

    /**
     * Get number of grid columns
     */
    getGridColumns() {
        if (this.collectionElements.length === 0) return 1;

        const firstCard = this.collectionElements[0];
        const container = firstCard.parentElement;
        const gridCols = getComputedStyle(container).gridTemplateColumns;
        const colCount = gridCols.split(' ').length;

        return Math.max(1, colCount);
    },

    /**
     * Refresh collection elements array
     */
    refreshCollectionElements() {
        this.collectionElements = Array.from(document.querySelectorAll('.collection-card'));
    },

    /**
     * Update visual focus for selected collection
     */
    updateCollectionFocus() {
        // Remove previous focus
        this.collectionElements.forEach(el => el.classList.remove('keyboard-selected'));

        // Add focus to selected
        if (this.selectedCollectionIndex >= 0 && this.selectedCollectionIndex < this.collectionElements.length) {
            const selected = this.collectionElements[this.selectedCollectionIndex];
            selected.classList.add('keyboard-selected');
            selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    },

    /**
     * Format date helper
     */
    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    },

    /**
     * Escape HTML helper
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Export for global use
window.CollectionsManager = CollectionsManager;
