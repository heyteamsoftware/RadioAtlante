// Service Worker de Radio Atlante — SOLO cachea el "shell" estático de la app
// (HTML/CSS/JS/iconos) para que se pueda instalar como PWA y abra rápido.
//
// A propósito NUNCA intercepta ni cachea:
//   - /api/*        (login, programas, estado del directo, subidas)
//   - /stream       (el audio en directo de Icecast)
//   - /media/*      (los MP3 on-demand)
//   - /covers/*     (portadas, pueden cambiar)
//   - /admin/*      (panel de administración, siempre en vivo)
// Así nos aseguramos de que nada de esto se sirva nunca "cacheado" ni afecte
// al directo o a los datos.

const CACHE_NAME = 'radio-atlante-shell-v2';
const SCOPE = self.registration.scope;

const SHELL_FILES = [
  './',
  './index.html',
  './assets/css/style.css?v=5',
  './assets/js/app.js?v=5',
  './assets/img/favicon.svg',
  './assets/img/default-cover.svg',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

function isExcluded(url) {
  return (
    url.pathname.includes('/api/') ||
    url.pathname.includes('/admin/') ||
    url.pathname.endsWith('/stream') ||
    url.pathname.includes('/media/') ||
    url.pathname.includes('/covers/') ||
    url.pathname.includes('/tmp_uploads/')
  );
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin || isExcluded(url)) {
    return; // deja pasar directo a la red, sin tocar el service worker
  }

  // Cache-first para el shell estático, con fallback a red y actualización
  // silenciosa en segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
