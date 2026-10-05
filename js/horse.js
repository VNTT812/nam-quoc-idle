/* ======================= MA TRUONG: THUAN DUONG NGUA + SO NGUA =======================
   Ngua (o 'horse', mua o cua hang hoac roi tu trum / pho ban) co them cap thuan duong 0..20 luu tren chinh mon do (it.hlv, it.hxp):
   - moi cap +4% cac chi so duong cua ngua (toc do, sinh luc, ...), phat ne tranh (adddefense_v am cua ngua thuong) giam 5% / cap -> cap 20 het phat
   - ngua len cap khi dang cuoi va ha quai (thuong 1, tinh anh 3, trum 10 diem) hoac cho an bang ngan luong
   - chuyen thuan duong sang ngua moi: giu 80% cap
   So ngua: moi loai ngua tung cuoi ha quai +1% sinh luc toi da (toi da 10%).
   Toc do di chuyen (fastwalkrun_p) con rut ngan thoi gian cho giua cac dot quai (mountHaste). */
'use strict';
const HORSE_MAX = 20, HORSE_UP = 0.04, HORSE_PEN = 0.05, HORSE_FEED_XP = 25, HORSE_KEEP = 0.8, HBOOK_MAX = 10;
/* v150: ngua hiem hon - trum bai (3 phut / con) 0.3%, Trum Hoang Kim 2%, pho ban x0.4, Boss tuan hang S 15% */
const HORSE_DROP = { boss: 0.003, gb: 0.02, dg: 0.4, wbS: 0.15 };
const HORSE_RARE = [5, 6, 7, 8, 9, 10, 11, 12, 13, 19, 20, 21];
const isHorse = it => !!it && it.d === 10;
const horseLv = it => (it && it.hlv) | 0;
const horseNeed = lv => 40 + lv * 35;
/* Gia tri thuoc tinh goc cua ngua sau thuan duong */
function horseAdj(it, v) {
  if (!isHorse(it)) return v;
  const lv = horseLv(it);
  return v >= 0 ? v * (1 + HORSE_UP * lv) : v * Math.max(0, 1 - HORSE_PEN * lv);
}
const horseBook = () => S.hbook || (S.hbook = {});
const horseBookCount = () => Object.keys(horseBook()).length;
function horseAttr(A) { const n = Math.min(HBOOK_MAX, horseBookCount()); if (n) addAttr(A, 'lifemax_p', [n, 0, 0]); }
function horseKindName(k) { const b = horseBook()[k]; if (typeof b === 'string') return b; if (isNaN(+k)) return k; const g = J.items[10]; const r = g && g.list.find(x => x.k === +k); return r ? r.n.replace(/\s+\d+$/, '') : 'Ngựa'; }

function horseGainXp(n, quiet) {
  const it = S.eq.horse; if (!isHorse(it)) return false;
  const book = horseBook(), key = it.n.replace(/\s+\d+$/, '');
  if (!book[key]) { if (book[it.k] === key) delete book[it.k]; book[key] = key; R.dirty = true; if (!quiet && !R.quiet) log(`Sổ ngựa: thêm <b>${esc(key)}</b> (${horseBookCount()} loài, +${Math.min(HBOOK_MAX, horseBookCount())}% sinh lực)`); }
  if (horseLv(it) >= HORSE_MAX) return false;
  it.hxp = (it.hxp || 0) + n; let up = false;
  while (horseLv(it) < HORSE_MAX && it.hxp >= horseNeed(horseLv(it))) { it.hxp -= horseNeed(horseLv(it)); it.hlv = horseLv(it) + 1; up = true; }
  if (horseLv(it) >= HORSE_MAX) it.hxp = 0;
  if (up) {
    R.dirty = true; invDirty = true;
    if (!R.quiet) { log(`<b class="up">${esc(it.n)}</b> thuần dưỡng lên cấp ${it.hlv}`); if (!quiet) addText(H.x, H.y - 70, `Ngựa cấp ${it.hlv}`, '#ffd24a', 12); }
    if (typeof recSet === 'function') recSet('horseLv', it.hlv, { n: it.n });
  }
  return up;
}
const horseFeedCost = it => Math.round((300 + S.lvl * 80) * (1 + horseLv(it) * 0.2));
function horseFeed(times = 1) {
  const it = S.eq.horse; if (!isHorse(it)) return { ok: false, msg: 'Chưa cưỡi ngựa' };
  let n = 0, spent = 0;
  for (; n < times && horseLv(it) < HORSE_MAX; n++) { const c = horseFeedCost(it); if (S.gold < c) break; S.gold -= c; spent += c; horseGainXp(HORSE_FEED_XP, true); }
  if (!n) return { ok: false, msg: horseLv(it) >= HORSE_MAX ? 'Ngựa đã thuần dưỡng tối đa' : 'Không đủ ngân lượng' };
  save(); return { ok: true, msg: `Cho ăn ${n} lần (−${fmt(spent)} lượng) · cấp ${horseLv(it)}` };
}
const horseMoveCost = () => Math.round(2000 * (1 + S.lvl / 10));
function horseTransfer(to) {
  const from = S.eq.horse;
  if (!isHorse(from) || !isHorse(to) || from === to || !(S.inv.includes(to) || stable().includes(to))) return { ok: false, msg: 'Chọn một ngựa trong hành trang' };
  const lv = Math.floor(horseLv(from) * HORSE_KEEP); if (lv <= horseLv(to)) return { ok: false, msg: 'Ngựa nhận đã có cấp cao hơn hoặc bằng' };
  if (!payGold(horseMoveCost())) return { ok: false, msg: 'Không đủ ngân lượng' };
  to.hlv = lv; to.hxp = 0; from.hlv = 0; from.hxp = 0;
  R.dirty = true; invDirty = true; save();
  return { ok: true, msg: `Chuyển thuần dưỡng: ${to.n} cấp ${lv}` };
}
/* Ngua roi ra: loai thuong (0..4) hoac hiem; bac cao nhat ma nhan vat cuoi duoc ngay */
function horseRoll(rare) {
  const g = J.items[10]; if (!g) return null;
  const lvReq = r => (r.req.find(q => q[0] === 36) || [0, 0])[1];
  const kinds = rare ? HORSE_RARE : [0, 1, 2, 3, 4];
  const ok = kinds.map(k => g.list.filter(r => r.k === k && sexReqOk(r.req) && lvReq(r) <= eqLevel())).filter(l => l.length);
  if (!ok.length) return rare ? horseRoll(false) : null;
  const rows = pick(ok), row = rows.reduce((b, r) => (r.lvl > b.lvl ? r : b));
  const it = makeItem(10, row.k, row.lvl, 0); if (!it) return null;
  if (rare) { it.r = 2; it.rareH = 1; }                   // ngua hiem: vien Vang (nhu JX1, mau Tim chi danh cho do kham Huyen Tinh)
  return it;
}
function horseOnKill(e) {
  horseGainXp(e.cls === 'boss' ? 10 : e.cls === 'elite' ? 3 : 1);
  if (e.cls !== 'boss' || R.dg || S.lvl < 20) return;
  if (Math.random() < (e.goldBoss ? HORSE_DROP.gb : HORSE_DROP.boss)) { const it = e.goldBoss ? rareHorse() : horseRoll(false); if (it) { dropToGround(it, e); log(`🐎 <b style="color:${RAR_COL[it.r]}">${esc(it.n)}</b> rơi ra!`); } }
}
const mountHaste = () => clamp(R.P ? R.P.speed : 1, 1, 1.8);

/* ---------- hieu ung phi ngua: bui duoi chan khi di chuyen ---------- */
function drawMount(c, dt) {
  if (!S.eq.horse || !R.mounted || S.lowFx) { R.dust = null; return; }
  const D = R.dust || (R.dust = []);
  if (H.moving && R.deadT <= 0) { R.dustT = (R.dustT || 0) - dt; if (R.dustT <= 0) { R.dustT = 0.07; D.push({ x: H.x + rnd(-8, 8), y: H.y + rnd(-2, 3), life: 0.55 }); } }
  for (const d of D) { d.life -= dt; const a = clamp(d.life / 0.55, 0, 1); c.globalAlpha = a * 0.45; c.fillStyle = (lookOn() && R.look && R.look.dust) || '#b89c6c'; c.beginPath(); c.ellipse(d.x, d.y, 4 + (1 - a) * 9, 2 + (1 - a) * 3, 0, 0, 7); c.fill(); }
  c.globalAlpha = 1; R.dust = D.filter(d => d.life > 0);
}

/* ---------- Ma Truong: noi chua ngua (S.stable) ---------- */
const STABLE_MAX = 30;
const stable = () => S.stable || (S.stable = []);
function stableIn(it) {
  if (!isHorse(it) || !S.inv.includes(it)) return { ok: false, msg: 'Chọn ngựa trong hành trang' };
  if (stable().length >= STABLE_MAX) return { ok: false, msg: `Mã Trường đầy (${STABLE_MAX})` };
  S.inv = S.inv.filter(x => x !== it); stable().push(it); invDirty = true; save();
  return { ok: true, msg: 'Đã đưa ' + it.n + ' vào Mã Trường' };
}
function stableOut(it) {
  const st = stable(); if (!st.includes(it)) return { ok: false, msg: 'Không có trong Mã Trường' };
  if (S.inv.length >= INV_MAX) return { ok: false, msg: 'Hành trang đầy' };
  S.stable = st.filter(x => x !== it); S.inv.unshift(it); invDirty = true; save();
  return { ok: true, msg: 'Lấy ' + it.n + ' ra hành trang' };
}
/* cuoi ngua tu Ma Truong / hanh trang: ngua dang cuoi ve Ma Truong (day thi ve hanh trang) */
function stableRide(it) {
  if (!isHorse(it)) return { ok: false, msg: 'Không phải ngựa' };
  if (!reqOk(it)) return { ok: false, msg: 'Chưa đủ điều kiện: ' + reqProblems(it).join('; ') };
  const old = S.eq.horse;
  S.stable = stable().filter(x => x !== it); S.inv = S.inv.filter(x => x !== it);
  S.eq.horse = it;
  if (old && old !== it) { if (stable().length < STABLE_MAX) stable().push(old); else S.inv.unshift(old); }
  R.dirty = true; invDirty = true; R.rideCd = 0; if (typeof setMount === 'function') setMount(true, true); save();
  return { ok: true, msg: 'Cưỡi ' + it.n };
}
/* o Ngua o the Nhan vat: chon ngua trong Ma Truong / hanh trang de cuoi */
function horsePickModal() {
  const cur = S.eq.horse, list = stable().map(h => [h, 'st']).concat(S.inv.filter(isHorse).map(h => [h, 'inv']));
  const row = ([h, w]) => `<div class="qrow"><span><b style="color:${RAR_COL[h.r]}">${esc(h.n)}</b><small>${w === 'st' ? 'Mã Trường' : 'Hành trang'} · cấp yêu cầu ${(h.req.find(q => q[0] === 36) || [0, 0])[1]} · thuần dưỡng ${horseLv(h)} · ${esc(horseStatLine(h))}</small></span>
    <span class="btnrow"><button class="btn sm" data-hr="${h.uid}" ${reqOk(h) ? '' : 'disabled'}>Cưỡi</button></span></div>`;
  modal(`<h3>Chọn ngựa <small>${stable().length}/${STABLE_MAX} trong Mã Trường</small></h3>
    ${cur ? `<div class="card"><b style="color:${RAR_COL[cur.r]}">${esc(cur.n)}</b> <small class="dim">đang dùng · thuần dưỡng ${horseLv(cur)}</small><p class="small">${esc(horseStatLine(cur))}</p>
      <div class="btnrow"><button class="btn" id="hpInfo">Chi tiết</button><button class="btn" id="hpBack" ${stable().length < STABLE_MAX ? '' : 'disabled'}>Cất vào Mã Trường</button></div></div>` : ''}
    ${list.length ? list.map(row).join('') : '<p class="dim small">Chưa có ngựa nào khác. Ngựa nhặt được nằm trong hành trang, bấm vào ngựa → "Cất vào Mã Trường".</p>'}
    <div class="btnrow"><button class="btn" id="hpStable">Mở Mã Trường</button></div>`, () => {
    document.querySelectorAll('#mBody [data-hr]').forEach(b => b.onclick = () => { const h = list.map(x => x[0]).find(x => x.uid === +b.dataset.hr); const r = stableRide(h); toast(r.msg); if (r.ok) { uiSfx('equipCloth'); refresh(); } horsePickModal(); });
    const bi = $('#hpInfo'); if (bi) bi.onclick = () => itemModal(cur, 'horse');
    const bb = $('#hpBack'); if (bb) bb.onclick = () => { delete S.eq.horse; stable().push(cur); R.mounted = false; R.dirty = true; invDirty = true; save(); refresh(); horsePickModal(); };
    const bs = $('#hpStable'); if (bs) bs.onclick = () => { if (typeof actModal === 'function') actModal('horse'); };
  });
}

/* ---------- giao dien ---------- */
function horseStatLine(it) {
  const parts = [];
  for (const [id, mn, mx] of it.base) {
    const nm = attrName(id); if (nm === 'staminamax_v') continue;
    const v = Math.round(horseAdj(it, (mn + mx) / 2 * enhMul(it)));
    parts.push(attrText(nm, [v, 0, v]));
  }
  return parts.join(' · ');
}
function stableBody() {
  const it = S.eq.horse, inv = S.inv.filter(isHorse), bn = horseBookCount(), st = stable();
  const cur = isHorse(it) ? (() => {
    const lv = horseLv(it), need = horseNeed(lv), pct = lv >= HORSE_MAX ? 100 : Math.round((it.hxp || 0) / need * 100);
    return `<div class="card"><div class="idet"><div class="pic r${it.r}">${it.ic ? `<img src="${esc(it.ic)}" alt="">` : ''}</div><div><h4 style="color:${RAR_COL[it.r]}">${esc(it.n)}</h4>
      <small class="dim">Thuần dưỡng cấp <b>${lv}/${HORSE_MAX}</b> · chỉ số +${Math.round(lv * HORSE_UP * 100)}% · phạt né tránh −${Math.min(100, Math.round(lv * HORSE_PEN * 100))}%</small></div></div>
      <div class="bar xpb"><i style="width:${pct}%"></i><span>${lv >= HORSE_MAX ? 'Tối đa' : `${Math.floor(it.hxp || 0)} / ${need}`}</span></div>
      <p class="small">${esc(horseStatLine(it))}</p>
      <div class="btnrow"><button class="btn" id="hFeed" ${lv < HORSE_MAX && S.gold >= horseFeedCost(it) ? '' : 'disabled'}>Cho ăn (${fmt(horseFeedCost(it))} lượng, +${HORSE_FEED_XP})</button><button class="btn" id="hFeed10" ${lv < HORSE_MAX && S.gold >= horseFeedCost(it) ? '' : 'disabled'}>Cho ăn ×10</button></div></div>`;
  })() : `<div class="card"><p class="desc">Chưa cưỡi ngựa. Ngựa mua ở cửa hàng Biện Kinh (thẻ Ngựa, từ cấp 20) hoặc rơi hiếm từ trùm. Thần mã có thuộc tính: xem thẻ <b>Thần mã</b>.</p></div>`;
  const hrow = (h, w) => `<div class="qrow"><span><b style="color:${RAR_COL[h.r]}">${esc(h.n)}</b><small>cấp yêu cầu ${(h.req.find(q => q[0] === 36) || [0, 0])[1]} · thuần dưỡng ${horseLv(h)} · ${esc(horseStatLine(h))}</small></span><small></small>
    <span class="btnrow"><button class="btn sm" data-ride="${h.uid}" ${reqOk(h) ? '' : 'disabled'}>Cưỡi</button>${isHorse(it) && Math.floor(horseLv(it) * HORSE_KEEP) > horseLv(h) ? `<button class="btn sm" data-mv="${h.uid}">Chuyển cấp (${fmt(horseMoveCost())})</button>` : ''}${w === 'st' ? `<button class="btn sm" data-sout="${h.uid}">Lấy ra</button>` : `<button class="btn sm" data-sin="${h.uid}">Cất vào Mã Trường</button>`}</span></div>`;
  const list = inv.map(h => hrow(h, 'inv')).join(''), slist = st.map(h => hrow(h, 'st')).join('');
  const kinds = Object.keys(horseBook()).map(k => `<span class="chip2">${esc(horseKindName(k))}</span>`).join('');
  return `<p class="desc">Ngựa đang cưỡi lên cấp khi hạ quái (thường 1, tinh anh 3, trùm 10) hoặc cho ăn. Mỗi cấp +${HORSE_UP * 100}% chỉ số ngựa, giảm ${HORSE_PEN * 100}% phạt né tránh. Tốc độ chạy của ngựa chỉ tính khi đang cưỡi (phím M / Auto tự lên ngựa khi di chuyển).</p>
    ${cur}
    <h4 class="rech">Ngựa trong Mã Trường <small class="dim">${st.length}/${STABLE_MAX}</small></h4>${slist || '<p class="dim small">Trống. Ngựa nhặt được nằm trong hành trang: bấm "Cất vào Mã Trường".</p>'}
    <h4 class="rech">Ngựa trong hành trang</h4>${list || '<p class="dim small">Không có ngựa nào khác. Chuyển thuần dưỡng sang ngựa mới giữ 80% cấp.</p>'}
    <h4 class="rech">Sổ ngựa <small class="dim">${bn} loài · +${Math.min(HBOOK_MAX, bn)}% sinh lực (tối đa ${HBOOK_MAX}%)</small></h4><div class="chips">${kinds || '<small class="dim">Cưỡi ngựa hạ quái để ghi vào sổ</small>'}</div>`;
}
function bindStable(reopen) {
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  const done = r => { toast(r.msg); if (r.ok) uiSfx('learn'); reopen(); };
  on('#hFeed', () => done(horseFeed(1))); on('#hFeed10', () => done(horseFeed(10)));
  const find = uid => S.inv.concat(stable()).find(x => x.uid === +uid);
  document.querySelectorAll('#mBody [data-ride]').forEach(b => b.onclick = () => { const h = find(b.dataset.ride); if (h) { const r = stableRide(h); toast(r.msg); refresh(); } reopen(); });
  document.querySelectorAll('#mBody [data-mv]').forEach(b => b.onclick = () => done(horseTransfer(find(b.dataset.mv))));
  document.querySelectorAll('#mBody [data-sin]').forEach(b => b.onclick = () => done(stableIn(find(b.dataset.sin))));
  document.querySelectorAll('#mBody [data-sout]').forEach(b => b.onclick = () => done(stableOut(find(b.dataset.sout))));
}
