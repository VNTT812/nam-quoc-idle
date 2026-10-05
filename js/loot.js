/* ======================= ROI DO (settings/droprate/*.ini + magicattriblevel.txt) ======================= */
'use strict';
const FACTION_WEAPON_SHARE = 0.5;
function dropFile(L) {
  const b = L < 110 ? clamp(Math.floor(L / 10) * 10, 10, 90) : (L < 119 ? 110 : 119);
  return J.drop['npcdroprate' + b + '.ini'] || J.drop['npcdroprate.ini'];
}
/* Cap vat pham 1..10 theo cap quai, gioi han boi MinItemLevel/MaxItemLevel cua tep roi do */
function itemTier(L, df) {
  const m = df.main;
  return clamp(Math.round(L / 12) + irnd(-1, 1), m.MinItemLevel || 1, m.MaxItemLevel || 10);
}
function baseRow(detail, particular, tier) {
  const g = J.items[detail]; if (!g) return null;
  let rows = g.list.filter(r => r.k === particular);
  if (!rows.length) return null;
  const okRows = rows.filter(r => sexReqOk(r.req)); if (okRows.length) rows = okRows;   // uu tien mon dung gioi tinh nhan vat
  return rows.reduce((b, r) => Math.abs(r.lvl - tier) < Math.abs(b.lvl - tier) ? r : b);
}
/* Thuoc tinh ma thuat theo KItemGenerator::Gen_MagicAttrib + KLibOfBPT (magicattrib.txt, 330 dong):
   dong i = 0,2,4 la tien to (hien), 1,3,5 la hau to (an, can ngu hanh kich hoat); ung vien = dong cung loai tien/hau to,
   he yeu cau (-1 = moi he) bang he cua mon do, cap dong <= cap thuoc tinh, ti le roi theo loai trang bi > nDecide,
   khong trung loai thuoc tinh; chon ngau nhien deu; gia tri ngau nhien trong khoang. */
function rollLine(it, i, lv, used, lucky = 0) {               // mot dong thuoc tinh o vi tri i (dung chung cho tay luyen giu dong, forge.js)
  const pre = i % 2 === 0 ? 1 : 0;
  const decide = Math.floor(Math.random() * 100) / (1 + lucky * 20 / 100);
  const cand = J.affix.filter(a => a.pre === pre && (a.s < 0 || a.s === it.s) && a.lvl <= lv && (a.w[it.d] || 0) > decide && !used.has(a.a));
  if (!cand.length) return null;
  const a = pick(cand); used.add(a.a);
  const p = a.p.map(([mn, mx]) => mn === -1 && mx === -1 ? -1 : irnd(Math.min(mn, mx), Math.max(mn, mx)));
  return { a: a.a, p, n: a.n, pre };
}
function rollMagic(it, levels, lucky = 0) {
  const out = [], used = new Set();
  for (let i = 0; i < levels.length; i++) { const m = rollLine(it, i, levels[i], used, lucky); if (!m) break; out.push(m); }
  return out;
}
function magicCount(cls, L = 1) {
  const r = Math.random() * 100 - (cls === 'boss' ? 35 : cls === 'elite' ? 12 : 0) - (R.P ? R.P.lucky : 0) * 0.5 - Math.min(L, 200) * 0.05;   // quai cap cao: do nhieu dong hon
  return r < 3 ? irnd(5, 6) : r < 15 ? irnd(3, 4) : r < 50 ? irnd(1, 2) : 0;
}
/* cap tung dong thuoc tinh (pnaryMALevel): quanh cap mon do, 1..10 */
const magicLevels = (n, tier) => Array.from({ length: n }, () => clamp(tier + irnd(-1, 0), 1, 10));
function rarityOf(n) { return n >= 1 ? 1 : 0; }   // JX1: co dong thuoc tinh = do xanh (khong chia so dong)   // Tim (3) chi tu Huyen Tinh (recipes.js), do roi ngau nhien toi da Vang
const randomSeries = () => irnd(0, 4); // KItemGenerator: he ngau nhien Kim..Tho neu khong yeu cau he

/* Trang phuc nam / nu nam o cac "particular" khac nhau (vd ao 0..6 nam, 7..13 nu): doi sang loai dung gioi tinh nhan vat */
function sexPart(detail, part) {
  const g = J.items[detail]; if (!g) return part;
  const rows = g.list.filter(r => r.k === part);
  if (!rows.length || rows.some(r => sexReqOk(r.req))) return part;
  const alt = [...new Set(g.list.filter(r => sexReqOk(r.req)).map(r => r.k))];
  return alt.length ? pick(alt) : part;
}
function makeItem(detail, particular, tier, nMagic) {
  const b = baseRow(detail, particular, tier); if (!b) return null;
  const it = { uid: S.uid++, d: detail, k: particular, p: b.p, n: b.n, ic: b.ic || '', lvl: b.lvl, s: b.s >= 0 ? b.s : randomSeries(),
    base: b.base.map(x => x.slice()), req: b.req.map(x => x.slice()), price: b.price };
  it.mag = rollMagic(it, magicLevels(nMagic, b.lvl), R.P ? R.P.lucky : 0);
  it.r = rarityOf(it.mag.length);
  return it;
}
/* Ti le roi: quai thuong 8% (truoc 10%: qua nhieu do trang thua), nhan voi hieu ung tang roi do + 10% moi lan chuyen sinh */
const DROP_NORMAL = 0.08;
const dropMul = () => (1 + (typeof buffP === 'function' ? buffP('drop') : 0)) * (1 + 0.1 * rebornN()) * (1 + Math.min(100, Math.max(0, R.P ? R.P.lucky : 0)) * 0.005);   // may man: +0.5% / diem (toi da +50%)
/* Roi do khi ha quai: so luong theo loai quai, mon theo RandRate/RandRange cua tep droprate */
function rollDrops(e) {
  const df = dropFile(e.L), items = df.items.filter(x => x[0] === 0 && x[1] <= 9);
  const dm = dropMul(), n = e.cls === 'boss' ? 3 + (Math.random() < dm - 1 ? 1 : 0) : e.cls === 'elite' ? (Math.random() < 0.5 * dm ? 1 : 0) : (Math.random() < DROP_NORMAL * dm * densK(e) ? 1 : 0);
  const out = [];
  for (let i = 0; i < n * (e.bonusDrop || 1); i++) {
    const x = wpick(items, r => r[3]); if (!x) continue;
    let [detail, part] = [x[1], x[2]];
    // JX mua vu khi o tiem; game idle khong co tiem -> mot nua so vu khi roi ra dung loai vu khi cua phai
    const f = FAC[S.fac];
    if (detail <= 1 && f && !f.novice && Math.random() < FACTION_WEAPON_SHARE) [detail, part] = wantWeaponDP();   // vu khi hop chieu chinh (JX1 EqtLimit)
    part = sexPart(detail, part);
    let it = makeItem(detail, part, itemTier(e.L, df), magicCount(e.cls, e.L));
    for (let t = 0; it && !sexOk(it) && t < 6; t++) it = makeItem(detail, part, itemTier(e.L, df), magicCount(e.cls, e.L));   // khong roi trang phuc khac gioi tinh
    if (it && sexOk(it)) out.push(it);
  }
  // trang suc "cui" (nhan / day chuyen / ngoc boi it dong) roi them de hop Huyen Tinh (Lo Ep Do -> Tinh luyen, hoac tu hop)
  if (typeof verVio === 'function' && verVio() && Math.random() < (JEWEL_DROP[e.cls] ?? JEWEL_DROP.normal) * dm * densK(e) * (e.bonusDrop || 1)) {
    const js = items.filter(x => FUSE_SLOTS.includes(x[1])), x = js.length ? wpick(js, r => r[3]) : null;
    const it = x && makeItem(x[1], x[2], itemTier(e.L, df), irnd(0, 2)); if (it) out.push(it);
  }
  return out;
}
const JEWEL_DROP = { normal: 0.04, elite: 0.35, boss: 1 };   // ti le roi them 1 mon trang suc de hop Huyen Tinh
function moneyDrop(e) {
  const m = dropFile(e.L).main;
  return Math.round((m.MoneyScale || 50) / 10 * e.L * rnd(0.6, 1.4) * (e.cls === 'boss' ? 8 : e.cls === 'elite' ? 2 : 1));
}
/* Gia ban theo CHI SO TRANG BI: moi dong thuoc tinh tinh theo do lon so voi muc toi da cua chinh thuoc tinh do trong bang
   magicattriblevel (vd Sinh luc +80 / toi da 200 = 0.4; Khang tat ca 10 / toi da 15 = 0.67), cong lai thanh diem chi so; chi so goc
   (sat thuong vu khi, phong thu) so voi mon cung loai tot nhat. Gia = 1540 x diem^2.4 x do hiem x cuong hoa (chi phu thuoc chi so, khong theo cap hay loai do).
   -> mon chi so cao ban dat gap nhieu lan, mon chi so thap re. Ngua giu gia cu. */
const VAL_K = 1540, VAL_EXP = 2.4;                               // khop gia trung vi cu o moi cap (do bang mo phong): diem 0.2 ~ 25, 0.8 ~ 900, 1.1 ~ 1900
const ATTR_MAX = (() => {                                        // muc toi da cua tung thuoc tinh (tham so 1) trong magicattriblevel + dong bo
  const m = {};
  const put = (a, p) => { const v = Math.max(Math.abs(p[0] || 0), Math.abs(p[1] || 0)); if (v > 0 && v !== 1 && !(p[0] === -1 && p[1] === -1)) m[a] = Math.max(m[a] || 0, v); };
  for (const r of J.affixLevel) put(r.a, r.p[0]);
  for (const k in J.ge) put(J.ge[k].a, J.ge[k].p[0]);
  return m;
})();
const BASE_MAX = {};                                             // chi so goc lon nhat theo loai (detail:particular)
function baseStat(it) { let v = 0; for (const [id, mn, mx] of it.base || []) if (id === 28 || id === 29 || id === 30) v += (mn + mx) / 2; return v; }
function baseMax(it) {
  const k = it.d + ':' + it.k; if (BASE_MAX[k] !== undefined) return BASE_MAX[k];
  const g = J.items[it.d]; let mx = 0; if (g) for (const r of g.list) if (r.k === it.k) mx = Math.max(mx, baseStat(r));
  return (BASE_MAX[k] = mx);
}
function statScore(it) {
  let sc = 0;
  for (const m of (it.mag || []).concat(it.ext || [])) {
    const nm = attrName(m.a); if (typeof ATTR_NOEFFECT !== 'undefined' && ATTR_NOEFFECT.has(nm)) continue;
    const mx = ATTR_MAX[m.a], v = Math.abs((m.p || [])[0] || 0);
    sc += mx ? Math.min(1.5, v / mx) : 0.3;                      // thuoc tinh dang co / khong bang muc: tinh 0.3
  }
  const bm = baseMax(it); if (bm > 0) sc += baseStat(it) / bm * enhMul(it);   // chi so goc so voi mon cung loai tot nhat (ca cuong hoa)
  return sc;
}
function itemValue(it) {
  if (it.d === 10) return Math.round((it.price || 100) / 10 * (1 + (it.mag || []).length * 0.8));
  const rar = it.set ? (it.set.kind === 'platina' ? 2 * (1 + 0.3 * (it.plv || 0)) : 1) : it.vio ? 1.5 : 1;   // do bo: chi so da cao (dong mo rong), Bach Kim them he so
  return Math.max(1, Math.round(VAL_K * Math.pow(statScore(it) + 0.05, VAL_EXP) * rar * (1 + 0.15 * (it.enh || 0))));
}
function itemPower(it) {
  let v = it.lvl * 10;
  for (const [id, mn, mx] of it.base) if (id === 28 || id === 29 || id === 30) v += (mn + mx) / 2;
  for (const m of it.mag.concat(it.ext || [])) { const nm = attrName(m.a); if (typeof ATTR_NOEFFECT !== 'undefined' && ATTR_NOEFFECT.has(nm)) continue; v += 15 + Math.min(200, Math.abs(m.p[0])) * 0.6; }   // dong khong tac dung: 0 diem
  return v * enhMul(it);
}
function slotFor(it) {
  const s = DETAIL_SLOT[it.d];
  if (s === 'ring') return !S.eq.ring1 ? 'ring1' : !S.eq.ring2 ? 'ring2' : (itemPower(S.eq.ring1) <= itemPower(S.eq.ring2) ? 'ring1' : 'ring2');
  return s;
}
/* Mot dong thuoc tinh ma thuat -> chu: "+N cap ky nang" ro rang, danh dau dong khong tac dung */
function magText(m) {
  const nm = attrName(m.a), p = m.p.map(v => v === -1 ? 0 : v);
  let t;
  if (nm === 'allskill_v') {
    const sid = p[2], s = sid > 0 ? SK[sid] : null;
    if (!(sid > 0)) t = `Tất cả kỹ năng: +${p[0]} cấp`;
    else { const mine = FAC[S.fac] && FAC[S.fac].skills.some(x => +x === sid); t = `Kỹ năng ${s ? s.n : '#' + sid}: +${p[0]} cấp${mine ? '' : ' (không thuộc môn phái)'}`; }
  } else t = attrText(nm, p).split('<enter>')[0];
  if (typeof ATTR_NOEFFECT !== 'undefined' && ATTR_NOEFFECT.has(nm)) t += ' · không tác dụng trong game';
  return t;
}
function itemLines(it) {
  const L = [], dmin = it.base.find(b => b[0] === 28), dmax = it.base.find(b => b[0] === 29), k = enhMul(it);
  if (it.plv) L.push(['h on', `Bạch Kim +${it.plv}: thuộc tính gốc +${Math.round(it.plv * PLAT_STEP * 100)}%`]);
  if (it.enh) L.push(['h on', `Cường hóa +${it.enh}: thuộc tính gốc +${Math.round((k - 1) * 100)}%`]);
  if (it.thanma) L.push(['r', 'Thần mã: không phạt né tránh, thần lực luôn hiệu lực']);
  if (it.d === 10 && typeof horseLv === 'function') L.push(['h on', `Thuần dưỡng cấp ${horseLv(it)}/${HORSE_MAX}: chỉ số ngựa +${Math.round(horseLv(it) * HORSE_UP * 100)}%, phạt né −${Math.min(100, Math.round(horseLv(it) * HORSE_PEN * 100))}%`]);
  if (dmin) L.push(['b', `Sát thương: ${Math.round(dmin[1] * k)} - ${Math.round((dmax ? dmax[1] : dmin[1]) * k)}`]);
  for (const [id, mn, mx] of it.base) {
    const nm = attrName(id); if (id === 28 || id === 29 || nm === 'durability_v' || nm === 'item_purple' || id === 167 || nm === 'staminamax_v') continue;
    const hv = v => (typeof horseAdj === 'function' ? horseAdj(it, v) : v);
    L.push(['b', attrText(nm, [Math.round(hv((mn + mx) / 2 * k)), 0, Math.round(hv(mx * k))])]);
  }
  const act = it.d === 10 ? 3 : typeof hiddenActive === 'function' ? hiddenActive(it) : 0;   // ngua: moi dong luon hieu luc
  it.mag.forEach((m, i) => {
    const hidden = i % 2 === 1, on = !hidden || Math.floor(i / 2) < act;
    L.push([hidden ? (on ? 'h on' : 'h') : 'm', magText(m) + (hidden && !on ? ' (ẩn)' : '')]);
  });
  const nh = Math.floor((it.mag || []).length / 2);
  if (nh && !it.leg && it.d !== 10 && it.s >= 0 && typeof ACCRUE !== 'undefined') {   // kich dong an: trang bi nao, he gi (nhu JX1)
    const gen = +Object.keys(ACCRUE).find(k => ACCRUE[k] === it.s), slot = slotOfEquipped(it, S.eq) || slotFor(it);
    const full = typeof enoughToActive === 'function' && enoughToActive(S.eq);
    L.push(['r', `Kích hoạt thuộc tính ẩn:${it.set ? ' (đủ bộ tự kích hết)' : ''}`]);
    L.push([full || heroSeries() === gen ? 'h on' : 'h', `  Nhân vật: hệ ${SERIES[gen]}`]);
    for (const k of ACTIVATED_BY[slot] || []) L.push([full || (S.eq[k] && S.eq[k].s === gen) ? 'h on' : 'h', `  ${SLOT_VI[k]}: hệ ${SERIES[gen]}`]);
  }
  if (it.set) {
    const ex = typeof goldEnhance === 'function' ? goldEnhance(it, S.eq) : 0, cnt = typeof setCounts === 'function' ? (setCounts(S.eq)[it.set.grp] || 0) : 0;
    (it.ext || []).forEach((m, i) => L.push([i < ex ? 'h on' : 'h', magText(m) + (i < ex ? ' (bộ)' : ` (mặc ${it.set.n1 * (i + 1)} món cùng bộ)`)]));
    L.push(['r', `Bộ ${it.set.kind === 'gold' ? 'Hoàng Kim' : 'Bạch Kim'}: đang mặc ${cnt} món · đủ ${it.set.n2} món mở hết dòng ẩn mọi trang bị`]);
    for (const r of setMembers(it)) L.push(['r', `  ${Object.values(S.eq).some(e => e && e.set && bareName(e.n) === bareName(r.n)) ? '✔' : '·'} ${r.n}`]);
  }
  const REQ = { 36: 'Cấp', 32: 'Sức mạnh', 33: 'Thân pháp', 34: 'Sinh khí', 35: 'Nội công', 37: 'Hệ', 38: 'Giới tính', 39: 'Môn phái' };
  for (const [id, v] of it.req) if (REQ[id] && (v > 0 || id === 39)) L.push(['r', `Yêu cầu ${REQ[id]}: ${id === 37 ? SERIES[v] : id === 39 ? ((J.factions[v] || {}).n || v) : v}`]);
  return L;
}

/* ======================= DO ROI TREN DAT + BO LOC ======================= */
const GROUND_MAX = 40, PICK_R = 26;
const LOOT_ATTR_GROUPS = [ // thuoc tinh hay loc (ten trong KMagicDesc.cpp)
  ['Sinh lực', ['lifemax_v', 'lifemax_p', 'lifereplenish_v']], ['Nội lực', ['manamax_v', 'manamax_p', 'manareplenish_v']],
  ['Sát thương', ['addphysicsdamage_v', 'addphysicsdamage_p', 'addfiredamage_v', 'addcolddamage_v', 'addlightingdamage_v', 'addpoisondamage_v']],
  ['Kháng', ['physicsres_p', 'poisonres_p', 'coldres_p', 'fireres_p', 'lightingres_p', 'allres_p']],
  ['Chỉ số', ['strength_v', 'dexterity_v', 'vitality_v', 'energy_v']], ['Kỹ năng', ['allskill_v']],
  ['Tốc độ', ['attackspeed_v', 'castspeed_v', 'fastwalkrun_p']], ['Hút máu / nội', ['steallifeenhance_p', 'stealmanaenhance_p']],
  ['Chính xác / né', ['attackratingenhance_v', 'adddefense_v']], ['Sát thương nội công', ['metalskill_v', 'earthskill_v', 'woodskill_v', 'waterskill_v', 'fireskill_v']],
];
/* Bo loc mo rong: so dong toi thieu, loai trang bi, chi do mac duoc, he tuong sinh voi nhan vat (mo dong an), vu khi dung loai phai,
   luon giu do quy (bo / Tim / Bach Kim / ngua hiem). Tap thuoc tinh mong muon duoc dem san (lootMatch goi moi khung hinh cho moi mon tren dat). */
const LOOT_SLOT_GROUPS = [['weapon', 'Vũ khí'], ['armor', 'Áo'], ['helm', 'Mũ'], ['belt', 'Đai'], ['boot', 'Giày'], ['cuff', 'Hộ uyển'], ['amulet', 'Dây chuyền'], ['ring', 'Nhẫn'], ['pendant', 'Ngọc bội'], ['horse', 'Ngựa']];
const LOOT_DEF = () => ({ mode: 'smart', minRar: 1, minLvl: 1, groups: [], series: [], auto: true, minMag: 0, slots: [], wear: false, accrue: false, facW: false, keepRare: true, setOnly: false, setKeep: [], setMine: false, pickAll: true,
  ep: { white: true, jew: true, blue: true, blueLv: 5, dest: 'box' } });   // do de ep Tim: nhat rieng, cat vao Ruong ep / Kho chung / hanh trang
/* Bo do Hoang Kim / Bach Kim chon giu (theo ten bo): bat "chi giu bo da chon" -> do bo khac khong nhat, ban hang loat duoc */
const SET_FAMILIES = [['Thanh Câu', 50], ['Vân Lộc', 80], ['Môn phái', 99], ['Thương Lang', 100], ['Tống Kim', 120], ['Tử Mãng', 120], ['Kim Ô', 120], ['Bạch Hổ', 120], ['Xích Lân', 120], ['Minh Phượng', 120], ['Huyền Viên', 120], ['Tinh Sương', 120], ['Đằng Long', 180], ['Bộ chung', 0]];
const SET_NAMED = SET_FAMILIES.filter(([n]) => !['Môn phái', 'Tống Kim', 'Bộ chung'].includes(n));
const setFac = it => ((it.req || []).find(q => q[0] === 39) || [0, -1])[1];
function setFamily(it) {
  if (!it || !it.set) return null;
  const n = bareName(it.n), named = SET_NAMED.find(([f]) => n.startsWith(f));
  if (named) return named[0];
  if (it.n.includes('Tống Kim')) return 'Tống Kim';
  return setFac(it) >= 0 ? 'Môn phái' : 'Bộ chung';
}
function setKept(it) {
  if (!it || !it.set) return false;
  const f = S.lootF; if (!f) return true;
  if (f.setMine && FAC[S.fac] && !FAC[S.fac].novice && setFac(it) >= 0 && setFac(it) !== FAC[S.fac].id) return false;   // bo cua phai khac
  if (!f.setOnly) return true;
  const fam = setFamily(it); return !!fam && (f.setKeep || []).includes(fam);
}
function lootFilter() {
  const f = S.lootF || (S.lootF = LOOT_DEF());
  if (f.mode === undefined) f.mode = 'smart';
  if (f.pickAll === undefined || f.setKeep === undefined || f.keepRare === undefined || f.ep === undefined) { const d = LOOT_DEF(); for (const k in d) if (f[k] === undefined) f[k] = d[k];
    if (S.epAuto === false) f.ep.white = false; if (S.epAutoJ === false) f.ep.jew = false; delete S.epAuto; delete S.epAutoJ; }
  return f;
}
let LF_KEY = null, LF_WANT = null;
function lootWant(f) {
  const key = f.groups.join(',');
  if (key !== LF_KEY) { LF_KEY = key; LF_WANT = f.groups.length ? new Set(f.groups.flatMap(g => (LOOT_ATTR_GROUPS[g] || [0, []])[1]).map(n => ATTR_ID[n]).filter(x => x !== undefined)) : null; }
  return LF_WANT;
}
const lootRare = it => !!((it.set && setKept(it)) || it.vio || it.plv || (it.d === 10 && (it.r >= 3 || it.rareH)));
/* Do dung cho he thong ep Tim (phien ban 2+): trang = phoi, nhan / day chuyen / ngoc boi = luyen Huyen Tinh, xanh / vang co dong cap cao = lay thuoc tinh */
function epWant(it) {
  const e = lootFilter().ep; if (!e || typeof verVio !== 'function' || !verVio() || !it || it.set || it.vio || it.thanma || !(it.d >= 0 && it.d <= 9)) return '';
  if (e.jew && FUSE_SLOTS.includes(it.d) && (it.r || 0) <= 2 && !(typeof betterThanEquipped === 'function' && betterThanEquipped(it))) return 'jew';
  if (e.white && (it.r || 0) === 0 && !(it.mag || []).length) return 'white';
  if (e.blue && (it.r === 1 || it.r === 2) && (it.mag || []).some(m => oreRows(m.a).length && hutLevel(m) >= (e.blueLv || 1))) return 'blue';
  return '';
}
/* Loc thong minh: giu mon lam nhan vat manh hon (so voi do dang mac), ke ca mon sap mac duoc (cap yeu cau <= cap + 10) */
let UG_KEY = '', UG = {}, UG_BASE = 1;
function soonWearable(it) {
  if (!sexOk(it)) return false;
  for (const [id, v] of it.req || []) { if (id === 36 && v > eqLevel() + 10) return false; if ((id === 37 || id === 39) && v >= 0 && FAC[S.fac] && (id === 37 ? heroSeries() !== v : FAC[S.fac].id !== v)) return false; }
  const f = FAC[S.fac]; if (DETAIL_SLOT[it.d] === 'weapon' && f && !weaponFits(it)) return false;
  return true;
}
function upgradeGain(it) {
  if (!it || !S.fac || !(it.d >= 0 && it.d <= 10)) return -1;
  const key = Object.values(S.eq).map(x => x ? x.uid + '.' + (x.enh || 0) + '.' + (x.mag || []).length : 0).join(',') + '|' + S.lvl + '|' + S.fac;
  if (key !== UG_KEY) { UG_KEY = key; UG = {}; try { UG_BASE = Math.max(1, power(calc(S.eq))); } catch (e) { UG_BASE = 1; } }
  if (it.uid in UG) return UG[it.uid];
  let g = -1;
  if (soonWearable(it)) try { const eq = Object.assign({}, S.eq); eq[slotFor(it)] = it; g = power(calc(eq)) / UG_BASE - 1; } catch (e) { g = -1; }
  return (UG[it.uid] = g);
}
const isUpgrade = it => upgradeGain(it) > 0.005;
/* △: neu cuong hoa len ngang do dang mac cung vi tri thi manh hon */
const UGE = {};
function enhGain(it) {
  if (!it || !S.fac || !(it.d >= 0 && it.d <= 9)) return null;
  const cur = S.eq[slotFor(it)], tgt = cur && cur.enh || 0; if (tgt <= (it.enh || 0)) return null;
  upgradeGain(it);   // dong bo khoa bo nho dem
  const k = UG_KEY + '#' + it.uid; if (k in UGE) return UGE[k];
  let r = null;
  if (soonWearable(it)) try { const c = Object.assign({}, it, { enh: tgt }), eq = Object.assign({}, S.eq); eq[slotFor(it)] = c; const g = power(calc(eq)) / UG_BASE - 1; if (g > 0.005) r = { enh: tgt, gain: g }; } catch (e) { r = null; }
  return (UGE[k] = r);
}
const isPotential = it => !isUpgrade(it) && !!enhGain(it);
function lootMatch(it) {
  if (typeof dtNeed === 'function' && dtNeed(it)) return true;   // mon giu de tra Da Tau
  const f = lootFilter();
  if (it.set && !setKept(it)) return false;             // do bo khong nam trong danh sach giu
  if (f.mode === 'smart') return lootRare(it) || isUpgrade(it) || isPotential(it);   // thong minh: chi giu do quy + do nang cap
  if (f.keepRare && lootRare(it)) return true;
  if (it.r < f.minRar || it.lvl < f.minLvl || (it.mag || []).length < (f.minMag || 0)) return false;
  if (f.series.length && !f.series.includes(it.s)) return false;
  if (f.slots.length && !f.slots.includes(DETAIL_SLOT[it.d])) return false;
  if (f.wear) {
    if (!sexOk(it)) return false;
    for (const [id, v] of it.req || []) { if (id === 36 && v > eqLevel() + 5) return false; if ((id === 37 || id === 39) && v >= 0 && FAC[S.fac] && (id === 37 ? heroSeries() !== v : FAC[S.fac].id !== v)) return false; }
  }
  if (f.accrue && it.s >= 0 && it.d !== 10 && FAC[S.fac] && !accrues(heroSeries(), it.s)) return false;
  if (f.facW && DETAIL_SLOT[it.d] === 'weapon' && FAC[S.fac] && !weaponFits(it)) return false;
  const want = lootWant(f);
  if (want && !it.mag.some(m => want.has(m.a))) return false;
  return true;
}
/* 3 bo loc luu san + vai mau nhanh */
const LOOT_QUICK = [['Mặc định', { mode: 'custom' }], ['Tím / Hoàng Kim', { mode: 'custom', minRar: 3 }], ['Hợp phái', { mode: 'custom', wear: true, facW: true, accrue: true }], ['Nhặt hết', { mode: 'custom', minRar: 0, minLvl: 1 }]];
function lootPresets() { const p = S.lootP || (S.lootP = [null, null, null]); while (p.length < 3) p.push(null); return p; }
function lootSavePreset(i) { const f = lootFilter(); lootPresets()[i] = JSON.parse(JSON.stringify(f)); }
function lootLoadPreset(o) { const { auto, pickAll } = lootFilter(); S.lootF = Object.assign(LOOT_DEF(), JSON.parse(JSON.stringify(o)), { auto, pickAll }); LF_KEY = null; }
function dropToGround(it, at) {
  const a = rnd(0, Math.PI * 2), d = rnd(10, 26);
  const [x, y] = inWorld(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d);
  R.ground.push({ it, x, y, age: 0 });
  if (R.ground.length > GROUND_MAX) { let i = R.ground.findIndex(d => !d.it.set && !d.it.vio && !d.it.plv); if (i < 0) i = 0; const old = R.ground.splice(i, 1)[0]; S.gold += itemValue(old.it); } // qua nhieu: mon cu nhat tu ban (khong ban do bo / Tim / Bach Kim neu con mon khac)
  if (!R.quiet) uiSfx(it.d <= 1 ? 'dropWeapon' : it.d === 2 || it.d === 7 ? 'dropCloth' : 'dropOther');
  if (it.r >= 2 && !R.quiet) log(`Rơi xuống đất: <span style="color:${RAR_COL[it.r]}">${esc(it.n)}</span>`);
}
/* Hanh trang day: tu ban mon kem nhat (khong phai do bo) neu mon moi tot hon -> treo may lau van thay do moi
   (truoc day tui day la ngung nhat, do tot nam duoi dat roi bi tu ban, nhan vat khong bao gio len do) */
function makeRoom(it, force) {
  let worst = null;
  // khong bo mon Tim dang kham do (vio) va Bach Kim da thang cap (plv) khi nhet do moi; mon trang goc van co the bi bo (kham ngay sau khi mua)
  for (const x of S.inv) if (!(x.set && setKept(x)) && !x.vio && !x.plv && !x.lock && !x.thanma && !dtNeed(x) && (!worst || itemPower(x) < itemPower(worst))) worst = x;
  if (!worst || (!force && itemPower(worst) >= itemPower(it))) return false;
  S.gold += itemValue(worst); S.inv.splice(S.inv.indexOf(worst), 1); invDirty = true;
  return true;
}
/* Nhat toan bo: hanh trang day thi ban cac mon KHONG khop bo loc (tru mon duoc bao ve) de lay cho */
const sellableByFilter = () => S.inv.filter(x => !lootMatch(x) && !sellProtected(x) && !Object.values(S.eq).includes(x));
function sellByFilter(quiet) {
  const w = sellableByFilter(); if (!w.length) return 0;
  let g = 0; for (const x of w) g += itemValue(x);
  S.gold += g; S.inv = S.inv.filter(x => !w.includes(x)); invDirty = true;
  if (!quiet && !R.quiet) log(`<span class="dim">Hành trang đầy: bán ${w.length} món không khớp bộ lọc (+${fmt(g)} lượng)</span>`);
  return w.length;
}
const LOOT_NEAR = 220;
/* Space: di nhat mon gan nhat tren dat (moi mon, khong theo bo loc) */
function pickNearest() {
  let best = null, bd = 600;
  for (const d of R.ground) { const k = Math.hypot(d.x - H.x, d.y - H.y); if (k < bd) { bd = k; best = d; } }
  if (!best) { toast('Không có đồ gần để nhặt'); return; }
  R.pickTarget = best; R.moveTo = null;
}                                       // tam nhat do trong luc danh quai
function pickUp(drop, quiet) {
  const i = R.ground.indexOf(drop); if (i < 0) return false;
  if ((S.inv.length >= INV_MAX || epBox().length >= EP_BOX_MAX) && typeof autoHut === 'function') autoHut(5);
  if (S.inv.length >= INV_MAX && lootFilter().pickAll) sellByFilter();
  const epd = epWant(drop.it) && lootFilter().ep.dest !== 'inv' && !lootMatch(drop.it);
  if (!epd && S.inv.length >= INV_MAX && !makeRoom(drop.it, typeof dtNeed === 'function' && dtNeed(drop.it))) { if (!quiet) toast('Hành trang đầy'); return false; }
  R.ground.splice(i, 1);
  addItem(drop.it, quiet, true, R.pickTarget === drop); questTick('picked');   // cham tay chon nhat: giu, khong coi la do thua
  if (R.pickTarget === drop) R.pickTarget = null;
  return true;
}
/* Nhat: di toi mon dang chon (cham tay) hoac, luc khong con quai, tu di nhat mon khop bo loc (hoac moi mon khi bat Nhat toan bo) */
function updateGround(dt) {
  for (const d of R.ground) d.age += dt;
  let target = R.pickTarget && R.ground.includes(R.pickTarget) ? R.pickTarget : null;
  // tu nhat: mon trong LOOT_NEAR quanh nguoi nhat ca khi dang danh; mon xa hon chi khi khong con quai dang duoi minh (bai JX1: quai dung yen khong tinh)
  const fighting = R.enemies.some(e => !e.dead && (!e.home || e.aggro));
  if (!target && lootFilter().auto && !(typeof manual === 'function' && manual())) {
    let best = null, bd = 1e9;
    const f = lootFilter(), all = f.pickAll, full = S.inv.length >= INV_MAX && !(all && sellableByFilter().length);   // nhat toan bo: con mon ban duoc theo bo loc thi chua tinh la day
    const floor = full ? Math.min(...S.inv.filter(x => !x.set && !x.lock).map(itemPower), Infinity) : -Infinity;
    for (const d of R.ground) { if (d.age < 0.4 || (fighting && Math.hypot(d.x - H.x, d.y - H.y) > LOOT_NEAR) || !(all || lootMatch(d.it) || epWant(d.it)) || (full && itemPower(d.it) <= floor && !dtNeed(d.it))) continue; const k = Math.hypot(d.x - H.x, d.y - H.y); if (k < bd) { bd = k; best = d; } }
    target = best;
  }
  if (!target) return false;
  const dist = Math.hypot(target.x - H.x, target.y - H.y);
  if (dist <= PICK_R) { pickUp(target, true); return true; }
  obsSteer(H, target.x, target.y, 170 * curSpeed() * dt); H.face = target.x >= H.x ? 1 : -1;
  return true;
}
function groundAt(x, y) {
  let best = null, bd = 30;
  for (const d of R.ground) { const k = Math.hypot(d.x - x, d.y - (y + 6)); if (k < bd) { bd = k; best = d; } }
  return best;
}
function saveGround() { S.ground = R.ground.map(d => ({ it: d.it, wx: d.x, wy: d.y })); }
function restoreGround() { R.ground = (S.ground || []).filter(g => g && g.it).map(g => { const [x, y] = inWorld(g.wx ?? WORLD.w / 2, g.wy ?? WORLD.h / 2); return { it: g.it, x, y, age: 1 }; }); }
