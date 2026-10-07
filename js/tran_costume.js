/* Trang phục quái người thời Trần — áo giao lĩnh / khăn vấn.
   Sheet enemy* / boss* đã bake remap cloth (tools/rebuild_tran_mob_costume.py).
   Runtime chỉ nhuộm nhẹ thêm theo lớp (thường/tinh anh/boss). Thú ani* không đụng. */
'use strict';

/** true = sheet đã dựng áo Trần; tint runtime dùng alpha nhẹ để khỏi đè màu. */
const TRAN_COSTUME_BAKED = true;
const TRAN_BAKE_TINT = 0.38; // hệ số alpha runtime khi đã bake

/** Bảng trang phục. body/head: { c, a } — màu + độ phủ source-atop.
 *  Bake stem→áo: assets/pack/mobs-tran-costume-review/stem_costume.json
 *  Gallery: docs/tran_costume_preview/ · python3 tools/rebuild_tran_mob_costume.py */
const TRAN_COSTUMES = {
  /* —— đang dùng —— */
  day:   { n: 'Áo đay',   note: 'Sơn dân · nâu đay',        body: { c: '#6b4e2e', a: 0.40 }, head: { c: '#3f3224', a: 0.28 }, status: 'active' },
  cham:  { n: 'Áo chàm',  note: 'Lính tuần · chàm',         body: { c: '#2f4f6f', a: 0.42 }, head: { c: '#1a3044', a: 0.30 }, status: 'active' },
  reu:   { n: 'Áo rêu',   note: 'Phục kích · xanh rêu',     body: { c: '#3a5740', a: 0.38 }, head: { c: '#24382a', a: 0.26 }, status: 'active' },
  muc:   { n: 'Áo mực',   note: 'Ám sát · mực đen',        body: { c: '#2c2c32', a: 0.44 }, head: { c: '#16161a', a: 0.32 }, status: 'active' },
  son:   { n: 'Áo son',   note: 'Đầu lĩnh · đỏ son',       body: { c: '#8a3030', a: 0.42 }, head: { c: '#4e1c1c', a: 0.30 }, status: 'active' },
  kim:   { n: 'Áo kim',   note: 'Trùm cao · vàng nhạt',    body: { c: '#9a7a2e', a: 0.40 }, head: { c: '#5c4818', a: 0.28 }, status: 'active' },
  /* —— đã đưa vào spawn —— */
  bach:  { n: 'Áo bạch',  note: 'Lụa trắng · văn quan',    body: { c: '#d8d2c4', a: 0.46 }, head: { c: '#8a8478', a: 0.28 }, status: 'active' },
  lam:   { n: 'Áo lam',   note: 'Lam nhạt · thư sinh',     body: { c: '#4a6d8c', a: 0.40 }, head: { c: '#2c4458', a: 0.28 }, status: 'active' },
  dat:   { n: 'Áo đất',   note: 'Nâu đất đậm · nông binh', body: { c: '#5a3a22', a: 0.44 }, head: { c: '#2e1e12', a: 0.30 }, status: 'active' },
  thao:  { n: 'Áo thảo',  note: 'Vàng cỏ · dân dã',        body: { c: '#7a6a38', a: 0.40 }, head: { c: '#4a4020', a: 0.28 }, status: 'active' },
  huyen: { n: 'Áo huyền', note: 'Than tối · đặc sứ',       body: { c: '#3a2a3a', a: 0.42 }, head: { c: '#1e1620', a: 0.32 }, status: 'active' },
  ngoc:  { n: 'Áo ngọc',  note: 'Xanh ngọc · cận vệ',      body: { c: '#2a5a55', a: 0.42 }, head: { c: '#163832', a: 0.30 }, status: 'active' },
  hoang: { n: 'Áo hoàng', note: 'Hoàng y · cận thần',      body: { c: '#c4a035', a: 0.44 }, head: { c: '#6e5818', a: 0.30 }, status: 'active' },
  tu:    { n: 'Áo tử',    note: 'Tía dâu · quan võ',       body: { c: '#6a3a58', a: 0.42 }, head: { c: '#3a2030', a: 0.30 }, status: 'active' },
  dong:  { n: 'Áo đồng',  note: 'Đồng hun · lính cung',    body: { c: '#8a5a32', a: 0.44 }, head: { c: '#4a3018', a: 0.30 }, status: 'active' },
  lua:   { n: 'Áo lửa',   note: 'Cam lửa · cảm tử',        body: { c: '#b04828', a: 0.44 }, head: { c: '#5c2414', a: 0.30 }, status: 'active' },
  sam:   { n: 'Áo sẫm',   note: 'Chàm sẫm · đêm',          body: { c: '#1e2a3a', a: 0.46 }, head: { c: '#101820', a: 0.34 }, status: 'active' },
  ho:    { n: 'Áo hổ',    note: 'Nâu hổ · dũng sĩ',        body: { c: '#8a5228', a: 0.42 }, head: { c: '#4a2c14', a: 0.30 }, status: 'active' }
};

const TRAN_COSTUME_KEYS = Object.keys(TRAN_COSTUMES);
/** Pool spawn quái người theo lớp — toàn bộ bảng áo Trần đã build. */
const TRAN_TRASH = ['day', 'cham', 'reu', 'muc', 'dat', 'thao', 'dong', 'ho', 'bach', 'lam'];
const TRAN_ELITE = ['cham', 'reu', 'son', 'lam', 'ngoc', 'sam', 'lua', 'tu', 'dong'];
const TRAN_BOSS_MID = ['son', 'cham', 'tu', 'ngoc', 'lua', 'huyen'];
const TRAN_BOSS_HI = ['son', 'kim', 'hoang', 'lua', 'tu'];

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
  const k = `${m.f}|${fr}|${d}|${L.n}|${L.body.c}|${L.head.c}|${TRAN_COSTUME_BAKED ? 1 : 0}`;
  let cv = TRAN_LOOK_CACHE.get(k);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = m.w; cv.height = m.h;
  const c = cv.getContext('2d');
  c.drawImage(im, fr * m.w, d * m.h, m.w, m.h, 0, 0, m.w, m.h);
  c.globalCompositeOperation = 'source-atop';
  const headY = Math.max(0, m.ay - m.h * 0.8), split = headY + (m.ay - headY) * 0.28;
  const mul = TRAN_COSTUME_BAKED ? TRAN_BAKE_TINT : 1;
  if (L.body) {
    const g = c.createLinearGradient(0, split - 4, 0, split + 6);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, L.body.c);
    c.globalAlpha = L.body.a * mul; c.fillStyle = g; c.fillRect(0, split - 4, m.w, m.h);
  }
  if (L.head) { c.globalAlpha = L.head.a * mul; c.fillStyle = L.head.c; c.fillRect(0, 0, m.w, split); }
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
