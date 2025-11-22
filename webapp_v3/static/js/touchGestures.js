/**
 * Touch Gestures Module
 * Handles swipe gestures and touch interactions for mobile/tablet devices
 */

const TouchGestures = {
    touchStartX: 0,
    touchStartY: 0,
    touchEndX: 0,
    touchEndY: 0,
    minSwipeDistance: 50,
    swipeThreshold: 30, // degrees from horizontal for swipe detection

    init() {
        console.log('📱 Initializing touch gestures...');
        this.setupPlayerSwipes();
        this.setupMobileOptimizations();
    },

    setupPlayerSwipes() {
        const playerView = document.getElementById('player-view');
        if (!playerView) return;

        playerView.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        playerView.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.touchEndY = e.changedTouches[0].screenY;
            this.handlePlayerSwipe();
        }, { passive: true });
    },

    handlePlayerSwipe() {
        const diffX = this.touchEndX - this.touchStartX;
        const diffY = this.touchEndY - this.touchStartY;
        const absDiffX = Math.abs(diffX);
        const absDiffY = Math.abs(diffY);

        // Check if it's a horizontal swipe (not vertical scroll)
        if (absDiffX > this.minSwipeDistance && absDiffX > absDiffY * 2) {
            if (diffX > 0) {
                // Swipe right - previous song
                console.log('👉 Swipe right - Previous song');
                if (window.PlayerManager) {
                    window.PlayerManager.previousSong();
                }
            } else {
                // Swipe left - next song
                console.log('👈 Swipe left - Next song');
                if (window.PlayerManager) {
                    window.PlayerManager.nextSong();
                }
            }
        }
    },

    setupMobileOptimizations() {
        // Detect if touch device
        const isTouchDevice = ('ontouchstart' in window) || 
                             (navigator.maxTouchPoints > 0) || 
                             (navigator.msMaxTouchPoints > 0);

        if (isTouchDevice) {
            document.body.classList.add('touch-device');
            console.log('📱 Touch device detected');
            
            // Add mobile-specific UI enhancements
            this.addMobileNavigationButtons();
        }
    },

    addMobileNavigationButtons() {
        // Only show navigation buttons on mobile/tablet
        if (window.innerWidth <= 1024) {
            const playerView = document.getElementById('player-view');
            if (!playerView) return;

            // Add floating navigation buttons for mobile
            const navButtons = document.createElement('div');
            navButtons.className = 'mobile-nav-buttons';
            navButtons.innerHTML = `
                <button class="mobile-nav-btn mobile-nav-prev" onclick="PlayerManager.previousSong()" title="Previous Song">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                <button class="mobile-nav-btn mobile-nav-next" onclick="PlayerManager.nextSong()" title="Next Song">
                    <i class="fa-solid fa-chevron-right"></i>
                </button>
            `;
            
            const existingButtons = playerView.querySelector('.mobile-nav-buttons');
            if (!existingButtons) {
                playerView.appendChild(navButtons);
            }
        }
    }
};

// Export for use in main app
window.TouchGestures = TouchGestures;
