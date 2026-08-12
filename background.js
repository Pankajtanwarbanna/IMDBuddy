'use strict';

// Background service worker.
// Chrome exempts background/service-worker fetches from CORS enforcement
// when the target origin is declared in manifest.json's host_permissions.
// Content scripts run in the page's origin and do NOT get that exemption,
// which is why the IMDb suggestion endpoint (locked to imdb.com's own
// origin) works fine when called from here but gets blocked by CORS when
// called directly from content.js.

const SUGGESTION_API_URL = 'https://v3.sg.media-imdb.com/suggestion';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'IMDBUDDY_FETCH_SUGGESTION') {
        return false;
    }

    (async () => {
        try {
            const { firstChar, title } = message;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(
                `${SUGGESTION_API_URL}/${encodeURIComponent(firstChar)}/${encodeURIComponent(title)}.json`,
                {
                    method: 'GET',
                    signal: controller.signal,
                    headers: {
                        Accept: 'application/json'
                    }
                }
            );

            clearTimeout(timeoutId);

            sendResponse({
                ok: response.ok,
                status: response.status,
                data: response.ok ? await response.json() : null
            });
        } catch (error) {
            sendResponse({ ok: false, status: 0, error: String(error) });
        }
    })();

    return true; // keep the message channel open for the async response
});
