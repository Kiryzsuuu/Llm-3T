const CACHE_NAME = 'belajar-3t-cache-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        message: 'Tidak ada koneksi internet. AI Tutor membutuhkan koneksi ke server.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/materi')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith('/api/progress')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith('/api/ai')) {
    event.respondWith(networkOnly(request));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets (HTML, CSS, JS, icons)
  event.respondWith(cacheFirst(request));
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    event.waitUntil(syncProgressKeServer());
  }
});

async function syncProgressKeServer() {
  const clientsList = await self.clients.matchAll({ type: 'window' });

  try {
    const response = await fetch('/api/sync-trigger', { method: 'POST' }).catch(() => null);

    clientsList.forEach((client) => {
      client.postMessage({ type: 'SYNC_PROGRESS_REQUEST' });
    });

    return response;
  } catch (err) {
    clientsList.forEach((client) => {
      client.postMessage({ type: 'SYNC_PROGRESS_FAILED', error: err.message });
    });
  }
}
