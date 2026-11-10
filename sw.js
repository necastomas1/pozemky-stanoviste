// Service worker: appka se otevře i bez signálu (mapa, hranice parcel a už prohlédnuté letecké snímky).
const V = 'pozemky-v2';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'lib/leaflet.js', 'lib/leaflet.css', 'data/pozemky.json', 'data/okoli.json', 'data/orto.json',
  'orto/overview.jpg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // poznámky jdou vždy na síť
  const isTile = u.pathname.includes('/orto/');
  if (isTile) {
    // letecké snímky: z mezipaměti, jinak stáhnout a uložit
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const cp = res.clone(); caches.open(V).then(c => c.put(e.request, cp)); return res;
    })));
  } else {
    // ostatní: nejdřív síť (aktuální verze), bez signálu z mezipaměti
    e.respondWith(fetch(e.request).then(res => {
      const cp = res.clone(); caches.open(V).then(c => c.put(e.request, cp)); return res;
    }).catch(() => caches.match(e.request, {ignoreSearch: true})));
  }
});
