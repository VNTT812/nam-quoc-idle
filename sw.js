// Ma nguon (js/css/html): mang truoc, cache du phong (luon lay ban moi, choi offline khi mat mang).
// Hinh / am thanh / font (nang, it doi): lay ngay tu cache, dong thoi tai lai ngam de cap nhat (stale-while-revalidate).
// Cache hinh giu qua cac ban cap nhat -> khong phai tai lai ~200 MB ban do / sprite moi lan doi phien ban.
const C = 'jxidle-v294', IMG = 'jxidle-img-294';
const ASSET = /\.(png|jpe?g|webp|gif|mp3|ogg|wav|m4a|woff2?|ttf)$/i;
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url); if (u.origin !== location.origin) return;
  if (ASSET.test(u.pathname)) {
    e.respondWith(caches.open(IMG).then(c => c.match(e.request).then(hit => {
      const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
      if (hit) { e.waitUntil(net); return hit; }
      return net;
    })));
    return;
  }
  const fresh = /\.(js|css|html)$|\/$/.test(u.pathname);   // ma nguon: luon hoi lai may chu
  e.respondWith(fetch(e.request, fresh ? { cache: 'no-cache' } : undefined).then(r => { if (r.ok) { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request)));
});
