/**
 * Simple Grid Navigator
 * Handles arrow key navigation for any grid of items
 */
class GridNavigator {
    constructor(containerSelector, itemSelector) {
        this.containerSelector = containerSelector;
        this.itemSelector = itemSelector;
        this.selectedIndex = 0;
    }

    /**
     * Get all items in the grid
     */
    getItems() {
        const container = document.querySelector(this.containerSelector);
        if (!container) return [];
        return Array.from(container.querySelectorAll(this.itemSelector));
    }

    /**
     * Get number of columns in the grid
     */
    getColumns() {
        const items = this.getItems();
        if (items.length === 0) return 1;

        const container = document.querySelector(this.containerSelector);
        if (!container) return 1;

        const gridCols = getComputedStyle(container).gridTemplateColumns;
        const colCount = gridCols.split(' ').filter(col => col !== 'auto').length;
        return Math.max(1, colCount);
    }

    /**
     * Handle arrow key navigation
     * @param {string} key - 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'
     * @returns {boolean} - true if navigation happened
     */
    navigate(key) {
        const items = this.getItems();
        if (items.length === 0) return false;

        // Ensure valid index
        if (this.selectedIndex < 0 || this.selectedIndex >= items.length) {
            this.selectedIndex = 0;
        }

        const cols = this.getColumns();
        let newIndex = this.selectedIndex;

        switch(key) {
            case 'ArrowRight':
                newIndex++;
                if (newIndex >= items.length) {
                    newIndex = items.length - 1; // Stay at last
                }
                break;

            case 'ArrowLeft':
                newIndex--;
                if (newIndex < 0) {
                    newIndex = 0; // Stay at first
                }
                break;

            case 'ArrowDown':
                newIndex += cols;
                if (newIndex >= items.length) {
                    // Wrap to end
                    newIndex = items.length - 1;
                }
                break;

            case 'ArrowUp':
                newIndex -= cols;
                if (newIndex < 0) {
                    // Wrap to beginning
                    newIndex = 0;
                }
                break;

            case 'Home':
                newIndex = 0;
                break;

            case 'End':
                newIndex = items.length - 1;
                break;

            default:
                return false;
        }

        if (newIndex !== this.selectedIndex) {
            this.selectedIndex = newIndex;
            this.updateFocus();
            return true;
        }

        return false;
    }

    /**
     * Update visual focus on selected item
     */
    updateFocus() {
        const items = this.getItems();
        
        // Remove all focus
        items.forEach(item => item.classList.remove('keyboard-selected'));

        // Add focus to selected
        if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
            const selected = items[this.selectedIndex];
            selected.classList.add('keyboard-selected');
            selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    /**
     * Get currently selected item
     */
    getSelected() {
        const items = this.getItems();
        return items[this.selectedIndex] || null;
    }

    /**
     * Reset to first item
     */
    reset() {
        this.selectedIndex = 0;
        this.updateFocus();
    }
}
