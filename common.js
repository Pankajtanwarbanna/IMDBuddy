// Shared Platform Detection Module
// Platform-Specific Configurations
const PLATFORM_CONFIGS = {
    hotstar: {
        name: 'Hotstar',
        hostnames: ['hotstar.com', 'disneyplus.com'],
        cardSelectors: ['.swiper-slide', '.tray-vertical-card', '[data-horizontal-card-container-width]'],
        titleSelectors: ['[aria-label]', 'img[alt]', '[title]', 'a[aria-label]'],
        imageContainerSelectors: ['[data-testid="hs-image"]', '.rQ_gfJEdoJGvLVb_rKLtL', 'img', '.image-container'],
        platformBadgeIdSelector: "platform-badge-hotstar",
        extractTitle: (element, selectors) => {
            // Try all possible selectors for title extraction
            const allPossibleSelectors = [
                '[aria-label]',
                // 'a[aria-label]', 
                'img[alt]',
                // '[title]',
                // 'h3',
                // 'h4',
                // '.title',
                // '[data-testid*="title"]'
            ];

            const foundTitles = new Set(); // Track found titles to avoid duplicates

            for (const selector of allPossibleSelectors) {
                const elements = element.querySelectorAll(selector);

                for (const el of elements) {
                    let title = '';

                    // Try different ways to get the title
                    if (el.hasAttribute('aria-label')) {
                        title = el.getAttribute('aria-label');
                    } else if (el.hasAttribute('alt')) {
                        title = el.getAttribute('alt');
                    } else if (el.hasAttribute('title')) {
                        title = el.getAttribute('title');
                    } else {
                        title = el.textContent?.trim();
                    }

                    if (!title) continue;

                    // Skip generic/non-title content
                    if (title.length < 2 ||
                        title.toLowerCase().includes('image') ||
                        title.toLowerCase().includes('logo') ||
                        title.toLowerCase().includes('icon')) {
                        continue;
                    }

                    // Normalize title for duplicate checking
                    const normalizedTitle = title.toLowerCase().trim();
                    if (foundTitles.has(normalizedTitle)) {
                        continue; // Skip if we've already found this title
                    }

                    foundTitles.add(normalizedTitle);

                    // Parse Hotstar format: "Title, Type" or just "Title"
                    const parts = title.split(',').map(s => s.trim());
                    const mainTitle = parts[0];
                    const typeHint = parts[1];

                    if (mainTitle.length > 0) {
                        return {
                            title: mainTitle,
                            type: typeHint?.toLowerCase() === 'movie' ? 'movie' :
                                typeHint?.toLowerCase() === 'show' ? 'tvSeries' : null
                        };
                    }
                }
            }
            return null;
        }
    },

    netflix: {
        name: 'Netflix',
        hostnames: ['netflix.com'],
        cardSelectors: ['.slider-item', '.title-card', '.gallery-item', '.title-card-container'],
        titleSelectors: ['a[aria-label]', '.fallback-text', '[aria-label]'],
        imageContainerSelectors: ['.boxart-container', '.title-card-container'],
        platformBadgeIdSelector: "platform-badge-netflix",
        extractTitle: (element, selectors) => {
            // Try aria-label from link first (most reliable)
            const linkWithAriaLabel = element.querySelector('a[aria-label]');
            if (linkWithAriaLabel) {
                const ariaLabel = linkWithAriaLabel.getAttribute('aria-label')?.trim();
                if (ariaLabel) {
                    return {
                        title: ariaLabel.split('•')[0].trim(), // Netflix sometimes uses "Title • Year" format
                        type: null // Netflix doesn't clearly distinguish in DOM
                    };
                }
            }

            // Fallback to other selectors
            for (const selector of selectors) {
                const el = element.querySelector(selector);
                if (!el) continue;

                let title = el.textContent?.trim();
                if (!title && el.hasAttribute('aria-label')) {
                    title = el.getAttribute('aria-label')?.trim();
                }

                if (!title) continue;

                return {
                    title: title.split('•')[0].trim(), // Netflix format: "Title • Year"
                    type: null // Netflix doesn't clearly distinguish in DOM
                };
            }
            return null;
        }
    },

    prime: {
        name: 'Prime Video',
        hostnames: ['primevideo.com'],
        cardSelectors: ['.tst-hover-container', '.av-card-container'],
        titleSelectors: ['[data-automation-id="title"]', '.av-card-title'],
        imageContainerSelectors: ['.av-card-image', '.tst-packshot-image'],
        platformBadgeIdSelector: "platform-badge-primevideo",
        extractTitle: (element, selectors) => {
            // Prime Video-specific title extraction logic (to be implemented)
            for (const selector of selectors) {
                const el = element.querySelector(selector);
                if (!el) continue;

                const title = el.textContent?.trim() || el.getAttribute('title')?.trim();
                if (!title) continue;

                return { title, type: null };
            }
            return null;
        }
    }
};

// Platform Detection
const PlatformDetector = {
    getCurrentPlatform(hostname = window.location.hostname) {
        for (const [key, config] of Object.entries(PLATFORM_CONFIGS)) {
            if (config.hostnames.some(host => hostname.includes(host))) {
                return { key, config };
            }
        }
        return null;
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { PLATFORM_CONFIGS, PlatformDetector };
} else {
    // Browser environment - make available globally
    window.PLATFORM_CONFIGS = PLATFORM_CONFIGS;
    window.PlatformDetector = PlatformDetector;
}