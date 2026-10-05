/* ======================= HOAT DONG GIANG HO KIEU JX1: DA TAU + SAT THU DUONG =======================
   Da Tau (tu cap 20): chuoi nhiem vu lap lai - ha N quai / ha N con quai chi dinh / ha tinh anh / ha trum / nop ngan luong /
     nop 1 trang bi. Moi nhiem vu: kinh nghiem (% cap, tang theo chuoi lien tiep), ngan luong, Phuc Duyen. Moc chuoi: 5 -> Lenh Bai
     Sat Thu, 10 -> ruong do, 20 -> Mat Tich 90 (du cap; chua du cap thi do Hoang Kim), 50 / 100 -> do Hoang Kim.
     Huy nhiem vu: mat chuoi. Toi da DT_DAY nhiem vu / ngay. Che do tu dong: tu tra / nhan nhiem vu (nop tien, nop do thua).
   Sat Thu Duong: dung 1 Lenh Bai Sat Thu (3 lenh bai mien phi / ngay) goi Sat Thu cap 20..90 (nhu JX1) cung 2 ho ve ngay tai bai
     luyen cong, ha trong ST_TIME giay. Thuong: kinh nghiem, Thuy Tinh Trang, Than Bi Khoang Thach, Huyen Tinh, do 5 dong, co hoi Mat Tich.
   Trum cap cao (ke ca pho ban, Hoang Kim) roi Mat Tich 90 va Lenh Bai Sat Thu. */
'use strict';
const MISC_N = Object.assign({ wc: 'Thủy Tinh Trắng', mys: 'Thần Bí Khoáng Thạch', lb: 'Lệnh Bài Sát Thủ', dtbk: 'Đại Thành Bí Kíp', ldp: 'Lệnh Bài Đổi Phái', ldt: 'Lệnh Bài Dã Tẩu', dgt: 'Thẻ Đổi Giới Tính' }, BOOK_N);
const miscName = k => MISC_N[k] || k;
/* ---------- Da Tau ---------- */
const DT_LV = 20, DT_DAY = 40, DT_LDT = 20;   // Lenh Bai Da Tau (Ky Tran Cac): +20 luot hom nay
const DT_HK = 2000;   // moi 2000 nhiem vu (tong): 1 mon Hoang Kim Mon Phai chac chan; 1000 (le): Hoang Kim dung chung; 500: Dai Thanh Bi Kip
/* moc chuoi lien tiep (lap lai): [moc, thuong, mo ta] */
const DT_CHAIN = [[20, 'Lệnh Bài Sát Thủ + 1 đá thuộc tính'], [50, 'rương đồ 5 dòng + 3 Huyền Tinh + 5 Phúc Duyên'], [100, 'Phôi Tím + Quế Hoa Tửu 60 phút + 3 KNB + 10 Phúc Duyên'],
  [200, 'Mật Tịch 90 (chưa đủ cấp 75: Tiên Thảo Lộ 60 phút)'], [500, 'Thần Mã / ngựa hiếm + Thủy Tinh Trắng + Thần Bí Khoáng Thạch + đồ 6 dòng + 5 KNB + 20 Phúc Duyên']];
const DT_TOTAL = [[DT_HK, 'Hoàng Kim Môn Phái'], [1000, 'Hoàng Kim dùng chung (Kim Phong, An Bang, Định Quốc…)'], [500, 'Đại Thành Bí Kíp']];
function DT() {
  const d = S.dt || (S.dt = {});
  if (d.n == null) Object.assign(d, { n: 0, chain: 0, best: 0, day: '', today: 0, task: null, auto: true });
  if (d.day !== today()) { d.day = today(); d.today = 0; d.extra = 0; }
  if (d.task && (d.task.t === 'item' || d.task.t === 'mat')) { d.task = null; setTimeout(() => { if (!DT().task) dtNew(); }, 0); }   // nhiem vu tim vat pham cu: doi nhiem vu khac, giu chuoi
  return d;
}
const dtMax = () => DT_DAY + (DT().extra || 0);
/* Lenh Bai Da Tau: them DT_LDT luot nhiem vu trong ngay */
function dtUseLdt(auto) {
  const d = DT(); if (matHave('misc', 'ldt') < 1) { if (!auto) toast('Chưa có Lệnh Bài Dã Tẩu (mua ở Kỳ Trân Các)'); return false; }
  matAdd('misc', 'ldt', -1); d.extra = (d.extra || 0) + DT_LDT; if (!d.task) dtNew();
  log(`📜 Dùng Lệnh Bài Dã Tẩu: +${DT_LDT} lượt nhiệm vụ hôm nay (${d.today}/${dtMax()}).`); if (!auto) toast(`+${DT_LDT} lượt Dã Tẩu`);
  R.dirty = true; save(); if (typeof refresh === 'function') refresh(); return true;
}
const DT_SLOTS = ['weapon', 'armor', 'helm', 'belt', 'boot', 'cuff', 'amulet', 'ring', 'pendant'];
const dtSlotVi = k => (k === 'ring' ? 'Nhẫn' : SLOT_VI[k]);
/* ---------- Da Tau v154: nhiem vu theo bai quai JX1 ----------
   san quai / tinh anh / trum theo ban do (tu dich chuyen, uu tien muc tieu), tim vat pham co dong thuoc tinh (kieu JX1),
   thu thap Huyen Tinh, nop ngan luong. Trum + tim vat pham thuong x1.5. Moc 30: Than Ma. Doi nhiem vu bang Lenh Bai Da Tau giu chuoi. */
const DT_W = { killm: 50, elite: 25, boss: 15, gold: 10 };   // v179: bo tim vat pham; v190: bo thu thap Huyen Tinh (tu mua o tiem) -> chi con danh quai / tinh anh / trum / nop ngan luong
const DT_HARD = { boss: 1.5, item: 1.5 };
const DT_ITEM_KILLS = 80, DT_ITEM_DROP = 0.06;   // tim vat pham: moi quai 6% roi dung mon can tim (trung binh ~17 quai)
//                                    // tim vat pham: tu dong qua 120 con chua co mon -> mua o tiem (tra ngan luong, giu chuoi)
const dtBuyCost = () => Math.round((300 + S.lvl * S.lvl * 6) * 3);
const dtMatLv = () => clamp(Math.floor(S.lvl / 15), 1, HT_MAX);         // thu thap: Huyen Tinh cap thap hon cap roi chinh 1 bac
/* ban do hop cap (cung bac hoac thap hon 1 bac) + ban do thay the */
function dtZone() {
  const b = typeof bestZoneIdx === 'function' ? bestZoneIdx() : zoneIdx(Math.min(S.stage, STAGES)), zi = Math.max(0, b - irnd(0, 1));
  const alts = [ZONES[zi]].concat(ZALT[zi] || []), za = irnd(0, alts.length - 1);
  return { zi, za, zn: alts[za].n, z: alts[za] };
}
const dtInZone = T => T.zi == null || (zoneIdx(Math.min(S.stage, STAGES)) === T.zi && ((S.zalt || {})[T.zi] || 0) === (T.za || 0));
/* tim vat pham: o trang bi + nhom dong thuoc tinh thuong gap tren o do (mau 40 mon) */
function dtItemSpec() {
  const slot = pick(DT_SLOTS), ds = DETAIL_SLOT.map((v, d) => v === slot ? d : -1).filter(d => d >= 0 && d <= 9), tier = clamp(Math.ceil(S.lvl / 12), 1, 10), cnt = LOOT_ATTR_GROUPS.map(() => 0);
  for (let i = 0; i < 40; i++) { const d = pick(ds), it = makeItem(d, sexPart(d, irnd(0, 5)), tier, 2); if (!it) continue; S.uid--; LOOT_ATTR_GROUPS.forEach((g, gi) => { if ((it.mag || []).some(m => g[1].includes(attrReal(attrName(m.a))))) cnt[gi]++; }); }
  const ok = cnt.map((c, gi) => [gi, c]).filter(x => x[1] >= 10);
  return { slot, grp: ok.length ? pick(ok)[0] : -1 };
}
function dtNew() {
  const d = DT(); if (d.today >= dtMax()) { d.task = null; return; }
  const w = Object.entries(DT_W).filter(([t]) => (t !== 'boss' || S.lvl >= 30) && (t !== 'mat' || verVio()));
  const t = wpick(w, x => x[1])[0], T = { t, have: 0 };
  if (t === 'killm' || t === 'elite' || t === 'boss') {
    const Z = dtZone(); Object.assign(T, { zi: Z.zi, za: Z.za, zn: Z.zn });
    if (t === 'killm') { const ms = Z.z.m.filter(m => MON[m]); Object.assign(T, { tid: pick(ms.length ? ms : zoneOf(S.stage).m), need: 25 + irnd(0, 15) }); }   // v179: 25-40 con (truoc 10-20)
    if (t === 'elite') T.need = 5 + irnd(0, 3);   // v179: 5-8 tinh anh (truoc 3-4)
    if (t === 'boss') Object.assign(T, { tid: Z.z.boss, need: 1 });
  }
  if (t === 'mat') Object.assign(T, { lv: dtMatLv(), cnt: 2 + irnd(0, 2) });
  if (t === 'gold') T.cost = Math.round((300 + S.lvl * S.lvl * 6) * 4);
  if (t === 'item') Object.assign(T, dtItemSpec(), { minR: S.lvl >= 40 ? 2 : 1 });
  d.task = T;
}
function dtText(T) {
  if (!T) return '—';
  const at = T.zn ? ` ở ${T.zn}` : '';
  switch (T.t) {
    case 'kill': return `Hạ ${T.need} quái (cấp ≥ ${T.minL})`;
    case 'killm': return `Săn ${T.need} ${MON[T.tid] ? MON[T.tid].n : 'quái'}${at}`;
    case 'elite': return `Diệt ${T.need} quái tinh anh${at}`;
    case 'boss': return `Hạ trùm ${bossName(T.tid, T.zn)}${at}`;
    case 'mat': return `Thu thập ${T.cnt} Huyền Tinh Khoáng Thạch cấp ${T.lv} (có ${Math.min(T.cnt, matHave('ht', T.lv))})`;
    case 'gold': return `Nộp ${fmt(T.cost)} lượng`;
    case 'item': return `Tìm ${dtSlotVi(T.slot)} ${RAR_VI[T.minR]} trở lên${T.grp >= 0 ? ` có dòng ${LOOT_ATTR_GROUPS[T.grp][0]}` : ''}`;
  }
  return '?';
}
const dtProg = T => (T && T.need ? `${Math.min(T.have, T.need)}/${T.need}` : '');
const dtItemOk = (it, T) => it && !it.set && !it.vio && !it.plv && !it.lock && !it.thanma && (it.r || 0) >= T.minR && DETAIL_SLOT[it.d] === T.slot
  && (T.grp == null || T.grp < 0 || (it.mag || []).some(m => LOOT_ATTR_GROUPS[T.grp][1].includes(attrReal(attrName(m.a)))));
const dtItemPick = T => S.inv.filter(it => dtItemOk(it, T)).sort((a, b) => itemPower(a) - itemPower(b))[0];
/* Giu mon de tra Da Tau (tim vat pham): mon hop le yeu nhat trong hanh trang, hoac mon duoi dat khi hanh trang chua co.
   Mon nay: luon nhat (bo qua bo loc), khong tu ban / ban hang loat, khong vao Ruong ep, khong bi nhuong cho khi tui day. */
function dtNeed(it) {
  const T = S.dt && S.dt.task; if (!T || T.t !== 'item' || !S.fac || S.lvl < DT_LV || !it || !dtItemOk(it, T)) return false;
  if (Object.values(S.eq).includes(it)) return false;
  const p = dtItemPick(T); return !p || p === it;
}
/* nhat duoc mon hop le: che do tu tra thi nop ngay */
function dtItemGot(it) {
  const d = S.dt, T = d && d.task; if (!T || T.t !== 'item' || !d.auto || !dtItemOk(it, T) || !S.inv.includes(it)) return;
  log(`📜 Dã Tẩu: nhặt được <b>${esc(it.n)}</b> để nộp.`); dtComplete(true);
}
function dtReady(T) {
  if (!T) return false;
  if (T.t === 'gold') return S.gold >= T.cost;
  if (T.t === 'item') return !!T.bought || !!dtItemPick(T);
  if (T.t === 'mat') return !!T.bought || matHave('ht', T.lv) >= T.cnt;
  return T.have >= T.need;
}
/* quai can cho nhiem vu (uu tien danh truoc: combat.js nearest); Sat Thu luon uu tien */
function dtWant(e) {
  if (e && (e.sat || e.satG)) return true;
  const T = S.dt && S.dt.task; if (!T || !T.need || T.have >= T.need || !e || !dtInZone(T)) return false;
  return T.t === 'killm' ? e.tid === T.tid : T.t === 'elite' ? e.cls === 'elite' : T.t === 'boss' ? e.cls === 'boss' && e.tid === T.tid : false;
}
function dtOnKill(e) {
  if (!S.fac || S.lvl < DT_LV) return;
  const d = DT(), T = d.task;
  if (T && T.t === 'item' && !dtItemPick(T) && !R.ground.some(g => dtItemOk(g.it, T)) && Math.random() < DT_ITEM_DROP) {   // tim vat pham: quai co the roi dung mon can tim
    const ds = DETAIL_SLOT.map((v, dd) => v === T.slot ? dd : -1).filter(dd => dd >= 0 && dd <= 9), tier = clamp(Math.ceil(Math.min(e.L, S.lvl) / 12), 1, 10);
    for (let i = 0; i < 40; i++) { const dd = pick(ds), it = makeItem(dd, sexPart(dd, irnd(0, 5)), tier, 2); if (it && dtItemOk(it, T)) { dropToGround(it, e); log(`📜 Dã Tẩu: <b>${esc(it.n)}</b> rơi ra (vật phẩm cần tìm).`); break; } }
  }
  if (T && T.t === 'mat' && d.auto && dtReady(T)) { dtComplete(true); return; }   // du Huyen Tinh: nop ngay
  if (false && T && (T.t === 'item' || T.t === 'mat') && d.auto && !dtReady(T) && (T.kw = (T.kw || 0) + 1) >= DT_ITEM_KILLS && S.gold >= dtBuyCost() * 3) {   // v190: bo tu mua o tiem
    S.gold -= dtBuyCost(); log(`📜 Dã Tẩu: lâu chưa ${T.t === 'mat' ? 'đủ Huyền Tinh' : 'tìm được ' + esc(dtSlotVi(T.slot)) + ' phù hợp'}, mua ở tiệm nộp (−${fmt(dtBuyCost())} lượng).`);
    T.bought = true; dtComplete(true); return;
  }
  if (!T || !T.need || T.have >= T.need) return;
  const ok = dtWant(e);
  if (!ok) return;
  T.have++;
  if (T.have >= T.need) { if (d.auto) dtComplete(true); else { toast('Dã Tẩu: nhiệm vụ hoàn thành, về trả!'); log('📜 Dã Tẩu: <b>hoàn thành</b> ' + esc(dtText(T)) + ' — về trả nhiệm vụ.'); } }
}
function dtComplete(auto) {
  const d = DT(), T = d.task; if (!dtReady(T)) return false;
  if (T.t === 'gold') S.gold -= T.cost;
  if (T.t === 'item' && !T.bought) { const it = dtItemPick(T); S.inv.splice(S.inv.indexOf(it), 1); invDirty = true; }
  if (T.t === 'mat' && !T.bought) matAdd('ht', T.lv, -T.cnt);
  d.n++; d.chain++; d.today++; d.best = Math.max(d.best, d.chain);
  const c = d.chain, k = DT_HARD[T.t] || 1;
  grant({ gold: Math.round(120 * k), xp: Math.min(0.05, 0.02 + c * 0.0006) * k, fd: k > 1 ? 2 : 1, knb: Math.random() < 0.08 * k ? 1 : 0 }, `Dã Tẩu #${c}`);   // 8% (nhiem vu kho 12%): them 1 KNB
  if (verVio() && (Math.random() < 0.35 || c % 50 === 0)) { const l = clamp(Math.floor(S.lvl / 15) + (c % 50 === 0 ? 1 : 0), 1, HT_MAX), n = c % 50 === 0 ? 3 : 1; matAdd('ht', l, n); log(`📜 Dã Tẩu: nhận ${n} Huyền Tinh cấp ${l}`); }   // JX1: Huyen Tinh tu Da Tau
  if (c % 20 === 0) { grant({ misc: { lb: 1 } }, `Dã Tẩu chuỗi ${c}`); if (verVio()) log(`📜 Dã Tẩu chuỗi ${c}: ${forceOre(S.lvl)}`); }
  if (c % 500 === 0 && typeof rareHorse === 'function') { const h = rareHorse(); if (h) { addItem(h, true, true, true); log(`📜 Mốc Dã Tẩu ${c}: nhận ngựa <b style="color:${RAR_COL[h.r]}">${esc(h.n)}</b>!`); } }
  questTick('dt');
  if (c % 50 === 0) grant({ item: 5, fd: 5 }, `Rương Dã Tẩu ${c}`);
  dtMilestone(c, d.n);
  dtNew();
  if (!auto) dtRefresh(); else if (d.task && d.task.t === 'gold' && S.gold >= d.task.cost * 20) dtComplete(true);   // tu dong: tien du thua thi nop luon
  else if (d.task && ((d.task.t === 'item' && dtItemPick(d.task)) || (d.task.t === 'mat' && dtReady(d.task)))) dtComplete(true);    // co san mon hop le trong hanh trang: nop luon
  return true;
}
/* thuong moc: chuoi lien tiep (c) + tong so nhiem vu (n). Hoang Kim Mon Phai: chac chan moi DT_HK nhiem vu (khong qua ti le hiem lo trinh 3) */
function dtMilestone(c, n) {
  const gv = (it, why) => { if (it) { addItem(it, true, true, true); log(`📜 ${why}: <b style="color:${RAR_COL[it.r]}">${esc(it.n)}</b>`); } };
  if (c % 200 === 0) { if (S.lvl >= 75) grant({ misc: { bk90: 1 } }, `Mốc Dã Tẩu ${c}`); else grant({ buff: { tt: [0.5, 60] } }, `Mốc Dã Tẩu ${c}`); }
  if (c % 100 === 0) { grant({ knb: 3, fd: 10 }, `Mốc Dã Tẩu ${c}`); if (typeof addBuff === 'function') { addBuff('luck', 20, 60); log(`📜 Mốc Dã Tẩu ${c}: Quế Hoa Tửu +20 may mắn 60 phút`); } if (typeof phoiFromDrop === 'function') gv(phoiFromDrop(S.lvl + 5), `Mốc Dã Tẩu ${c}`); }
  if (c % 500 === 0) { grant({ knb: 5, fd: 20, item: 6, misc: { wc: 1, mys: 1 } }, `Mốc Dã Tẩu ${c}`); }
  if (n % DT_HK === 0) gv(forceSetItem(false), `Dã Tẩu ${n} nhiệm vụ — Hoàng Kim Môn Phái`);
  else if (n % 1000 === 0) gv(forceSetItem(true), `Dã Tẩu ${n} nhiệm vụ — Hoàng Kim`);
  else if (n % 500 === 0) grant({ misc: { dtbk: 1 } }, `Dã Tẩu ${n} nhiệm vụ`);
}
const dtNextTotal = n => { const nx = DT_TOTAL.map(([m, t]) => [Math.ceil((n + 1) / m) * m, t]).sort((a, b) => a[0] - b[0] || 0); const m = nx[0][0]; const hit = DT_TOTAL.find(([k]) => m % k === 0); return [m, hit ? hit[1] : nx[0][1]]; };
/* doi nhiem vu: co Lenh Bai Da Tau thi giu chuoi (ton 1 lenh bai), khong thi chuoi ve 0 */
function dtSwap() {
  const d = DT(); if (matHave('misc', 'ldt') < 1) return false;
  matAdd('misc', 'ldt', -1); dtNew(); log('📜 Dùng Lệnh Bài Dã Tẩu đổi nhiệm vụ (giữ chuỗi).'); dtRefresh(); save(); return true;
}
function dtCancel() { if (dtSwap()) return; const d = DT(); d.chain = 0; dtNew(); log('📜 Hủy nhiệm vụ Dã Tẩu, chuỗi liên tiếp về 0.'); dtRefresh(); save(); }
function dtRefresh() { refresh(); }
function dtBody() {
  if (S.lvl < DT_LV) return `<p class="desc">Dã Tẩu giao nhiệm vụ từ cấp ${DT_LV}.</p>`;
  const d = DT(); if (!d.task && d.today < dtMax()) dtNew();
  const T = d.task, ready = dtReady(T), next = DT_CHAIN.map(m => m[0] - (d.chain % m[0])).sort((a, b) => a - b)[0], [tn, tt] = dtNextTotal(d.n);
  return `<p class="desc">Mốc chuỗi liên tiếp: ${DT_CHAIN.map(([m, t]) => `<b>${m}</b>: ${t}`).join(' · ')}. Mốc tổng nhiệm vụ: <b>500</b>: Đại Thành Bí Kíp · <b>1000</b>: Hoàng Kim dùng chung · <b class="gold">${DT_HK} / ${DT_HK * 2} / ${DT_HK * 3}…</b>: <b style="color:#ffd24a">Hoàng Kim Môn Phái</b> (chắc chắn). Đổi nhiệm vụ: tốn 1 Lệnh Bài Dã Tẩu (giữ chuỗi); không có lệnh bài thì hủy = mất chuỗi. ${DT_DAY} nhiệm vụ / ngày + ${DT_LDT} mỗi lệnh bài (mua tối đa ${LDT_BUY_DAY} / ngày).</p>
    <div class="card"><div class="stats"><span>Chuỗi liên tiếp</span><span><b>${d.chain}</b> (kỷ lục ${d.best})</span><span>Hôm nay</span><span>${d.today}/${dtMax()}${d.extra ? ` <small class="cp">(+${d.extra} lệnh bài)</small>` : ''}</span><span>Mốc chuỗi kế</span><span>còn ${next}</span><span>Tổng</span><span>${d.n}</span><span>Mốc tổng kế</span><span>${tn}: ${tt} <small class="dim">(còn ${tn - d.n})</small></span></div></div>
    <div class="card"><b>📜 ${T ? esc(dtText(T)) : 'Hết nhiệm vụ hôm nay'}</b> <small class="dim">${T ? dtProg(T) : ''}</small>
      ${T && T.t === 'item' ? `<div class="dim small">${dtItemPick(T) ? 'Sẽ nộp: ' + esc(dtItemPick(T).n) + ' (đang giữ 📜)' : `Chưa có món phù hợp: món rơi phù hợp sẽ được tự nhặt và giữ lại. Tự trả: sau ${DT_ITEM_KILLS} quái chưa có thì mua ở tiệm (${fmt(dtBuyCost())} lượng) · đã hạ ${T.kw || 0}`}</div>` : ''}
      <div class="dim small">${T && T.zn && !dtInZone(T) ? `Auto sẽ dịch chuyển tới ${esc(T.zn)}. ` : ''}Thưởng${T && DT_HARD[T.t] ? ' ×1,5' : ''}: ${Math.round(Math.min(0.05, 0.02 + (d.chain + 1) * 0.0006) * (T && DT_HARD[T.t] || 1) * 1000) / 10}% kinh nghiệm cấp, ${fmt(120 * (T && DT_HARD[T.t] || 1) * (1 + S.lvl / 10))} lượng, ${T && DT_HARD[T.t] ? 2 : 1} Phúc Duyên, <b style="color:#ffd24a">${T && DT_HARD[T.t] ? 12 : 8}% 1 KNB</b>${verVio() ? ", 35% Huyền Tinh (mỗi 10 nhiệm vụ: 3 viên)" : ""}</div>
      <div class="btnrow"><button class="btn" id="dtDo" ${ready ? '' : 'disabled'}>${T && (T.t === 'gold' || T.t === 'item' || T.t === 'mat') ? 'Nộp' : 'Trả nhiệm vụ'}</button><button class="btn red" id="dtCancel" ${T ? '' : 'disabled'}>${matHave('misc', 'ldt') ? 'Đổi (1 Lệnh Bài)' : 'Hủy (mất chuỗi)'}</button>
      <label class="chk"><input type="checkbox" id="dtAuto" ${d.auto ? 'checked' : ''}> Tự trả / nhận</label></div></div>
    <div class="card small"><img src="img/ep/ldt.png" alt="" style="height:20px;vertical-align:middle;image-rendering:pixelated"> <b>Lệnh Bài Dã Tẩu</b>: có ${matHave('misc', 'ldt')} · mỗi lệnh bài +${DT_LDT} lượt hôm nay (mua ở Kỳ Trân Các)
      <div class="btnrow"><button class="btn sm${d.today >= dtMax() ? ' on' : ''}" id="dtLdt" ${matHave('misc', 'ldt') ? '' : 'disabled'}>Dùng Lệnh Bài (+${DT_LDT} lượt)</button>
      <label class="chk"><input type="checkbox" id="dtLdtAuto" ${S.autoLdt === false ? '' : 'checked'}> Tự dùng khi hết lượt (chế độ Làm nhiệm vụ)</label></div></div>`;
}
function bindDt() {
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  on('#dtDo', () => { dtComplete(false); save(); });
  on('#dtCancel', dtCancel);
  const a = $('#dtAuto'); if (a) a.onchange = () => { DT().auto = a.checked; save(); };
  on('#dtLdt', () => dtUseLdt(false));
  const la = $('#dtLdtAuto'); if (la) la.onchange = () => { S.autoLdt = la.checked; save(); };
}
/* ---------- Sat Thu Duong ---------- */
const ST_TIERS = [20, 30, 40, 50, 60, 70, 80, 90], ST_TIME = 150, ST_FREE = 3;
function ST() {
  const s = S.st || (S.st = { day: '', kills: 0, fails: 0, best: 0 });
  if (s.day !== today()) { s.day = today(); matAdd('misc', 'lb', Math.max(0, ST_FREE - matHave('misc', 'lb'))); }   // moi ngay bu du 3 lenh bai mien phi
  return s;
}
const stTierMax = () => Math.max(20, Math.min(90, Math.floor(S.lvl / 10) * 10));
function stBossPool(series) {
  const ids = [...new Set(ZONES.map(z => z.boss))].filter(t => MON[t] && monSeries(t) === series && !/boss/i.test(MON[t].n));
  return ids.length ? ids : [...new Set(ZONES.map(z => z.boss))];
}
function stStart(tier) {
  ST();
  if (R.sat) { toast('Đang có Sát Thủ trên bản đồ'); return; }
  if (R.dg || R.tower || R.town) { toast('Ra bãi luyện công để gọi Sát Thủ'); return; }
  if (tier > stTierMax()) return;
  if (matHave('misc', 'lb') < 1) { toast('Cần Lệnh Bài Sát Thủ'); return; }
  matAdd('misc', 'lb', -1);
  const ser = irnd(0, 4), tid = pick(stBossPool(ser)), L = tier + 5;
  if (typeof gotoZone === 'function') { const zi = zoneIdxForLevel(L); if (zoneIdx(Math.min(S.stage, STAGES)) !== zi) gotoZone(zi, `Sát Thủ cấp ${tier} xuất hiện`); }   // Sat Thu xuat hien o ban do dung cap
  const z = zoneOf(Math.min(S.stage, STAGES));
  const around = (r0, r1) => { const a = rnd(0, Math.PI * 2), r = rnd(r0, r1); return inWorld(H.x + Math.cos(a) * r, H.y + Math.sin(a) * r); };
  const p = around(200, 240), e = makeEnemy(tid, L, 'boss', p[0], p[1]);
  e.hp = e.max = e.max * 2.2; e.dmg *= 1.2; e.sat = tier; e.series = ser; e.n = `${SERIES[ser]} Sát Thủ · ${MON[tid].n}`;
  R.enemies.push(e);
  for (let i = 0; i < 2; i++) { const q = around(150, 220), g = makeEnemy(pick(z.m), L, 'elite', q[0], q[1]); g.satG = 1; g.n = 'Hộ vệ · ' + g.n; R.enemies.push(g); }
  R.sat = { t: ST_TIME, tier, id: e.id };
  closeModal(true);
  R.banner = { t: 2.6, text: `${SERIES[ser]} Sát Thủ cấp ${tier}`, sub: `Hạ trong ${ST_TIME} giây` };
  log(`🗡 <b style="color:${SERIES_COL[ser]}">${esc(e.n)}</b> (cấp ${L}) xuất hiện!`); save();
}
function stTick(dt) {
  const s = R.sat; if (!s) return;
  s.t -= dt;
  const boss = R.enemies.find(e => e.id === s.id && !e.dead);
  if (s.done) { R.sat = null; return; }
  if (!boss || s.t <= 0) {
    R.enemies = R.enemies.filter(e => !(e.sat || e.satG) || e.dead);
    ST().fails++; R.sat = null;
    log('<span class="bad">🗡 Sát Thủ đã trốn thoát.</span>'); R.banner = { t: 2, text: 'Sát Thủ trốn thoát', sub: '' };
  }
}
function stOnKill(e) {
  if (!e.sat) return;
  const tier = e.sat, s = ST(); s.kills++; s.best = Math.max(s.best, tier);
  if (R.sat && R.sat.id === e.id) R.sat.done = true;
  const misc = { wc: tier >= 40 ? irnd(1, 2) : 0, mys: tier >= 60 ? irnd(1, 2) : 0 };
  if (tier >= 90 && Math.random() < 0.08) misc.bk90 = 1;
  for (const k in misc) if (!misc[k]) delete misc[k];
  grant({ gold: tier * 25, xp: 0.01 + tier / 90 * 0.03, item: 5, misc }, `Hạ Sát Thủ cấp ${tier}`);
  const ht = clamp(Math.floor(tier / 10) - 1, 1, 10); matAdd('ht', ht); log(`🗡 Nhận Huyền Tinh cấp ${ht}${verVio() && tier >= 50 ? ', ' + forceOre(tier) : ''}`);
  R.enemies.forEach(g => { if (g.satG) g.satG = 0; });
}
function stBody() {
  const s = ST(), mx = stTierMax(), lb = matHave('misc', 'lb');
  return `<p class="desc">Sát Thủ Đường: dùng 1 Lệnh Bài gọi Sát Thủ (5 hệ) kèm 2 hộ vệ ngay tại bãi luyện công, hạ trong ${ST_TIME} giây. Mỗi ngày nhận ${ST_FREE} lệnh bài miễn phí; thêm từ Dã Tẩu (mỗi 5 nhiệm vụ) và trùm. Thưởng: kinh nghiệm, Thủy Tinh Trắng, Thần Bí Khoáng Thạch, Huyền Tinh (Sát Thủ cấp 50+: thêm 1 đá thuộc tính), đồ 5 dòng; Sát Thủ 90 có cơ hội rơi Mật Tịch.</p>
    <div class="card stats"><span>Lệnh Bài Sát Thủ</span><span><b>${lb}</b></span><span>Đã hạ</span><span>${s.kills} (cao nhất cấp ${s.best || '—'})</span><span>Trốn thoát</span><span>${s.fails}</span></div>
    ${R.sat ? `<div class="card"><b>🗡 Đang truy sát Sát Thủ cấp ${R.sat.tier}</b> <small class="dim">còn ${Math.ceil(R.sat.t)} giây</small></div>` : ''}
    <div class="stgrid">${ST_TIERS.map(t => `<button class="btn" data-st="${t}" ${t <= mx && lb && !R.sat ? '' : 'disabled'}>Cấp ${t}${t > mx ? ` <small>(cần cấp ${t})</small>` : ''}</button>`).join('')}</div>`;
}
/* ---------- moc noi ---------- */
function ghOnKill(e) {
  if (!S.fac) return;
  dtOnKill(e); stOnKill(e);
  // Kim Nguyen Bao: trum 10%, trum Hoang Kim / boss tuan 50% (1-2 thoi) - dung o Ky Tran Cac
  if (e.cls === 'boss') { const hi = e.goldBoss || e.wb; if (Math.random() < (hi ? 0.5 : 0.1)) { const n = hi ? irnd(1, 2) : 1; S.knb = (S.knb || 0) + n; addText(e.x, e.y - 76, `+${n} Kim Nguyên Bảo`, '#ffd700', 13); log(`💰 Nhặt được <b style="color:#ffd700">${n} Kim Nguyên Bảo</b>`); } }
  if (e.cls === 'boss') {
    const L = e.L, g = (e.goldBoss || e.wb ? 4 : 1) * dropMul(), drop = [];
    if (L >= 75 && Math.random() < 0.03 * g) drop.push('bk90');
    if (!e.sat && Math.random() < 0.06) drop.push('lb');
    for (const k of drop) { matAdd('misc', k, 1); addText(e.x, e.y - 60, '+1 ' + miscName(k), '#ffd24a', 12); log(`Nhặt được <b style="color:#ffd24a">${miscName(k)}</b>`); }
  }
}
function ghTick(dt) { stTick(dt); if (typeof questPilot === 'function') questPilot(dt); if (typeof dgPilot === 'function') dgPilot(dt); }
function ghTodo(out) {
  if (!S.fac || S.lvl < DT_LV) return;
  ST(); const d = DT(), T = d.task;
  if (T && dtReady(T) && !d.auto) out.push({ k: 'dt', t: '📜 Trả nhiệm vụ Dã Tẩu', go: () => openQuest('dt') });
  else if (T && T.need) out.push({ k: 'dtp', t: `📜 ${dtText(T)} ${dtProg(T)}`, go: () => openQuest('dt') });
  if (matHave('misc', 'lb') > 0 && !R.sat && S.lvl >= 20 && S.st && S.st.kills < 1) out.push({ k: 'st', t: '🗡 Có Lệnh Bài Sát Thủ', go: () => openQuest('st') });
}
