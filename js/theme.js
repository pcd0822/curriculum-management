/**
 * Theme Manager
 * Handles theme switching between Light, Dark, Tokyo Night, and Solarized Light.
 */

const themes = {
    'light': {
        '--bg-color': '#f9fafb',
        '--text-color': '#1f2937',
        '--card-bg': '#ffffff',
        '--border-color': '#e5e7eb',
        '--primary-color': '#9f7ee7',
        '--secondary-color': '#f33358',
        '--header-text': '#ffffff',
        '--input-bg': '#ffffff',
        '--hover-bg': '#f3f4f6'
    },
    'dark-neon': {
        '--bg-color': '#0f172a', // Very dark slate
        '--text-color': '#e2e8f0', // Light slate
        '--card-bg': '#1e293b', // Dark slate
        '--border-color': '#334155', // Slate border
        '--primary-color': '#2dd4bf', // Teal-400 (Neon-ish)
        '--secondary-color': '#f472b6', // Pink-400 (Neon-ish)
        '--header-text': '#ffffff',
        '--input-bg': '#1e293b',
        '--hover-bg': '#334155'
    },
    'tokyo-night': {
        '--bg-color': '#1a1b26',
        '--text-color': '#a9b1d6',
        '--card-bg': '#24283b',
        '--border-color': '#414868',
        '--primary-color': '#7aa2f7',
        '--secondary-color': '#f7768e',
        '--header-text': '#ffffff',
        '--input-bg': '#24283b',
        '--hover-bg': '#2f3549'
    },
    'solarized-light': {
        '--bg-color': '#fdf6e3',
        '--text-color': '#657b83',
        '--card-bg': '#eee8d5',
        '--border-color': '#93a1a1',
        '--primary-color': '#268bd2',
        '--secondary-color': '#dc322f',
        '--header-text': '#ffffff',
        '--input-bg': '#fdf6e3',
        '--hover-bg': '#e6dfc4'
    }
};

function applyTheme(themeName) {
    const theme = themes[themeName] || themes['light'];
    const root = document.documentElement;

    for (const [property, value] of Object.entries(theme)) {
        root.style.setProperty(property, value);
    }

    // Save preference
    localStorage.setItem('theme', themeName);

    // Update dropdown if exists
    const selector = document.getElementById('theme-selector');
    if (selector) selector.value = themeName;
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    const selector = document.getElementById('theme-selector');
    if (selector) {
        selector.value = savedTheme;
        selector.addEventListener('change', (e) => applyTheme(e.target.value));
    }
}

// Export for module usage if needed, or just attach to window
window.ThemeManager = {
    init: initTheme,
    apply: applyTheme
};

// Auto-init if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}
