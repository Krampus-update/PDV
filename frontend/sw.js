const CACHE_NAME = 'pdv-static-v2';
const STATIC_ASSETS = [
  '/',
  '/acesso.html',
  '/painel.html',
  '/garcom.html',
  '/producao.html',
  '/gerente.html',
  '/dev.html',
  '/admin.html',
  '/css/global.css',
  '/js/api.js',
  '/js/common.js',
  '/js/auth-guard.js',
  '/js/painel.js',
  '/js/garcom.js',
  '/js/producao.js',
  '/js/gerente.js',
  '/js/dev.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => null)
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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/acesso.html')));
    return;
  }
  event.respondWith(
    fetch(req)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => null);
        return resp;
      })
      .catch(() => caches.match(req))
  );
});
