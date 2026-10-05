/* ======================= TU DONG REN DO (giam so lan bam) =======================
   Bat o the Khac (S.autoForge, mac dinh TAT). Chay moi 30 giay choi va khi vao lai game, dung dung ham ren thu cong (recipes.js)
   nen giu nguyen luat, ti le va rui ro. Thu tu: ghep manh Hoang Kim -> kham Tim vao do dang thieu dong -> hop Huyen Tinh tu do thua
   -> thang cap Huyen Tinh du 3 vien. Khong dung nguyen lieu cua Bach Kim, khong thang cap khoang (rui ro vo). */
'use strict';
const AUTO_FORGE_MAX = { fuse: 5, ench: 6, up: 8 };
function enchaseTargets() {
  const worn = Object.values(S.eq).filter(Boolean), pool = worn.concat(S.inv, epBox());
  const useful = it => { const w = worn.find(x => x.d === it.d); return !w || (!w.set && it.lvl >= w.lvl) ? 1 : 0; };   // phoi thay duoc do dang mac (khong de Hoang Kim)
  return pool.filter(it => !it.set && it.d >= 0 && it.d <= 9 && it.vio && (it.mag || []).length < vioSlots(it) && (worn.includes(it) || reqOk(it)))
    .sort((a, b) => (worn.includes(b) - worn.includes(a)) || (useful(b) - useful(a)) || (b.mag.length - a.mag.length) || (b.lvl - a.lvl));
}
/* Tim mot cap (mon, cap Huyen Tinh, khoang) kham duoc ngay, hoac null */
function findEnchase() {
  const hts = Object.keys(mats().ht).map(Number).sort((a, b) => b - a), ores = Object.keys(mats().ore);
  if (!hts.length || !ores.length) return null;
  for (const it of enchaseTargets()) {
    const n = it.mag.length;
    for (const key of ores) {
      if (oreParse(key).place !== n) continue;
      for (const ht of hts) if (typeof enchaseCheck(it, ht, key) !== 'string') return { it, ht, key };
    }
  }
  return null;
}
const forgeReadyCounts = () => ({
  shard: Object.keys(mats().shard).filter(n => SHARDS[n] && matHave('shard', n) >= SHARDS[n]).length,
  up: Object.keys(mats().ht).map(Number).filter(l => l < HT_MAX && matHave('ht', l) >= 3).length,
  ench: findEnchase() ? 1 : 0,
  fuse: fusePool().length >= 3 && S.gold >= fuseCost() * 2 ? 1 : 0,
});
/* TU HOP HUYEN TINH (S.autoFuse, mac dinh BAT, tat o the Lo ren): moi 30 giay hop trang suc thua (nhan / day chuyen / ngoc boi
   trong tui + Ruong ep; khong manh hon do dang mac, khong khoa, khong giu cho Da Tau) thanh Huyen Tinh, 3 mon yeu nhat moi lan. */
const AUTO_FUSE_MAX = 10;
function autoFuse(quiet) {
  if (!S || !S.fac || S.autoFuse === false || !verVio()) return 0;
  let n = 0; const got = {};
  for (let g = 0; g < AUTO_FUSE_MAX; g++) { const p = fusePool().slice(0, 3); if (p.length < 3 || S.gold < fuseCost() * 2) break; const r = fuse(p); if (!r.ok) break; n++; got[r.lvl] = (got[r.lvl] || 0) + 1; }
  if (n) { R.dirty = true; invDirty = true; if (!quiet) log(`<span class="dim">💎 Tự hợp ${n} Huyền Tinh từ trang sức (${Object.entries(got).map(([l, c]) => `${c} viên cấp ${l}`).join(', ')}).</span>`); }
  return n;
}
/* Do thua co the hop Huyen Tinh: nhan / day chuyen / ngoc boi trong tui, khong phai do manh hon do dang mac */
function fusePool() { return S.inv.concat(typeof epBox === 'function' ? epBox() : []).filter(canFuse).filter(x => !betterThanEquipped(x) && !dtNeed(x)).sort((a, b) => itemPower(a) - itemPower(b)); }
/* Tu che phoi Tim: chua co phoi dang kham do, co Huyen Tinh + ngan luong -> chon o dang mac do thuong (khong phai Tim / Hoang Kim)
   co mon cung loai cap >= trong tui / Ruong ep, che phoi tu mon do (Huyen Tinh cap cao nhat -> nhieu dong nhat) */
function autoPhoi() {
  if (enchaseTargets().length || S.gold < EP_COST.phoi * 3) return false;
  const hts = Object.keys(mats().ht).map(Number).filter(l => matHave('ht', l) > 0).sort((a, b) => b - a); if (!hts.length) return false;
  const f = FAC[S.fac];
  for (const w of Object.values(S.eq).filter(it => it && !it.vio && !it.set && it.d >= 0 && it.d <= 9).sort((a, b) => itemPower(a) - itemPower(b))) {
    const c = S.inv.concat(epBox()).filter(x => x.d === w.d && (x.d > 1 || x.k === w.k) && x.lvl >= w.lvl && !x.set && !x.vio && !x.lock && !x.thanma && (x.r || 0) <= 2 && !dtNeed(x) && reqOk(x)
      && !(DETAIL_SLOT[x.d] === 'weapon' && !weaponFits(x))).sort((a, b) => b.lvl - a.lvl)[0];
    if (!c) continue;
    if (!S.inv.includes(c)) { if (S.inv.length >= INV_MAX) continue; itemRemove(c); S.inv.push(c); }
    const r = makePhoi(c, hts[0]); if (r.ok) { invDirty = true; return true; }
  }
  return false;
}
function autoForge() {
  if (!S || !S.fac || !S.autoForge) return null;
  const st = { shard: 0, ench: 0, fuse: 0, up: 0, fail: 0, phoi: 0 };
  if (verVio() && autoPhoi()) st.phoi++;
  for (const x of epBox().slice()) if (x.vio && (x.mag || []).length >= vioSlots(x) && S.inv.length < INV_MAX) { itemRemove(x); S.inv.push(x); invDirty = true; }   // Tim da kham du: ra hanh trang de tu mac
  for (const n of Object.keys(mats().shard)) if (SHARDS[n] && matHave('shard', n) >= SHARDS[n] && S.inv.length < INV_MAX) { if (combineShards(n).ok) st.shard++; }
  for (let g = 0; verVio() && g < AUTO_FORGE_MAX.ench; g++) { const f = findEnchase(); if (!f) break; const r = enchase(f.it, f.ht, f.key); if (r.ok) st.ench++; else st.fail++; }
  for (let g = 0; verVio() && S.autoFuse === false && g < AUTO_FORGE_MAX.fuse; g++) { const p = fusePool().slice(0, 3); if (p.length < 3 || S.gold < fuseCost() * 2 || !fuse(p).ok) break; st.fuse++; }
  let ups = 0;
  for (let l = 1; l < HT_MAX; l++) while (matHave('ht', l) >= 3 && ups < AUTO_FORGE_MAX.up) { ups++; const r = upgradeHT(l); if (r.ok) st.up++; else st.fail++; }
  const parts = [];
  if (st.phoi) parts.push('chế phôi Tím');
  if (st.shard) parts.push(`ghép ${st.shard} món Hoàng Kim`);
  if (st.ench) parts.push(`khảm ${st.ench} dòng Tím`);
  if (st.fuse) parts.push(`hợp ${st.fuse} Huyền Tinh`);
  if (st.up) parts.push(`thăng cấp ${st.up} Huyền Tinh`);
  if (st.fail) parts.push(`${st.fail} lần thất bại`);
  if (parts.length) { R.dirty = true; invDirty = true; log(`<span class="dim">Tự rèn: ${parts.join(', ')}.</span>`); }
  return st;
}

/* ======================= TU MUA VU KHI O BIEN KINH =======================
   Vu khi roi rat it (3-5 mon / 20 phut dau) nen phai noi cong / doc (Ngu Doc, Con Lon...), co sat thuong chieu nhan theo bac vu khi (weaponTierMul),
   nhieu khi khong co vu khi moi trong khi ngan luong nam khong. Moi 30 giay choi: neu cua hang ban vu khi DUNG LOAI phai, du cap, du yeu cau
   (hoac thieu it va dang bat tu cong diem), manh hon vu khi tot nhat dang co it nhat 25% va gia khong qua 60% ngan luong -> mua va mac.
   Tat o the Khac (S.autoBuy). Khong mua khi dang co do tot hon trong tui. */
const AUTO_BUY_GAIN = 1.25, AUTO_BUY_BUDGET = 0.6;
function bestOwnedWeaponDmg() {
  const f = FAC[S.fac]; let best = 0;
  for (const it of S.inv.concat(S.eq.weapon ? [S.eq.weapon] : []))
    if (it.d <= 1 && sexOk(it) && (it.req || []).every(([id, v]) => id !== 36 || S.lvl >= v) && weaponFits(it)) best = Math.max(best, weaponDmg(it));   // tinh ca vu khi dang thieu diem tiem nang (da mua, cho cong diem): khong mua lai
  return best;
}
function autoBuyWeapon() {
  const f = FAC[S.fac]; if (!f || S.autoBuy === false || f.wcode < 0 || !J.shops.weapon) return null;
  if (S.inv.length >= INV_MAX) return null;
  const have = bestOwnedWeaponDmg(); let pick = null;
  for (const g of J.shops.weapon.items) {
    if (g.g === 1) continue;
    const it = goodsItem(g); if (!it || it.d > 1 || !weaponFits(it) || !sexOk(it)) continue;
    const price = shopPrice(g), dmg = weaponDmg(it);
    if (price > S.gold * AUTO_BUY_BUDGET || dmg < have * AUTO_BUY_GAIN) continue;
    const lv = (it.req.find(q => q[0] === 36) || [0, 0])[1]; if (lv > eqLevel()) continue;
    if ((it.req || []).some(([id, v]) => (id === 37 || id === 39) && v >= 0 && !reqOk(it))) continue;
    const need = Object.values(reqDeficit(it)).reduce((a, b) => a + b, 0);
    if (need > 0 && !(S.autoPts === true && need <= S.attrPts + PTS_PER_LEVEL * REQ_SAVE_LEVELS)) continue;
    if (!pick || dmg > pick.dmg) pick = { g, dmg, price, need };
  }
  if (!pick) return null;
  const it = makeItem(pick.g.d, pick.g.k, pick.g.lvl, 0); if (!it) return null;
  it.s = shopSeries(pick.g, it); S.gold -= pick.price;
  addItem(it, true, true, true);
  log(`<span class="dim">Tự mua <b>${esc(it.n)}</b> ở Biện Kinh (${fmt(pick.price)} lượng).</span>`);
  if (S.autoPts === true) autoSpendAttrs();
  autoEquipAll(); R.dirty = true; invDirty = true;
  return it;
}

/* ======================= TU RUT PHOI (lay thuoc tinh) THONG MINH =======================
   Mon xanh / vang khong duoc bo loc thong minh giu -> rut 1 dong ra da: uu tien dong phoi Tim dang can, roi dong cap cao.
   Khong dung do khoa / bo / Tim / dang mac / nop Da Tau / do nang cap; khong rut khi thieu tien du tru; khong don qua N vien cung loai. */
const AH_DEF = () => ({ on: false, minLv: 3, htMax: 4, cap: 3, reserve: 50000 });
function AH() { const a = S.autoHut || (S.autoHut = AH_DEF()); const d = AH_DEF(); for (const k in d) if (a[k] === undefined) a[k] = d[k]; return a; }
function ahNeeds() {   // vi tri dong ke tiep cua cac phoi Tim dang kham: [{place, s, kind}]
  return (typeof enchaseTargets === 'function' ? enchaseTargets() : []).slice(0, 3).map(t => ({ place: (t.mag || []).length, s: t.s, kind: itemKind(t), attrs: new Set((t.mag || []).map(m => m.a)) }));
}
function ahPick(it, cfg, needs) {   // -> { i, place, need, lvl } hoac null
  let best = null;
  for (let i = 0; i < (it.mag || []).length; i++) {
    const m = it.mag[i], rows = oreRows(m.a); if (!rows.length) continue;
    const place = hutPlaces(it, i)[0], lvl = hutLevel(m), s = place % 2 ? it.s : -1;
    const need = needs.some(n => n.place === place && (s < 0 || s === n.s) && !n.attrs.has(m.a) && rows.some(r => (r.w || {})[n.kind] > 0));
    if (!need && lvl < cfg.minLv) continue;
    if (matHave('ore', oreKey(place, m.a, lvl, s)) >= cfg.cap && !need) continue;
    const score = (need ? 1000 : 0) + lvl * 10 + (place % 2 ? 1 : 0);
    if (!best || score > best.score) best = { i, place, need, lvl, score };
  }
  return best;
}
function ahHt(need, cfg) {
  const have = Object.keys(mats().ht).map(Number).filter(l => l <= cfg.htMax && matHave('ht', l) > 0).sort((a, b) => a - b);
  if (!have.length) return 0;
  if (need) { const hi = have.filter(l => l >= 5); if (hi.length) return hi[0]; }   // dong dang can: Huyen Tinh c5+ cho da +1 cap
  return have[0];
}
function autoHut(max = 10) {
  if (!verVio() || R.dg) return 0;
  const cfg = AH(); if (!cfg.on) return 0;
  const needs = ahNeeds(), cand = epBox().concat(S.inv).filter(it => canHut(it) && !it.lock && !(typeof dtNeed === 'function' && dtNeed(it)) && !lootMatch(it));
  let n = 0, ok = 0, fail = 0, sold = 0, gold = 0; const got = [], htUsed = {};
  for (const it of cand) {
    if (n >= max || S.gold < cfg.reserve + hutCost(it)) break;
    const p = ahPick(it, cfg, needs);
    if (!p) { if (epBox().includes(it) && (it.r === 1 || it.r === 2)) { const v = itemValue(it); itemRemove(it); S.gold += v; gold += v; sold++; } continue; }   // khong dong nao dang rut: ban
    const ht = ahHt(p.need, cfg); if (!ht) break;
    const r = hutPhoi(it, p.i, p.place, ht); n++; htUsed[ht] = (htUsed[ht] || 0) + 1;
    if (r.ok) { ok++; got.push(r.msg.replace(/^Lấy thuộc tính: /, '') + ` (dòng ${p.place + 1})`); } else if (r.lost) fail++; else break;
  }
  if (n || sold) {
    const ht = Object.entries(htUsed).map(([l, c]) => `${c} Huyền Tinh c${l}`).join(', ');
    log(`⚗ Tự rút ${n} món: ${ok} đá${got.length ? ` (${got.slice(0, 4).join('; ')}${got.length > 4 ? '…' : ''})` : ''}${fail ? `, ${fail} thất bại` : ''}${ht ? ` · −${ht}` : ''}${sold ? ` · bán ${sold} món không có dòng tốt (+${fmt(gold)} lượng)` : ''}`);
    invDirty = true; R.dirty = true; save();
  }
  return n;
}
