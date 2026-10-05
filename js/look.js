/* ======================= NGOAI HINH THEO TRANG BI =======================
   Game chi co 1 bo hinh (sprite) co dinh cho moi mon phai (khong co hinh tung mon nhu file .spr cua JX1), nen ngoai hinh
   doi theo do mac bang hieu ung:
   - Ao: nhuom mau phan than (duoi dau) theo ao: Xanh / Vang / Tim = mau he cua ao, dam dan theo do hiem; Hoang Kim = vang kim; Bach Kim = bac trang
   - Mu: nhuom nhe phan dau theo mu (cung luat)
   - Hao quang duoi chan: du bo Hoang Kim (vang), Bach Kim (bac xanh); hoac trang bi cuong hoa trung binh >= +7 (mau he nhan vat)
   - Vu khi cuong hoa +5 tro len: dom sang quanh nhan vat theo he vu khi, +10 ruc ro hon
   - Than ma: bui chan mang mau he cua ngua
   Tat / bat o the Khac (S.lookFx). Giam hieu ung: giu nhuom mau, bo hat sang. */
'use strict';
const LOOK_RAR_A = [0, 0.24, 0.32, 0.4, 0.42, 0.42];
const TM_DUST = { ovan: '#5fb8ff', xtho: '#ff6a3a', tanh: '#f3d35b', dlo: '#6fd46a', cdsu: '#c8965a' };
function partTint(it) {
  if (!it || !reqOk(it)) return null;
  if (it.set) return it.set.kind === 'platina' ? { c: '#e6f4ff', a: 0.48 } : { c: '#ffc93c', a: 0.44 };
  const a = LOOK_RAR_A[it.r || 0]; if (!a) return null;
  return { c: it.s >= 0 ? SERIES_COL[it.s] : RAR_COL[it.r], a };
}
/* Tinh ngoai hinh tu do dang mac (goi khi doi do: R.dirty -> recalc) */
function heroLook() {
  const eq = S.eq, worn = Object.values(eq).filter(it => it && it.d !== 10);
  const body = partTint(eq.armor), head = partTint(eq.helm);
  let aura = null;
  if (typeof enoughToActive === 'function' && enoughToActive(eq)) {
    const plat = worn.filter(it => it.set && it.set.kind === 'platina').length, gold = worn.filter(it => it.set && it.set.kind === 'gold').length;
    aura = plat >= gold ? { c: '#bfe6ff', c2: '#ffffff', k: 1 } : { c: '#ffb52e', c2: '#fff1a8', k: 1 };
  } else if (worn.length >= 5) {
    const avg = worn.reduce((t, it) => t + (it.enh || 0), 0) / worn.length;
    if (avg >= 7) aura = { c: SERIES_COL[heroSeries()], c2: '#ffffff', k: avg >= 9 ? 0.9 : 0.6 };
  }
  const w = eq.weapon, we = w && reqOk(w) ? w.enh || 0 : 0;
  const glow = we >= 5 ? { c: w.s >= 0 ? SERIES_COL[w.s] : '#ffe9a8', n: we >= 10 ? 3 : we >= 8 ? 2 : 1 } : null;
  const h = eq.horse, dust = h && h.thanma ? TM_DUST[h.thanma] || '#ffd24a' : null;
  return { body, head, aura, glow, dust, key: JSON.stringify([body, head, aura, glow, dust]) };
}
const lookOn = () => S && S.lookFx !== false;
/* ---------- ve: khung hinh nhuom mau (luu dem theo khung) ---------- */
const LOOK_CACHE = new Map();
function tintedFrame(im, m, fr, d, L) {
  const k = `${m.f}|${fr}|${d}|${L.key}`; let cv = LOOK_CACHE.get(k);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = m.w; cv.height = m.h;
  const c = cv.getContext('2d');
  c.drawImage(im, fr * m.w, d * m.h, m.w, m.h, 0, 0, m.w, m.h);
  c.globalCompositeOperation = 'source-atop';
  const headY = Math.max(0, m.ay - m.h * 0.8), split = headY + (m.ay - headY) * 0.28;   // ~28% tren cung tu dinh dau toi chan = dau
  if (L.body) { const g = c.createLinearGradient(0, split - 4, 0, split + 6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, L.body.c); c.globalAlpha = L.body.a; c.fillStyle = g; c.fillRect(0, split - 4, m.w, m.h); }
  if (L.head) { c.globalAlpha = L.head.a; c.fillStyle = L.head.c; c.fillRect(0, 0, m.w, split); }
  if (LOOK_CACHE.size > 600) LOOK_CACHE.clear();
  LOOK_CACHE.set(k, cv); return cv;
}
/* Thay cho drawAnim khi ve nhan vat: tra ve chieu cao da ve (nhu drawAnim) */
function drawHeroAnim(key, act, dir, t, x, y, sc, alpha = 1) {
  if (typeof jxOn === 'function' && jxOn() && R.jx) { const h = drawJxHero(act, dir, t, x, y, sc, alpha, key); if (h) return h; }   // hinh JX1 theo trang bi
  const L = R.look; if (!lookOn() || !L || (!L.body && !L.head)) return drawAnim(key, act, dir, t, x, y, sc, alpha);
  const set = W.anim && W.anim[key]; if (!set) return false;
  const m = set[act] || set.st; if (!m) return false;
  const im = img('img/a/' + m.f); if (!im.complete || !im.naturalWidth) return false;
  let fr = Math.floor(t * 1000 / m.ms); fr = ONCE[act] ? Math.min(fr, m.n - 1) : fr % m.n;
  const d = m.d >= 8 ? dir : Math.floor(dir * m.d / 8);
  CX.globalAlpha = alpha; CX.drawImage(tintedFrame(im, m, fr, d, L), x - m.ax * sc, y - m.ay * sc, m.w * sc, m.h * sc); CX.globalAlpha = 1;
  return m.h * sc;
}
/* Hao quang duoi chan (ve truoc nhan vat) */
function drawAura(c) {
  const L = R.look; if (!lookOn() || !L || !L.aura) return;
  const t = (R.clock || 0), p = 0.5 + 0.5 * Math.sin(t * 3), A = L.aura;
  c.save(); c.globalAlpha = (0.35 + 0.25 * p) * A.k; c.strokeStyle = A.c; c.lineWidth = 2;
  c.beginPath(); c.ellipse(H.x, H.y, 24 + p * 4, 9 + p * 1.5, 0, 0, 7); c.stroke();
  c.globalAlpha = 0.18 * A.k; c.fillStyle = A.c; c.beginPath(); c.ellipse(H.x, H.y, 22, 8, 0, 0, 7); c.fill();
  c.restore();
  if (S.lowFx) return;
  const P = R.lookP || (R.lookP = []);
  if (Math.random() < 0.25 * A.k) P.push({ x: H.x + rnd(-18, 18), y: H.y + rnd(-3, 3), vy: -rnd(18, 34), life: 1.1, c: Math.random() < 0.5 ? A.c : A.c2 });
}
/* Dom sang vu khi + hat hao quang bay len (ve sau nhan vat) */
function drawLookFx(c, dt) {
  const L = R.look; if (!lookOn() || !L || S.lowFx) { R.lookP = null; return; }
  const P = R.lookP || (R.lookP = []);
  if (L.glow && Math.random() < 0.12 * L.glow.n) { const a = rnd(0, 7); P.push({ x: H.x + Math.cos(a) * rnd(8, 20), y: H.y - 26 + Math.sin(a) * rnd(6, 16), vy: -rnd(6, 16), life: 0.7, c: L.glow.c, s: 1 + L.glow.n * 0.5 }); }
  c.save();
  for (const q of P) { q.life -= dt; q.y += q.vy * dt; c.globalAlpha = clamp(q.life, 0, 1) * 0.85; c.fillStyle = q.c; c.beginPath(); c.arc(q.x, q.y, q.s || 1.4, 0, 7); c.fill(); }
  c.restore(); R.lookP = P.filter(q => q.life > 0).slice(-80);
}
