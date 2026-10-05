/* ======================= LO EP DO TIM (Tho ren JX1, he thong ren rieng) =======================
   Theo huong dan JX1 (Trang bi Huyen Tinh):
   1. Tinh luyen: luyen Huyen Tinh (3 nhan / day chuyen / ngoc boi + 1.000), thang cap Huyen Tinh / da thuoc tinh.
   2. Lay (hut phoi): do xanh + 1 Huyen Tinh (+ phu lieu) -> da thuoc tinh. Dong hien -> Nguyen Khoang (khong phan he),
      dong an -> Nguyen Thach (mang he cua mon nguon). Huyen Tinh cap cao: ti le cao hon, da tot hon.
   3. Che tao: do trang / xanh + 1 Huyen Tinh -> phoi Huyen Tinh (do Tim trong), so khung theo cap Huyen Tinh.
   4. Kham nam: phoi + da dung thu tu khung + 1 Huyen Tinh (+ phu lieu) + 10.000; dong an phai dung he.
   Ruong ep (S.epBox): chua phoi / do de lay thuoc tinh, khong tinh vao 60 o hanh trang. */
'use strict';
const EP_BOX_MAX = 120;
let EP = { tab: 'kham', sel: 0, ht: 0, fuse: [] };
const oreIc = place => `img/ep/da${(place | 0) + 1}.png`;   // hinh goc JX1: Huyen Thiet, Khong Tuoc, Mat Ngan, Phu Dung, Chu Sa, Chung Nhu
const oreName = a => (oreRows(a)[0] || {}).n || attrName(a);
const isPhoi = it => !!it && !it.set && it.d >= 0 && it.d <= 9 && !!it.vio && (it.mag || []).length < vioSlots(it);
const isHutSrc = it => !!it && !it.set && !it.vio && !it.thanma && it.d >= 0 && it.d <= 9 && (it.mag || []).length > 0;
const isFuseSrc = it => !!it && FUSE_SLOTS.includes(it.d) && !it.set && !it.vio && !it.lock && !Object.values(S.eq).includes(it) && !(typeof betterThanEquipped === 'function' && S.inv.includes(it) && betterThanEquipped(it));
const boxIn = i => !i.lock && !dtNeed(i) && (isPhoi(i) || isFuseSrc(i) || isPhoiSrc(i) && (i.r === 0 || !lootMatch(i)));
const isPhoiSrc = it => !!it && !it.set && !it.vio && !it.thanma && VIO_D.includes(it.d) && (it.r || 0) <= 2;
const epPool = f => S.inv.concat(epBox()).filter(f);
const epFind = uid => S.inv.concat(epBox(), Object.values(S.eq)).find(i => i && i.uid === uid);
const htList = () => Object.keys(mats().ht).map(Number).filter(l => matHave('ht', l) > 0).sort((a, b) => a - b);
function stoneCell(key) {
  const o = oreParse(key);
  return `<button class="it ep-st" data-st="${key}" title="${esc(oreStoneName(key) + ' · ' + oreName(o.a))}"><img src="${oreIc(o.place)}" alt=""><i>c${o.lvl}</i><em class="ep-pl"${o.s >= 0 ? ` style="color:${SERIES_COL[o.s]}"` : ''}>${o.place + 1}</em><b class="ep-n">×${matHave('ore', key)}</b></button>`;
}
function epHtFix() { const hts = htList(); if (!hts.includes(EP.ht)) EP.ht = hts[hts.length - 1] || 0; }
function htRow(pick) {
  const hts = htList(); if (pick) epHtFix();
  return `<div class="ep-ht">${hts.map(l => pick ? `<button class="ep-htc${EP.ht === l ? ' ep-on' : ''}" data-ht="${l}" title="Huyền Tinh Khoáng Thạch cấp ${l}"><img src="img/ep/ht.png" alt=""><i>c${l}</i><b>×${matHave('ht', l)}</b></button>` : `<span class="ep-htc" title="Huyền Tinh Khoáng Thạch cấp ${l}"><img src="img/ep/ht.png" alt=""><i>c${l}</i><b>×${matHave('ht', l)}</b></span>`).join('') || '<small class="dim">Chưa có Huyền Tinh (hạ tinh anh / trùm, Dã Tẩu, hoặc luyện ở thẻ Tinh luyện)</small>'}</div>`;
}
const auxRow = () => `<label class="small"><input type="checkbox" id="epAux" ${EP_AUX.on ? 'checked' : ''}> Dùng phụ liệu: 1 Thủy Tinh Trắng (có ${matHave('misc', 'wc')}) hoặc ${AUX_FD} Phúc Duyên (có ${RW().fd || 0}) · +15% thành công${EP.tab === 'kham' ? ', dòng mạnh hơn 1 bậc' : ''}</label>`;
function epTabs() {
  const T = [['tl', 'Tinh luyện'], ['hut', 'Lấy thuộc tính'], ['phoi', 'Chế tạo phôi'], ['kham', 'Khảm nạm'], ['box', `Rương ép (${epBox().length})`]];
  return `<div class="dtabs">${T.map(([k, n]) => `<button data-et="${k}" class="${EP.tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
}
function itemMini(it) { return `<div class="idet"><div class="pic r${it.r}">${it.ic ? `<img src="${esc(it.ic)}" alt="">` : ''}</div><div><h4 style="color:${RAR_COL[it.r]}">${esc(it.n)}${it.vio ? ` <small class="vtag">Tím ${it.mag.length}/${vioSlots(it)}</small>` : ''}</h4><small class="dim">${esc(J.items[it.d].n)} · cấp ${it.lvl}${it.s >= 0 ? ` · <span style="color:${SERIES_COL[it.s]}">hệ ${SERIES[it.s]}</span>` : ''}${epBox().includes(it) ? ' · trong Rương ép' : Object.values(S.eq).includes(it) ? ' · đang mặc' : ''}</small></div></div>`; }
const lineTxt = m => esc(attrText(attrName(m.a), m.p.map(v => (v === -1 ? 0 : v))));
const pickGrid = (pool, it) => `<div class="invgrid ep-grid">${pool.map(i => itemCell(i).replace('class="it', `class="it${it === i ? ' ep-on' : ''}`)).join('')}</div>`;

/* ---------- 1. Tinh luyen ---------- */
function epTabTl() {
  const pool = epPool(canFuse), hts = Object.keys(mats().ht).map(Number).sort((a, b) => a - b);
  EP.fuse = EP.fuse.filter(u => pool.some(i => i.uid === u));
  const sum = pool.filter(i => EP.fuse.includes(i.uid)).reduce((t, i) => t + (i.lvl || 1), 0), [dmin, dmax] = RCP_R.violet_fuse.level_div;
  return `<div class="card"><b>Luyện Huyền Tinh Khoáng Thạch</b> <small class="dim">chọn 3 món nhẫn / dây chuyền / ngọc bội + ${fmt(fuseCost())} lượng → 1 Huyền Tinh cấp ngẫu nhiên [tổng cấp / ${dmin}, tổng cấp / ${dmax}]</small>
      <div class="invgrid ep-grid" id="epFuseG">${pool.map(i => itemCell(i).replace('class="it', `class="it${EP.fuse.includes(i.uid) ? ' ep-on' : ''}`)).join('')}</div>${pool.length ? '' : '<small class="dim">Không có nhẫn / dây chuyền / ngọc bội chưa mặc, chưa khóa</small>'}
      <div class="btnrow"><button class="btn" id="epFuse" ${EP.fuse.length === 3 && S.gold >= fuseCost() ? '' : 'disabled'}>Luyện (${EP.fuse.length}/3${EP.fuse.length === 3 ? ` · ra cấp ${clamp(Math.max(1, Math.floor(sum / dmin)), 1, HT_MAX)}–${clamp(Math.max(1, Math.floor(sum / dmax)), 1, HT_MAX)}` : ''})</button><button class="btn" id="epFuseAuto" ${fusePool().length >= 3 && S.gold >= fuseCost() ? '' : 'disabled'}>Tự chọn 3 món thừa</button></div></div>
    <div class="card"><b>Thăng cấp Huyền Tinh</b> <small class="dim">3 viên cùng cấp → 1 viên cấp +1 · ${fmt(EP_COST.up)} lượng · thất bại (2/11) mất 1 viên</small>
      ${hts.map(l => `<div class="ep-row"><span class="ep-htc"><img src="img/ep/ht.png" alt=""><i>c${l}</i><b>×${matHave('ht', l)}</b></span><button class="btn sm" data-up="${l}" ${matHave('ht', l) >= 3 && l < HT_MAX && S.gold >= EP_COST.up ? '' : 'disabled'}>Thăng lên cấp ${l + 1}</button></div>`).join('') || '<small class="dim">Chưa có Huyền Tinh</small>'}</div>
    <div class="card"><b>Thăng cấp đá thuộc tính</b> <small class="dim">ở thẻ Rương ép: chạm vào viên đá (+1 cấp, 2/11 vỡ)</small></div>`;
}
/* ---------- 2. Lay thuoc tinh (hut phoi) ---------- */
function ahCard() {
  const c = AH(), sel = (id, vals, cur, f = v => v) => `<select id="${id}">${vals.map(v => `<option value="${v}" ${cur === v ? 'selected' : ''}>${f(v)}</option>`).join('')}</select>`;
  return `<div class="card"><label><input type="checkbox" id="ahOn" ${c.on ? 'checked' : ''}> <b>⚗ Tự rút thông minh</b></label> <button class="btn sm" id="ahNow" ${c.on ? '' : 'disabled'}>Rút ngay</button>
    <div class="row small">Dòng từ cấp ${sel('ahLv', [1, 2, 3, 4, 5, 6, 7], c.minLv)} · Huyền Tinh tối đa c${sel('ahHt', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], c.htMax)} · tối đa ${sel('ahCap', [1, 2, 3, 5, 10], c.cap)} viên / loại · giữ ${sel('ahRes', [0, 10000, 50000, 200000, 1000000], c.reserve, fmt)} lượng</div>
    <div class="dim small">Rút đồ xanh không được bộ lọc giữ: ưu tiên dòng phôi Tím đang cần, rồi dòng cấp cao. Không đụng đồ khóa / bộ / Tím / đang mặc / nâng cấp (▲ △).</div></div>`;
}
function epTabHut() {
  const pool = epPool(isHutSrc).sort((a, b) => b.r - a.r || b.lvl - a.lvl);
  let it = epFind(EP.sel); if (!it || !pool.includes(it)) it = pool[0];
  if (!it) return ahCard() + '<p class="dim">Không có đồ xanh trong hành trang hoặc Rương ép.</p>';
  EP.sel = it.uid;
  const ht = EP.ht, aux = EP_AUX.on && auxHave(), c = hutCost(it), why = it.lock ? 'Món đang khóa 🔒 — mở khóa ở chi tiết món' : !ht ? 'Cần Huyền Tinh' : '';
  const lines = it.mag.map((m, i) => { const ok = oreRows(m.a).length, pl = hutPlaces(it, i);
    return `<div class="ep-opt">${ok ? `<span class="it ep-st"><img src="${oreIc(pl[0])}" alt=""><i>c${hutOreLvl(m, ht)}</i></span>` : '<span class="it ep-st"></span>'}<span class="${i % 2 ? 'h' : 'm'}">${lineTxt(m)}<br><small class="dim">${ok ? `→ ${pl[0] % 2 ? `Nguyên Thạch hệ ${SERIES[it.s] || '—'}` : 'Nguyên Khoáng'} cấp ${hutOreLvl(m, ht)}` : 'không lấy được'}</small></span>
      <span class="btnrow">${ok && !why ? pl.map(p => `<button class="btn sm" data-hut="${i}:${p}" ${S.gold >= c ? '' : 'disabled'} title="${esc(ORE_NAMES[p])}">Dòng ${p + 1}</button>`).join('') : ''}</span></div>`; }).join('');
  return ahCard() + `<div class="card">${itemMini(it)}<small class="dim">Lấy 1 dòng → 1 viên đá: đúng vị trí dòng trên trang bị · dòng hiện → Nguyên Khoáng (không phân hệ) · dòng ẩn → Nguyên Thạch (hệ ${SERIES[it.s] || '—'}) · món mất · ${fmt(c)} lượng + 1 Huyền Tinh · thành công <b>${hutRate(ht || 1, aux)}%</b></small>
      <div class="dim small">Chọn Huyền Tinh (cấp cao: tỉ lệ cao hơn, cấp 5+ đá +1 cấp, cấp 9+ đá +2 cấp):</div>${htRow(true)}${auxRow()}${why ? `<div class="cn small">${why}</div>` : ''}${lines}</div>
    <h3>Đồ có thể lấy thuộc tính <small>${pool.length} món</small></h3>${pickGrid(pool, it)}`;
}
/* ---------- 3. Che tao phoi ---------- */
function epTabPhoi() {
  const pool = epPool(isPhoiSrc).sort((a, b) => b.lvl - a.lvl || a.r - b.r);
  let it = epFind(EP.sel); if (!it || !pool.includes(it)) it = pool[0];
  const odds = l => { const o = PHOI_ODDS(l), [n, pr] = o[0]; return o.length > 1 ? `${n} dòng · ${pr}%` : `${n} dòng`; };   // chi hien kha nang cao nhat; khong dat -> it hon 1 dong
  const head = `<p class="desc">Trang bị trắng / xanh (không gồm trang sức) + 1 Huyền Tinh + ${fmt(EP_COST.phoi)} lượng → phôi Tím.</p>
    <div class="chips">${[1, 2, 3, 4, 5, 6, 7].map(l => `<span class="chip2${EP.ht && Math.min(EP.ht, 7) === l ? ' on' : ''}"><span class="dim">c${l}${l === 7 ? '+' : ''}</span>&nbsp;<b>${odds(l)}</b></span>`).join('')}</div>`;
  if (!it) return head + '<p class="dim">Không có đồ trắng / xanh phù hợp.</p>';
  EP.sel = it.uid;
  const why = it.lock ? 'Món đang khóa 🔒' : !EP.ht ? 'Cần Huyền Tinh' : S.gold < EP_COST.phoi ? 'Không đủ ngân lượng' : '';
  return `${head}<div class="card">${itemMini(it)}${htRow(true)}
      <div class="btnrow"><button class="btn" id="epPhoi" ${why ? 'disabled' : ''}>Chế tạo phôi${EP.ht ? ` · c${EP.ht} → ${odds(EP.ht)}` : ''}</button></div>${why ? `<div class="cn small">${why}</div>` : ''}</div>
    <h3>Chọn trang bị <small>${pool.length} món</small></h3>${pickGrid(pool, it)}`;
}
/* ---------- 4. Kham nam ---------- */
function epTabKham() {
  const pool = epPool(isPhoi).concat(Object.values(S.eq).filter(isPhoi)).sort((a, b) => (b.mag || []).length - (a.mag || []).length || b.lvl - a.lvl);
  let it = epFind(EP.sel); if (!it || !it.vio) it = pool[0];
  const grid = pickGrid(pool, it) + (pool.length ? '' : '<p class="dim small">Chưa có phôi Huyền Tinh: sang thẻ <b>Chế tạo phôi</b>.</p>');
  if (!it) return `<h3>Chọn phôi</h3>${grid}`;
  EP.sel = it.uid;
  const n = (it.mag || []).length, N = vioSlots(it), opts = vioOptions(it), aux = EP_AUX.on && auxHave();
  const slots = Array.from({ length: N }, (_, i) => {
    const tag = `<b class="ep-no">${i + 1}</b><small class="dim">${i % 2 ? 'ẩn' : 'hiện'}</small>`;
    if (i < n) { const m = it.mag[i]; return `<div class="ep-slot done">${tag}<img src="${oreIc(i)}" alt=""><span class="vio">${lineTxt(m)}</span></div>`; }
    if (i === n) return `<div class="ep-slot next">${tag}<span class="cp">◀ cần ${esc(ORE_NAMES[i])}${i % 2 ? ` hệ ${SERIES[it.s]}` : ''}</span></div>`;
    return `<div class="ep-slot">${tag}<span class="dim">${esc(ORE_NAMES[i])} · trống</span></div>`;
  }).join('');
  const stones = opts.length ? opts.map((o, k) => `<div class="ep-opt">${stoneCell(o.key)}<span><b>${esc(o.txt)}</b><br><small class="dim">${esc(oreStoneName(o.key))} · Huyền Tinh c${o.ht} · thành công ${khamRate(o.ht, aux)}%</small></span><small class="${o.gain > 0.0005 ? 'cp' : 'dim'}">${pctTxt(o.gain)}</small><button class="btn sm" data-ep="${k}">Khảm</button></div>`).join('')
    : `<p class="dim small">Không có ${esc(ORE_NAMES[Math.min(n, 5)])} hợp món này (đúng hệ ${SERIES[it.s] || "—"} với dòng ẩn, đúng loại trang bị, chưa trùng thuộc tính đã có), thiếu Huyền Tinh hoặc ngân lượng. Lấy thuộc tính từ đồ xanh để có đá.</p>`;
  return `<div class="card ep-main">${itemMini(it)}<div class="ep-slots">${slots}</div>${auxRow()}
      <div class="btnrow"><button class="btn" id="epAll" ${opts.length ? '' : 'disabled'}>Khảm tự động tới đủ ${N} dòng</button>${n ? `<button class="btn red" id="epTake">Tách dòng ${n} (${fmt(vioTakeCost(it))})</button>` : `<button class="btn red" id="epSell" ${vioSellOk(it) ? '' : 'disabled'}>Bán (+${fmt(itemValue(it))} lượng)</button>`}</div>
      <div class="dim small">Mỗi lần khảm: 1 đá đúng dòng + 1 Huyền Tinh + ${fmt(EP_COST.kham)} lượng · thành công 70% + 3%/cấp Huyền Tinh · thất bại mất đá và Huyền Tinh · khảm lần lượt từng dòng.</div></div>
    <h3>Đá cho dòng ${Math.min(n + 1, N)}</h3>${n < N ? stones : '<p class="dim">Đã đủ dòng</p>'}
    <h3>Chọn phôi <small>${pool.length} món</small></h3>${grid}`;
}
/* ---------- 5. Ruong ep ---------- */
function epTabBox() {
  const ores = Object.keys(mats().ore).sort((a, b) => oreParse(a).place - oreParse(b).place || oreParse(b).lvl - oreParse(a).lvl);
  const byPlace = Array.from({ length: VIO_SLOTS }, (_, p) => ores.filter(k => oreParse(k).place === p));
  const box = epBox(), canIn = S.inv.filter(boxIn), nJ = box.filter(i => FUSE_SLOTS.includes(i.d)).length;
  return `<div class="card"><b>Đá thuộc tính</b> <small class="dim">${ores.reduce((t, k) => t + matHave('ore', k), 0)} viên · chạm đá để thăng cấp (+1, 2/11 vỡ) · số màu = hệ của Nguyên Thạch</small>
      ${byPlace.map((l, p) => `<div class="ep-row"><small class="ep-no" style="min-width:150px">${p + 1}. ${esc(ORE_NAMES[p])}</small><div class="ep-stones">${l.map(k => stoneCell(k)).join('') || '<small class="dim">—</small>'}</div></div>`).join('')}</div>
    <div class="card"><b>Huyền Tinh</b>${htRow(false)}<div class="ep-ht"><span class="ep-htc" title="Thủy Tinh Trắng"><img src="img/ep/wc.png" alt=""><b>×${matHave('misc', 'wc')}</b></span><span class="ep-htc" title="Phúc Duyên"><img src="img/ep/fd.png" alt=""><b>${RW().fd || 0}</b></span><span class="ep-htc" title="Thần Bí Khoáng Thạch"><img src="img/ep/mys.png" alt=""><b>×${matHave('misc', 'mys')}</b></span></div><small class="dim">Phụ liệu: Thủy Tinh Trắng · Phúc Duyên · Thần Bí Khoáng Thạch</small></div>
    <div class="card"><b>Phôi · đồ lấy thuộc tính · trang sức luyện Huyền Tinh</b> <small class="dim">${box.length}/${EP_BOX_MAX} · không chiếm hành trang · chạm món để lấy ra</small>
      <div class="btnrow"><button class="btn sm" id="epIn" ${canIn.length && box.length < EP_BOX_MAX ? '' : 'disabled'}>Cất ${canIn.length} món từ hành trang</button><button class="btn sm" id="epOutAll" ${box.length ? '' : 'disabled'}>Lấy hết ra</button></div>
      <div class="dim small">Cất: phôi Huyền Tinh chưa đủ dòng · nhẫn / dây chuyền / ngọc bội không tốt hơn đồ đang mặc (${nJ} trong rương, dùng ở thẻ Tinh luyện) · đồ trắng · đồ xanh không khớp bộ lọc. Món khóa 🔒 không cất.</div>
      <div class="invgrid ep-grid" id="epBoxG">${box.map(itemCell).join('')}</div>
      <div class="btnrow"><button class="btn sm" id="epToStash" ${box.length ? '' : 'disabled'}>Gửi hết sang Kho chung</button><button class="btn sm" id="epDon">🧹 Dọn kho</button><button class="btn sm" id="epLootCfg">⚙ Nhặt đồ để ép (bộ lọc)</button></div>
      <div class="dim small">Tự nhặt đồ để ép: ${(() => { const e = lootFilter().ep; return [e.white && 'đồ trắng', e.jew && 'nhẫn / dây chuyền / ngọc bội', e.blue && `đồ xanh có dòng cấp ≥ ${e.blueLv}`].filter(Boolean).join(', ') || 'tắt'; })()} → ${({ box: 'Rương ép', stash: 'Kho chung', inv: 'Hành trang' })[lootFilter().ep.dest]}</div></div>`;
}
function epModal(tab, uid) {
  if (tab) EP.tab = tab; if (!['tl', 'hut', 'phoi', 'kham', 'box'].includes(EP.tab)) EP.tab = 'kham'; if (uid) EP.sel = uid; epHtFix();
  if (!verVio()) return modal('<h3>Lò Ép Đồ</h3><p class="desc">Chưa mở.</p>');
  const F = { tl: epTabTl, hut: epTabHut, phoi: epTabPhoi, kham: epTabKham, box: epTabBox }, body = (F[EP.tab] || epTabKham)();
  modal(`<h3>Lò Ép Đồ · Thợ Rèn <small>${fmt(S.gold)} lượng</small></h3>${epTabs()}${body}`, () => {
    document.querySelectorAll('#mBody [data-et]').forEach(b => b.onclick = () => epModal(b.dataset.et));
    document.querySelectorAll('#mBody [data-ht]').forEach(b => b.onclick = () => { EP.ht = +b.dataset.ht; epModal(); });
    const ax = $('#epAux'); if (ax) ax.onchange = e => { EP_AUX.on = e.target.checked; epModal(); };
    document.querySelectorAll('#mBody .ep-grid [data-uid]').forEach(b => { if (EP.tab !== 'box' && EP.tab !== 'tl') b.onclick = () => epModal(EP.tab, +b.dataset.uid); });
    const re = () => epModal(), done = r => { toast(r.msg); uiSfx(r.ok ? 'learn' : 'use'); log(esc(r.msg)); R.dirty = true; invDirty = true; save(); re(); };
    const it = epFind(EP.sel);
    if (EP.tab === 'tl') {
      $('#epFuseAuto').onclick = () => { EP.fuse = fusePool().slice(0, 3).map(i => i.uid); re(); };
      document.querySelectorAll('#mBody #epFuseG [data-uid]').forEach(b => b.onclick = () => { const u = +b.dataset.uid, k = EP.fuse.indexOf(u); if (k >= 0) EP.fuse.splice(k, 1); else if (EP.fuse.length < 3) EP.fuse.push(u); re(); });
      $('#epFuse').onclick = () => { const items = EP.fuse.map(u => epFind(u)).filter(Boolean); EP.fuse = []; done(fuse(items)); };
      document.querySelectorAll('#mBody [data-up]').forEach(b => b.onclick = () => done(upgradeHT(+b.dataset.up)));
    } else if (EP.tab === 'kham') {
      const opts = it ? vioOptions(it) : [];
      document.querySelectorAll('#mBody [data-ep]').forEach(b => b.onclick = () => { const o = opts[+b.dataset.ep]; if (o) done(enchase(it, o.ht, o.key)); });
      const a = $('#epAll'); if (a) a.onclick = () => done(vioFillAll(it));
      const t = $('#epTake'); if (t) t.onclick = () => done(vioTake(it));
      const sb = $('#epSell'); if (sb) sb.onclick = () => { const r = vioSell(it); if (r.ok) EP.sel = 0; done(r); };
    } else if (EP.tab === 'hut') {
      const c = AH(), sv = () => { save(); re(); };
      $('#ahOn').onchange = e => { c.on = e.target.checked; sv(); }; $('#ahLv').onchange = e => { c.minLv = +e.target.value; sv(); }; $('#ahHt').onchange = e => { c.htMax = +e.target.value; sv(); };
      $('#ahCap').onchange = e => { c.cap = +e.target.value; sv(); }; $('#ahRes').onchange = e => { c.reserve = +e.target.value; sv(); };
      $('#ahNow').onclick = () => { const n = autoHut(20); toast(n ? `Tự rút ${n} món (xem nhật ký)` : 'Không có món nào để rút'); re(); };
      document.querySelectorAll('#mBody [data-hut]').forEach(b => b.onclick = () => { const [i, p] = b.dataset.hut.split(':').map(Number); EP.sel = 0; done(hutPhoi(it, i, p, EP.ht)); });
    } else if (EP.tab === 'phoi') {
      const p = $('#epPhoi'); if (p) p.onclick = () => { const r = makePhoi(it, EP.ht); if (r.ok) EP.tab = 'kham'; done(r); };
    } else {
      document.querySelectorAll('#mBody [data-st]').forEach(b => b.onclick = () => done(upgradeOre(b.dataset.st)));
      document.querySelectorAll('#mBody #epBoxG [data-uid]').forEach(b => b.onclick = () => { const x = epBox().find(i => i.uid === +b.dataset.uid); if (!x) return; if (S.inv.length >= INV_MAX) return toast('Hành trang đầy'); itemRemove(x); S.inv.push(x); invDirty = true; save(); re(); });
      $('#epIn').onclick = () => { let n = 0; for (const x of S.inv.filter(boxIn)) { if (epBox().length >= EP_BOX_MAX) break; itemRemove(x); epBox().push(x); n++; } toast(`Cất ${n} món vào Rương ép`); invDirty = true; save(); re(); };
      $('#epOutAll').onclick = () => { let n = 0; while (epBox().length && S.inv.length < INV_MAX) { S.inv.push(epBox().shift()); n++; } toast(`Lấy ra ${n} món`); invDirty = true; save(); re(); };
      $('#epLootCfg').onclick = () => { closeModal(); showTab('inv'); setTimeout(() => { const c = $('#epLoot'); if (c) c.scrollIntoView({ block: 'center' }); }, 50); };
      $('#epDon').onclick = () => donKhoModal();
      $('#epToStash').onclick = () => { let n = 0; for (const x of epBox().slice()) { if (S.inv.length >= INV_MAX) break; itemRemove(x); S.inv.push(x); const r = stashDeposit(x); if (r && r.ok) n++; else { itemRemove(x); epBox().push(x); break; } } toast(`Gửi ${n} món sang Kho chung`); invDirty = true; save(); re(); };
    }
  });
}
/* goi khi nhat do (addItem): do de ep -> Ruong ep / Kho chung theo bo loc (the Hanh trang -> Do de ep Tim) */
let epStashQ = 0;
function epAutoStore(it) {
  const kind = epWant(it); if (!kind) return false;
  if (typeof dtNeed === 'function' && dtNeed(it)) return false;                     // giu de tra Da Tau
  if (kind === 'blue' && lootMatch(it) && S.inv.length < INV_MAX) return false;     // do xanh khop bo loc chinh (co the mac): vao hanh trang
  const dest = lootFilter().ep.dest;
  if (dest === 'box' && epBox().length < EP_BOX_MAX) { epBox().push(it); return true; }
  if (dest === 'stash' && typeof stashDeposit === 'function' && S.inv.length < INV_MAX) { S.inv.push(it); const r = stashDeposit(it); if (r && r.ok) return true; const k = S.inv.indexOf(it); if (k >= 0) S.inv.splice(k, 1); }
  if (epBox().length < EP_BOX_MAX) { epBox().push(it); return true; }               // kho chung day / loi: ve Ruong ep
  return false;
}
