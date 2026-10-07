// Ma nguon (js/css/html): mang truoc, cache du phong (luon lay ban moi, choi offline khi mat mang).
// Hinh / am thanh / font (nang, it doi): lay ngay tu cache, dong thoi tai lai ngam de cap nhat (stale-while-revalidate).
// Cache hinh giu qua cac ban cap nhat -> khong phai tai lai ~200 MB ban do / sprite moi lan doi phien ban.
const C = 'jxidle-v346', IMG = 'jxidle-img-346';
const ASSET = /\.(png|jpe?g|webp|gif|mp3|ogg|wav|m4a|woff2?|ttf)$/i;
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url); if (u.origin !== location.origin) return;
  if (ASSET.test(u.pathname)) {
    // Ban do zone: luon mang truoc — tranh SW giu ban cu (vd Phổ Minh mat chua).
    if (/\/img\/z\//.test(u.pathname)) {
      e.respondWith(fetch(e.request).then(r => {
        if (r.ok) caches.open(IMG).then(c => c.put(e.request, r.clone()));
        return r;
      }).catch(() => caches.open(IMG).then(c => c.match(e.request))));
      return;
    }
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(e.request);
      const fresh = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || fresh;
    }));
    return;
  }
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(C).then(cache => cache.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
