const CACHE_NAME = 'library-calendar-v4';

const PRE_CACHE_ASSETS = [
    './',
    './index.html',
    './edit.html',
    './data.json',
    './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // リソースがない場合でもエラーで止まらないように catch を追加
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

    // Viteのビルド済みアセット (/assets/配下) はファイル名にハッシュが含まれるため、不変。
    // そのため Cache First (キャッシュがあれば即返す、なければ取りに行く) 戦略を取る
    if (url.pathname.includes('/assets/')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    const cloned = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                    return networkResponse;
                }).catch(() => new Response('Network error', { status: 408 }));
            })
        );
        return;
    }

    // HTML、JSON等は内容が変わる可能性がある。
    // Stale-While-Revalidate 戦略を取る（キャッシュがあれば即座に返し、バックグラウンドで更新）
    // これにより、電波が弱い環境でも起動や画面遷移が一瞬で完了するようになる。
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                const cloned = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                return networkResponse;
            }).catch(() => {
                // ネットワークエラー時は何もしない（キャッシュがあればそれが返されている）
            });
            return cachedResponse || fetchPromise;
        })
    );
});
