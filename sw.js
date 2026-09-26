const CACHE_NAME = 'basai-shell-v1';
const APP_SHELL = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn('SW: gagal precache app shell', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Strategi: network-first untuk request ke Worker/API (agar jawaban AI selalu
// terbaru), cache-first untuk aset app-shell milik sendiri (agar tetap bisa
// dibuka saat offline).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isSameOrigin = req.url.startsWith(self.location.origin);

  if (!isSameOrigin) {
    // Panggilan ke Cloudflare Worker / CDN eksternal: biarkan lewat jaringan
    // apa adanya, jangan diintersep (penting agar streaming SSE tidak rusak).
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
