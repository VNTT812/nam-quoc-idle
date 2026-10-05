/* ======================= KY TRAN CAC (cua hang vat pham quy - tieu ngan luong) =======================
   Gia co dinh, mua bang Kim Nguyen Bao (tru Ruong Da Thuoc Tinh: ngan luong). Mua la dung / mo ngay.
   - Tien Thao Lo: +50% kinh nghiem 60 phut (cong don thoi gian, nhan rieng voi hieu ung moc cap).
   - Que Hoa Tuu: +20 diem may man 60 phut. May man: nhieu dong ma thuat hon / dong cap cao hon, do Hoang Kim dong tot hon,
     va (tu ban nay) +0,5% ti le roi do moi diem.
   - Ruong Huyen Tinh: 2-3 Huyen Tinh cap theo cap nhan vat. Ruong Da Thuoc Tinh: 1-2 da thuoc tinh hop do dang mac (ca 2 mua bang ngan luong).
   - Lenh Bai Doi Phai: doi mon phai (ca khac he), hoan diem ky nang. */
'use strict';
const KNB_GOLD = 1000000, KNB_DAY = 20, DGT_KNB = 10;   // v132: 1 KNB = 1 trieu luong, toi da 20 / ngay; The Doi Gioi Tinh 10 KNB
const LDT_BUY_DAY = 5;   // Lenh Bai Da Tau: mua toi da 5 / ngay
const ldtDay = () => { const r = RW(), d = dayKey(new Date()); if (!r.ldtBuy || r.ldtBuy.d !== d) r.ldtBuy = { d, n: 0 }; return r.ldtBuy; };
const knbDay = () => { const r = RW(), d = dayKey(new Date()); if (!r.knbBuy || r.knbBuy.d !== d) r.knbBuy = { d, n: 0 }; return r.knbBuy; };
const KTC = [   // gia co dinh: knb = Kim Nguyen Bao, gold = ngan luong (chi Ruong Da)
  { k: 'knb', n: 'Kim Nguyên Bảo', ic: 'img/ep/knb.png', gold: KNB_GOLD, d: `Đổi ngân lượng lấy Kim Nguyên Bảo · tối đa ${KNB_DAY} / ngày`, use: () => { S.knb = (S.knb || 0) + 1; knbDay().n++; return 'Nhận 1 Kim Nguyên Bảo'; } },
  { k: 'tt', n: 'Tiên Thảo Lộ', ic: 'img/ep/tt.png', knb: 2, d: '+50% kinh nghiệm trong 60 phút (cộng dồn thời gian)', use: () => { addBuff('tt', 0.5, 60); return 'Tiên Thảo Lộ: +50% kinh nghiệm 60 phút'; } },
  { k: 'qht', n: 'Quế Hoa Tửu', ic: 'img/ep/qht.png', knb: 2, d: '+20 may mắn trong 60 phút: đồ rơi nhiều dòng / dòng tốt hơn, +10% tỉ lệ rơi đồ', use: () => { addBuff('luck', 20, 60); R.dirty = true; return 'Quế Hoa Tửu: +20 may mắn 60 phút'; } },
  { k: 'rht', n: 'Rương Huyền Tinh', ic: 'img/ep/box2.png', gold: 30000, vio: 1, d: '2–3 Huyền Tinh Khoáng Thạch (cấp theo cấp nhân vật)', use: () => { const l = clamp(Math.floor(S.lvl / 15) + irnd(0, 1), 1, HT_MAX), n = irnd(2, 3); matAdd('ht', l, n); return `Rương Huyền Tinh: ${n} Huyền Tinh cấp ${l}`; } },
  { k: 'rda', n: 'Rương Đá Thuộc Tính', ic: 'img/ep/box3.png', gold: 50000, vio: 1, d: '1–2 đá thuộc tính (hợp hệ / loại đồ đang mặc)', use: () => { const o = [forceOre(S.lvl)]; if (Math.random() < 0.3) o.push(forceOre(S.lvl)); return 'Rương Đá Thuộc Tính: ' + o.join(', '); } },
  { k: 'mt90', n: 'Võ Lâm Mật Tịch 90', ic: 'img/ep/mt90.png', knb: 5, d: 'Lĩnh ngộ 1 võ công 90 từ cấp 80 (cấp 1, sau đó luyện)', use: () => { matAdd('misc', 'bk90', 1); return 'Nhận 1 Võ Lâm Mật Tịch 90'; } },
  { k: 'ldt', n: 'Lệnh Bài Dã Tẩu', ic: 'img/ep/ldt.png', knb: 5, d: "Tối đa 5 / ngày · +20 lượt nhiệm vụ Dã Tẩu trong ngày (dùng ở thẻ Nhiệm vụ › Dã Tẩu, tại đây, hoặc tự dùng khi hết lượt)", use: () => { matAdd('misc', 'ldt', 1); ldtDay().n++; return 'Nhận 1 Lệnh Bài Dã Tẩu'; } },
  { k: 'ldp', n: 'Lệnh Bài Đổi Phái', ic: 'img/ep/ldp.png', knb: 20, d: 'Đổi sang môn phái khác (kể cả khác hệ). Giữ cấp, tiềm năng, trang bị; hoàn lại toàn bộ điểm kỹ năng', use: () => { matAdd('misc', 'ldp', 1); return 'Nhận 1 Lệnh Bài Đổi Phái (dùng ở thẻ Nhân vật hoặc tại đây)'; } },
  { k: 'dgt', n: 'Thẻ Đổi Giới Tính', ic: 'img/ep/ldp.png', knb: DGT_KNB, d: 'Đổi Nam ↔ Nữ: đổi ngoại hình; đồ chỉ dành cho giới cũ tự tháo vào hành trang. Giữ cấp, điểm, võ công. Thiếu Lâm / Nga My / Thúy Yên không đổi được', use: () => { matAdd('misc', 'dgt', 1); return 'Nhận 1 Thẻ Đổi Giới Tính'; } },
  { k: 'dtbk', n: 'Đại Thành Bí Kíp', ic: 'img/ep/dtbk.png', knb: 25, d: 'Đưa 1 võ công 90 đã học lên cấp 20 ngay, không cần luyện (dùng ở thẻ Võ công)', use: () => { matAdd('misc', 'dtbk', 1); return 'Nhận 1 Đại Thành Bí Kíp'; } },
];
/* Dai Thanh Bi Kip: vo cong 90 da hoc -> cap toi da (20) */
function useDaiThanh(id) {
  const s = SK[id]; if (!s || s.tier !== 90 || !S.sk[id] || matHave('misc', 'dtbk') < 1) return;
  const t = SKL(), r = t[id] || (t[id] = { lv: S.sk[id], xp: 0 }); if (r.lv >= s.max) { toast('Đã đại thành'); return; }
  matAdd('misc', 'dtbk', -1); r.lv = s.max; r.xp = 0; S.sk[id] = s.max; R.dirty = true; recalc();
  log(`📕 Dùng Đại Thành Bí Kíp: <b style="color:#ffd24a">${esc(s.n)}</b> đại thành cấp ${s.max}!`); toast(`${s.n} cấp ${s.max}`); uiSfx('levelup'); save(); refresh();
}
const ktcOk = g => !g.vio || verVio();
const ktcCost = g => (g.knb ? `${g.knb} KNB` : fmt(g.gold));
const ktcCan = (g, n = 1) => (g.knb ? (S.knb || 0) >= g.knb * n : S.gold >= g.gold * n) && (g.k !== 'knb' || knbDay().n + n <= KNB_DAY) && (g.k !== 'ldt' || ldtDay().n + n <= LDT_BUY_DAY);
function ktcBuy(k, n = 1) {
  const g = KTC.find(x => x.k === k); if (!g || !ktcOk(g)) return;
  let done = 0; const msgs = [];
  for (let i = 0; i < n; i++) { if (!ktcCan(g)) break; if (g.knb) S.knb -= g.knb; else S.gold -= g.gold; msgs.push(g.use()); done++; }
  if (!done) { toast(g.knb ? 'Không đủ Kim Nguyên Bảo' : 'Không đủ ngân lượng'); return; }
  RW().stat.ktc = (RW().stat.ktc || 0) + done;
  const last = msgs[msgs.length - 1]; log(`🏮 Kỳ Trân Các: ${done > 1 ? `mua ${done} × ${esc(g.n)} · ` : ''}${esc(done > 1 && g.k.startsWith('r') ? msgs.join(' · ') : last)} (−${g.knb ? g.knb * done + ' Kim Nguyên Bảo' : fmt(g.gold * done) + ' lượng'})`);
  toast(done > 1 ? `${g.n} ×${done}` : last); uiSfx('learn'); R.dirty = true; invDirty = true; save(); ktcModal();
}
function ktcModal() {
  const luck = R.P ? Math.round(R.P.lucky) : 0;
  modal(`<h3>🏮 Kỳ Trân Các <small><img src="img/ep/knb.png" alt="" style="height:14px;vertical-align:middle;image-rendering:pixelated"> ${S.knb || 0} Kim Nguyên Bảo · ${fmt(S.gold)} lượng</small></h3>
    <p class="desc">Giá cố định. Mua bằng <b>Kim Nguyên Bảo</b> (rơi từ trùm 10%, trùm Hoàng Kim / boss tuần 50%); Rương Huyền Tinh và Rương Đá Thuộc Tính mua bằng ngân lượng. Rương mở ngay khi mua.</p>
    ${buffText() ? `<div class="card small">Đang có: ${buffText()}</div>` : ''}
    <div class="shoplist">${KTC.map(g => { const ok = ktcOk(g), have = g.k === 'mt90' ? matHave('misc', 'bk90') : g.k === 'dtbk' ? matHave('misc', 'dtbk') : g.k === 'ldp' ? matHave('misc', 'ldp') : g.k === 'ldt' ? matHave('misc', 'ldt') : g.k === 'dgt' ? matHave('misc', 'dgt') : g.k === 'knb' ? `${knbDay().n}/${KNB_DAY} hôm nay` : null;
      return `<div class="shoprow ktc${ok ? '' : ' bad'}"><img src="${g.ic}" alt="" style="image-rendering:pixelated"><span><b>${esc(g.n)}</b><small>${esc(g.d)}${have != null ? (g.k === 'knb' ? ` · đã đổi ${have}` : ` · có ${have}`) : ''}${ok ? '' : ' · cần phiên bản 2 (đổi ở thẻ Khác)'}</small></span>
        <span class="btnrow"><button class="btn sm${g.knb ? ' knb' : ''}" data-ktc="${g.k}" ${ok && ktcCan(g) ? '' : 'disabled'}>${ktcCost(g)}</button>${g.k === 'ldp' && have ? '<button class="btn sm on" id="ktcLdp">Dùng</button>' : ''}${g.k === 'ldt' && have ? '<button class="btn sm on" id="ktcLdt">Dùng</button>' : ''}${g.k === 'mt90' && have ? '<button class="btn sm on" id="ktcMt">Lĩnh ngộ</button>' : ''}${g.k === 'dgt' && have ? '<button class="btn sm on" id="ktcDgt">Dùng</button>' : ''}${g.k === 'dtbk' || g.k === 'ldp' || g.k === 'dgt' ? '' : `<button class="btn sm" data-ktc10="${g.k}" ${ok && ktcCan(g, 10) ? '' : 'disabled'}>×10</button>`}</span></div>`; }).join('')}</div>
    <p class="dim small">May mắn hiện tại: <b>${luck}</b> (trang bị + Quế Hoa Tửu). Mỗi điểm: đồ rơi có nhiều dòng / dòng cấp cao hơn, +0,5% tỉ lệ rơi đồ.</p>`, () => {
    document.querySelectorAll('#mBody [data-ktc]').forEach(b => b.onclick = () => ktcBuy(b.dataset.ktc, 1));
    document.querySelectorAll('#mBody [data-ktc10]').forEach(b => b.onclick = () => ktcBuy(b.dataset.ktc10, 10));
    const ld = $('#ktcLdp'); if (ld) ld.onclick = doiPhaiModal;
    const mt = $('#ktcMt'); if (mt) mt.onclick = () => { if (S.lvl < 80 && !rebornN()) { toast('Võ công 90 cần cấp 80'); return; } closeModal(true); showTab('skill'); toast('Bấm + ở võ công 90 để lĩnh ngộ (không tốn điểm)'); };
    const dg = $('#ktcDgt'); if (dg) dg.onclick = doiGioiTinhModal;
    const lt = $('#ktcLdt'); if (lt) lt.onclick = () => { if (S.lvl < DT_LV) { toast(`Dã Tẩu mở từ cấp ${DT_LV}`); return; } dtUseLdt(false); ktcModal(); };
  });
}
/* ---------- Lenh Bai Doi Phai: doi mon phai (nhu JX1 chuyen phai) ---------- */
function doiPhaiModal() {
  if (!S.fac || isNovice()) { toast('Vô Môn Phái: gia nhập môn phái ở cấp ' + NOVICE_LV); return; }
  const have = matHave('misc', 'ldp');
  const cards = FACTIONS.filter(f => !f.novice).map(f => { const ok = facAllowed(f, S.sex) && f.key !== S.fac, sk = f.starter && SK[f.starter];
    return `<button data-dp="${f.key}" ${ok && have ? '' : 'disabled'} style="--c:${SERIES_COL[f.series]}"><img src="${(W.hero[f.key] || {}).img || ''}" alt=""><b>${esc(f.n)}</b><small>${f.key === S.fac ? 'Môn phái hiện tại' : !facAllowed(f, S.sex) ? 'Không nhận giới tính này' : `Hệ ${SERIES[f.series]} · ${weaponTypeName(f)}${sk ? ' · ' + esc(sk.n) : ''}`}</small></button>`; }).join('');
  modal(`<h3>Đổi môn phái <small>${have} Lệnh Bài Đổi Phái</small></h3>
    <p class="desc">Dùng 1 Lệnh Bài Đổi Phái: chuyển sang phái mới (đổi cả hệ ngũ hành nếu khác hệ). <b>Giữ</b> cấp, tiềm năng, trang bị, cấp võ công 90 đã luyện; <b>hoàn lại toàn bộ điểm kỹ năng</b> để học võ công phái mới; nhận chiêu nhập môn + vũ khí phái mới.</p>
    ${have ? '' : '<p class="bad small">Chưa có Lệnh Bài Đổi Phái — mua ở Kỳ Trân Các.</p>'}<div class="facpick">${cards}</div>`, () => {
    document.querySelectorAll('#mBody [data-dp]').forEach(b => b.onclick = () => { const f = FAC[b.dataset.dp]; if (confirm(`Đổi sang ${f.n}? Toàn bộ điểm kỹ năng được hoàn lại.`)) changeFaction(f.key); });
  });
}
function changeFaction(key) {
  const f = FAC[key], old = FAC[S.fac];
  if (!f || f.novice || key === S.fac || !facAllowed(f, S.sex) || matHave('misc', 'ldp') < 1) return;
  if (R.dg || R.tower) { toast('Ra khỏi phó bản / tháp rồi đổi phái'); return; }
  matAdd('misc', 'ldp', -1);
  const bk = S.bkOk || (S.bkOk = {});
  for (const id in S.sk) { if (SK[id] && SK[id].book) bk[id] = 1; S.skPts += SK[id] && SK[id].tier === 90 && !(typeof isBr90 === 'function' && isBr90(id)) ? 0 : S.sk[id]; }
  S.sk = {}; S.fac = key; S.main = 0; S.mainLock = false; S.slots = [0, 0, 0, 0]; S.auraOff = {}; R.sks = null;
  if (f.starter) { S.sk[f.starter] = 1; S.skPts = Math.max(0, S.skPts - 1); S.main = f.starter; }
  const dp = facWeaponDP(f), mk = l => makeItem(dp[0], dp[1], l, 0);
  let w = null; for (let l = clamp(Math.round(S.lvl / 12) + 1, 1, 10); l >= 1; l--) { w = mk(l); if (w && reqOk(w)) break; }   // vu khi phai moi, cap cao nhat mac duoc
  if (w) { S.inv.unshift(w); invDirty = true; if (reqOk(w)) equip(w, true); }   // vao thang hanh trang (khong qua bo loc / ruong ep)
  R.dirty = true; recalc(); if (typeof autoEquipAll === 'function') autoEquipAll();   // vu khi dung loai phai moi
  if (S.autoPts === true) autoSpendSkills();
  fillSlots(); R.dirty = true; recalc(); R.life = Math.min(R.life, R.P.life); R.mana = Math.min(R.mana, R.P.mana);
  closeModal(true); renderPad(); refresh(); save(); uiSfx('levelup');
  R.banner = { t: 2.8, text: 'Gia nhập ' + f.n, sub: `Rời ${old ? old.n : ''} · ${S.skPts} điểm kỹ năng chờ phân phối` };
  log(`🏮 Lệnh Bài Đổi Phái: rời <b>${esc(old ? old.n : '')}</b>, gia nhập <b style="color:${SERIES_COL[f.series]}">${esc(f.n)}</b> (hệ ${SERIES[f.series]}). Hoàn lại ${S.skPts} điểm kỹ năng.`);
}

/* ---------- The Doi Gioi Tinh ---------- */
function doiGioiTinhModal() {
  const have = matHave('misc', 'dgt'), to = S.sex ? 0 : 1, lock = S.fac && (S.fac in FAC_SEX);
  const drop = Object.entries(S.eq).filter(([k, it]) => it && k !== 'horse' && !sexReqOkFor(it, to)).map(([, it]) => it);
  modal(`<h3>Đổi giới tính <small>${have} thẻ</small></h3>
    <p class="desc">${S.sex ? 'Nữ' : 'Nam'} → <b>${to ? 'Nữ' : 'Nam'}</b>. Giữ cấp, tiềm năng, võ công, trang bị.</p>
    ${lock ? `<p class="reqbad">${esc(FAC[S.fac].n)} chỉ nhận ${FAC_SEX[S.fac] ? 'Nữ' : 'Nam'}: cần đổi phái trước.</p>` : ''}
    ${drop.length ? `<p class="small">Sẽ tháo vào hành trang (chỉ dành cho ${S.sex ? 'Nữ' : 'Nam'}): ${drop.map(it => esc(it.n)).join(', ')}</p>` : ''}
    <div class="btnrow"><button class="btn red" id="dgtGo" ${have && !lock ? '' : 'disabled'}>Đổi sang ${to ? 'Nữ' : 'Nam'}</button><button class="btn" id="dgtNo">Đóng</button></div>`, () => {
    $('#dgtNo').onclick = () => ktcModal();
    $('#dgtGo').onclick = () => {
      if (!(matHave('misc', 'dgt') > 0) || lock) return;
      if (S.inv.length + drop.length > INV_MAX) { toast('Hành trang không đủ chỗ cho đồ phải tháo'); return; }
      matAdd('misc', 'dgt', -1); S.sex = to;
      for (const [k, it] of Object.entries(S.eq)) if (it && drop.includes(it)) { delete S.eq[k]; S.inv.unshift(it); }
      invDirty = true; R.dirty = true; recalc(); if (typeof autoEquipAll === 'function') autoEquipAll(); R.dirty = true; recalc(); renderPad(); save();
      log(`🎭 Dùng Thẻ Đổi Giới Tính: nhân vật đổi sang <b>${to ? 'Nữ' : 'Nam'}</b>${drop.length ? ` (tháo ${drop.length} món)` : ''}.`); toast(`Đã đổi sang ${to ? 'Nữ' : 'Nam'}`); uiSfx('levelup');
      closeModal(true); refresh();
    };
  });
}
