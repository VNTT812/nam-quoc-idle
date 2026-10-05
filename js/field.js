/* ======================= BAI LUYEN CONG KIEU JX1 =======================
   Quai dat san khap ban do theo cum o cac diem co dinh (chi tren o di duoc, cung vung voi nhan vat). Moi con chet hoi sinh
   tai diem goc sau FLD_RESPAWN giay. Quai dung / di loanh quanh diem goc; nguoi choi vao tam nhin hoac danh trung thi duoi;
   bi keo xa diem goc qua FLD_LEASH thi quay ve va hoi day mau. Trum ban do co diem co dinh, hoi sinh sau FLD_BOSS_RESPAWN.
   Pho ban / thap / thuyen / boss tuan: giu che do theo phong (dgSpawn, towerSpawn). */
'use strict';
const FLD_RESPAWN = 20, FLD_BOSS_RESPAWN = 180, FLD_BOSS_FIRST = 60;   // giay
const FLD_CLUSTERS = 14, FLD_GAP = 300, FLD_SPREAD = 60, FLD_WANDER = 50;
const FLD_AGGRO = 260, FLD_LEASH = 650, FLD_ROUND_KILLS = 24;      // 24 con = 1 vong (nhiem vu "vong luyen cong", doi cap quai)
const fieldMode = () => !R.dg && !R.tower && !R.town && !window.NO_FIELD;   // NO_FIELD: chi de so sanh trong test
const fieldKey = () => `${OBS.key}|${zoneOf(Math.min(S.stage, STAGES)).id}|${S.diff}|${rebornN()}`;

/* vung den cua anh nen (ngoai ban do, vd goc Diem Thuong son): khong dat quai (lay mau anh nen thu nho 1/16) */
const VOIDC = { key: null, d: null };
function voidAt(x, y) {
  const im = R.bgImg; if (!im || !im.complete || !im.naturalWidth) return false;
  if (VOIDC.key !== im.src) { try { const w = Math.ceil(im.naturalWidth / 16), h = Math.ceil(im.naturalHeight / 16), c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(im, 0, 0, w, h); VOIDC.d = g.getImageData(0, 0, w, h); VOIDC.key = im.src; VOIDC.k = w / WORLD.w; } catch (e) { VOIDC.key = im.src; VOIDC.d = null; } }
  const D = VOIDC.d; if (!D) return false;
  const px = Math.floor(x * VOIDC.k), py = Math.floor(y * VOIDC.k); if (px < 0 || py < 0 || px >= D.width || py >= D.height) return true;
  const i = (py * D.width + px) * 4; return D.data[i] + D.data[i + 1] + D.data[i + 2] < 75;
}
/* diem ngau nhien di duoc (thanh phan lien thong chinh), cach nhau >= gap */
function fieldPoints(n, gap, avoid) {
  const out = [], g = OBS.g;
  for (let tries = 0; tries < n * 60 && out.length < n; tries++) {
    let x, y;
    if (g) { const k = irnd(0, g.gw * g.gh - 1); if (!g.ok[k]) continue; x = (k % g.gw + 0.5) * g.cw; y = (Math.floor(k / g.gw) + 0.5) * g.ch; if (!obsWalk(x, y)) continue; }
    else { x = rnd(150, WORLD.w - 150); y = rnd(150, WORLD.h - 150); }
    if (out.some(p => Math.hypot(p[0] - x, p[1] - y) < gap) || voidAt(x, y)) continue;
    if (avoid && Math.hypot(avoid[0] - x, avoid[1] - y) < 220) continue;
    out.push([x, y]);
  }
  return out;
}
function fieldBuild() {
  const z = zoneOf(Math.min(S.stage, STAGES)), dr = densRange();
  const centers = fieldPoints(FLD_CLUSTERS + 1, FLD_GAP, [H.x, H.y]);
  const pts = [];
  const eliteC = new Set(); while (eliteC.size < Math.min(4, centers.length - 1)) eliteC.add(irnd(1, centers.length - 1));   // it nhat 4 cum co tinh anh (nhiem vu Da Tau)
  centers.forEach(([cx, cy], ci) => {
    if (ci === 0) { pts.push({ x: cx, y: cy, cls: 'boss', tid: z.boss, t: FLD_BOSS_FIRST }); return; }   // diem trum: xuat hien sau 1 phut
    const n = Math.max(2, Math.round(irnd(dr[1], dr[2]) / 2)), tid = pick(z.m);   // moi cum 1 loai quai (kieu JX1)
    for (let i = 0; i < n; i++) {
      const [x, y] = inWorld(cx + rnd(-FLD_SPREAD, FLD_SPREAD), cy + rnd(-FLD_SPREAD, FLD_SPREAD) * 0.6);
      pts.push({ x, y, cls: i === 0 && (eliteC.has(ci) || Math.random() < 0.25) ? 'elite' : 'normal', tid, t: 0 });
    }
  });
  R.field = { key: fieldKey(), pts, kills: 0 };
  R.enemies = R.enemies.filter(e => (e.goldBoss || e.sat || e.satG) && !e.dead);   // giu Trum Hoang Kim, Sat Thu + ho ve khi dung lai bai
  for (const p of R.field.pts) if (p.t <= 0) fieldSpawn(p);
  const zz = z; if (zz.id !== R.zoneShown) { R.zoneShown = zz.id; R.banner = { t: 2.4, text: zz.n, sub: `Cấp ${zz.lo}–${zz.hi}` }; if (typeof onZoneChange === 'function') onZoneChange(zz); }
}
function fieldSpawn(p) {
  const L = stageLevel(S.stage) + (p.cls === 'boss' ? 1 : 0), e = makeEnemy(p.tid, L, p.cls, p.x, p.y);
  if (p.cls === 'normal') { e.dens = true; e.dmg *= DENS_DMG; }
  e.home = p; e.aggro = false; e.wT = rnd(0, 3); p.e = e; p.t = 0;
  R.enemies.push(e);
  if (p.cls === 'boss') { e.n = bossName(p.tid, zoneOf(Math.min(S.stage, STAGES)).n); log(`<b class="boss">${esc(e.n)}</b> xuất hiện!`); }
}
/* moi khung: dung lai bai khi doi ban do / cap / bi xoa quai; dem nguoc hoi sinh */
function fieldTick(dt) {
  const f = R.field;
  if (!f || f.key !== fieldKey() || (!R.enemies.length && f.pts.some(p => p.e && !p.e.dead))) { fieldBuild(); return; }
  for (const p of f.pts) {
    if (p.e && p.e.dead) { p.e = null; p.t = p.cls === 'boss' ? FLD_BOSS_RESPAWN : FLD_RESPAWN / mountHaste(); }
    if (!p.e && p.cls === 'boss' && p.t > 20) { const T = S.dt && S.dt.task; if (T && T.t === 'boss' && T.tid === p.tid && T.have < T.need) p.t = 20; }   // Da Tau can trum nay: xuat hien sau toi da 20 giay
    if (!p.e && (p.t -= dt) <= 0) {
      if (Math.hypot(H.x - p.x, H.y - p.y) < 90) { p.t = 1; continue; }   // khong moc ngay tren dau nhan vat
      fieldSpawn(p);
    }
  }
  if (R.enemies.length > 80 || R.enemies.some(e => e.dead)) R.enemies = R.enemies.filter(e => !e.dead);
  if (goldBossDue()) spawnGoldBoss();
}
/* hanh vi quai chua giao chien: dung / di loanh quanh diem goc; thay nguoi thi duoi */
function fieldIdle(e, dt) {
  const p = e.home, d = Math.hypot(H.x - e.x, H.y - e.y);
  if ((e.agT = (e.agT || 0) - dt) <= 0) { e.agT = 0.4; if (d < FLD_AGGRO && R.life > 0 && obsSee(e.x, e.y, H.x, H.y)) e.aggro = true; }
  if (e.aggro) return false;
  if (e.backT > 0) {                                      // dang quay ve diem goc
    e.backT -= dt; e.moving = true; obsSteer(e, p.x, p.y, e.spd * 1.6 * dt);
    if (Math.hypot(p.x - e.x, p.y - e.y) < 12) e.backT = 0;
    return true;
  }
  if ((e.wT -= dt) <= 0) { e.wT = rnd(2, 5); e.wx = p.x + rnd(-FLD_WANDER, FLD_WANDER); e.wy = p.y + rnd(-FLD_WANDER, FLD_WANDER) * 0.6; }
  const wd = e.wx != null ? Math.hypot(e.wx - e.x, e.wy - e.y) : 0;
  e.moving = wd > 4; if (e.moving) { obsMove(e, e.x + (e.wx - e.x) / wd * Math.min(wd, e.spd * 0.4 * dt), e.y + (e.wy - e.y) / wd * Math.min(wd, e.spd * 0.4 * dt)); e.face = e.wx >= e.x ? 1 : -1; e.dir = dirOf(e.wx - e.x, e.wy - e.y); }
  return true;
}
/* bi keo xa diem goc: bo duoi, quay ve, hoi day mau (nhu JX1) */
function fieldLeash(e) {
  const p = e.home; if (!p || !e.aggro || e.cls === 'boss') return;
  if (Math.hypot(p.x - e.x, p.y - e.y) > FLD_LEASH && Math.hypot(H.x - e.x, H.y - e.y) > 160) { e.aggro = false; e.backT = 6; e.hp = e.max; e.poison = 0; e.slowT = 0; }
}
function fieldOnKill() {
  const f = R.field; if (!f || !fieldMode()) return;
  if (++f.kills % FLD_ROUND_KILLS) return;
  R.round = (R.round || 0) + 1; questTick('stages');
  if (typeof onStageChange === 'function') onStageChange();
}
