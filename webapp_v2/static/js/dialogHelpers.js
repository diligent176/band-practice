// dialogHelpers.js
// Shared dialog keyboard handler registration/removal for Band Practice Pro

// Event listener registration tracking (prevents duplicates)
export const eventListenerFlags = {
    songSelector: false,
    notesEditor: false,
    lyricsEditor: false,
    bpmDialog: false,
    bpmTapDialog: false,
    importDialog: false,
    confirmDialog: false,
    collectionDialog: false,
    newCollectionDialog: false,
    editCollectionDialog: false,
    userListDialog: false
};

// Register dialog-level keyboard handler (prevents duplicate listeners)
export function registerDialogKeyboardHandler(flagKey, handler) {
    if (!eventListenerFlags[flagKey]) {
        document.addEventListener('keydown', handler);
        eventListenerFlags[flagKey] = true;
    }
}

// Unregister dialog-level keyboard handler
export function unregisterDialogKeyboardHandler(flagKey, handler) {
    if (eventListenerFlags[flagKey]) {
        document.removeEventListener('keydown', handler);
        eventListenerFlags[flagKey] = false;
    }
}
