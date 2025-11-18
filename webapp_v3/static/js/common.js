/**
 * Band Practice Pro v3 - Common JavaScript Utilities
 * Reusable functions for dialogs, keyboard handling, API calls, etc.
 */

/* ============================================================================
   DIALOG UTILITIES
   ============================================================================ */

/**
 * Show a dialog
 * @param {string} dialogId - ID of the dialog element
 */
function showDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (!dialog) {
    console.error(`Dialog not found: ${dialogId}`);
    return;
  }
  dialog.classList.remove('hidden');

  // Focus first input if exists
  const firstInput = dialog.querySelector('input, textarea, select');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }

  // Setup click-outside-to-close handler (unless it's a delete confirmation dialog)
  const isDeleteDialog = dialogId.includes('delete');
  if (!isDeleteDialog) {
    setupClickOutsideHandler(dialogId);
  }
}

/**
 * Setup click outside to close dialog
 * @param {string} dialogId - ID of the dialog element
 */
function setupClickOutsideHandler(dialogId) {
  const dialogOverlay = document.getElementById(dialogId);
  if (!dialogOverlay) return;

  // Remove any existing handler
  dialogOverlay.removeEventListener('click', handleOutsideClick);

  // Add new handler
  function handleOutsideClick(event) {
    // Only close if clicking the overlay itself (not the dialog content)
    if (event.target === dialogOverlay) {
      hideDialog(dialogId);
    }
  }

  dialogOverlay.addEventListener('click', handleOutsideClick);
}

/**
 * Hide a dialog
 * @param {string} dialogId - ID of the dialog element
 */
function hideDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (!dialog) {
    console.error(`Dialog not found: ${dialogId}`);
    return;
  }
  dialog.classList.add('hidden');
}

/**
 * Create a simple confirmation dialog
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>} - True if confirmed, false if cancelled
 */
function confirmDialog(message) {
  return new Promise((resolve) => {
    // For now, use native confirm - we can enhance this later
    resolve(confirm(message));
  });
}

/* ============================================================================
   KEYBOARD UTILITIES
   ============================================================================ */

/**
 * Keyboard handler with support for common shortcuts
 * @param {KeyboardEvent} event - Keyboard event
 * @param {Object} handlers - Map of key combinations to handler functions
 */
function handleKeyboard(event, handlers) {
  const key = event.key.toLowerCase();
  const ctrl = event.ctrlKey || event.metaKey;
  const shift = event.shiftKey;
  const alt = event.altKey;

  // Build key combination string
  let combination = '';
  if (ctrl) combination += 'ctrl+';
  if (shift) combination += 'shift+';
  if (alt) combination += 'alt+';
  combination += key;

  // Check if handler exists for this combination
  if (handlers[combination]) {
    event.preventDefault();
    handlers[combination](event);
    return true;
  }

  // Check for simple key (no modifiers)
  if (!ctrl && !shift && !alt && handlers[key]) {
    event.preventDefault();
    handlers[key](event);
    return true;
  }

  return false;
}

/**
 * Add escape key handler to close dialog
 * @param {string} dialogId - ID of the dialog to close on escape
 */
function addEscapeHandler(dialogId) {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideDialog(dialogId);
    }
  });
}

/* ============================================================================
   API UTILITIES
   ============================================================================ */

/**
 * Make an authenticated API call
 * @param {string} endpoint - API endpoint (e.g., '/api/v3/collections')
 * @param {Object} options - Fetch options (method, body, etc.)
 * @returns {Promise<Object>} - JSON response
 */
async function apiCall(endpoint, options = {}) {
  try {
    // Get Firebase ID token if user is authenticated
    let idToken = null;
    if (window.currentUser) {
      idToken = await window.currentUser.getIdToken();
    }

    // Build headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    // Make request
    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    // Handle errors
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    // Return JSON response
    return await response.json();

  } catch (error) {
    console.error(`API call failed: ${endpoint}`, error);
    showToast(error.message, 'error');
    throw error;
  }
}

/* ============================================================================
   TOAST NOTIFICATIONS
   ============================================================================ */

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, info, warning)
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  // Add to container
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  container.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add('toast-show'), 10);

  // Remove after duration
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ============================================================================
   LOADING INDICATORS
   ============================================================================ */

/**
 * Show global loading indicator
 * @param {string} message - Optional loading message
 */
function showLoading(message = 'Loading...') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <p class="loading-text">${message}</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  overlay.classList.remove('hidden');
}

/**
 * Hide global loading indicator
 */
function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}

/* ============================================================================
   LIST NAVIGATION
   ============================================================================ */

/**
 * Navigate a list with keyboard (up/down/enter)
 * @param {Array} items - Array of items to navigate
 * @param {number} selectedIndex - Currently selected index
 * @param {string} direction - Direction to move ('up', 'down', 'pageup', 'pagedown', 'home', 'end')
 * @param {number} pageSize - Number of items per page (default: 10)
 * @returns {number} - New selected index
 */
function navigateList(items, selectedIndex, direction, pageSize = 10) {
  const maxIndex = items.length - 1;
  let newIndex = selectedIndex;

  switch (direction) {
    case 'up':
      newIndex = Math.max(0, selectedIndex - 1);
      break;
    case 'down':
      newIndex = Math.min(maxIndex, selectedIndex + 1);
      break;
    case 'pageup':
      newIndex = Math.max(0, selectedIndex - pageSize);
      break;
    case 'pagedown':
      newIndex = Math.min(maxIndex, selectedIndex + pageSize);
      break;
    case 'home':
      newIndex = 0;
      break;
    case 'end':
      newIndex = maxIndex;
      break;
  }

  return newIndex;
}

/**
 * Scroll element into view if needed
 * @param {HTMLElement} element - Element to scroll into view
 */
function scrollIntoViewIfNeeded(element) {
  if (!element) return;

  const rect = element.getBoundingClientRect();
  const isVisible = (
    rect.top >= 0 &&
    rect.bottom <= window.innerHeight
  );

  if (!isVisible) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* ============================================================================
   DEBOUNCE & THROTTLE
   ============================================================================ */

/**
 * Debounce function - delays execution until after wait time
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - limits execution to once per wait time
 * @param {Function} func - Function to throttle
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Throttled function
 */
function throttle(func, wait) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, wait);
    }
  };
}

/* ============================================================================
   EXPORTS (for use in other modules)
   ============================================================================ */
window.BPP = {
  // Dialog utilities
  showDialog,
  hideDialog,
  confirmDialog,
  addEscapeHandler,

  // Keyboard utilities
  handleKeyboard,

  // API utilities
  apiCall,

  // Toast notifications
  showToast,

  // Loading indicators
  showLoading,
  hideLoading,

  // List navigation
  navigateList,
  scrollIntoViewIfNeeded,

  // Debounce & throttle
  debounce,
  throttle
};
