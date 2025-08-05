// Universal Streaming IMDB Ratings Extension - Platform Agnostic Architecture
(() => {
    'use strict';

    // Base Configuration
    const BASE_CONFIG = {
        REQUEST_DELAY: 110, // Slightly over 100ms to stay safely under 10 req/sec
        STORAGE_KEY: 'imdb_cache',
        MIN_MATCH_SCORE: 0.7,
        OBSERVER_DELAY: 3000,
        API_URL: 'https://api.imdbapi.dev/search/titles',
        CACHE_MAX_AGE: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
        MAX_CONCURRENT_REQUESTS: 5 // Allow multiple requests in parallel
    };

    // Storage Module
    const Storage = {
        async get(key) {
            try {
                const result = await chrome.storage.local.get([key]);
                return result[key] ? JSON.parse(result[key]) : {};
            } catch {
                return {};
            }
        },

        async set(key, data) {
            try {
                await chrome.storage.local.set({ [key]: JSON.stringify(data) });
            } catch (error) {
                console.error('Storage error:', error);
            }
        }
    };

    // Title Extractor Module - Platform Agnostic
    const TitleExtractor = {
        extract(element, platformConfig) {
            const result = platformConfig.extractTitle(element, platformConfig.titleSelectors);
            // Debug logging for all platforms when extraction fails
            if (!result) {
                const hostname = window.location.hostname;
                console.log(`Title extraction failed for ${hostname}:`, element);
                if (hostname.includes('hotstar.com') || hostname.includes('disneyplus.com')) {
                    console.log('=== HOTSTAR DEBUG INFO ===');
                    console.log('Available aria-label elements:', element.querySelectorAll('[aria-label]'));
                    console.log('Available img elements with alt:', element.querySelectorAll('img[alt]'));
                    console.log('Available elements with title attr:', element.querySelectorAll('[title]'));
                    console.log('Available h3/h4 elements:', element.querySelectorAll('h3, h4'));
                    console.log('Available a elements with aria-label:', element.querySelectorAll('a[aria-label]'));
                    // Log all text content
                    const allElements = element.querySelectorAll('*');
                    console.log('All elements with text content:');
                    allElements.forEach(el => {
                        const text = el.textContent?.trim();
                        if (text && text.length > 2 && text.length < 100) {
                            console.log(`${el.tagName}: "${text}"`);
                        }
                        if (el.hasAttribute('aria-label')) {
                            console.log(`${el.tagName} aria-label: "${el.getAttribute('aria-label')}"`);
                        }
                        if (el.hasAttribute('alt')) {
                            console.log(`${el.tagName} alt: "${el.getAttribute('alt')}"`);
                        }
                        if (el.hasAttribute('title')) {
                            console.log(`${el.tagName} title: "${el.getAttribute('title')}"`);
                        }
                    });
                    console.log('=== END HOTSTAR DEBUG ===');
                } else if (hostname.includes('netflix.com')) {
                    console.log('Available aria-label links:', element.querySelectorAll('a[aria-label]'));
                    console.log('Available fallback text:', element.querySelectorAll('.fallback-text'));
                }
            }
            return result;
        }
    };

    // Fuzzy Matcher Module
    const FuzzyMatcher = {
        getSimilarity(str1, str2) {
            const s1 = this.normalize(str1);
            const s2 = this.normalize(str2);

            if (s1 === s2) return 1.0;

            return (
                this.levenshteinSimilarity(s1, s2) * 0.3 +
                this.jaroSimilarity(s1, s2) * 0.3 +
                this.substringScore(s1, s2) * 0.2 +
                this.wordOverlapScore(s1, s2) * 0.2
            );
        },

        normalize(str) {
            return str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
        },

        levenshteinSimilarity(s1, s2) {
            const maxLen = Math.max(s1.length, s2.length);
            if (maxLen === 0) return 1.0;
            return 1 - (this.levenshteinDistance(s1, s2) / maxLen);
        },

        levenshteinDistance(s1, s2) {
            const matrix = Array(s2.length + 1).fill().map(() => Array(s1.length + 1).fill(0));

            for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
            for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

            for (let j = 1; j <= s2.length; j++) {
                for (let i = 1; i <= s1.length; i++) {
                    const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
                    matrix[j][i] = Math.min(
                        matrix[j - 1][i] + 1,
                        matrix[j][i - 1] + 1,
                        matrix[j - 1][i - 1] + cost
                    );
                }
            }
            return matrix[s2.length][s1.length];
        },

        jaroSimilarity(s1, s2) {
            if (s1.length === 0 && s2.length === 0) return 1.0;
            if (s1.length === 0 || s2.length === 0) return 0.0;

            const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
            const s1Matches = new Array(s1.length).fill(false);
            const s2Matches = new Array(s2.length).fill(false);
            let matches = 0;

            for (let i = 0; i < s1.length; i++) {
                const start = Math.max(0, i - matchWindow);
                const end = Math.min(i + matchWindow + 1, s2.length);

                for (let j = start; j < end; j++) {
                    if (s2Matches[j] || s1[i] !== s2[j]) continue;
                    s1Matches[i] = s2Matches[j] = true;
                    matches++;
                    break;
                }
            }

            if (matches === 0) return 0.0;

            let transpositions = 0;
            let k = 0;
            for (let i = 0; i < s1.length; i++) {
                if (!s1Matches[i]) continue;
                while (!s2Matches[k]) k++;
                if (s1[i] !== s2[k]) transpositions++;
                k++;
            }

            return (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
        },

        substringScore(s1, s2) {
            const [longer, shorter] = s1.length > s2.length ? [s1, s2] : [s2, s1];
            if (longer.includes(shorter)) return 0.8;

            let maxLen = 0;
            for (let i = 0; i < shorter.length; i++) {
                for (let j = i + 1; j <= shorter.length; j++) {
                    const substr = shorter.substring(i, j);
                    if (longer.includes(substr) && substr.length > maxLen) {
                        maxLen = substr.length;
                    }
                }
            }
            return maxLen / Math.max(s1.length, s2.length);
        },

        wordOverlapScore(s1, s2) {
            const words1 = new Set(s1.split(' ').filter(w => w.length > 1));
            const words2 = new Set(s2.split(' ').filter(w => w.length > 1));

            if (words1.size === 0 && words2.size === 0) return 1.0;
            if (words1.size === 0 || words2.size === 0) return 0.0;

            const intersection = new Set([...words1].filter(w => words2.has(w)));
            return intersection.size / new Set([...words1, ...words2]).size;
        },

        findBestMatch(searchTitle, results, expectedType = null) {
            let filteredResults = results;

            if (expectedType) {
                const typeFiltered = results.filter(result => {
                    const resultType = result.titleType?.toLowerCase() || result.type?.toLowerCase();
                    return resultType === expectedType;
                });
                if (typeFiltered.length > 0) filteredResults = typeFiltered;
            }

            let bestMatch = null;
            let bestScore = 0;

            for (const result of filteredResults) {
                const title = result.primaryTitle || result.title || '';
                const score = this.getSimilarity(searchTitle, title);
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { result, score };
                }
            }

            return bestScore >= BASE_CONFIG.MIN_MATCH_SCORE ? bestMatch : null;
        }
    };

    // API Service Module
    const ApiService = {
        cache: {},
        requestQueue: [],
        activeRequests: 0,
        lastRequestTime: 0,
        requestTimes: [], // Track recent request times for better rate limiting

        async init() {
            this.cache = await Storage.get(BASE_CONFIG.STORAGE_KEY);
            await this.cleanExpiredEntries();
        },

        async cleanExpiredEntries() {
            const now = Date.now();
            let hasExpiredEntries = false;

            for (const [key, entry] of Object.entries(this.cache)) {
                if (!entry.timestamp || (now - entry.timestamp) > BASE_CONFIG.CACHE_MAX_AGE) {
                    delete this.cache[key];
                    hasExpiredEntries = true;
                }
            }

            if (hasExpiredEntries) {
                await this.saveCache();
            }
        },

        isCacheEntryValid(entry) {
            if (!entry || !entry.timestamp) return false;
            return (Date.now() - entry.timestamp) <= BASE_CONFIG.CACHE_MAX_AGE;
        },

        async clearCache() {
            this.cache = {};
            await Storage.set(BASE_CONFIG.STORAGE_KEY, {});
        },

        async getRating(titleData) {
            const { title, type } = titleData;
            const cacheKey = `${title}${type ? `_${type}` : ''}`;

            // Check if cache entry exists and is still valid
            if (this.cache[cacheKey] && this.isCacheEntryValid(this.cache[cacheKey])) {
                return this.cache[cacheKey].data;
            }

            // Remove expired entry if it exists
            if (this.cache[cacheKey] && !this.isCacheEntryValid(this.cache[cacheKey])) {
                delete this.cache[cacheKey];
            }

            return new Promise((resolve) => {
                this.requestQueue.push({ title, type, cacheKey, resolve });
                this.processQueue();
            });
        },

        async processQueue() {
            // Process multiple requests concurrently up to the limit
            while (this.requestQueue.length > 0 && this.activeRequests < BASE_CONFIG.MAX_CONCURRENT_REQUESTS) {
                const requestData = this.requestQueue.shift();
                // Don't await here - let it run concurrently
                this.processRequest(requestData);
            }
        },

        async processRequest({ title, type, cacheKey, resolve }) {
            this.activeRequests++;
            try {
                await this.waitForRateLimit();
                const rating = await this.fetchFromApi(title, type, cacheKey);
                resolve(rating);
            } catch (error) {
                console.error('Error processing request:', error);
                resolve(null);
            } finally {
                this.activeRequests--;
                // Process more requests if queue has items
                if (this.requestQueue.length > 0) {
                    // Use a small delay to prevent stack overflow
                    setTimeout(() => this.processQueue(), 10);
                }
            }
        },

        async waitForRateLimit() {
            const now = Date.now();
            // Clean old request times (older than 1 second)
            this.requestTimes = this.requestTimes.filter(time => now - time < 1000);
            // If we have 9 or more requests in the last second, wait
            if (this.requestTimes.length >= 9) {
                const oldestRequest = Math.min(...this.requestTimes);
                const waitTime = 1000 - (now - oldestRequest) + 10; // +10ms buffer
                if (waitTime > 0) {
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }

            // Record this request time
            this.requestTimes.push(Date.now());
        },

        async fetchFromApi(title, expectedType, cacheKey, retryCount = 0) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

                const response = await fetch(
                    `${BASE_CONFIG.API_URL}?query=${encodeURIComponent(title)}`,
                    {
                        method: 'GET',
                        signal: controller.signal,
                        headers: {
                            'Accept': 'application/json'
                        }
                    }
                );
                clearTimeout(timeoutId);

                // Handle rate limiting with exponential backoff
                if (response.status === 429) {
                    if (retryCount < 2) {
                        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return this.fetchFromApi(title, expectedType, cacheKey, retryCount + 1);
                    }
                    return null;
                }

                if (!response.ok || response.status === 499) return null;

                const data = await response.json();
                if (data?.titles?.length > 0) {
                    const bestMatch = FuzzyMatcher.findBestMatch(title, data.titles, expectedType);

                    if (bestMatch && bestMatch.result.rating?.aggregateRating > 0) {
                        const rating = {
                            score: bestMatch.result.rating.aggregateRating.toFixed(1),
                            votes: this.formatVotes(bestMatch.result.rating.voteCount || 0),
                            confidence: bestMatch.score.toFixed(2),
                            matchedTitle: bestMatch.result.primaryTitle || bestMatch.result.title,
                            type: bestMatch.result.titleType || bestMatch.result.type
                        };

                        // Store with timestamp for cache expiration
                        this.cache[cacheKey] = {
                            data: rating,
                            timestamp: Date.now()
                        };
                        // Save cache asynchronously to not block the request
                        this.saveCache();
                        return rating;
                    }
                }
            } catch (error) {
                // Retry on network errors (but not on abort)
                if (error.name !== 'AbortError' && retryCount < 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    return this.fetchFromApi(title, expectedType, cacheKey, retryCount + 1);
                }
            }
            return null;
        },

        formatVotes(votes) {
            if (votes >= 1000000) return (votes / 1000000).toFixed(1) + 'M';
            if (votes >= 1000) return (votes / 1000).toFixed(1) + 'K';
            return votes.toString();
        },

        async saveCache() {
            await Storage.set(BASE_CONFIG.STORAGE_KEY, this.cache);
        }
    };

    // Overlay Module - Platform Agnostic
    const Overlay = {
        create(rating) {
            const overlay = document.createElement('div');
            overlay.className = 'imdb-rating-overlay';
            overlay.innerHTML = `
                <div class="imdb-rating-content">
                    <div class="imdb-logo">IMDb</div>
                    <div class="imdb-rating-score">${rating.score}</div>
                    <div class="imdb-votes">${rating.votes}</div>
                </div>
            `;
            return overlay;
        },

        addTo(element, overlay, platformConfig) {
            const container = this.findContainer(element, platformConfig);
            if (container) {
                container.style.position = 'relative';
                container.appendChild(overlay);
                // Debug logging for all platforms
                const hostname = window.location.hostname;
                if (hostname.includes('hotstar.com') || hostname.includes('disneyplus.com')) {
                    console.log('Added overlay to Hotstar container:', container);
                } else if (hostname.includes('netflix.com')) {
                    console.log('Added overlay to Netflix container:', container);
                }
            } else {
                const hostname = window.location.hostname;
                console.log(`No container found for overlay on ${hostname}:`, element);
            }
        },

        findContainer(element, platformConfig) {
            for (const selector of platformConfig.imageContainerSelectors) {
                const container = element.querySelector(selector);
                if (container) return container;
            }
            return element.querySelector('img')?.parentElement || element;
        }
    };

    // Main Application - Platform Agnostic
    const StreamingRatings = {
        processedElements: new WeakSet(),
        debounceTimer: null,
        platform: null,

        async init() {
            const hostname = window.location.hostname;
            this.platform = window.PlatformDetector.getCurrentPlatform(hostname);
            if (!this.platform) {
                console.log('Unsupported streaming platform');
                return;
            }

            console.log(`IMDB Ratings Extension initialized for ${this.platform.config.name}`);
            await ApiService.init();
            this.setupObserver();
            setTimeout(() => this.processExistingCards(), BASE_CONFIG.OBSERVER_DELAY);
        },

        setupObserver() {
            const observer = new MutationObserver(() => {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => this.processExistingCards(), 1000);
            });

            observer.observe(document.body, { childList: true, subtree: true });
        },

        async processExistingCards() {
            const cards = this.findCards();
            const cardBatch = [];
            const processedTitles = new Set(); // Track processed titles to avoid duplicates
            for (const card of cards) {
                if (this.processedElements.has(card)) continue;

                const titleData = TitleExtractor.extract(card, this.platform.config);
                if (!titleData) continue;

                // Create a unique key for this title + element combination
                const titleKey = `${titleData.title}_${titleData.type || 'unknown'}`;
                if (processedTitles.has(titleKey)) {
                    console.log(`Skipping duplicate title: ${titleData.title}`);
                    continue;
                }
                processedTitles.add(titleKey);
                this.processedElements.add(card);
                cardBatch.push({ card, titleData });
            }
            // Process cards in batch for better performance
            this.processBatch(cardBatch);
        },

        processBatch(cardBatch) {
            // Process all cards without waiting for each one individually
            cardBatch.forEach(({ card, titleData }) => {
                this.processCard(card, titleData);
            });
        },

        findCards() {
            const cards = [];
            const hostname = window.location.hostname;
            for (const selector of this.platform.config.cardSelectors) {
                const foundCards = document.querySelectorAll(selector);
                cards.push(...foundCards);
                // Debug logging for all platforms
                if (foundCards.length > 0) {
                    if (hostname.includes('hotstar.com') || hostname.includes('disneyplus.com')) {
                        console.log(`Found ${foundCards.length} Hotstar cards with selector: ${selector}`);
                    } else if (hostname.includes('netflix.com')) {
                        console.log(`Found ${foundCards.length} Netflix cards with selector: ${selector}`);
                    }
                }
            }
            const filteredCards = cards.filter(card => !card.querySelector('.imdb-rating-overlay'));
            console.log(`${hostname} - Total cards found: ${cards.length}, After filtering: ${filteredCards.length}`);
            return filteredCards;
        },

        async processCard(element, titleData) {
            try {
                console.log('Processing card with title data:', titleData);
                const rating = await ApiService.getRating(titleData);
                console.log('Received rating:', rating);
                if (rating) {
                    const overlay = Overlay.create(rating);
                    Overlay.addTo(element, overlay, this.platform.config);
                } else {
                    console.log('No rating received for:', titleData.title);
                }
            } catch (error) {
                console.error('Error processing card:', error, titleData);
            }
        },

        clearCache() {
            return ApiService.clearCache();
        },

        // Public API for adding new platforms
        addPlatform(key, config) {
            window.PLATFORM_CONFIGS[key] = config;
        }
    };

    // Initialize Extension
    function initializeExtension() {
        const hostname = window.location.hostname;
        const platform = window.PlatformDetector.getCurrentPlatform(hostname);
        if (platform) {
            StreamingRatings.init();
            window.streamingRatings = StreamingRatings;
        }
    }

    // Message listener for popup communication
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'CLEAR_CACHE' && window.streamingRatings) {
            window.streamingRatings.clearCache();
            sendResponse({ success: true });
        }
    });

    // Start extension
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeExtension);
    } else {
        initializeExtension();
    }
})();