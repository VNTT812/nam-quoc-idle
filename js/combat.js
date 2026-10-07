/* ======================= CHIEN DAU (KNpc::CheckHitTarget / CalcDamage) ======================= */
'use strict';
const R = { corpses: [], lootWait: 0, ground: [], pickTarget: null, enemies: [], P: null, life: 1, mana: 1, atkT: 0, deadT: 0, spawnT: 0, kills: 0, t0: Date.now(), logs: [], fx: [], txt: [], dirty: true, stall: 0, farm: 0 };
const AR = { w: 400, h: 520, top: 70, bot: 470 };
const H = { x: 768, y: 768, face: 1 };

/* ---------- vung / ai ---------- */
const zoneIdx = st => Math.min(ZONES.length - 1, Math.floor((st - 1) / ZONE_STAGES));
const ZALT = W.zalt || {};
/* Ban do thay the cung bac cap (zones2.js): nguoi choi chon o danh sach ban do (S.zalt[vung] = 1..n, 0 = ban do goc) */
const zoneOf = st => { const i = zoneIdx(st), a = S && S.zalt && S.zalt[i]; return (a && ZALT[i] && ZALT[i][a - 1]) || ZONES[i]; };
const inZone = st => ((st - 1) % ZONE_STAGES) + 1;
function stageLevel(st) {
  if (st > STAGES) return MAX_LEVEL;   // ai sau vung cuoi kep o cap toi da: nhip len cap 99 (tests: pacing) da hieu chinh voi kep nay; bo kep thi cap 99 mat > 60 gio
  const z = zoneOf(st), L = Math.round(z.lo + (inZone(st) - 1) * (z.hi - z.lo) / (ZONE_STAGES - 1));
  return z.lo >= 160 ? Math.min(levelCap(), L) : L;   // vung 160-200: chua chuyen sinh kep o cap 99 nhu truoc
}

/* ---------- quai: Npcs.txt khong co chi so theo cap -> cong thuc rieng cua game (docs/CONG_THUC.md) ---------- */
const POISON_TIME = 3;
/* Ngu hanh (kieu JX1): tuong khac +-10% sat thuong; bang lam cham 30% trong 1.5 giay; loi 10% gay choang 0.5 giay */
const SERIES_BONUS = 0.10, ELEM_SLOW_T = 1.5, ELEM_SLOW = 0.7, ELEM_STUN_P = 0.10, ELEM_STUN_T = 0.5;
const CLS = { normal: { hp: 1, dmg: 1, xp: 1, r: 17 }, elite: { hp: 2.5, dmg: 1.3, xp: 3, r: 21 }, boss: { hp: 14, dmg: 1.7, xp: 20, r: 30 } };
/* Do kho (chon o the Khac): Thuong la can bang chuan cua cac bo kiem thu. De / Kho doi mau, sat thuong quai va thuong kinh nghiem / ngan luong */
const DIFFS = [{ n: 'Dễ', hp: 0.75, dmg: 0.7, rew: 0.8, d: 'Quái yếu hơn (máu −25%, sát thương −30%), thưởng −20%' }, { n: 'Thường', hp: 1, dmg: 1, rew: 1, d: 'Cân bằng chuẩn' }, { n: 'Khó', hp: 1.4, dmg: 1.35, rew: 1.25, d: 'Quái mạnh hơn (máu +40%, sát thương +35%), thưởng +25%' }];
const diffOf = () => DIFFS[1];   // v189: bo chon do kho, luon Thuong
/* Can bang (ban 42, test/balrun.js): luc chien nhan vat (do dung bac + diem tu cong) tang nhanh hon mau quai -> cap 60 ha quai trong 0,2s,
   cap 90 trong 0,03s, khong bao gio mat mau. He so theo cap: quai thuong ~1-1,5s / con, trum ban do ~15-25s, nhan vat mat mau that. */
const MON_HP_K = [[1, 1], [10, 1.1], [30, 1.8], [60, 3.5], [90, 12], [120, 20], [150, 28], [200, 40]];
const MON_DMG_K = [[1, 1], [30, 1.3], [60, 1.45], [90, 1.7], [120, 2.2], [200, 2.8]];
/* quai trau hon -> ha cham hon: kinh nghiem / ngan luong moi con nhan bu (giu nhip len cap) */
const monRewK = L => Math.pow(lerpK(MON_HP_K, L), 0.4);
const lerpK = (T, L) => { for (let i = 1; i < T.length; i++) if (L <= T[i][0]) { const [a, x] = T[i - 1], [b, y] = T[i]; return x + (y - x) * (L - a) / (b - a); } return T[T.length - 1][1]; };
/* v133: mau quai theo JX1 (npclevelscript/animal.lua: tung doan tuyen tinh, tu cap 50 x4; ban do cap cao 25k-60k) */
const JX1_LIFE = [[10, 50, 3, 0], [20, 122, 8, 10], [30, 270, 30, 20], [40, 900, 35, 30], [50, 1450, 60, 40], [60, 2100, 48, 50], [70, 2950, 54, 60], [80, 3500, 58, 70], [90, 5050, 11, 80], [100, 6450, 11, 90]];
function jx1Life(L) {
  if (L > 100) return 26240 + (L - 100) * 340;                 // tren 100: ~43k o 150, ~60k o 200 (Mac Cao Quat, Phong Lang Do 30-60k)
  for (const [X, a, b, o] of JX1_LIFE) if (L <= X) return (a + b * (L - o)) * clamp(1 + 3 * (L - 40) / 30, 1, 4);   // JX1 nhan x4 tu cap 50: lam muot tu 40 -> 60 (tranh vuc mau o cap 50)
  return 26240;
}
const MON_HP_G = 1;   // he so mau quai chung
function enemyStats(L, cls) {
  const c = CLS[cls];
  return { hp: jx1Life(L) * MON_HP_G * c.hp, dmg: (2 + 1.0 * L + 0.006 * L * L) * c.dmg * lerpK(MON_DMG_K, L), ar: 30 + L * 9, def: 8 + L * 3.2 };
}
/* Nhip len cap (docs/CONG_THUC.md): truoc day cap 150 chi mat ~2 gio choi. Den cap 30 giu nguyen (vao game nhanh),
   sau do kinh nghiem nhan duoc chia cho 1 + 200 x ((cap - 30) / 120)^1.4  (cap 60: /30, cap 90: /77, cap 150: /201)
   -> cap 150 mat vai ngay choi (tests: pacing). */
const XP_OVER = 25;
const XP_SLOW_FROM = 30, XP_SLOW_K = 6, XP_SLOW_P = 1.0;   // ban 75: Full cap ~2-3 ngay treo, Full chuyen sinh ~2 tuan (truoc K 200, P 1.4: Full cap ~1-5 thang)
const xpSlow = L => L <= XP_SLOW_FROM ? 1 : 1 + XP_SLOW_K * Math.pow((L - XP_SLOW_FROM) / 120, XP_SLOW_P);
function expFor(L) { return J.exp[clamp(L, 1, levelCap()) - 1] / (10 + L * 1.4); }   // kinh nghiem theo cap quai, kep o gioi han cap hien tai (giu nhip len cap cu khi chua chuyen sinh)
/* Tam danh quai theo chieu NPC JX1 (skills.txt AttackRadius). Chieu chinh = chieu dac thu (khong phai 53 danh thuong / 101 tri lieu) */
const NPC_SK_R = { 1: 100, 2: 320, 53: 75, 102: 360, 122: 300, 153: 400, 164: 470, 165: 400, 196: 180, 197: 180, 198: 180, 200: 180, 201: 180,
  233: 270, 234: 180, 235: 450, 236: 360, 237: 300, 238: 72, 239: 400, 240: 320, 241: 180, 242: 72 };
const MON_RANGE_MAX = 320;                                            // quai danh xa: toi da 320 (de thay quai tren man hinh doc)
function monReach(tid) {
  const sk = (MON[tid] && MON[tid].sk) || [], main = sk.find(s => s !== 53 && s !== 101 && NPC_SK_R[s]) || sk.find(s => NPC_SK_R[s]) || 53;
  return Math.min(MON_RANGE_MAX, NPC_SK_R[main] || 75);
}
function makeEnemy(tid, L, cls, x, y) {
  const m = MON[tid], z = zoneOf(S.stage), st = enemyStats(L, cls), D = diffOf(), RH = rebornHard(); st.hp *= D.hp * RH.hp; st.dmg *= D.dmg * RH.dmg;   // chuyen sinh: quai manh dan
  const series = monSeries(tid);                                       // he co dinh theo loai quai (kieu JX1)
  // khang theo he: nguyen to cua he minh (rmax 90) +10, diem yeu (rmax 60) -10, tran = rmax cua quai (+-10 can doi: o cap cao +20 lam mat ~40% sat thuong)
  const res = {}; ELEM.forEach((e, i) => { const mx = m.rmax[i] || 75, b = mx > 75 ? 10 : mx < 75 ? -10 : 0; res[e] = clamp(L * 0.35 + (cls === 'boss' ? 10 : 0) + b, -20, mx); });
  const e = { id: Math.random(), tid, n: m.n, img: m.img ? img(m.img) : null, sz: m.sz, L, cls, series, res,
    hp: st.hp, max: st.hp, dmg: st.dmg, ar: st.ar, def: st.def, x, y, r: CLS[cls].r,
    spd: (30 + (m.run || 6) * 4) * (cls === 'boss' ? 0.7 : 1), atkCd: rnd(0.5, 1.5), cd: 1.2 + 18 / Math.max(8, m.spd || 18) * 0.5,
    reach: monReach(tid), ranged: monReach(tid) > 120, born: R.clock || 0, stun: 0, slowT: 0, poison: 0, poisonDmg: 0, hitT: 0, face: 1,
    act: 'st', actT: 0, dir: 0, moving: false };
  if (typeof attachTranCostume === 'function') attachTranCostume(e);
  return e;
}
/* Mat do quai luyen cong: moi dot DENS_MIN..DENS_MAX con (truoc 3-4), dot trum co them DENS_BOSS dan em.
   Quai thuong danh nhe hon (DENS_DMG) vi dong gap doi. DENS_REW: he so thuong / roi do moi con thuong (test/t2: 1 -> len cap
   nhanh hon ban 3-4 con khoang 1 cap sau 150 phut, 0.85 -> cham hon vi thoi gian di bo / hoi mau tang theo so quai). */
const DENS_MIN = 6, DENS_MAX = 8, DENS_BOSS = 4, DENS_REW = 1, DENS_DMG = 0.75;   // dong gap doi: moi con danh nhe hon 25%
/* So quai moi dot tang dan theo cap nhan vat: tan thu it quai (khong bi vay chet lien tuc), cap 45+ moi du 6-8 con */
const DENS_BY_LV = [[5, 2, 3, 1], [10, 3, 4, 1], [20, 4, 5, 2], [30, 5, 6, 3], [45, 5, 7, 3], [999, DENS_MIN, DENS_MAX, DENS_BOSS]];   // [toi cap, min, max, dan em trum]
const densRange = () => DENS_BY_LV.find(r => (S.lvl | 0) <= r[0]);
const densK = e => (e && e.dens ? DENS_REW : 1);
function spawnWave() {
  R.enemies = []; R.stall = 0;
  const z = zoneOf(S.stage), L = stageLevel(S.stage);
  if (!(z.m && z.m.length)) {
    if (z.id !== R.zoneShown) { R.zoneShown = z.id; R.banner = { t: 2.4, text: z.n, sub: `Cấp ${z.lo}–${z.hi}` }; if (typeof onZoneChange === 'function') onZoneChange(z); }
    return;
  }
  // quai xuat hien quanh nhan vat (ngoai tam nhin mot chut) roi tien lai
  const around = (r0, r1) => { const a = rnd(0, Math.PI * 2), r = rnd(r0, r1); return inWorld(H.x + Math.cos(a) * r, H.y + Math.sin(a) * r); };
  const sx = () => (R.sp = around(140, 300))[0], sy = () => R.sp[1];
  const mob = cls => { const e = makeEnemy(pick(z.m), L, cls, sx(), sy()); if (cls === 'normal') { e.dens = true; e.dmg *= DENS_DMG; } R.enemies.push(e); };   // quai thuong dong: thuong / roi do moi con giam (DENS_REW)
  if (S.wave === WAVES && bossRoundDue() && z.boss) {   // luyen cong: trum ban do moi 3 vong (mode.js) + tinh anh + dan em
    const bp = around(220, 260), be = makeEnemy(z.boss, L + 1, 'boss', bp[0], bp[1]); be.n = bossName(z.boss, z.n); R.enemies.push(be);
    mob('elite'); for (let i = 0; i < densRange()[3]; i++) mob('normal');
    log(`<b class="boss">${esc(bossName(z.boss, z.n))}</b> xuất hiện!`);
  } else {
    const dr = densRange(), n = irnd(dr[1], dr[2]), el = S.wave === WAVES ? 1 + (Math.random() < 0.4 ? 1 : 0) : 0;
    for (let i = 0; i < n; i++) mob(i < el ? 'elite' : 'normal');
  }
  if (z.id !== R.zoneShown) { R.zoneShown = z.id; R.banner = { t: 2.4, text: z.n, sub: `Cấp ${z.lo}–${z.hi}` }; if (typeof onZoneChange === 'function') onZoneChange(z); }
}

/* ---------- cong thuc trung / sat thuong ---------- */
function hitPercent(ar, def, ignore = 0) {
  const d = def * (100 - Math.min(ignore, 100)) / 100;
  let p = ar + d === 0 ? 50 : ar * 100 / (ar + d);
  if (p > MAX_HIT + 4) p = MAX_HIT;
  return Math.max(MIN_HIT, p);
}
/* Mot phan sat thuong (vat ly / nguyen to) vao muc tieu: ngu hanh -> khang -> nhan (100 - khang)% */
function applyPart(dmg, e, attackerSeries, targetSeries, targetRes, targetResMax, series5) {
  let res = targetRes[e];
  if (counters(attackerSeries, targetSeries)) res -= series5;           // ta khac dich: dich giam khang
  else if (counters(targetSeries, attackerSeries)) res += series5;      // dich khac ta: dich tang khang
  res = clamp(res, -targetResMax, Math.min(targetResMax, MAX_RESIST));
  return dmg * (100 - res) / 100;
}
function heroHit(a, e) {
  e.aggro = true;                                                       // bi danh: quai bai JX1 duoi theo
  if (a && a.id && SK[a.id] && SK[a.id].tier === 90) (e.hitSk || (e.hitSk = {}))[a.id] = 1;   // luyen vo cong 90: ghi chieu da trung quai (vocong.js)
  const cm = typeof curseMod === 'function' ? curseMod(e) : null;      // bua hai tren quai (skillsys.js)
  if (a.useAR && Math.random() * 100 >= hitPercent(R.P.ar, Math.max(0, e.def + (cm ? cm.def : 0)), a.ignore)) { addText(e.x, e.y - e.r - 8, 'Trượt', '#aaa', 11); return 0; }
  if (!a.ev2) stateOnHit(a, e);                                           // hieu ung trang thai cua chieu (skillfx.js); chieu con tang 2 khong lap lai
  const crit = Math.random() * 100 < a.crit, heavy = R.P.heavy > 0 && Math.random() * 100 < R.P.heavy;
  let tot = 0, best = 'phys', bv = 0;
  const big = e.cls === 'boss' || e.cls === 'elite';
  if (big && Math.random() * 100 < (e.cls === 'boss' ? 6 : 3) - (R.P.antiBlock || 0)) { addText(e.x, e.y - e.r - 8, 'Hóa giải', '#ccc', 11); return 0; }   // trum / tinh anh hoa giai don (Bo qua hoa giai giam)
  const brk = e.resBrkT > 0 ? 10 : 0, anti = R.P.anti, eres = (anti && ELEM.some(x => anti[x])) || brk ? Object.fromEntries(ELEM.map(x => [x, e.res[x] - (anti && anti[x] || 0) - brk])) : e.res;
  const eres2 = cm ? Object.fromEntries(ELEM.map(x => [x, eres[x] + (cm.res[x] || 0)])) : eres;   // bo qua khang (dong Duong / anti_res) + giam khang tam thoi
  const rmax = R.P.antiMax ? Math.max(0, 75 - R.P.antiMax / 4) : 75;   // Lam doi phuong co khang: ha tran khang quai
  for (const el in a.parts) {
    let d = a.parts[el] * rnd(0.85, 1.15);
    if (el === 'poison') { // doc cong don: phan chua gay cua lan truoc + lan moi, trai deu 3 giay (KNpc::ReceiveDamage gop 2 luong doc)
      const left = e.poison > 0 ? e.poisonDmg * e.poison : 0;
      e.poisonDmg = (left + applyPart(d * (cm && cm.poison ? 1 + cm.poison / 100 : 1), 'poison', a.series, e.series, eres2, rmax, a.series5)) / POISON_TIME; e.poison = POISON_TIME; continue; }
    d = applyPart(d, el, a.series, e.series, eres2, rmax, a.series5);
    if (crit && el === 'phys') d *= CRIT_MULT;
    tot += d; if (d > bv) { bv = d; best = el; }
  }
  // ngu hanh tang cuong / khang (five_elements_enhance_v) cong tru truc tiep
  if (counters(a.series, e.series)) tot += R.P.series5;
  if (heavy) tot *= 1.5;                                                // trong kich
  if (big && R.P.antiSorb) tot *= 1 + R.P.antiSorb / 100;               // gia tang sat thuong len trum / tinh anh
  const kh = counters(a.series, e.series), bk = counters(e.series, a.series);
  if (kh) tot *= 1 + SERIES_BONUS; else if (bk) tot *= 1 - SERIES_BONUS;  // tuong khac: ta khac dich +10%, dich khac ta -10%
  if (a.parts.cold) e.slowT = Math.max(e.slowT > 0 ? e.slowT : 0, ELEM_SLOW_T);   // bang sat: lam cham quai, moi don trung lam moi 1.5 giay (v119: truoc chi cham duoc 1 lan)
  const stunK = 1 + (R.P.stunLong || 0) / 100;                          // Tao thanh thoi gian choang
  if (a.parts.light && Math.random() < ELEM_STUN_P) e.stun = Math.max(e.stun, ELEM_STUN_T * stunK);   // loi sat: choang ngan
  tot = Math.max(1, tot);
  e.hp -= tot; e.hitT = 0.12; if (e.act !== 'at') { e.act = 'hurt'; e.actT = 0; npcSfx(MON[e.tid].anim, 'hurt', 0.3); }
  if ((a.stun || R.P.stunAdd) && Math.random() * 100 < (a.stun || 0) + (R.P.stunAdd || 0)) e.stun = Math.max(e.stun, 0.8 * stunK);
  if (R.P.knock && e.cls !== 'boss' && Math.random() * 100 < R.P.knock) { const dx = e.x - H.x, dy = e.y - H.y, l = Math.hypot(dx, dy) || 1; e.x += dx / l * 40; e.y += dy / l * 40; e.stun = Math.max(e.stun, 0.25); e.atkCd = Math.max(e.atkCd || 0, 0.3); }   // day lui
  if (R.P.breakRes && Math.random() * 100 < R.P.breakRes) e.resBrkT = 3;   // sat thuong giam khang
  if (R.P.leech && a.ext) heal(tot * R.P.leech / 100, true);
  if (R.P.manaLeech && a.ext) R.mana = Math.min(R.P.mana, R.mana + tot * R.P.manaLeech / 100);   // JX1: hut sinh luc / noi luc chi tac dung voi chieu ngoai cong
  const k = kh ? ' ⚡' : bk ? ' 🛡' : '';
  addText(e.x, e.y - e.r - 6, fmt(tot) + k + (heavy ? '!' : ''), crit || heavy ? '#ffe14a' : ELEM_COL[best], crit || heavy ? 16 : 12);
  return tot;
}
function enemyHit(e) {
  const cm = typeof curseMod === 'function' ? curseMod(e) : null;
  if (Math.random() * 100 >= hitPercent(e.ar * (cm ? Math.max(0.1, 1 + cm.ar / 100) : 1), R.P.def)) { addText(H.x, H.y - 30, 'Né', '#9cf', 11); return; }
  if (R.P.block && Math.random() * 100 < R.P.block) { addText(H.x, H.y - 30, 'Hóa giải', '#9cf', 11); return; }
  const el = SERIES_ELEM[e.series] || 'phys';                           // quai danh bang nguyen to cua he (kieu JX1)
  let d = e.dmg * rnd(0.8, 1.2) * (cm ? Math.max(0.1, 1 + cm.dmg / 100) : 1);   // bua hai giam sat thuong quai
  d = applyPart(d, el, e.series, R.P.series, R.P.res, PLAYER_RES_MAX, 10);
  if (counters(e.series, R.P.series)) { d *= 1 + SERIES_BONUS; if (R.P.res5) d = Math.max(1, d - R.P.res5); }   // quai khac ta: +10%, Ngu hanh nhuoc hoa giam (truoc day ap dung nguoc)
  else if (counters(R.P.series, e.series)) d *= 1 - SERIES_BONUS;
  if (R.P.dmgShield) d -= Math.min(R.P.dmgShield, d * DMG_SHIELD_MAX);   // Huyen Thien Vo Cuc...: tru diem moi don, toi da 35% don
  if (el === 'cold') R.slowT = Math.max(R.slowT || 0, ELEM_SLOW_T * (1 - (R.P.freezeRed || 0) / 100));
  if (el === 'light' && Math.random() < ELEM_STUN_P && !(Math.random() * 100 < (R.P.antiStun || 0))) R.stunT = Math.max(R.stunT || 0, ELEM_STUN_T * (1 - (R.P.stunRed || 0) / 100));
  if (el === 'poison') { const pt = POISON_TIME * (1 - (R.P.poisonRed || 0) / 100), dot = d * 0.4; d -= dot; if (pt > 0.05) { R.hpDot = (R.hpDot || 0) + dot * pt / POISON_TIME; R.hpDotT = Math.max(R.hpDotT || 0, pt); } }   // doc: 40% thanh mat mau theo thoi gian, giam boi Thoi gian trung doc
  if (R.P.sorb) d *= 1 - R.P.sorb / 100;                                // triet tieu sat thuong
  if (R.P.dmg2mana) R.mana = Math.min(R.P.mana, R.mana + d * R.P.dmg2mana / 100);
  if (cm && cm.ret && !e.ranged) e.hp -= d * cm.ret / 100;               // Hoa Lien Phan Hoa: phan don can chien
  R.life -= d; R.hurtT = 0.25; if (H.act !== 'at' && Math.random() < 0.3) { H.act = 'hurt'; H.actT = 0; R.atkT = Math.max(R.atkT || 0, 0.25 * (1 - (R.P.hitRec || 0) / 100)); }   // khung bi danh: Thoi gian phuc hoi rut ngan
  if (R.P.retMelee || R.P.retMeleeP || R.P.retRangeP) { const ret = e.ranged ? d * (R.P.retRangeP || 0) / 100 : R.P.retMelee + d * R.P.retMeleeP / 100; if (ret > 0) { e.hp -= ret; } }
  addText(H.x + rnd(-10, 10), H.y - 36, '-' + fmt(d), '#ff6a5a', 12);
}
function heal(v, quiet) { const b = R.life; R.life = Math.min(R.P.life, R.life + v); if (!quiet && R.life - b > 1) addText(H.x, H.y - 44, '+' + fmt(R.life - b), '#7f7', 11); }

/* ---------- tu dung thuoc (potion.txt): hoi dan theo thoi gian, tru ngan luong ---------- */
const POT_TIER_LV = [0, 1, 20, 40, 70, 100]; // cap nhan vat mo khoa bac thuoc 1..5
function bestPotion(kind) {
  let best = null;
  for (const p of J.potions) if (p.kind === kind && S.lvl >= (POT_TIER_LV[p.tier] || 999) && potPrice(p) <= S.gold && (!best || p.tier > best.tier)) best = p;
  return best;
}
/* Gia thuoc tang theo cap nhan vat (cho tieu ngan luong: potion.txt gia co dinh, quai cap cao roi nhieu ngan luong) */
const potPrice = p => Math.round(p.price * (1 + S.lvl / 25));
function autoPotion(dt) {
  R.hot = R.hot || { life: 0, mana: 0, lifeT: 0, manaT: 0 };
  const h = R.hot, P = R.P;
  for (const k of ['life', 'mana']) {
    if (h[k + 'T'] > 0) { const d = Math.min(dt, h[k + 'T']); h[k + 'T'] -= dt; if (k === 'life') R.life = Math.min(P.life, R.life + h.life * d); else R.mana = Math.min(P.mana, R.mana + h.mana * d); }
  }
  R.potCd = R.potCd || { life: 0, mana: 0 };
  if (S.potBuy !== false) for (const i of [0, 1]) potRestock(i);
  if (S.potOff) return;
  // JX1 auto: sinh luc / noi luc duoi 50% thi uong; o thuoc hien hoi chieu (R.potCd) nhu bam tay
  const needLife = R.life < P.life * 0.5, needMana = R.mana < P.mana * 0.5 || (P.main.cost > 0 && R.mana < P.main.cost * 2);
  for (const [k, need] of [['life', needLife], ['mana', needMana]]) {
    // binh thuong: 1 binh moi lan hoi xong; nguy kich (< 30% mau): uong them binh chong len sau hoi chieu
    const urgent = k === 'life' && R.life < P.life * 0.3;
    if (!need || R.potCd[k] > 0 || (h[k + 'T'] > 0 && !urgent)) continue;
    const r = typeof slotPick === 'function' ? slotPick(k === 'life' ? 0 : 1) : null, own = r ? null : takeStock(k), p = r ? r.p : own || bestPotion(k); if (!p) continue;
    usePotion(k, p, r ? r.free : !!own); R.potCd[k] = POT_CD;
  }
}
/* Tu mua thuoc khi het: mua 1 xap (POT_STACK) thuoc dang chon o o / tot nhat mua duoc, toi da 20% ngan luong */
function potRestock(i) {
  const kind = i ? 'mana' : 'life', sel = typeof slotPot === 'function' ? slotPot(i) : null;
  if (sel ? (potStock(sel.kind)[sel.tier] || 0) > 0 : stockCount(kind) > 0) return;
  let p = sel && potOpen(sel) ? sel : null;
  if (!p) for (const x of J.potions) if (x.kind === kind && S.lvl >= (POT_TIER_LV[x.tier] || 999) && potPrice(x) * POT_STACK <= S.gold * 0.2 && (!p || x.tier > p.tier)) p = x;
  if (!p) return;
  const cost = potPrice(p) * POT_STACK; if (cost > S.gold * 0.2) return;
  S.gold -= cost; const st = potStock(p.kind); st[p.tier] = (st[p.tier] || 0) + POT_STACK;
  log(`Tự mua ${POT_STACK} ${p.n} (-${fmt(cost)} lượng)`);
}
function usePotion(k, p, free) { // mua va uong ngay: hoi dan trong p.dur giay, cong don phan con lai cua binh truoc
  R.hot = R.hot || { life: 0, mana: 0, lifeT: 0, manaT: 0 };
  const h = R.hot;
  if (!free) S.gold -= potPrice(p);
  S.potUsed = (S.potUsed || 0) + 1; questTick('pots');
  const add = (k, total, dur) => { const left = h[k + 'T'] > 0 ? h[k] * h[k + 'T'] : 0; h[k + 'T'] = dur; h[k] = (left + total) / dur; };
  if (p.kind === 'both') { add('life', p.total, p.dur); add('mana', p.mtotal, p.mdur); } else add(k, p.total, p.dur);   // Ngu Hoa...: hoi ca hai
}

/* ---------- vong lap ---------- */
const alive = () => R.enemies.filter(e => e.hp > 0);
function nearest(list) {   // uu tien quai minh khac (x0.7 khoang cach), tranh quai khac minh (x1.3)
  const hs = R.P ? R.P.series : -1; let b = null, bd = 1e9;
  for (const e of list) { let d = Math.hypot(e.x - H.x, e.y - H.y) * (counters(hs, e.series) ? 0.7 : counters(e.series, hs) ? 1.3 : 1) * (typeof dtWant === 'function' && dtWant(e) ? 0.3 : 1); if (OBS.g && !obsSee(H.x, H.y, e.x, e.y)) d = d * 2.5 + 200; if (d < bd) { bd = d; b = e; } }   // sau tuong: uu tien quai thay duoc
  return b;
}
/* Xoay chieu tu dong khi farm quai thuong (gap trum / tinh anh thi danh chieu chinh): luan phien cac chieu tan cong dang gan o 1..4 (luon co 2 chieu manh nhat, them chieu >= 40% DPS chieu manh nhat);
   chieu het noi luc thi bo qua, khong chieu nao du noi luc thi danh thuong. Tat: danh moi chieu chinh nhu truoc. */
function rotPool(P) {
  if (S.rot === false || window.NO_ROT || (S.mainLock && S.main === 'basic')) return [];   // NO_ROT: chi dung de so sanh A / B trong test
  const ids = (S.slots || []).filter(Boolean), pool = P.actives.filter(a => ids.includes(a.id));
  if (pool.length < 2) return [];
  const byDps = pool.slice().sort((a, b) => b.dps - a.dps), top = byDps[0].dps, keep = new Set(byDps.filter((a, i) => i < 2 || a.dps >= top * 0.4));   // it nhat 2 chieu manh nhat, them chieu >= 40% DPS chieu manh nhat
  return ids.map(id => pool.find(a => a.id === id)).filter(a => a && keep.has(a));
}
function pickAttack(P, hard) {
  // HorseLimit (ride.js): Auto chon trang thai ngua theo chieu chinh; xoay chieu chi dung chieu hop trang thai do
  const st = autoRide() && !skHorseOk(SK[P.main.id], !!R.mounted) ? !R.mounted : !!R.mounted;
  const pool = hard ? [] : rotPool(P).filter(a => skHorseOk(SK[a.id], st));   // gap trum / tinh anh: danh chieu chinh manh nhat (khong xoay) de khong mat DPS
  if (pool.length < 2) return R.mana >= P.main.cost ? P.main : P.basic;
  const n = pool.length; R.rotI = (R.rotI || 0) % n;
  for (let k = 0; k < n; k++) { const a = pool[(R.rotI + k) % n]; if (R.mana >= a.cost) { R.rotI = (R.rotI + k + 1) % n; return a; } }
  return P.basic;
}
/* Sat thuong tang 2: chieu con no quanh muc tieu (EV2, stats.js) */
function stage2(a, t, list) {
  const d = ev2Of(a); if (!d) return;
  const c = d.rays ? H : t, rad = d.rays ? 280 : 150;      // tia toa tu nguoi danh (Kim Dinh Phat Quang)
  const near = list.filter(e => !e.dead && Math.hypot(e.x - c.x, e.y - c.y) < rad && obsSee(c.x, c.y, e.x, e.y)).sort((p, q) => Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(q.x - c.x, q.y - c.y)).slice(0, ev2Max(a, d));
  let shown = false;
  for (const e of near) {
    if (d.chance && Math.random() >= d.chance) continue;
    const parts = ev2Parts(a, d);
    const a2 = Object.assign({}, a, { parts, stun: d.stun || 0, useAR: false, ev2: true, crit: d.el === 'phys' ? a.crit : 0 });
    recHit(heroHit(a2, e), a2); if (typeof ev2Fx === 'function') ev2Fx(e, a, !shown && (d.rays ? `${d.n} ×${ev2Max(a, d)}` : d.n), d.rays ? H : null); shown = true;
  }
}
function heroAttack() {
  const P = R.P, list = alive(); if (!list.length) return 0.3;
  const t = nearest(list);
  let a = pickAttack(P, t.cls === 'boss' || t.cls === 'elite' || !!t.goldBoss);
  const d = Math.hypot(t.x - H.x, t.y - H.y) - t.r;
  if (d > a.rad + 300 && autoRide()) setMount(true, true);              // quai con xa: len ngua chay toi
  else if (d <= a.rad + 60) { const rf = rideForAttack(a); if (rf === true) return 0.25; if (rf === null) a = P.basic; }   // chieu khong dung duoc tren / duoi ngua (HorseLimit): Auto doi trang thai ngua
  if (d > a.rad || !obsSee(H.x, H.y, t.x, t.y)) { R.moveTo = manual() ? null : t; return 0.05; }   // ngoai tam / bi tuong chan: di toi (tu dieu khien: dung)   // tu dieu khien: chi danh quai trong tam, khong tu chay toi
  R.moveTo = null;
  R.mana -= a.cost;
  const c = a.around ? H : t, splash = a.around ? a.rad + 40 : 110; // form 7: quanh nguoi danh
  const targets = list.filter(e => e !== t && Math.hypot(e.x - c.x, e.y - c.y) < (a.targets > 1 ? splash : 0) && obsSee(c.x, c.y, e.x, e.y)).slice(0, a.targets - 1);
  targets.unshift(t);
  for (const e of targets) { recHit(heroHit(a, e), a); skillFx(H, e, a); }
  if (a.ev) stage2(a, t, list);
  H.face = t.x >= H.x ? 1 : -1; H.dir = dirOf(t.x - H.x, t.y - H.y); H.act = 'at'; H.actT = 0;
  if (a.id) skillSfx(a.id); else npcSfx(heroGfx() && heroGfx().anim, 'at', 0.4);
  return 1 / a.rate;
}
function enemyAI(e, dt) {
  if (e.resBrkT > 0) e.resBrkT -= dt;
  if (e.curse) { const cm = curseMod(e); if (cm && cm.regen < 0) e.hp += cm.regen * 2 * dt; }   // Nhiep Hon Loan Tam: quai mat sinh luc
  if (e.stun > 0) { e.stun -= dt; return; }
  const sl = e.slowT > 0 ? (e.slowT -= dt, ELEM_SLOW) : 1;               // bi lam cham
  if (e.poison > 0) { e.poison -= dt; e.hp -= e.poisonDmg * dt; }
  // GameMaster tang hinh: quai khong target / khong duoi / khong danh
  if (typeof titleGmStealth === 'function' && titleGmStealth()) {
    e.aggro = false; e.moving = false;
    if (e.home && typeof fieldIdle === 'function') fieldIdle(e, dt);
    return;
  }
  if (e.home && fieldIdle(e, dt)) return;                                // chua giao chien: loanh quanh diem goc (field.js)
  const d = Math.hypot(H.x - e.x, H.y - e.y), reach = e.ranged ? (e.reach || 200) : Math.max(e.r + 24, Math.min(e.reach || 0, 90));
  if (e.act !== 'at' && e.act !== 'hurt') { e.face = H.x >= e.x ? 1 : -1; e.dir = dirOf(H.x - e.x, H.y - e.y); }
  if ((e.seeT = (e.seeT || 0) - dt) <= 0) { e.seeT = 0.25; e.see = d > reach + 4 || obsSee(e.x, e.y, H.x, H.y); }   // tuong chan: khong danh xuyen tuong, phai di vong
  e.moving = d > reach || !e.see;
  if (e.moving) obsChase(e, H.x, H.y, e.spd * sl * dt);
  if (e.home) fieldLeash(e);
  e.atkCd -= dt * sl;
  if (d <= reach + 4 && e.see && e.atkCd <= 0 && e.act !== 'hurt') {
    e.atkCd = e.cd * (e.curse && typeof curseMod === 'function' ? 1 + ((curseMod(e) || {}).slow || 0) / 100 : 1);
    e.face = H.x >= e.x ? 1 : -1; e.dir = dirOf(H.x - e.x, H.y - e.y);
    enemyHit(e); e.act = 'at'; e.actT = 0; npcSfx(e.animKey || MON[e.tid].anim, 'at', 0.35); if (e.ranged) fxLine(e, H, { parts: { phys: 1 } });
  }
}
function tick(dt) {
  obsFrame(); recTick(dt);
  if ((R.sweepT = (R.sweepT || 0) + dt) > 30) { R.sweepT = 0; autoEquipAll(); if (typeof autoFuse === 'function') autoFuse(); if (typeof autoHut === 'function') autoHut(); sweepJunk(); autoBuyWeapon(); autoForge(); checkHints(); }
  if (R.dirty) recalc();
  const P = R.P;
  if (R.deadT > 0) { R.deadT -= dt; if (R.deadT <= 0) { R.life = P.life; R.mana = P.mana; S.wave = 1; if (!fieldMode()) spawnWave(); } return; }
  R.life = Math.min(P.life, R.life + P.regen * dt); R.mana = Math.min(P.mana, R.mana + P.manaRegen * dt);
  autoPotion(dt); rideTick(dt);
  if (R.hpDotT > 0) { const k = Math.min(dt, R.hpDotT) / R.hpDotT; R.life -= R.hpDot * k; R.hpDot -= R.hpDot * k; R.hpDotT -= dt; }   // trung doc
  if (R.slowT > 0) R.slowT -= dt;
  if (R.stunT > 0) R.stunT -= dt;
  if (R.hurtT > 0) R.hurtT -= dt;
  if (R.tpCd > 0) R.tpCd -= dt;
  if (R.potCd) { R.potCd.life = Math.max(0, R.potCd.life - dt); R.potCd.mana = Math.max(0, R.potCd.mana - dt); }
  goldBossTick(dt); petTick(dt); ghTick(dt); if (typeof skillSysTick === 'function') skillSysTick(dt);                                         // phan thuong: trum Hoang Kim, dong hanh (rewards.js)
  if (typeof othTick === 'function') othTick(dt);                            // nguoi choi khac (others.js)
  if (R.town) { townTick(dt); return; }                                // trong thanh (Tho Dia Phu)
  dgTick(dt);                                                           // pho ban / boss tuan: dong ho gioi han (dungeon.js)
  R.activeT = (R.activeT || 0) + dt;                                    // thoi gian danh quai thuc (khong tinh tab an, trong thanh, Luyen Cong) -> S.kps
  const looting = updateGround(dt);                       // di nhat do (cham tay, hoac het quai + khop bo loc)
  if (fieldMode()) fieldTick(dt);                          // bai luyen cong kieu JX1: quai dat san, hoi sinh tai cho (field.js)
  if (!R.enemies.length) {
    if (fieldMode()) return;
    if (looting && R.lootWait < 8) { R.lootWait += dt; return; }   // doi nhat xong (toi da 8 giay) moi goi dot moi
    if (R.spawnT > 0) { R.spawnT -= dt; return; }
    R.lootWait = 0;
    if (R.dg) dgSpawn(); else if (R.tower) towerSpawn(); else {
      const zz = zoneOf(S.stage); spawnWave();
      if (goldBossDue() && zz.m && zz.m.length && zz.boss) spawnGoldBoss();
    }
    return;
  }
  if (manual()) moveManual(dt);                             // tu dieu khien: joystick / phim / diem cham
  if (!(looting && R.pickTarget)) {                        // dang chu dong di nhat thi khong danh
    if (manual()) { /* dung yen hoac di theo tay, khong tu chay toi quai */ }
    else if (R.moveTo && R.moveTo.hp > 0 && !looting) {          // dang di nhat do gan: khong chay theo quai
      if (!(R.stunT > 0)) obsSteer(H, R.moveTo.x, R.moveTo.y, 150 * curSpeed() * (R.slowT > 0 ? ELEM_SLOW : 1) * dt);
    }
    if (!(R.stunT > 0)) { R.atkT -= dt * (R.slowT > 0 ? ELEM_SLOW : 1); if (R.atkT <= 0) R.atkT = heroAttack(); }   // choang: dung danh; cham: danh cham
  }
  for (const e of alive()) {
    // khach MP: TAT AI di chuyen/danh cua quai remote — chi host dieu khien (het lech → danh khong khi)
    if (typeof mpActive === 'function' && mpActive() && typeof mpIsHost === 'function' && !mpIsHost() && e.mpRemote) {
      if (e.stun > 0) e.stun -= dt;
      if (e.poison > 0) { e.poison -= dt; e.hp -= e.poisonDmg * dt; }
      if (e.slowT > 0) e.slowT -= dt;
      if (e.resBrkT > 0) e.resBrkT -= dt;
      e.moving = false;
      continue;
    }
    enemyAI(e, dt);
  }
  killCheck();
  R.stall += dt; if (R.stall > 45) stallOut();
  if (R.life <= 0) heroDeath();
}
/* Dot quai qua lau (danh khong noi): truoc day chi goi lai dot moi -> o ai trum, nhan vat yeu danh lai trum mai mai, khong
   tien khong lui (ket vinh vien o ai 30/40/50). Nay: lui 1 ai va luyen cong nhu khi guc (khong mat mau), thap thi roi thap. */
function stallOut() {
  R.stall = 0;
  if (R.dg) return;                                        // pho ban: gioi han thoi gian rieng (dgTick)
  if (R.tower) { towerExit(false); return; }
  if (fieldMode()) { R.field = null; log('<span class="dim">Lâu không hạ được quái, dàn lại bãi quái.</span>'); return; }   // bai JX1: dung lai bai
  const boss = R.enemies.some(e => !e.dead && e.cls === 'boss');
  if (boss || S.wave === WAVES) {
    if (R.enemies.some(e => e.goldBoss && !e.dead)) RW().gbT = GB_RETRY;
    log('<span class="dim">Đánh mãi không hạ được, gọi quái mới.</span>');
    S.wave = 1; R.round = (R.round || 0) + 1; if (typeof onStageChange === 'function') onStageChange();
  } else log('<span class="dim">Đợt quái kéo dài quá lâu, gọi đợt mới.</span>');
  spawnWave();
}
function killCheck() {
  for (const e of R.enemies) if (e.hp <= 0 && !e.dead) { e.dead = true; onKill(e); npcSfx(MON[e.tid].anim, 'die', 0.5); if (!R.quiet) { e.act = 'die'; e.actT = 0; R.corpses.push(e); } }
  if (!fieldMode() && R.enemies.length && R.enemies.every(e => e.dead)) { R.enemies = []; waveCleared(); }
}
function onKill(e) {
  R.kills++; S.totalKills = (S.totalKills || 0) + 1; R.stall = 0; fieldOnKill();
  const lvDiff = e.L - S.lvl, mult = lvDiff < -10 ? 0.2 : lvDiff < -5 ? 0.6 : 1;
  gainXp(expFor(Math.min(e.L, S.lvl + XP_OVER)) * CLS[e.cls].xp * newbieXp() * mult * diffOf().rew * monRewK(e.L) * densK(e));   // quai cao hon qua 25 cap: kinh nghiem tinh nhu quai cao hon 25 cap (giu nhip len cap khi vuot ai qua xa)
  const g = Math.round(moneyDrop(e) * diffOf().rew * monRewK(e.L) * densK(e)); S.gold += g;
  burst(e.x, e.y, SERIES_COL[e.series]);
  for (const it of rollDrops(e)) dropToGround(it, e);
  for (const m of allDrops(e)) log(`Nhặt được <b style="color:#7fd0ff">${esc(m)}</b>`);   // nguyen lieu ren: khong dung mau Tim (Tim = do kham Huyen Tinh)
  const gold = rollSetDrop(e); if (gold) { dropToGround(gold, e); log(`<b style="color:${RAR_COL[gold.r]}">${esc(gold.n)}</b> rơi ra!`); }
  if (e.cls === 'boss') log(`Hạ <b class="boss">${esc(e.n)}</b> (+${fmt(g)} lượng)`);
  rwOnKill(e); recKill(e, g); horseOnKill(e); ghOnKill(e); sk9OnKill(e);                     // ky luc + thuan duong ngua (records.js, horse.js)
}
function gainXp(x) {
  const cap = levelCap(); if (S.lvl >= cap) return;
  S.xp += x * (1 + rebornBonus().xp + (R.P && R.P.expPct ? R.P.expPct / 100 : 0)) * (1 + buffP('xp')) * (1 + buffP('tt')) / xpSlow(S.lvl);   // + hieu ung tang kinh nghiem (qua moc cap)    // chuyen sinh: +20% kinh nghiem moi lan; nhip len cap sau cap 30
  while (S.lvl < cap && S.xp >= J.exp[S.lvl - 1]) {
    S.xp -= J.exp[S.lvl - 1]; S.lvl++;
    S.attrPts += PTS_PER_LEVEL; S.skPts += SKILL_PTS_PER_LEVEL;
    R.dirty = true; uiSfx('levelup'); log(`<b class="up">Lên cấp ${S.lvl}!</b> +${PTS_PER_LEVEL} tiềm năng, +${SKILL_PTS_PER_LEVEL} kỹ năng`);
    if (typeof onLevelUp === 'function') onLevelUp();
  }
}
function waveCleared() {
  if (R.dg) { dgCleared(); return; }                       // pho ban / boss tuan (dungeon.js)
  if (R.tower) { towerCleared(); return; }                 // thap thu thach: len tang, khong doi ai
  heal(R.P.life * 0.15, true); R.mana = Math.min(R.P.mana, R.mana + R.P.mana * 0.2); // dieu tuc giua cac dot
  if (S.wave < WAVES) { S.wave++; R.spawnT = 1.2 / mountHaste(); return; }   // phi ngua nhanh: dot moi toi som hon
  S.wave = 1; R.round = (R.round || 0) + 1; questTick('stages');      // het che do vuot ai: 1 vong luyen cong xong
  if (typeof onStageChange === 'function') onStageChange();
}
function heroDeath() {
  if (R.enemies.some(e => e.goldBoss && !e.dead)) RW().gbT = GB_RETRY;   // thua trum Hoang Kim: 5 phut sau quay lai
  R.deadT = 3; R.life = 0; R.enemies = []; recDeath(); R.slowT = R.stunT = R.hpDotT = R.hpDot = 0;
  log('<span class="bad">Bạn đã trọng thương.</span>');
  if (R.dg) { dgFail('Gục ngã'); return; }                 // guc trong pho ban: that bai, khong lui ai
  if (R.tower) { towerExit(true); return; }               // gục trong thap: roi thap, khong lui ai
  if (typeof onStageChange === 'function') onStageChange();
}
function recalc() {
  if (typeof sk9SyncBranch === 'function') sk9SyncBranch();
  const fl = R.P ? R.life / R.P.life : 1, fm = R.P ? R.mana / R.P.mana : 1;
  R.P = calc();
  R.life = Math.min(R.P.life, R.P.life * fl); R.mana = Math.min(R.P.mana, R.P.mana * fm);
  R.power = powerShown(power(R.P)); R.dirty = false;
  const we = curEqt(); if (R.padEqt !== we) { R.padEqt = we; if (typeof renderPad === 'function' && document.querySelector('#pad')) renderPad(); }   // doi vu khi: cap nhat o chieu (xam chieu sai vu khi)
  if (typeof heroLook === 'function') R.look = heroLook();             // ngoai hinh theo trang bi (look.js)
  if (typeof jxSetup === 'function') { const old = R.jx && R.jx.key; R.jx = jxOn() ? jxSetup() : null; if (R.jx && R.jx.key !== old) jxPreload(); }   // nhan vat ghep bo phan JX1 (jxparts.js)
}

/* ---------- mo phong nhanh (kiem thu, tien trinh offline) ---------- */
function simulate(seconds, step = 0.05) { const q = R.quiet; R.quiet = true; for (let t = 0; t < seconds; t += step) tick(step); R.quiet = q; }
