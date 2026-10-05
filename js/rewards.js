/* ======================= PHAN THUONG NGOAI GAME GOC (docs/DE_XUAT.md) =======================
   1 diem danh 7/30 ngay · 2 nhiem vu ngay · 3 thanh tuu + danh hieu · 4 trum Hoang Kim dinh ky · 5 thuong offline theo moc
   6 thap thu thach · 7 chuyen sinh (toi da 5 lan) · 8 dong hanh · 9 su kien theo mua · 10 ruong Phuc Duyen */
'use strict';
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const today = () => dayKey(new Date());
const GB_EVERY = 1800, GB_RETRY = 300;     // trum Hoang Kim: moi 30 phut choi; thua thi 5 phut sau quay lai
const REBORN_LV = 200, REBORN_MAX = 5;   // chuyen sinh khi dat cap 200
const FD_COST = 10;
function RW() { // trang thai phan thuong trong file luu (tao / bo sung truong khi nap file cu)
  const r = S.rw || (S.rw = {});
  r.stat = Object.assign({ kills: 0, bosses: 0, goldBoss: 0, picked: 0, towerBest: 0, reborn: 0, chests: 0, tokens: 0 }, r.stat || {});
  r.login = Object.assign({ last: '', streak: 0, total: 0, got: {}, claimed: true }, r.login || {});
  r.ach = r.ach || {}; r.title = r.title || ''; r.fd = r.fd || 0; if (r.gbT == null) r.gbT = GB_EVERY;
  r.pet = r.pet || null;
  return r;
}

/* ---------- phan thuong chung ---------- */
const potTierNow = t => { let b = t || 1; for (let k = 1; k < POT_TIER_LV.length; k++) if (S.lvl >= POT_TIER_LV[k]) b = Math.max(b, k); return b; };
function grant(g, why) {
  const out = [];
  if (g.gold) { const v = Math.round(g.gold * (1 + S.lvl / 10)); S.gold += v; out.push(`${fmt(v)} lượng`); }
  if (g.pot) { const tier = potTierNow(g.pot.tier), st = potStock(g.pot.kind), pp = J.potions.find(x => x.kind === g.pot.kind && x.tier === tier); st[tier] = (st[tier] || 0) + g.pot.n; out.push(`${g.pot.n} ${pp ? pp.n : 'bình thuốc'}`); }   // bac thuoc theo cap nhan vat
  if (g.ht) { const hl = clamp(Math.floor(S.lvl / 15) + 1, 1, HT_MAX); matAdd('ht', hl, g.ht); out.push(`${g.ht} Huyền Tinh cấp ${hl}`); }
  if (g.fd) { RW().fd += g.fd; out.push(`${g.fd} Phúc Duyên`); }
  if (g.knb) { S.knb = (S.knb || 0) + g.knb; out.push(`${g.knb} Kim Nguyên Bảo`); }
  if (g.item) { const it = (() => { const d = irnd(0, 9); return makeItem(d, sexPart(d, 0), clamp(Math.round(S.lvl / 12) + 1, 1, 10), g.item); })(); if (it) { addItem(it, true, true, true); out.push(esc(it.n)); } }
  if (g.set && !g.common && goldMul('grant') < 1 && Math.random() >= goldMul('grant')) {   // lo trinh 3: thay do Hoang Kim bang 2 manh
    const it = phoiFromDrop(S.lvl + 5); if (it) { addItem(it, true, true, true); out.push(`<b style="color:${RAR_COL[3]}">Phôi Tím ${esc(it.n)} (${it.vslots} dòng)</b>`); }   // do Tim la do chinh
    const hl = clamp(Math.floor(S.lvl / 15) + 1, 1, HT_MAX); matAdd('ht', hl, 2); out.push(`2 Huyền Tinh cấp ${hl}`);
  } else if (g.set) { const it = forceSetItem(g.common); if (it) { addItem(it, true, true, true); out.push(`<b style="color:${RAR_COL[it.r]}">${esc(it.n)}</b>`); } }
  if (g.pts) { S.attrPts += g.pts; out.push(`${g.pts} điểm tiềm năng`); }
  if (g.buff) for (const k in g.buff) { const [p, m] = g.buff[k]; addBuff(k, p, m); out.push(`${BUFF_VI[k]} +${Math.round(p * 100)}% trong ${m} phút`); }
  if (g.xp && S.lvl < levelCap()) { const lv0 = S.lvl; gainXp(J.exp[S.lvl - 1] * g.xp * xpSlow(S.lvl)); out.push(S.lvl > lv0 ? `kinh nghiệm (lên cấp ${S.lvl})` : `${Math.round(g.xp * 1000) / 10}% kinh nghiệm`); }
  if (g.misc) for (const k in g.misc) if (g.misc[k] > 0) { matAdd('misc', k, g.misc[k]); out.push(`<b style="color:#ffd24a">${g.misc[k]} ${miscName(k)}</b>`); }
  if (out.length && !R.batch) { log(`🎁 ${esc(why)}: ${out.join(', ')}`); if (!R.quiet) uiSfx('learn'); save(); }   // R.batch: mo ruong hang loat, gom 1 dong tong ket
  return out;
}
const EVENT_GOLD = /^(An Bang|Định Quốc|Hiệp Cốt|Nhu Tình|Kim Phong|Thiên Hoàng|Động Sát)/i;   // Hoang Kim dung chung kinh dien (khong ban [Tinh Xao] / [Cuc pham] / [Phong che]...)
function forceSetItem(common) { // do bo Hoang Kim cua phai (common: Hoang Kim dung chung - Kim Phong, An Bang, Dinh Quoc...), cap yeu cau gan cap nhan vat
  const fid = FAC[S.fac] ? FAC[S.fac].id : -1, cap = S.lvl + 15;
  const req = (r, id) => (r.req.find(q => q[0] === id) || [0, -1])[1];
  const G = J.sets.gold.filter(r => sexReqOk(r.req) && setRowOk(r) && setVerOk(r, S.lvl));
  if (common) { const C = J.sets.gold.filter(r => sexReqOk(r.req) && setRowOk(r) && req(r, 39) < 0 && EVENT_GOLD.test(r.n)); const c1 = C.filter(r => req(r, 36) <= cap && setVerOk(r, S.lvl)), c2 = C.filter(r => req(r, 36) <= cap);
    const pc = c1.length ? c1 : c2.length ? c2 : C; return pc.length ? makeSetItem('gold', pick(pc), 5) : null; }
  let pool = G.filter(r => req(r, 39) === fid && req(r, 36) <= cap);
  if (!pool.length) pool = G.filter(r => req(r, 36) <= cap);
  if (!pool.length) pool = G.filter(r => req(r, 39) === fid);
  return pool.length ? makeSetItem('gold', pick(pool), 5) : null;
}

/* ---------- 1. diem danh 7 ngay (vong lap) + moc 10/20/30 ngay ---------- */
const LOGIN7 = [{ gold: 500, knb: 1 }, { pot: { kind: 'life', tier: 1, n: 20 } }, { gold: 1000, fd: 10, knb: 1 }, { pot: { kind: 'mana', tier: 1, n: 20 }, ht: 2 }, { item: 5, ht: 2 }, { gold: 2000, fd: 15, knb: 2 }, { set: 1, fd: 30, knb: 5 }];
const LOGIN30 = { 10: { gold: 5000, pts: 10, knb: 10 }, 20: { set: 1, pts: 20, knb: 15 }, 30: { set: 1, fd: 80, pts: 30, knb: 25 } };
function loginCheck() {
  if (!S || !S.fac) return;
  const L = RW().login, t = today();
  if (L.last === t) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  L.streak = L.last === dayKey(y) ? L.streak + 1 : 1;
  L.last = t; L.total++; L.claimed = false;
  if (RW().dq) delete RW().dq; dotGift();
}
function claimLogin() {
  const L = RW().login; if (L.claimed) return;
  L.claimed = true;
  grant(LOGIN7[(L.streak - 1) % 7], `Điểm danh ngày ${L.streak}`);
  const m = LOGIN30[L.total]; if (m && !L.got[L.total]) { L.got[L.total] = 1; grant(m, `Điểm danh ${L.total} ngày`); }
  achCheck();
}

/* ---------- 1b. qua moc cap (nhan 1 lan, khong nhan lai sau chuyen sinh): chu yeu tieu hao + tien loi,
   chi so vinh vien chi la vai diem tiem nang -> khong lam lech can bang giua cac phai ---------- */
const LV_MS = [
  [10, { gold: 500, pot: { kind: 'life', tier: 1, n: 20 }, knb: 2 }, 'Mở khóa: tháp thử thách'],
  [20, { gold: 1000, pot: { kind: 'mana', tier: 1, n: 20 }, fd: 10, knb: 2 }, 'Mở khóa: đồng hành'],
  [30, { item: 5, fd: 10, ht: 2, knb: 3 }, ''],
  [40, { gold: 2500, pot: { kind: 'life', tier: 1, n: 20 }, pts: 3, ht: 2, knb: 3 }, ''],
  [50, { item: 6, fd: 15, ht: 3, knb: 5 }, 'Danh hiệu «Thiếu hiệp»'],
  [60, { gold: 5000, pot: { kind: 'mana', tier: 1, n: 20 }, pts: 3, ht: 3, knb: 5 }, ''],
  [70, { set: 1, fd: 20, ht: 3, knb: 5 }, ''],
  [80, { gold: 8000, pot: { kind: 'life', tier: 1, n: 20 }, pts: 4, ht: 4, knb: 6 }, ''],
  [90, { item: 6, fd: 20, ht: 4, knb: 10, buff: { xp: [0.3, 30] } }, ''],
  [95, { set: 1, fd: 25, pts: 5, ht: 4, knb: 6 }, 'Danh hiệu «Đại hiệp»'],
  [97, { gold: 15000, pot: { kind: 'both', tier: 1, n: 20 }, fd: 20, knb: 6 }, ''],
  [99, { set: 1, fd: 30, pts: 5, ht: 5, knb: 8 }, 'Danh hiệu «Tông sư»'],
  [110, { fd: 30, ht: 5, knb: 8, buff: { xp: [0.5, 30] } }, ''],
  [120, { set: 1, fd: 30, pts: 5, ht: 5, knb: 8, buff: { drop: [0.5, 30] } }, ''],
  [135, { item: 6, fd: 40, ht: 6, knb: 10, buff: { xp: [0.5, 45] } }, ''],
  [150, { set: 1, fd: 50, pts: 8, ht: 6, knb: 12, buff: { xp: [1, 30] } }, ''],
  [165, { fd: 50, ht: 6, knb: 10, buff: { drop: [1, 30] } }, ''],
  [180, { set: 1, fd: 60, pts: 10, ht: 8, knb: 12, buff: { xp: [1, 45] } }, ''],
  [190, { set: 1, fd: 60, ht: 8, knb: 12, buff: { drop: [1, 45] } }, ''],
  [200, { set: 1, fd: 100, pts: 15, ht: 10, knb: 25, buff: { xp: [1, 60], drop: [1, 60] } }, 'Cấp tối đa · mở khóa chuyển sinh'],
];
/* Moc cap sau moi lan chuyen sinh (nhan lai moi vong): chu yeu hieu ung tang kinh nghiem / roi do de len lai cap 200 nhanh hon */
const LV_MS_RB = [
  [10, { fd: 15, knb: 3, buff: { xp: [0.5, 30] } }, ''],
  [30, { item: 6, fd: 15, ht: 3, knb: 4, buff: { drop: [0.5, 30] } }, ''],
  [50, { set: 1, fd: 20, ht: 4, knb: 6, buff: { xp: [0.5, 45] } }, ''],
  [80, { fd: 25, ht: 5, knb: 6, buff: { xp: [1, 30] } }, ''],
  [100, { set: 1, pts: 5, ht: 6, knb: 8, buff: { drop: [1, 30] } }, ''],
  [130, { set: 1, fd: 40, ht: 6, knb: 8, buff: { xp: [1, 45] } }, ''],
  [160, { set: 1, fd: 50, pts: 8, ht: 8, knb: 10, buff: { xp: [1, 45], drop: [1, 45] } }, ''],
  [200, { set: 1, fd: 100, pts: 15, ht: 10, knb: 20, buff: { xp: [1.5, 60], drop: [1, 60] } }, 'Mở khóa chuyển sinh lần sau'],
];
const lvMsList = () => (rebornN() ? LV_MS_RB : LV_MS);
const lvKey = lv => (rebornN() ? rebornN() + ':' + lv : lv);
const TOWER_LV = 10, PET_LV = 20;
const unlocked = lv => S.lvl >= lv || RW().stat.reborn > 0;
function lvMsReady() { const g = RW().lvGot || {}; return lvMsList().filter(([lv]) => S.lvl >= lv && !g[lvKey(lv)]); }
function claimLvMs(lv) {
  const r = RW(), m = lvMsList().find(x => x[0] === lv); r.lvGot = r.lvGot || {};
  if (!m || S.lvl < lv || r.lvGot[lvKey(lv)]) return;
  r.lvGot[lvKey(lv)] = 1; grant(m[1], `Mốc cấp ${lv}${rebornN() ? ` (chuyển sinh ${rebornN()})` : ''}`); achCheck(); refreshGift();
}
/* ---------- hieu ung tam thoi: tang kinh nghiem / ti le roi do trong N phut (thoi gian thuc) ---------- */
const BUFF_VI = { xp: 'Kinh nghiệm', drop: 'Tỉ lệ rơi đồ', tt: 'Tiên Thảo Lộ', luck: 'May mắn' }, BUFF_IC = { xp: '⏫', drop: '🎲', tt: '🌿', luck: '🍶' };
const BUF = () => S.buf || (S.buf = {});
function buffP(k) { const b = S && S.buf && S.buf[k]; return b && b.until > Date.now() ? b.p : 0; }
function addBuff(k, p, min) {
  const b = BUF(), now = Date.now(), cur = b[k];
  if (cur && cur.until > now) b[k] = p >= cur.p ? { p, until: cur.until + min * 60000 } : { p: cur.p, until: cur.until + min * 60000 * p / cur.p };   // cong don thoi gian
  else b[k] = { p, until: now + min * 60000 };
}
function buffText() {
  const now = Date.now(), out = [];
  for (const k in BUFF_VI) { const b = S.buf && S.buf[k]; if (!b || b.until <= now) continue; const s = Math.round((b.until - now) / 1000);
    out.push(`${BUFF_IC[k]} ${BUFF_VI[k]} +${k === 'luck' ? Math.round(b.p) : Math.round(b.p * 100) + '%'} <small class="dim">${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</small>`); }
  return out.join(' · ');
}

/* ---------- 2. (nhiem vu ngay da bo) questTick chi con dem so do da nhat cho thong ke / thanh tuu ---------- */
function questTick(k, n = 1) { if (S && S.fac && k === 'picked') RW().stat.picked += n; }

/* ---------- 3. thanh tuu + danh hieu (deo 1 danh hieu: cong chi so nho) ---------- */
const ACH = [
  ['lv30', 'Xuất sơn', () => S.lvl >= 30 || RW().stat.reborn > 0, { gold: 1000, knb: 2 }, ['lifemax_p', 3]],
  ['lv50', 'Thiếu hiệp', () => (RW().lvGot || {})[50], { fd: 10, knb: 3 }, ['lifemax_p', 4]],
  ['lv80', 'Danh chấn giang hồ', () => S.lvl >= 80 || RW().stat.reborn > 0, { gold: 5000, pts: 10, knb: 5 }, ['attackspeed_v', 3]],
  ['lv100', 'Đại hiệp', () => (RW().lvGot || {})[95] || (RW().lvGot || {})[100], { fd: 20, knb: 5 }, ['allres_p', 4]],
  ['lv150', 'Tông sư', () => (RW().lvGot || {})[99] || (RW().lvGot || {})[150], { fd: 30, knb: 8 }, ['allres_p', 6]],
  ['k1000', 'Sát thủ', () => RW().stat.kills >= 1000, { fd: 10, knb: 2 }, ['manamax_p', 4]],
  ['k10000', 'Vạn nhân địch', () => RW().stat.kills >= 10000, { set: 1, knb: 5 }, ['attackspeed_v', 5]],
  ['b50', 'Diệt trùm', () => RW().stat.bosses >= 50, { fd: 20, ht: 3, knb: 3 }, ['allres_p', 3]],
  ['zone8', 'Nửa giang sơn', () => S.maxStage >= STAGES / 2, { gold: 8000, knb: 3 }, ['fastwalkrun_p', 5]],
  ['zone16', 'Trường Bạch sơn chủ', () => S.maxStage > STAGES, { set: 1, pts: 20, knb: 10 }, ['lifemax_p', 6]],
  ['setfull', 'Hoàng Kim đủ bộ', () => enoughToActive(S.eq), { fd: 30, knb: 10 }, ['allres_p', 5]],
  ['tower20', 'Leo tháp tầng 20', () => RW().stat.towerBest >= 20, { set: 1, knb: 5 }, ['attackspeed_v', 6]],
  ['reborn1', 'Chuyển sinh', () => RW().stat.reborn >= 1, { fd: 50, knb: 20 }, ['lifemax_p', 8]],
  ['gold5', 'Săn trùm Hoàng Kim', () => RW().stat.goldBoss >= 5, { fd: 20, ht: 4, knb: 8 }, ['lucky_v', 10]],
  ['login30', 'Giang hồ lão luyện', () => RW().login.total >= 30, { set: 1, knb: 10 }, ['manamax_p', 6]],
];
function achCheck() {
  if (!S || !S.fac) return;
  const r = RW();
  for (const [id, n, ok, reward] of ACH) if (!r.ach[id] && ok()) { r.ach[id] = 1; grant(reward, `Thành tựu «${n}»`); if (!R.quiet) toast(`Thành tựu: ${n}`); dotGift(); }
  if (typeof titleCheck === 'function') titleCheck();
}
/* danh hieu: title.js (titleAttr, titleCheck, titleModal) */

/* ---------- 4. trum Hoang Kim dinh ky ---------- */
function goldBossTick(dt) { if (S.fac && !R.town && !R.tower && !R.dg) RW().gbT -= dt; }
function goldBossDue() { return !R.tower && !R.dg && RW().gbT <= 0; }
function spawnGoldBoss() {
  // cap trum khong vuot cap nhan vat + 2 (nhip len cap cham: nhan vat thuong danh ai cao hon cap minh)
  const z = zoneOf(Math.min(S.stage, STAGES)), L = Math.min(stageLevel(S.stage), S.lvl) + 2, [x, y] = inWorld(H.x + 240, H.y - 120);
  const e = makeEnemy(z.boss, L, 'boss', x, y);
  e.hp = e.max = e.max * 2; e.dmg *= 1.15; e.goldBoss = true; e.n = 'Trùm Hoàng Kim · ' + bossName(z.boss, z.n);
  R.enemies.push(e); RW().gbT = GB_EVERY;
  R.banner = { t: 2.5, text: 'Trùm Hoàng Kim xuất hiện!', sub: 'Hạ để nhận đồ Hoàng Kim' }; log('<b style="color:#ffb52e">Trùm Hoàng Kim xuất hiện!</b>');
}

/* ---------- 5. thuong offline theo moc 1 / 4 / 8 gio ---------- */
function offlineChests(secs) {
  let n = 0;
  if (secs >= 3600) { grant({ gold: 500, pot: { kind: 'life', tier: 2, n: 5 } }, 'Tu luyện 1 giờ'); n++; }
  if (secs >= 4 * 3600) { grant({ gold: 1500, fd: 10 }, 'Tu luyện 4 giờ'); n++; }
  if (secs >= 8 * 3600 - 60) { grant({ set: 1, fd: 20 }, 'Tu luyện 8 giờ'); n++; }
  return n;
}

/* ---------- 6. thap thu thach (Phong Ky) ---------- */
function towerStart() {
  if (R.dg) { toast('Đang ở phó bản'); return; }
  if (R.town) backFromTown();
  R.tower = { floor: Math.max(1, RW().stat.towerBest - 4) }; R.enemies = []; R.corpses = []; R.spawnT = 0.5;
  R.banner = { t: 2, text: `Tháp thử thách · tầng ${R.tower.floor}`, sub: 'Gục ngã là rời tháp' }; closeModal(true);
}
const towerLevel = f => Math.min(levelCap(), 10 + f * 4);
function towerSpawn() {
  const f = R.tower.floor, L = towerLevel(f), z = ZONES[Math.min(ZONES.length - 1, Math.floor(f / 3))], boss = f % 5 === 0;
  R.enemies = []; R.stall = 0;
  const n = boss ? 1 : 3 + (f % 3);
  for (let i = 0; i < n; i++) { const [x, y] = inWorld(H.x + rnd(-260, 260), H.y + rnd(-220, 220)); R.enemies.push(makeEnemy(boss ? z.boss : pick(z.m), L, boss ? 'boss' : 'elite', x, y)); }
}
function towerCleared() {
  const r = RW(), f = R.tower.floor;
  if (f > r.stat.towerBest) { r.stat.towerBest = f; grant(f % 5 === 0 ? { set: 1, fd: 10 } : { gold: 200 * f, fd: 2 }, `Tháp tầng ${f}`); }
  questTick('tower'); achCheck();
  heal(R.P.life * 0.3, true); R.mana = Math.min(R.P.mana, R.mana + R.P.mana * 0.3);
  R.tower.floor++; R.spawnT = 1.5; R.banner = { t: 1.5, text: `Tầng ${R.tower.floor}`, sub: `Quái cấp ${towerLevel(R.tower.floor)}` };
}
function towerExit(dead) {
  if (!R.tower) return;
  log(`${dead ? 'Gục ở' : 'Rời'} tháp thử thách tầng ${R.tower.floor}. Kỷ lục: ${RW().stat.towerBest}`);
  R.tower = null; R.enemies = []; S.wave = 1; R.spawnT = 0.5; R.zoneShown = null;
}

/* ---------- 7. chuyen sinh (level_exp.txt co 5 cot chuyen sinh -> toi da 5 lan) ---------- */
/* Moi lan chuyen sinh: quai manh them (mau +25%, sat thuong +15%), thuong them diem tiem nang + ky nang */
const REB_HP = 0.25, REB_DMG = 0.15, REB_ATTR = 50, REB_SK = 10;
function rebornHard() { const n = S && S.rw && S.rw.stat ? S.rw.stat.reborn || 0 : 0; return { hp: 1 + REB_HP * n, dmg: 1 + REB_DMG * n }; }
function rebornBonus() { const n = S.rw && S.rw.stat ? S.rw.stat.reborn || 0 : 0; return { xp: 0.2 * n, dmg: 0.1 * n }; }
function doReborn() {
  const r = RW();
  if (S.lvl < REBORN_LV || r.stat.reborn >= REBORN_MAX) return;
  if (!confirm('Chuyển sinh: về cấp 1, giữ trang bị. Toàn bộ điểm tiềm năng và kỹ năng cũ bị tẩy (giữ nguyên võ công 90 đã luyện), nhận điểm thưởng chuyển sinh. Quái mạnh hơn. Tiếp tục?')) return;
  r.stat.reborn++;
  const n = r.stat.reborn, st = FAC[S.fac].starter, bk = S.bkOk || (S.bkOk = {});
  for (const id in S.sk) if (SK[id] && SK[id].book) bk[id] = 1;                     // vo cong da linh ngo bang Mat Tich: hoc lai khong can sach
  S.lvl = 1; S.xp = 0; S.attr = { str: 0, dex: 0, vit: 0, eng: 0 }; S.attrPts = n * REB_ATTR;
  const keep90 = {}; for (const id in S.sk) if (SK[id] && SK[id].tier === 90 && S.sk[id] > 0 && !(typeof isBr90 === 'function' && isBr90(id))) keep90[id] = S.sk[id];   // vo cong 90 la ky nang luyen (khong dung diem): giu nguyen cap
  S.sk = Object.assign({}, keep90); S.skPts = n * REB_SK; if (st) { S.sk[st] = 1; S.main = st; } S.mainLock = false; S.slots = [0, 0, 0, 0];
  S.stage = 1; S.wave = 1; R.tower = null; R.enemies = []; R.dirty = true; R.zoneShown = null;
  log(`<b class="up">Chuyển sinh lần ${n}!</b> Tẩy toàn bộ điểm cũ (giữ võ công 90${Object.keys(keep90).length ? ': ' + Object.keys(keep90).map(id => SK[id].n + ' ' + keep90[id]).join(', ') : ''}), nhận ${n * REB_ATTR} tiềm năng + ${n * REB_SK} điểm kỹ năng · +${n * 20}% kinh nghiệm, +${n * 10}% sát thương · quái +${Math.round(REB_HP * n * 100)}% máu, +${Math.round(REB_DMG * n * 100)}% sát thương`);
  if (S.autoPts === true) { autoSpendAttrs(); autoSpendSkills(); }
  else if (gearReqPlan().total) toast('Bấm Gợi ý ở thẻ Nhân vật: cộng đủ điểm cho bộ đồ đang mặc');
  if (typeof fillSlots === 'function') { fillSlots(); renderPad(); }
  achCheck(); closeModal(true); refresh(); save();
}

/* ---------- 8. dong hanh (thu nuoi danh cung, len cap theo quai ha) ---------- */
function petChoices() {
  const zs = ZONES.slice(0, zoneIdx(Math.min(S.maxStage, STAGES)) + 1);
  return [...new Set(zs.flatMap(z => z.m))].filter(t => MON[t] && MON[t].anim).slice(0, 12);
}
function petAdopt(tid) { const old = RW().pet; RW().pet = { tid, lvl: old ? old.lvl : 1, xp: old ? old.xp : 0 }; R.petPos = null; toast('Đồng hành: ' + MON[tid].n); save(); if ($('#actTabs')) actModal(); }
function petDmg(p) { return (6 + p.lvl * 5) * (1 + p.lvl * 0.04) * (1 + rebornBonus().dmg); }
function petTick(dt) {
  const p = S.rw && S.rw.pet; if (!p || R.town || !MON[p.tid]) { R.petPos = null; return; }
  const pp = R.petPos || (R.petPos = { x: H.x - 30, y: H.y + 10, t: 0, act: 'st', actT: 0, dir: 0 });
  const t = alive().sort((a, b) => Math.hypot(a.x - pp.x, a.y - pp.y) - Math.hypot(b.x - pp.x, b.y - pp.y))[0];
  const goal = t || { x: H.x - 36, y: H.y + 12 }, d = Math.hypot(goal.x - pp.x, goal.y - pp.y), reach = t ? t.r + 14 : 10;
  pp.moving = d > reach;
  if (pp.moving) { const k = Math.min(1, 170 * dt / d); pp.dir = dirOf(goal.x - pp.x, goal.y - pp.y); pp.x += (goal.x - pp.x) * k; pp.y += (goal.y - pp.y) * k; }
  if (Math.hypot(H.x - pp.x, H.y - pp.y) > 500) { pp.x = H.x - 30; pp.y = H.y + 10; }   // lac xa: dich chuyen ve canh chu
  pp.t -= dt;
  if (t && !pp.moving && pp.t <= 0) { pp.t = 1.2; const dmg = petDmg(p); t.hp -= dmg; t.hitT = 0.1; pp.act = 'at'; pp.actT = 0; pp.dir = dirOf(t.x - pp.x, t.y - pp.y); addText(t.x, t.y - 30, fmt(dmg), '#9fe36a', 11); }
}
function petGainXp(n) {
  const p = S.rw && S.rw.pet; if (!p) return;
  p.xp += n; const need = 20 + p.lvl * 12;
  if (p.xp >= need) { p.xp -= need; p.lvl++; log(`Đồng hành ${esc(MON[p.tid].n)} lên cấp ${p.lvl}`); }
}
function drawPet(c, dt) {
  const p = S.rw && S.rw.pet, pp = R.petPos; if (!p || !pp || !MON[p.tid]) return;
  pp.animKey = MON[p.tid].anim; stepAct(pp, dt, pp.moving ? 'run' : 'st'); if (pp.act !== 'at') setAct(pp, pp.moving ? 'run' : 'st');
  c.fillStyle = '#0007'; c.beginPath(); c.ellipse(pp.x, pp.y, 10, 4, 0, 0, 7); c.fill();
  drawAnim(pp.animKey, pp.act || 'st', pp.dir || 0, pp.actT || 0, pp.x, pp.y, 0.75 * MON_SCALE);
  label(pp.x, pp.y - 42, `${MON[p.tid].n} · Lv${p.lvl}`, NAME_COL.pet, 10, -1);
}

/* ---------- 9. su kien theo mua (theo thang hien tai) ---------- */
function eventNow() {
  const m = new Date().getMonth() + 1;
  if (m === 1 || m === 2) return { n: 'Tết Nguyên Đán', token: 'Bánh Chưng', col: '#ff5a4a' };
  if (m === 9 || m === 10) return { n: 'Tết Trung Thu', token: 'Bánh Trung Thu', col: '#ffd24a' };
  if (m === 12) return { n: 'Giáng Sinh', token: 'Chuông Bạc', col: '#9fe3ff' };
  return { n: 'Hội Võ Lâm', token: 'Lệnh Bài Võ Lâm', col: '#c8a2ff' };
}
const EVENT_SHOP = [[10, { gold: 2000 }], [15, { knb: 2 }], [20, { pot: { kind: 'both', tier: 1, n: 20 } }], [25, { ht: 3 }], [30, { item: 6 }], [40, { fd: 30 }], [50, { knb: 8 }], [60, { set: 1, common: 1 }]];   // su kien: Hoang Kim dung chung (Kim Phong, An Bang, Dinh Quoc, Hiep Cot, Nhu Tinh...), luon ra do
function eventBuy(i) {
  const [cost, g] = EVENT_SHOP[i], st = RW().stat;
  if (st.tokens < cost) { toast(`Cần ${cost} ${eventNow().token}`); return; }
  st.tokens -= cost; grant(g, eventNow().n); refreshGift();
}

/* ---------- 10. ruong Phuc Duyen ---------- */
const FD_TABLE = [[30, { gold: 1000 }], [8, { knb: 1 }], [16, { pot: { kind: 'life', tier: 1, n: 10 } }], [12, { pot: { kind: 'mana', tier: 1, n: 10 } }], [12, { ht: 1 }], [10, { item: 5 }], [7, { item: 6 }], [4, { pts: 5 }], [1, { set: 1 }]];
/* Mo nhieu ruong mot lan (x10, x100, het): gom ket qua thanh 1 dong nhat ky + 1 hop thoai tong ket */
function openChestMany(n) {
  const r = RW(); n = Math.min(n, Math.floor(r.fd / FD_COST)); if (n < 1) { toast(`Cần ${FD_COST} điểm Phúc Duyên`); return; }
  if (n === 1) { openChest(); return; }
  const g0 = S.gold, cnt = {}, items = [], inv0 = S.inv.length; R.batch = true;
  try {
    for (let i = 0; i < n; i++) {
      r.fd -= FD_COST; r.stat.chests++;
      for (const t of grant(wpick(FD_TABLE, x => x[0])[1], 'Rương Phúc Duyên')) {
        if (/lượng$/.test(t)) continue;
        if (/^<b|^[^\d]/.test(t) && !/^\d+ (Kim Sáng|Ngưng Thần|Phúc Duyên|điểm)/.test(t)) { items.push(t); continue; }
        const m = t.match(/^(\d+) (.+)$/); if (m) cnt[m[2]] = (cnt[m[2]] || 0) + +m[1]; else cnt[t] = (cnt[t] || 0) + 1;
      }
    }
  } finally { R.batch = false; }
  const gold = S.gold - g0, sets = items.filter(t => t.startsWith('<b'));
  const parts = [gold > 0 ? `${fmt(gold)} lượng` : ''].concat(Object.entries(cnt).map(([k, v]) => `${v} ${k}`)).filter(Boolean);
  if (items.length) parts.push(`${items.length} món đồ${sets.length ? ` (${sets.length} Hoàng Kim)` : ''}`);
  log(`🎁 Mở ${n} rương Phúc Duyên: ${parts.join(', ')}${sets.length ? ' · ' + sets.join(', ') : ''}`);
  uiSfx('learn'); achCheck(); save(); refreshGift();
  const lost = items.length - (S.inv.length - inv0);
  modal(`<h3>Mở ${n} rương Phúc Duyên</h3><div class="card stats">${gold > 0 ? `<span>Ngân lượng</span><span>+${fmt(gold)}</span>` : ''}${Object.entries(cnt).map(([k, v]) => `<span>${esc(k)}</span><span>+${v}</span>`).join('')}<span>Trang bị</span><span>${items.length}${sets.length ? ` (${sets.length} Hoàng Kim)` : ''}</span></div>
    ${items.length ? `<div class="sl">${items.map(t => `<div>${t}</div>`).join('')}</div>` : ''}${lost > 0 ? `<p class="dim small">${lost} món không vào được hành trang (đầy hoặc đồ thừa) đã được bán.</p>` : ''}
    <p class="desc">Còn ${r.fd} Phúc Duyên.</p><div class="btnrow"><button class="btn" id="cBack">Quay lại</button></div>`, () => { $('#cBack').onclick = () => { giftTab = 'chest'; giftModal(); }; });
}
function openChest() {
  const r = RW(); if (r.fd < FD_COST) { toast(`Cần ${FD_COST} điểm Phúc Duyên`); return; }
  r.fd -= FD_COST; r.stat.chests++;
  const got = grant(wpick(FD_TABLE, x => x[0])[1], 'Rương Phúc Duyên');
  toast('Rương Phúc Duyên: ' + got.join(', ').replace(/<[^>]+>/g, '')); refreshGift();
}

/* ---------- moc noi vao tro choi ---------- */
function rwOnKill(e) {
  if (!S.fac) return;
  const r = RW(); r.stat.kills++; questTick('kills');
  if (e.cls === 'boss') { r.stat.bosses++; questTick('bosses'); }
  if (e.goldBoss) { r.stat.goldBoss++; grant({ set: 1, fd: 10 }, 'Hạ Trùm Hoàng Kim'); }
  if (Math.random() < 0.05) { r.stat.tokens++; const ev = eventNow(); addText(e.x, e.y - 50, '+1 ' + ev.token, ev.col, 11); }
  petGainXp(e.cls === 'boss' ? 10 : e.cls === 'elite' ? 3 : 1);
  if (r.stat.kills % 25 === 0 || e.cls === 'boss') achCheck();
}
/* so viec co the nhan o tung the (cham do + mo dung the) */
function giftCounts() {
  const r = RW(), tk = r.stat.tokens || 0;
  return { login: r.login.claimed ? 0 : 1, lvms: lvMsReady().length, chest: Math.floor(r.fd / FD_COST), event: EVENT_SHOP.filter(([c]) => tk >= c).length };
}
function giftPending() {
  if (!S || !S.fac) return false;
  const r = RW();
  return Object.values(giftCounts()).some(n => n > 0);
}
function dotGift() { const b = $('#giftBtn'); if (b) b.classList.toggle('on', giftPending()); }

/* ---------- giao dien: nut 🎁 ---------- */
let giftTab = 'login';
function refreshGift() { if (!$('#modal').classList.contains('hidden') && $('#giftTabs')) giftModal(); dotGift(); }
function giftText(g) {
  const p = [];
  if (g.gold) p.push(`${fmt(g.gold * (1 + S.lvl / 10))} lượng`); if (g.pot) { const pp = J.potions.find(x => x.kind === g.pot.kind && x.tier === potTierNow(g.pot.tier)); p.push(`${g.pot.n} ${pp ? pp.n : 'bình thuốc'}`); } if (g.ht) p.push(`${g.ht} Huyền Tinh cấp ${clamp(Math.floor(S.lvl / 15) + 1, 1, HT_MAX)}`); if (g.fd) p.push(`${g.fd} Phúc Duyên`); if (g.knb) p.push(`<img src="img/ep/knb.png" alt="" style="height:13px;vertical-align:middle;image-rendering:pixelated"> ${g.knb} Kim Nguyên Bảo`);
  if (g.item) p.push(`đồ ${g.item} dòng`); if (g.set) p.push(g.common ? 'đồ Hoàng Kim dùng chung (Kim Phong, An Bang, Định Quốc…)' : 'phôi Tím + Huyền Tinh (hiếm: đồ Hoàng Kim)'); if (g.pts) p.push(`${g.pts} tiềm năng`);
  if (g.buff) for (const k in g.buff) p.push(`${BUFF_VI[k]} +${Math.round(g.buff[k][0] * 100)}% ${g.buff[k][1]} phút`);
  if (g.misc) for (const k in g.misc) p.push(`${g.misc[k]} ${miscName(k)}`);
  return p.join(', ');
}
function giftBody(r) {
  if (giftTab === 'login') {
    const L = r.login, day = ((L.streak - 1) % 7 + 7) % 7;
    return `<p class="desc">Chuỗi ${L.streak} ngày · tổng ${L.total} ngày. Mốc 10 / 20 / 30 ngày có quà lớn.</p>
      <div class="days">${LOGIN7.map((g, i) => `<div class="day${i < day || (i === day && L.claimed) ? ' got' : ''}${i === day ? ' cur' : ''}"><b>Ngày ${i + 1}</b><small>${giftText(g)}</small></div>`).join('')}</div>
      <div class="btnrow"><button class="btn" id="gLogin" ${L.claimed ? 'disabled' : ''}>${L.claimed ? 'Đã nhận hôm nay' : 'Nhận quà hôm nay'}</button></div>`;
  }
  if (giftTab === 'lvms') {
    const g = r.lvGot || {};
    const n = rebornN();
    return `<p class="desc">${n ? `Mốc cấp vòng chuyển sinh ${n}: nhận lại mỗi lần chuyển sinh, chủ yếu hiệu ứng tăng kinh nghiệm / rơi đồ để lên lại cấp ${REBORN_LV} nhanh hơn.` : 'Quà mốc cấp: nhận một lần. Từ cấp 90 có thêm hiệu ứng tăng kinh nghiệm / tỉ lệ rơi đồ trong một số phút.'} Hiệu ứng nhận thêm khi đang còn sẽ cộng dồn thời gian.</p>${lvMsReady().length > 1 ? `<div class="btnrow"><button class="btn on" id="gLvAll">Nhận tất cả (${lvMsReady().length})</button></div>` : ''}${buffText() ? `<div class="card">${buffText()}</div>` : ''}${lvMsList().map(([lv, rw, note]) => `<div class="qrow${S.lvl >= lv ? '' : ' lock'}"><span><b>Cấp ${lv}</b><small>${giftText(rw)}${note ? ' · ' + note : ''}</small></span><small></small><button class="btn sm" data-lv="${lv}" ${S.lvl >= lv && !g[lvKey(lv)] ? '' : 'disabled'}>${g[lvKey(lv)] ? 'Đã nhận' : 'Nhận'}</button></div>`).join('')}`;
  }
  if (giftTab === 'ach') return `<p class="desc">Đạt <b>${ACH.filter(a => r.ach[a[0]]).length}/${ACH.length}</b> · thưởng tự nhận khi hoàn thành. Danh hiệu: thẻ Nhân vật → 🎖 Danh hiệu.</p>${[...ACH].sort((a, b) => !!r.ach[b[0]] - !!r.ach[a[0]]).map(([id, n, , g, t]) => `<div class="qrow${r.ach[id] ? '' : ' lock'}"><span><b>${n}</b><small>${giftText(g)}</small></span><small>${r.ach[id] ? '✓' : ''}</small></div>`).join('')}`;
  if (giftTab === 'chest') return `<p class="desc">Điểm Phúc Duyên: <b>${r.fd}</b> (điểm danh, nhiệm vụ, thành tựu, trùm). Mỗi lần mở: ${FD_COST} điểm.</p>
      <div class="chips">${FD_TABLE.map(([w, g]) => `<span class="chip2">${giftText(g)} · ${w}%</span>`).join('')}</div>
      <div class="btnrow"><button class="btn" id="gChest" ${r.fd >= FD_COST ? '' : 'disabled'}>Mở ×1</button><button class="btn" data-ch="10" ${r.fd >= FD_COST * 10 ? '' : 'disabled'}>Mở ×10</button><button class="btn" data-ch="100" ${r.fd >= FD_COST * 100 ? '' : 'disabled'}>Mở ×100</button><button class="btn" data-ch="999999" ${r.fd >= FD_COST * 2 ? '' : 'disabled'}>Mở hết (${Math.floor(r.fd / FD_COST)})</button></div>`;
  if (giftTab === 'event') {
    const ev = eventNow();
    return `<p class="desc">Sự kiện: <b style="color:${ev.col}">${ev.n}</b>. Quái rơi ${ev.token} (5%). Đang có: <b>${r.stat.tokens}</b>.</p>${EVENT_SHOP.map(([c, g], i) => `<div class="qrow"><span>${giftText(g)}</span><small>${c} ${ev.token}</small><button class="btn sm" data-e="${i}" ${r.stat.tokens >= c ? '' : 'disabled'}>Đổi</button></div>`).join('')}`;
  }
  return '';
}
function towerBody(r = RW()) {
  return `<p class="desc">Mỗi tầng một đợt tinh anh; tầng chia hết cho 5 là trùm (lần đầu qua được đồ Hoàng Kim). Quái cấp 10 + 4 × tầng. Gục ngã là rời tháp.</p>
      <p>Kỷ lục: <b>tầng ${r.stat.towerBest}</b>${R.tower ? ` · đang ở tầng ${R.tower.floor}` : ''}</p>
      <div class="btnrow">${R.tower ? '<button class="btn red" id="gTowerOut">Rời tháp</button>' : !unlocked(TOWER_LV) ? `<button class="btn" disabled>Cần cấp ${TOWER_LV}</button>` : `<button class="btn" id="gTower">Vào tháp (từ tầng ${Math.max(1, r.stat.towerBest - 4)})</button>`}</div>`;
}
function petBody(r = RW()) {
    const p = r.pet;
    if (!unlocked(PET_LV)) return `<p class="desc">Đồng hành mở khóa ở cấp ${PET_LV}.</p>`;
    return `<p class="desc">Đồng hành đi theo và cùng đánh quái, lên cấp theo số quái hạ. Chọn trong các loài ở vùng đã tới (đổi loài vẫn giữ cấp).</p>${p && MON[p.tid] ? `<p>Đang dẫn: <b>${esc(MON[p.tid].n)}</b> · cấp ${p.lvl} · sát thương ${fmt(petDmg(p))}/đòn</p>` : ''}
      <div class="petpick">${petChoices().map(t => `<button data-p="${t}" class="${p && p.tid === t ? 'on' : ''}">${MON[t].img ? `<img src="${esc(MON[t].img)}" alt="">` : ''}<b>${esc(MON[t].n)}</b></button>`).join('')}</div>`;
  }
function rebornBody(r = RW()) {
  const bo = rebornBonus(), full = r.stat.reborn >= REBORN_MAX;
  return `<p class="desc">Đạt cấp ${REBORN_LV}: về cấp 1, giữ trang bị; <b>mỗi lần chuyển sinh +${REB_EQ_LV} cấp khi xét yêu cầu trang bị</b> (vd cấp 10 chuyển sinh 1 = cấp ${10 + REB_EQ_LV}: mặc được mọi trang bị); võ công 90 học không cần Mật Tịch; mỗi lần +10% tỉ lệ rơi đồ; mốc cấp nhận lại mỗi vòng (hiệu ứng tăng kinh nghiệm / rơi đồ); <b>tẩy toàn bộ điểm tiềm năng và kỹ năng cũ</b>, nhận ${REB_ATTR} tiềm năng + ${REB_SK} điểm kỹ năng × số lần chuyển sinh ; <b>mỗi lần quái mạnh thêm</b> (+${Math.round(REB_HP * 100)}% máu, +${Math.round(REB_DMG * 100)}% sát thương), thưởng vĩnh viễn +20% kinh nghiệm và +10% sát thương mỗi lần (tối đa ${REBORN_MAX} lần).</p>
      <p>Đã chuyển sinh: <b>${r.stat.reborn}</b> lần · hiện +${Math.round(bo.xp * 100)}% kinh nghiệm, +${Math.round(bo.dmg * 100)}% sát thương · độ khó: quái ×${rebornHard().hp.toFixed(2)} máu, ×${rebornHard().dmg.toFixed(2)} sát thương.</p>
      <div class="btnrow"><button class="btn red" id="gReborn" ${S.lvl >= REBORN_LV && !full ? '' : 'disabled'}>${full ? 'Đã chuyển sinh tối đa' : S.lvl >= REBORN_LV ? 'Chuyển sinh' : `Cần cấp ${REBORN_LV}`}</button></div>`;
}
const GIFT_TABS = [['login', 'Điểm danh'], ['lvms', 'Mốc cấp'], ['chest', 'Phúc Duyên'], ['event', 'Sự kiện'], ['ach', 'Thành tựu']];
function giftModal(auto) {
  if (!S.fac) return;
  const r = RW(), cnt = giftCounts();
  if (!GIFT_TABS.some(([k]) => k === giftTab)) giftTab = 'login';
  if (auto && !cnt[giftTab]) { const k = GIFT_TABS.find(([k]) => cnt[k] > 0); if (k) giftTab = k[0]; }   // mo nut 🎁: nhay toi the dang co qua
  modal(`<h3>🎁 Phần thưởng <small>Phúc Duyên ${r.fd}${r.stat.tokens ? ` · ${eventNow().token} ${r.stat.tokens}` : ''}</small></h3><div class="dtabs" id="giftTabs">${GIFT_TABS.map(([k, n]) => `<button data-g="${k}" class="${k === giftTab ? 'on' : ''}">${n}${cnt[k] ? ` <b class="gdot">${cnt[k] > 99 ? '99+' : cnt[k]}</b>` : ''}</button>`).join('')}</div>${giftBody(r)}`, () => {
    document.querySelectorAll('#mBody #giftTabs button').forEach(x => x.onclick = () => { giftTab = x.dataset.g; giftModal(); });
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on('#gLogin', () => { claimLogin(); refreshGift(); }); on('#gChest', openChest); document.querySelectorAll('#mBody [data-ch]').forEach(x => x.onclick = () => openChestMany(+x.dataset.ch));
    document.querySelectorAll('#mBody [data-lv]').forEach(x => x.onclick = () => claimLvMs(+x.dataset.lv));
    on('#gLvAll', () => { for (const [lv] of lvMsReady()) claimLvMs(lv); save(); });
    document.querySelectorAll('#mBody [data-t]').forEach(x => x.onclick = () => { r.title = r.title === x.dataset.t ? '' : x.dataset.t; R.dirty = true; save(); refreshGift(); });
    document.querySelectorAll('#mBody [data-e]').forEach(x => x.onclick = () => eventBuy(+x.dataset.e));
  });
}
/* Chuyen sinh: mo tu the Nhan vat */
function rebornModal() {
  if (!S.fac) return;
  modal(`<h3>Chuyển sinh <small>${RW().stat.reborn}/${REBORN_MAX} lần</small></h3>${rebornBody()}`, () => { const b = $('#gReborn'); if (b) b.onclick = doReborn; });
}
