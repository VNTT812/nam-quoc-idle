/* ======================= VE SAN DAU (canvas) ======================= */
'use strict';
let CV, CX, DPR = 1;
const MON_SCALE = 1.35, HERO_SCALE = 1.35; // bang hoat anh xuat o 0.6 kich thuoc goc; quai cung ti le voi nhan vat nhu JX1
const IMG = {};
function img(src) { if (!src) return null; let i = IMG[src]; if (!i) { i = new Image(); i.src = src; IMG[src] = i; } return i; }
function addText(x, y, t, color, size = 12) { const max = S.lowFx ? 20 : 60; if (R.quiet || R.txt.length > max) return; R.txt.push({ x, y, t, color, size, life: S.lowFx ? 0.6 : 0.9 }); }
function burst(x, y, color) { if (R.quiet) return; R.fx.push({ k: 'ring', x, y, color, life: 0.45, max: 0.45 }); }
function fxLine(a, b, atk) {
  if (R.quiet || R.fx.length > 80) return;
  let el = 'phys', v = 0; for (const e in atk.parts) if (atk.parts[e] > v) { v = atk.parts[e]; el = e; }
  R.fx.push({ k: 'line', x1: a.x, y1: a.y - 20, x2: b.x, y2: b.y - 14, color: ELEM_COL[el], life: 0.18, max: 0.18 });
}
/* ---------- hieu ung chieu goc (Missles.txt -> tools/extract_fx.py -> fx.js): dan bay theo huong + no tai muc tieu ----------
   chieu can chien: phat hoat anh tai muc tieu; thieu hinh thi ve tia nhu cu */
const JFX = window.JFX || { m: {}, s: {}, c: {}, f: {} }, FX_SCALE = 1.4, FX_MAX = 60;
const dir16 = (vx, vy) => (((Math.round(Math.atan2(-vx, vy) / (Math.PI / 8)) % 16) + 16) % 16);
/* hieu ung tai cho nguoi ra chieu (PreCastSpr cua skills.txt) */
function castFx(atk) {
  const f = atk && atk.id && JFX.f && JFX.f[atk.id], c = f && f.pre && JFX.c && JFX.c[f.pre];
  if (!c || R.quiet || R.fx.length > FX_MAX) return;
  R.fx.push({ k: 'boom', s: c, x: H.x, y: H.y - 6, t: 0, life: animDur(c), dir: 0 });
}
/* kieu phong dan cua chieu (MisslesForm / ChildSkillNum trong skills.txt, KSkill::CastMissles):
   0 tuong, 1 hang, 2 quat, 3 vong, 4 ngau nhien, 5 vung, 6 tai muc tieu, 7 tai nguoi ra chieu, >= 8 can chien */
function skillFx(a, b, atk) {
  const f = (atk.id && JFX.f && JFX.f[atk.id]) || {}, m = atk.id && JFX.m[f.c || JFX.s[atk.id]];
  castFx(atk);
  if (f.sub && !R.quiet && String(f.sub.c) !== String(f.c)) subFx(a, b, f.sub);
  if (!m || R.quiet) { fxLine(a, b, atk); return; }
  if (R.fx.length > FX_MAX) return;
  const x1 = a.x, y1 = a.y - 20, x2 = b.x, y2 = b.y - 14, dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
  const form = f.form === undefined ? 1 : f.form, n = clamp(atk.nMis > 1 ? Math.max(f.num || 1, Math.min(atk.nMis, 8)) : (f.num || 1), 1, 8), ang = Math.atan2(dy, dx);   // so dan theo cap chieu
  const boom = (s, x, y, delay = 0) => R.fx.push({ k: 'boom', s, x, y, t: -delay, life: animDur(s), dir: dir16(dx, dy) });
  const mis = (tx, ty, delay = 0) => R.fx.push({ k: 'mis', s: m.fly, hit: m.hit, x1, y1, x2: tx, y2: ty, t: -delay, life: Math.min(0.6, Math.hypot(tx - x1, ty - y1) / m.spd), dir: dir16(tx - x1, ty - y1) });
  const s1 = m.hit || m.fly;
  // chieu tu tren troi roi xuong (Phong Suong Toai Anh, Ngu Loi, Kiem Phi Kinh Thien...): hinh 'fly' 1 huong, cao -> phat tai cho muc tieu, roi no 'hit'
  const sky = m.fly && m.fly.d === 1 && m.fly.ay > 150;
  const fall = (x, y, dl = 0) => {                                     // phat het ca chuoi hinh roi trong ~0.8 giay (hinh goc dai 1-3 giay)
    const full = m.fly.n * m.fly.ms / 1000, life = Math.min(0.8, full);
    R.fx.push({ k: 'boom', s: m.fly, x, y: y + 14, t: -dl, life, sp: full / life, dir: 0 });
    if (m.hit) boom(m.hit, x, y, dl + life * 0.8);
  };
  if (sky && (form === 6 || form >= 8)) { for (let i = 0; i < n; i++) fall(x2 + (n > 1 ? rnd(-40, 40) : 0), y2 + (n > 1 ? rnd(-26, 26) : 0), i * 0.12); return; }
  if (atk.melee || form >= 8) { boom(s1, x2, y2); return; }
  if (form === 7) { if (m.fly && m.fly.d === 1 && m.hit) { boom(m.fly, x1, y1 + 8); boom(m.hit, x2, y2, 0.12); } else boom(s1, x1, y1 + 8); return; }   // quanh nguoi: vong sang lon tai nguoi + no tai muc tieu                                    // tai nguoi ra chieu
  if (form === 6) { for (let i = 0; i < n; i++) boom(s1, x2 + (n > 1 ? rnd(-36, 36) : 0), y2 + (n > 1 ? rnd(-24, 24) : 0), i * 0.07); return; }   // tai muc tieu
  if (!m.fly) { boom(s1, x2, y2); return; }
  if (form === 3) { for (let i = 0; i < n; i++) { const g = ang + i / n * Math.PI * 2; mis(x1 + Math.cos(g) * 130, y1 + Math.sin(g) * 130); } return; }   // vong quanh nguoi
  if (form === 2) { for (let i = 0; i < n; i++) { const g = ang + (i - (n - 1) / 2) * 0.26; mis(x1 + Math.cos(g) * d, y1 + Math.sin(g) * d); } return; }   // quat
  if (form === 1) { for (let i = 0; i < n; i++) mis(x2, y2, i * 0.09); return; }          // hang (lien tiep theo huong)
  if (form === 0) { const px = -dy / d, py = dx / d; for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 34; mis(x2 + px * o, y2 + py * o); } return; }   // tuong
  for (let i = 0; i < n; i++) mis(x2 + rnd(-60, 60), y2 + rnd(-40, 40), i * 0.05);         // ngau nhien / vung
}
/* dan chieu con theo su kien (Tu Tuong Dong Quy: 4 cuc bang toa ra tu tam...): ve tai diem trung chieu */
function subFx(a, b, sub) {
  const m = JFX.m[sub.c]; if (!m || R.fx.length > FX_MAX) return;
  const n = clamp(sub.n || 1, 1, 8), x0 = b.x, y0 = b.y - 14, s1 = m.hit || m.fly, delay = 0.18;
  const mis = (x1, y1, tx, ty, dl) => m.fly ? R.fx.push({ k: 'mis', s: m.fly, hit: m.hit, x1, y1, x2: tx, y2: ty, t: -dl, life: Math.min(0.55, Math.hypot(tx - x1, ty - y1) / (m.spd || 360)), dir: dir16(tx - x1, ty - y1) })
    : R.fx.push({ k: 'boom', s: s1, x: tx, y: ty, t: -dl, life: animDur(s1), dir: 0 });
  if (sub.form === 3) { const g0 = Math.random() * Math.PI; for (let i = 0; i < n; i++) { const g = g0 + i / n * Math.PI * 2; mis(x0, y0, x0 + Math.cos(g) * 110, y0 + Math.sin(g) * 70, delay); } return; }   // toa tron tu tam
  if (sub.form === 1) { for (let i = 0; i < n; i++) mis(a.x, a.y - 20, x0 + rnd(-20, 20), y0 + rnd(-14, 14), delay + i * 0.06); return; }
  for (let i = 0; i < n; i++) R.fx.push({ k: 'boom', s: s1, x: x0 + rnd(-40, 40), y: y0 + rnd(-26, 26), t: -(delay + i * 0.08), life: animDur(s1), dir: 0 });   // no quanh muc tieu
}
/* Hieu ung chieu con tang 2: no tre tai quai trung + ten chieu con (1 lan / don) */
function ev2Fx(e, atk, name, from) {
  if (R.quiet) return;
  const f = (atk.id && JFX.f && JFX.f[atk.id]) || {}, m = atk.id && (JFX.m[f.ev2c] || JFX.m[f.c || JFX.s[atk.id]]), s1 = m && (m.hit || m.fly);   // hinh dan cua chinh chieu con neu co
  if (!s1 || R.fx.length > FX_MAX) return;
  if (from && m.fly) { R.fx.push({ k: 'mis', s: m.fly, hit: m.hit, x1: from.x, y1: from.y - 20, x2: e.x, y2: e.y - 14, t: -0.15, life: 0.35, dir: dir16(e.x - from.x, e.y - from.y) }); return; }   // tia bay tu nguoi danh
  for (let i = 0; i < 2; i++) R.fx.push({ k: 'boom', s: s1, x: e.x + rnd(-18, 18), y: e.y - 14 + rnd(-12, 12), t: -(0.18 + i * 0.12), life: animDur(s1), dir: 0 });
}
const animDur = s => Math.min(1.2, s.n * s.ms / 1000);
function drawFxSprite(s, dir, t, x, y, loop) {
  const im = img(s.f); if (!im || !im.complete || !im.naturalWidth) return false;
  const fr = loop ? Math.floor(t * 1000 / s.ms) % s.n : Math.min(s.n - 1, Math.floor(t * 1000 / s.ms));
  const row = s.d > 1 ? Math.round(dir * s.d / 16) % s.d : 0;
  CX.drawImage(im, fr * s.w, row * s.h, s.w, s.h, x - s.ax * FX_SCALE, y - s.ay * FX_SCALE, s.w * FX_SCALE, s.h * FX_SCALE);
  return true;
}
function stepFx(f, dt) { // tra ve false khi het; dan toi dich thi doi sang no
  f.t += dt; if (f.t < 0) return true;     // dang cho (phat dan lien tiep)
  if (f.k === 'mis' && f.t >= f.life) {
    if (f.hit) { Object.assign(f, { k: 'boom', s: f.hit, x: f.x2, y: f.y2, t: 0, life: animDur(f.hit) }); return true; }
    return false;
  }
  return f.t < f.life;
}
function drawFx(f) {
  if (f.t < 0) return false;
  if (f.k === 'mis') { const k = clamp(f.t / f.life, 0, 1); return drawFxSprite(f.s, f.dir, f.t, f.x1 + (f.x2 - f.x1) * k, f.y1 + (f.y2 - f.y1) * k, true); }
  return drawFxSprite(f.s, f.dir, f.t * (f.sp || 1), f.x, f.y, false);
}
/* Giao dien di dong thu nho 20% (UI_SCALE_MOBILE): #app co width / height lon 1/0.8 lan roi transform: scale(0.8) (style.css, body.mob).
   Toa do trong game theo px bo cuc (offsetWidth / Height, khong bi transform); DPR hieu dung nhan them he so thu nho de net. */
const UI_SCALE_MOBILE = 0.8;
const isMobileUI = () => !(typeof isDesktopLandscape === 'function' && isDesktopLandscape()) && !!(window.matchMedia && (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700));
const uiScale = () => document.body.classList.contains('mob') ? UI_SCALE_MOBILE : 1;
function resizeArena() {
  const b = $('#battle'), box = { width: b.offsetWidth, height: b.offsetHeight };
  DPR = Math.min(2, window.devicePixelRatio || 1) * uiScale();
  CV.width = Math.round(box.width * DPR); CV.height = Math.round(box.height * DPR);
  AR.w = box.width; AR.h = box.height; AR.top = 58; AR.bot = box.height - 12;   // khung nhin (man hinh)
  snapCamera();
}
/* ---------- camera chay theo nhan vat, khong ra ngoai mep ban do ---------- */
const CAM = { x: 0, y: 0 };
const camTarget = () => [clamp(H.x - AR.w / 2, 0, Math.max(0, WORLD.w - AR.w)), clamp(H.y - AR.h * 0.55, 0, Math.max(0, WORLD.h - AR.h))];
function snapCamera() { [CAM.x, CAM.y] = camTarget(); }
function updateCamera(dt) { const [tx, ty] = camTarget(), k = Math.min(1, dt * 6); CAM.x += (tx - CAM.x) * k; CAM.y += (ty - CAM.y) * k; }
/* ---------- nen ban do: anh 3x3 vung that (BG_TILE diem) lat guong xen ke -> ghep lien, khong thay mep, the gioi rong tuy y ---------- */
const BG_TILE = 1536;
function drawTiledBg(c, bg) {
  if (!(bg && bg.complete && bg.naturalWidth)) { c.fillStyle = '#26301f'; c.fillRect(CAM.x - 2, CAM.y - 2, AR.w + 4, AR.h + 4); return; }
  if (OBS.g) { c.drawImage(bg, 0, 0, WORLD.w, WORLD.h); return; }          // ban do that rong, khong lat guong
  const T = BG_TILE, i0 = Math.floor(CAM.x / T), i1 = Math.floor((CAM.x + AR.w) / T), j0 = Math.floor(CAM.y / T), j1 = Math.floor((CAM.y + AR.h) / T);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const fx = i & 1, fy = j & 1;
    if (!fx && !fy) { c.drawImage(bg, i * T, j * T, T, T); continue; }
    c.save(); c.translate(i * T + (fx ? T : 0), j * T + (fy ? T : 0)); c.scale(fx ? -1 : 1, fy ? -1 : 1); c.drawImage(bg, 0, 0, T, T); c.restore();
  }
}
/* ---------- ban do nho: anh ban do that thu nho, quai = cham theo ngu hanh / trum, nhan vat = mui ten, khung = tam nhin ---------- */
const MINI = { s: 92, m: 8, top: 62 };
function drawMinimap(c) {
  if (R.town || S.miniMap === false) return;
  const s = MINI.s, x0 = AR.w - s - MINI.m, y0 = MINI.top, k = s / WORLD.w;
  c.save(); c.globalAlpha = 0.9; c.fillStyle = '#000c'; c.fillRect(x0 - 2, y0 - 2, s + 4, s + 4);
  const bg = R.bgImg;
  if (bg && bg.complete && bg.naturalWidth) {
    if (OBS.g) c.drawImage(bg, x0, y0, s, s);
    else { const n = Math.round(WORLD.w / BG_TILE), h = s / n;                   // cung cach ghep lat guong nhu nen tran dau
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { c.save(); c.translate(x0 + i * h + (i & 1 ? h : 0), y0 + j * h + (j & 1 ? h : 0)); c.scale(i & 1 ? -1 : 1, j & 1 ? -1 : 1); c.drawImage(bg, 0, 0, h, h); c.restore(); } }
  } else { c.fillStyle = '#26301f'; c.fillRect(x0, y0, s, s); }
  c.globalAlpha = 1;
  c.strokeStyle = '#fff6'; c.lineWidth = 1; c.strokeRect(x0 + CAM.x * k, y0 + CAM.y * k, Math.min(s, AR.w * k), Math.min(s, AR.h * k));
  for (const d of R.ground) if (lootMatch(d.it)) { c.fillStyle = RAR_COL[d.it.r]; c.fillRect(x0 + d.x * k - 1, y0 + d.y * k - 1, 2, 2); }
  for (const e of R.enemies) {
    if (e.dead) continue;
    const r = e.cls === 'boss' ? 3.2 : e.cls === 'elite' ? 2.4 : 1.8;
    c.fillStyle = e.goldBoss ? '#ffd24a' : e.cls === 'boss' ? '#ff4a3a' : SERIES_COL[e.series];
    c.beginPath(); c.arc(x0 + e.x * k, y0 + e.y * k, r, 0, 7); c.fill();
  }
  if (R.petPos) { c.fillStyle = '#9fe36a'; c.fillRect(x0 + R.petPos.x * k - 1.5, y0 + R.petPos.y * k - 1.5, 3, 3); }
  const hx = x0 + H.x * k, hy = y0 + H.y * k, a = Math.PI / 2 + (H.dir || 0) * Math.PI / 4;   // huong 0 = nam (xuong duoi)
  c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.beginPath();
  c.moveTo(hx + Math.cos(a) * 5, hy + Math.sin(a) * 5); c.lineTo(hx + Math.cos(a + 2.5) * 4, hy + Math.sin(a + 2.5) * 4); c.lineTo(hx + Math.cos(a - 2.5) * 4, hy + Math.sin(a - 2.5) * 4);
  c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#c8a45a'; c.strokeRect(x0 - 2, y0 - 2, s + 4, s + 4);
  c.font = '9px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillStyle = '#f3d88a';
  c.fillText(R.dg ? (R.dg.kind === 'wb' ? 'Boss tuần' : R.dg.d.n) : R.tower ? `Tháp · tầng ${R.tower.floor}` : zoneOf(Math.min(S.stage, STAGES)).n, x0 + s / 2, y0 + s + 11);
  c.restore();
}
const onScreen = (x, y, m = 120) => x > CAM.x - m && x < CAM.x + AR.w + m && y > CAM.y - m && y < CAM.y + AR.h + m;
/* ---------- hieu ung trang thai kieu JX1 (npcres Status1-3 'Special'): bang = nhuom xanh, doc = nhuom xanh la, choang = vong sao tren dau ----------
   Ve nhan vat / quai vao lop phu (offscreen), phu mau len dung phan hinh (source-atop), roi ve lai len san dau */
const ST_TINT = { cold: 'rgba(255,215,40,0.5)', poison: 'rgba(80,215,60,0.45)' };
const ST_STUN = { f: 'fx/st_stun.webp', n: 10, w: 54, h: 47, ax: 25, ay: 72, ms: 110 };
let tintCv = null;
function drawTinted(color, bx, by, bw, bh, fn) {
  if (!color || S.lowFx) return fn();
  const k = DPR || 1, W = Math.ceil(bw * k), Hh = Math.ceil(bh * k);
  if (!tintCv) tintCv = document.createElement('canvas');
  if (tintCv.width < W || tintCv.height < Hh) { tintCv.width = Math.max(tintCv.width, W); tintCv.height = Math.max(tintCv.height, Hh); }
  const g = tintCv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, Hh);
  g.setTransform(k, 0, 0, k, -bx * k, -by * k);
  const main = CX; CX = g; let r; try { r = fn(); } finally { CX = main; }
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, W, Hh); g.globalCompositeOperation = 'source-over';
  main.drawImage(tintCv, 0, 0, W, Hh, bx, by, bw, bh);
  return r;
}
/* vong sao choang tren dau (spr\skill\补充\mag_spe_眩晕.spr) */
function drawStun(x, headY, sc) {
  const s = ST_STUN, im = img(s.f); if (!im.complete || !im.naturalWidth) return;
  const fr = Math.floor((R.clock || 0) * 1000 / s.ms) % s.n, k = sc;
  CX.drawImage(im, fr * s.w, 0, s.w, s.h, x - s.ax * k, headY - s.h * k * 0.55, s.w * k, s.h * k);
}
const entTint = (slow, poison) => slow ? ST_TINT.cold : poison ? ST_TINT.poison : null;
function drawSprite(im, sz, x, y, scale, flip, alpha = 1) {
  if (!im || !im.complete || !im.naturalWidth) return false;
  const w = im.naturalWidth * scale, h = im.naturalHeight * scale;
  // diem chan lay tu tam spr; mot so spr co tam nam ngoai khung da cat -> dung giua-duoi anh
  const okFoot = sz && sz[2] >= 0 && sz[2] <= im.naturalWidth && sz[3] >= im.naturalHeight * 0.5 && sz[3] <= im.naturalHeight * 1.2;
  const fx = okFoot ? sz[2] * scale : w / 2, fy = okFoot ? sz[3] * scale : h * 0.95;
  CX.save(); CX.globalAlpha = alpha; CX.translate(x, y); if (flip) CX.scale(-1, 1);
  CX.drawImage(im, -fx, -fy, w, h); CX.restore();
  return true;
}
/* ---------- hoat anh 8 huong (img/a/<npcres>_<hanh dong>.webp) ----------
   huong 0 = quay mat ve nguoi xem, tang theo chieu kim dong ho: N(am), TN, T, TB, B, DB, D, DN */
const dirOf = (vx, vy) => (((Math.round(Math.atan2(-vx, vy) / (Math.PI / 4)) % 8) + 8) % 8);
const ONCE = { at: 1, hurt: 1, die: 1 };
function animLen(key, act) { const m = W.anim && W.anim[key] && W.anim[key][act]; return m ? m.n * m.ms / 1000 : 0; }
function drawAnim(key, act, dir, t, x, y, sc, alpha = 1) {
  const set = W.anim && W.anim[key]; if (!set) return false;
  const m = set[act] || set.st; if (!m) return false;
  const im = img('img/a/' + m.f); if (!im.complete || !im.naturalWidth) return false;
  let fr = Math.floor(t * 1000 / m.ms); fr = ONCE[act] ? Math.min(fr, m.n - 1) : fr % m.n;
  const d = m.d >= 8 ? dir : Math.floor(dir * m.d / 8);
  CX.globalAlpha = alpha;
  CX.drawImage(im, fr * m.w, d * m.h, m.w, m.h, x - m.ax * sc, y - m.ay * sc, m.w * sc, m.h * sc);
  CX.globalAlpha = 1;
  return m.h * sc;
}
function setAct(o, act) { if (o.act !== act) { o.act = act; o.actT = 0; } }
function stepAct(o, dt, idle) { // het hoat anh mot lan (danh / trung don) -> ve trang thai nen
  o.actT = (o.actT || 0) + dt;
  if ((o.act === 'at' || o.act === 'hurt') && o.actT >= Math.max(0.25, animLen(o.animKey, o.act))) setAct(o, idle);
}
/* ten tren dau (nhan vat, quai, dong hanh): chu mot nen, vien den cho de doc tren moi nen ban do */
const NAME_COL = { boss: '#ffb070', elite: '#8fc6ff', normal: '#e8dcc8', hero: '#fff3c0', pet: '#9fe36a', gold: '#ffd24a' };
/* Nhan (ten + thanh mau) tren dau: xep vao hang cho, cuoi khung moi tranh chong: nhan nao de len nhan khac thi day len cao hon.
   y = diem sat dau; thanh mau nam duoi cung, ten ngay tren thanh. hp < 0: khong ve thanh. */
const LABELS = [];
function label(x, y, text, col, size, hp, barCol, sub, subCol) { LABELS.push({ x, y, text, col, size, hp, barCol, sub, subCol }); }   // sub: dong danh hieu phia tren ten
function flushLabels() {
  if (!LABELS.length) return;
  CX.textAlign = 'center'; CX.lineJoin = 'round';
  const placed = [];
  for (const L of LABELS.sort((a, b) => b.y - a.y)) {                 // tu duoi len: nhan thap giu cho, nhan cao day len khi de
    CX.font = `${L.size}px "IBM Plex Mono", monospace`; L.w = Math.max(CX.measureText(L.text).width, L.sub ? CX.measureText(L.sub).width : 0, 44); L.h = L.size + 4 + (L.hp >= 0 ? 7 : 0) + (L.sub ? L.size + 2 : 0);
    let y = L.y;
    for (let k = 0; k < 8; k++) { const hit = placed.find(p => Math.abs(p.x - L.x) < (p.w + L.w) / 2 && y > p.top && y - L.h < p.y); if (!hit) break; y = hit.top - 1; }
    L.py = y; L.top = y - L.h; placed.push({ x: L.x, w: L.w, y, top: L.top });
  }
  for (const L of LABELS) {
    const y = L.py, bw = Math.min(L.w, 56);
    if (L.hp >= 0) { CX.fillStyle = '#000c'; CX.fillRect(L.x - bw / 2 - 1, y - 6, bw + 2, 6); CX.fillStyle = L.barCol; CX.fillRect(L.x - bw / 2, y - 5, bw * clamp(L.hp, 0, 1), 4); }
    CX.font = `${L.size}px "IBM Plex Mono", monospace`; CX.lineWidth = 3; CX.strokeStyle = '#000c';
    const ty = y - (L.hp >= 0 ? 8 : 1); CX.strokeText(L.text, L.x, ty); CX.fillStyle = L.col; CX.fillText(L.text, L.x, ty);
    if (L.sub) { const sy = ty - L.size - 2; CX.font = `${L.size - 1}px "IBM Plex Mono", monospace`; CX.strokeText(L.sub, L.x, sy); CX.fillStyle = L.subCol || L.col; CX.fillText(L.sub, L.x, sy); }
  }
  LABELS.length = 0;
}
const enemyName = e => `${e.curse && typeof isCursed === 'function' && isCursed(e) ? '☠ ' : ''}${e.n} [${SERIES[e.series]}] · Lv${e.L}`;
function bar(x, y, w, h, f, col) { CX.fillStyle = '#000a'; CX.fillRect(x, y, w, h); CX.fillStyle = col; CX.fillRect(x, y, w * clamp(f, 0, 1), h); }
function draw(dt) {
  const c = CX; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, AR.w, AR.h);
  updateCamera(dt);
  c.setTransform(DPR, 0, 0, DPR, -Math.round(CAM.x) * DPR, -Math.round(CAM.y) * DPR);  // toa do the gioi
  const bg = R.bgImg;
  drawTiledBg(c, bg);
  // do roi tren dat: vien theo do hiem, ten cho do khop bo loc / mon dang chon
  c.textAlign = 'center';
  for (const d of R.town ? [] : R.ground) {
    const im = d.it.ic ? img(d.it.ic) : null, match = lootMatch(d.it), sel = R.pickTarget === d;
    const bob = Math.sin((d.age + d.x) * 3) * 1.5;
    c.fillStyle = '#0008'; c.beginPath(); c.ellipse(d.x, d.y + 2, 11, 4, 0, 0, 7); c.fill();
    c.strokeStyle = RAR_COL[d.it.r]; c.lineWidth = sel ? 2.5 : match ? 1.6 : 0.8; c.globalAlpha = match || sel ? 1 : 0.55;
    c.beginPath(); c.ellipse(d.x, d.y + 2, 12, 5, 0, 0, 7); c.stroke();
    if (im && im.complete && im.naturalWidth) { const k = Math.min(26 / im.naturalWidth, 26 / im.naturalHeight); c.drawImage(im, d.x - im.naturalWidth * k / 2, d.y - im.naturalHeight * k + bob, im.naturalWidth * k, im.naturalHeight * k); }
    if (match || sel || d.it.r >= 2) { c.font = '9px "IBM Plex Mono", monospace'; c.fillStyle = '#000'; c.fillText(d.it.n, d.x + 1, d.y - 27); c.fillStyle = RAR_COL[d.it.r]; c.fillText(d.it.n, d.x, d.y - 28); }
    c.globalAlpha = 1;
  }
  // xac quai: phat hoat anh chet roi mo dan
  for (const e of R.corpses) {
    e.actT += dt; const a = clamp(1.6 - e.actT, 0, 1);
    const sc = 1;   // nhu JX1: moi quai ve dung ti le goc nhu nhan vat (khong phong to trum / thu nho quai thuong)
    if (!(e.animKey && drawAnim(e.animKey, 'die', e.dir || 0, e.actT, e.x, e.y, sc * MON_SCALE, a))) { c.globalAlpha = a * 0.5; drawSprite(e.img, e.sz, e.x, e.y, sc, e.face < 0); c.globalAlpha = 1; }
  }
  R.corpses = R.corpses.filter(e => e.actT < 1.6);
  drawPet(c, dt);                                                           // dong hanh (rewards.js)
  // ke dich (sap theo y de nguoi o duoi ve sau)
  drawMount(c, dt);                                                         // bui phi ngua (horse.js)
  const ents = R.enemies.filter(e => !e.dead).concat([{ hero: true, y: H.y }], typeof othEnts === 'function' ? othEnts() : []).sort((a, b) => a.y - b.y);
  for (const e of ents) {
    if (e.oth) { othDraw(c, e.oth, dt); continue; }                        // nguoi choi khac (others.js)
    if (e.hero) {
      c.fillStyle = '#0007'; c.beginPath(); c.ellipse(H.x, H.y, 16, 6, 0, 0, 7); c.fill();
      const hw = heroGfx();
      H.animKey = hw && hw.anim;
      const mvx = H.x - (H.px ?? H.x), mvy = H.y - (H.py ?? H.y); H.px = H.x; H.py = H.y;
      H.moving = Math.hypot(mvx, mvy) > 0.4; if (H.moving && H.act !== 'at') H.dir = dirOf(mvx, mvy);
      stepAct(H, R.stunT > 0 ? 0 : R.slowT > 0 ? dt * ELEM_SLOW : dt, H.moving ? 'run' : 'st');   // choang: dung hinh; cham: hoat anh cham
      if (R.deadT > 0) setAct(H, 'die'); else if (H.act !== 'at' && H.act !== 'hurt') setAct(H, H.moving ? 'run' : 'st');
      drawAura(c);                                                          // hao quang do bo / cuong hoa (look.js)
      drawHeroStates(c, 'under', 0);                                        // trang thai vo cong duoi chan (skillfx.js)
      const hTint = entTint(R.slowT > 0, R.hpDotT > 0);
      const drawn = hw && hw.anim && drawTinted(hTint, H.x - 120, H.y - 220, 240, 245, () => drawHeroAnim(hw.anim, H.act || 'st', H.dir || 0, H.actT || 0, H.x, H.y, HERO_SCALE));   // nhuom mau theo ao / mu
      drawHeroStates(c, 'over', drawn ? Math.min(drawn, 90) : 60);
      drawLookFx(c, dt);
      const ny = H.y - (drawn ? Math.min(drawn, 90) * 0.9 : 52) - 6, tw = typeof titleWorn === 'function' && titleWorn();
      label(H.x, ny, `${S.name || (FAC[S.fac] && FAC[S.fac].n) || ''} · Lv${S.lvl}`, typeof campCol === 'function' ? campCol(S.fac) : NAME_COL.hero, 12, R.life / Math.max(1, R.P.life), '#4fd04f',
        tw ? `«${titleName(tw)}»` : '', tw ? TIER[tw[3]].c : '');   // danh hieu deo: dong tren ten (JX1)
      if (!drawn && !(hw && drawSprite(img(hw.img), hw.sz, H.x, H.y, 0.9, H.face < 0, R.deadT > 0 ? 0.35 : 1))) { c.fillStyle = SERIES_COL[heroSeries()]; c.beginPath(); c.arc(H.x, H.y - 20, 14, 0, 7); c.fill(); }
      if (R.stunT > 0) drawStun(H.x, H.y - (drawn ? Math.min(drawn, 90) * 0.85 : 52), HERO_SCALE);
      if (R.hurtT > 0) { c.fillStyle = '#f004'; c.beginPath(); c.arc(H.x, H.y - 24, 20, 0, 7); c.fill(); }
      continue;
    }
    const sc = 1;   // nhu JX1: moi quai ve dung ti le goc nhu nhan vat (khong phong to trum / thu nho quai thuong)
    c.fillStyle = '#0007'; c.beginPath(); c.ellipse(e.x, e.y, e.r, e.r * 0.38, 0, 0, 7); c.fill();
    c.strokeStyle = SERIES_COL[e.series]; c.lineWidth = e.cls === 'normal' ? 1.2 : 2.4; c.beginPath(); c.ellipse(e.x, e.y, e.r, e.r * 0.38, 0, 0, 7); c.stroke();
    e.animKey = MON[e.tid].anim; stepAct(e, e.stun > 0 ? 0 : e.slowT > 0 ? dt * ELEM_SLOW : dt, e.moving ? 'run' : 'st');   // choang: dung hinh; cham: hoat anh cham
    const eTint = entTint(e.slowT > 0, e.poison > 0);
    const ah = e.animKey && drawTinted(eTint, e.x - (e.cls === 'boss' ? 170 : 110), e.y - (e.cls === 'boss' ? 300 : 200), e.cls === 'boss' ? 340 : 220, e.cls === 'boss' ? 330 : 230, () => drawAnim(e.animKey, e.act || 'st', e.dir || 0, e.actT || 0, e.x, e.y, sc * MON_SCALE, e.hitT > 0 ? 0.75 : 1));
    if (e.curse) drawEnemyCurses(c, e, sc * MON_SCALE);                 // bua hai (skillsys.js)
    if (e.stFx) drawEnemyState(c, e, ah ? Math.min(ah, 110) : 50, sc * MON_SCALE, dt);   // trang thai do chieu gay ra (skillfx.js)
    if (!ah && !drawTinted(eTint, e.x - (e.cls === 'boss' ? 170 : 110), e.y - (e.cls === 'boss' ? 300 : 200), e.cls === 'boss' ? 340 : 220, e.cls === 'boss' ? 330 : 230, () => drawSprite(e.img, e.sz, e.x, e.y, sc, e.face < 0, e.hitT > 0 ? 0.6 : 1))) { c.fillStyle = SERIES_COL[e.series]; c.beginPath(); c.arc(e.x, e.y - e.r, e.r, 0, 7); c.fill(); }
    if (e.stun > 0) drawStun(e.x, e.y - (ah ? Math.min(ah, 110) * 0.85 : (e.img && e.img.naturalHeight ? e.img.naturalHeight : e.r * 2)), sc * MON_SCALE);
    if (e.hitT > 0) e.hitT -= dt;
    const top = e.y - (ah ? Math.min(ah, 90) * 0.85 : e.img && e.img.naturalHeight ? e.img.naturalHeight * sc : e.r * 2) - 8;
    label(e.x, top, enemyName(e), e.goldBoss ? NAME_COL.gold : NAME_COL[e.cls] || NAME_COL.normal, e.cls === 'boss' ? 12 : 11, e.hp / e.max, e.cls === 'boss' ? '#ff5030' : '#e03a2a');
    if (e.poison > 0) { c.fillStyle = '#8fe34a'; c.fillRect(e.x - 22, top + 5, 44 * e.poison / 3, 2); }
  }
  // hieu ung
  R.fx = R.fx.filter(f => { if (f.k === 'jm') { const ok = jmStep(f, dt); if (ok) jmDraw(f); return ok; } if (f.k !== 'mis' && f.k !== 'boom') return true; const ok = stepFx(f, dt); if (ok) drawFx(f); return ok; });   // jm: dan kieu JX1 (jxmis.js)
  if (R.fxQ && R.fxQ.length) { for (const q of R.fxQ) R.fx.push(q); R.fxQ.length = 0; }
  for (const f of R.fx) {
    if (f.k === 'mis' || f.k === 'boom' || f.k === 'jm') continue;
    f.life -= dt; const a = clamp(f.life / f.max, 0, 1);
    c.globalAlpha = a; c.strokeStyle = f.color;
    if (f.k === 'line') { c.lineWidth = 3; c.beginPath(); c.moveTo(f.x1, f.y1); c.lineTo(f.x2, f.y2); c.stroke(); }
    else { c.lineWidth = f.r ? 3 : 2; c.beginPath(); c.arc(f.x, f.y - (f.r ? 0 : 10), 8 + (1 - a) * (f.r || 30), 0, 7); c.stroke(); }
  }
  c.globalAlpha = 1; R.fx = R.fx.filter(f => f.life > 0);
  c.textAlign = 'center';
  flushLabels();                                                            // ten + thanh mau tren dau (chong chong nhau)
  for (const t of R.txt) { t.life -= dt; t.y -= 32 * dt; c.globalAlpha = clamp(t.life / 0.5, 0, 1); c.font = `${t.size}px "IBM Plex Mono", monospace`; c.fillStyle = '#000'; c.fillText(t.t, t.x + 1, t.y + 1); c.fillStyle = t.color; c.fillText(t.t, t.x, t.y); }
  c.globalAlpha = 1; R.txt = R.txt.filter(t => t.life > 0);
  c.setTransform(DPR, 0, 0, DPR, 0, 0);                                     // lop giao dien: toa do man hinh
  if (typeof drawJoystick === 'function') drawJoystick(c);
  drawMinimap(c);
  drawDgHud(c);                                                             // pho ban / boss tuan (dungeon.js)
  if (R.banner && R.banner.t > 0) {
    R.banner.t -= dt; c.globalAlpha = clamp(R.banner.t, 0, 1);
    c.fillStyle = '#000a'; c.fillRect(0, AR.h * 0.36, AR.w, 54);
    c.font = '20px \"IBM Plex Mono\", monospace'; c.fillStyle = '#f3d88a'; c.fillText(R.banner.text, AR.w / 2, AR.h * 0.36 + 26);
    c.font = '12px "IBM Plex Mono", monospace'; c.fillStyle = '#d8ccb4'; c.fillText(R.banner.sub, AR.w / 2, AR.h * 0.36 + 44);
    c.globalAlpha = 1;
  }
}
