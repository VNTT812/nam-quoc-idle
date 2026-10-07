/* ======================= NPC TINH · KIEM HIEP =======================
   PNG pose dung tu assets/pack/kiem_hiep — khong can chay/danh.
   Dat o Hoành Sơn Môn (map 402 · alt Yên Tử, cấp 1–10).
   Ve bang drawSprite + flip trai/phai. */
'use strict';
/** Zone id JMO2 — Hoành Sơn Môn (zones2 alt index 0). */
const KH_NPC_ZONE = 402;
/* Mot NPC dung truoc nha / canh gia vu khi trong san luyen */
const KH_ZONE_NPC = [
  { kh: 1, n: 'Thanh Kiếm Nữ', x: 0.524, y: 0.158, face: -1 },
];

function khNpcImg(kh) {
  if (typeof Assets !== 'undefined' && Assets.pack && Assets.pack.kh) {
    const p = Assets.pack.kh(kh);
    if (p) return p;
  }
  return `assets/pack/kiem_hiep/${kh}.png`;
}

async function khNpcLoadStubs() {
  if (window._khStubs) return window._khStubs;
  try {
    const r = await fetch('assets/pack/kiem_hiep/stubs.json');
    window._khStubs = await r.json();
  } catch (_) { window._khStubs = {}; }
  return window._khStubs;
}

function khNpcZoneActive() {
  if (!R || R.town || R.dg) return false;
  try {
    const z = typeof zoneOf === 'function' ? zoneOf(Math.min(S.stage, STAGES)) : null;
    if (z && z.id === KH_NPC_ZONE) return true;
  } catch (_) { /* chua co S */ }
  return OBS && String(OBS.key) === String(KH_NPC_ZONE);
}

function khZonePlace() {
  const w = (typeof WORLD !== 'undefined' && WORLD.w) || 3584;
  const h = (typeof WORLD !== 'undefined' && WORLD.h) || 3584;
  const stubs = window._khStubs || {};
  R.khNpcs = KH_ZONE_NPC.map(d => {
    const st = stubs[String(d.kh)];
    const sz = (st && st.sz) || [64, 128, 32, 126];
    return {
      n: d.n,
      kh: d.kh,
      x: d.x * w,
      y: d.y * h,
      face: d.face || 1,
      imgPath: khNpcImg(d.kh),
      sz,
    };
  });
}

function ensureKhNpcs() {
  if (!khNpcZoneActive()) { R.khNpcs = null; return; }
  if (R.khNpcs && R.khNpcs.length) return;
  if (window._khStubs) khZonePlace();
  else khNpcLoadStubs().then(() => { if (khNpcZoneActive()) khZonePlace(); });
}

function ensureTownNpcs() { ensureKhNpcs(); }

function drawOneTownNpc(c, n) {
  const im = img(n.imgPath);
  c.fillStyle = '#0006';
  c.beginPath();
  c.ellipse(n.x, n.y, 14, 5, 0, 0, 7);
  c.fill();
  if (im && im.complete && im.naturalWidth) {
    const sz = n.sz || [im.naturalWidth, im.naturalHeight, im.naturalWidth / 2, im.naturalHeight - 2];
    drawSprite(im, sz, n.x, n.y, 1, n.face < 0);
  }
  label(n.x, n.y - (n.sz ? n.sz[1] * 0.9 : 100), n.n, '#e8d5a3', 11);
}

function townNpcEnts() {
  if (!khNpcZoneActive() || !R.khNpcs) return [];
  return R.khNpcs.map(n => ({ khNpc: n, y: n.y }));
}
