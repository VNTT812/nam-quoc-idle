/* ======================= CHI SO NHAN VAT (theo KPlayer.cpp / level_add.txt) ======================= */
'use strict';
/* Cong don thuoc tinh ma thuat: A[ten] = [p1, p2, p3] */
/* Dong "(Duong)" tren do Hoang Kim / Bach Kim: truoc day KHONG duoc tinh (vd ~230 mon co Sinh luc / Khang tat ca (Duong)) -> quy ve dong thuong */
const ATTR_ALIAS = { lifemax_yan_v: 'lifemax_v', lifemax_yan_p: 'lifemax_p', manamax_yan_v: 'manamax_v', allres_yan_p: 'allres_p',
  physicsres_yan_p: 'physicsres_p', poisonres_yan_p: 'poisonres_p', coldres_yan_p: 'coldres_p', fireres_yan_p: 'fireres_p', lightingres_yan_p: 'lightingres_p',
  attackspeed_yan_v: 'attackspeed_v', castspeed_yan_v: 'castspeed_v', sorbdamage_yan_p: 'sorbdamage_p', fasthitrecover_yan_v: 'fasthitrecover_v',
  anti_allres_yan_p: 'anti_allres_p', anti_coldres_yan_p: 'anti_coldres_p', anti_lightingres_yan_p: 'anti_lightingres_p' };
/* Dong khong co tac dung trong game idle (khong PK, quai khong lam choang / cham nhan vat, khong co do ben, the luc) */
/* Ho Tro Tan Thu (nhu JX1: nhan vat moi duoc ho tro): tu cap 1 den het cap 9, moi giay hoi 3% sinh luc + 5% noi luc. Khong ap dung khi da chuyen sinh. */
const NEWBIE_LV = 30, NEWBIE_REGEN = { life: 0.03, mana: 0.05 }, NEWBIE_XP = 2;   // Ho Tro Tan Thu: hoi phuc + kinh nghiem luyen cap +200% den cap 30
const newbieXp = () => newbieOn() ? 1 + NEWBIE_XP : 1;
const newbieOn = () => typeof S !== 'undefined' && S && S.fac && S.lvl < NEWBIE_LV && !rebornN();
const ATTR_NOEFFECT = new Set(['indestructible_b', 'staminareplenish_v', 'staminamax_v', 'pk_punish_weaken', 'durability_v', 'item_purple']);
function addAttr(A, name, p, mult = 1) {
  name = ATTR_ALIAS[name] || name;
  const a = A[name] || (A[name] = [0, 0, 0]);
  for (let i = 0; i < 3; i++) a[i] += (p[i] || 0) * mult;
}
const av = (A, n, i = 0) => (A[n] ? A[n][i] : 0);

/* ---------- Ngu hanh trang bi (KItemList::GetEquipEnhance) ----------
   Dong an thu k (dong 2, 4, 6) cua mot mon mo khi so "tuong sinh" >= k: +1 neu he nhan vat sinh he mon do,
   +1 cho moi mon o 2 o lien ket (ms_ActivedEquip) co he sinh he mon do. Ngua luon mo du. */
const ACCRUE = { 0: 2, 2: 1, 1: 3, 3: 4, 4: 0 }; // Kim sinh Thuy, Thuy sinh Moc, Moc sinh Hoa, Hoa sinh Tho, Tho sinh Kim
const accrues = (a, b) => a >= 0 && b >= 0 && ACCRUE[a] === b;
const ACTIVATED_BY = { helm: ['armor', 'amulet'], armor: ['ring2', 'belt'], belt: ['pendant', 'cuff'], weapon: ['amulet', 'armor'],
  boot: ['weapon', 'helm'], cuff: ['boot', 'ring1'], amulet: ['belt', 'ring2'], ring1: ['weapon', 'helm'], ring2: ['cuff', 'pendant'],
  pendant: ['boot', 'ring1'] };
function slotOfEquipped(it, eq) { for (const k in eq) if (eq[k] === it) return k; return null; }
function hiddenActive(it, eq = S.eq) {
  if (it.leg) return 3;
  if (it.set && it.d === 10) return 3;                   // v128: Hoang Kim le kich bang ngu hanh nhu do thuong; du bo -> mo het (duoi)
  if (enoughToActive(eq)) return 3;                     // IsEnoughToActive: du bo -> mo het dong an
  const slot = slotOfEquipped(it, eq);
  if (!slot) return 0;
  if (slot === 'horse') return 3;
  let n = accrues(heroSeries(), it.s) ? 1 : 0;
  for (const k of ACTIVATED_BY[slot] || []) if (eq[k] && accrues(eq[k].s, it.s)) n++;
  return n;
}
function heroStart() { const f = FAC[S.fac]; return J.start[f.series * 2 + (S.sex || 0)] || J.start[0]; }
function heroSeries() { return FAC[S.fac] ? FAC[S.fac].series : 0; }
function weaponCode(eq) {
  const w = eq.weapon; if (!w) return 9;               // 9 = tay khong (Quyen/Chuong phap)
  // ma loai vu khi cua mon vu khi phai (tham so 3 cua addphysicsdamage_p): 0 kiem, 1 dao, 2 con, 3 thuong, 4 chuy,
  // 5 song dao / thich, 7 am khi, 9 tay khong / trien thu
  return w.d === 1 ? 7 : w.k === 6 ? 9 : w.k;
}
/* Cap ky nang cong them tu trang bi: Tat ca ky nang + ky nang rieng (allskill_v co id) */
function skillBonusLv(id) { const P = R.P; return P ? (P.plusSkill || 0) + ((P.skAdd || {})[id] || 0) : 0; }

/* Ky nang bi dong: mon vu khi (chi tinh khi dung dung loai vu khi), noi cong, hao quang... */
function passiveApplies(s, name, p, wc) {
  if (name === 'addphysicsdamage_p' || name === 'attackratingenhance_p' || name === 'deadlystrikeenhance_p') {
    const need = s.attr.addphysicsdamage_p ? skVal(s, 'addphysicsdamage_p', 1)[2] : -1;
    if ([0, 1, 2, 3, 4, 5, 7, 9].includes(need)) return wc === need;
  }
  return true;
}
const SKIP_PASSIVE = /^(skill_|missle_|addskilldamage)/;

let IGNORE_REQ = null;                                   // equipCompare: CHI mon dang xem duoc tinh thu du chua du dieu kien (cac mon dang mac van xet dieu kien nhu that)
const reqPass = it => it === IGNORE_REQ || reqOk(it);
const VIO_MUL = 1.8;
function calc(eq) {
  eq = eq || S.eq;
  const A = {}, lv = S.lvl, ser = heroSeries(), add = J.levelAdd[ser], st = heroStart();
  const skAdd = {};                                        // allskill_v co tham so 3 = id ky nang: +cap cho rieng ky nang do
  const addItemAttr = (m, k = 1) => {
    const name = attrReal(attrName(m.a)), p = m.p.map((v, i) => v === -1 ? 0 : i < 2 && k !== 1 ? v * k : v);
    if (name === 'allskill_v' && p[2] > 0) { skAdd[p[2]] = (skAdd[p[2]] || 0) + Math.round(m.p[0]); return; }
    addAttr(A, name, p);
  };
  // trang bi: thuoc tinh goc + thuoc tinh ma thuat (bo qua mon chua du dieu kien)
  let hsp = 0;                                             // toc do cua ngua (chi tinh khi dang cuoi: ride.js)
  for (const k in eq) {
    const it = eq[k]; if (!it || !reqPass(it)) continue;
    const sp0 = k === 'horse' ? av(A, 'fastwalkrun_p') : 0;
    const em = enhMul(it);                                 // cuong hoa (forge.js): nhan thuoc tinh goc
    for (const [id, mn, mx] of it.base) addAttr(A, attrName(id), [horseAdj(it, (id === 28 || id === 29 ? mn : (mn + mx) / 2) * em), 0, 0]);   // ngua: thuan duong (horse.js)
    const act = hiddenActive(it, eq);
    const vk = it.vio ? VIO_MUL : 1;                       // ban 73: dong Tim (Huyen Tinh) manh hon dong xanh -> do Tim la do chinh
    (it.mag || []).forEach((m, i) => { if (i % 2 === 0 || Math.floor(i / 2) < act) addItemAttr(m, vk); });
    if (it.set) { const ex = goldEnhance(it, eq); (it.ext || []).slice(0, ex).forEach(addItemAttr); }
    if (k === 'horse') hsp = av(A, 'fastwalkrun_p') - sp0;
  }
  // ky nang bi dong
  const wc = weaponCode(eq), plus = av(A, 'allskill_v');
  const P = { A, plusSkill: plus, skAdd };
  const lvOf = id => S.sk[id] + plus + (skAdd[id] || 0);
  for (const id in S.sk) {
    const s = SK[id]; if (!s || !S.sk[id] || isAttack(s)) continue;
    if (typeof skApplies === 'function' && !skApplies(s)) continue;    // bua loi het han / vong sang khong bat / bua hai (skillsys.js)
    const L = lvOf(id);
    for (const name in s.attr) {
      if (SKIP_PASSIVE.test(name)) continue;
      const p = skVal(s, name, L);
      if (p && passiveApplies(s, name, p, wc)) addAttr(A, name, p);
    }
  }
  titleAttr(A);                                            // danh hieu dang deo (rewards.js)
  horseAttr(A);                                            // so ngua (horse.js)
  P.rebDmg = 1 + rebornBonus().dmg;                        // chuyen sinh: +10% sat thuong moi lan
  P.dmgMul = P.rebDmg * HERO_DMG_K;                        // v133 (JX1): bo can bang theo phai / cap; HERO_DMG_K = he so chung game treo
  // thuoc tinh co ban: diem goc cua he + diem phan phoi + trang bi
  P.str = st.str + S.attr.str + av(A, 'strength_v');
  P.dex = st.dex + S.attr.dex + av(A, 'dexterity_v');
  P.vit = st.vit + S.attr.vit + av(A, 'vitality_v');
  P.eng = st.eng + S.attr.eng + av(A, 'energy_v');
  P.series = ser;
  // sinh luc / noi luc: goc + cap * X/cap + diem * X/diem (KPlayer::SetBaseLifeMax)
  P.life = (st.life + (lv - 1) * (add.LifePerLevel + IDLE_LIFE_PER_LEVEL) + (P.vit - st.vit) * add.LifePerVitality + av(A, 'lifemax_v')) * (1 + av(A, 'lifemax_p') / 100);
  P.mana = (st.mana + (lv - 1) * add.ManaPerLevel + (P.eng - st.eng) * add.ManaPerEnergy + av(A, 'manamax_v')) * (1 + av(A, 'manamax_p') / 100);
  P.life = Math.max(50, P.life); P.mana = Math.max(20, P.mana);
  P.regen = 1 + lv * 0.08 + av(A, 'lifereplenish_v') + P.life * av(A, 'lifereplenish_p') / 10000;
  P.manaRegen = 1 + lv * 0.05 + av(A, 'manareplenish_v') + P.eng * 0.02;
  // chinh xac / ne tranh (KPlayer::SetNpcAttackRating / SetNpcDefence)
  P.ar = Math.max(10, (P.dex * 4 - 28 + av(A, 'attackrating_v') + av(A, 'attackratingenhance_v')) * (1 + (av(A, 'attackratingenhance_p') + av(A, 'attackrating_p')) / 100));
  // Vo Mon Phai (cap 1-9): moi he ngang nhau truoc khi vao phai (he Tho khoi dau Than phap 15 -> chinh xac 32, sinh luc 76: truot nhieu, guc lien tuc)
  if (typeof isNovice === 'function' && isNovice()) { P.ar = Math.max(P.ar, 72 + (lv - 1) * 8); P.life = Math.max(P.life, 200 + (lv - 1) * 20); }
  P.newbie = newbieOn();
  if (P.newbie) { P.regen += P.life * NEWBIE_REGEN.life; P.manaRegen += P.mana * NEWBIE_REGEN.mana; }   // Ho Tro Tan Thu: vong sang hoi phuc den cap NEWBIE_LV
  P.def = Math.max(0, P.dex / 4 + av(A, 'adddefense_v') + av(A, 'armordefense_v') * 0.25) * (1 + av(A, 'armordefenseenhance_p') / 100);
  // khang: goc theo he (level_add) + trang bi / ky nang, gioi han 75 (+ allresmax)
  const baseRes = { phys: add.physicres, poison: add.poisonres, cold: add.coldres, fire: add.fireres, light: add.lightingres };
  P.res = {};
  for (const e of ELEM) P.res[e] = clamp(baseRes[e] + av(A, ELEM_RES[e]) + av(A, 'allres_p'), -100, PLAYER_RES_MAX + av(A, 'allresmax_p'));
  // vu khi: sat thuong goc + Suc manh/5 (can chien) hoac Than phap/5 (am khi)
  const w = eq.weapon && reqPass(eq.weapon) ? eq.weapon : null;
  const ranged = !!(w && w.d === 1);
  const wmin = av(A, 'weapondamagemin_v') || 1, wmax = av(A, 'weapondamagemax_v') || 2;
  const bonus = ranged ? P.dex / DEX_PER_DMG : P.str / STR_PER_DMG;
  P.wmin = wmin + bonus + av(A, 'addphysicsdamage_v'); P.wmax = wmax + bonus + av(A, 'addphysicsdamage_v');
  P.physPct = av(A, 'addphysicsdamage_p') + av(A, 'weapondamageenhance_p');
  // Can bang game idle: chieu noi cong manh len theo BAC vu khi dang cam (sat thuong goc vu khi / vu khi cung loai bac 1),
  // giong chieu ngoai cong nhan sat thuong vu khi; khong xet yeu cau Suc manh cua vu khi. Neu khong, cac phai noi cong
  // khong duoc gi tu do roi va bi bo xa khi choi dai (docs/DANH_GIA.md)
  P.spellW = 1;                                            // v133 (JX1): chieu noi cong khong nhan theo bac vu khi
  // am khi: Than phap da tang chinh xac (x4) va ne (/4) -> chi +0.5% sat thuong moi diem (Suc manh can chien: +1%)
  P.physStat = 1;                                          // v133 (JX1): Suc manh / Than phap chi cong thang vao sat thuong vu khi (/5), khong nhan %
  // Vo Mon Phai (cap 1-9) chi co danh thuong: tinh theo chi so cao nhat (he Tho khoi dau Suc manh 20 / Noi cong 40, sinh luc 76 -> truoc day mat ~25 phut moi len cap 10, cac he khac ~8 phut)
  P.add = {}; for (const e of ELEM) if (e !== 'phys') P.add[e] = av(A, ELEM_ADD[e]);
  P.enh = {}; for (const e in ELEM_ENH) P.enh[e] = av(A, ELEM_ENH[e]);
  P.crit = clamp(av(A, 'deadlystrikeenhance_p') + av(A, 'deadlystrike_p'), 0, 75);
  P.aspd = clamp(1 + (av(A, 'attackspeed_v') + av(A, 'castspeed_v')) / 100, 0.5, 3);
  P.leech = av(A, 'steallife_p') + av(A, 'steallifeenhance_p');
  P.manaLeech = av(A, 'stealmana_p') + av(A, 'stealmanaenhance_p');
  P.ignoreDef = av(A, 'ignoredefense_p');
  P.retMelee = av(A, 'meleedamagereturn_v'); P.retMeleeP = av(A, 'meleedamagereturn_p');
  P.series5 = av(A, 'five_elements_enhance_v'); P.res5 = av(A, 'five_elements_resist_v');
  P.seriesSkill = 0;   // dong 168-172 la sat thuong noi cong (ATTR_SER_DMG, core.js), khong con +% ky nang theo he
  P.lucky = av(A, 'lucky_v') + (typeof buffP === 'function' ? buffP('luck') : 0);   // + Que Hoa Tuu (Ky Tran Cac)
  P.speed = 1 + av(A, 'fastwalkrun_p') / 100; P.speedFoot = 1 + (av(A, 'fastwalkrun_p') - hsp) / 100;
  // dong truoc day bi bo qua (doc tu trang bi Hoang Kim / Bach Kim)
  P.skillEnh = av(A, 'skill_enhance');                                  // Tang cong kich ky nang %
  P.heavy = clamp(av(A, 'enhancehit_rate'), 0, 50);                     // Trong kich: sat thuong x1.5
  P.block = clamp(av(A, 'block_rate'), 0, 50);                          // Hoa giai: vo hieu hoa mot don cua quai
  P.dmgShield = av(A, 'dynamicmagicshield_v');                         // Giam thieu sat thuong ganh chiu (JX1, vd Huyen Thien Vo Cuc): tru diem moi don, toi da DMG_SHIELD_MAX
  P.sorb = clamp(av(A, 'sorbdamage_p'), 0, 60);                         // Triet tieu sat thuong %
  P.anti = {}; for (const e of ELEM) P.anti[e] = av(A, 'anti_allres_p') + av(A, 'anti_' + (e === 'phys' ? 'physics' : e === 'light' ? 'lighting' : e) + 'res_p');   // bo qua khang quai
  P.dmg2mana = av(A, 'damage2addmana_p'); P.retRangeP = av(A, 'rangedamagereturn_p'); P.stunAdd = av(A, 'do_stun_p'); P.expPct = av(A, 'expenhance_p');
  P.stunRed = clamp(av(A, 'stuntimereduce_p'), 0, 80); P.freezeRed = clamp(av(A, 'freezetimereduce_p'), 0, 80); P.poisonRed = clamp(av(A, 'poisontimereduce_p'), 0, 80);   // rut ngan choang / cham / trung doc tu quai
  // dong JX1 truoc day khong tac dung (cap nhat 22)
  P.hitRec = clamp(av(A, 'fasthitrecover_v'), 0, 90);                   // Thoi gian phuc hoi: giam khung bi danh (khung = 0.25s x (1 - x%))
  P.vision = clamp(av(A, 'visionradius_p'), 0, 30);                     // Pham vi sat thuong: +x% tam chieu
  P.knock = clamp(av(A, 'knockback_p'), 0, 40);                         // Day lui: x% day quai lui + ngat don
  P.antiMax = clamp(av(A, 'anti_maxres_p'), 0, 240);                    // Lam doi phuong co khang: tran khang quai giam x/4 (60 -> tran 60%, 120 -> 45%)
  P.antiStun = clamp(av(A, 'anti_do_stun_p'), 0, 80);                   // Ty le khang choang
  P.stunLong = clamp(av(A, 'anti_stuntimereduce_p'), 0, 200);           // Tao thanh thoi gian choang: choang gay ra dai them x%
  P.breakRes = clamp(av(A, 'anti_do_hurt_p'), 0, 60);                   // Sat thuong giam khang: x% moi don giam khang quai 10 trong 3s
  P.antiBlock = av(A, 'anti_block_rate');                               // Bo qua hoa giai cua trum / tinh anh
  P.antiSorb = clamp(av(A, 'anti_sorbdamage_yan_p'), 0, 60);            // Gia tang sat thuong len trum / tinh anh
  P.magAdd = { phys: av(A, 'addphysicsmagic_v'), poison: av(A, 'addpoisonmagic_v'), cold: av(A, 'addcoldmagic_v'), fire: av(A, 'addfiremagic_v'), light: av(A, 'addlightingmagic_v') };
  P.ranged = ranged;
  // ky nang chu dong + cong don addskilldamageN (tham so 1 = id ky nang duoc tang, tham so 3 = %)
  P.skillBonus = {};
  for (const id in S.sk) {
    const s = SK[id]; if (!s || !S.sk[id]) continue;
    for (const name in s.attr) if (name.startsWith('addskilldamage')) {
      const p = skVal(s, name, lvOf(id)); if (p && p[0]) P.skillBonus[p[0]] = (P.skillBonus[p[0]] || 0) + p[2];
    }
  }
  P.actives = []; const allAct = [], we = curEqt();
  for (const id in S.sk) { const s = SK[id]; if (S.sk[id] && isAttack(s) && (!isTrapSk(s) || (S.mainLock && +S.main === +id))) { const a = activeInfo(P, s, lvOf(id)); allAct.push(a); if (skWOk(s, we) || (R.ignoreEqt && R.ignoreEqt.has(skEqt(s)))) P.actives.push(a); } }   // JX1: chieu sai vu khi khong dung duoc
  P.basic = basicAttack(P);
  // noi luc: chieu ton nhieu hon (hoi noi luc + thuoc tu uong) chi dung duoc mot phan thoi gian, con lai danh thuong
  const income = P.manaRegen + manaPotRate(lv);
  for (const a of P.actives) { const spend = a.cost * a.rate; a.sustain = spend > 0 ? Math.min(1, income / spend) : 1; a.dps = a.dps * a.sustain + P.basic.dps * (1 - a.sustain); }
  // chieu chinh: chieu nguoi choi chon (S.mainLock) hoac chieu co DPS cao nhat, ke ca danh thuong
  const byDps = P.actives.concat([P.basic]).sort((a, b) => b.dps - a.dps);
  const owned = new Set(S.inv.concat(S.eq.weapon ? [S.eq.weapon] : []).filter(it => it.d <= 1 && reqOk(it)).map(itEqt));   // chi chon chieu co vu khi dung duoc trong tui
  const wantA = allAct.filter(a => { const e = skEqt(SK[a.id]); return e === null || owned.has(e); }).sort((a, b) => b.dps - a.dps)[0]; P.wantId = wantA && wantA.dps > P.basic.dps ? wantA.id : 0;   // chieu manh nhat neu cam dung vu khi (de tu mac vu khi)
  P.main = (S.mainLock && (S.main === 'basic' ? P.basic : P.actives.find(a => a.id === S.main))) || byDps[0];   // 'basic': khoa danh thuong (JX1)
  return P;
}

/* So muc tieu toi da theo hinh dang dan (SkillDef.h eMisslesForm):
   0 tuong, 1 thang hang, 2 toa, 3 vong tron, 4 ngau nhien, 5 vung, 6 tai muc tieu, 7 quanh nguoi danh, >=8 don can chien */
/* So dan theo cap (JX1 skill_misslenum_v: Khang Long Huu Hoi 1 -> 15, Vo Nga Vo Kiem 1 -> 8...); khong co bang thi dung childN */
const skMissiles = (s, L) => { const v = L ? skVal(s, 'skill_misslenum_v', L) : null; return Math.max(1, v ? v[0] : (s.childN || 1)); };
/* Hieu ung phu cua chieu 90 khi dat cap 11 (JX1: skill_start/collide/fly/vanishedevent bat co 1 -> ban them chieu con: no lan, tach dan...) */
/* Sat thuong tang 2 = chieu con JX1 bat khi chieu 90 dat cap 11 (Nhan Kiem Hop Nhat: 11 choang, 16 sat thuong).
   So lieu: VLTK 2.0 (slistcl.pak, script ky nang) cho 6 chieu co trong ban cai; 8 chieu con lai chi o may chu -> uoc 35%.
   k: he so x tong sat thuong chieu chinh (truoc khang), el: he cua chieu con, max: so quai trung quanh muc tieu, chance: ti le kich hoat */
const EV2 = {
  302: { n: 'Truy Tinh Trục Điện', k: 0.15, el: 'poison', max: 8 },              // 2.0: chi gay trung doc; skills.txt 301: 8 dan toa tron quanh kim dang bay
  339: { n: 'Ngân Đao Xạ Nguyệt', k: 0.8, el: 'phys', max: 3 },                  // 2.0: 120% vat ly / chieu chinh 150%
  336: { n: 'Băng Tâm Tuyết Liên', k: 0.25, el: 'cold', max: 3 },                // 2.0: = 1 dan bang 45 (chieu chinh 5 dan)
  353: { n: 'Thiên Canh Độc Thủ', k: 0.3, el: 'phys', poison: 0.1, max: 3 },     // 2.0: 183% vat ly + doc / chieu chinh 600%
  362: { n: 'Nghiệp Hỏa Phần Thành', k: 1, el: 'fire', chance: 0.3, max: 3 },     // 2.0: 30% trong kich
  357: { n: 'Long Chiến Vu Dã', k: 1, el: 'fire', max: 2 },                      // 2.0: hoa 70 = chieu chinh
  328: { n: 'Ngọc Tuyền Tẩy Trần', k: 0.35, el: 'phys', max: 3 },
  380: { n: 'Kim Đỉnh Phật Quang', k: 0.35, el: 'cold', max: 4, rays: L => clamp(1 + Math.floor((L - 11) / 3), 1, 4) },   // skills.txt 331: skill_misslenum_v, toi da 4 tia toa tron quanh nguoi: cap 11 = 1 tia, tang dan
  337: { n: 'Phong Tuyết Băng Thiên', k: 0.35, el: 'cold', max: 3 },
  355: { n: 'Tinh Không Phá', k: 0.35, el: 'poison', max: 3 },
  375: { n: 'Bình Địa Hám Lôi', k: 0.35, el: 'light', max: 3 },
  372: { n: 'Khiếu Phong Tam Liên Kích', k: 0.35, el: 'light', max: 3 },
};
// Huyen Nhat Vo Tuong: so lieu that tu ma nguon JX1 (script/skill/wudang/玄一无象.lua): loi sat (4 + 7*cap) ~ (296 + 59*cap)
const XUANYI_TAB = Array.from({ length: 20 }, (_, i) => [4 + 7 * (i + 1), 0, 296 + 59 * (i + 1)]);
for (const id of [163, 215, 368]) EV2[id] = { n: 'Thái Cực Kiếm Ý', k: 0, stun: 30, max: 3, at16: { n: 'Huyền Nhất Vô Tượng', el: 'light', max: 3, tab: { lightingdamage_v: XUANYI_TAB } } };
/* Chieu con co bang so rieng (tab): tinh sat thuong nhu mot chieu that cung cap (cong noi cong / ho tro he cua nhan vat) */
const ev2Sk = (id, d) => d._sk || (d._sk = Object.assign({}, SK[id], { phys: 0, aura: 0, attr: Object.assign({}, d.tab) }));
function ev2Parts(a, d) {
  if (d.tab && typeof R !== 'undefined' && R.P) { const p = activeInfo(R.P, ev2Sk(a.id, d), Math.min(a.L, 20)).parts || {}; return { [d.el]: p[d.el] || 0 }; }
  const parts = {}; if (d.k > 0) parts[d.el] = a.tot * d.k; if (d.poison) parts.poison = (parts.poison || 0) + a.tot * d.poison; return parts;
}
const ev2Of = a => { const d = a && a.ev && EV2[a.id]; return d ? (d.at16 && a.L >= 16 ? (d._16 || (d._16 = Object.assign({}, d, d.at16, { stun: d.stun }))) : d) : null; };
const ev2Exp = a => { const d = ev2Of(a); if (!d) return 0; const t = d.tab ? Object.values(ev2Parts(a, d)).reduce((x, y) => x + y, 0) / Math.max(1, a.tot) : d.k + (d.poison || 0); return t * (d.chance || 1) * Math.min(ev2Max(a, d), 2.2) / expectedHits(a); };
const ev2Max = (a, d) => d.rays ? d.rays(a.L) : d.max;
const SK_EVENTS = ['skill_startevent', 'skill_collideevent', 'skill_flyevent', 'skill_vanishedevent'];
const skEventLv = s => { let m = 0; for (const k of SK_EVENTS) { const a = (s.attr || {})[k]; if (!a) continue; const i = a.findIndex(x => x && x[0] === 1); if (i >= 0) m = m ? Math.min(m, i + 1) : i + 1; } return m; };
const skEvent = (s, L) => { const e = skEventLv(s); return !!e && L >= e; };
function skillTargets(s, L) {
  const n = skMissiles(s, L);
  let t;
  switch (s.form) {
    case 0: t = n > 1 ? 3 : 2; break;
    case 1: t = 2; break;                       // xuyen qua ke dich tren duong thang
    case 2: t = Math.min(3, 1 + Math.ceil(n / 3)); break;
    case 3: case 4: case 5: case 6: case 7: t = 3; break;
    default: t = 1;                             // chem can chien
  }
  return t;
}
/* Thong tin mot chieu tan cong: sat thuong trung binh truoc khang, tam, so muc tieu, hao noi luc */
var ENG_MODE = 2;   // Noi cong tang sat thuong chieu noi cong: x(1 + NC/500)
/* v133: chinh rieng tung chieu (0.5..2) de cac chieu cung bac ngang nhau (sim cap 120, trung vi bac) */
const SK_TRIM = {10: 2.0, 20: 2.0, 11: 1.1, 19: 0.9, 271: 0.6, 318: 1.95, 319: 2.0, 321: 2.0, 29: 1.8, 30: 1.7, 34: 1.75, 31: 2.0, 35: 2.0, 37: 2.0, 40: 1.6, 32: 2.0, 41: 2.0, 324: 1.9, 322: 2.0, 323: 2.0, 325: 2.0, 45: 0.6, 347: 1.6, 303: 2.0, 47: 0.85, 50: 0.75, 54: 0.6, 343: 2.0, 345: 2.0, 349: 2.0, 58: 0.75, 249: 0.5, 341: 0.5, 339: 0.7, 63: 2.0, 65: 1.15, 68: 2.0, 384: 1.9, 71: 1.2, 74: 1.05, 353: 1.75, 355: 2.0, 80: 0.5, 85: 0.55, 82: 0.5, 385: 0.7, 88: 0.55, 91: 0.55, 328: 0.75, 380: 0.5, 99: 1.05, 102: 0.6, 113: 0.55, 108: 1.1, 336: 1.5, 337: 0.7, 119: 0.55, 122: 0.5, 125: 0.5, 128: 0.5, 357: 0.5, 135: 1.35, 145: 2.0, 138: 2.0, 141: 1.45, 142: 1.45, 148: 1.8, 361: 1.85, 362: 2.0, 153: 0.5, 155: 0.65, 158: 0.65, 164: 0.5, 165: 0.5, 267: 0.95, 365: 0.5, 368: 0.5, 169: 0.5, 179: 0.5, 172: 0.7, 176: 0.5, 182: 0.5, 372: 0.7, 375: 0.8};
function activeInfo(P, s, L) {
  // norm (bac ky nang) chi nhan vao he so cua chinh chieu: % vu khi va sat thuong nguyen to goc cua chieu,
  // khong nhan vao chi so nhan vat (vu khi, mon vu khi, Suc manh / Noi cong)
  const norm = 1;                                          // v133 (JX1): bo he so chuan hoa tung chieu
  const pe = skVal(s, 'physicsenhance_p', L);
  const skillPct = (1 + ((P.skillBonus[s.id] || 0) + P.seriesSkill + (P.skillEnh || 0)) / 100) * (P.dmgMul || 1) * (SK_TRIM[s.id] || 1);
  const parts = {};
  if (pe) {
    // physicsenhance_p = % cong them vao sat thuong vu khi (Dat Ma Do Giang cap 20: +615% -> x7.15)
    parts.phys = (P.wmin + P.wmax) / 2 * (1 + (pe[0] + P.physPct) / 100);   // JX1: (vu khi + Suc manh/5) x (1 + % chieu + % trang bi)
    for (const e in P.add) if (P.add[e]) parts[e] = (parts[e] || 0) + P.add[e]; // sat thuong nguyen to cua vu khi di theo don vat ly
  }
  for (const e of ELEM) {
    const v = skVal(s, ELEM_ATTR[e], L); if (!v) continue;
    // doc: [sat thuong moi lan, thoi gian (khung), chu ky (khung)] -> tong = p1 * p2 / p3; con lai: [min, -, max]
    const avg = e === 'poison' ? v[0] * (v[1] || 1) / Math.max(1, v[2] || 1) : v[2] ? (v[0] + v[2]) / 2 : v[0];
    // Can bang game idle: Noi cong tang sat thuong nguyen to cua chieu (ban goc ENGERGY_SET_DAMAGE_VALUE = 0)
    parts[e] = (parts[e] || 0) + avg * (1 + (P.enh[e] || 0) / 100);   // JX1: Noi cong khong tang sat thuong (ENERGY_SET_DAMAGE_VALUE = 0)
  }
  // Can bang game idle: chieu noi cong (khong dung sat thuong vu khi) cong them Noi cong / 4 vao nguyen to chinh,
  // doi xung voi Suc manh / 5 cua don vat ly
  if (!pe && P.magAdd) for (const e of ELEM) if (P.magAdd[e]) parts[e] = (parts[e] || 0) + P.magAdd[e] * (1 + (P.enh[e] || 0) / 100);   // JX1: sat thuong noi cong tu trang bi cong vao chieu noi cong
  if (!pe && ENG_MODE) { const m = 1 + (P.eng || 0) / 500; for (const e in parts) parts[e] *= m; }
  let tot = 0; for (const e in parts) { parts[e] *= skillPct; tot += parts[e]; }
  const rad0 = (skVal(s, 'skill_attackradius', L) || [s.radius || 60])[0] || 60, rad = rad0 * (1 + (P.vision || 0) / 100);
  const targets = skillTargets(s, L), nMis = skMissiles(s, L), ev = skEvent(s, L);
  const cost = (skVal(s, 'skill_cost_v', L) || [0])[0];
  const crit = P.crit + ((skVal(s, 'deadlystrike_p', L) || [0])[0]);
  const series5 = (skVal(s, 'seriesdamage_p', L) || [0])[0];
  const ignore = P.ignoreDef + ((skVal(s, 'ignoredefense_p', L) || [0])[0]);
  const stun = (skVal(s, 'stun_p', L) || [0])[0];
  const rate = s.phys ? P.aspd : P.aspd * 0.9;
  const info = { id: s.id, n: s.n, L, ext: !!pe, parts, tot, rad, melee: rad0 <= 120, targets, nMis, ev, around: s.form === 7, cost, crit, series5, ignore, stun,
    series: s.series >= 0 ? s.series : P.series, rate, dps: 0, useAR: s.phys };
  // DPS du kien: so muc tieu trung thuc te + thoi gian danh cua chieu can chien (khong dung so muc tieu danh nghia)
  // doc: ~25% sat thuong mat khi quai chet truoc khi het doc (POISON_EFF) -> tinh vao DPS du kien (chon chieu, luc chien)
  info.dps = (tot - (parts.poison || 0) * (1 - POISON_EFF) + (parts.phys || 0) * crit / 100 * (CRIT_MULT - 1)) * expectedHits(info) * rate * (info.melee ? MELEE_UPTIME : 1) * extraMul(P);   // chi mang chi nhan doi phan vat ly (giong heroHit)
  info.dps *= 1 + ev2Exp(info);                          // sat thuong tang 2 (chieu con cap 11)
  return info;
}
function basicAttack(P) {
  const phys = (P.wmin + P.wmax) / 2 * (1 + P.physPct / 100) * P.physStat;
  const parts = { phys }; for (const e in P.add) if (P.add[e]) parts[e] = P.add[e];
  let tot = 0; for (const e in parts) { parts[e] *= P.dmgMul || 1; tot += parts[e]; }
  return { id: 0, n: 'Đánh thường', basic: true, ext: true, L: 1, parts, tot, rad: P.ranged ? 320 : [2, 3].includes(weaponCode(S.eq)) ? 100 : 75, melee: !P.ranged,   /* JX1: am khi 320 (skill 2), thuong / con 100 (skill 1), con lai 75 (skill 53) */ targets: 1, cost: 0, crit: P.crit,
    series5: 0, ignore: P.ignoreDef, stun: 0, series: P.series, rate: P.aspd, dps: tot * P.aspd * (P.ranged ? 1 : MELEE_UPTIME) * extraMul(P), useAR: 1 };
}

/* Trong kich (x1.5) va bo qua khang quai (uoc tinh khang quai ~35%): he so DPS du kien */
function extraMul(P) {
  if (!P || !P.anti) return 1;
  const anti = ELEM.reduce((t, e) => t + (P.anti[e] || 0), 0) / ELEM.length;
  return (1 + (P.heavy || 0) / 100 * 0.5) * (1 + Math.min(anti, 35) / 100 * 0.6);
}
/* Noi luc hoi duoc moi giay tu thuoc (Ngung Than dan tot nhat da mo khoa theo cap, uong noi nhau) */
function manaPotRate(lv) {
  let best = 0;
  for (const p of J.potions) if (p.kind === 'mana' && lv >= (POT_TIER_LV[p.tier] || 999)) best = Math.max(best, p.total / Math.max(1, p.dur));
  return best;
}
const W_TIER1 = {};
const weaponDmg = it => (it.base || []).reduce((t, [id, mn, mx]) => t + (id === 28 || id === 29 ? mn : 0), 0) * enhMul(it);
function weaponTierMul(it) {
  if (!it || it.d > 1) return 1;
  const key = it.d + ':' + it.k;
  if (!(key in W_TIER1)) { const b = baseRow(it.d, it.k, 1); W_TIER1[key] = b ? Math.max(1, weaponDmg(b)) : 0; }
  return W_TIER1[key] ? clamp(weaponDmg(it) / W_TIER1[key], 1, 20) : 1;
}
/* Gioi tinh (req 38 = magic_requiresex: 0 nam, 1 nu; thieu hoac < 0 la dung chung): trang phuc nu nam khong mac duoc va nguoc lai */
const sexReqOkFor = (it, sex) => { const r = (it.req || []).find(q => q[0] === 38); return !r || r[1] < 0 || r[1] === (sex || 0); };
const sexReqOk = req => sexReqOkFor({ req }, S.sex);
const sexOk = it => sexReqOk(it.req);
function reqOk(it) {
  if (!sexOk(it)) return false;
  for (const [id, v] of it.req || []) {
    if (id === 36 && eqLevel() < v) return false;
    if (id === 32 && heroAttr('str') < v) return false;
    if (id === 33 && heroAttr('dex') < v) return false;
    if (id === 34 && heroAttr('vit') < v) return false;
    if (id === 35 && heroAttr('eng') < v) return false;
    if (id === 37 && v >= 0 && FAC[S.fac] && heroSeries() !== v) return false;
    if (id === 39 && v >= 0 && FAC[S.fac] && FAC[S.fac].id !== v) return false;   // requiremenpai: do bo cua mon phai
  }
  return true;
}
function heroAttr(k) { const st = heroStart(); return st[k] + S.attr[k]; }
const POWER_DPS_W = 0.7; // game idle: toc do ha quai quyet dinh tien trinh, mau chi can du song
/* Luc chien: DPS thuc te (nhan ti le trung vs quai cung cap) ^0.6 x mau hieu dung (khang, ne) ^0.4 */
function power(P) {
  const L = S.lvl, eDef = 8 + 3.2 * L, eAr = 30 + 9 * L, a = P.main;
  const hit = a.useAR ? hitPercent(P.ar, eDef, a.ignore) / 100 : 1;
  const dodge = 1 - hitPercent(eAr, P.def) / 100;
  const avgRes = ELEM.reduce((t, e) => t + P.res[e], 0) / ELEM.length;
  const dps = a.dps * hit;
  const ehp = P.life / Math.max(0.2, 1 - avgRes / 100) / Math.max(0.3, 1 - dodge) / (1 - (P.block || 0) / 100) / (1 - (P.sorb || 0) / 100) / (1 - Math.min(DMG_SHIELD_MAX, (P.dmgShield || 0) / (S.lvl * 3 + 30)));
  return Math.pow(Math.max(1, dps), POWER_DPS_W) * Math.pow(Math.max(1, ehp), 1 - POWER_DPS_W);
}

/* Can bang phai cho Luc chien hien thi: cung cap, khong do -> cac phai xap xi nhau (bang do: test/_p.js, khong do, tu cong diem, lo trinh 3).
   Luc chien goc (power) van dung noi bo cho tu cong diem; chi so hien thi = goc x (muc chuan cap do / goc phai khong do cung cap). */
const POWER_LV = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190],
  POWER_TGT = [130, 376, 626, 871, 1195, 1711, 3433, 5432, 7235, 8289, 9807, 11292, 12029, 13018, 14077, 14729, 15396, 16159, 16944],
  POWER_RAW = {"shaolin": [154, 784, 1818, 2712, 5702, 6290, 14570, 23764, 23764, 23764, 31597, 31597, 31597, 31597, 31597, 31597, 31597, 33572, 36006], "tianwang": [90, 228, 391, 437, 660, 1629, 2173, 9779, 12925, 14152, 19354, 19354, 19354, 19354, 19354, 19354, 19354, 19354, 19354], "tangmen": [70, 199, 319, 485, 813, 1495, 2441, 4090, 5843, 5843, 8287, 8287, 8287, 8287, 8287, 8287, 8287, 8287, 8287], "wudu": [218, 435, 764, 1205, 2044, 2908, 6005, 7994, 10692, 11886, 13644, 13644, 13644, 13644, 13644, 13644, 13644, 13644, 13644], "emei": [158, 402, 849, 1264, 1264, 2463, 4088, 6111, 7858, 9133, 9533, 15965, 18928, 22639, 27123, 28713, 30303, 31892, 33482], "cuiyan": [151, 455, 561, 1047, 1047, 1047, 2000, 2420, 4181, 4181, 4181, 6880, 8747, 12058, 16897, 18495, 20160, 21892, 23689], "gaibang": [153, 320, 630, 630, 630, 630, 1636, 2909, 5527, 6875, 8848, 8848, 8848, 8982, 8982, 9660, 10471, 11312, 12183], "tianren": [108, 447, 447, 580, 748, 1103, 2117, 2802, 2977, 3715, 4402, 4402, 4471, 4905, 5436, 5969, 6525, 7102, 7701], "wudang": [139, 360, 870, 1310, 1470, 2592, 5363, 6851, 8426, 9304, 10609, 14616, 15507, 16544, 17749, 18662, 19574, 20485, 21397], "kunlun": [121, 384, 458, 576, 1038, 1038, 3227, 3566, 4499, 7228, 7228, 7799, 9034, 10161, 11123, 12163, 13248, 14377, 15549]};
function powerShown(raw) {
  const b = FAC[S.fac] && POWER_RAW[S.fac]; if (!b) return raw;
  const L = Math.max(POWER_LV[0], Math.min(POWER_LV[POWER_LV.length - 1], S.lvl | 0));
  let i = 0; while (i < POWER_LV.length - 2 && L > POWER_LV[i + 1]) i++;
  const t = (L - POWER_LV[i]) / (POWER_LV[i + 1] - POWER_LV[i]), lg = (a, j) => Math.log(a[j]) * (1 - t) + Math.log(a[j + 1]) * t;
  return raw * Math.exp(lg(POWER_TGT, i) - lg(b, i));
}

/* ---------- Tu cong diem: moi lan dat mot "goi" diem vao lua chon lam tang luc chien nhieu nhat TINH TREN MOI DIEM ----------
   Nhin xa 1 / 5 / toi da diem: chieu moi cap 1 thuong yeu hon +1 cap chieu cu, nhung 20 cap thi manh hon han
   (tham lam tung diem mot se ket o chieu cu, vd Thien Vuong cap 120 khong bao gio hoc Truy Phong Quyet). */
function autoSpendSkills() {
  const f = FAC[S.fac]; if (!f) return 0;
  const ba = R.buffAssume; R.buffAssume = true;
  R.ignoreEqt = null;   // cham chieu theo vu khi dang cam (giu nhanh vu khi hien tai, khong cong diem vao chieu cua vu khi khong dung)
  try { return autoSpendSkills0(f); } finally { R.buffAssume = ba; R.ignoreEqt = null; R.dirty = true; }
}
const SK_PROJ = 10;
/* Cam bay Duong Mon (Dia Diem Hoa, Doc Thich Cot, Xuyen Tam Thich, Han Bang Thich, Loi Kich Thuat, Loan Hoan Kich): JX1 dat bay duoi dat cho quai
   giam phai. Game idle khong co dat bay -> truoc day tinh nhu chieu can chien ban kinh 50, tu chon lam chieu chinh va tu cong diem -> Duong Mon
   bo am khi, cong Suc manh, len cap cham nhat. Nay khong tu chon / tu cong diem (nguoi choi van hoc va khoa dung duoc). */
const isTrapSk = s => !!s && /bẫy/i.test(s.d || '');
function autoSpendSkills0(f) {
  let spent = 0;
  while (S.skPts > 0) {
    const base = power(calc()); let best = null, bn = 0, bg = -Infinity;
    for (const id of f.skills) {
      const s = SK[id]; if (!canLearn(s) || isTrapSk(s)) continue;
      // goi diem tinh ca diem cua cac cap sau (khong gioi han boi diem dang co): dan diem dan vao chieu moi cho toi khi no vuot chieu cu
      // chieu tan cong moi mo: xet gia tri o cap se dat trong SK_PROJ cap toi (gioi han cap theo cap nhan vat lam chieu moi luon yeu hon chieu cu da max
      // luc vua mo -> cach cu khong bao gio dau tu, nhan vat ket voi chieu nhap mon). Diem thuc cong van khong vuot skCap.
      const cur = S.sk[id] || 0, cap = isAttack(s) && s.tier !== 90 ? Math.max(skCap(s), Math.min(s.max, eqLevel() + SK_PROJ - s.req + 1)) : skCap(s), room = Math.max(1, Math.min(20, cap - cur));
      for (const n of [...new Set([1, Math.min(5, room), room])]) {
        S.sk[id] = cur + n;
        const g = (power(calc()) - base) / n + (isAttack(s) ? 0 : 1e-6) + s.req * 1e-9; // hoa: uu tien noi tai, roi chieu cap cao
        if (cur) S.sk[id] = cur; else delete S.sk[id];
        if (g > bg) { bg = g; best = id; bn = n; }
      }
    }
    if (best == null) break;
    bn = Math.min(bn, S.skPts);
    if (typeof bookUse === 'function' && !R.sim) bookUse(best);
    bn = Math.min(bn, skCap(SK[best]) - (S.sk[best] || 0));
    if (SK[best].tier === 90) { skLearn(best); if (!sk9Free(SK[best])) spent++; continue; }
    S.sk[best] = (S.sk[best] || 0) + bn; S.skPts -= bn; spent += bn;
  }
  if (spent) R.dirty = true;
  return spent;
}
/* Vu khi dung loai cua phai tot nhat dang co (tui / tay), du cap nhung co the chua du Suc manh / Than phap.
   Vu khi JX doi 2 chi so (vd thuong Thien Vuong: Suc manh 99 + Than phap 99): tu cong diem mot chi so se khong bao gio cam duoc
   vu khi bac cao -> cac phai nay bi ket voi vu khi bac 1 khi choi dai (docs/DANH_GIA.md). */
const ATTR_REQ = { 32: 'str', 33: 'dex', 34: 'vit', 35: 'eng' };
const REQ_SAVE_LEVELS = 10; // chi dan diem cho vu khi thieu khong qua 10 cap diem
function weaponTarget() {
  const f = FAC[S.fac]; if (!f) return null;
  const own = S.inv.concat(S.eq.weapon ? [S.eq.weapon] : []).filter(it => it.d <= 1 && weaponFits(it)
    && (it.req || []).every(([id, v]) => id !== 36 || eqLevel() >= v) && !(it.req || []).some(([id, v]) => (id === 37 || id === 39) && v >= 0 && !reqOk(it)));
  return own.sort((a, b) => weaponDmg(b) - weaponDmg(a))[0] || null;
}
/* Ly do cu the vi sao chua mac duoc mon do (hien trong chi tiet, thong bao, bang so sanh) */
const REQ_VI = { 32: 'Sức mạnh', 33: 'Thân pháp', 34: 'Sinh khí', 35: 'Nội công' };
function reqProblems(it) {
  const out = [];
  for (const [id, v] of it.req || []) {
    if (id === 36 && eqLevel() < v) out.push(`Cấp ${v} (hiện ${eqLevel()}, thiếu ${v - eqLevel()})`);
    else if (REQ_VI[id] && heroAttr(ATTR_REQ[id]) < v) { const cur = heroAttr(ATTR_REQ[id]); out.push(`${REQ_VI[id]} ${v} (hiện ${cur}, thiếu ${v - cur})`); }
    else if (id === 38 && v >= 0 && (S.sex || 0) !== v) out.push(`Chỉ dành cho ${v ? 'nữ' : 'nam'} (nhân vật của bạn là ${S.sex ? 'nữ' : 'nam'})`);
    else if (id === 37 && v >= 0 && FAC[S.fac] && heroSeries() !== v) out.push(`Chỉ hệ ${SERIES[v]} (bạn hệ ${SERIES[heroSeries()]})`);
    else if (id === 39 && v >= 0 && FAC[S.fac] && FAC[S.fac].id !== v) out.push(`Chỉ môn phái ${(J.factions[v] || {}).n || v}`);
  }
  return out;
}
/* So voi mon dang mac cung o: thay doi suc manh tong, DPS chieu chinh, sinh luc, ne tranh, khang trung binh. ignoreReq: tinh nhu da du dieu kien */
function equipCompare(it, ignoreReq) {
  const eq = Object.assign({}, S.eq); eq[slotFor(it)] = it;
  const p0 = calc(S.eq), prev = IGNORE_REQ; IGNORE_REQ = ignoreReq ? it : null; let p1; try { p1 = calc(eq); } finally { IGNORE_REQ = prev; }
  const pw0 = power(p0), pw1 = power(p1), avg = P => ELEM.reduce((t, e) => t + P.res[e], 0) / ELEM.length;
  const why = compareWhy(it, eq, p0, p1);
  return { why, gain: pw1 / Math.max(1, pw0) - 1, dps: p1.main.dps / Math.max(1, p0.main.dps) - 1, life: p1.life - p0.life, def: p1.def - p0.def, res: avg(p1) - avg(p0), ar: p1.ar - p0.ar };
}
/* Ly do cu the vi sao suc manh doi khi thay mon: dong an cua cac mon khac mo / dong (tuong sinh), do bo, chieu chinh, sat thuong vu khi */
function compareWhy(it, eq1, p0, p1) {
  const eq0 = S.eq, slot = slotFor(it), out = [], old = eq0[slot];
  for (const k in eq0) {
    const o = eq0[k]; if (!o || k === slot || (o.mag || []).length < 2) continue;
    const h0 = hiddenActive(o, eq0), h1 = hiddenActive(o, eq1), tot = Math.floor(o.mag.length / 2);
    if (h1 !== h0) out.push(`${SLOT_VI[k]} ${h1 > h0 ? 'mở thêm' : 'đóng bớt'} ${Math.abs(h1 - h0)} dòng ẩn (${h1}/${tot}) do tương sinh hệ ${SERIES[it.s] || '—'}`);
  }
  if ((it.mag || []).length > 1 && it.d !== 10) { const h = hiddenActive(it, eq1), tot = Math.floor(it.mag.length / 2), ho = old && (old.mag || []).length > 1 ? hiddenActive(old, eq0) : null;
    out.push(`Món này mở ${h}/${tot} dòng ẩn${ho !== null ? `, món đang mặc mở ${ho}/${Math.floor(old.mag.length / 2)}` : ''}`); }
  if (enoughToActive(eq1) !== enoughToActive(eq0)) out.push(enoughToActive(eq1) ? 'Đủ bộ: mở hết dòng ẩn của mọi trang bị' : 'Mất đủ bộ: các dòng ẩn bị đóng lại');
  if (p0.main.id !== p1.main.id) out.push(`Chiêu chính đổi: ${p0.main.n} → ${p1.main.n}`);
  if (slot === 'weapon') out.push(`Sát thương vũ khí ${Math.round(p0.wmin)}–${Math.round(p0.wmax)} → ${Math.round(p1.wmin)}–${Math.round(p1.wmax)}`);
  if (!out.length) out.push('Chỉ thay đổi chỉ số thường (phòng thủ, sinh lực, kháng), không đụng tới dòng ẩn hay bộ.');
  return out;
}
const pctTxt = v => (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%', numTxt = v => (v >= 0 ? '+' : '') + Math.round(v);
function reqDeficit(it) {
  const d = {}; for (const [id, v] of it.req || []) { const k = ATTR_REQ[id]; if (k && heroAttr(k) < v) d[k] = v - heroAttr(k); }
  return d;
}
/* Diem tiem nang con thieu de du yeu cau Suc manh / Than phap / Sinh khi / Noi cong cua do DANG MAC (vd sau chuyen sinh diem bi tay,
   bo do van mac nhung mat tac dung). Xet tung mon theo cap yeu cau tang dan (mon dung duoc som nhat duoc du truoc).
   -> [{ it, d: {str: n...} }] (d = so diem can them, da tinh phan cac mon truoc da cong) */
function gearReqPlan(pts = S.attrPts) {
  const lvReq = it => ((it.req || []).find(q => q[0] === 36) || [0, 0])[1];
  const items = Object.values(S.eq).filter(it => it && (it.req || []).some(([id]) => ATTR_REQ[id])).sort((a, b) => lvReq(a) - lvReq(b));
  const add = { str: 0, dex: 0, vit: 0, eng: 0 }, out = [];
  for (const it of items) {
    const d = {}; let n = 0;
    for (const [id, v] of it.req) { const k = ATTR_REQ[id]; if (!k) continue; const miss = v - (heroAttr(k) + add[k]); if (miss > 0) { d[k] = Math.max(d[k] || 0, miss); } }
    for (const k in d) { add[k] += d[k]; n += d[k]; }
    if (n) out.push({ it, d, n, lv: lvReq(it) });
  }
  return { list: out, total: Object.values(add).reduce((a, b) => a + b, 0), add };
}
/* Cong diem cho du yeu cau do dang mac truoc (theo thu tu tren), con thieu thi de danh cho cap sau */
function fillGearReq() {
  let spent = 0;
  for (const { d } of gearReqPlan().list) for (const k in d) { const n = Math.min(d[k], S.attrPts); if (n > 0) { S.attr[k] += n; S.attrPts -= n; spent += n; } }
  if (spent) R.dirty = true;
  return spent;
}
function autoSpendAttrs() {
  let spent = fillGearReq();
  const wt = weaponTarget();
  if (wt) {
    const d = reqDeficit(wt), need = Object.values(d).reduce((a, b) => a + b, 0);
    if (need > 0 && need <= S.attrPts + PTS_PER_LEVEL * REQ_SAVE_LEVELS)
      for (const k in d) { const n = Math.min(d[k], S.attrPts); S.attr[k] += n; S.attrPts -= n; spent += n; }
    if (wt !== S.eq.weapon && reqOk(wt) && typeof equip === 'function' && equipGain(wt) > 0) equip(wt, true);
  }
  while (S.attrPts > 0) {
    const base = power(calc()); let best = 'vit', bg = -Infinity;
    for (const k of ['str', 'dex', 'vit', 'eng']) { S.attr[k]++; const g = power(calc()) - base; S.attr[k]--; if (g > bg) { bg = g; best = k; } }
    S.attr[best]++; S.attrPts--; spent++;
  }
  if (spent) R.dirty = true;
  return spent;
}
/* Vo cong 90 tan cong / noi tai (khong phai nhanh ho tro): Mat Tich day thang cap 1, khong ton diem ky nang (nhu JX1), sau do luyen */
const sk9Free = s => !!s && s.tier === 90 && !(typeof isBr90 === 'function' && isBr90(s.id));
function canLearn(s) { return (S.skPts > 0 || (sk9Free(s) && !(S.sk[s.id] || 0))) && S.lvl >= s.req && (S.sk[s.id] || 0) < skCap(s) && (typeof bookOk !== 'function' || bookOk(s)); }
/* Gioi han cap ky nang theo cap nhan vat (nhu JX1): cap toi da = cap nhan vat - cap yeu cau + 1 (chuyen sinh: tinh cap hieu luc). Vo cong 90: chi cong 1 diem de hoc, len cap bang luyen (vocong.js) */
function skCap(s) { if (typeof isBr90 === 'function' && isBr90(s.id)) return sk9BranchCap(s.id); if (s.tier === 90) return 1; return Math.max(0, Math.min(s.max, eqLevel() - s.req + 1)); }

/* ---------- Can bang ky nang theo bac (rieng game idle) ----------
   Du lieu goc: chieu cung cap yeu cau chenh nhau 5-8 lan (Phieu Tuyet Xuyen Van bang ~345 o cap 20, No Loi Chi loi ~40,
   Kim Cang Phuc Ma +55% vu khi). JX bu bang vai tro PK/to doi ma game idle khong co. Moi chieu tan cong duoc nhan he so
   norm = trung vi sat thuong tham chieu cua bac / sat thuong tham chieu cua chieu (gioi han 0.35..3). Sat thuong tham chieu =
   mot don x so muc tieu trung thuc te (expectedHits) x toc do x thoi gian danh (can chien 82%), tinh voi mot nhan vat
   tham chieu (vu khi + mon vu khi cap 20 CUA CHINH PHAI DO + chi so tuong ung cap yeu cau), o cap ky nang 20, nhan so muc tieu. */
const NORM_TIERS = [[1, 19], [20, 39], [40, 59], [60, 79], [80, 999]];
/* Do tu mo phong (tools: 20 phut x 10 phai): so muc tieu trung thuc te moi lan danh va thoi gian danh cua chieu can chien */
const MELEE_UPTIME = 0.82;
function expectedHits(a) { const n = Math.min(4, a.targets); return a.around ? 1 + (n - 1) * 0.12 : 1 + (n - 1) * 0.55; }
function masteryPct(f) { // mon vu khi dung loai vu khi cua phai, cap 20
  let best = 0;
  for (const id of f.skills) { const s = SK[id]; const a = s && !s.enemy && s.attr.addphysicsdamage_p; if (!a) continue;
    const v = a[19] || a[a.length - 1]; if (Array.isArray(v) && v[2] === f.wcode) best = Math.max(best, v[0]); }
  return best;
}
/* Nhan vat tham chieu co CUNG MOT quy diem (60 + cap yeu cau) chia giua Suc manh va Noi cong theo ti le k */
function refChar(req, f, k) {
  const w = 10 + req * 0.8, st = 60 + req;
  return { wmin: w, wmax: w * 1.3, physPct: masteryPct(f), physStat: 1 + st * k * (f.wcode === 7 ? DEX_PCT_RANGED : 1) / STR_PER_PCT / 100, add: {}, enh: {}, eng: st * (1 - k),
    seriesSkill: 0, skillBonus: {}, crit: 0, aspd: 1, ignoreDef: 0, series: 0, spellW: 1 };
}
// ti le trung trung binh cua chieu dung chinh xac (do tu mo phong): can chien / lai ~75%, am khi (Than phap cao) ~90%;
// chieu noi cong luon trung. Doc gay sat thuong trong 3 giay -> mat ~25% khi quai chet truoc khi het doc.
const REF_HIT = 0.75, REF_HIT_RANGED = 0.9, POISON_EFF = 0.75;
function refDps(s) {
  let best = 0;
  for (const k of [0, 1]) { // dau tu mot chi so (Suc manh hoac Noi cong) nhu bo tu cong diem va phan lon nguoi choi
    const a = activeInfo(refChar(Math.max(10, s.req), s.fac, k), s, 20);
    const eff = a.tot - (a.parts.poison || 0) * (1 - POISON_EFF);
    const hit = a.useAR ? (s.fac.wcode === 7 ? REF_HIT_RANGED : REF_HIT) : 1;
    best = Math.max(best, eff * expectedHits(a) * a.rate * (a.melee ? MELEE_UPTIME : 1) * hit);
  }
  return best;
}
function initSkillNorm() {
  const atk = [];
  for (const f of FACTIONS) for (const id of f.skills) { const s = SK[id]; if (isAttack(s)) { s.fac = f; atk.push(s); } }
  for (const [lo, hi] of NORM_TIERS) {
    const tier = atk.filter(s => s.req >= lo && s.req <= hi);
    const ref = tier.map(s => { s.norm = 1; return [s, refDps(s)]; });
    const vals = ref.map(r => r[1]).sort((a, b) => a - b), med = vals[Math.floor(vals.length / 2)] || 1;
    for (const [s, v] of ref) s.norm = clamp(med / Math.max(1, v), 0.35, 3);
  }
}
initSkillNorm();

/* ---------- Can bang theo phai va cap (rieng game idle) ----------
   Sau khi can bac ky nang van con lech do noi tai tung phai (vd Thieu Lam cap 150 manh ~10 lan Thuy Yen): mo phong nhan vat
   len cap 1 -> 150 bang dung bo tu cong diem, do DPS thuc te (nhan ti le trung) tai cac moc cap, he so = trung vi / phai
   (gioi han 0.1..3.5), noi suy tuyen tinh giua cac moc. Tao lai: tests/run_tests.py balance (in bang moi khi lech).
   v68: chinh lai theo TOC DO HA QUAI thuc te (test/balseed.js, kpm moi moc cap) + tien trinh 3 gio tu cap 1 (test/balprog.js): moi phai trong +-5%,
   trung binh nhan he so = 1 o moi moc cap -> toc do chung / suc quai giu nguyen. */
const FN_LV = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 135, 150, 175, 200];
/* v133: he so sat thuong chung (game treo) - giu ti le JX1 giua cac phai / chieu */
const HERO_DMG_K = 6;
const FAC_DMG_NORM = {
  shaolin: [0.99, 1.3, 1.23, 0.89, 1.5, 0.79, 1.1, 1.98, 1.34, 1.15, 1.17, 0.82, 0.66, 0.48, 0.37, 0.31],
  tianwang: [1.06, 1.32, 1.82, 1.8, 1.47, 2.15, 2.27, 5.73, 5.09, 5.05, 6.63, 2.85, 2.65, 2.01, 1.6, 0.62],
  tangmen: [0.66, 1.39, 1.91, 1.71, 2.15, 3.39, 1.79, 1.44, 1.59, 1.12, 2.21, 0.74, 0.53, 0.41, 0.76, 1.43],
  wudu: [1.5, 1.19, 1.99, 1.47, 1.65, 1.77, 1.7, 1.47, 1.96, 1.82, 1.93, 0.99, 0.31, 0.18, 0.17, 0.72],
  emei: [0.54, 0.36, 0.31, 0.38, 0.2, 0.27, 0.27, 0.26, 0.33, 0.25, 0.21, 0.5, 0.54, 0.84, 0.69, 1.2],
  cuiyan: [1.25, 1.49, 1.38, 2.02, 0.97, 1.09, 1.41, 1.45, 2.04, 1.53, 1.35, 2.82, 3.46, 7.14, 6.41, 8],
  gaibang: [1.48, 1.36, 1.81, 1.94, 0.5, 0.72, 1.04, 1.62, 3.54, 3.34, 3.42, 2.69, 2.52, 2.02, 2.35, 5.63],
  tianren: [0.74, 1.57, 2.02, 1.66, 1.37, 1.3, 1.23, 1.45, 1.34, 1.57, 1.59, 1.16, 1.29, 1.22, 1.12, 0.59],
  wudang: [0.63, 0.47, 0.17, 0.23, 0.18, 0.21, 0.33, 0.32, 0.27, 0.15, 0.15, 0.25, 0.25, 0.25, 0.25, 0.12],
  kunlun: [1.69, 1.29, 0.94, 1.09, 1.68, 1.45, 2.53, 1.58, 1.73, 1.59, 1.69, 3.06, 3.27, 2.99, 2.83, 1.17],
};
function facNorm(key, L) {
  const t = FAC_DMG_NORM[key]; if (!t || window.NO_FAC_NORM) return 1;
  if (L <= FN_LV[0]) return t[0];
  for (let i = 1; i < FN_LV.length; i++) if (L <= FN_LV[i]) { const k = (L - FN_LV[i - 1]) / (FN_LV[i] - FN_LV[i - 1]); return t[i - 1] + (t[i] - t[i - 1]) * k; }
  return t[t.length - 1];
}
