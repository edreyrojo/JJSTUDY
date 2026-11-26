/* Service Worker de La Fortuna Vault
 * - Navegación: red primero; si no hay conexión, sirve el shell cacheado.
 * - Assets del mismo origen: cache-first.
 * - Firebase / Drive / YouTube y cualquier petición externa: solo red.
 */
const CACHE = 'lafortuna-shell-v1';
const SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(SHELL))
            .then(() => self.skipWaiting())
            .catch(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    // Navegación: siempre intenta la red para recibir el index más reciente.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copia = response.clone();
                        caches.open(CACHE).then((cache) => cache.put('/index.html', copia));
                    }
                    return response;
                })
                .catch(async () => (
                    (await caches.match('/index.html'))
                    || (await caches.match('/'))
                    || Response.error()
                ))
        );
        return;
    }

    // Assets estáticos: cache-first con relleno en segundo plano.
    const esAsset = url.pathname.startsWith('/assets/')
        || /\.(?:png|jpe?g|svg|webp|ico|css|js|woff2?|json)$/i.test(url.pathname);
    if (!esAsset) return;

    event.respondWith(
        caches.match(request).then((cacheada) => {
            if (cacheada) return cacheada;
            return fetch(request).then((response) => {
                if (response.ok) {
                    const copia = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(request, copia));
                }
                return response;
            });
        })
    );
});
