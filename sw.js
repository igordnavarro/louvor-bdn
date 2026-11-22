// Cache simples para funcionar offline (ex.: igreja sem internet)
const CACHE = 'worship-church-v26';
const PADS = 'worship-church-pads';   // pads ficam guardados à parte (baixados ao tocar ou em Configurações)
const FILES = ['./', 'index.html', 'config.js?v=26', 'songs.js?v=26', 'app.js?v=26', 'manifest.webmanifest', 'icon.svg?v=2', 'icon-32.png?v=2', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png?v=2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== PADS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin && /\/pads\/[^/]+\.m4a$/.test(url.pathname)) {
    // pads: do aparelho primeiro; se não tiver, baixa e guarda
    e.respondWith(caches.open(PADS).then(c => c.match(url.pathname.replace(/^.*\/pads\//, 'pads/')).then(hit => hit || c.match(e.request)).then(hit => hit ||
      fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  // rede primeiro (pega atualizações), cache como reserva
  e.respondWith(fetch(e.request, {cache:'no-cache'}).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{}); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
