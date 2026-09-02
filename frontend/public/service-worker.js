const CACHE_NAME = 'edunusa-cache-v2';
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
        message: 'Tidak ada koneksi internet. EduNusa membutuhkan koneksi ke server.',
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

  // File di /assets/ dinamai Vite pakai hash isinya (mis. index-D-Wilvsj.js) - namanya SENDIRI
  // berubah kalau isinya berubah, jadi aman di-cache agresif (cache-first).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Shell HTML (index.html, "/", dan semua route SPA seperti "/murid/dashboard" yang server-nya
  // balas dengan index.html juga) - HARUS network-first, bukan cache-first. Sebelumnya semua
  // static request (termasuk shell HTML ini) pakai cache-first, jadi begitu ada deploy baru,
  // service worker tetap keras kepala menyajikan index.html LAMA dari cache-nya sendiri - tidak
  // peduli header Cache-Control apa pun yang dikirim server - dan baru "sembuh" lewat hard
  // refresh manual yang memaksa lewati service worker. Network-first di sini menjamin versi
  // terbaru langsung terlihat begitu online, dan tetap fallback ke cache kalau offline.
  event.respondWith(networkFirst(request));
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
