/* ======================= REN DO: CUONG HOA + TAY LUYEN (cho tieu ngan luong lau dai) =======================
   Cuong hoa +1..+10: moi cap +8% thuoc tinh goc (ENH_STEP, core.js). Gia tang x1.8 moi cap va theo cap nhan vat,
   ti le thanh cong giam dan (thap nhat 35%); that bai chi mat ngan luong, khong vo do.
   Tay luyen: gieo lai toan bo dong thuoc tinh ma thuat (dung luat magicattrib.txt: he, loai do, tien / hau to);
   do Hoang Kim / Bach Kim co dong co dinh nen khong tay luyen duoc. */
'use strict';
const enhCostAt = (it, l) => Math.round((1000 + it.lvl * 1000 + (it.r || 0) * 2000) * Math.pow(1.8, l) * (1 + S.lvl / 10));
const enhChanceAt = l => Math.max(0.35, 1 - 0.07 * l);
const enhCost = it => enhCostAt(it, it.enh || 0);
const enhChance = it => enhChanceAt(it.enh || 0);
/* Chi phi ky vong de dua mon tu cap hien tai len cap muc tieu (moi lan thu ton enhCost, ti le thanh cong enhChance) */
function enhExpected(it, target) { let c = 0; for (let l = it.enh || 0; l < target; l++) c += enhCostAt(it, l) / enhChanceAt(l); return Math.round(c); }
const rerollCost = it => Math.round((500 + it.lvl * 400) * (1 + (it.mag || []).length * 0.5) * (1 + S.lvl / 15));
const REROLL_KEEP = 0.75;                                  // moi dong giu lai: +75% gia tay luyen
const rerollCostKeep = (it, nKeep) => Math.round(rerollCost(it) * (1 + REROLL_KEEP * nKeep));
const canReroll = it => !it.set && !it.vio && !it.thanma && (it.mag || []).length > 0;
function payGold(c) { if (S.gold < c) { toast('Không đủ ngân lượng'); return false; } S.gold -= c; return true; }
function enhTry(it) {                                      // mot lan cuong hoa, khong ve lai giao dien
  if ((it.enh || 0) >= ENH_MAX || S.gold < enhCost(it)) return null;
  S.gold -= enhCost(it);
  if (Math.random() < enhChance(it)) { it.enh = (it.enh || 0) + 1; recEnh(it); return true; }
  return false;
}
function enhance(it) {
  if (!owned(it)) { closeModal(); return; }
  if ((it.enh || 0) >= ENH_MAX || !payGold(enhCost(it))) return;
  S.gold += enhCost(it); const ok = enhTry(it);
  if (ok) { toast(`Cường hóa thành công: +${it.enh}`); uiSfx('learn'); log(`Cường hóa <b>${esc(it.n)}</b> lên +${it.enh}`); }
  else { toast('Cường hóa thất bại (mất ngân lượng)'); uiSfx('use'); }
  R.dirty = true; invDirty = true; save(); forgeModal(it);
}
/* Cuong hoa lien tuc toi +target, dung khi het ngan sach (khong dung qua budget luong) */
function enhanceTo(it, target, budget) {
  const st = { tries: 0, ok: 0, fail: 0, spent: 0, from: it.enh || 0 };
  while ((it.enh || 0) < target && st.tries < 200) {
    const c = enhCost(it); if (c > S.gold || st.spent + c > budget) break;
    const r = enhTry(it); if (r === null) break;
    st.tries++; st.spent += c; if (r) st.ok++; else st.fail++;
  }
  if (st.tries) { R.dirty = true; invDirty = true; log(`Cường hóa <b>${esc(it.n)}</b>: +${st.from} → +${it.enh || 0} (${st.tries} lần, ${st.fail} thất bại, −${fmt(st.spent)} lượng)`); save(); }
  return st;
}
/* Luc chien thay doi neu mon (dang mac) len them 1 cap cuong hoa */
function enhPowerGain(it) {
  if (!Object.values(S.eq).includes(it) || (it.enh || 0) >= ENH_MAX) return null;
  const p0 = power(calc()); it.enh = (it.enh || 0) + 1; const p1 = power(calc()); it.enh--; if (!it.enh) delete it.enh;
  return p1 / Math.max(1, p0) - 1;
}
/* Tay luyen giu dong: cac dong trong keep giu nguyen, cac dong con lai gieo lai (khong trung loai thuoc tinh voi dong giu) */
function rollKeep(it, keep) {
  const used = new Set(it.mag.filter((m, i) => keep.has(i)).map(m => m.a)), lucky = R.P ? R.P.lucky : 0;
  return it.mag.map((m, i) => keep.has(i) ? m : (rollLine(it, i, clamp(it.lvl + irnd(-1, 0), 1, 10), used, lucky) || m));
}
let RR = { uid: 0, keep: new Set(), cand: null };
function rrState(it) { if (RR.uid !== it.uid) RR = { uid: it.uid, keep: new Set(), cand: null }; return RR; }
function rerollPreview(it) {
  if (!owned(it) || !canReroll(it)) return;
  const st = rrState(it), c = rerollCostKeep(it, st.keep.size);
  if (st.keep.size >= it.mag.length) { toast('Phải để ít nhất 1 dòng tẩy luyện'); return; }
  if (!payGold(c)) return;
  st.cand = rollKeep(it, st.keep); uiSfx('learn'); save(); forgeModal(it);
}
function rerollAccept(it) {
  const st = rrState(it); if (!st.cand || !owned(it)) return;
  it.mag = st.cand; delete it.leg; st.cand = null;
  R.dirty = true; invDirty = true; toast('Đã nhận dòng mới'); save(); forgeModal(it);
}
/* So sanh luc chien mon voi bo dong khac (dang mac: luc chien that; trong tui: chi so mon) */
function magPowerDelta(it, mag) {
  const clone = Object.assign({}, it, { mag }), slot = slotOfEquipped(it, S.eq);
  if (slot) { const eq = Object.assign({}, S.eq); eq[slot] = clone; return power(calc(eq)) / Math.max(1, power(calc())) - 1; }
  return itemPower(clone) / Math.max(1, itemPower(it)) - 1;
}
function afterRc(r, reopen) {
  toast(r.msg); uiSfx(r.ok ? 'learn' : 'use'); log(esc(r.msg));
  R.dirty = true; invDirty = true; save(); reopen();
}
function platCard(it) {
  if (!it.set || it.set.kind !== 'platina') return '';
  const lv = it.plv || 0; if (lv >= PLAT_MAX) return '<div class="card"><b>Thăng cấp Bạch Kim</b> <small class="dim">Đã tối đa +10</small></div>';
  const u = PLAT_UP[lv], ok = S.gold >= platCost(u.cost.van) && matHave('misc', 'wc') >= u.inputs[0].qty && matHave('misc', 'mys') >= u.inputs[1].qty;
  return `<div class="card"><b>Thăng cấp Bạch Kim</b> <small class="dim">+${lv} → +${lv + 1} · thành công ${u.rate}% · mỗi cấp +${Math.round(PLAT_STEP * 100)}% thuộc tính gốc</small><br>
    <small>${u.inputs[0].qty} Thủy Tinh Trắng (có ${matHave('misc', 'wc')}) · ${u.inputs[1].qty} Thần Bí Khoáng Thạch (có ${matHave('misc', 'mys')}) · ${fmt(platCost(u.cost.van))} lượng</small>
    <div class="btnrow"><button class="btn" id="fPlat" ${ok ? '' : 'disabled'}>Thăng cấp</button></div></div>`;
}
function forgeModal(it) {
  const cur = it.enh || 0, max = cur >= ENH_MAX, gain = enhPowerGain(it), st = rrState(it);
  const tgtSel = max ? '' : `<select id="fTgt">${Array.from({ length: ENH_MAX - cur }, (_, i) => cur + 1 + i).map(t => `<option value="${t}" ${t === Math.min(ENH_MAX, cur + 3) ? 'selected' : ''}>+${t} (≈${fmt(enhExpected(it, t))})</option>`).join('')}</select>`;
  const keepN = st.keep.size, rc = rerollCostKeep(it, keepN);
  const magLines = mag => mag.map((m, i) => `<div class="${i % 2 ? 'h' : 'm'}">${esc(attrText(attrName(m.a), m.p.map(v => v === -1 ? 0 : v)))}${i % 2 ? ' (ẩn)' : ''}</div>`).join('');
  const rrBody = !canReroll(it) ? '<small class="dim">Đồ trắng / đồ bộ / đồ Tím không tẩy luyện được</small>' : st.cand ? (() => {
    const d = magPowerDelta(it, st.cand), col = d > 0.0005 ? 'cp' : d < -0.0005 ? 'cn' : 'dim';
    return `<div class="forgecmp"><div class="sl"><b>Dòng cũ</b>${magLines(it.mag)}</div><div class="sl"><b>Dòng mới</b>${magLines(st.cand)}</div></div>
      <p class="small">${Object.values(S.eq).includes(it) ? 'Lực chiến' : 'Chỉ số món'} nếu nhận: <b class="${col}">${pctTxt(d)}</b></p>
      <div class="btnrow"><button class="btn" id="fRrOk">Nhận dòng mới</button><button class="btn" id="fRrNo">Giữ dòng cũ</button></div>`;
  })() : `<small>Đánh dấu dòng muốn <b>giữ lại</b> (mỗi dòng +${REROLL_KEEP * 100}% giá). Kết quả hiện để so sánh trước khi nhận.</small>
      ${it.mag.map((m, i) => `<label class="keepl"><input type="checkbox" data-keep="${i}" ${st.keep.has(i) ? 'checked' : ''}><span class="${i % 2 ? 'h' : 'm'}">${esc(attrText(attrName(m.a), m.p.map(v => v === -1 ? 0 : v)))}${i % 2 ? ' (ẩn)' : ''}</span></label>`).join('')}
      <div class="btnrow"><button class="btn red" id="fRe" ${S.gold >= rc && keepN < it.mag.length ? '' : 'disabled'}>Tẩy luyện (${fmt(rc)} lượng${keepN ? `, giữ ${keepN} dòng` : ''})</button></div>`;
  modal(`<h3>Rèn đồ <small>${fmt(S.gold)} lượng</small></h3>${itemHTML(it)}
    <div class="card"><b>Cường hóa</b> <small class="dim">+${cur} / +${ENH_MAX} · mỗi cấp +${Math.round(ENH_STEP * 100)}% thuộc tính gốc</small><br>
      ${max ? '<small class="dim">Đã cường hóa tối đa</small>' : `<small>Giá ${fmt(enhCost(it))} lượng · thành công ${Math.round(enhChance(it) * 100)}% · thất bại chỉ mất ngân lượng${gain != null ? ` · lực chiến <b class="cp">${pctTxt(gain)}</b>` : ''}</small>`}
      <div class="btnrow"><button class="btn" id="fEnh" ${max || S.gold < enhCost(it) ? 'disabled' : ''}>Cường hóa lên +${cur + 1}</button></div>
      ${max ? '' : `<div class="btnrow"><small>Liên tục tới</small>${tgtSel}<button class="btn" id="fEnhTo" ${S.gold < enhCost(it) ? 'disabled' : ''}>Cường hóa liên tục</button></div><small class="dim">≈ chi phí kỳ vọng. Dừng khi đạt mức hoặc hết ngân lượng.</small>`}</div>
    <div class="card"><b>Tẩy luyện</b> <small class="dim">gieo lại ${(it.mag || []).length} dòng thuộc tính</small><br>${rrBody}</div>
    ${verVio() && !it.set && it.d >= 0 && it.d <= 9 && (isPhoiSrc(it) || it.vio) ? `<div class="card"><b>💎 Lò Ép Đồ</b> <small class="dim">${it.vio ? 'khảm đá thuộc tính vào phôi Huyền Tinh này' : 'lấy thuộc tính thành đá, hoặc chế tạo thành phôi Huyền Tinh'}</small><div class="btnrow"><button class="btn" id="fEp">Mở Lò Ép Đồ</button></div></div>` : ''}${platCard(it)}`, () => {
    $('#fEnh').onclick = () => enhance(it);
    const to = $('#fEnhTo'); if (to) to.onclick = () => { if (!owned(it)) return closeModal(); const r = enhanceTo(it, +$('#fTgt').value, S.gold); toast(r.tries ? `+${r.from} → +${it.enh || 0}: ${r.tries} lần, ${r.fail} thất bại, −${fmt(r.spent)} lượng` : 'Không đủ ngân lượng'); uiSfx(r.ok ? 'learn' : 'use'); forgeModal(it); };
    const re = $('#fRe'); if (re) re.onclick = () => rerollPreview(it);
    const ok = $('#fRrOk'), no = $('#fRrNo'); if (ok) ok.onclick = () => rerollAccept(it); if (no) no.onclick = () => { st.cand = null; toast('Giữ dòng cũ'); forgeModal(it); };
    document.querySelectorAll('#mBody [data-keep]').forEach(b => b.onchange = () => { const i = +b.dataset.keep; if (b.checked) st.keep.add(i); else st.keep.delete(i); forgeModal(it); });
    const lo = $('#fHtLo'); if (lo) lo.onclick = () => htModal();
    const fe = $('#fEp'); if (fe) fe.onclick = () => epModal(it.vio ? 'kham' : isHutSrc(it) ? 'hut' : 'phoi', it.uid);
    const pu = $('#fPlat'); if (pu) pu.onclick = () => afterRc(upgradePlatina(it), () => forgeModal(it));
  });
}
/* Cuong hoa hang loat do dang mac: moi buoc nang mon re nhat chua dat muc tieu, trong ngan sach (% ngan luong). Bo qua ngua. */
let BF = { tgt: 5, pct: 50 };
const batchItems = () => SLOTS.map(([k]) => S.eq[k]).filter(it => it && it.d !== 10);
function batchForge(target, budget) {
  const st = { tries: 0, ok: 0, spent: 0, items: new Set() };
  for (let g = 0; g < 600; g++) {
    const c = batchItems().filter(it => (it.enh || 0) < target).sort((a, b) => enhCost(a) - enhCost(b))[0];
    if (!c || enhCost(c) > S.gold || st.spent + enhCost(c) > budget) break;
    const cost = enhCost(c), r = enhTry(c); if (r === null) break;
    st.tries++; st.spent += cost; if (r) { st.ok++; st.items.add(c); }
  }
  if (st.tries) { R.dirty = true; invDirty = true; log(`Cường hóa hàng loạt: ${st.tries} lần, ${st.ok} thành công, −${fmt(st.spent)} lượng`); save(); }
  return st;
}
function batchForgeModal() {
  const items = batchItems(), need = items.reduce((a, it) => a + enhExpected(it, Math.max(BF.tgt, it.enh || 0)), 0), budget = Math.floor(S.gold * BF.pct / 100);
  modal(`<h3>Cường hóa hàng loạt <small>${fmt(S.gold)} lượng</small></h3>
    <p class="desc">Nâng mọi món đang mặc (trừ ngựa) lên mức mục tiêu, mỗi bước chọn món rẻ nhất trước. Thất bại chỉ mất ngân lượng.</p>
    <div class="card lootf"><div class="row">Mục tiêu <select id="bfT">${Array.from({ length: ENH_MAX }, (_, i) => i + 1).map(t => `<option value="${t}" ${t === BF.tgt ? 'selected' : ''}>+${t}</option>`).join('')}</select>
      · ngân sách <select id="bfP">${[25, 50, 75, 100].map(p => `<option value="${p}" ${p === BF.pct ? 'selected' : ''}>${p}%</option>`).join('')}</select> (${fmt(budget)} lượng)</div>
      <div class="stats">${items.map(it => `<span>${esc(it.n)}</span><span>+${it.enh || 0}${(it.enh || 0) < BF.tgt ? ` → +${BF.tgt} ≈${fmt(enhExpected(it, BF.tgt))}` : ' ✔'}</span>`).join('') || '<span class="dim">Chưa mặc trang bị</span><span></span>'}</div>
      <p class="small">Chi phí kỳ vọng tổng: <b>${fmt(need)}</b> lượng${need > budget ? ' (vượt ngân sách: sẽ dừng giữa chừng)' : ''}</p>
      <div class="btnrow"><button class="btn" id="bfGo" ${need > 0 && budget > 0 ? '' : 'disabled'}>Bắt đầu</button></div></div>`, () => {
    $('#bfT').onchange = e => { BF.tgt = +e.target.value; batchForgeModal(); };
    $('#bfP').onchange = e => { BF.pct = +e.target.value; batchForgeModal(); };
    $('#bfGo').onclick = () => { const r = batchForge(BF.tgt, budget); toast(r.tries ? `${r.tries} lần, ${r.ok} thành công, −${fmt(r.spent)} lượng` : 'Không đủ ngân lượng'); uiSfx(r.ok ? 'learn' : 'use'); refresh(); batchForgeModal(); };
  });
}
/* Lo Huyen Tinh: hop tu 3 mon, thang cap Huyen Tinh va khoang */
/* Lo Hoang Kim · Bach Kim: ghep manh + che Bach Kim. Huyen Tinh / da thuoc tinh: chi o Lo Ep Do (epdo.js) */
function htModal() {
  const shards = Object.keys(mats().shard), gpool = Object.values(S.eq).filter(x => x && canPlatBase(x)).concat(S.inv.filter(canPlatBase)).sort((a, b) => !platReady(b) - !platReady(a));
  modal(`<h3>Lò Hoàng Kim · Bạch Kim <small>${fmt(S.gold)} lượng</small></h3>
    ${verVio() ? `<div class="card"><b>💎 Huyền Tinh · đá thuộc tính · đồ Tím</b> <small class="dim">luyện / thăng cấp Huyền Tinh, lấy thuộc tính, chế phôi, khảm nạm đều ở Lò Ép Đồ</small><div class="btnrow"><button class="btn" id="htEp">Mở Lò Ép Đồ</button></div></div>` : ''}
    <div class="card"><b>Mảnh Hoàng Kim</b> <small class="dim">đủ mảnh ghép thành món bộ (rơi từ trùm)</small>
      ${shards.map(n => `<div class="btnrow"><small>${esc(n)} ${matHave('shard', n)}/${SHARDS[n]}</small><button class="btn" data-sh="${esc(n)}" ${matHave('shard', n) >= SHARDS[n] ? '' : 'disabled'}>Ghép</button></div>`).join('') || '<small class="dim">Chưa có mảnh</small>'}</div>
    <div class="card"><b>Chế Bạch Kim (Thiên Tứ…)</b> <small class="dim">2 món Hoàng Kim trùng tên (món phụ tự chọn trong hành trang) + ${PLAT_MAKE.inputs[1].qty} Thủy Tinh Trắng (có ${matHave('misc', 'wc')}) + ${PLAT_MAKE.inputs[2].qty} Thần Bí Khoáng Thạch (có ${matHave('misc', 'mys')}) + ${fmt(platCost(PLAT_MAKE.cost.van))} lượng · thành công ${PLAT_MAKE.rate}%, thất bại chỉ mất nguyên liệu. Món đang mặc chế xong tự mặc lại.</small>
      ${gpool.map(i => { const res = platResult(i.n), fl = platFiller(i), why = platReady(i), worn = Object.values(S.eq).includes(i);
        return `<div class="platrow"><span><b style="color:${RAR_COL[4]}">${esc(i.n)}</b>${worn ? ' <small class="cp">đang mặc</small>' : ''}${i.lock ? ' 🔒' : ''}<br><small>→ <span style="color:${RAR_COL[5]}">${esc(res ? res.n : '?')}</span><br>${fl ? 'Phụ: ' + esc(fl.n) + ' ✔' : `<span class="cn">${platLockedTwin(i) ? 'Món trùng tên đang khóa 🔒' : 'Chưa có món trùng tên'}</span>`}</small></span>
          <span class="btnrow"><button class="btn sm" data-pm="${i.uid}" ${why ? `disabled title="${esc(why)}"` : ''}>Chế</button><button class="btn sm" data-pu="${i.uid}" ${why ? 'disabled' : ''}>Tới khi được</button></span></div>`; }).join('') || '<small class="dim">Chưa có Hoàng Kim nào chế được Bạch Kim</small>'}</div>`, () => {
    const ep = $('#htEp'); if (ep) ep.onclick = () => epModal('tl');
    document.querySelectorAll('#mBody [data-sh]').forEach(b => b.onclick = () => afterRc(combineShards(b.dataset.sh), htModal));
    document.querySelectorAll('#mBody [data-pm]').forEach(b => b.onclick = () => { const it = gpool.find(i => i.uid === +b.dataset.pm); if (it) afterRc(makePlatina(it), htModal); });
    document.querySelectorAll('#mBody [data-pu]').forEach(b => b.onclick = () => { const it = gpool.find(i => i.uid === +b.dataset.pu); if (it) afterRc(makePlatinaUntil(it), htModal); });
  });
}
