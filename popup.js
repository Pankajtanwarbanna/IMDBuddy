'use strict';

const PLATFORMS = [
    { key: 'hotstar', label: 'Hotstar', hostnames: ['hotstar.com'] },
    { key: 'disneyplus', label: 'Disney+', hostnames: ['disneyplus.com'] },
    { key: 'netflix', label: 'Netflix', hostnames: ['netflix.com'] },
    { key: 'prime', label: 'Prime Video', hostnames: ['primevideo.com'] }
];

function matchPlatform(hostname) {
    if (!hostname) return null;
    return PLATFORMS.find(p => p.hostnames.some(h => hostname.endsWith(h))) || null;
}

function render(matched) {
    const badges = document.querySelectorAll('.platform-badge');
    badges.forEach(badge => {
        const isMatch = matched && badge.dataset.platform === matched.key;
        badge.classList.toggle('active', Boolean(isMatch));
    });
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    let hostname = null;
    try {
        hostname = tab?.url ? new URL(tab.url).hostname : null;
    } catch (_) {
        hostname = null;
    }
    render(matchPlatform(hostname));
});
