// uiHelpers.js
// Shared UI helper functions for Band Practice Pro

// Shared helper for dialog background click-to-close
export function registerDialogBackgroundClose(dialog, closeHandler) {
    if (dialog) {
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) closeHandler();
        });
    }
}

// Shared helper for registering button event listeners
export function registerButtonListeners(pairs) {
    pairs.forEach(([btn, handler]) => {
        if (btn) btn.addEventListener('click', handler);
    });
}
