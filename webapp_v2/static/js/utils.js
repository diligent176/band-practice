// Utility functions for Band Practice Pro

// Debounce: limits how often a function can fire
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Throttle: executes at most once per interval
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Escape HTML for safe rendering
export function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/[&<>"]+/g, function(match) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;'
        };
        return map[match];
    });
}
