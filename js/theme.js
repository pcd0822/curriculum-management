/**
 * Theme Manager
 * Handles theme switching between Light, Dark, Tokyo Night, and Solarized Light.
 */

const themes = {
    'light': {
        '--bg-color': '#f9fafb',
        '--text-color': '#1f2937',
        '--text-muted': '#6b7280',
        '--text-highlight': '#7c3aed',
        '--card-bg': '#ffffff',
        '--border-color': '#e5e7eb',
        '--primary-color': '#8b5cf6',
        '--secondary-color': '#ec4899',
        '--header-text': '#ffffff',
        '--input-bg': '#ffffff',
        '--hover-bg': '#f3f4f6'
    },
    'dark-neon': {
        '--bg-color': '#0f172a',
        '--text-color': '#e2e8f0',
        '--text-muted': '#94a3b8',
        '--text-highlight': '#2dd4bf', // Teal neon
        '--card-bg': '#1e293b',
        '--border-color': '#334155',
        '--primary-color': '#2dd4bf',
        '--secondary-color': '#f472b6',
        '--header-text': '#0f172a',
        '--input-bg': '#334155',
        '--hover-bg': '#475569'
    },
    'tokyo-night': {
        '--bg-color': '#1a1b26',
        '--text-color': '#c0caf5',
        '--text-muted': '#565f89',
        '--text-highlight': '#7aa2f7', // Blue neon
        '--card-bg': '#24283b',
        '--border-color': '#414868',
        '--primary-color': '#7aa2f7',
        '--secondary-color': '#bb9af7',
        '--header-text': '#1a1b26',
        '--input-bg': '#292e42',
        '--hover-bg': '#414868'
    },
    'solarized-light': {
        '--bg-color': '#fdf6e3',
        '--text-color': '#657b83',
        '--text-muted': '#93a1a1',
        '--text-highlight': '#268bd2',
        '--card-bg': '#eee8d5',
        '--border-color': '#93a1a1',
        '--primary-color': '#268bd2',
        '--secondary-color': '#d33682',
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
