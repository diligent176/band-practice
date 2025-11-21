/**
 * Spotify Web Playback SDK Integration
 * Enables unlimited users to play Spotify music in the browser
 *
 * Features:
 * - OAuth authentication per user
 * - Spotify Premium required
 * - Full playback control in browser
 * - No 25-user quota limit
 */

const SpotifyPlayer = {
    // Spotify Web Playback SDK
    player: null,
    deviceId: null,
    accessToken: null,
    isReady: false,
    isPremium: false,

    // Playback state
    currentTrackUri: null,
    isPlaying: false,
    volume: 0.5,
    position: 0,
    duration: 0,

    // State polling interval
    stateUpdateInterval: null,

    // Initialization
    async init() {
        console.log('🎵 Initializing Spotify Player...');

        // Check if user has connected Spotify
        const hasToken = await this.checkSpotifyConnection();

        if (hasToken) {
            // Load SDK and initialize player
            await this.loadSDK();
        } else {
            // Show connection prompt
            this.showConnectPrompt();
        }
    },

    async checkSpotifyConnection() {
        try {
            // Use fetch directly to avoid showing error toast for 404
            let idToken = null;
            if (window.currentUser) {
                idToken = await window.currentUser.getIdToken();
            }

            const response = await fetch('/api/v3/spotify/token', {
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.accessToken = data.access_token;
                console.log('✅ Spotify token retrieved');
                return true;
            } else {
                // 404 is expected when user hasn't connected Spotify
                console.log('ℹ️ Spotify not connected');
                return false;
            }
        } catch (error) {
            console.log('ℹ️ Spotify connection check failed:', error);
            return false;
        }
    },

    showConnectPrompt() {
        // Check if user has a Spotify URI in current song
        if (PlayerManager.currentSong?.spotify_uri) {
            BPP.showToast('Connect Spotify to play music', 'info');
        }
    },

    async connectSpotify() {
        try {
            // Get OAuth URL from backend
            const response = await BPP.apiCall('/api/v3/spotify/auth-url');
            const authUrl = response.auth_url;

            // Open popup for OAuth
            const popup = window.open(
                authUrl,
                'Spotify Login',
                'width=500,height=700,left=100,top=100'
            );

            // Listen for callback message
            const messageHandler = async (event) => {
                // Security: verify origin if needed
                if (event.data.type === 'spotify-connected') {
                    window.removeEventListener('message', messageHandler);

                    this.isPremium = event.data.isPremium;

                    if (!this.isPremium) {
                        BPP.showToast('Spotify Premium required for playback', 'warning');
                        return;
                    }

                    BPP.showToast('Spotify connected!', 'success');

                    // Wait a moment for token to be saved in backend, then reload SDK
                    setTimeout(async () => {
                        await this.init();
                    }, 500);

                } else if (event.data.type === 'spotify-error') {
                    window.removeEventListener('message', messageHandler);
                    BPP.showToast('Failed to connect Spotify', 'error');
                }
            };

            window.addEventListener('message', messageHandler);

        } catch (error) {
            console.error('Spotify connection error:', error);
            BPP.showToast('Failed to connect Spotify', 'error');
        }
    },

    async disconnectSpotify() {
        try {
            await BPP.apiCall('/api/v3/spotify/disconnect', { method: 'POST' });

            // Cleanup player
            if (this.player) {
                this.player.disconnect();
                this.player = null;
            }

            this.isReady = false;
            this.accessToken = null;
            this.deviceId = null;

            BPP.showToast('Spotify disconnected', 'info');

        } catch (error) {
            console.error('Disconnect error:', error);
            BPP.showToast('Failed to disconnect', 'error');
        }
    },

    async loadSDK() {
        return new Promise((resolve) => {
            // Check if SDK already loaded
            if (window.Spotify) {
                this.initializePlayer();
                resolve();
                return;
            }

            // Load Spotify Web Playback SDK
            const script = document.createElement('script');
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.async = true;
            document.body.appendChild(script);

            // SDK calls this global callback when ready
            window.onSpotifyWebPlaybackSDKReady = () => {
                console.log('✅ Spotify SDK loaded');
                this.initializePlayer();
                resolve();
            };
        });
    },

    initializePlayer() {
        console.log('🎵 Initializing Spotify Web Playback Player...');

        this.player = new Spotify.Player({
            name: 'Band Practice Pro',
            getOAuthToken: cb => {
                // Provide access token to SDK
                cb(this.accessToken);
            },
            volume: this.volume
        });

        // Ready event - get device ID
        this.player.addListener('ready', ({ device_id }) => {
            console.log('✅ Spotify Player ready! Device ID:', device_id);
            this.deviceId = device_id;
            this.isReady = true;
            
            // Hide connection prompt if showing
            if (window.PlayerManager) {
                window.PlayerManager.hideSpotifyConnectPrompt();
            }

            // Start polling player state for progress updates
            this.startStatePolling();
        });

        // Not ready event
        this.player.addListener('not_ready', ({ device_id }) => {
            console.log('⚠️ Spotify Player offline:', device_id);
            this.isReady = false;
        });

        // Player state changed
        this.player.addListener('player_state_changed', state => {
            if (!state) return;

            console.log('📻 Playback state changed:', state);

            // Update internal state
            this.isPlaying = !state.paused;
            this.position = state.position;
            this.duration = state.duration;

            // Update PlayerManager UI if available
            if (window.PlayerManager) {
                window.PlayerManager.updatePlayButton(!state.paused);
                window.PlayerManager.updateProgress(state.position, state.duration);
            }
        });

        // Error handling
        this.player.addListener('initialization_error', ({ message }) => {
            console.error('Initialization Error:', message);
            BPP.showToast('Spotify initialization failed', 'error');
        });

        this.player.addListener('authentication_error', ({ message }) => {
            console.error('Authentication Error:', message);
            BPP.showToast('Spotify authentication failed', 'error');
            // Token may be expired, try to refresh
            this.refreshToken();
        });

        this.player.addListener('account_error', ({ message }) => {
            console.error('Account Error:', message);
            BPP.showToast('Spotify Premium required', 'error');
        });

        this.player.addListener('playback_error', ({ message }) => {
            console.error('Playback Error:', message);
            BPP.showToast('Playback failed', 'error');
        });

        // Connect player
        this.player.connect();
    },

    async refreshToken() {
        try {
            const response = await BPP.apiCall('/api/v3/spotify/token');
            this.accessToken = response.access_token;
            console.log('✅ Spotify token refreshed');
        } catch (error) {
            console.error('Token refresh error:', error);
        }
    },

    // Playback control methods

    async loadTrack(spotifyUri) {
        if (!this.isReady) {
            console.warn('Spotify player not ready, cannot load track');
            return false;
        }

        if (!spotifyUri) {
            console.error('No Spotify URI provided');
            return false;
        }

        try {
            console.log('📀 Loading track (paused):', spotifyUri);

            // Use Spotify Web API to load track on our device
            const response = await fetch(
                `https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        uris: [spotifyUri],
                        position_ms: 0
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to load track: ${response.status}`);
            }

            // Wait a tiny bit for track to start loading, then pause immediately
            await new Promise(resolve => setTimeout(resolve, 100));
            await this.player.pause();

            this.currentTrackUri = spotifyUri;
            this.isPlaying = false;
            
            console.log('✅ Track loaded and paused');
            return true;

        } catch (error) {
            console.error('Load track error:', error);
            return false;
        }
    },

    async play(spotifyUri) {
        if (!this.isReady) {
            BPP.showToast('Spotify player not ready', 'warning');
            return false;
        }

        if (!spotifyUri) {
            console.error('No Spotify URI provided');
            return false;
        }

        try {
            console.log('▶️ Playing:', spotifyUri);

            // Use Spotify Web API to start playback on our device
            const response = await fetch(
                `https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        uris: [spotifyUri]
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Playback failed: ${response.status}`);
            }

            this.currentTrackUri = spotifyUri;
            this.isPlaying = true;
            return true;

        } catch (error) {
            console.error('Playback error:', error);
            BPP.showToast('Failed to start playback', 'error');
            return false;
        }
    },

    async pause() {
        if (!this.player) return;

        try {
            await this.player.pause();
            this.isPlaying = false;
            console.log('⏸️ Paused');
        } catch (error) {
            console.error('Pause error:', error);
        }
    },

    async resume() {
        if (!this.player) return;

        try {
            await this.player.resume();
            this.isPlaying = true;
            console.log('▶️ Resumed');
        } catch (error) {
            console.error('Resume error:', error);
        }
    },

    async togglePlayPause() {
        if (!this.player) return;

        try {
            await this.player.togglePlay();
            this.isPlaying = !this.isPlaying;
            console.log(this.isPlaying ? '▶️ Playing' : '⏸️ Paused');
        } catch (error) {
            console.error('Toggle error:', error);
        }
    },

    async seek(positionMs) {
        if (!this.player) return;

        try {
            await this.player.seek(positionMs);
            this.position = positionMs;
            console.log(`⏩ Seeked to ${positionMs}ms`);
        } catch (error) {
            console.error('Seek error:', error);
        }
    },

    async setVolume(volume) {
        if (!this.player) return;

        // Volume range: 0.0 to 1.0
        const clampedVolume = Math.max(0, Math.min(1, volume));

        try {
            await this.player.setVolume(clampedVolume);
            this.volume = clampedVolume;
            console.log(`🔊 Volume: ${Math.round(clampedVolume * 100)}%`);
        } catch (error) {
            console.error('Volume error:', error);
        }
    },

    async nextTrack() {
        if (!this.player) return;

        try {
            await this.player.nextTrack();
            console.log('⏭️ Next track');
        } catch (error) {
            console.error('Next track error:', error);
        }
    },

    async previousTrack() {
        if (!this.player) return;

        try {
            await this.player.previousTrack();
            console.log('⏮️ Previous track');
        } catch (error) {
            console.error('Previous track error:', error);
        }
    },

    async getCurrentState() {
        if (!this.player) return null;

        try {
            return await this.player.getCurrentState();
        } catch (error) {
            console.error('Get state error:', error);
            return null;
        }
    },

    // Fallback for non-Premium users or when SDK fails
    openInSpotifyApp(spotifyUri) {
        if (!spotifyUri) return;

        console.log('🔗 Opening in Spotify app:', spotifyUri);

        // Extract track ID from URI (spotify:track:xxx)
        const trackId = spotifyUri.split(':')[2];

        // Try native app first
        window.location.href = spotifyUri;

        // Fallback to web player after 1 second
        setTimeout(() => {
            window.open(`https://open.spotify.com/track/${trackId}`, '_blank');
        }, 1000);
    },

    // State polling for smooth progress updates
    startStatePolling() {
        // Clear existing interval
        if (this.stateUpdateInterval) {
            clearInterval(this.stateUpdateInterval);
        }

        // Poll player state every 1000ms (1 second) for progress updates
        // Reduced from 500ms to minimize CPU usage and DOM manipulation
        this.stateUpdateInterval = setInterval(async () => {
            if (!this.player || !this.isReady) return;

            const state = await this.player.getCurrentState();
            if (state && window.PlayerManager) {
                // Update position and duration
                this.position = state.position;
                this.duration = state.duration;
                this.isPlaying = !state.paused;

                // Update UI
                window.PlayerManager.updateProgress(state.position, state.duration);
            }
        }, 1000);
    },

    stopStatePolling() {
        if (this.stateUpdateInterval) {
            clearInterval(this.stateUpdateInterval);
            this.stateUpdateInterval = null;
        }
    }
};

// Export for global use
window.SpotifyPlayer = SpotifyPlayer;

