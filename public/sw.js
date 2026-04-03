const CACHE_NAME = 'library-calendar-v6';

const PRE_CACHE_ASSETS = [
    './',
    './index.html',
    './edit.html',
    './data.json',
    './manifest.webmanifest',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRE_CACHE_ASSETS).catch(console.error);
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

    if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) return;

    // Google Fonts などの外部リソース
    if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then((networkResponse) => {
                    const cloned = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                    return networkResponse;
                });
            })
        );
        return;
    }

    // Viteのビルド済みアセット (/assets/配下)
    if (url.pathname.includes('/assets/')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(event.request).then((networkResponse) => {
                    const cloned = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                    return networkResponse;
                }).catch(() => new Response('Network error', { status: 408 }));
            })
        );
        return;
    }

    // HTML、JSON等 (Stale-While-Revalidate)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                const cloned = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                return networkResponse;
            }).catch(() => {});
            return cachedResponse || fetchPromise;
        })
    );
});
