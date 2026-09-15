/* MAYA Garden Pro — PWA: rede primeiro no código, cache só como fallback */
const V = 'maya-v9';
const CORE = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png',
  './maya-garden-logo.jpg', './maya-garden-logo.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  if (u.pathname.endsWith('/sw.js')) return;

  const isAppCode =
    e.request.mode === 'navigate' ||
    /\/(index\.html|404\.html|diagnostico\.html|(styles|fallback)\.css|(store|cloud|pricing|pdf|app|pro|mobile-pdf)\.js|(gsap|jspdf\.umd)\.js|manifest\.json)(\?|$)/.test(u.pathname + u.search);

  if (isAppCode) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r && r.ok) {
          const cp = r.clone();
          caches.open(V).then(c => c.put(e.request, cp)).catch(() => {});
        }
        return r;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r && r.ok) {
        const cp = r.clone();
        caches.open(V).then(c => c.put(e.request, cp)).catch(() => {});
      }
      return r;
    }).catch(() => caches.match('./index.html')))
  );
});
