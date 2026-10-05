/* ======================= RENG TIM: HUYEN TINH KHOANG THACH (KPlayer::Compound, KPlayer::Enchase) =======================
   Hop (CPA_FUSION): 3 mon (nhan + ngoc boi + day chuyen) -> 1 Huyen Tinh cap ngau nhien [tong cap / 10, tong cap / 5]; phi 1000 luong (Cong dong).
   Thang cap (CPA_CRYOLITE): 3 Huyen Tinh cung cap -> 1 cap +1; 2/11 rui ro, that bai mat het.
   Thang cap khoang (CPA_PROPMINE): 1 khoang +1 cap, 2/11 vo.
   Kham (ECA_ENCHASE): 1 mon trang + 1 Huyen Tinh + 1 khoang (loai ung voi dong 1..6) -> mon Tim; that bai 5% mat Huyen Tinh va khoang.
   Khoang ung dong k (0..5): dong chan = hien (tien to), dong le = an (hau to); khong khop he hoac loai mon thi khong kham duoc.
   Hang so cong thuc: window.RCP (tools/export_tables.py). Gia tri dong: affixLevel (magicattriblevel.txt), hang chon theo (cap HT + cap khoang)/2 (Uoc luong cach danh so hang). */
'use strict';
const RCP_R = window.RCP.recipes;
const VIO_SLOTS = 6, HT_MAX = 10, ORE_MAX = 10;
let rcRand = Math.random;                    // test thay the
const rcInt = (a, b) => a + Math.floor(rcRand() * (b - a + 1));
const rcFail = f => rcInt(0, f[1] - 1) < f[0];   // GetRandomNumber(0,10) <= 1 -> 2/11

const mats = () => { const m = S.mats || (S.mats = {}); for (const g of ['ht', 'ore', 'shard', 'misc']) m[g] = m[g] || {}; return m; };
const oreKey = (place, a, lvl, s = -1) => `${place}:${a}:${lvl}` + (s >= 0 && place % 2 ? `:${s}` : '');
const oreParse = k => { const [place, a, lvl, s] = k.split(':').map(Number); return { place, a, lvl, s: Number.isFinite(s) ? s : -1 }; };
/* Ten da nhu JX1: dong hien = Nguyen khoang (khong phan he), dong an = Nguyen thach (phai dung he ngu hanh cua trang bi) */
const ORE_NAMES = ['Huyền Thiết Nguyên Khoáng', 'Khổng Tước Nguyên Thạch', 'Mật Ngân Nguyên Khoáng', 'Phù Dung Nguyên Thạch', 'Chu Sa Nguyên Khoáng', 'Chung Nhũ Nguyên Thạch'];
const oreStoneName = k => { const o = oreParse(k); return ORE_NAMES[o.place] + (o.s >= 0 ? ` (${SERIES[o.s]})` : ''); };
/* Gia ren theo huong dan JX1 (Tho ren): luyen Huyen Tinh 1.000 · thang cap 5.000 · lay thuoc tinh 5.000 · che tao 10.000 · kham nam 10.000 */
const EP_COST = { up: 5000, hut: 5000, phoi: 10000, kham: 10000 };
const vioSlots = it => (it && it.vslots) || VIO_SLOTS;
/* Phu lieu (Thuy Tinh Trang hoac 5 Phuc Duyen): +15% thanh cong; kham: +1 bac gia tri dong */
const AUX_FD = 5;
const auxHave = () => matHave('misc', 'wc') > 0 || (typeof RW === 'function' && RW().fd >= AUX_FD);
function auxUse() { if (matHave('misc', 'wc') > 0) { matAdd('misc', 'wc', -1); return true; } if (RW().fd >= AUX_FD) { RW().fd -= AUX_FD; return true; } return false; }
function matAdd(group, key, n = 1) { const m = mats()[group]; m[key] = (m[key] || 0) + n; if (m[key] <= 0) delete m[key]; }
const matHave = (group, key) => mats()[group][key] || 0;

/* ---------- hop Huyen Tinh tu 3 mon ---------- */
const FUSE_SLOTS = RCP_R.violet_fuse.inputs[0].detail;      // nhan, day chuyen, ngoc boi
const fuseCost = () => RCP_R.violet_fuse.cost.luong;
/* chong dupe / tham chieu cu: chi thao tac mon dang nam trong hanh trang (hoac dang mac, voi kham / thang cap) */
const epBox = () => S.epBox || (S.epBox = []);                // Ruong ep: phoi / do hut rieng, khong tinh vao hanh trang
const ownedInv = it => !!it && (S.inv.includes(it) || epBox().includes(it));
function itemRemove(it) { let k = S.inv.indexOf(it); if (k >= 0) { S.inv.splice(k, 1); return true; } k = epBox().indexOf(it); if (k >= 0) { epBox().splice(k, 1); return true; } return false; }
const owned = it => ownedInv(it) || (!!it && Object.values(S.eq).includes(it));
const canFuse = it => ownedInv(it) && FUSE_SLOTS.includes(it.d) && !it.set && !it.vio && !it.lock && !Object.values(S.eq).includes(it);
function fuse(items) {
  if (!verVio()) return { ok: false, msg: 'Chưa mở' };
  if (!items || items.length !== 3 || !items.every(canFuse) || new Set(items).size !== 3) return { ok: false, msg: 'Cần đúng 3 món nhẫn / dây chuyền / ngọc bội chưa mặc' };
  if (S.gold < fuseCost()) return { ok: false, msg: 'Không đủ ngân lượng' };
  const sum = items.reduce((t, i) => t + (i.lvl || 1), 0), [dmin, dmax] = RCP_R.violet_fuse.level_div;
  const lvl = clamp(rcInt(Math.max(1, Math.floor(sum / dmin)), Math.max(1, Math.floor(sum / dmax))), 1, HT_MAX);
  S.gold -= fuseCost();
  for (const i of items) itemRemove(i);
  matAdd('ht', lvl);
  return { ok: true, lvl, msg: `Hợp thành Huyền Tinh Khoáng Thạch cấp ${lvl}` };
}
/* ---------- thang cap ---------- */
function upgradeHT(lvl) {
  if (lvl >= HT_MAX) return { ok: false, msg: 'Đã tối đa' };
  if (matHave('ht', lvl) < 3) return { ok: false, msg: 'Cần 3 viên cùng cấp' };
  if (S.gold < EP_COST.up) return { ok: false, msg: 'Không đủ ngân lượng' };
  S.gold -= EP_COST.up;
  if (rcFail(RCP_R.violet_up.fail)) { matAdd('ht', lvl, -1); return { ok: false, lost: true, msg: 'Thăng cấp thất bại, mất 1 viên Huyền Tinh' }; }   // JX1: that bai mat 1 vien
  matAdd('ht', lvl, -3);
  matAdd('ht', lvl + 1);
  return { ok: true, lvl: lvl + 1, msg: `Thăng cấp thành công: Huyền Tinh cấp ${lvl + 1}` };
}
function upgradeOre(key) {
  const o = oreParse(key);
  if (o.lvl >= ORE_MAX) return { ok: false, msg: 'Đã tối đa' };
  if (!matHave('ore', key)) return { ok: false, msg: 'Không có khoáng thạch' };
  matAdd('ore', key, -1);
  if (rcFail(RCP_R.ore_up.fail)) return { ok: false, lost: true, msg: 'Thăng cấp khoáng thất bại, khoáng vỡ' };
  matAdd('ore', oreKey(o.place, o.a, o.lvl + 1, o.s));
  return { ok: true, msg: `Khoáng thạch lên cấp ${o.lvl + 1}` };
}
/* ---------- kham ---------- */
const itemKind = it => it.d === 0 ? MELEE_KIND[it.k] : it.d === 1 ? RANGE_KIND[it.k] : AFFIX_KEY[DETAIL_SLOT[it.d]];
/* hang magicattriblevel cho thuoc tinh a: cap 1..n theo thu tu cap */
const oreRows = a => J.affixLevel.filter(r => r.a === a).sort((x, y) => x.lvl - y.lvl);
function enchaseCheck(it, htLvl, key) {
  if (!owned(it)) return 'Món không còn trong hành trang';
  if (!it || it.set || !(it.d >= 0 && it.d <= 9)) return 'Món này không khảm được';
  const o = oreParse(key), n = (it.mag || []).length;
  if (!it.vio) return 'Phải chế tạo phôi Huyền Tinh (trang bị Tím trống) trước';
  if (n >= vioSlots(it)) return `Đã đủ ${vioSlots(it)} dòng`;
  if (o.place !== n) return `Khoáng này ứng dòng ${o.place + 1}, món đang cần dòng ${n + 1}`;
  if (matHave('ht', htLvl) < 1) return 'Không có Huyền Tinh cấp này';
  if (matHave('ore', key) < 1) return 'Không có khoáng thạch này';
  const rows = oreRows(o.a); if (!rows.length) return 'Khoáng không hợp lệ';
  if ((it.mag || []).some(m => m.a === o.a)) return `Món đã có dòng ${rows[0].n}`;
  const row = rows[clamp(Math.floor((htLvl + o.lvl) / 2) + (EP_AUX.on && auxHave() ? 1 : 0), 1, rows.length) - 1];
  if (row.s >= 0 && row.s !== it.s) return `Khoáng hệ ${SERIES[row.s]}, món hệ ${SERIES[it.s]}`;
  if (o.s >= 0 && o.s !== it.s) return `Nguyên Thạch hệ ${SERIES[o.s]}, món hệ ${SERIES[it.s]} (dòng ẩn phải đúng hệ)`;
  if (S.gold < EP_COST.kham) return 'Không đủ ngân lượng (10.000)';
  if (!((row.w || {})[itemKind(it)] > 0)) return 'Thuộc tính này không gắn được vào loại trang bị này';
  return row;
}
function enchase(it, htLvl, key) {
  const row = enchaseCheck(it, htLvl, key);
  if (typeof row === 'string') return { ok: false, msg: row };
  const aux = EP_AUX.on && auxUse(), rate = khamRate(htLvl, aux);
  matAdd('ht', htLvl, -1); matAdd('ore', key, -1); S.gold -= EP_COST.kham;
  if (rcInt(0, 99) >= rate) return { ok: false, lost: true, msg: `Khảm thất bại (${rate}% thành công): mất Huyền Tinh và ${oreStoneName(key)}` };
  const place = it.mag.length;
  const p = row.p.map(([mn, mx]) => mn === -1 && mx === -1 ? -1 : rcInt(Math.min(mn, mx), Math.max(mn, mx)));
  it.mag.push({ a: row.a, p, n: row.n, pre: place % 2 === 0 ? 1 : 0, vlv: oreParse(key).lvl, vs: oreParse(key).s });
  it.vio = 1; it.r = 3;
  if (typeof betterThanEquipped === 'function' && S.autoEquip && S.inv.includes(it) && betterThanEquipped(it)) equip(it, true);   // du dong de manh hon do dang mac thi tu mac
  return { ok: true, msg: `Khảm dòng ${place + 1}: ${row.n}` };
}
/* ---------- do Tim: xem truoc / tu khaam het / tach dong (nhu JX1: do Tim chi tao bang khaam, khong roi tu quai) ---------- */
const EP_AUX = { on: false };                // dung phu lieu (Thuy Tinh / Phuc Duyen) - chon o Lo Ep Do
const khamRate = (ht, aux) => Math.min(98, 70 + 3 * ht + (aux ? 15 : 0));
const vioOk = it => verVio() && !!it && !it.set && it.d >= 0 && it.d <= 9 && !!it.vio && (it.mag || []).length < vioSlots(it);
/* Gia tri dong se khaam: hang magicattriblevel (cap Huyen Tinh + cap khoang) / 2, khoang gia tri min..max */
function vioPreview(it, ht, key) {
  const row = enchaseCheck(it, ht, key); if (typeof row === 'string') return { err: row };
  const one = f => row.p.map(([mn, mx]) => (mn === -1 && mx === -1 ? 0 : f(Math.min(mn, mx), Math.max(mn, mx))));
  const name = attrName(row.a), place = it.mag.length;
  const mag = it.mag.concat([{ a: row.a, p: one((a, b) => Math.round((a + b) / 2)), pre: place % 2 === 0 ? 1 : 0 }]);
  const lo = attrText(name, one(a => a)), hi = attrText(name, one((a, b) => b));
  return { row, ht, key, txt: lo === hi ? lo : `${lo} ~ ${one((a, b) => b)[0]}`, gain: typeof magPowerDelta === 'function' ? magPowerDelta(it, mag) : 0 };
}
/* Moi loai khoang dung duoc cho dong ke tiep: chon Huyen Tinh cap cao nhat khaam duoc (hang thuoc tinh cao hon) */
function vioOptions(it) {
  if (!vioOk(it)) return [];
  const n = it.mag.length, hts = Object.keys(mats().ht).map(Number).sort((a, b) => b - a), out = [];
  for (const key of Object.keys(mats().ore)) {
    if (oreParse(key).place !== n) continue;
    for (const ht of hts) { const p = vioPreview(it, ht, key); if (!p.err) { out.push(p); break; } }
  }
  return out.sort((a, b) => b.gain - a.gain);
}
/* Khaam lien tuc toi du 6 dong, moi dong chon khoang tang luc chien nhieu nhat */
function vioFillAll(it) {
  let ok = 0, fail = 0;
  while (vioOk(it)) { const o = vioOptions(it)[0]; if (!o) break; const r = enchase(it, o.ht, o.key); if (r.ok) ok++; else if (r.lost) fail++; else break; }
  return { ok: ok > 0, msg: ok || fail ? `Khảm ${ok} dòng${fail ? `, ${fail} lần thất bại` : ''} · ${(it.mag || []).length}/${vioSlots(it)} dòng` : 'Không đủ Huyền Tinh / khoáng thạch hợp dòng kế tiếp' };
}
/* Tach dong cuoi cua do Tim: tra lai khoang thach (cung cap), Huyen Tinh mat; het dong -> lai la do trang */
const vioTakeCost = it => Math.round((1500 + it.lvl * 1200) * (1 + S.lvl / 20));
function vioTake(it) {
  if (!owned(it) || !it.vio || !(it.mag || []).length) return { ok: false, msg: 'Chỉ tách được đồ Tím' };
  const c = vioTakeCost(it); if (S.gold < c) return { ok: false, msg: 'Không đủ ngân lượng' };
  S.gold -= c; const m = it.mag.pop(), place = it.mag.length;
  matAdd('ore', oreKey(place, m.a, m.vlv || 1, m.vs != null ? m.vs : (place % 2 ? it.s : -1)));
  if (!it.vslots) it.vslots = VIO_SLOTS;          // tach het dong: van la phoi Huyen Tinh trong
  R.dirty = true;
  return { ok: true, msg: `Tách dòng ${place + 1}: nhận lại khoáng ${attrName(m.a) ? (oreRows(m.a)[0] || {}).n || '' : ''} cấp ${m.vlv || 1}` };
}
/* Ban phoi Tim da tach het dong */
const vioSellOk = it => !!it && it.vio && !(it.mag || []).length && ownedInv(it) && !it.lock;
function vioSell(it) {
  if (!vioSellOk(it)) return { ok: false, msg: it && it.lock ? 'Món đã khóa: mở khóa trước khi bán' : 'Chỉ bán được phôi Tím đã tách hết dòng (không đang mặc)' };
  const v = itemValue(it); itemRemove(it); S.gold += v; R.dirty = true; invDirty = true;
  return { ok: true, sold: true, msg: `Bán ${it.n}: +${fmt(v)} lượng` };
}
/* ---------- HUT PHOI (nhu JX1): hut 1 dong cua do xanh / vang thanh khoang thach (phoi) dung de ep do Tim ----------
   - Mon nguon (khong bo, khong Tim, khong khoa, khong dang mac) bi tieu huy. Thanh cong 90%, that bai mat mon, khong ra khoang.
   - Khoang ra dung thuoc tinh cua dong; cap khoang = cap dong (hang magicattriblevel chua gia tri dong do, toi thieu 1).
   - Dong hien (tien to) -> khoang dong 1 / 3 / 5; dong an (hau to) -> dong 2 / 4 / 6 (nguoi choi chon vi tri). */
const canHut = it => verVio() && ownedInv(it) && !it.set && !it.vio && !it.lock && !it.thanma && it.d >= 0 && it.d <= 9 && (it.mag || []).length > 0 && !Object.values(S.eq).includes(it);
const hutCost = () => EP_COST.hut;
function hutLevel(m) {
  const rows = oreRows(m.a); if (!rows.length) return 1;
  const v = Math.abs(m.p[0] || 0); let best = rows[0];
  for (const r of rows) { const lo = Math.min(Math.abs(r.p[0][0]), Math.abs(r.p[0][1])); if (v >= lo) best = r; }
  return clamp(best.lvl || 1, 1, ORE_MAX);
}
const hutPlaces = (it, i) => {   // chi lay dung vi tri dong tren trang bi (dong 1 -> da dong 1); lech hien / an thi lay dong ke ben dung loai
  const pre = it.mag[i].pre != null ? it.mag[i].pre : (i % 2 === 0 ? 1 : 0); let p = Math.min(i, VIO_SLOTS - 1);
  if ((p % 2 === 0) !== !!pre) p = p + 1 < VIO_SLOTS ? p + 1 : p - 1;
  return [p];
};
const hutRate = (ht, aux) => Math.min(98, 60 + 5 * ht + (aux ? 15 : 0));
const hutOreLvl = (m, ht) => clamp(hutLevel(m) + Math.floor(((ht || 1) - 1) / 4), 1, ORE_MAX);   // Huyen Tinh cap cao: da tot hon (cap 5 +1, cap 9 +2)
function hutPhoi(it, i, place, ht) {
  if (!canHut(it)) return { ok: false, msg: 'Chỉ hút được đồ xanh trong hành trang (chưa khóa, không phải đồ bộ / Tím)' };
  const m = (it.mag || [])[i]; if (!m) return { ok: false, msg: 'Dòng không tồn tại' };
  if (!oreRows(m.a).length) return { ok: false, msg: 'Dòng này không hút được thành khoáng' };
  if (!hutPlaces(it, i).includes(place)) return { ok: false, msg: 'Chỉ lấy được đúng vị trí dòng trên trang bị' };
  ht = ht || Object.keys(mats().ht).map(Number).sort((a, b) => a - b)[0];
  if (!ht || matHave('ht', ht) < 1) return { ok: false, msg: 'Cần 1 Huyền Tinh Khoáng Thạch' };
  const c = hutCost(it); if (S.gold < c) return { ok: false, msg: 'Không đủ ngân lượng' };
  const aux = EP_AUX.on && auxUse(), rate = hutRate(ht, aux);
  S.gold -= c; matAdd('ht', ht, -1); itemRemove(it);
  if (rcRand() * 100 >= rate) return { ok: false, lost: true, msg: `Lấy thuộc tính thất bại (${rate}%): ${it.n} vỡ, mất Huyền Tinh` };
  const lvl = hutOreLvl(m, ht), key = oreKey(place, m.a, lvl, place % 2 ? it.s : -1); matAdd('ore', key);
  return { ok: true, lvl, msg: `Lấy thuộc tính: ${(oreRows(m.a)[0] || {}).n || attrName(m.a)} → ${oreStoneName(key)} cấp ${lvl}` };
}
/* ---------- CHE TAO PHOI HUYEN TINH (trang bi Tim trong): do trang / xanh + 1 Huyen Tinh + 10.000 luong ----------
   So khung (dong) theo cap Huyen Tinh (huong dan JX1: Huyen Tinh cap 3 ~90% ra 5 dong; game nay toi da 6). Dong xanh cu bi xoa. */
const PHOI_ODDS = ht => ht <= 1 ? [[3, 100]] : ht === 2 ? [[4, 100]] : ht === 3 ? [[5, 90], [4, 10]] : [[6, Math.min(90, (ht - 3) * 20)], [5, 100]];
function phoiRoll(ht) { const r = rcInt(0, 99); let acc = 0; for (const [n, p] of PHOI_ODDS(ht)) { acc += p; if (r < acc) return n; } return PHOI_ODDS(ht).slice(-1)[0][0]; }
const VIO_D = [0, 1, 2, 5, 6, 7, 8];   // do Tim chi o trang bi: vu khi, ao, giay, dai, mu, ho uyen (khong trang suc)
const canPhoi = it => verVio() && ownedInv(it) && !it.set && !it.vio && !it.lock && !it.thanma && VIO_D.includes(it.d) && (it.r || 0) <= 2 && !Object.values(S.eq).includes(it);
function makePhoi(it, ht) {
  if (!canPhoi(it)) return { ok: false, msg: 'Chỉ chế tạo từ trang bị trắng / xanh (không phải trang sức, chưa khóa, không phải đồ bộ / Tím)' };
  if (!ht || matHave('ht', ht) < 1) return { ok: false, msg: 'Cần 1 Huyền Tinh Khoáng Thạch' };
  if (S.gold < EP_COST.phoi) return { ok: false, msg: 'Không đủ ngân lượng (10.000)' };
  S.gold -= EP_COST.phoi; matAdd('ht', ht, -1);
  const n = phoiRoll(ht); it.mag = []; it.vio = 1; it.r = 3; it.vslots = n; delete it.leg; R.dirty = true;
  return { ok: true, n, msg: `Chế tạo phôi Huyền Tinh: ${it.n} · ${n} dòng trống` };
}
/* Do Tim cu bi trung dong (truoc ban 34): giu tu dong 1 toi truoc dong trung dau tien, tra lai da cac dong bi bo */
function vioDedup(it, refund = true) {
  if (!it || !it.vio || !(it.mag || []).length) return 0;
  const seen = new Set(); let cut = -1;
  for (let i = 0; i < it.mag.length; i++) { if (seen.has(it.mag[i].a)) { cut = i; break; } seen.add(it.mag[i].a); }
  if (cut < 0) return 0;
  const gone = it.mag.splice(cut);
  if (refund) gone.forEach((m, j) => { const place = cut + j; matAdd('ore', oreKey(place, m.a, m.vlv || 1, m.vs != null ? m.vs : (place % 2 ? it.s : -1))); });
  if (!it.vslots) it.vslots = VIO_SLOTS;
  return gone.length;
}
/* ---------- khoang roi ---------- */
const orePool = place => [...new Set(J.affixLevel.filter(r => r.pre === (place % 2 === 0 ? 1 : 0) && r.lvl === 1).map(r => r.a))];
/* ty le roi (tinh chinh bang tools/sim_craft.py: moi gio choi ~ 4 khoang + 5 Huyen Tinh) */
const DROP = { ore: { boss: 0.30, elite: 0.045, normal: 0.0045 }, ht: { boss: 0.65, elite: 0.12, normal: 0.015 },   // ban 73: do Tim la do chinh -> khoang / Huyen Tinh x1.5
    // x3 (ban 36): 1 mon Tim can ~13 Huyen Tinh (che phoi + lay + kham)
  shard: { boss: 0.06, elite: 0.009, normal: 0.0003 }, wc: { boss: 0.12, elite: 0.015, normal: 0.001 }, mys: { boss: 0.12, elite: 0.015, normal: 0.001 } };
const dropP = (k, e) => (DROP[k][e.cls] ?? DROP[k].normal) * dropMul() * densK(e) * ((k === 'ore' || k === 'ht') && typeof boatDropMul === 'function' ? boatDropMul() : 1);   // thuyen Phong Lang Do: x5
function oreDrop(e) {
  const out = [];
  if (!verVio()) return null;                                   // phien ban 1: chua co do Tim
  if (Math.random() < dropP('ore', e)) {
    // khoang roi ra phai dung duoc cho it nhat mot mon dang mac (cung he, cung loai trang bi): tranh khoang vo dung do rang buoc he / loai
    // ban 73: 70% khoang dung dong ke tiep cua phoi Tim dang kham (dung loai do, dung he, chua co thuoc tinh do) -> do Tim tien trien deu
    const ph = typeof enchaseTargets === 'function' && rcRand() < 0.7 ? enchaseTargets()[0] : null;
    const place = ph ? ph.mag.length : rcInt(0, VIO_SLOTS - 1), worn = Object.values(S.eq).filter(it => it && it.d <= 9), tgt = ph || (worn.length ? pick(worn) : null);
    const has = new Set(ph ? ph.mag.map(m => m.a) : []);
    const fit = tgt ? J.affixLevel.filter(r => r.lvl === 1 && r.pre === (place % 2 === 0 ? 1 : 0) && (r.s < 0 || r.s === tgt.s) && ((r.w || {})[itemKind(tgt)] > 0) && !has.has(r.a)).map(r => r.a) : [];
    const lvl = clamp(Math.floor(e.L / 12) + rcInt(0, 1), 1, ORE_MAX);
    const a = ph && fit.length ? bestOreAttr(ph, place, [...new Set(fit)], lvl) : fit.length ? pick([...new Set(fit)]) : pick(orePool(place));
    const key = oreKey(place, a, lvl, place % 2 ? (tgt ? tgt.s : rcInt(0, 4)) : -1); matAdd('ore', key); out.push(`${oreStoneName(key)} cấp ${lvl}`);
  }
  if (Math.random() < dropP('ht', e)) { const l = clamp(Math.floor(e.L / 15) + 1, 1, HT_MAX); matAdd('ht', l); out.push(`Huyền Tinh Khoáng Thạch cấp ${l}`); }
  if (Math.random() < (PHOI_DROP[e.cls] || 0) * dropMul()) if (S.inv.concat(epBox()).filter(x => x.vio && !(x.mag || []).length).length >= 4) { const l = clamp(Math.floor(e.L / 15) + 1, 1, HT_MAX); matAdd('ht', l); out.push(`Huyền Tinh Khoáng Thạch cấp ${l}`); } else { const it = phoiFromDrop(e.L); if (it) { (epBox().length < (typeof EP_BOX_MAX === 'number' ? EP_BOX_MAX : 120) || S.inv.length >= INV_MAX ? epBox() : S.inv).push(it); invDirty = true; out.push(`Phôi Tím ${it.n} (${it.vslots} dòng)`); } }
  return out.length ? out.join(', ') : null;
}
/* Chon thuoc tinh khoang cho phoi dang kham: thu toi da 12 thuoc tinh hop le, lay cai tang luc chien nhieu nhat (dung phai) */
function bestOreAttr(ph, place, cands, lvl) {
  const hts = Object.keys(mats().ht).map(Number), ht = hts.length ? Math.max(...hts) : lvl, slot = slotFor(ph), eq = Object.assign({}, S.eq, { [slot]: ph });
  let best = pick(cands), bv = -1; const keep = IGNORE_REQ; IGNORE_REQ = ph;
  try {
    for (const a of cands.sort(() => rcRand() - 0.5).slice(0, 12)) {
      const rows = oreRows(a); if (!rows.length) continue;
      const row = rows[clamp(Math.floor((ht + lvl) / 2), 1, rows.length) - 1];
      if ((row.s >= 0 && row.s !== ph.s) || !((row.w || {})[itemKind(ph)] > 0)) continue;
      ph.mag.push({ a: row.a, p: row.p.map(([mn, mx]) => mn === -1 && mx === -1 ? -1 : (mn + mx) / 2), pre: place % 2 === 0 ? 1 : 0 });
      const v = power(calc(eq)); ph.mag.pop();
      if (v > bv) { bv = v; best = a; }
    }
  } finally { IGNORE_REQ = keep; }
  return best;
}
/* Phoi Tim roi thang (ban 73): Trum / tinh anh roi phoi Huyen Tinh trong (so dong theo cap quai); 25% la vu khi dung phai */
const PHOI_DROP = { boss: 0.08, elite: 0.008, normal: 0 };   // da co 4 phoi trong chua kham -> roi Huyen Tinh thay
function phoiFromDrop(L) {
  const tier = clamp(Math.round(L / 12), 1, 10), f = FAC[S.fac];   // bac do ngang do dang dung -> mac duoc
  let it = null;
  for (let g = 0; g < 6 && (!it || !reqOk(it)); g++) { it = null;
  if (f && !f.novice && rcRand() < 0.25) { const dp = wantWeaponDP(); it = makeItem(dp[0], dp[1], tier, 0); }
  if (!it) { const d = VIO_D[rcInt(2, VIO_D.length - 1)]; it = makeItem(d, sexPart(d, 0), tier, 0); } }   // thu toi 6 lan lay mon mac duoc (du suc / than phap...)
  if (!it) return null;
  it.mag = []; it.vio = 1; it.r = 3; it.vslots = phoiRoll(clamp(Math.floor(L / 25) + 1, 1, 6)); delete it.leg; R.dirty = true;
  return it;
}

/* ======================= MANH HOANG KIM (questkey.txt "Manh <ten> (k/N)", N = 9 / 6 / 4) ======================= */
const SHARDS = window.RCP.shards;
const shardRows = (() => { const m = new Map(); for (const r of J.sets.gold) if (SHARDS[r.n] && !r.fixed && !m.has(r.n)) m.set(r.n, r); return m; })();
const reqOfRow = (r, id) => (r.req.find(q => q[0] === id) || [0, -1])[1];
function shardDrop(e, force) {
  if (!force && Math.random() >= dropP('shard', e) * goldMul('shard')) return null;
  const cap = Math.max(S.lvl, e.L) + 10, fid = FAC[S.fac] ? FAC[S.fac].id : -1;
  let pool = [...shardRows.values()].filter(r => reqOfRow(r, 36) <= cap && sexReqOk(r.req) && setVerOk(r, Math.max(S.lvl, e.L)));
  // da co manh do dang gom: 75% roi tiep manh cua mon do (tranh gom nua chung khong bao gio du bo)
  const part = pool.filter(r => matHave('shard', r.n) > 0 && matHave('shard', r.n) < SHARDS[r.n]);
  if (part.length && Math.random() < 0.75) pool = part;
  else { const mine = pool.filter(r => reqOfRow(r, 39) === fid); if (mine.length && Math.random() < 0.7) pool = mine; }
  if (!pool.length) return null;
  const r = pick(part.length && pool === part ? part.sort((a, b) => matHave('shard', b.n) - matHave('shard', a.n)).slice(0, 2) : pool); matAdd('shard', r.n); return `Mảnh ${r.n} (${matHave('shard', r.n)}/${SHARDS[r.n]})`;
}
function combineShards(name) {
  const need = SHARDS[name], row = shardRows.get(name);
  if (!need || !row) return { ok: false, msg: 'Mảnh không hợp lệ' };
  if (matHave('shard', name) < need) return { ok: false, msg: `Cần ${need} mảnh` };
  if (S.inv.length >= INV_MAX) return { ok: false, msg: 'Hành trang đầy' };
  matAdd('shard', name, -need);
  const it = makeSetItem('gold', row, 0); S.inv.push(it);
  return { ok: true, item: it, msg: `Ghép thành ${it.n}` };
}

/* ======================= BACH KIM: CHE +0 VA THANG CAP 1..10 (bang CLAUDE.md, nhan Cong dong) =======================
   Phi tinh theo "van" (1 van = 10.000 luong, Uoc luong) nhan he so kinh te idle PLAT_COST_SCALE (Uoc luong). */
const PLAT_MAKE = RCP_R['platina_make:0'], PLAT_UP = [...Array(10)].map((_, i) => RCP_R['platina_up:' + (i + 1)]);
const PLAT_COST_SCALE = 0.03, VAN = 10000, PLAT_MAX = 10;
const platCost = van => Math.round(van * VAN * PLAT_COST_SCALE);
const platByBase = (() => { const m = new Map(); const gFixed = new Set(J.sets.gold.filter(r => r.fixed).map(r => r.n)); for (const r of J.sets.platina) { if (r.fixed || gFixed.has(r.n.replace(/^\[[^\]]*\]\s*/, ''))) continue; const b = r.n.replace(/^\[[^\]]*\]\s*/, ''); (m.get(b) || m.set(b, []).get(b)).push(r); } return m; })();
/* Mon chinh: Hoang Kim co ban Bach Kim, trong tui HOAC dang mac. Mon phu: Hoang Kim TRUNG TEN trong tui (khong mac, khong khoa),
   tu chon - khong phai bam chon tung mon. */
const canPlatBase = it => owned(it) && it.set && it.set.kind === 'gold' && platByBase.has(it.n);
const canPlatFiller = it => ownedInv(it) && it.set && it.set.kind === 'gold' && !it.lock && !Object.values(S.eq).includes(it);
const PLAT_PREF = ['Thiên Tứ', 'Hoàn Mỹ', 'Cực phẩm', 'Tinh Chế', 'Tinh Xảo'];
/* Bien the Bach Kim nhan duoc: uu tien [Thien Tu], bo ten loi ma hoa */
function platResult(name) {
  const rows = platByBase.get(name) || [], pre = r => (r.n.match(/^\[([^\]]*)\]/) || [])[1] || '';
  const clean = rows.filter(r => /^[\p{L}\p{N}\s\[\]'·-]+$/u.test(r.n) && !/[一-鿿]/.test(r.n));
  for (const p of PLAT_PREF) { const r = clean.find(x => pre(x) === p); if (r) return r; }
  return clean[0] || rows[0] || null;
}
/* Tu chon mon phu: Hoang Kim trung ten, lay mon yeu nhat */
function platFiller(main) {
  const pool = S.inv.filter(x => x !== main && x.n === main.n && canPlatFiller(x)); if (!pool.length) return null;
  return pool.sort((a, b) => itemPower(a) - itemPower(b))[0];
}
const platLockedTwin = main => S.inv.some(x => x !== main && x.n === main.n && x.set && x.set.kind === 'gold' && x.lock);
function platReady(main) {
  const need = PLAT_MAKE.inputs, cost = platCost(PLAT_MAKE.cost.van);
  if (!verPlat()) return 'Chưa mở';
  if (!canPlatBase(main)) return 'Không phải Hoàng Kim chế được Bạch Kim';
  if (!platFiller(main)) return platLockedTwin(main) ? 'Món trùng tên đang khóa 🔒: mở khóa để làm món phụ' : 'Cần thêm 1 món trùng tên trong hành trang (không mặc)';
  if (S.gold < cost) return 'Không đủ ngân lượng';
  if (matHave('misc', 'wc') < need[1].qty || matHave('misc', 'mys') < need[2].qty) return 'Thiếu Thủy Tinh Trắng / Thần Bí Khoáng Thạch';
  return '';
}
function makePlatina(a, b) {
  b = b || platFiller(a);
  const why = platReady(a); if (why) return { ok: false, msg: why };
  if (!b || b === a || b.n !== a.n || !canPlatFiller(b)) return { ok: false, msg: 'Cần 2 món Hoàng Kim trùng tên' };
  const need = PLAT_MAKE.inputs, cost = platCost(PLAT_MAKE.cost.van);
  S.gold -= cost; matAdd('misc', 'wc', -need[1].qty); matAdd('misc', 'mys', -need[2].qty);
  if (rcInt(0, 99) >= PLAT_MAKE.rate) return { ok: false, lost: true, msg: `Chế Bạch Kim thất bại (${100 - PLAT_MAKE.rate}%): mất nguyên liệu, Hoàng Kim giữ lại` };
  const it = makeSetItem('platina', platResult(a.n), 10); it.plv = 0; if (a.enh) it.enh = a.enh;
  S.inv.splice(S.inv.indexOf(b), 1);
  const slot = slotOfEquipped(a, S.eq);
  if (slot) S.eq[slot] = it; else S.inv.splice(S.inv.indexOf(a), 1, it);
  if (typeof recItem === 'function') recItem(it);
  return { ok: true, item: it, msg: `Chế thành ${it.n}${slot ? ' (đã mặc)' : ''}` };
}
/* Che lien tuc toi khi thanh cong hoac het nguyen lieu / ngan luong */
function makePlatinaUntil(a) {
  let tries = 0, r = null;
  while (tries < 50 && !platReady(a)) { tries++; r = makePlatina(a); if (r.ok) break; }
  if (!r) return { ok: false, msg: platReady(a) };
  return Object.assign({}, r, { msg: `${r.msg} · ${tries} lần thử` });
}
function upgradePlatina(it) {
  if (!owned(it) || !it.set || it.set.kind !== 'platina') return { ok: false, msg: 'Chỉ thăng cấp đồ Bạch Kim đang có' };
  const lv = it.plv || 0; if (lv >= PLAT_MAX) return { ok: false, msg: 'Đã tối đa +10' };
  const u = PLAT_UP[lv], cost = platCost(u.cost.van);
  if (S.gold < cost) return { ok: false, msg: 'Không đủ ngân lượng' };
  if (matHave('misc', 'wc') < u.inputs[0].qty || matHave('misc', 'mys') < u.inputs[1].qty) return { ok: false, msg: 'Thiếu Thủy Tinh Trắng / Thần Bí Khoáng Thạch' };
  S.gold -= cost; matAdd('misc', 'wc', -u.inputs[0].qty); matAdd('misc', 'mys', -u.inputs[1].qty);
  if (rcInt(0, 99) >= u.rate) return { ok: false, lost: true, msg: `Thăng cấp thất bại (${100 - u.rate}%), giữ +${lv}` };
  it.plv = lv + 1; return { ok: true, msg: `Thăng cấp thành công: +${it.plv}` };
}
function platDrop(e) {
  if (!verPlat()) return null;
  if (e.L < 60 && e.cls !== 'boss') return null;
  const out = [];
  if (Math.random() < dropP('wc', e)) { const n = rcInt(1, 2); matAdd('misc', 'wc', n); out.push(`${n} Thủy Tinh Trắng`); }
  if (Math.random() < dropP('mys', e)) { const n = rcInt(1, 3); matAdd('misc', 'mys', n); out.push(`${n} Thần Bí Khoáng Thạch`); }
  return out.length ? out.join(', ') : null;
}
const allDrops = e => [oreDrop(e), shardDrop(e), platDrop(e)].filter(Boolean);
