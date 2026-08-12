'use strict';

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

    return true;
});
