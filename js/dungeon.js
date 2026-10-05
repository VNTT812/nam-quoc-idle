/* ======================= PHO BAN + BOSS TUAN =======================
   Pho ban: nhieu phong tinh anh, phong cuoi la trum (mau x bossMul), gioi han thoi gian; 2 luot / ngay / pho ban (chi tru luot khi qua).
     Xep hang theo thoi gian: S <= 50% gioi han (thuong x1.5), A <= 75% (x1.2), B. Thuong: ngan luong, Phuc Duyen, Huyen Tinh + khoang,
     do 5-6 dong, co hoi do Hoang Kim va ngua hiem.
   Boss tuan: moi tuan (thu Hai -> Chu Nhat) mot trum cuc trau, 3 luot / tuan, 75 giay moi luot. Xep hang theo sat thuong gay ra
     (% mau trum): C 5% · B 20% · A 50% · S ha guc. Nhan ruong tuan theo hang tot nhat (1 lan / tuan).
   Ca hai dung chung che do R.dg (giong thap thu thach R.tower): vong lap tick() goi dgSpawn / dgCleared / dgFail. */
'use strict';
const DUNGEONS = [
  { id: 'dvc', map: 140, n: 'Dược Vương Cốc', lv: 20, add: -2, rooms: 5, limit: 120, bossMul: 5, set: 0.2, horse: 0.08, fd: 8, item: 5, gold: 2500, knb: 2, pot: 5, d: 'Hang dược thảo bị độc nhân chiếm giữ. 4 phòng tinh anh, phòng 5 là trùm.' },
  { id: 'tbk', map: 50, n: 'Thiên Bảo Khố', lv: 50, add: 0, rooms: 6, limit: 150, bossMul: 6, set: 0.35, horse: 0.12, fd: 12, item: 6, gold: 6000, knb: 3, pot: 8, d: 'Kho báu triều đình, lính canh tinh nhuệ. 5 phòng tinh anh, phòng 6 là trùm.' },
  { id: 'lal', map: 8, n: 'Lâm An Hoàng Lăng', lv: 80, add: 2, rooms: 7, limit: 210, bossMul: 7, set: 0.5, horse: 0.18, fd: 18, item: 6, gold: 12000, knb: 4, pot: 10, d: 'Lăng mộ hoàng tộc, cơ quan trùng trùng. 6 phòng tinh anh, phòng 7 là trùm.' },
  { id: 'pdq', map: 206, n: 'Phong Đô Quỷ Thành', lv: 110, rooms: 7, limit: 240, bossMul: 7, set: 0.55, horse: 0.2, fd: 22, item: 6, gold: 20000, knb: 5, pot: 12, d: 'Thành ma nơi âm khí ngút trời. 6 phòng tinh anh, phòng 7 là trùm.' },
  { id: 'kct', map: 4, n: 'Kiếm Các Thục Đạo', lv: 140, rooms: 8, limit: 270, bossMul: 8, set: 0.6, horse: 0.22, fd: 26, item: 6, gold: 30000, knb: 6, pot: 14, d: 'Đường Thục hiểm trở, sơn tặc trấn ải. 7 phòng tinh anh, phòng 8 là trùm.' },
  { id: 'mcb', map: 225, n: 'Mạc Cao Bí Cảnh', lv: 170, rooms: 8, limit: 300, bossMul: 7, set: 0.65, horse: 0.25, fd: 30, item: 6, gold: 45000, knb: 7, pot: 16, d: 'Hang động cổ giữa sa mạc, cao thủ ẩn tu. 7 phòng tinh anh, phòng 8 là trùm.' },
  { id: 'hsl', map: 212, n: 'Hoa Sơn Luận Kiếm', lv: 190, rooms: 9, limit: 330, bossMul: 7, set: 0.7, horse: 0.28, fd: 35, item: 6, gold: 60000, knb: 8, pot: 20, d: 'Đỉnh Hoa Sơn, quần hùng tranh phong. 8 phòng tinh anh, phòng 9 là trùm.' },
];
const DG_ELITE_DMG = 0.55, DG_ELITE_HP = 0.6;   // v159: phong pho ban 4-7 tinh anh cung luc (cap 140+: guc sau 40 giay, khong kip gio) -> moi con -45% sat thuong, -40% mau
const DG_STAGE_BACK = 10, DG_RUNS = 2, WB_TRIES = 3, WB_LIMIT = 75, WB_HP = 60;
const WB_RANKS = [['S', 1], ['A', 0.5], ['B', 0.2], ['C', 0.05]];
const WB_REWARD = { S: { gold: 10000, fd: 50, set: 1, knb: 15, pts: 3 }, A: { gold: 6000, fd: 30, set: 1, knb: 10 }, B: { gold: 3000, fd: 20, item: 6, knb: 6 }, C: { gold: 1500, fd: 10, item: 5, knb: 3 } };
const RANK_MUL = { S: 1.5, A: 1.2, B: 1 };
function weekStart(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x; }
const weekKey = () => dayKey(weekStart());
function DG() {
  const g = S.dg || (S.dg = {});
  if (g.day !== today()) { g.day = today(); g.runs = {}; }
  if (g.week !== weekKey()) { g.week = weekKey(); g.wbTries = 0; g.wbBest = 0; g.wbRank = ''; g.wbClaimed = false; }
  g.runs = g.runs || {};
  return g;
}
const dgLeft = d => Math.max(0, DG_RUNS - (DG().runs[d.id] || 0));
const dgUnlocked = d => S.lvl >= d.lv || RW().stat.reborn > 0;
/* Trum tuan: luan phien theo so tuan trong cac trum vung */
function wbBossTid() {
  const list = [...new Set(ZONES.map(z => z.boss))].filter(t => MON[t]);
  const n = Math.floor(weekStart().getTime() / 604800000);
  return list[((n % list.length) + list.length) % list.length];
}
/* Cap quai pho ban / boss tuan: theo ai cao nhat da qua (nhan vat thuong danh ai cao hon cap minh), it nhat cap nhan vat */
/* Pho ban: cap quai co dinh theo pho ban (khong theo nhan vat): phong 1 = cap pho ban, phong cuoi = +10 */
const DG_SPAN = 10;
const dgRoomL = g => clamp(Math.round(g.d.lv + DG_SPAN * (g.room - 1) / Math.max(1, g.d.rooms - 1)), 1, 200);
/* Luong theo cap pho ban (nhan vat cap cao vao pho ban thap khong an luong cap cao) */
const dgGoldF = d => (1 + Math.min(S.lvl, d.lv + DG_SPAN) / 10) / (1 + S.lvl / 10);
const dgLevel = add => clamp(Math.max(S.lvl, stageLevel(Math.max(1, S.maxStage - DG_STAGE_BACK))) + add, 1, levelCap());
const zoneForLevel = L => ZONES.find(z => L <= z.hi) || ZONES[ZONES.length - 1];
/* Ban do rieng cua pho ban: vao pho ban = dich chuyen toi ban do do; ra = ve bai luyen cong */
function dgMap(d) {
  const id = d && d.map && window.JMO && window.JMO[String(d.map)] ? d.map : null;
  if (!id) return;
  R.zoneShown = 'dg'; obsLoad(id); [H.x, H.y] = inWorld(WORLD.w / 2, WORLD.h / 2); snapCamera();
  R.bgImg = img(`img/z/${id}.jpg`); playMusic(id);
}
const dgBusy = () => R.dg || R.tower || R.deadT > 0;

/* ---------- vao / ra ---------- */
function dgEnterCommon() {
  if (R.town) backFromTown();
  R.enemies = []; R.corpses = []; R.pickTarget = null; R.moveTo = null; R.spawnT = 0.8; R.stall = 0; R.deadT = 0;
  R.life = R.P.life; R.mana = R.P.mana; closeModal(true);
}
function dgStart(id) {
  const d = DUNGEONS.find(x => x.id === id); if (!d) return;
  if (dgBusy()) { toast(R.deadT > 0 ? 'Đang trọng thương, chờ hồi phục' : 'Đang ở tháp / phó bản'); return; }
  if (!dgUnlocked(d)) { toast(`Cần cấp ${d.lv}`); return; }
  if (!dgLeft(d)) { toast('Hết lượt hôm nay'); return; }
  dgEnterCommon();
  R.dg = { kind: 'dg', id, d, room: 1, t: 0, limit: d.limit, L: Math.min(200, d.lv + DG_SPAN) };
  R.banner = { t: 2.4, text: d.n, sub: `${d.rooms} phòng · ${d.limit >= 120 && d.limit % 60 === 0 ? d.limit / 60 + ' phút' : d.limit + ' giây'} · gục ngã là thất bại` };
  dgMap(d);
  log(`🏯 Dịch chuyển vào phó bản <b>${esc(d.n)}</b>.`);
}
function wbStart() {
  const g = DG();
  if (dgBusy()) { toast(R.deadT > 0 ? 'Đang trọng thương, chờ hồi phục' : 'Đang ở tháp / phó bản'); return; }
  if (S.lvl < 20 && !RW().stat.reborn) { toast('Cần cấp 20'); return; }
  if (g.wbTries >= WB_TRIES) { toast('Hết lượt tuần này'); return; }
  g.wbTries++; REC().wbTries++;
  dgEnterCommon();
  R.dg = { kind: 'wb', t: 0, limit: WB_LIMIT, L: dgLevel(3), tid: wbBossTid(), dmg: 0 };
  R.banner = { t: 2.4, text: 'Boss tuần: ' + MON[R.dg.tid].n, sub: `${WB_LIMIT} giây · gây càng nhiều sát thương càng tốt` };
  save();
}
function dgExit() {
  const boat = R.dg && R.dg.kind === 'boat', own = R.dg && R.dg.kind === 'dg' && R.zoneShown === 'dg';
  R.dg = null; R.dgPilotT = 3; R.enemies = []; R.corpses = []; S.wave = 1; R.spawnT = 0.8; R.zoneShown = null; R.stall = 0;
  if (boat && typeof boatMap === 'function') boatMap(false);
  else if (own) { R.zoneShown = null; onZoneChange(zoneOf(Math.min(S.stage, STAGES))); }   // roi pho ban: ve bai luyen cong                  // roi thuyen: ve ban do luyen cong
  if (curTab === 'log') refresh();
}

/* ---------- vong lap ---------- */
function dgSpawn() {
  const g = R.dg; R.enemies = []; R.stall = 0;
  if (g.kind === 'boat') { boatSpawn(); return; }
  const near = (a, b) => { const t = rnd(0, Math.PI * 2), r = rnd(a, b); return inWorld(H.x + Math.cos(t) * r, H.y + Math.sin(t) * r); };
  if (g.kind === 'wb') {
    const [x, y] = near(200, 240), e = makeEnemy(g.tid, g.L, 'boss', x, y);
    e.hp = e.max = e.max * WB_HP; e.dmg *= 1.1; e.wb = true; e.n = 'Boss tuần · ' + e.n; g.boss = e;
    R.enemies.push(e); return;
  }
  const L = g.kind === 'dg' ? dgRoomL(g) : g.L, z = zoneForLevel(L), last = g.room >= g.d.rooms;
  if (last) {
    const [x, y] = near(220, 260), b = makeEnemy(z.boss, L, 'boss', x, y);
    b.hp = b.max = b.max * g.d.bossMul / 2; b.dmg *= 1.25; b.n = 'Trấn thủ · ' + bossName(z.boss, z.n);
    R.enemies.push(b);
    for (let i = 0; i < 2; i++) { const [ex, ey] = near(140, 240), e = makeEnemy(pick(z.m), L, 'elite', ex, ey); e.dmg *= DG_ELITE_DMG; e.hp = e.max = e.max * DG_ELITE_HP; R.enemies.push(e); }
  } else {
    const n = 3 + Math.floor(g.room / 3);                   // v159: 3-5 tinh anh / phong (truoc 3-7)
    for (let i = 0; i < n; i++) { const [x, y] = near(140, 260), e = makeEnemy(pick(z.m), L, 'elite', x, y); e.dmg *= DG_ELITE_DMG; e.hp = e.max = e.max * DG_ELITE_HP; R.enemies.push(e); }   // ca phong danh mot luc: sat thuong moi con giam
  }
}
function dgTick(dt) {
  const g = R.dg; if (!g) return;
  g.t += dt; R.stall = 0;                                  // thoi gian do gioi han cua pho ban lo, khong dung "danh lau qua"
  if (g.kind === 'wb' && g.boss) g.dmg = Math.max(g.dmg, g.boss.max - Math.max(0, g.boss.hp));
  if (g.t >= g.limit) { if (g.kind === 'wb') wbFinish(false); else dgFail('Hết thời gian'); }
}
function dgCleared() {
  const g = R.dg;
  if (g.kind === 'boat') { boatCleared(); return; }
  if (g.kind === 'wb') { if (!g.boss || g.boss.hp > 0) { R.spawnT = 0.5; return; } g.dmg = g.boss.max; wbFinish(true); return; }
  if (g.room >= g.d.rooms) { dgWin(); return; }
  g.room++;
  if (g.kind === 'dg' && g.d.islands && R.zoneShown === 'dg') { const p = obsIsland(g.room - 1); if (p) { [H.x, H.y] = p; R.moveTo = null; R.pickTarget = null; for (const d of R.ground) [d.x, d.y] = inWorld(d.x, d.y); if (typeof snapCamera === 'function') snapCamera(); } }   // ban do nhieu dao: moi phong sang dao khac
  heal(R.P.life * 0.25, true); R.mana = Math.min(R.P.mana, R.mana + R.P.mana * 0.3); R.spawnT = 1.5;
  R.banner = { t: 1.4, text: `Phòng ${g.room}/${g.d.rooms} · quái cấp ${dgRoomL(g)}`, sub: g.room >= g.d.rooms ? 'Trùm trấn thủ!' : `Còn ${Math.ceil(g.limit - g.t)} giây` };
}
function dgFail(why) {
  const g = R.dg; if (!g) return;
  if (g.kind === 'wb') { wbFinish(false); return; }
  if (g.kind === 'boat') { log(`<span class="bad">Phong Lăng Độ thất bại: ${esc(why)}.</span> Không mất lượt.`); R.banner = { t: 2.2, text: 'Thuyền bị cướp', sub: why + ' · không mất lượt' }; dgExit(); if (curTab === 'quest') refresh(); return; }
  log(`<span class="bad">Phó bản ${esc(g.d.n)} thất bại: ${esc(why)}.</span> Không mất lượt.`);
  (R.dgSkip || (R.dgSkip = {}))[g.d.id] = true;                                  // che do Pho Ban: bo qua phong ban vua that bai (phien nay)
  R.banner = { t: 2.2, text: 'Thất bại', sub: why + ' · không mất lượt' };
  dgExit();
}
/* Khoang thach chac chan (giong oreDrop nhung khong qua ti le) */
function forceOre(L) {
  const place = rcInt(0, VIO_SLOTS - 1), worn = Object.values(S.eq).filter(it => it && it.d <= 9), tgt = worn.length ? pick(worn) : null;
  const fit = tgt ? J.affixLevel.filter(r => r.lvl === 1 && r.pre === (place % 2 === 0 ? 1 : 0) && (r.s < 0 || r.s === tgt.s) && ((r.w || {})[itemKind(tgt)] > 0)).map(r => r.a) : [];
  const a = fit.length ? pick([...new Set(fit)]) : pick(orePool(place)), lvl = clamp(Math.floor(L / 12) + rcInt(0, 1), 1, ORE_MAX);
  const w = Object.values(S.eq).filter(x => x && x.d <= 9), key = oreKey(place, a, lvl, place % 2 ? (w.length ? pick(w).s : irnd(0, 4)) : -1); matAdd('ore', key); return `${oreStoneName(key)} cấp ${lvl}`;
}
function dgLoot(L, n) { const out = []; const l = clamp(Math.floor(L / 15) + 1, 1, HT_MAX); matAdd('ht', l, n); out.push(`${n} Huyền Tinh cấp ${l}`); for (let i = 0; i < n; i++) out.push(forceOre(L)); return out; }
function dgWin() {
  const g = R.dg, d = g.d, sec = Math.round(g.t), rank = sec <= d.limit * 0.5 ? 'S' : sec <= d.limit * 0.75 ? 'A' : 'B', m = RANK_MUL[rank];
  DG().runs[d.id] = (DG().runs[d.id] || 0) + 1;
  const r = REC(); r.dgClear[d.id] = (r.dgClear[d.id] || 0) + 1;
  if (!r.dgBest[d.id] || sec < r.dgBest[d.id]) r.dgBest[d.id] = sec;
  if (!r.dgRank[d.id] || 'SAB'.indexOf(rank) < 'SAB'.indexOf(r.dgRank[d.id])) r.dgRank[d.id] = rank;
  const got = grant({ gold: Math.round(d.gold * m * dgGoldF(d)), fd: Math.round(d.fd * m), item: d.item, knb: Math.round((d.knb || 0) * m), pot: d.pot ? { kind: 'both', tier: 1, n: d.pot } : null }, `Phó bản ${d.n} · hạng ${rank}`);
  const mats = dgLoot(g.L, rank === 'S' ? 3 : rank === 'A' ? 2 : 1); log(`🎁 ${mats.join(', ')}`);
  if (Math.random() < d.set * m) grant({ set: 1 }, `Phó bản ${d.n}`);
  if (Math.random() < d.horse * m * HORSE_DROP.dg) { const h = rareHorse(); if (h) { addItem(h, true, true, true); log(`🐎 Nhận ngựa <b style="color:${RAR_COL[h.r]}">${esc(h.n)}</b>!`); } }
  questTick('dungeon');
  R.banner = { t: 3, text: `Qua ${d.n} · hạng ${rank}`, sub: `${sec} giây · ${got.join(', ').replace(/<[^>]+>/g, '')}`.slice(0, 70) };
  uiSfx('levelup'); achCheck(); dgExit(); save();
}
function wbRankOf(dmg, hp) { for (const [k, f] of WB_RANKS) if (dmg >= hp * f - 0.5) return k; return ''; }
function wbFinish(killed) {
  const g = R.dg, G = DG(), hp = g.boss ? g.boss.max : 1, dmg = g.boss ? Math.round(killed ? hp : g.dmg) : 0, rank = g.boss ? wbRankOf(dmg, hp) : '';
  if (dmg > (G.wbBest || 0)) { G.wbBest = dmg; G.wbHp = hp; }
  if (rank && (!G.wbRank || 'SABC'.indexOf(rank) < 'SABC'.indexOf(G.wbRank))) G.wbRank = rank;
  recSet('wbBest', dmg, { n: MON[g.tid].n, rank: rank || '—', pct: Math.round(dmg / hp * 100) });
  log(`Boss tuần ${esc(MON[g.tid].n)}: gây <b>${fmt(dmg)}</b> sát thương (${Math.round(dmg / hp * 100)}% máu) · hạng ${rank || 'chưa đạt'}`);
  R.banner = { t: 3, text: killed ? 'Hạ Boss tuần!' : 'Hết giờ', sub: `${fmt(dmg)} sát thương · hạng ${rank || '—'}` };
  dgExit(); dotGift(); save();
}
function wbClaim() {
  const G = DG(); if (G.wbClaimed || !G.wbRank) return;
  G.wbClaimed = true; grant(WB_REWARD[G.wbRank], `Rương Boss tuần hạng ${G.wbRank}`);
  const mats = dgLoot(dgLevel(3), { S: 3, A: 2, B: 1, C: 1 }[G.wbRank]); log(`🎁 ${mats.join(', ')}`);
  if (G.wbRank === 'S' && Math.random() < HORSE_DROP.wbS) { const h = rareHorse(); if (h) { addItem(h, true, true, true); log(`🐎 Nhận ngựa <b style="color:${RAR_COL[h.r]}">${esc(h.n)}</b>!`); } }
  achCheck(); save();
}
const dgPending = () => S && S.fac && ((DG().wbRank && !DG().wbClaimed) || false);

/* ---------- HUD tren san dau ---------- */
function drawDgHud(c) {
  const g = R.dg; if (!g) return;
  const left = Math.max(0, g.limit - g.t), mm = Math.floor(left / 60), ss = String(Math.floor(left % 60)).padStart(2, '0');
  const txt = g.kind === 'wb' ? `Boss tuần · ${fmt(g.dmg)} (${(() => { const q = g.dmg / Math.max(1, g.boss ? g.boss.max : 1) * 100; return q < 10 ? q.toFixed(1) : Math.round(q); })()}%) · ${mm}:${ss}` : g.kind === 'boat' ? `⛵ Phong Lăng Độ · đoạn ${g.room}/${BOAT_SEGS} · ${mm}:${ss}` : `${g.d.n} · phòng ${g.room}/${g.d.rooms} · ${mm}:${ss}`;
  c.font = '12px "IBM Plex Mono", monospace'; c.textAlign = 'center';
  const w = c.measureText(txt).width + 18; c.fillStyle = '#000b'; c.fillRect(AR.w / 2 - w / 2, 34, w, 20);
  c.fillStyle = left < 20 ? '#ff7a6a' : '#f3d88a'; c.fillText(txt, AR.w / 2, 48);
}

/* ---------- giao dien ---------- */
function dungeonBody() {
  const busy = R.dg ? `<div class="card"><b>Đang trong ${R.dg.kind === 'wb' ? 'Boss tuần' : esc(R.dg.d.n)}</b><div class="btnrow"><button class="btn red" id="dgOut">Rời đi${R.dg.kind === 'wb' ? ' (giữ sát thương đã gây)' : ' (không mất lượt)'}</button></div></div>` : '';
  const r = REC();
  return `<p class="desc">Phó bản: quái tinh anh cấp cố định theo phó bản (phòng 1 = cấp phó bản, mỗi phòng mạnh dần, phòng cuối +10 là trùm trấn thủ), không mạnh lên theo cấp nhân vật. ${DG_RUNS} lượt / ngày cho mỗi phó bản, chỉ trừ lượt khi vượt qua. Hạng theo thời gian: S ≤ 50% giới hạn (thưởng ×1.5), A ≤ 75% (×1.2), B.</p>${busy}
    ${DUNGEONS.map(d => { const ok = dgUnlocked(d), left = dgLeft(d); return `<div class="card dgc${ok ? '' : ' lock'}"><b>${esc(d.n)}</b> <small class="dim">từ cấp ${d.lv} · quái cấp ${d.lv} → ${Math.min(200, d.lv + DG_SPAN)} · ${d.rooms} phòng · ${d.limit >= 120 && d.limit % 60 === 0 ? d.limit / 60 + ' phút' : d.limit + ' giây'}</small><br><small>${esc(d.d)}</small><br>
      <small class="dim">Thưởng: ${fmt(d.gold * (1 + Math.min(S.lvl, d.lv + DG_SPAN) / 10))} lượng, ${d.fd} Phúc Duyên, <b style="color:#ffd24a">${d.knb || 0} KNB</b>, ${d.pot || 0} ${(J.potions.find(x => x.kind === 'both' && x.tier === potTierNow(1)) || {}).n || 'thuốc'}, đồ ${d.item} dòng, Huyền Tinh + khoáng · Hoàng Kim ${Math.round(d.set * 100)}% · thần mã ${Math.round(d.horse * HORSE_DROP.dg * 100)}%${r.dgClear[d.id] ? ` · kỷ lục ${r.dgBest[d.id]} giây (hạng ${r.dgRank[d.id]})` : ''}</small>
      <div class="btnrow"><button class="btn" data-dg="${d.id}" ${ok && left && !dgBusy() ? '' : 'disabled'}>${!ok ? `Cần cấp ${d.lv}` : left ? `Vào (còn ${left}/${DG_RUNS} lượt)` : 'Hết lượt hôm nay'}</button></div></div>`; }).join('')}`;
}
function wbBody() {
  const G = DG(), tid = wbBossTid(), m = MON[tid], L = dgLevel(3), ok = S.lvl >= 20 || RW().stat.reborn > 0;
  const end = weekStart(); end.setDate(end.getDate() + 7); const hrs = Math.max(0, Math.round((end - Date.now()) / 3600000));
  const pct = G.wbBest && G.wbHp ? Math.round(G.wbBest / G.wbHp * 100) : 0;
  return `<p class="desc">Mỗi tuần một trùm cực trâu (máu ×${WB_HP} trùm thường). ${WB_TRIES} lượt / tuần, mỗi lượt ${WB_LIMIT} giây. Hạng theo % máu trùm đã đánh mất: C ${WB_RANKS[3][1] * 100}% · B ${WB_RANKS[2][1] * 100}% · A ${WB_RANKS[1][1] * 100}% · S hạ gục. Nhận rương tuần theo hạng tốt nhất.</p>
    <div class="card"><div class="idet">${m.img ? `<div class="pic"><img src="${esc(m.img)}" alt=""></div>` : ''}<div><h4 class="boss">${esc(m.n)}</h4><small class="dim">Cấp ${L} · đổi trùm sau ${hrs} giờ</small></div></div>
      <div class="stats"><span>Lượt còn</span><span>${WB_TRIES - G.wbTries}/${WB_TRIES}</span><span>Sát thương tốt nhất</span><span>${fmt(G.wbBest || 0)}${pct ? ` (${pct}%)` : ''}</span><span>Hạng tuần</span><span>${G.wbRank || '—'}</span></div>
      <div class="chips">${['S', 'A', 'B', 'C'].map(k => `<span class="chip2${G.wbRank === k ? ' on' : ''}">${k}: ${giftText(WB_REWARD[k])}${k === 'S' ? ', 35% thần mã' : ''}</span>`).join('')}</div>
      <div class="btnrow"><button class="btn" id="wbGo" ${ok && G.wbTries < WB_TRIES && !dgBusy() ? '' : 'disabled'}>${!ok ? 'Cần cấp 20' : G.wbTries < WB_TRIES ? 'Khiêu chiến' : 'Hết lượt tuần này'}</button>
      <button class="btn" id="wbClaim" ${G.wbRank && !G.wbClaimed ? '' : 'disabled'}>${G.wbClaimed ? 'Đã nhận rương tuần' : 'Nhận rương tuần'}</button></div></div>`;
}
/* Hop thoai Hoat dong (mo tu the Nhiem vu > Hoat dong): Pho ban · Thap · Boss tuan · Ma truong · Than ma · Dong hanh · Ky luc. Da Tau / Sat Thu nam o the Nhiem vu. */
let actTab = 'dg';
function actModal(tab) {
  if (!S.fac) return; if (tab === 'dt' || tab === 'st') { openQuest(tab); return; } if (tab) actTab = tab;
  const tabs = [['dg', 'Phó bản'], ['tower', 'Tháp'], ['wb', 'Boss tuần'], ['horse', 'Mã trường'], ['tm', 'Thần mã'], ['pet', 'Đồng hành'], ['rec', 'Kỷ lục']];
  const body = actTab === 'tower' ? towerBody() : actTab === 'pet' ? petBody() : actTab === 'dg' ? dungeonBody() : actTab === 'wb' ? wbBody() : actTab === 'horse' ? stableBody() : actTab === 'tm' ? thanMaBody() : recordsBody();
  modal(`<h3>Hoạt động <small>${fmt(S.gold)} lượng</small></h3><div class="dtabs" id="actTabs">${tabs.map(([k, n]) => `<button data-a="${k}" class="${k === actTab ? 'on' : ''}">${n}</button>`).join('')}</div>${body}`, () => {
    document.querySelectorAll('#actTabs button').forEach(b => b.onclick = () => actModal(b.dataset.a));
    document.querySelectorAll('#mBody [data-dg]').forEach(b => b.onclick = () => dgStart(b.dataset.dg));
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on('#wbGo', wbStart); on('#wbClaim', () => { wbClaim(); actModal(); });
    on('#dgOut', () => { if (R.dg.kind === 'wb') wbFinish(false); else { log('Rời phó bản.'); dgExit(); } actModal(); });
    if (actTab === 'horse') bindStable(() => actModal());
    if (actTab === 'tm') bindThanMa(() => actModal());
    on('#gTower', towerStart); on('#gTowerOut', () => { towerExit(false); actModal(); });
    document.querySelectorAll('#mBody .petpick [data-p]').forEach(x => x.onclick = () => petAdopt(+x.dataset.p));
  });
}
function actDot() { const b = $('#actBtn'); if (!b || !S.fac) return; const avail = DUNGEONS.some(d => dgUnlocked(d) && dgLeft(d)) || ((S.lvl >= 20 || RW().stat.reborn) && DG().wbTries < WB_TRIES) || dgPending(); b.classList.toggle('on', !!avail); }

/* ---------- CHE DO PHO BAN (tu dong): vao lan luot phong ban cao nhat con luot; het luot thi luyen cong ---------- */
const dgNext = () => DUNGEONS.filter(d => dgUnlocked(d) && dgLeft(d) > 0 && !(R.dgSkip || {})[d.id]).sort((a, b) => b.lv - a.lv)[0] || null;
function dgPilot(dt) {
  if (S.mode !== 'dg' || !S.fac || R.dg || R.tower || R.deadT > 0 || R.sat) return;
  R.dgPilotT = (R.dgPilotT || 0) - dt; if (R.dgPilotT > 0) return; R.dgPilotT = 1.5;
  const d = dgNext();
  if (d) { if (R.town) backFromTown(); dgStart(d.id); return; }
  if (!R.town) { const b = bestZoneIdx(); if (S.autoMap !== false && zoneIdx(Math.min(S.stage, STAGES)) !== b) gotoZone(b, 'Hết lượt phó bản, luyện công'); }
}
