// Cache simples para funcionar offline (ex.: igreja sem internet)
const CACHE = 'worship-church-v16';
const FILES = ['./', 'index.html', 'songs.js?v=16', 'app.js?v=16', 'manifest.webmanifest', 'icon.svg?v=2', 'icon-32.png?v=2', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png?v=2',
  ...['A','B','Cs','D','E','G','Cm','Em','Em-2','Bm'].map(k => 'pads/'+k+'.m4a')];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // rede primeiro (pega atualizações), cache como reserva
  e.respondWith(fetch(e.request, {cache:'no-cache'}).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(()=>{}); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
