/* ======================= GIAO DIEN (5 the) ======================= */
'use strict';
let curTab = 'log', invDirty = true;
function log(h) { if (R.quiet) return; R.logs.unshift(h); if (R.logs.length > 40) R.logs.pop(); R.logDirty = true; }
let toastT; function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1800); }
function modal(html, bind, locked) { $('#mBody').innerHTML = html; $('#modal').classList.remove('hidden'); $('#modal').dataset.locked = locked ? '1' : ''; if (bind) bind(); try { $('#modal .mbox').focus({ preventScroll: true }); } catch (e) { /* bo qua */ } }
function closeModal(force) { if ($('#modal').dataset.locked && !force) return; $('#modal').classList.add('hidden'); }

/* ---------- tui do ---------- */
/* Do thua: khong dung duoc va khong manh hon do dang mac cung o (tru do bo, do Tim dang kham, Bach Kim); vu khi sai loai cua phai.
   Nhan / day chuyen / ngoc boi yeu van giu toi da 6 mon lam nguyen lieu hop Huyen Tinh. */
const FUSE_KEEP = 6;
function isJunk(it) {
  if (typeof dtNeed === 'function' && dtNeed(it)) return false;          // giu de tra Da Tau
  if (S.lootF && S.lootF.pickAll && lootMatch(it)) return false;          // nhat toan bo: mon khop bo loc khong bao gio tu ban
  if (it.set && !it.lock && !it.plv && !setKept(it) && S.lootF && (S.lootF.setOnly || S.lootF.setMine) && !Object.values(S.eq).includes(it)) return true;   // bo khong chon giu: tu ban
  if (it.set || it.vio || it.plv || it.lock || it.thanma) return false;
  if (!sexOk(it)) return true;                         // trang phuc khac gioi tinh: khong bao gio mac duoc
  const f = FAC[S.fac];
  if (DETAIL_SLOT[it.d] === 'weapon' && f && !weaponFits(it)) return true;
  const eq = S.eq[slotFor(it)]; if (!eq || betterThanEquipped(it) || itemPower(it) > itemPower(eq) * 0.85) return false;
  if (FUSE_SLOTS.includes(it.d) && S.inv.filter(x => FUSE_SLOTS.includes(x.d) && !x.set && !x.vio).length < FUSE_KEEP) return false;
  return true;
}
/* Don do thua da nhat truoc (do manh len thi do cu thanh thua): moi 30 giay choi va khi vao lai game */
function sweepJunk() {
  if (S.autoJunk === false) return 0;
  let n = 0;
  for (let guard = 0; guard < INV_MAX; guard++) {
    const j = S.inv.filter(isJunk).sort((a, b) => itemPower(a) - itemPower(b))[0]; if (!j) break;
    S.inv.splice(S.inv.indexOf(j), 1); S.gold += itemValue(j); n++;
  }
  if (n) invDirty = true; return n;
}
function addItem(it, quiet, picked, keep) {
  if (typeof epAutoStore === 'function' && epAutoStore(it)) { invDirty = true; return true; }   // do trang -> Ruong ep (Lo Ep Do)
  if (!picked && !lootMatch(it)) { S.gold += itemValue(it); return false; } // khong qua mat dat (offline): mon khong khop bo loc tu ban
  if (S.inv.length >= INV_MAX && (it.set || it.vio || it.plv)) makeRoom(it, true);   // do quy (bo / Tim / Bach Kim): nhuong cho bang cach ban mon yeu nhat
  if (S.inv.length >= INV_MAX) { S.gold += itemValue(it); if (!quiet) log('<span class="dim">Túi đầy, tự bán ' + esc(it.n) + '</span>'); return false; }
  if (!keep && S.autoJunk !== false && isJunk(it)) { S.gold += itemValue(it); return false; }   // do thua: tu ban, khong chat hanh trang
  S.inv.unshift(it); invDirty = true; recItem(it);
  if (typeof dtItemGot === 'function') dtItemGot(it);
  if (!quiet && it.r >= 2) log(`Nhặt được <span style="color:${RAR_COL[it.r]}">${esc(it.n)}</span>`);
  if (S.autoEquip && betterThanEquipped(it)) equip(it, true);
  return true;
}
/* So sanh bang luc chien that (tinh ca mon vu khi cua phai, khang, ...), khong chi chi so cua mon do */
function equipGain(it) {
  if (!reqOk(it)) return -1;
  const eq = Object.assign({}, S.eq); eq[slotFor(it)] = it;
  return power(calc(eq)) / Math.max(1, power(calc(S.eq))) - 1;
}
// tu mac chi doi vu khi cung loai voi mon vu khi cua phai (Con cho Thieu Lam, am khi cho Duong Mon...);
// nguoi choi van mac tay duoc moi loai
function betterThanEquipped(it) {
  const f = FAC[S.fac];
  if (DETAIL_SLOT[it.d] === 'weapon' && f && !weaponFits(it)) return false;
  return equipGain(it) > 0.01;
}
function equip(it, quiet) {
  if (!reqOk(it)) { if (!quiet) toast('Chưa mặc được: ' + reqProblems(it).join('; ')); return; }
  const slot = slotFor(it), old = S.eq[slot];
  S.inv = S.inv.filter(x => x !== it); if (old) S.inv.unshift(old);
  S.eq[slot] = it; R.dirty = true; invDirty = true; if (!quiet) uiSfx(it.d <= 1 ? 'equipWeapon' : 'equipCloth');
  if (!quiet) { closeModal(); refresh(); }
}
function unequip(slot) { const it = S.eq[slot]; if (!it) return; if (S.inv.length >= INV_MAX) { toast('Túi đầy'); return; } delete S.eq[slot]; S.inv.unshift(it); R.dirty = true; invDirty = true; if (slot === 'horse' && typeof setMount === 'function') setMount(false, true); closeModal(); refresh(); }
/* Go toan bo trang bi dang mac: ngua ve Ma Truong (day thi ve tui), do khac ve hanh trang */
function unequipAll() {
  let n = 0, skipped = 0;
  for (const [slot] of SLOTS) {
    const it = S.eq[slot]; if (!it) continue;
    if (slot === 'horse' && typeof stable === 'function' && typeof STABLE_MAX === 'number' && stable().length < STABLE_MAX) {
      delete S.eq.horse; stable().push(it); n++; continue;
    }
    if (S.inv.length >= INV_MAX) { skipped++; continue; }
    delete S.eq[slot]; S.inv.unshift(it); n++;
  }
  if (n) {
    R.dirty = true; invDirty = true;
    if (!S.eq.horse && typeof setMount === 'function') setMount(false, true);
  }
  return { n, skipped, left: SLOTS.filter(([k]) => S.eq[k]).length };
}
/* Ban mon khong khop bo loc (nut trong the Hanh trang, cua hang, Tho Dia Phu): khong bao gio ban do bo, do Tim dang kham, Bach Kim da thang cap */
const sellProtected = it => !!((it.set && setKept(it)) || it.vio || it.plv || it.lock || it.thanma || (typeof dtNeed === 'function' && dtNeed(it)));   // khoa (🔒): khong bao gio tu ban / ban hang loat
function sellUnmatched() {
  const w = S.inv.filter(i => !lootMatch(i) && !sellProtected(i)); let g = 0;
  for (const i of w) g += itemValue(i);
  S.gold += g; S.inv = S.inv.filter(i => !w.includes(i)); invDirty = true;
  return { n: w.length, gold: g, kept: S.inv.filter(i => !lootMatch(i)).length };
}
function sell(it) { if (!S.inv.includes(it)) { closeModal(); return; } if (it.lock) { toast('Món đã khóa: mở khóa trước khi bán'); return; } S.inv = S.inv.filter(x => x !== it); S.gold += itemValue(it); invDirty = true; closeModal(); refresh(); }
function findItem(uid) { uid = +uid; return S.inv.find(i => i.uid === uid) || (S.stable || []).find(i => i.uid === uid) || Object.values(S.eq).find(i => i && i.uid === uid) || (R.ground.find(d => d.it.uid === uid) || {}).it; }
function itemCell(it) {
  if (!it) return '';
  return `<button class="it r${it.r}${reqOk(it) ? '' : ' bad'}" data-uid="${it.uid}"${reqOk(it) ? '' : ` title="${esc('Chưa mặc được: ' + reqProblems(it).join('; '))}"`}>${it.ic ? `<img src="${esc(it.ic)}" alt="">` : ''}<i>${it.lvl}</i>${typeof isUpgrade === 'function' && S.inv.includes(it) ? (isUpgrade(it) ? '<u class="up" title="Mạnh hơn đồ đang mặc">▲</u>' : isPotential(it) ? `<u class="up pot" title="Cường hóa lên +${enhGain(it).enh} thì mạnh hơn đồ đang mặc">△</u>` : '') : ''}${it.s >= 0 ? `<b class="s5" style="background:${SERIES_COL[it.s]}"></b>` : ''}${betterThanEquipped(it) && S.inv.includes(it) ? '<em>▲</em>' : ''}${it.lock ? '<u class="lk">🔒</u>' : typeof dtNeed === 'function' && S.inv.includes(it) && dtNeed(it) ? '<u class="lk" title="Giữ để trả Dã Tẩu">📜</u>' : ''}${it.enh ? `<u class="en">+${it.enh}</u>` : ''}</button>`;
}
function itemHTML(it) {
  return `<div class="idet"><div class="pic r${it.r}">${it.ic ? `<img src="${esc(it.ic)}" alt="">` : ''}</div><div><h4 style="color:${RAR_COL[it.r]}">${esc(it.n)}${it.enh ? ` <span class="enh">+${it.enh}</span>` : ''}${it.vio ? ` <small class="vtag">Tím ${(it.mag || []).length}/${VIO_SLOTS}</small>` : ''}</h4>
  <small class="dim">${esc(J.items[it.d].n)} · cấp ${it.lvl}${it.s >= 0 ? ` · <span style="color:${SERIES_COL[it.s]}">hệ ${SERIES[it.s]}</span>` : ''}</small></div></div>
  <div class="sl">${itemLines(it).map(([k, t]) => `<div class="${k}">${esc(t)}</div>`).join('')}</div>`;
}
/* Cong diem tiem nang de du yeu cau Suc manh / Than phap / Sinh khi / Noi cong cua mon do (neu du diem) */
function fixReqPoints(it) {
  const d = reqDeficit(it), need = Object.values(d).reduce((a, b) => a + b, 0);
  if (!need) return false; if (S.attrPts < need) { toast(`Cần ${need} điểm tiềm năng, đang có ${S.attrPts}`); return false; }
  for (const k in d) { S.attr[k] += d[k]; S.attrPts -= d[k]; }
  R.dirty = true; recalc(); toast('Đã cộng điểm để đủ điều kiện'); return true;
}
function cmpLines(it, slot) {
  if (slot) return '';
  const ok = reqOk(it), c = equipCompare(it, !ok), col = v => v > 0.0005 ? 'cp' : v < -0.0005 ? 'cn' : 'dim';
  const row = (n, v, t) => `<span class="${col(v)}">${n} ${t}</span>`;
  const head = ok ? 'So với đang mặc' : 'Nếu đủ điều kiện, so với đang mặc';
  const probs = ok ? [] : reqProblems(it);
  const wrong = DETAIL_SLOT[it.d] === 'weapon' && FAC[S.fac] && !weaponFits(it);
  const need = Object.values(reqDeficit(it)).reduce((a, b) => a + b, 0), onlyAttr = probs.length > 0 && probs.length === Object.keys(reqDeficit(it)).length;
  return `<div class="cmp2"><small class="dim">${head}:</small><div class="cmpv">${row('Sức mạnh', c.gain, pctTxt(c.gain))} ${row('DPS', c.dps, pctTxt(c.dps))} ${row('Sinh lực', c.life, numTxt(c.life))} ${row('Né', c.def, numTxt(c.def))} ${row('Kháng TB', c.res, numTxt(c.res) + '%')}</div>
    ${probs.length ? `<div class="reqbad"><b>Chưa mặc được, thiếu:</b><br>${probs.map(esc).join('<br>')}${onlyAttr ? `<br><small>Cần ${need} điểm tiềm năng${S.attrPts >= need ? ` (đang có ${S.attrPts}): bấm "Cộng điểm" để đủ điều kiện` : `, đang có ${S.attrPts}: lên cấp thêm`}.</small>` : ''}</div>` : ''}
    <div class="reqnote"><b>Vì sao:</b><br>${c.why.map(esc).join('<br>')}</div>
    ${wrong ? '<div class="reqnote">Sai loại vũ khí của môn phái: tự mặc sẽ bỏ qua, bạn vẫn mặc tay được.</div>' : ''}</div>`;
}
/* Quet toan bo hanh trang: mac mon cho suc manh that tang nhieu nhat, lap lai den khi het mon manh hon (sau khi len cap / cong diem / roi do) */
function autoEquipAll() {
  if (!S.autoEquip) return 0; let n = 0;
  for (let g = 0; g < 14; g++) {
    let best = null, bg = 0.01;
    for (const it of S.inv.concat(typeof epBox === 'function' ? epBox().filter(x => x.vio && (x.mag || []).length) : [])) {   // ca do Tim da kham trong Ruong ep
      if (!reqOk(it)) continue;
      const f = FAC[S.fac]; if (DETAIL_SLOT[it.d] === 'weapon' && f && !weaponFits(it)) continue;
      const gn = equipGain(it); if (gn > bg) { bg = gn; best = it; }
    }
    if (!best) break;
    if (!S.inv.includes(best)) { itemRemove(best); S.inv.push(best); }
    equip(best, true); n++;
    if (S.inv.length > INV_MAX && typeof epBox === 'function') epBox().push(S.inv.shift());   // tui day: do vua thao vao Ruong ep
  }
  if (n) { invDirty = true; R.dirty = true; } return n;
}
function itemModal(it, slot) {
  const cur = !slot && S.eq[slotFor(it)];
  const eg = !slot && typeof enhGain === 'function' && !isUpgrade(it) && enhGain(it);
  modal(`${itemHTML(it)}${cmpLines(it, slot)}${eg ? `<div class="cp small">△ Cường hóa lên +${eg.enh}: mạnh hơn đồ đang mặc ${(eg.gain * 100).toFixed(1)}% · chi phí ước tính ${fmt(enhExpected(it, eg.enh))} lượng</div>` : ''}${cur ? `<div class="cmp"><small class="dim">Đang mặc:</small>${itemHTML(cur)}</div>` : ''}
    <div class="btnrow">${slot ? `<button class="btn" id="bUn">Tháo</button>` : `<button class="btn" id="bEq" ${reqOk(it) ? '' : 'disabled'}>Trang bị</button>${!reqOk(it) && Object.keys(reqDeficit(it)).length && reqProblems(it).length === Object.keys(reqDeficit(it)).length ? '<button class="btn" id="bReqPts">Cộng điểm</button>' : ''}<button class="btn red" id="bSell" ${it.lock ? 'disabled' : ''}>Bán (${fmt(itemValue(it))})</button>${S.inv.includes(it) ? '<button class="btn" id="bStashIt">Gửi kho</button>' : ''}${S.inv.includes(it) && it.d === 10 ? '<button class="btn" id="bStable">Cất vào Mã Trường</button>' : ''}`}${findItem(it.uid) && it.d <= 10 ? '<button class="btn" id="bForge">Rèn đồ</button>' : ''}${owned(it) ? `<button class="btn" id="bLock">${it.lock ? '🔓 Mở khóa' : '🔒 Khóa'}</button>` : ''}</div>`,
  () => { const b1 = $('#bEq'), b2 = $('#bSell'), b3 = $('#bUn'), b4 = $('#bForge'); const bh = $('#bStable'); if (bh) bh.onclick = () => { const r = stableIn(it); toast(r.msg); if (r.ok) { closeModal(); refresh(); } }; const bs = $('#bStashIt'); if (bs) bs.onclick = () => { const r = stashDeposit(it); toast(r.msg); if (r.ok) { closeModal(); refresh(); } }; const bp = $('#bReqPts'); if (bp) bp.onclick = () => { if (fixReqPoints(it)) { if (reqOk(it)) equip(it); else itemModal(it, slot); } };
    const bl = $('#bLock'); if (bl) bl.onclick = () => { it.lock = !it.lock; if (!it.lock) delete it.lock; invDirty = true; save(); toast(it.lock ? 'Đã khóa: không tự bán, không hợp Huyền Tinh' : 'Đã mở khóa'); itemModal(it, slot); };
    if (b1) b1.onclick = () => equip(it); if (b2) b2.onclick = () => sell(it); if (b3) b3.onclick = () => unequip(slot); if (b4) b4.onclick = () => forgeModal(it); });
}

/* ---------- the: chien truong ---------- */
/* Ti le he quai cua vung: "Kim 2 · Moc 1 ..." co mau; cham tron cho danh sach vung */
function seriesMix(z) { const c = zoneSeries(z); return c.map((n, i) => n ? `<span style="color:${SERIES_COL[i]}">${SERIES[i]} ${n}</span>` : '').filter(Boolean).join(' · '); }
function seriesDots(z) { const c = zoneSeries(z); return c.map((n, i) => ('<i class="sdot" style="background:' + SERIES_COL[i] + '"></i>').repeat(n)).join(''); }
function renderLog() {
  const z = zoneOf(Math.min(S.stage, STAGES));
  const zl = ZONES.map((q, i) => {
    const open = zoneOpen(i), cur = zoneIdx(Math.min(S.stage, STAGES)) === i;
    const alts = ZALT[i], sel = (S.zalt || {})[i] || 0, zq = alts && sel ? alts[sel - 1] || q : q;
    const chips = alts && open ? `<div class="zalt">${[q].concat(alts).map((a, k) => `<button class="chip2${k === sel ? ' on' : ''}" data-za="${i}:${k}">${esc(a.n)}</button>`).join('')}</div>` : '';
    return `<button class="zrow${cur ? ' cur' : ''}${open ? '' : ' lock'}" data-z="${i}" ${open ? '' : 'disabled'}><b>${esc(zq.n)}</b><span>${seriesDots(zq)} Cấp ${q.lo}–${q.hi}${alts ? ` · ${alts.length + 1} bản đồ` : ''}</span></button>${chips}`;
  }).join('');
  $('#t-log').innerHTML = `${todoHTML()}${modeCard(z)}<div class="card"><div><small class="dim">Quái hệ: ${seriesMix(z)}${FAC[S.fac] ? ` · bạn hệ <span style="color:${SERIES_COL[heroSeries()]}">${SERIES[heroSeries()]}</span>: khắc <span style="color:${SERIES_COL[khacOf(heroSeries())]}">${SERIES[khacOf(heroSeries())]}</span> (+10%), bị <span style="color:${SERIES_COL[counteredBy(heroSeries())]}">${SERIES[counteredBy(heroSeries())]}</span> khắc (−10%)` : ''}</small></div>
    ${buffText() ? `<div class="small">${buffText()}</div>` : ''}</div>
    <div class="log" id="logBox">${R.logs.map(l => `<div>${l}</div>`).join('')}</div>
    <h3>Bản đồ luyện công <small>chạm để chọn bãi (tắt tự đổi theo cấp)</small></h3><div class="zlist">${zl}</div>`;
  bindTodo();
  bindModeCard();
  const pickMap = i => { if (S.mode === 'quest' || S.mode === 'dg') { S.mode = 'farm'; log('⚔ Chọn bãi luyện công: chuyển sang chế độ Luyện công.'); } S.autoMap = false; gotoZone(i, 'Chọn bãi luyện công'); save(); refresh(); };
  document.querySelectorAll('.zrow').forEach(b => b.onclick = () => pickMap(+b.dataset.z));
  document.querySelectorAll('[data-za]').forEach(b => b.onclick = () => { const [i, k] = b.dataset.za.split(':').map(Number); (S.zalt || (S.zalt = {}))[i] = k;
    if (zoneIdx(Math.min(S.stage, STAGES)) === i) {
      S.wave = 1; R.enemies = []; R.corpses = []; R.field = null; R.spawnT = 0.3; R.zoneShown = null;
      if (typeof onZoneChange === 'function') onZoneChange(zoneOf(Math.min(S.stage, STAGES)));
    } else pickMap(i); save(); refresh(); });
}
function renderLogOnly() { const b = $('#logBox'); if (b) b.innerHTML = R.logs.map(l => `<div>${l}</div>`).join(''); }

/* ---------- the: nhan vat ---------- */
const ATTR_VI = { str: 'Sức mạnh', dex: 'Thân pháp', vit: 'Sinh khí', eng: 'Nội công' };
function renderChar() {
  const P = R.P, f = FAC[S.fac];
  const unmet = Object.values(S.eq).filter(it => it && !reqOk(it));
  const P0 = calc({}), eqC = { life: Math.round(P.life - P0.life), mana: Math.round(P.mana - P0.mana) };   // phan chi so do trang bi dang mac dong gop
  const eq = SLOTS.map(([k, vi]) => `<div class="slot" data-slot="${k}">${S.eq[k] ? itemCell(S.eq[k]) : `<span>${vi}</span>`}</div>`).join('');
  const attrs = Object.keys(ATTR_VI).map(k => `<div class="attr"><span>${ATTR_VI[k]}</span><b>${Math.round(P[k])}</b><span class="pm"><button class="plus" data-a="${k}" ${S.attrPts ? '' : 'disabled'}>+</button><button class="minus" data-a="${k}" title="Rút lại 1 điểm" ${S.attr[k] > 0 ? '' : 'disabled'}>−</button></span></div>`).join('');
  const res = ELEM.map(e => `<span>Kháng ${ELEM_VI[e]}</span><span>${Math.round(P.res[e])}%</span>`).join('');
  $('#t-char').innerHTML = `<div class="card"><b style="color:${SERIES_COL[f.series]}">${esc(f.n)}</b> · hệ ${SERIES[f.series]} · Cấp ${S.lvl}${rebornN() ? ` <small class="cp">chuyển sinh ${rebornN()} · mặc đồ như cấp ${eqLevel()}</small>` : ''}<br><small class="dim">Lực chiến ${fmt(R.power)}</small> <button class="btn sm" id="bPower">Chi tiết</button> <button class="btn sm" id="bTitle">🎖 Danh hiệu</button> <button class="btn sm${hasRealName() ? '' : ' on'}" id="bName">${hasRealName() ? '✏ ' + esc(S.name) : '✏ Đặt tên'}</button> <button class="btn sm${S.lvl >= REBORN_LV && RW().stat.reborn < REBORN_MAX ? ' on' : ''}" id="bReb">Chuyển sinh</button>${matHave('misc', 'ldp') > 0 ? ` <button class="btn sm on" id="bDoiPhai">Đổi phái (${matHave('misc', 'ldp')})</button>` : ''}</div>
    <div class="eqgrid">${eq}</div>${unmet.length ? `<div class="reqbad"><b>⚠ ${unmet.length} món đang mặc chưa đủ điều kiện, không được cộng chỉ số:</b><br>${unmet.map(it => `${esc(it.n)}: ${esc(reqProblems(it).join('; '))}`).join('<br>')}</div>` : ''}
    <p class="dim small">Dòng ẩn (2, 4, 6) của mỗi món mở khi hệ nhân vật hoặc 2 món liên kết <b>tương sinh</b> với hệ món đó (Kim→Thủy→Mộc→Hỏa→Thổ→Kim). Đang mở: ${SLOTS.filter(([k]) => S.eq[k] && S.eq[k].mag.length > 1).map(([k, vi]) => `${vi} ${hiddenActive(S.eq[k])}/${Math.floor(S.eq[k].mag.length / 2)}`).join(' · ') || '—'}</p>
    <h3>Tiềm năng <small>${S.attrPts} điểm</small> <button class="btn sm" id="bSugAt">Gợi ý</button> <button class="btn sm" id="bTTa">Tẩy Tủy</button></h3><div class="card">${attrs}</div>
    <h3>Chỉ số</h3><div class="card stats">
      <span>Sinh lực</span><span>${fmt(P.life)}${eqC.life ? ` <small class="cp">(trang bị +${fmt(eqC.life)})</small>` : ''}</span><span>Nội lực</span><span>${fmt(P.mana)}${eqC.mana ? ` <small class="cp">(+${fmt(eqC.mana)})</small>` : ''}</span>
      ${P.plusSkill || Object.keys(P.skAdd || {}).length ? `<span>Kỹ năng từ trang bị</span><span class="cp">${P.plusSkill ? `Tất cả +${P.plusSkill}` : ''}${Object.entries(P.skAdd || {}).map(([id, n]) => ` · ${SK[id] ? esc(SK[id].n) : id} +${n}`).join('')}</span>` : ''}
      <span>Sát thương vũ khí</span><span>${Math.round(P.wmin)}–${Math.round(P.wmax)}</span>
      <span>Chiêu chính</span><span>${esc(P.main.n)} (${fmt(P.main.tot)})</span>
      <span>Chính xác</span><span>${Math.round(P.ar)}</span><span>Né tránh</span><span>${Math.round(P.def)}</span>
      <span>Chí mạng</span><span>${Math.round(P.main.crit)}%</span><span>Tốc độ đánh</span><span>${P.aspd.toFixed(2)}</span>${res}</div>`;
  $('#bTTa').onclick = tayTuyModal;
  document.querySelectorAll('#t-char .plus').forEach(b => b.onclick = () => { if (!S.attrPts) return; S.attrPts--; S.attr[b.dataset.a]++; R.dirty = true; recalc(); renderChar(); });
  $('#bPower').onclick = powerModal; $('#bTitle').onclick = () => titleModal(); $('#bName').onclick = () => nameModal(); $('#bReb').onclick = rebornModal; const dp = $('#bDoiPhai'); if (dp) dp.onclick = doiPhaiModal; $('#bSugAt').onclick = suggestModal;
  document.querySelectorAll('#t-char .minus').forEach(b => b.onclick = () => unspendAttr(b.dataset.a));
  document.querySelectorAll('#t-char .slot .it').forEach(b => b.onclick = () => b.parentNode.dataset.slot === 'horse' ? horsePickModal() : itemModal(findItem(b.dataset.uid), b.parentNode.dataset.slot));
  const hs = document.querySelector('#t-char .slot[data-slot="horse"]'); if (hs && !S.eq.horse) hs.onclick = () => horsePickModal();   // o ngua: chon ngua trong Ma Truong
}

/* ---------- the: ky nang ---------- */
/* Rut lai 1 diem ky nang (cong nham): tra diem, bo chieu khoi o / chieu chinh khi ve 0 */
function unlearnSkill(id) {
  const L = S.sk[id] || 0; if (!L) return false;
  const free = SK[id].tier === 90 && !isBr90(id);                       // vo cong 90 hoc bang Mat Tich: khong ton diem, hoc lai mien phi
  if (L <= 1 || free) delete S.sk[id]; else S.sk[id] = L - 1;
  if (!free) S.skPts++;
  if (!S.sk[id] && S.main === id) S.mainLock = false;
  R.dirty = true; recalc(); fillSlots(); renderSkill(); renderPad(); updateDots(); save();
  toast(`Rút 1 điểm: ${SK[id].n} ${S.sk[id] || 0}/${SK[id].max}`);
  return true;
}
/* Rut lai 1 diem tiem nang */
function unspendAttr(k) {
  if (!(S.attr[k] > 0)) return false;
  S.attr[k]--; S.attrPts++; R.dirty = true; recalc(); renderChar(); updateDots(); save(); return true;
}
const SK_HIDE = /^(skill_attackradius|missle_|skill_cost_v|skill_eventskilllevel|addskilldamage|skill_)/;
function skillEffectLines(s, L) {
  const out = [];
  for (const name in s.attr) {
    if (SK_HIDE.test(name) || !J.attrDesc[name]) continue;
    const p = skVal(s, name, L); if (!p) continue;
    const t = attrText(name, p) + (name === 'dynamicmagicshield_v' ? ` (tối đa ${Math.round(DMG_SHIELD_MAX * 100)}% mỗi đòn)` : ''); if (t && !/^\s*$/.test(t)) out.push(t);
  }
  for (const name in s.attr) if (name.startsWith('addskilldamage')) {        // chieu thap ho tro chieu cao (JX1 addskilldamageN)
    const p = skVal(s, name, L), t = p && SK[p[0]];
    if (t && t.req > 0 && !/\(##\)/.test(t.n) && (!s.f || t.f === s.f) && p[2]) out.push(`Tăng sát thương ${t.n}: +${p[2]}%`);
  }
  return out;
}
/* cac chieu dang ho tro sat thuong cho chieu id: [ten, cap, %] */
function skillSupport(id) {
  const out = [];
  for (const sid in SK) { const s = SK[sid]; if (!s.attr || (s.f && s.f !== SK[id].f)) continue;
    for (const name in s.attr) if (name.startsWith('addskilldamage')) { const L = S.sk[sid] ? S.sk[sid] + skillBonusLv(+sid) : 0, p = skVal(s, name, Math.max(1, L)); if (p && +p[0] === +id && p[2] && !/\(##\)/.test(s.n) && s.req > 0) out.push([s.n, L, L ? p[2] : 0, p[2]]); } }
  return out;
}
/* Thong tin ky nang: mo ta, yeu cau, hieu qua o cap hien tai va cap ke tiep, sat thuong / noi luc / tam danh */
function skillModal(id) {
  const s = SK[id]; if (!s) return;
  const L0 = S.sk[id] || 0, bonus = L0 ? skillBonusLv(id) : 0, L = L0 + bonus, act = isAttack(s), show = Math.max(1, L), next = L0 < s.max ? L + 1 : 0;
  const lines = (lv) => skillEffectLines(s, lv).map(t => `<div>${esc(t)}</div>`).join('') || '<div class="dim">—</div>';
  let atk = '';
  if (act) {
    const a = activeInfo(R.P, s, show + (L ? 0 : 0));
    atk = `<div class="card stats"><span>Sát thương mỗi đòn</span><span>${fmt(a.tot)}</span><span>DPS ước tính</span><span>${fmt(a.dps)}</span><span>Nội lực tiêu hao</span><span>${Math.round(a.cost)}</span><span>Tầm đánh</span><span>${Math.round(a.rad)}</span><span>Mục tiêu</span><span>${a.targets > 1 ? 'nhiều (tối đa ' + a.targets + ')' : 'đơn'}</span></div>`;
  }
  modal(`<h3>${esc(s.n)} <small>${L0}/${s.max}${bonus ? ` <span class="cp">+${bonus} từ trang bị → cấp ${L}</span>` : ''}</small></h3>
    <p class="desc">${esc(s.d || 'Không có mô tả.')}</p>
    <div class="idet">${act ? '<span class="tag attack">Tấn công</span>' : skStateTag(s)}${skEqt(s) !== null ? `<small class="${skWOk(s) ? 'dim' : 'reqbad'}">Vũ khí: ${EQT_VI[skEqt(s)]}</small> · ` : ''}<small class="dim">Yêu cầu cấp ${s.req}${S.lvl < s.req ? ` (bạn cấp ${S.lvl})` : ''} · ${s.tier === 90 ? (typeof SK9_BRANCH !== 'undefined' && SK9_BRANCH[s.id] ? 'Võ công 90: cộng 1 điểm để học · ' + sk9Text(s.id) : 'Võ công 90') : `cộng tối đa cấp ${skCap(s)} ở cấp nhân vật hiện tại`}</small></div>${s.tier === 90 && L0 ? `<p class="desc" style="color:#7fd0b0">${sk9Text(id)}</p>` : ''}
    ${atk}${act ? (() => { const sp = skillSupport(id); if (!sp.length) return ''; const tot = sp.reduce((a, x) => a + x[2], 0);
      return `<div class="sl"><b>Chiêu hỗ trợ <small class="cp">+${tot}% sát thương</small></b>${sp.map(x => `<div class="${x[1] ? '' : 'dim'}">${esc(x[0])} ${x[1] ? `cấp ${x[1]}: +${x[2]}%` : `(chưa học, cấp 1: +${x[3]}%)`}</div>`).join('')}</div>`; })() : ''}
    <div class="sl"><b>${L ? 'Cấp hiện tại ' + L : 'Nếu học (cấp 1)'}</b>${lines(show)}</div>
    ${next && L ? `<div class="sl"><b>Cấp kế tiếp ${next}</b>${lines(next)}</div>` : ''}
    <div class="btnrow">${act && L ? '<button class="btn" id="skMain">Chọn làm chiêu chính</button>' : ''}<button class="btn" id="skPlus" ${canLearn(s) ? '' : 'disabled'}>+ Cộng điểm</button><button class="btn red" id="skMinus" ${L ? '' : 'disabled'}>− Rút điểm</button></div>`, () => {
    bindSkState($('#mBody'));
    const m = $('#skMain'); if (m) m.onclick = () => { S.main = s.id; S.mainLock = true; R.dirty = true; recalc(); renderSkill(); toast('Chiêu chính: ' + s.n); skillModal(id); };
    $('#skPlus').onclick = () => { if (!canLearn(s)) return; skLearn(id); uiSfx('learn'); R.dirty = true; recalc(); renderSkill(); save(); skillModal(id); };
    $('#skMinus').onclick = () => { if (unlearnSkill(id)) skillModal(id); };
  });
}
/* Danh thuong (JX1: chieu mac dinh theo vu khi, khong ton noi luc): khoa lam chieu chinh duoc */
function basicCard() {
  const b = R.P && R.P.basic; if (!b) return '';
  const w = S.eq.weapon, on = S.mainLock && S.main === 'basic', cur = R.P.main === b;
  const kind = !w ? 'Quyền cước (tay không)' : R.P.ranged ? 'Ám khí / tầm xa' : 'Binh khí cận chiến';
  return `<div class="skl${cur ? ' main' : ''}" id="basicSk"><img class="sic" src="img/s/8.png" alt=""><div class="info"><b>Đánh thường</b> <span class="tag attack">Tấn công</span>
    <small>${kind} · ~${fmt(Math.round(b.tot))} sát thương / đòn · ${b.rate.toFixed(2)} đòn/giây · tầm ${b.rad} · 0 nội lực</small></div>
    <span class="pm"><button class="btn sm${on ? ' on' : ''}" id="bBasic">${on ? 'Đang khóa' : 'Dùng làm chiêu chính'}</button></span></div>`;
}

function renderSkill() {
  const f = FAC[S.fac];
  if (f.novice) {
    const list = FACTIONS.filter(x => x.series === f.series && (typeof facVisible !== 'function' || facVisible(x)));
    $('#t-skill').innerHTML = `<h3>Vô Môn Phái <small>${S.skPts} điểm kỹ năng</small></h3><div class="card"><p class="desc">Chưa có võ công. Đạt <b>cấp ${NOVICE_LV}</b> để gia nhập môn phái hệ <b style="color:${SERIES_COL[f.series]}">${SERIES[f.series]}</b>: ${list.map(x => facAllowed(x, S.sex) ? esc(x.n) : `<s>${esc(x.n)}</s>`).join(', ')}. Điểm kỹ năng nhận được trước đó được giữ lại.</p><div class="btnrow"><button class="btn" id="bJoin" ${S.lvl >= NOVICE_LV ? '' : 'disabled'}>Gia nhập môn phái${S.lvl >= NOVICE_LV ? '' : ` (cấp ${S.lvl}/${NOVICE_LV})`}</button></div></div>`;
    $('#bJoin').onclick = joinModal; return;
  }
  const rows = f.skills.map(id => {
    const s = SK[id], L = S.sk[id] || 0, act = isAttack(s), bonus = L ? skillBonusLv(id) : 0;
    const a = act && L ? activeInfo(R.P, s, L + bonus) : null;
    return `<div class="skl${S.lvl < s.req ? ' lock' : ''}${R.P.main.id === +id ? ' main' : ''}" data-id="${id}">
      <img class="sic" src="${esc(s.ic || '')}" alt=""><div class="info"><b>${esc(s.n)}</b>${s.book && !bookOk(s) ? ' <small class="reqbad">cần Mật Tịch</small>' : ''}${s.tier === 90 && L && L < s.max && matHave('misc', 'dtbk') > 0 ? ` <button class="btn sm" data-dt="${id}">📕</button>` : ''}</div>
      <span class="lvl">${bonus ? `<b class="skb" title="Cấp hiệu lực = ${L} + ${bonus} từ trang bị">${L + bonus}</b><small>/${s.max} (${L}+${bonus})</small>` : `${L}/${s.max}`}</span><span class="pm"><button class="plus" data-id="${id}" title="Cộng 1 điểm" ${canLearn(s) ? '' : 'disabled'}>+</button><button class="minus" data-id="${id}" title="Rút lại 1 điểm" ${L > 0 ? '' : 'disabled'}>−</button><button class="skinfo" data-id="${id}" title="Thông tin kỹ năng">i</button></span>
      </div>`;
  }).join('');
  $('#t-skill').innerHTML = `<h3>${esc(f.n)} <small>${S.skPts} điểm kỹ năng</small> <button class="btn sm" id="bSugSk">Gợi ý</button> <button class="btn sm" id="bTT">Tẩy Tủy</button></h3><div class="dim small">Mật Tịch: ${Object.keys(BOOK_N).map(k => `${BOOK_N[k].replace('Võ Lâm Mật Tịch ', '')} ×${matHave('misc', k)}`).join(' · ')} <span class="dim">(hạ trùm cấp cao, Dã Tẩu, Sát Thủ, Kỳ Trân Các)</span> · Đại Thành Bí Kíp ×${matHave('misc', 'dtbk')} · Kim Nguyên Bảo ${S.knb || 0}</div><div class="card"><label><input type="checkbox" id="cRot" ${S.rot === false ? '' : 'checked'}> Xoay chiêu tự động khi farm: luân phiên các chiêu gán ở ô 1 đến 4 (phím R), luôn có 2 chiêu mạnh nhất, bỏ chiêu hết nội lực</label>${skOptsHTML()}</div><p class="dim small">Chạm vào chiêu tấn công đã học để khóa làm chiêu chính${S.mainLock ? ' (<a id="bAutoMain">bỏ khóa</a>)' : ' (đang tự chọn chiêu mạnh nhất)'}.</p>${rows}`;
  document.querySelectorAll('#t-skill .plus').forEach(b => b.onclick = e => { e.stopPropagation(); const s = SK[b.dataset.id]; if (!canLearn(s)) return; skLearn(s.id); uiSfx('learn'); R.dirty = true; recalc(); renderSkill(); save(); });
  document.querySelectorAll('#t-skill .minus').forEach(b => b.onclick = e => { e.stopPropagation(); unlearnSkill(+b.dataset.id); });
  document.querySelectorAll('#t-skill .skinfo').forEach(b => b.onclick = e => { e.stopPropagation(); skillModal(+b.dataset.id); });
  document.querySelectorAll('#t-skill .slots button').forEach(b => b.onclick = e => { e.stopPropagation(); assignSlot(+b.dataset.slot, +b.dataset.sid); renderSkill(); });
  $('#bSugSk').onclick = suggestModal; $('#bTT').onclick = tayTuyModal;
  $('#cRot').onchange = () => toggleRot(); document.querySelectorAll('#t-skill [data-dt]').forEach(b => b.onclick = e => { e.stopPropagation(); useDaiThanh(+b.dataset.dt); }); bindSkOpts(); bindSkState($('#t-skill'));
  const am = $('#bAutoMain'); if (am) am.onclick = () => { S.mainLock = false; R.dirty = true; recalc(); renderSkill(); };
  const bb = $('#bBasic'); if (bb) bb.onclick = e => { e.stopPropagation(); if (S.mainLock && S.main === 'basic') S.mainLock = false; else { S.main = 'basic'; S.mainLock = true; } R.dirty = true; recalc(); renderSkill(); renderPad(); save(); toast(S.mainLock && S.main === 'basic' ? 'Chiêu chính: Đánh thường' : 'Bỏ khóa đánh thường'); };
  document.querySelectorAll('#t-skill .skl[data-id]').forEach(r => r.onclick = () => { const s = SK[r.dataset.id]; if (isAttack(s) && S.sk[s.id]) { S.main = s.id; S.mainLock = true; R.dirty = true; recalc(); renderSkill(); toast('Chiêu chính: ' + s.n); } else skillModal(s.id); });
}

/* ---------- the: tui do ---------- */
const INV_SORTS = [['new', 'Mới nhặt'], ['rar', 'Độ hiếm'], ['lvl', 'Cấp đồ'], ['slot', 'Loại'], ['pow', 'Sức mạnh']];
const SLOT_ORDER = Object.fromEntries(SLOTS.map(([k], i) => [k, i]).concat([['ring', 7]]));
function invSorted() {
  const k = S.invSort || 'new', a = S.inv.slice();
  if (k === 'rar') a.sort((x, y) => y.r - x.r || y.lvl - x.lvl);
  else if (k === 'lvl') a.sort((x, y) => y.lvl - x.lvl || y.r - x.r);
  else if (k === 'slot') a.sort((x, y) => (SLOT_ORDER[DETAIL_SLOT[x.d]] ?? 99) - (SLOT_ORDER[DETAIL_SLOT[y.d]] ?? 99) || y.lvl - x.lvl);
  else if (k === 'pow') a.sort((x, y) => itemPower(y) - itemPower(x));
  return a;
}
function renderInv() {
  invDirty = false;
  const f = lootFilter();
  const rar = RAR_VI.map((n, i) => `<option value="${i}" ${f.minRar === i ? 'selected' : ''}>${n}</option>`).join('');
  const lv = Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${f.minLvl === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('');
  const mg = Array.from({ length: 7 }, (_, i) => `<option value="${i}" ${(f.minMag || 0) === i ? 'selected' : ''}>${i}</option>`).join('');
  const grp = LOOT_ATTR_GROUPS.map(([n], i) => `<label class="chip2"><input type="checkbox" data-g="${i}" ${f.groups.includes(i) ? 'checked' : ''}>${n}</label>`).join('');
  const ser = (typeof visibleSeries === 'function' ? visibleSeries() : SERIES.map((_, i) => i)).map(i => `<label class="chip2" style="color:${SERIES_COL[i]}"><input type="checkbox" data-s="${i}" ${f.series.includes(i) ? 'checked' : ''}>${SERIES[i]}</label>`).join('');
  const slt = LOOT_SLOT_GROUPS.map(([k, n]) => `<label class="chip2"><input type="checkbox" data-sl="${k}" ${f.slots.includes(k) ? 'checked' : ''}>${n}</label>`).join('');
  const onGround = R.ground.length, match = R.ground.filter(d => lootMatch(d.it)).length;
  const invBad = S.inv.filter(i => !lootMatch(i) && !sellProtected(i)), locked = S.inv.filter(i => i.lock).length;
  const pre = lootPresets();
  $('#t-inv').innerHTML = `<div class="invbar"><span>${S.inv.length}/${INV_MAX}</span><select id="iSort" title="Sắp xếp hiển thị">${INV_SORTS.map(([k, n]) => `<option value="${k}" ${(S.invSort || 'new') === k ? 'selected' : ''}>${n}</option>`).join('')}</select><span class="sp"></span>
    <button class="btn sm" id="bStash">Kho chung</button><button class="btn sm" id="bDonKho">🧹 Dọn kho</button><button class="btn sm" id="bBest">Mặc đồ tốt</button><button class="btn sm" id="bUnequip">Gỡ trang bị</button><button class="btn sm red" id="bSellAll" ${invBad.length ? '' : 'disabled'}>${invBad.length ? `Bán ${invBad.length} món không khớp lọc` : 'Không có đồ để bán'}</button></div>
    <div class="invgrid">${invSorted().map(itemCell).join('')}</div>
    <p class="dim small">${locked ? `${locked} món đã khóa 🔒 (không tự bán, không bán hàng loạt, không hợp Huyền Tinh). ` : ''}${S.lootF.setOnly ? `Đang chỉ giữ bộ: ${S.lootF.setKeep.join(', ') || '(chưa chọn bộ nào)'}. ` : ''}Mở chi tiết món đồ để khóa / mở khóa.</p>
    <div class="btnrow"><button class="btn sm" id="bKtcI">🏮 Kỳ Trân Các</button></div>
    ${verVio() ? (() => { const e = f.ep; return `<div class="card lootf" id="epLoot"><b>💎 Đồ để ép Tím</b> <small class="dim">nhặt riêng cả khi không khớp bộ lọc bên dưới, không chiếm hành trang</small>
      <label><input type="checkbox" id="eWhite" ${e.white ? 'checked' : ''}> Đồ trắng (phôi để chế tạo đồ Tím)</label>
      <label><input type="checkbox" id="eJew" ${e.jew ? 'checked' : ''}> Nhẫn / dây chuyền / ngọc bội không tốt hơn đồ đang mặc (luyện Huyền Tinh)</label>
      <label><input type="checkbox" id="eBlue" ${e.blue ? 'checked' : ''}> Đồ xanh có dòng cấp ≥ <select id="eBlueLv">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${e.blueLv === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select> (lấy thuộc tính ra đá)</label>
      <div class="row">Cất vào <select id="eDest">${[['box', 'Rương ép'], ['stash', 'Kho chung'], ['inv', 'Hành trang']].map(([k, n]) => `<option value="${k}" ${e.dest === k ? 'selected' : ''}>${n}</option>`).join('')}</select> <small class="dim">Rương ép ${epBox().length}/${EP_BOX_MAX}</small></div></div>`; })() : ''}
    <h3>Bộ lọc đồ <small>${onGround} món trên đất · ${match} khớp</small></h3>
    <div class="card lootf${f.mode === 'smart' ? ' smart' : ''}">
      <div class="dtabs lmode"><button data-lm="smart" class="${f.mode === 'smart' ? 'on' : ''}">⭐ Thông minh</button><button data-lm="custom" class="${f.mode === 'smart' ? '' : 'on'}">⚙ Tùy chỉnh</button></div>
      ${f.mode === 'smart' ? `<div class="desc small">Giữ <b class="cp">đồ làm nhân vật mạnh hơn</b> so với đồ đang mặc (▲ trên ô đồ; tính cả món sắp mặc được: cấp yêu cầu ≤ cấp + 10, đúng giới tính / phái / loại vũ khí), đồ quý, đồ nộp Dã Tẩu. Đồ để ép Tím nhặt riêng theo mục 💎 ở trên. Còn lại tự bán. <small class="dim">Hành trang có ${S.inv.filter(isUpgrade).length} món nâng cấp.</small></div>` : ''}
      <div class="btnrow presets lc">${LOOT_QUICK.map(([n], i) => `<button class="btn sm" data-q="${i}">${n}</button>`).join('')}</div>
      <div class="btnrow presets lc">${pre.map((p, i) => `<span class="pslot"><button class="btn sm" data-pl="${i}" ${p ? '' : 'disabled'}>Bộ ${i + 1}${p ? '' : ' (trống)'}</button><button class="btn sm" data-ps="${i}" title="Lưu bộ lọc hiện tại vào bộ ${i + 1}">💾</button></span>`).join('')}</div>
      <label><input type="checkbox" id="fAuto" ${f.auto ? 'checked' : ''}> Tự đi nhặt đồ khi hết quái</label>
      <label><input type="checkbox" id="fAll" ${f.pickAll ? 'checked' : ''}> <b>Nhặt toàn bộ</b>, bán theo bộ lọc: nhặt mọi món rơi ra; khi hành trang đầy hoặc bấm Bán thì chỉ bán món không khớp bộ lọc (bỏ chọn: chỉ nhặt món khớp bộ lọc)</label>
      <label><input type="checkbox" id="fRare" ${f.keepRare ? 'checked' : ''}> Luôn nhặt đồ quý (Hoàng Kim, Bạch Kim, Tím, ngựa hiếm) dù không khớp</label>
      <label><input type="checkbox" id="fSetMine" ${f.setMine ? 'checked' : ''}> Đồ bộ: chỉ giữ bộ của phái mình và bộ chung (bộ phái khác: tự bán)</label>
      <label><input type="checkbox" id="fSetOnly" ${f.setOnly ? 'checked' : ''}> Đồ bộ: chỉ giữ các dòng bộ được chọn (bộ khác không nhặt, tự bán, bán hàng loạt được) <button class="btn sm" id="fSetAll" ${f.setOnly ? '' : 'disabled'}>Tất cả</button> <button class="btn sm" id="fSetCap" ${f.setOnly ? '' : 'disabled'}>Mặc được</button> <button class="btn sm" id="fSetNone" ${f.setOnly ? '' : 'disabled'}>Bỏ hết</button></label>
      <div class="chips${f.setOnly ? '' : ' off'}">${SET_FAMILIES.map(([n, lv]) => `<label class="chip2"><input type="checkbox" data-fam="${n}" ${f.setKeep.includes(n) ? 'checked' : ''} ${f.setOnly ? '' : 'disabled'}>${n === 'Môn phái' || n === 'Bộ chung' ? n : 'Bộ ' + n} <small class="dim">${lv ? 'cấp ' + lv : 'mọi cấp'}</small> · ${S.inv.filter(x => setFamily(x) === n).length}</label>`).join('')}</div>
      <div class="lc row">Độ hiếm từ <select id="fRar">${rar}</select> · cấp đồ từ <select id="fLvl">${lv}</select> · ít nhất <select id="fMag">${mg}</select> dòng</div>
      <label class="lc"><input type="checkbox" id="fWear" ${f.wear ? 'checked' : ''}> Chỉ đồ nhân vật mặc được (giới tính, hệ, môn phái; cấp yêu cầu ≤ cấp hiện tại + 5)</label>
      <label class="lc"><input type="checkbox" id="fFacW" ${f.facW ? 'checked' : ''}> Vũ khí: chỉ đúng loại của môn phái</label>
      <label class="lc"><input type="checkbox" id="fAcc" ${f.accrue ? 'checked' : ''}> Chỉ hệ được nhân vật tương sinh (${FAC[S.fac] ? SERIES[heroSeries()] + ' → ' + SERIES[accrueOf(heroSeries())] : ''}: tự mở 1 dòng ẩn)</label>
      <div class="lc dim small">Loại trang bị (bỏ trống = mọi loại):</div><div class="lc chips">${slt}</div>
      <div class="lc dim small">Có ít nhất một thuộc tính (bỏ trống = mọi thuộc tính):</div><div class="lc chips">${grp}</div>
      <div class="lc dim small">Hệ của món đồ (bỏ trống = mọi hệ):</div><div class="lc chips">${ser}</div>
      <div class="dim small">Hành trang: ${S.inv.length - invBad.length}/${S.inv.length} món khớp hoặc được bảo vệ. Chạm vào món đồ trên sân để đi nhặt tay. Trên 40 món thì món cũ nhất tự bán. Khi vắng mặt, đồ không khớp tự bán.</div>
    </div>`;
  const upd = () => { LF_KEY = null; save(); renderInv(); };
  document.querySelectorAll('#t-inv [data-lm]').forEach(b => b.onclick = () => { f.mode = b.dataset.lm; toast(f.mode === 'smart' ? 'Lọc thông minh: chỉ giữ đồ nâng cấp + đồ quý' : 'Lọc tùy chỉnh'); upd(); });
  $('#iSort').onchange = e => { S.invSort = e.target.value; renderInv(); save(); };
  $('#fAuto').onchange = e => { f.auto = e.target.checked; upd(); };
  $('#fAll').onchange = e => { f.pickAll = e.target.checked; upd(); };
  $('#fRare').onchange = e => { f.keepRare = e.target.checked; upd(); };
  $('#fWear').onchange = e => { f.wear = e.target.checked; upd(); };
  $('#fSetMine').onchange = e => { f.setMine = e.target.checked; upd(); };
  $('#fSetAll').onclick = () => { f.setKeep = SET_FAMILIES.map(x => x[0]); upd(); };
  $('#fSetCap').onclick = () => { f.setKeep = SET_FAMILIES.filter(x => x[1] <= levelCap()).map(x => x[0]); upd(); };
  $('#fSetNone').onclick = () => { f.setKeep = []; upd(); };
  $('#fSetOnly').onchange = e => { f.setOnly = e.target.checked; if (f.setOnly && !f.setKeep.length) f.setKeep = SET_FAMILIES.map(x => x[0]); upd(); };
  document.querySelectorAll('#t-inv [data-fam]').forEach(b => b.onchange = () => { const v = b.dataset.fam; f.setKeep = b.checked ? [...new Set(f.setKeep.concat(v))] : f.setKeep.filter(x => x !== v); upd(); });
  $('#fFacW').onchange = e => { f.facW = e.target.checked; upd(); };
  $('#fAcc').onchange = e => { f.accrue = e.target.checked; upd(); };
  $('#fRar').onchange = e => { f.minRar = +e.target.value; upd(); };
  $('#fLvl').onchange = e => { f.minLvl = +e.target.value; upd(); };
  $('#fMag').onchange = e => { f.minMag = +e.target.value; upd(); };
  document.querySelectorAll('#t-inv [data-g]').forEach(b => b.onchange = () => { const g = +b.dataset.g; f.groups = b.checked ? [...new Set(f.groups.concat(g))] : f.groups.filter(x => x !== g); upd(); });
  document.querySelectorAll('#t-inv [data-s]').forEach(b => b.onchange = () => { const v = +b.dataset.s; f.series = b.checked ? [...new Set(f.series.concat(v))] : f.series.filter(x => x !== v); upd(); });
  document.querySelectorAll('#t-inv [data-sl]').forEach(b => b.onchange = () => { const v = b.dataset.sl; f.slots = b.checked ? [...new Set(f.slots.concat(v))] : f.slots.filter(x => x !== v); upd(); });
  document.querySelectorAll('#t-inv [data-q]').forEach(b => b.onclick = () => { const q = LOOT_QUICK[+b.dataset.q]; lootLoadPreset(Object.assign(LOOT_DEF(), q[1])); toast('Bộ lọc: ' + q[0]); upd(); });
  document.querySelectorAll('#t-inv [data-pl]').forEach(b => b.onclick = () => { const p = lootPresets()[+b.dataset.pl]; if (p) { lootLoadPreset(p); toast(`Dùng bộ lọc ${+b.dataset.pl + 1}`); upd(); } });
  document.querySelectorAll('#t-inv [data-ps]').forEach(b => b.onclick = () => { lootSavePreset(+b.dataset.ps); toast(`Đã lưu bộ lọc ${+b.dataset.ps + 1}`); upd(); });
  $('#bStash').onclick = () => stashModal();
  $('#bKtcI').onclick = () => ktcModal();
  if ($('#epLoot')) { const e = lootFilter().ep, ch = () => { save(); invDirty = true; };
    $('#eWhite').onchange = x => { e.white = x.target.checked; ch(); }; $('#eJew').onchange = x => { e.jew = x.target.checked; ch(); }; $('#eBlue').onchange = x => { e.blue = x.target.checked; ch(); };
    $('#eBlueLv').onchange = x => { e.blueLv = +x.target.value; ch(); }; $('#eDest').onchange = x => { e.dest = x.target.value; ch(); }; }
  $('#bBest').onclick = () => { for (const it of S.inv.slice()) if (betterThanEquipped(it)) equip(it, true); refresh(); };
  $('#bUnequip').onclick = () => {
    const r = unequipAll();
    if (!r.n) toast(r.left ? 'Túi đầy, không gỡ thêm được' : 'Không có trang bị đang mặc');
    else toast(`Đã gỡ ${r.n} món${r.skipped ? `, còn ${r.skipped} món (túi đầy)` : ''}`);
    refresh();
  };
  $('#bDonKho').onclick = () => donKhoModal();
  $('#bSellAll').onclick = () => { const r = sellUnmatched(); toast(`Bán ${r.n} món (+${fmt(r.gold)} lượng)${r.kept ? `, giữ ${r.kept} món được bảo vệ` : ''}`); refresh(); };
  document.querySelectorAll('#t-inv .invgrid .it').forEach(b => b.onclick = () => itemModal(findItem(b.dataset.uid)));
}

/* ---------- the: khac ---------- */
function renderMore() {
  const cloud = typeof netOn === 'function' && netOn() && !NET.offline;
  $('#t-more').innerHTML = `${cloud ? `<h3>Lưu game</h3><div class="card"><p class="dim small">Nhân vật tự lưu lên máy chủ khi đã đăng nhập (mỗi 2 phút và khi thoát game). Đăng nhập cùng tài khoản ở máy / điện thoại khác là chơi tiếp.${NET.user ? ` Đang vào: <b>${esc(netUname())}</b>.` : ''}</p><div class="btnrow"><button class="btn" id="bCloud">🌐 Tài khoản · Lưu đám mây</button>${NET.user ? '<button class="btn" id="bAccSwitch">Đổi tài khoản</button>' : ''}</div></div>
    ` : `<h3>Lưu game</h3><div class="card"><p class="dim small">Nhân vật lưu trong trình duyệt của từng thiết bị (3 slot). Để chơi trên thiết bị khác: bấm <b>Tải file lưu</b>, chuyển file <code>.jxsave</code> sang thiết bị kia (Zalo, Drive, cáp…), rồi mở game ở đó và bấm <b>Nạp từ file</b>. File có chữ ký, sửa tay sẽ bị từ chối. Nên tải file định kỳ để sao lưu.</p>
    <div class="btnrow"><button class="btn" id="bDl">Tải file lưu (.jxsave)</button><button class="btn" id="bFile">Nạp từ file</button></div>
    <p class="dim small">Hoặc dùng mã văn bản:</p><div class="btnrow"><button class="btn" id="bExp">Xuất mã</button><button class="btn" id="bImp">Nhập mã</button></div><textarea id="saveTxt" rows="4" placeholder="Mã lưu game"></textarea></div>`}
    <h3>Âm thanh</h3><div class="card lootf">
      <label><input type="checkbox" id="sOn" ${sndCfg().on ? 'checked' : ''}> Tiếng động (đòn đánh, chiêu, quái, rơi đồ)</label>
      <div class="row">Âm lượng <input type="range" id="sVol" min="0" max="1" step="0.05" value="${sndCfg().vol}"></div>
      <label><input type="checkbox" id="mOn" ${sndCfg().music ? 'checked' : ''}> Nhạc nền theo bản đồ</label>
      <div class="row">Nhạc <input type="range" id="mVol" min="0" max="1" step="0.05" value="${sndCfg().mvol}"></div></div>
    <h3>Tự động</h3><div class="card"><label><input type="checkbox" id="cAuto" ${S.autoEquip ? 'checked' : ''}> Tự mặc đồ tốt hơn khi nhặt</label><br>
      <label><input type="checkbox" id="cPot" ${S.potOff ? '' : 'checked'}> Tự dùng thuốc khi sinh lực / nội lực dưới 50% · đã dùng ${fmt(S.potUsed || 0)}</label><br>
      <label><input type="checkbox" id="cPotBuy" ${S.potBuy === false ? '' : 'checked'}> Tự mua thuốc khi hết</label><br>
      <label><input type="checkbox" id="cRide" ${S.autoRide === false ? '' : 'checked'}> Auto tự lên ngựa khi di chuyển, xuống ngựa khi đánh bằng chiêu không dùng được trên ngựa</label>
      <div class="row small">${[0, 1].map(i => { const v = typeof slotShow === 'function' ? slotShow(i) : { name: '' }; return `<button class="btn sm" data-potsl="${i}">${i ? 'Nội lực (ô 2)' : 'Sinh lực (ô 1)'}: ${esc(v.name || 'Tự động')} ▾</button>`; }).join(' ')}</div>
      <label><input type="checkbox" id="cJunk" ${S.autoJunk === false ? '' : 'checked'}> Tự bán đồ thừa (yếu hơn đồ đang mặc cùng ô, vũ khí sai loại của phái; giữ tối đa 6 nhẫn / dây chuyền / ngọc bội để hợp Huyền Tinh)</label><br>
      <label><input type="checkbox" id="cPts" ${S.autoPts === true ? 'checked' : ''}> Tự cộng điểm tiềm năng và võ công (mặc định tắt: tự cộng ở thẻ Nhân vật và Võ công)</label></div>
    <h3>Tiện ích</h3><div class="card lootf">
      <label><input type="checkbox" id="cForge" ${S.autoForge ? 'checked' : ''}> Tự động rèn đồ (ghép mảnh Hoàng Kim, khảm Tím, hợp và thăng cấp Huyền Tinh; mỗi 30 giây)</label>
      <label><input type="checkbox" id="cBuy" ${S.autoBuy === false ? '' : 'checked'}> Tự mua vũ khí đúng loại ở Biện Kinh khi mạnh hơn ≥ 25% (tối đa 60% ngân lượng)</label>
      <div class="btnrow"><button class="btn" id="bKtc">🏮 Kỳ Trân Các</button><button class="btn" id="bStashM">Kho chung</button><button class="btn" id="bTut">Hướng dẫn</button><button class="btn" id="bCodex">Bách khoa</button><button class="btn" id="bSug">Gợi ý cộng điểm</button></div></div>
    <h3>Trợ năng</h3><div class="card lootf">
      <div class="row">Cỡ chữ <select id="uFs">${UI_FS.map((v, i) => `<option value="${i}" ${uiPrefs().fs === i ? 'selected' : ''}>${UI_FS_NAME[i]}</option>`).join('')}</select> <small class="dim">áp dụng cho bảng thông tin, thẻ và hộp thoại</small></div>
      <label><input type="checkbox" id="uSaver" ${uiPrefs().saver ? 'checked' : ''}> Tiết kiệm pin (vẽ 30 khung/giây, ngừng vẽ khi ẩn tab)</label>
      <small class="dim">Tay cầm: cần analog / D-pad để đi, A B X Y dùng chiêu 1–4, LB / RB uống thuốc HP / MP. Phím Esc đóng hộp thoại.</small></div>
    <h3>Điều khiển & Hiển thị</h3><div class="card"><label><input type="checkbox" id="cJoy" ${joyFixed() ? 'checked' : ''}> Joystick cố định ở góc trái dưới (bỏ chọn: joystick nổi theo ngón tay)</label><br>
      <label><input type="checkbox" id="cLowFx" ${S.lowFx ? 'checked' : ''}> Giảm hiệu ứng (mượt hơn trên máy yếu / đông quái)</label><br>
      <label><input type="checkbox" id="cJx" ${S.jxLook === false ? '' : 'checked'}> Hiển thị trang bị trên nhân vật (mũ, áo, vũ khí, ngựa)</label><br>
      <label><input type="checkbox" id="cLook" ${S.lookFx === false ? '' : 'checked'}> Ngoại hình theo trang bị (màu áo / mũ, hào quang đồ bộ và cường hóa, ánh vũ khí, bụi thần mã)</label></div>
    <h3>Nguồn dữ liệu</h3><div class="card small dim">Kỹ năng, quái, trang bị, thuộc tính và tỉ lệ rơi đồ trích từ dữ liệu Võ Lâm Truyền Kỳ 1 (bản fan chơi offline, phi thương mại).</div>
    <div class="btnrow"><button class="btn" id="bSwitch">Đổi nhân vật / slot</button><button class="btn red" id="bReset">Xóa nhân vật</button></div>`;
  const onc = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  onc('#bCloud', () => netModal('acc'));
  onc('#bAccSwitch', () => netSwitchAccount($('#bAccSwitch')));
  onc('#bDl', () => { if (downloadSaveFile()) toast('Đã tải file lưu: ' + saveFileName()); });
  onc('#bFile', () => pickSaveFile(null));
  onc('#bExp', () => { $('#saveTxt').value = exportSave(); toast('Đã xuất mã'); });
  onc('#bImp', () => importFlow($('#saveTxt').value, null));
  $('#cAuto').onchange = e => { S.autoEquip = e.target.checked; save(); };
  $('#cJunk').onchange = e => { S.autoJunk = e.target.checked; save(); };
  $('#sOn').onchange = e => { audInit(); sndCfg().on = e.target.checked; audApply(); save(); };
  $('#mOn').onchange = e => { audInit(); sndCfg().music = e.target.checked; audApply(); if (sndCfg().music) playMusic(R.town ? W.town.id : zoneOf(Math.min(S.stage, STAGES)).id); save(); };
  $('#sVol').oninput = e => { sndCfg().vol = +e.target.value; audApply(); };
  $('#mVol').oninput = e => { sndCfg().mvol = +e.target.value; audApply(); };
  $('#sVol').onchange = $('#mVol').onchange = () => save();
  $('#cPot').onchange = e => { S.potOff = !e.target.checked; save(); };
  $('#cPotBuy').onchange = e => { S.potBuy = e.target.checked; save(); };
  $('#cRide').onchange = e => { S.autoRide = e.target.checked; save(); };
  document.querySelectorAll('[data-potsl]').forEach(b => b.onclick = () => potSlotModal(+b.dataset.potsl));
  $('#cPts').onchange = e => { S.autoPts = e.target.checked; if (S.autoPts) { autoSpendAttrs(); autoSpendSkills(); recalc(); } save(); };
  $('#cJoy').onchange = e => { S.joy = e.target.checked ? 'fixed' : 'float'; save(); };
  $('#cLowFx').onchange = e => { S.lowFx = e.target.checked; save(); };
  $('#cLook').onchange = e => { S.lookFx = e.target.checked; save(); };
  $('#cJx').onchange = e => { S.jxLook = e.target.checked; R.dirty = true; save(); };
  $('#cBuy').onchange = e => { S.autoBuy = e.target.checked; save(); };
  $('#cForge').onchange = e => { S.autoForge = e.target.checked; if (S.autoForge) autoForge(); save(); };
  $('#bStashM').onclick = () => stashModal(); $('#bKtc').onclick = () => ktcModal(); $('#bTut').onclick = () => tutorialModal(0); $('#bCodex').onclick = () => codexModal(); $('#bSug').onclick = suggestModal;
  $('#uFs').onchange = e => { setUiPref({ fs: +e.target.value }); }; $('#uSaver').onchange = e => setUiPref({ saver: e.target.checked });
  $('#bSwitch').onclick = () => switchCharacter();
  $('#bReset').onclick = () => modal(`<h3>Xóa nhân vật?</h3><p class="desc">Xóa nhân vật ở slot ${SLOT + 1} (${esc(FAC[S.fac] ? FAC[S.fac].n : '')} cấp ${S.lvl}). Toàn bộ tiến trình của slot này sẽ mất; các slot khác không ảnh hưởng.</p><div class="btnrow"><button class="btn red" id="bYes">Xóa</button></div>`, () => $('#bYes').onclick = () => deleteSlot(SLOT));
}

/* ---------- khung chung ---------- */
function showTab(t) {
  curTab = t;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  document.querySelectorAll('.tab').forEach(el => el.classList.toggle('hidden', el.id !== 't-' + t));
  refresh();
}
function refresh() {
  if (typeof modeSwSync === 'function') modeSwSync();
  if (!S.fac) return;
  if (R.dirty) recalc();
  ({ log: renderLog, char: renderChar, skill: renderSkill, inv: renderInv, forge: renderForge, quest: renderQuest, more: renderMore })[curTab]();
  renderPad();
  updateDots();
}
function updateDots() { $('#dotChar').classList.toggle('on', S.attrPts > 0); const df = $('#dotForge'), dq = $('#dotQuest'); if (df) df.classList.toggle('on', forgeDot()); if (dq) dq.classList.toggle('on', questDot()); $('#dotSkill').classList.toggle('on', S.skPts > 0 && FAC[S.fac] && FAC[S.fac].skills.some(id => canLearn(SK[id])) || (isNovice() && S.lvl >= NOVICE_LV)); }
function updateTop() {
  const P = R.P; if (!P) return;
  { const hw = heroGfx(), lb = $('.lvbox'); if (hw && lb) lb.style.setProperty('--pl', `url('${hw.img}')`); }
  $('#lv').textContent = S.lvl; $('#gold').textContent = fmt(S.gold); { const k = $('#knbTop'); if (k) k.textContent = fmt(S.knb || 0); } $('#heroName').textContent = FAC[S.fac] ? FAC[S.fac].n : '';
  { let bb = $('#skBuffs'); if (!bb) { bb = document.createElement('div'); bb.id = 'skBuffs'; $('#battle').appendChild(bb); }
    const l = typeof stateIcons === 'function' ? stateIcons() : []; const h = l.map(x => `<div class="sti" title="${esc(x.n)}"><img src="${esc(x.ic || '')}" alt=""><b>${fmtLeft(x.t)}</b></div>`).join(''); if (bb.innerHTML !== h) bb.innerHTML = h; }
  $('#stageLbl').textContent = R.dg ? (R.dg.kind === 'boat' ? '⛵ Phong Lăng Độ' : R.dg.kind === 'wb' ? 'Boss tuần' : R.dg.d.n) : `${modeOf()[1]} ${zoneOf(Math.min(S.stage, STAGES)).n} ${R.field && !R.town ? ` · hạ ${fmt(R.field.kills)}` : ''}`;
  const need = J.exp[S.lvl - 1] || 1;
  const xp = Number.isFinite(+S.xp) ? +S.xp : 0;
  const xpPct = Math.max(0, Math.min(100, need > 0 ? (xp / need * 100) : 0));
  $('#xpBar').style.width = xpPct + '%'; $('#xpTxt').textContent = `${xpPct.toFixed(1)}%`;
  const lifePct = P.life > 0 && Number.isFinite(+R.life) ? Math.max(0, Math.min(100, R.life / P.life * 100)) : 0;
  const manaPct = P.mana > 0 && Number.isFinite(+R.mana) ? Math.max(0, Math.min(100, R.mana / P.mana * 100)) : 0;
  $('#hpBar').style.width = lifePct + '%'; $('#hpTxt').textContent = `${fmt(R.life)} / ${fmt(P.life)}`;
  $('#mpBar').style.width = manaPct + '%'; $('#mpTxt').textContent = `${fmt(R.mana)} / ${fmt(P.mana)}`;
  $('#mainSk').textContent = P.main.n;
  const ls = $('#lvS'); if (ls) ls.textContent = S.lvl; const ps = $('#pwS'); if (ps) ps.textContent = fmt(R.power || 0);   // thanh trang thai JX1
}
/* Nap tu file .jxsave (hoac ma van ban): chon slot dich, canh bao ghi de, roi tai lai trang */
function pickSaveFile(after) {
  if (typeof netOn === 'function' && netOn()) { toast('Bản online chỉ dùng lưu đám mây'); return; }
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.jxsave,.json,.txt,application/json,text/plain'; inp.style.display = 'none';
  inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); if (!f) return; const r = new FileReader(); r.onload = () => importFlow(String(r.result), after); r.onerror = () => toast('Không đọc được file'); r.readAsText(f); };
  document.body.appendChild(inp); inp.click();
}
function importFlow(txt, after, slot) {
  if (typeof netOn === 'function' && netOn()) { toast('Bản online chỉ dùng lưu đám mây'); return; }
  let st; try { st = parseSaveText(txt); } catch (e) { toast(e.message || 'File không hợp lệ'); return; }
  const f = FAC[st.fac], desc = `${esc(f.n)} cấp ${Math.max(1, Math.min(MAX_LEVEL, st.lvl | 0))}`;
  const rows = [...Array(SLOT_N).keys()].map(i => { const o = slotInfo(i), g = o && FAC[o.fac];
    return `<div class="slotrow ${o ? '' : 'empty'}"><span><b>Slot ${i + 1}</b><small>${o && g ? esc(g.n) + ' cấp ' + o.lvl + ' (sẽ bị ghi đè)' : 'Trống'}</small></span><button class="btn ${o ? 'red' : ''}" data-into="${i}">${o ? 'Ghi đè' : 'Nạp vào'}</button></div>`; }).join('');
  modal(`<h3>Nạp file lưu</h3><p class="desc">Nhân vật trong file: <b>${desc}</b>. Chọn slot để nạp (slot đã có nhân vật sẽ giữ một bản sao lưu).</p><div class="slotlist">${rows}</div>${after ? '<div class="btnrow"><button class="btn" id="impBack">Quay lại</button></div>' : ''}`, () => {
    document.querySelectorAll('#mBody [data-into]').forEach(b => b.onclick = () => { try { if (SLOT === +b.dataset.into) SAVE_LOCK = true; writeSlot(+b.dataset.into, st); } catch (e) { toast(e.message); return; } location.reload(); });
    const bk = $('#impBack'); if (bk) bk.onclick = after;
  }, !!after && !S.fac);
}
/* Man hinh chon nhan vat: 3 slot. Chon / tao -> dat con tro roi tai lai trang; xoa co buoc xac nhan rieng */
function slotMenu(confirmDel) {
  const rows = [...Array(SLOT_N).keys()].map(i => {
    const o = slotInfo(i), f = o && FAC[o.fac];
    if (!o || !f) return `<div class="slotrow empty"><span><b>Slot ${i + 1}</b><small>Trống</small></span><button class="btn" data-play="${i}">Tạo nhân vật</button></div>`;
    const ago = o.last ? new Date(o.last).toLocaleString('vi-VN') : '';
    if (confirmDel === i) return `<div class="slotrow del"><span><b>Xóa slot ${i + 1}?</b><small>${esc(f.n)} cấp ${o.lvl} sẽ mất vĩnh viễn</small></span><button class="btn red" data-del-yes="${i}">Xóa</button><button class="btn" data-del-no="1">Hủy</button></div>`;
    const locked = typeof thoTestGuardSlot === 'function' && !thoTestGuardSlot(o.fac);
    const awaitAdm = locked && window.__thoAwaitAdmin;
    const lockLbl = awaitAdm ? 'Đang mở…' : 'Khóa';
    const lockHint = awaitAdm ? ' · chờ đăng nhập admin' : (locked ? ' · chỉ admin' : '');
    return `<div class="slotrow${locked ? ' lock' : ''}"><img src="${esc((heroGfx(o.fac, o.sex) || {}).img || '')}" alt=""><span><b style="color:${SERIES_COL[f.series]}">${esc(o.name && o.name !== f.n ? o.name + ' · ' : '')}${esc(f.n)}</b><small>Cấp ${o.lvl} · ải ${o.stage}${ago ? ' · ' + esc(ago) : ''}${lockHint}</small></span>${locked ? `<button class="btn" disabled>${lockLbl}</button>` : '<button class="btn" data-play="' + i + '">Chơi</button>'}<button class="btn red" data-del="${i}">Xóa</button></div>`;
  }).join('');
  modal(`<h3>Chọn nhân vật</h3><p class="desc">Mỗi slot là một nhân vật riêng, lưu độc lập.${window.__thoAwaitAdmin ? ' <span class="cp">Đang xác nhận tài khoản admin…</span>' : ''}</p><div class="slotlist">${rows}</div>${typeof netOn === 'function' && netOn() ? '' : '<div class="btnrow"><button class="btn" id="slotImp">Nạp từ file lưu (.jxsave)</button></div>'}`, () => {
    const sc = $('#slotCloud'); if (sc) sc.onclick = () => netModal('acc');
    const si = $('#slotImp'); if (si) si.onclick = () => pickSaveFile(() => slotMenu());
    document.querySelectorAll('#mBody [data-play]').forEach(b => b.onclick = () => { try { localStorage.setItem(SLOT_PTR, b.dataset.play); } catch (e) { /* bo qua */ } SAVE_LOCK = true; location.reload(); });
    document.querySelectorAll('#mBody [data-del]').forEach(b => b.onclick = () => slotMenu(+b.dataset.del));
    document.querySelectorAll('#mBody [data-del-no]').forEach(b => b.onclick = () => slotMenu());
    document.querySelectorAll('#mBody [data-del-yes]').forEach(b => b.onclick = () => deleteSlot(+b.dataset.delYes));
  }, true);
}
/* ---------- tao nhan vat (kieu JX1): ten, gioi tinh, he; cap 10 moi vao phai cung he ---------- */
const SERIES_DESC = ['Cương mãnh, ngoại công mạnh', 'Độc dược, ám khí', 'Mềm dẻo, nội công băng', 'Hỏa công, lực đánh lớn', 'Lôi, kiếm khí, bền bỉ'];
let NEWC = { name: '', sex: 0, s: 0 };
function pickFaction() {
  const facs = s => FACTIONS.filter(f => f.series === s && (typeof facVisible !== 'function' || facVisible(f)));
  const facTxt = (s, sex) => facs(s).map(f => facAllowed(f, sex) ? esc(f.n) : `<s>${esc(f.n)}</s>`).join(' · ');
  const serIdx = typeof visibleSeries === 'function' ? visibleSeries() : [0, 1, 2, 3, 4];
  if (!serIdx.includes(NEWC.s)) NEWC.s = 0;
  const st = J.start[mechSeries(NEWC.s) * 2 + NEWC.sex] || {};
  const ok = facs(NEWC.s).some(f => facAllowed(f, NEWC.sex)) || (NEWC.s === 5 && typeof canSeeThoTest === 'function' && canSeeThoTest());
  modal(`<h3>Tạo nhân vật</h3><p class="desc">Như Võ Lâm Truyền Kỳ: chọn tên, giới tính và hệ ngũ hành. Đến <b>cấp ${NOVICE_LV}</b> mới gia nhập môn phái cùng hệ.</p>
    <div class="card lootf newc"><div class="row">Tên <input id="ncName" maxlength="14" placeholder="Tên nhân vật" value="${esc(NEWC.name)}"></div>
      <div class="row">Giới tính <span class="seg">${['Nam', 'Nữ'].map((n, i) => `<button class="btn sm${NEWC.sex === i ? ' on' : ''}" data-sx="${i}">${n}</button>`).join('')}</span></div>
      <div class="dim small">Hệ ngũ hành (Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim):</div>
      <div class="serpick">${serIdx.map(i => `<button data-se="${i}" class="${NEWC.s === i ? 'on' : ''}" style="--c:${SERIES_COL[i]}"><b>${SERIES[i]}</b><small>${SERIES_DESC[i] || ''}</small><small>Phái: ${facTxt(i, NEWC.sex) || (i === 5 ? 'Yên Tử★ · Bạch Đằng★ · Thạch Sơn★' : '—')}</small></button>`).join('')}</div>
      <div class="stats"><span>Sức mạnh</span><span>${st.str ?? '-'}</span><span>Thân pháp</span><span>${st.dex ?? '-'}</span><span>Sinh khí</span><span>${st.vit ?? '-'}</span><span>Nội công</span><span>${st.eng ?? '-'}</span></div>
      ${ok ? '' : `<p class="reqbad">Hệ ${SERIES[NEWC.s]} không có môn phái nhận ${NEWC.sex ? 'nữ' : 'nam'}.</p>`}
      <div class="btnrow"><button class="btn" id="ncGo" ${ok ? '' : 'disabled'}>Vào giang hồ</button></div></div>`, () => {
    const nm = $('#ncName'); nm.oninput = () => { NEWC.name = nm.value; };
    document.querySelectorAll('#mBody [data-sx]').forEach(b => b.onclick = () => { NEWC.name = nm.value; NEWC.sex = +b.dataset.sx; pickFaction(); });
    document.querySelectorAll('#mBody [data-se]').forEach(b => b.onclick = () => { NEWC.name = nm.value; NEWC.s = +b.dataset.se; pickFaction(); });
    $('#ncGo').onclick = () => { const n = nm.value.trim().replace(/\s+/g, ' '); if (n.length < 2) { toast('Tên cần ít nhất 2 ký tự'); return; } createCharacter(n.slice(0, 14), NEWC.sex, NEWC.s); };
  }, true);
}
function createCharacter(name, sex, series) {
  S.fac = 'vo' + series; S.sex = sex; S.sexSet = 1; S.name = name; if (typeof NET !== 'undefined' && NET.user) S.netOwner = NET.user.id;   // nhan vat tao boi tai khoan (duoc tai len dam may)
  starterGear();
  R.dirty = true; recalc(); R.life = R.P.life; R.mana = R.P.mana;
  if (typeof khNewbieSpawn === 'function') khNewbieSpawn();   // tan thu spawn Hoành Sơn Môn, gap Liễu Như Yên
  loginCheck(); dotGift();
  closeModal(true); save(); showTab('log');
  noticeModal();
  log(`<b>${esc(name)}</b> (${sex ? 'nữ' : 'nam'}, hệ <span style="color:${SERIES_COL[series]}">${SERIES[series]}</span>) bước vào giang hồ. Đạt cấp ${NOVICE_LV} để gia nhập môn phái.`);
  log(`🌱 Nhận <b>Hỗ Trợ Tân Thủ</b>: vòng sáng hồi ${NEWBIE_REGEN.life * 100}% sinh lực + ${NEWBIE_REGEN.mana * 100}% nội lực mỗi giây, <b>+${NEWBIE_XP * 100}% kinh nghiệm</b> luyện cấp đến cấp ${NEWBIE_LV}.`);
}
/* Cap 10: chon phai cung he (theo gioi tinh) */
function joinModal() {
  if (!isNovice()) return;
  const s = heroSeries(), list = FACTIONS.filter(f => f.series === s && (typeof facVisible !== 'function' || facVisible(f)));
  if (S.lvl < NOVICE_LV) { modal(`<h3>Gia nhập môn phái</h3><p class="desc">Cần đạt cấp ${NOVICE_LV} (hiện cấp ${S.lvl}). Các phái hệ ${SERIES[s]}: ${list.map(f => esc(f.n)).join(', ')}.</p>`); return; }
  const cards = list.map(f => { const ok = facAllowed(f, S.sex), sk = f.starter && SK[f.starter];
    return `<button data-j="${f.key}" ${ok ? '' : 'disabled'} style="--c:${SERIES_COL[f.series]}"><img src="${(W.hero[f.key] || {}).img || ''}" alt=""><b>${esc(f.n)}</b><small>${ok ? `Chiêu nhập môn: ${sk ? esc(sk.n) : '—'} · ${weaponTypeName(f)}` : `Chỉ nhận ${FAC_SEX[f.key] ? 'nữ' : 'nam'}`}</small></button>`; }).join('');
  modal(`<h3>Gia nhập môn phái <small>hệ ${SERIES[s]}</small></h3><p class="desc">Đã đạt cấp ${NOVICE_LV}. Chọn môn phái cùng hệ ${SERIES[s]}: nhận chiêu nhập môn và vũ khí của phái. Điểm kỹ năng tích lũy từ trước vẫn giữ.</p><div class="facpick">${cards}</div>`, () => {
    document.querySelectorAll('#mBody [data-j]').forEach(b => b.onclick = () => joinFaction(b.dataset.j));
  });
}
const WTYPE_VI = { 0: 'kiếm', 1: 'đao', 2: 'côn', 3: 'thương', 4: 'chùy', 5: 'song đao', 7: 'ám khí', 9: 'quyền chưởng' };
const weaponTypeName = f => WTYPE_VI[f.wcode] || 'vũ khí';
function joinFaction(key) {
  const f = FAC[key]; if (!f || f.novice || !isNovice() || f.series !== heroSeries() || !facAllowed(f, S.sex)) return;
  S.fac = key;
  if (f.starter && !S.sk[f.starter]) { S.sk[f.starter] = 1; S.skPts = Math.max(0, S.skPts - 1); S.main = f.starter; }
  const lv = clamp(Math.round(S.lvl / 12) + 1, 1, 10), dp = facWeaponDP(f);
  const w = makeItem(dp[0], dp[1], lv, 0);
  if (w) { S.inv.unshift(w); invDirty = true; }                         // vu khi phai: vao thang hanh trang (khong qua bo loc / Ruong ep)
  if (S.autoPts === true) {   // tu cong diem: tay lai tiem nang cua giai doan Vo Mon Phai cho hop vu khi / vo cong phai moi (vd Duong Mon can Than phap cho am khi)
    let back = 0; for (const k in S.attr) { back += S.attr[k]; S.attrPts += S.attr[k]; S.attr[k] = 0; }
    if (w) { const d = reqDeficit(w); for (const k in d) { const n = Math.min(d[k], S.attrPts); S.attr[k] += n; S.attrPts -= n; } }   // du dieu kien vu khi phai truoc
    R.dirty = true; recalc(); if (w && reqOk(w)) equip(w, true);
    R.dirty = true; recalc(); autoSpendSkills(); autoSpendAttrs(); if (typeof autoEquipAll === 'function') autoEquipAll();
    if (back) log(`🌊 Vào phái: phân phối lại ${back} điểm tiềm năng theo võ công / vũ khí ${esc(f.n)}.`);
  } else if (w && reqOk(w)) equip(w, true);
  fillSlots(); R.dirty = true; recalc(); closeModal(true); refresh(); renderPad(); save();
  R.banner = { t: 2.6, text: 'Gia nhập ' + f.n, sub: 'Học võ công ở thẻ Võ công' };
  log(`<b class="up">Gia nhập <span style="color:${SERIES_COL[f.series]}">${esc(f.n)}</span>!</b>`); uiSfx('levelup');
}
const NOTICE_TXT = 'JxOffline - Phi thương mại, ưu tiên giải trí trên chính thiết bị của mình';
/* Hien moi lan khoi tao nhan vat moi */
function noticeModal() {
  modal(`<h3>JxOffline</h3><p class="desc notice">${esc(NOTICE_TXT)}</p><div class="btnrow"><button class="btn" id="bNotice">Đã hiểu</button></div>`, () => { $('#bNotice').onclick = () => { closeModal(true); if (!S.tut) tutorialModal(0); }; });
  log(`<span class="dim">${esc(NOTICE_TXT)}</span>`);
}
function startFaction(key) {
  const f = FAC[key]; S.fac = key; S.sex = ['emei', 'cuiyan'].includes(key) ? 1 : 0; S.sexSet = 1; S.name = S.name && S.name !== 'Tân thủ' ? S.name : f.n;
  if (f.starter) { S.sk[f.starter] = 1; S.skPts = Math.max(0, S.skPts - 1); S.main = f.starter; }
  starterGear();
  R.dirty = true; recalc(); R.life = R.P.life; R.mana = R.P.mana;
  if (typeof khNewbieSpawn === 'function') khNewbieSpawn();   // tan thu spawn Hoành Sơn Môn, gap Liễu Như Yên
  loginCheck(); dotGift();                                  // ngay dau: co qua diem danh
  closeModal(true); save(); showTab('log');
  noticeModal();
  log(`Gia nhập <b style="color:${SERIES_COL[f.series]}">${esc(f.n)}</b>. Bắt đầu hành tẩu giang hồ!`);
  log(`🌱 Nhận <b>Hỗ Trợ Tân Thủ</b>: vòng sáng hồi ${NEWBIE_REGEN.life * 100}% sinh lực + ${NEWBIE_REGEN.mana * 100}% nội lực mỗi giây, <b>+${NEWBIE_XP * 100}% kinh nghiệm</b> luyện cấp đến cấp ${NEWBIE_LV}.`);
}
function starterGear() {
  if (S.eq.weapon) return;
  const f = FAC[S.fac];
  const dp = f && !f.novice ? facWeaponDP(f) : [0, f && f.wcode >= 0 && f.wcode !== 9 ? f.wcode : 6];
  const it = makeItem(dp[0], dp[1], 1, 0);
  if (it) S.eq.weapon = it;
  const ar = makeItem(2, sexPart(2, 0), 1, 0); if (ar && sexOk(ar)) S.eq.armor = ar;
}
