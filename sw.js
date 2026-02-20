const CACHE_NAME = 'library-calendar-v3';

// Static assets that we know exist and want to cache immediately
const PRE_CACHE_ASSETS = [
    './',
    'index.html'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRE_CACHE_ASSETS);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests and browser extensions
    if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) return;

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Update cache for successful responses
                    if (networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // If network fails and no cache, return a fallback if needed
                    return cachedResponse;
                });

                // Return cached response immediately if available, otherwise wait for network
                return cachedResponse || fetchPromise;
            });
        })
    );
});
