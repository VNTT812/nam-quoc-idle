/* ======================= DON KHO =======================
   Mot nut don ca Hanh trang + Ruong ep (kho ren) + Kho chung khi day:
   - Trang suc thua (nhan / day chuyen / ngoc boi) -> luyen Huyen Tinh (trang suc trong Kho chung chuyen sang Ruong ep truoc)
   - Ban do trang, do xanh / vang khong khop bo loc, (tuy chon) Hoang Kim khong thuoc bo dang giu
   Khong bao gio dung: mon khoa 🔒, do Tim / phoi, Bach Kim, Than ma, do dang mac, do tot hon do dang mac, do can tra Da Tau. */
'use strict';
const DK = { inv: true, box: true, st: false, jew: true, white: true, blue: true, gold: false, lv: 10 };
const dkSafe = it => !!it && !it.lock && !it.vio && !it.plv && !it.thanma && !(typeof dtNeed === 'function' && dtNeed(it)) && !Object.values(S.eq).includes(it);
const dkJew = it => verVio() && FUSE_SLOTS.includes(it.d) && !it.set;
function dkCat(it, own) {                    // own: mon cua nhan vat (hanh trang / ruong ep) -> kiem tra tot hon do dang mac
  if (!dkSafe(it) || (it.lvl || 1) > DK.lv) return '';
  if (own && !it.set && typeof betterThanEquipped === 'function' && betterThanEquipped(it)) return '';
  if (DK.jew && dkJew(it)) return 'jew';
  if (it.set) return DK.gold && !setKept(it) && !it.enh ? 'gold' : '';
  if (lootMatch(it)) return '';
  if ((it.r || 0) === 0) return DK.white ? 'white' : '';
  return DK.blue ? 'blue' : '';
}
function dkPlan() {
  const p = { inv: [], box: [], st: [], jew: 0, stJew: [], gold: 0 };
  const add = (where, it, own) => { const c = dkCat(it, own); if (!c) return; if (c === 'jew') { if (where === 'st') p.stJew.push(it); else p.jew++; return; } p[where].push(it); p.gold += itemValue(it); };
  if (DK.inv) for (const it of S.inv) add('inv', it, true);
  if (DK.box) for (const it of epBox()) add('box', it, true);
  if (DK.st) { const { st, err } = stashRead(); if (!err) for (const it of st.items) add('st', it, false); }
  return p;
}
function dkRun() {
  const res = { moved: 0, fused: 0, sold: 0, gold: 0, msg: [] };
  // 1. trang suc trong Kho chung -> Ruong ep (de luyen)
  if (DK.st && DK.jew && verVio()) {
    const r = stashTx(st => {
      const take = st.items.filter(it => dkCat(it, false) === 'jew').slice(0, Math.max(0, EP_BOX_MAX - epBox().length));
      if (!take.length) return { ok: false };
      st.items = st.items.filter(x => !take.includes(x)); for (const x of take) epBox().push(x);
      return { ok: true, from: 'stash', n: take.length, undo: () => { for (const x of take) { const i = epBox().indexOf(x); if (i >= 0) epBox().splice(i, 1); } } };
    });
    if (r && r.ok) res.moved = r.n;
  }
  // 2. luyen Huyen Tinh tu trang suc thua (hanh trang + ruong ep)
  if (DK.jew && verVio()) {
    const got = {};
    for (let g = 0; g < 200; g++) {
      const pool = fusePool().filter(x => (x.lvl || 1) <= DK.lv && (DK.inv || !S.inv.includes(x)) && (DK.box || DK.st || !epBox().includes(x))).slice(0, 3);
      if (pool.length < 3 || S.gold < fuseCost()) break;
      const r = fuse(pool); if (!r.ok) break; res.fused++; got[r.lvl] = (got[r.lvl] || 0) + 1;
    }
    if (res.fused) res.msg.push(`luyện ${res.fused} Huyền Tinh (${Object.entries(got).map(([l, c]) => `${c}×c${l}`).join(', ')})`);
  }
  // 3. ban do trong hanh trang + ruong ep
  const p = dkPlan();
  for (const [where, list] of [['inv', p.inv], ['box', p.box]]) for (const it of list) {
    const arr = where === 'inv' ? S.inv : epBox(), i = arr.indexOf(it); if (i < 0) continue;
    arr.splice(i, 1); const v = itemValue(it); S.gold += v; res.gold += v; res.sold++;
  }
  // 4. ban do trong Kho chung (ghi kho truoc, roi cong ngan luong)
  if (DK.st && p.st.length) {
    const r = stashTx(st => {
      const keep = [], sold = []; for (const it of st.items) (dkCat(it, false) && dkCat(it, false) !== 'jew' ? sold : keep).push(it);
      if (!sold.length) return { ok: false };
      const v = sold.reduce((a, x) => a + itemValue(x), 0); st.items = keep; S.gold += v;
      return { ok: true, from: 'stash', n: sold.length, v, undo: () => { S.gold -= v; } };
    });
    if (r && r.ok) { res.sold += r.n; res.gold += r.v; }
  }
  if (res.moved) res.msg.unshift(`chuyển ${res.moved} trang sức từ Kho chung sang Rương ép`);
  if (res.sold) res.msg.push(`bán ${res.sold} món (+${fmt(res.gold)} lượng)`);
  invDirty = true; R.dirty = true; save();
  return res;
}
/* ---------- DON HET: ban toan bo (ke ca Tim, Hoang Kim, Bach Kim, ngua) - chi giu mon khoa 🔒, do dang mac, do can cho Da Tau ---------- */
const dkAllSafe = it => !!it && !it.lock && !Object.values(S.eq).includes(it) && !(typeof dtNeed === 'function' && dtNeed(it));
function dkAllPlan() {
  const p = { inv: [], box: [], st: [], gold: 0, kind: {} };
  const add = (w, it) => { if (!dkAllSafe(it)) return; p[w].push(it); p.gold += itemValue(it); const k = it.thanma || (typeof isHorse === 'function' && isHorse(it)) ? 'Ngựa' : it.vio ? 'Tím' : RAR_VI[it.r || 0] || 'Thường'; p.kind[k] = (p.kind[k] || 0) + 1; };
  if (DK.inv) for (const it of S.inv) add('inv', it);
  if (DK.box) for (const it of epBox()) add('box', it);
  if (DK.st) { const { st, err } = stashRead(); if (!err) for (const it of st.items) add('st', it); }
  return p;
}
function dkAllRun() {
  const p = dkAllPlan(); let n = 0, g = 0;
  for (const [arr, list] of [[S.inv, p.inv], [epBox(), p.box]]) for (const it of list) { const i = arr.indexOf(it); if (i < 0) continue; arr.splice(i, 1); const v = itemValue(it); S.gold += v; g += v; n++; }
  if (DK.st && p.st.length) {
    const r = stashTx(st => {
      const keep = [], sold = []; for (const it of st.items) (dkAllSafe(it) ? sold : keep).push(it);
      if (!sold.length) return { ok: false };
      const v = sold.reduce((a, x) => a + itemValue(x), 0); st.items = keep; S.gold += v;
      return { ok: true, from: 'stash', n: sold.length, v, undo: () => { S.gold -= v; } };
    });
    if (r && r.ok) { n += r.n; g += r.v; }
  }
  invDirty = true; R.dirty = true; save();
  return { n, g };
}
function donHetModal() {
  const p = dkAllPlan(), tot = p.inv.length + p.box.length + p.st.length;
  const where = [DK.inv && `Hành trang ${p.inv.length}`, DK.box && `Rương ép ${p.box.length}`, DK.st && `Kho chung ${p.st.length}`].filter(Boolean).join(' · ');
  const hi = ['Tím', 'Hoàng Kim', 'Bạch Kim', 'Ngựa'].filter(k => p.kind[k]);
  modal(`<h3>⚠ Dọn hết</h3>
    <div class="card warnc"><b class="bad">Lưu ý: bán TOÀN BỘ ${tot} món, không lấy lại được.</b>
      <div class="small">Không xét bộ lọc, cấp, độ hiếm: bán cả đồ Tím / phôi, Hoàng Kim, Bạch Kim, ngựa, trang sức.</div>
      <div class="small">Chỉ giữ: món khóa 🔒, đồ đang mặc, đồ cần cho Dã Tẩu.</div></div>
    <table class="dktbl small"><tr><th>Nơi</th><td>${where || '—'}</td></tr>
      <tr><th>Loại</th><td>${Object.entries(p.kind).map(([k, c]) => `${k} ${c}`).join(' · ') || '—'}</td></tr>
      <tr><th>Nhận</th><td><b>+${fmt(p.gold)} lượng</b></td></tr></table>
    ${hi.length ? `<p class="small bad">Có ${hi.map(k => `${p.kind[k]} ${k}`).join(', ')}: hãy khóa 🔒 món muốn giữ trước khi dọn.</p>` : ''}
    <div class="btnrow"><button class="btn red" id="dhGo" ${tot ? '' : 'disabled'}>Xác nhận dọn hết ${tot} món</button><button class="btn" id="dhNo">Quay lại</button></div>`, () => {
    $('#dhNo').onclick = () => donKhoModal();
    $('#dhGo').onclick = () => { const r = dkAllRun(); const t = r.n ? `Dọn hết: bán ${r.n} món (+${fmt(r.g)} lượng)` : 'Không có gì để dọn'; toast(t); log(`<span class="dim">🧹 ${t}.</span>`); refresh(); donKhoModal(); };
  });
}
function donKhoModal() {
  const { st, err } = stashRead(), p = dkPlan();
  const jewSt = p.stJew.length, jewAll = p.jew + jewSt, fuseN = Math.floor(jewAll / 3);
  const ck = (k, t) => `<label class="small" style="display:block"><input type="checkbox" data-dk="${k}" ${DK[k] ? 'checked' : ''}> ${t}</label>`;
  const row = (n, c, m) => `<tr><td>${n}</td><td>${c}</td><td>${m}</td></tr>`;
  modal(`<h3>🧹 Dọn kho</h3>
    <div class="card"><b>Dọn ở đâu</b>
      ${ck('inv', `Hành trang <small class="dim">${S.inv.length}/${INV_MAX}</small>`)}
      ${ck('box', `Rương ép <small class="dim">${epBox().length}/${EP_BOX_MAX}</small>`)}
      ${ck('st', `Kho chung <small class="dim">${err ? 'không đọc được' : `${st.items.length}/${STASH_MAX}`} · dùng chung 3 nhân vật, xét theo bộ lọc của nhân vật này</small>`)}</div>
    <div class="card"><b>Dọn gì</b>
      ${verVio() ? ck('jew', 'Nhẫn / dây chuyền / ngọc bội thừa → luyện Huyền Tinh') : ''}
      ${ck('white', 'Bán đồ trắng')}
      ${ck('blue', 'Bán đồ xanh không khớp bộ lọc nhặt đồ')}
      ${ck('gold', 'Bán Hoàng Kim không thuộc bộ đang giữ (bộ phái khác / ngoài danh sách giữ, chưa cường hóa)')}
      <div class="row small">Chỉ dọn món cấp ≤ <select id="dkLv">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${DK.lv === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div></div>
    <table class="dktbl small"><tr><th>Nơi</th><th>Bán</th><th>Trang sức luyện</th></tr>
      ${row('Hành trang', DK.inv ? p.inv.length : '—', '')}${row('Rương ép', DK.box ? p.box.length : '—', '')}${row('Kho chung', DK.st ? p.st.length : '—', DK.st ? jewSt : '—')}
      ${row('<b>Tổng</b>', `<b>${p.inv.length + p.box.length + p.st.length}</b> (+${fmt(p.gold)} lượng)`, DK.jew && verVio() ? `<b>${jewAll}</b> → ~${fuseN} Huyền Tinh (${fmt(fuseCost())}/lần)` : '—')}</table>
    <p class="dim small">Luôn giữ: món khóa 🔒, đồ Tím / phôi, Bạch Kim, Thần Mã, đồ đang mặc hoặc tốt hơn đồ đang mặc, đồ cần cho Dã Tẩu.</p>
    <div class="btnrow"><button class="btn red" id="dkGo">Dọn ngay</button><button class="btn red" id="dkAll" title="Bán toàn bộ, chỉ giữ món khóa">⚠ Dọn hết</button><button class="btn" id="dkNo">Đóng</button></div>`, () => {
    document.querySelectorAll('#mBody [data-dk]').forEach(c => c.onchange = () => { DK[c.dataset.dk] = c.checked; donKhoModal(); });
    $('#dkLv').onchange = e => { DK.lv = +e.target.value; donKhoModal(); };
    $('#dkNo').onclick = () => closeModal();
    $('#dkAll').onclick = () => donHetModal();
    $('#dkGo').onclick = () => { const r = dkRun(); const t = r.msg.length ? 'Dọn kho: ' + r.msg.join(', ') : 'Không có gì để dọn'; toast(t); log(`<span class="dim">🧹 ${t}.</span>`); refresh(); donKhoModal(); };
  });
}
