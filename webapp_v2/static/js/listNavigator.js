/**
 * Reusable List Keyboard Navigation System
 * Provides smooth, consistent keyboard navigation for list-based dialogs
 *
 * Features:
 * - Arrow keys: Navigate up/down with smooth scrolling
 * - Page Up/Down: Jump by page increments
 * - Home/End: Jump to first/last item
 * - Enter: Select current item
 * - Maintains focus on search input while navigating
 */

class ListNavigator {
    constructor(config) {
        this.listContainer = config.listContainer;  // The scrollable container with items
        this.itemSelector = config.itemSelector || '.selector-item';  // CSS selector for items
        this.selectedClass = config.selectedClass || 'selected';  // Class to mark selected item
        this.searchInput = config.searchInput;  // Optional search input to keep focused
        this.onSelect = config.onSelect;  // Callback when Enter is pressed: (index, item) => {}
        this.onEscape = config.onEscape;  // Callback when Escape is pressed
        this.pageSize = config.pageSize || 10;  // Items to jump with Page Up/Down

        this.currentIndex = -1;
        this.scrollTimer = null;
    }

    /**
     * Initialize the navigator - call when dialog opens
     */
    init() {
        this.scrollToTop();
        if (this.searchInput) {
            this.searchInput.focus();
        }

        // Auto-select first item
        const items = this.getItems();
        if (items.length > 0) {
            this.currentIndex = 0;
            this.updateSelection(items);
        } else {
            this.currentIndex = -1;
        }
    }

    /**
     * Scroll list to top position
     */
    scrollToTop() {
        if (this.listContainer) {
            this.listContainer.scrollTop = 0;
        }
    }

    /**
     * Get all items in the list
     */
    getItems() {
        return Array.from(this.listContainer.querySelectorAll(this.itemSelector));
    }

    /**
     * Handle keyboard events
     * Call this from your dialog's keyboard handler
     */
    handleKey(e) {
        const items = this.getItems();
        if (items.length === 0) return false;

        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.moveDown(items);
                return true;

            case 'ArrowUp':
                e.preventDefault();
                this.moveUp(items);
                return true;

            case 'PageDown':
                e.preventDefault();
                this.moveByPage(items, 1);
                return true;

            case 'PageUp':
                e.preventDefault();
                this.moveByPage(items, -1);
                return true;

            case 'Home':
                e.preventDefault();
                this.moveToFirst(items);
                return true;

            case 'End':
                e.preventDefault();
                this.moveToLast(items);
                return true;

            case 'Enter':
                e.preventDefault();
                if (this.currentIndex >= 0 && this.currentIndex < items.length) {
                    if (this.onSelect) {
                        this.onSelect(this.currentIndex, items[this.currentIndex]);
                    }
                }
                return true;

            case 'Escape':
                e.preventDefault();
                if (this.onEscape) {
                    this.onEscape();
                }
                return true;
        }

        return false;
    }

    /**
     * Move selection down by one
     */
    moveDown(items) {
        if (this.currentIndex < items.length - 1) {
            this.currentIndex++;
            this.updateSelection(items);
        }
    }

    /**
     * Move selection up by one
     */
    moveUp(items) {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateSelection(items);
        } else if (this.currentIndex === -1 && items.length > 0) {
            this.currentIndex = 0;
            this.updateSelection(items);
        }
    }

    /**
     * Calculate how many items fit in the visible viewport
     */
    calculateVisiblePageSize(items) {
        if (items.length === 0) return 10;

        // Get the visible height of the container
        const containerHeight = this.listContainer.clientHeight;

        // Get the height of a single item (use first item as reference)
        const itemHeight = items[0].offsetHeight;

        // Calculate how many items fit in the viewport
        const itemsPerPage = Math.floor(containerHeight / itemHeight);

        // Return at least 1, typically will be 5-15 depending on item height and container size
        return Math.max(1, itemsPerPage);
    }

    /**
     * Move selection by page increment (positive or negative)
     * delta: +1 for Page Down, -1 for Page Up
     */
    moveByPage(items, delta) {
        // Calculate dynamic page size based on visible viewport
        const pageSize = this.calculateVisiblePageSize(items);

        // If no current selection, start from top or bottom
        if (this.currentIndex === -1) {
            this.currentIndex = delta > 0 ? 0 : items.length - 1;
        } else {
            // Jump by the visible page size
            this.currentIndex += (delta * pageSize);
        }

        // Clamp to valid range
        this.currentIndex = Math.max(0, Math.min(items.length - 1, this.currentIndex));
        this.updateSelection(items);
    }

    /**
     * Jump to first item
     */
    moveToFirst(items) {
        if (items.length > 0) {
            this.currentIndex = 0;
            this.updateSelection(items);
        }
    }

    /**
     * Jump to last item
     */
    moveToLast(items) {
        if (items.length > 0) {
            this.currentIndex = items.length - 1;
            this.updateSelection(items);
        }
    }

    /**
     * Update visual selection and scroll into view
     */
    updateSelection(items) {
        // Clear all selections
        items.forEach(item => item.classList.remove(this.selectedClass));

        // Set new selection
        if (this.currentIndex >= 0 && this.currentIndex < items.length) {
            const selectedItem = items[this.currentIndex];
            selectedItem.classList.add(this.selectedClass);

            // Smooth scrolling with debounce for holding down arrow keys
            this.smoothScrollToItem(selectedItem);
        }

        // Keep focus on search input so user can keep typing
        if (this.searchInput && document.activeElement !== this.searchInput) {
            this.searchInput.focus();
        }
    }

    /**
     * Smooth scroll to item with debouncing for rapid navigation
     */
    smoothScrollToItem(item) {
        // Clear any pending scroll
        if (this.scrollTimer) {
            clearTimeout(this.scrollTimer);
        }

        // Instant scroll first for immediate feedback
        item.scrollIntoView({ behavior: 'instant', block: 'nearest' });

        // Then smooth scroll after a short delay if user stops navigating
        this.scrollTimer = setTimeout(() => {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }

    /**
     * Reset selection index (call when list content changes)
     */
    reset() {
        this.currentIndex = -1;
        const items = this.getItems();
        items.forEach(item => item.classList.remove(this.selectedClass));
    }

    /**
     * Get current selected index
     */
    getSelectedIndex() {
        return this.currentIndex;
    }

    /**
     * Set selected index programmatically
     */
    setSelectedIndex(index) {
        const items = this.getItems();
        if (index >= 0 && index < items.length) {
            this.currentIndex = index;
            this.updateSelection(items);
        }
    }
}

// Export for use in other modules
window.ListNavigator = ListNavigator;
