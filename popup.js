// update the active platform as soon as the popup DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab && tab.url) {
            const url = new URL(tab.url);
            const hostname = url.hostname;

            // Detect platform
            const platformResult = PlatformDetector.getCurrentPlatform(hostname);

            if (platformResult) {
                console.log('Active platform:', platformResult.config.name);
                updateActivePlatformBadge(platformResult.config.platformBadgeIdSelector);
            } else {
                console.log('No supported platform detected');
            }
        }
    } catch (error) {
        console.error('Error detecting platform:', error);
    }
});

// Function to update the active platform badge in the popup UI
function updateActivePlatformBadge(platformBadgeSelector) {
    // Remove active class from all badges
    const allBadges = document.querySelectorAll('.platform-badge');
    allBadges.forEach(badge => badge.classList.remove('active'));

    // Add active class to the current platform badge
    if (platformBadgeSelector) {
        const activeBadge = document.getElementById(platformBadgeSelector);

        if (activeBadge) {
            activeBadge.classList.add('active');
        }
    }
}