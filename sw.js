/* MAYA Garden Pro — offline básico (cache dos arquivos do app) */
const V = 'maya-v7';
const CORE = ['./', './index.html', './404.html', './diagnostico.html', './styles.css', './fallback.css', './store.js', './cloud.js', './pricing.js', './pdf.js', './app.js', './pro.js', './gsap.min.js', './jspdf.umd.min.js', './maya-garden-logo.jpg', './maya-garden-logo.svg', './icon-192.png', './icon-512.png', './manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => {})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  // código do app: rede primeiro (sempre a versão nova); vendor/imagens: cache primeiro
  const isAppCode = /\/(index\.html|404\.html|diagnostico\.html|(styles|fallback)\.css|(store|cloud|pricing|pdf|app|pro)\.js|(gsap|jspdf\.umd)\.js|manifest\.json|sw\.js)(\?|$)/.test(u.pathname + u.search) || e.request.mode === 'navigate';
  if (isAppCode) {
    e.respondWith(fetch(e.request).then(r => {
      const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)).catch(() => {});
    return r;
  }).catch(() => caches.match('./index.html'))));
});
