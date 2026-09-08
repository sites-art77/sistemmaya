/* MAYA Garden Pro — offline básico (cache dos arquivos do app) */
const V = 'maya-v4';
const CORE = ['./', './index.html', './404.html', './css/styles.css', './js/store.js', './js/pricing.js', './js/pdf.js', './js/app.js', './js/pro.js', './js/vendor/gsap.min.js', './js/vendor/jspdf.umd.min.js', './assets/maya-garden-logo.jpg', './assets/maya-garden-logo.svg', './assets/icon-192.png', './assets/icon-512.png', './manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => {})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  // código do app: rede primeiro (sempre a versão nova); vendor/imagens: cache primeiro
  const isAppCode = /\/(index\.html|404\.html|css\/styles\.css|js\/(store|pricing|pdf|app|pro)\.js|manifest\.json|sw\.js)(\?|$)/.test(u.pathname + u.search) || e.request.mode === 'navigate';
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
