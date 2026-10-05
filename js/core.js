/* ======================= LOI: tien ich, hang so, chi muc du lieu ======================= */
'use strict';
const J = window.JX, W = window.JW;
const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => { n = Math.round(n); const a = Math.abs(n); return a < 1e4 ? '' + n : a < 1e6 ? (n / 1e3).toFixed(a < 1e5 ? 1 : 0) + 'k' : a < 1e9 ? (n / 1e6).toFixed(2) + 'M' : (n / 1e9).toFixed(2) + 'B'; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function wpick(list, w) { let t = 0; for (const x of list) t += w(x); let r = Math.random() * t; for (const x of list) { r -= w(x); if (r <= 0) return x; } return list[list.length - 1]; }

/* ---------- ngu hanh: 0 Kim, 1 Moc, 2 Thuy, 3 Hoa, 4 Tho ---------- */
const SERIES = J.series;
const SERIES_COL = ['#f3d35b', '#6fd46a', '#5fb8ff', '#ff6a3a', '#c8965a'];
const KHAC = { 0: 1, 1: 4, 4: 2, 2: 3, 3: 0 }; // Kim khac Moc, Moc khac Tho, Tho khac Thuy, Thuy khac Hoa, Hoa khac Kim
const counters = (a, t) => a >= 0 && t >= 0 && KHAC[a] === t;
/* nguyen to sat thuong: vat ly, doc, bang, hoa, loi (thu tu rmax trong world.js) */
const ELEM = ['phys', 'poison', 'cold', 'fire', 'light'];
const ELEM_VI = { phys: 'Vật lý', poison: 'Độc', cold: 'Băng', fire: 'Hỏa', light: 'Lôi' };
const ELEM_COL = { phys: '#f0e6d0', poison: '#8fe34a', cold: '#7fd0ff', fire: '#ff7a2a', light: '#d9b6ff' };
const ELEM_ATTR = { phys: 'physicsdamage_v', poison: 'poisondamage_v', cold: 'colddamage_v', fire: 'firedamage_v', light: 'lightingdamage_v' };
const ELEM_ADD = { phys: 'addphysicsdamage_v', poison: 'addpoisondamage_v', cold: 'addcolddamage_v', fire: 'addfiredamage_v', light: 'addlightingdamage_v' };
const ELEM_RES = { phys: 'physicsres_p', poison: 'poisonres_p', cold: 'coldres_p', fire: 'fireres_p', light: 'lightingres_p' };
const ELEM_ENH = { poison: 'poisonenhance_p', cold: 'coldenhance_p', fire: 'fireenhance_p', light: 'lightingenhance_p' };

/* ---------- hang so cong thuc (docs/CONG_THUC.md) ---------- */
const MAX_RESIST = 95, PLAYER_RES_MAX = 75, MAX_HIT = 95, MIN_HIT = 40, CRIT_MULT = 2;
const STR_PER_DMG = 5, DEX_PER_DMG = 5, ENG_PER_DMG = 4;
/* Can bang rieng game idle (ban goc khong co): 1 Noi cong = +1% sat thuong nguyen to cua chieu, 1 Suc manh (Than phap voi am khi) = +1% sat thuong vat ly */
const ENG_PER_PCT = 1, STR_PER_PCT = 1, DEX_PCT_RANGED = 1, IDLE_LIFE_PER_LEVEL = 8; // +8 sinh luc moi cap cho moi he (quai danh lien tuc theo dot)
const PTS_PER_LEVEL = 5, SKILL_PTS_PER_LEVEL = 1, MAX_LEVEL = Math.min(200, J.exp.length);   // cap tuyet doi 200 (quai, bang kinh nghiem)
const BASE_CAP = 200;                                      // len toi cap 200 moi chuyen sinh duoc (truoc day: 99, chuyen sinh moi mo 200)
const levelCap = () => MAX_LEVEL;
/* So lan chuyen sinh; cap tinh khi mac trang bi: moi lan chuyen sinh +200 (vd cap 10 chuyen sinh 1 = cap 210) -> bo qua yeu cau cap cua do */
const rebornN = () => (typeof S !== 'undefined' && S && S.rw && S.rw.stat ? S.rw.stat.reborn || 0 : 0);
const REB_EQ_LV = 200;
const eqLevel = () => S.lvl + REB_EQ_LV * rebornN();

/* ---------- thuoc tinh ma thuat ---------- */
const ATTR_ID = Object.fromEntries(J.attr.map((n, i) => [n, i]));
/* Bang ten thuoc tinh cua ban giai nen bi lech o 5 dong ngu hanh: chi so 168-172 trong MagicAttrib (dong an vu khi theo he va do Hoang Kim)
   that ra la SAT THUONG NOI CONG theo he (JX1: Kim "Sat thuong vat ly - noi cong", Moc "Doc sat - noi cong", Thuy "Bang sat - noi cong",
   Hoa "Hoa sat - noi cong", Tho "Loi sat - noi cong"), khong phai "Ky nang he X +N cap". Bang chung: mo ta goc cua dong ("Tang sat thuong he ...")
   + he cua dong, gia tri 1-200 (doc 1-50 / lan), Hoang Kim Nga Mi / Thuy Yen co "bang sat noi cong" 700-800. */
const ATTR_SER_DMG = { metalskill_v: 'addphysicsmagic_v', earthskill_v: 'addpoisonmagic_v', woodskill_v: 'addcoldmagic_v', waterskill_v: 'addfiremagic_v', fireskill_v: 'addlightingmagic_v' };
const attrReal = n => ATTR_SER_DMG[n] || n;
function attrText(name, p) {
  name = attrReal(name);
  const t = J.attrDesc[name];
  if (!t) return name + ': ' + p.filter(v => v).join(' / ');
  return t.replace(/#([a-zA-Z])([123A])([-+~%]?)/g, (m, k, i, flag) => {
    const v = i === 'A' ? Math.floor((p[0] || 0) / 256) : (p[+i - 1] || 0);
    if (k === 'l') return J.skills[v] ? J.skills[v].n : '#' + v;   // #l3 = ten ky nang (tham so 3 la id ky nang)
    return (flag === '+' && v > 0 ? '+' : '') + v;
  }).replace(/#[a-zA-Z][123A][-+~]?/g, '')
    .replace(/Kỹ năng (\d+)/, (m, id) => (J.skills[id] ? 'Kỹ năng ' + J.skills[id].n : m));   // dong +cap ky nang: hien ten
}

/* ---------- mon phai, ky nang, quai ---------- */
const FACTIONS = J.factions.filter(f => f.skills && f.skills.length);
const FAC = Object.fromEntries(FACTIONS.map(f => [f.key, f]));
/* Vo Mon Phai (cap 1-9, kieu JX1): moi he mot "phai" gia, chua co vo cong; cap 10 gia nhap phai cung he */
const NOVICE_LV = 10;
for (let s = 0; s < 5; s++) FAC['vo' + s] = { key: 'vo' + s, n: 'Vô Môn Phái', series: s, skills: [], wcode: -1, id: -1, novice: true };
const isNovice = () => !!(S && FAC[S.fac] && FAC[S.fac].novice);
/* Gioi han gioi tinh nhu JX1: Thieu Lam chi nam; Nga My, Thuy Yen chi nu */
const FAC_SEX = { shaolin: 0, emei: 1, cuiyan: 1 };
const facAllowed = (f, sex) => !(f.key in FAC_SEX) || FAC_SEX[f.key] === (sex || 0);
/* Hinh mon phai cu (khi tat nhan vat JX1 / dang tai hinh): Vo Mon Phai dung hinh mot phai cung he, cung gioi tinh neu co */
function heroGfx(fac = S && S.fac, sex = S && S.sex) {
  if (W.hero[fac]) return W.hero[fac];
  const f = FAC[fac]; if (!f) return null;
  const same = FACTIONS.filter(x => x.series === f.series), pickF = same.find(x => facAllowed(x, sex) && (x.key in FAC_SEX)) || same.find(x => facAllowed(x, sex)) || same[0];
  return sex && !same.some(x => FAC_SEX[x.key] === 1) ? W.hero.emei : W.hero[pickF.key];
}
const SK = J.skills;
/* Game idle: chieu tan cong dau tien cua moi phai hoc duoc tu cap 1 (ban goc: cap 10, truoc do chi danh thuong) */
for (const f of FACTIONS) {
  const first = f.skills.map(id => SK[id]).filter(s => s && s.enemy && ['physicsenhance_p', 'physicsdamage_v', 'poisondamage_v', 'colddamage_v', 'firedamage_v', 'lightingdamage_v'].some(a => s.attr[a])).sort((a, b) => a.req - b.req || a.id - b.id);
  if (first.length) { first[0].req = 1; f.starter = first[0].id; }
  // loai vu khi cua phai = tham so 3 cua mon vu khi (addphysicsdamage_p) co cap yeu cau thap nhat
  const mastery = f.skills.map(id => SK[id]).filter(s => s && !s.enemy && s.attr.addphysicsdamage_p).sort((a, b) => a.req - b.req || a.id - b.id)[0];
  const a = mastery && mastery.attr.addphysicsdamage_p[0];
  f.wcode = Array.isArray(a) && [0, 1, 2, 3, 4, 5, 7, 9].includes(a[2]) ? a[2] : -1;
}
/* ---------- Gioi han vu khi cua chieu (JX1 skills.txt EqtLimit, KSkills.cpp CanCast) ----------
   -2 khong han che, -1 tay khong (quyen thu), 0 kiem, 1 dao, 2 con, 3 thuong, 4 song chuy, 5 song dao, 100 phi tieu, 101 phi dao, 102 tu tien */
if (SK[384]) SK[384].eqt = -2;                                   // Bach Doc Xuyen Tam: skills.txt goc -2 (du lieu cu ghi 1)
const EQT_VI = { '-1': 'Tay không', 0: 'Kiếm', 1: 'Đao', 2: 'Côn', 3: 'Thương', 4: 'Song Chùy', 5: 'Song Đao', 100: 'Phi Tiêu', 101: 'Phi Đao', 102: 'Tụ Tiễn' };
const itEqt = it => !it ? -1 : it.d === 1 ? 100 + it.k : it.k === 6 ? -1 : it.k;
const curEqt = () => itEqt(S.eq && S.eq.weapon);
const skEqt = s => (s && s.eqt != null && s.eqt !== -2 && s.attr && s.attr.physicsenhance_p ? s.eqt : null);   // chi gioi han chieu ngoai cong (dung sat thuong vu khi); chieu noi cong cam vu khi nao cung chuong duoc
const skWOk = (s, e = curEqt()) => skEqt(s) === null || skEqt(s) === e;
/* vu khi can cho chieu chinh (chon tay hoac chieu manh nhat): null = khong han che -> theo loai vu khi cua phai */
function wantEqt() {
  const id = S.mainLock && S.main && S.main !== 'basic' ? S.main : (typeof R !== 'undefined' && R.P && R.P.wantId);
  return skEqt(SK[id]);
}
function weaponFits(it) {
  const e = wantEqt(); if (e !== null) return itEqt(it) === e;
  const f = FAC[S.fac]; return !f || f.wcode < 0 || weaponCode({ weapon: it }) === f.wcode;
}
/* vu khi tang khi vao phai: theo chieu nhap mon (vd Thien Vuong Tram Long quyet can Song Chuy) */
function facWeaponDP(f) {
  const e = skEqt(SK[f.starter]); if (e !== null) return e === -1 ? [0, 6] : e >= 100 ? [1, e - 100] : [0, e];
  const wc = f.wcode >= 0 ? f.wcode : 0; return wc === 7 ? [1, 0] : [0, wc === 9 ? 6 : wc];
}
/* [detail, part] cua vu khi hop chieu chinh / phai (roi do, che tao, qua tang) */
function wantWeaponDP() {
  const e = wantEqt(); if (e !== null) return e === -1 ? [0, 6] : e >= 100 ? [1, e - 100] : [0, e];
  const f = FAC[S.fac], wc = f && f.wcode >= 0 ? f.wcode : 0; return wc === 7 ? [1, irnd(0, 2)] : [0, wc === 9 ? 6 : wc];
}
/* Bang ky nang chi co 20 (30) cap. Cap vuot bang (+cap ky nang tu trang bi / ky nang da 20/20) truoc day bi cat mat -> trang bi
   "+N cap ky nang" khong co tac dung. Nay ngoai suy tuyen tinh theo buoc cuoi (toi da +10 cap), tru cac thong so ky thuat
   (tam danh, hao noi luc, so dan...) giu nguyen cap cuoi. */
const SKV_FIXED = /^(skill_|missle_)/, SKV_EXTRA_MAX = 10;
const skVal = (s, attr, L) => {
  const a = s.attr[attr]; if (!a) return null;
  const n = a.length, last = a[n - 1], arr = x => (Array.isArray(x) ? x : [x, 0, 0]);
  if (L <= n || n < 2 || SKV_FIXED.test(attr)) return arr(a[clamp(L, 1, n) - 1]);
  const k = Math.min(SKV_EXTRA_MAX, L - n), p = arr(a[n - 2]), q = arr(last);
  return q.map((v, i) => (i === 1 && attr.startsWith('poison') ? v : v + (v - p[i]) * k));   // doc: giu thoi gian, tang sat thuong
};
const DMG_ATTRS = ['physicsenhance_p', 'physicsdamage_v', 'poisondamage_v', 'colddamage_v', 'firedamage_v', 'lightingdamage_v'];
const isAttack = s => !!(s && s.enemy && DMG_ATTRS.some(a => s.attr[a]));
const ZONES = W.zones, MON = W.mon;
/* Sua diem neo hinh quai: vai bo hinh xuat tu SPR co do lech am (enemy205 Thuy Tac, enemy078, enemy149, enemy150, ani056) ->
   hinh ve lech xa so voi ten / vong chan. Neo hop le: giua duoi khung (nhu cac bo khac: ax ~ w/2, ay ~ h - 2). */
for (const k in W.anim || {}) for (const a in W.anim[k]) { const m = W.anim[k][a]; if (m && (m.ax < 0 || m.ay < 0 || m.ax > m.w || m.ay > m.h * 1.2)) { m.ax = m.w / 2; m.ay = m.h - 2; } }
const ZONE_STAGES = 10, WAVES = 4;
/* ---------- he quai co dinh (kieu JX1) ----------
   Npcs.txt: moi loai quai co 1 nguyen to khang toi da 90 (he cua no) va 1 nguyen to 60 (diem yeu). Thu tu rmax = ELEM = thu tu he
   (vat ly-Kim, doc-Moc, bang-Thuy, hoa-Hoa, loi-Tho). Khang deu nhau (vd Nhen 75/75/...): he theo ma quai. */
const SERIES_ELEM = ['phys', 'poison', 'cold', 'fire', 'light'];
function monSeries(tid) {
  const m = MON[tid]; if (!m) return 0; if (m._s !== undefined) return m._s;
  const r = m.rmax || [], mx = Math.max(...r), top = r.map((v, i) => (v === mx ? i : -1)).filter(i => i >= 0);
  return (m._s = top.length === 1 ? top[0] : Math.abs(+tid || 0) % 5);
}
/* Ti le he quai cua mot vung (theo danh sach quai) */
function zoneSeries(z) { const c = [0, 0, 0, 0, 0]; for (const t of z.m) c[monSeries(t)]++; return c; }
const STAGES = ZONES.length * ZONE_STAGES;

/* ---------- trang bi ---------- */
const DMG_SHIELD_MAX = 0.35;   // giam thieu sat thuong ganh chiu (diem): toi da 35% moi don (quai game danh nhe hon JX1)
const SLOTS = [['weapon', 'Vũ khí'], ['armor', 'Áo'], ['helm', 'Mũ'], ['belt', 'Đai lưng'], ['boot', 'Giày'], ['cuff', 'Hộ uyển'],
  ['amulet', 'Dây chuyền'], ['ring1', 'Nhẫn 1'], ['ring2', 'Nhẫn 2'], ['pendant', 'Ngọc bội'], ['horse', 'Ngựa']];
const SLOT_VI = Object.fromEntries(SLOTS);
const DETAIL_SLOT = ['weapon', 'weapon', 'armor', 'ring', 'amulet', 'boot', 'belt', 'helm', 'cuff', 'pendant', 'horse']; // theo equip_detail
const MELEE_KIND = ['sword', 'blade', 'wand', 'spear', 'hammer', 'dualblades'], RANGE_KIND = ['darts', 'knife', 'crossbow'];
const AFFIX_KEY = { armor: 'armor', ring: 'ring', amulet: 'necklace', boot: 'boot', belt: 'belt', helm: 'helm', cuff: 'cuff', pendant: 'pendant' };
const RAR_VI = ['Thường', 'Xanh', 'Hiếm', 'Tím', 'Hoàng Kim', 'Bạch Kim'], RAR_COL = ['#e8e0d0', '#6aa8ff', '#ff9a3c', '#c77bff', '#ffcc00', '#9fe8ff'];   // nhu JX1: co thuoc tinh = xanh (moi so dong); Hiem = ngua hiem
const INV_MAX = 60;
/* Cuong hoa trang bi (forge.js): moi cap +8% thuoc tinh goc (sat thuong vu khi, phong thu, khang goc...) */
const ENH_MAX = 10, ENH_STEP = 0.08;
const PLAT_STEP = 0.05;   // Bach Kim: moi cap thang +5% thuoc tinh goc (Uoc luong)
const enhMul = it => 1 + ENH_STEP * ((it && it.enh) || 0) + PLAT_STEP * ((it && it.plv) || 0);
/* The gioi cua moi vung = anh ban do that 3x3 vung (1536 x 1536 diem) ghep 2x2 lat guong (render.js drawTiledBg)
   -> 3072 x 3072, lien mach khong thay mep; camera chay theo nhan vat */
const WORLD = { w: 3072, h: 3072, pad: 20 };
const clampWorld = (x, y) => [clamp(x, WORLD.pad, WORLD.w - WORLD.pad), clamp(y, WORLD.pad + 30, WORLD.h - WORLD.pad)];
/* vi tri trong the gioi, o di duoc gan nhat khi co vat can (mapobs.js) */
const inWorld = (x, y) => { const p = clampWorld(x, y); return typeof OBS !== 'undefined' && OBS.g ? obsSnap(p[0], p[1]) : p; };
const attrName = id => J.attr[id] || ('#' + id);

/* trum bai ten tam trong du lieu ('Tieu Boss cap N'): dat ten theo ban do */
const bossName = (tid, zn) => (MON[tid] && /^Tiểu Boss/i.test(MON[tid].n) ? `Bá Chủ ${zn || ''}`.trim() : MON[tid] ? MON[tid].n : '');
