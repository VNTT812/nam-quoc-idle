/* Trang phục quái người — vài bảng màu gợi thời Trần (áo giao lĩnh / khăn vấn).
   Không đổi sheet: nhuộm thân + đầu giống look.js, chỉ áp quái anim enemy* / boss*. */
'use strict';

/** Bảng trang phục. body/head: { c, a } — màu + độ phủ source-atop. */
const TRAN_COSTUMES = {
  day:  { n: 'Áo đay',   note: 'Sơn dân · nâu đay',     body: { c: '#6b4e2e', a: 0.40 }, head: { c: '#3f3224', a: 0.28 } },
  cham: { n: 'Áo chàm',  note: 'Lính tuần · chàm',      body: { c: '#2f4f6f', a: 0.42 }, head: { c: '#1a3044', a: 0.30 } },
  reu:  { n: 'Áo rêu',   note: 'Phục kích · xanh rêu',  body: { c: '#3a5740', a: 0.38 }, head: { c: '#24382a', a: 0.26 } },
  muc:  { n: 'Áo mực',   note: 'Ám sát · mực đen',     body: { c: '#2c2c32', a: 0.44 }, head: { c: '#16161a', a: 0.32 } },
  son:  { n: 'Áo son',   note: 'Đầu lĩnh · đỏ son',    body: { c: '#8a3030', a: 0.42 }, head: { c: '#4e1c1c', a: 0.30 } },
  kim:  { n: 'Áo kim',   note: 'Trùm cao · vàng nhạt', body: { c: '#9a7a2e', a: 0.40 }, head: { c: '#5c4818', a: 0.28 } }
};

const TRAN_COSTUME_KEYS = Object.keys(TRAN_COSTUMES);
const TRAN_TRASH = ['day', 'cham', 'reu', 'muc'];
const TRAN_ELITE = ['cham', 'reu', 'son'];
const TRAN_BOSS_MID = ['son', 'cham'];
const TRAN_BOSS_HI = ['son', 'kim'];

const isHumanMonAnim = a => !!(a && (String(a).indexOf('enemy') === 0 || String(a).indexOf('boss') === 0));
function isHumanMon(tid) {
  const m = typeof MON !== 'undefined' && MON[tid];
  return !!(m && isHumanMonAnim(m.anim));
}

/** Gán bảng theo vai trò; override MON[tid].tranCostume nếu có. */
function pickTranCostume(tid, cls) {
  const m = MON[tid];
  if (!m || !isHumanMonAnim(m.anim)) return null;
  if (m.tranCostume && TRAN_COSTUMES[m.tranCostume]) return m.tranCostume;
  const n = (m.n || '').toLowerCase();
  const h = (tid * 17 + (cls === 'boss' ? 3 : cls === 'elite' ? 1 : 0)) >>> 0;
  if (cls === 'boss' || /đầu lĩnh|tiểu boss|trùm/.test(n)) {
    const hi = tid >= 600 || /phiến|võ sĩ|hạ hầu|lục phi|tiếu|nguyễn|thi nghi/.test(n);
    const pool = hi ? TRAN_BOSS_HI : TRAN_BOSS_MID;
    return pool[h % pool.length];
  }
  if (cls === 'elite') return TRAN_ELITE[h % TRAN_ELITE.length];
  return TRAN_TRASH[h % TRAN_TRASH.length];
}

function attachTranCostume(e) {
  if (!e || e.tranCostume) return e;
  const key = pickTranCostume(e.tid, e.cls);
  if (key) e.tranCostume = key;
  return e;
}

const TRAN_LOOK_CACHE = new Map();
function tranTintedFrame(im, m, fr, d, L) {
  const k = `${m.f}|${fr}|${d}|${L.n}|${L.body.c}|${L.head.c}`;
  let cv = TRAN_LOOK_CACHE.get(k);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = m.w; cv.height = m.h;
  const c = cv.getContext('2d');
  c.drawImage(im, fr * m.w, d * m.h, m.w, m.h, 0, 0, m.w, m.h);
  c.globalCompositeOperation = 'source-atop';
  const headY = Math.max(0, m.ay - m.h * 0.8), split = headY + (m.ay - headY) * 0.28;
  if (L.body) {
    const g = c.createLinearGradient(0, split - 4, 0, split + 6);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, L.body.c);
    c.globalAlpha = L.body.a; c.fillStyle = g; c.fillRect(0, split - 4, m.w, m.h);
  }
  if (L.head) { c.globalAlpha = L.head.a; c.fillStyle = L.head.c; c.fillRect(0, 0, m.w, split); }
  if (TRAN_LOOK_CACHE.size > 800) TRAN_LOOK_CACHE.clear();
  TRAN_LOOK_CACHE.set(k, cv);
  return cv;
}

/** Vẽ quái người có trang phục Trần; fallback drawAnim nếu không áp dụng được. */
function drawMonAnim(e, key, act, dir, t, x, y, sc, alpha = 1, face = 1) {
  const ck = e && e.tranCostume, L = ck && TRAN_COSTUMES[ck];
  if (!L || !isHumanMonAnim(key)) return drawAnim(key, act, dir, t, x, y, sc, alpha, face);
  const set = W.anim && W.anim[key]; if (!set) return false;
  const m = set[act] || set.st; if (!m) return false;
  const im = img('img/a/' + m.f); if (!im.complete || !im.naturalWidth) return false;
  let fr = Math.floor(t * 1000 / m.ms); fr = ONCE[act] ? Math.min(fr, m.n - 1) : fr % m.n;
  const d = m.d >= 8 ? dir : Math.floor(dir * m.d / 8);
  const flip = !!(m.flip || m.d === 1) && face < 0;
  const frame = tranTintedFrame(im, m, fr, d, L);
  CX.globalAlpha = alpha;
  if (flip) {
    CX.save(); CX.translate(x, y); CX.scale(-1, 1);
    CX.drawImage(frame, -m.ax * sc, -m.ay * sc, m.w * sc, m.h * sc);
    CX.restore();
  } else {
    CX.drawImage(frame, x - m.ax * sc, y - m.ay * sc, m.w * sc, m.h * sc);
  }
  CX.globalAlpha = 1;
  return m.h * sc;
}
