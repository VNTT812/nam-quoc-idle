/* ======================= CUA SO KIEU VO LAM 2.0 (chi khi body.u20) =======================
   Bo cuc lai cac the theo VLTK 2.0: Nhan vat (o trang bi quanh hinh nhan vat), Hanh trang (luoi 6 cot + ngan luong),
   Vo cong (luoi theo cap), Lo ren (the tren + vong phap tran), Nhiem vu (Chi nam nhiem vu + Theo dau), Ky Tran Cac (cua hang),
   Tro Thu Kiem Hiep (gom moi tuy chon tu dong + bo loc nhat do), He thong (luu game, am thanh, hien thi).
   Giao dien cu (dien thoai doc) giu nguyen: moi ham deu goi ban goc khi khong o che do u20. */
'use strict';
const u20 = () => document.body.classList.contains('u20');
const u2any = () => u20() || document.body.classList.contains('u2m');
/* mo the: cua so noi (u20) hoac the duoi (dien thoai doc) */
function u2Open(t, sub) { if (u20()) return u20Open(t, sub); if (sub && typeof questTab !== 'undefined') questTab = sub; if (t === 'tt') u20MoreMode = 'tt'; closeModal(true); showTab(t === 'tt' ? 'more' : t); }
const U2_ORIG = { char: renderChar, skill: renderSkill, inv: renderInv, forge: renderForge, quest: renderQuest, more: renderMore, ktc: ktcModal };
let u20MoreMode = 'sys', u20TtTab = 'basic', u20TrkOn = true;
const fmtVan = n => { n = Math.floor(n); return n >= 1e4 ? `${fmt(Math.floor(n / 1e4))} vạn ${n % 1e4} lượng` : `${n} lượng`; };
const u2win = (cls) => { document.body.dataset.u2t = cls; };

/* ---------- Nhan vat: o trang bi quanh hinh nhan vat ---------- */
const U2_DOLL = { helm: [92, 8, 64, 64], amulet: [180, 8, 60, 40], cuff: [12, 34, 46, 66], armor: [92, 80, 64, 98], weapon: [180, 56, 60, 112], ring1: [12, 108, 46, 40],
  ring2: [12, 154, 46, 40], belt: [92, 186, 64, 34], pendant: [12, 200, 46, 66], boot: [180, 176, 60, 62], horse: [92, 228, 64, 64] };
function u2DrawDoll() {
  const cv = $('#u2doll'); if (!cv || typeof drawJxHero !== 'function' || !R.jx) return;
  const t = document.createElement('canvas'); t.width = 600; t.height = 600; const tg = t.getContext('2d'), main = CX;
  CX = tg; let ok = false; try { ok = drawJxHero('st', 0, 0, 300, 520, 3, 1); } catch (e) { ok = false; } finally { CX = main; }
  if (!ok) { setTimeout(() => { if ($('#u2doll') === cv) u2DrawDoll(); }, 400); return; }
  const d = tg.getImageData(0, 0, 600, 600).data; let x0 = 600, x1 = 0, y0 = 600, y1 = 0;
  for (let i = 3; i < d.length; i += 16) if (d[i] > 20) { const p = (i - 3) / 4, x = p % 600, y = (p / 600) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0) return;
  const bw = x1 - x0 + 4, bh = y1 - y0 + 4, k = Math.min(236 / bw, 284 / bh), dw = bw * k, dh = bh * k;
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(t, x0 - 2, y0 - 2, bw, bh, (252 - dw) / 2, 296 - dh, dw, dh);
}
function renderChar20() {
  const P = R.P, f = FAC[S.fac];
  const unmet = Object.values(S.eq).filter(it => it && !reqOk(it));
  const P0 = calc({}), eqC = { life: Math.round(P.life - P0.life), mana: Math.round(P.mana - P0.mana) };
  const doll = SLOTS.map(([k, vi]) => { const [x, y, w, h] = U2_DOLL[k]; return `<div class="u2s slot" data-slot="${k}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${S.eq[k] ? itemCell(S.eq[k]) : `<span>${vi}</span>`}</div>`; }).join('');
  const attrs = Object.keys(ATTR_VI).map(k => `<div class="u2a"><span>${ATTR_VI[k]}</span><b>${Math.round(P[k])}</b><button class="plus" data-a="${k}" ${S.attrPts ? '' : 'disabled'}>+</button><button class="minus" data-a="${k}" title="Rút lại 1 điểm" ${S.attr[k] > 0 ? '' : 'disabled'}>−</button></div>`).join('');
  const st = [['Sinh lực', fmt(P.life) + (eqC.life ? ` <small class="cp">+${fmt(eqC.life)}</small>` : '')], ['Nội lực', fmt(P.mana) + (eqC.mana ? ` <small class="cp">+${fmt(eqC.mana)}</small>` : '')],
    ['Sát thương VK', `${Math.round(P.wmin)}–${Math.round(P.wmax)}`], ['Chính xác', Math.round(P.ar)], ['Né tránh', Math.round(P.def)],
    ['Chí mạng', Math.round(P.main.crit) + '%'], ['Tốc độ đánh', P.aspd.toFixed(2)]].concat(ELEM.map(e => ['Kháng ' + ELEM_VI[e], Math.round(P.res[e]) + '%']));
  const plus = P.plusSkill || Object.keys(P.skAdd || {}).length ? `<div class="u2note cp">Kỹ năng từ trang bị: ${P.plusSkill ? `tất cả +${P.plusSkill}` : ''}${Object.entries(P.skAdd || {}).map(([id, n]) => ` · ${SK[id] ? esc(SK[id].n) : id} +${n}`).join('')}</div>` : '';
  $('#t-char').innerHTML = `<div class="u2char">
    <div class="u2dollw"><div class="u2nm">${esc(hasRealName() ? S.name : f.n)}</div><div class="u2doll"><canvas id="u2doll" width="252" height="300"></canvas>${doll}</div>
      <div class="u2btns"><button class="btn sm" id="bTitle">Danh hiệu</button><button class="btn sm${hasRealName() ? '' : ' on'}" id="bName">Đặt tên</button><button class="btn sm${S.lvl >= REBORN_LV && RW().stat.reborn < REBORN_MAX ? ' on' : ''}" id="bReb">Chuyển sinh</button>${matHave('misc', 'ldp') > 0 ? `<button class="btn sm on" id="bDoiPhai">Đổi phái</button>` : ''}</div></div>
    <div class="u2info"><div class="u2box"><b style="color:${SERIES_COL[f.series]}">${esc(f.n)}</b> · hệ ${SERIES[f.series]} · Cấp ${S.lvl}${rebornN() ? ` <small class="cp">CS ${rebornN()}</small>` : ''}
      <div class="small">Chiêu chính: <b class="gold">${esc(P.main.n)}</b></div><div class="u2row"><span>Lực chiến <b class="gold">${fmt(R.power)}</b></span><button class="btn sm" id="bPower">Chi tiết</button></div></div>
      <div class="u2h">Tiềm năng <b class="gold">${S.attrPts}</b><span class="sp"></span><button class="btn sm" id="bSugAt">Gợi ý</button><button class="btn sm" id="bTTa">Tẩy Tủy</button></div>
      <div class="u2box">${attrs}</div>
      <div class="u2h">Chỉ số</div><div class="u2box u2st">${st.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('')}</div>${plus}</div></div>
    ${unmet.length ? `<div class="reqbad"><b>⚠ ${unmet.length} món chưa đủ điều kiện, không được cộng chỉ số:</b><br>${unmet.map(it => `${esc(it.n)}: ${esc(reqProblems(it).join('; '))}`).join('<br>')}</div>` : ''}`;
  $('#bTTa').onclick = tayTuyModal;
  document.querySelectorAll('#t-char .plus').forEach(b => b.onclick = () => { if (!S.attrPts) return; S.attrPts--; S.attr[b.dataset.a]++; R.dirty = true; recalc(); renderChar(); });
  document.querySelectorAll('#t-char .minus').forEach(b => b.onclick = () => unspendAttr(b.dataset.a));
  $('#bPower').onclick = powerModal; $('#bTitle').onclick = () => titleModal(); $('#bName').onclick = () => nameModal(); $('#bReb').onclick = rebornModal; const dp = $('#bDoiPhai'); if (dp) dp.onclick = doiPhaiModal; $('#bSugAt').onclick = suggestModal;
  document.querySelectorAll('#t-char .slot .it').forEach(b => b.onclick = () => b.parentNode.dataset.slot === 'horse' ? horsePickModal() : itemModal(findItem(b.dataset.uid), b.parentNode.dataset.slot));
  const hs = document.querySelector('#t-char .slot[data-slot="horse"]'); if (hs && !S.eq.horse) hs.onclick = () => horsePickModal();
  u2DrawDoll();
}

/* ---------- Vo cong: luoi theo cap yeu cau (moi cot 1 moc cap) ---------- */
function renderSkill20() {
  const f = FAC[S.fac];
  if (f.novice) return U2_ORIG.skill();
  const cols = {};
  for (const id of f.skills) { const s = SK[id], k = s.tier === 90 ? 90 : s.req; (cols[k] || (cols[k] = [])).push(id); }
  const keys = Object.keys(cols).map(Number).sort((a, b) => a - b), rows = Math.max(1, ...keys.map(k => cols[k].length));
  const head = k => (k <= 1 ? 'Nhập môn' : `Lv${k}`);
  const cell = id => {
    if (!id) return '<div class="u2k empty"></div>';
    const s = SK[id], L = S.sk[id] || 0, bonus = L ? skillBonusLv(id) : 0, can = canLearn(s);
    const cls = [S.lvl < s.req ? 'lock' : '', R.P.main.id === +id ? 'main' : '', L ? 'on' : ''].join(' ');
    return `<div class="u2k ${cls}" data-id="${id}" title="${esc(s.n)}"><img src="${esc(s.ic || '')}" alt=""><i>${L ? L + bonus : ''}</i>${can ? `<button class="plus" data-id="${id}" title="Cộng 1 điểm">+</button>` : ''}${s.tier === 90 && L && L < s.max && matHave('misc', 'dtbk') > 0 ? `<button class="u2dt" data-dt="${id}" title="Dùng Đại Thành Bí Kíp">📕</button>` : ''}</div>`;
  };
  const b = R.P && R.P.basic, bon = S.mainLock && S.main === 'basic';
  const basic = `<div class="u2kc"><div class="u2kh">Cơ bản</div><div class="u2k on${R.P.main === b ? ' main' : ''}${bon ? ' lockm' : ''}" id="u2basic" title="Đánh thường · bấm để ${bon ? 'bỏ khóa' : 'khóa làm chiêu chính'}"><img src="img/s/8.png" alt=""><i>1</i></div>${'<div class="u2k empty"></div>'.repeat(rows - 1)}</div>`;
  const grid = keys.map(k => `<div class="u2kc"><div class="u2kh">${head(k)}</div>${Array.from({ length: rows }, (_, r) => cell(cols[k][r])).join('')}</div>`).join('');
  $('#t-skill').innerHTML = `<div class="u2tabs"><button class="on">${esc(f.n)}</button><button id="u2skOpt">› Trợ Thủ Kiếm Hiệp</button></div>
    <div class="u2kg">${basic}${grid}</div>
    <div class="u2foot"><span class="dim small">Mật Tịch 90 ×${matHave('misc', 'bk90')} · Đại Thành ×${matHave('misc', 'dtbk')}${S.mainLock ? ' · <a id="bAutoMain">bỏ khóa chiêu chính</a>' : ''}</span><span class="sp"></span><button class="btn sm" id="bSugSk">Gợi ý</button><button class="btn sm" id="bTT">Tẩy Tủy</button><span class="u2pts">Điểm kỹ năng còn: <b>${S.skPts}</b></span></div>
    <p class="dim small u2tip">Bấm biểu tượng: xem chi tiết, chọn chiêu chính, rút điểm. Bấm <b class="plusd">+</b> để cộng điểm.</p>`;
  document.querySelectorAll('#t-skill .plus').forEach(x => x.onclick = e => { e.stopPropagation(); const s = SK[x.dataset.id]; if (!canLearn(s)) return; skLearn(s.id); uiSfx('learn'); R.dirty = true; recalc(); renderSkill(); save(); });
  document.querySelectorAll('#t-skill [data-dt]').forEach(x => x.onclick = e => { e.stopPropagation(); useDaiThanh(+x.dataset.dt); });
  document.querySelectorAll('#t-skill .u2k[data-id]').forEach(x => x.onclick = () => skillModal(+x.dataset.id));
  $('#u2basic').onclick = () => { if (S.mainLock && S.main === 'basic') S.mainLock = false; else { S.main = 'basic'; S.mainLock = true; } R.dirty = true; recalc(); renderSkill(); renderPad(); save(); toast(S.mainLock && S.main === 'basic' ? 'Chiêu chính: Đánh thường' : 'Bỏ khóa đánh thường'); };
  const am = $('#bAutoMain'); if (am) am.onclick = () => { S.mainLock = false; R.dirty = true; recalc(); renderSkill(); };
  $('#bSugSk').onclick = suggestModal; $('#bTT').onclick = tayTuyModal; $('#u2skOpt').onclick = () => u20Tt('skill');
}

/* ---------- Hanh trang: luoi 6 cot, o trong, ngan luong + Kim Nguyen Bao ---------- */
function renderInv20() {
  U2_ORIG.inv();
  const t = $('#t-inv'), grid = t.querySelector('.invgrid'), sort = $('#iSort');
  for (let i = S.inv.length; i < INV_MAX; i++) grid.insertAdjacentHTML('beforeend', '<span class="it empty"></span>');
  const B = {}; for (const id of ['bBest', 'bDonKho', 'bStash', 'bSellAll', 'bKtcI']) B[id] = $('#' + id);
  const wrap = document.createElement('div'); wrap.className = 'u2bag';
  wrap.innerHTML = `<div class="u2bh"><span>${S.inv.length}/${INV_MAX}</span><span class="sp"></span></div>`;
  wrap.firstChild.appendChild(sort);
  wrap.appendChild(grid);
  wrap.insertAdjacentHTML('beforeend', `<div class="u2money"><span>Ng.lượng</span><b>${fmtVan(S.gold)}</b><span>Kim Ng.Bảo</span><b>${fmt(S.knb || 0)}</b></div><div class="u2btns" id="u2invB"></div><div class="u2btns" id="u2invB2"></div>`);
  const b1 = wrap.querySelector('#u2invB'), b2 = wrap.querySelector('#u2invB2');
  B.bBest.textContent = 'Mặc đồ tốt'; B.bDonKho.textContent = 'Dọn kho'; B.bStash.textContent = 'Kho chung'; B.bKtcI.textContent = 'Kỳ Trân Các';
  B.bSellAll.textContent = B.bSellAll.disabled ? 'Bán đồ thừa' : `Bán ${S.inv.filter(i => !lootMatch(i) && !sellProtected(i)).length} món thừa`;
  b1.append(B.bBest, B.bDonKho, B.bStash); b2.append(B.bSellAll);
  b2.insertAdjacentHTML('beforeend', '<button class="btn sm" id="u2filt">Bộ lọc nhặt</button>'); b2.append(B.bKtcI);
  t.innerHTML = ''; t.appendChild(wrap);
  $('#u2filt').onclick = () => u20Tt('loot');
}

/* ---------- Lo ren: the tren (moi loai ren) + vong phap tran ---------- */
function renderForge20() {
  const fr = forgeReadyCounts(), ores = Object.keys(mats().ore).reduce((t, k) => t + matHave('ore', k), 0), hts = Object.keys(mats().ht).reduce((t, k) => t + matHave('ht', k), 0);
  const phoi = S.inv.concat(epBox(), Object.values(S.eq)).filter(i => i && typeof isPhoi === 'function' && isPhoi(i)).length;
  const shardReady = Object.keys(mats().shard).filter(n => SHARDS[n] && matHave('shard', n) >= SHARDS[n]).length;
  const plat = Object.values(S.eq).filter(x => x && canPlatBase(x)).concat(S.inv.filter(canPlatBase)).filter(i => !platReady(i)).length;
  const eq = SLOTS.map(([k]) => S.eq[k]).filter(Boolean);
  const tabs = (verVio() ? [['tl', 'Tinh luyện'], ['hut', 'Lấy'], ['phoi', 'Chế tạo'], ['kham', 'Khảm nạm'], ['box', 'Rương ép']] : []).concat([['ht', 'Hoàng Kim'], ['batch', 'Cường hóa']]);
  const n = eq.length, ring = eq.map((it, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, n), x = 118 + Math.cos(a) * 92 - 19, y = 118 + Math.sin(a) * 92 - 19;
    return `<div class="u2ri" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px">${itemCell(it)}</div>`; }).join('');
  const line = (a, b, hot) => `<div class="${hot ? 'cp' : ''}">${a}: <b>${b}</b></div>`;
  $('#t-forge').innerHTML = `<div class="u2tabs">${tabs.map(([k, t]) => `<button data-fg="${k}">${t}</button>`).join('')}</div>
    <div class="u2forge"><div class="u2circ"><svg viewBox="0 0 236 236"><g fill="none" stroke="#d9b65a" stroke-width="1.6" opacity=".85"><circle cx="118" cy="118" r="112"/><circle cx="118" cy="118" r="104"/><circle cx="118" cy="118" r="60"/>
      <rect x="44" y="44" width="148" height="148"/><rect x="44" y="44" width="148" height="148" transform="rotate(45 118 118)"/><circle cx="118" cy="118" r="30" stroke-dasharray="4 3"/></g></svg>
      <div class="u2rc"><img src="img/ep/ht.png" alt=""><b>${hts}</b><small>Huyền Tinh</small></div>${ring}</div>
      <div class="u2ftxt"><div class="u2h">Nguyên liệu</div>
        ${verVio() ? line('Huyền Tinh Khoáng Thạch', hts) + line('Đá thuộc tính', ores) + line('Phôi đồ Tím', phoi) + line('Rương ép', `${epBox().length}/${EP_BOX_MAX}`) : ''}
        ${line('Mảnh Hoàng Kim đủ ghép', shardReady, shardReady > 0)}${line('Hoàng Kim chế được Bạch Kim', plat, plat > 0)}${line('Thủy Tinh Trắng', matHave('misc', 'wc'))}${line('Thần Bí Khoáng Thạch', matHave('misc', 'mys'))}
        ${fr.ench ? '<div class="cp">Có thể khảm nạm</div>' : ''}${fr.up ? '<div class="cp">Huyền Tinh thăng cấp được</div>' : ''}
        <div class="u2h">Quy tắc</div><div class="dim small">Cường hóa +1…+${ENH_MAX}, mỗi cấp +${Math.round(ENH_STEP * 100)}% thuộc tính gốc. Bấm món đồ trên vòng pháp trận để rèn riêng (cường hóa, tẩy luyện, Bạch Kim).</div>
        <div class="u2btns"><button class="btn sm" id="fgBatch">Cường hóa hàng loạt</button><button class="btn sm" id="u2fgOpt">Tự động rèn…</button></div></div></div>`;
  const act = { ht: () => htModal(), batch: () => batchForgeModal() };
  document.querySelectorAll('#t-forge [data-fg]').forEach(b => b.onclick = () => (act[b.dataset.fg] || (() => epModal(b.dataset.fg)))());
  $('#fgBatch').onclick = () => batchForgeModal(); $('#u2fgOpt').onclick = () => u20Tt('other');
  document.querySelectorAll('#t-forge .u2ri [data-uid]').forEach(b => b.onclick = () => { const it = Object.values(S.eq).find(i => i && i.uid === +b.dataset.uid); if (it) forgeModal(it); });
}

/* ---------- Nhiem vu: Chi nam nhiem vu (cay trai) + Theo dau ---------- */
const U2_QT = [['dt', 'Dã Tẩu'], ['st', 'Sát Thủ']];
const U2_ACT = [['dg', 'Phó bản'], ['boat', 'Đi thuyền'], ['tower', 'Tháp thử thách'], ['wb', 'Boss tuần'], ['horse', 'Mã trường'], ['pet', 'Đồng hành'], ['rec', 'Kỷ lục']];
const u2IsAct = k => U2_ACT.some(x => x[0] === k);
const u2ActBody = k => (k === 'boat' ? boatBody() : k === 'tower' ? towerBody() : k === 'pet' ? petBody() : k === 'dg' ? dungeonBody() : k === 'wb' ? wbBody() : k === 'horse' ? stableBody() : recordsBody());
/* gan su kien cho noi dung Hoat dong nam trong cua so Nhiem vu (ban goc gan theo #mBody cua hop thoai) */
function u2ActBind(root) {
  const re = () => renderQuest(), go = fn => () => { u20Close(); fn(); };
  const on = (sel, fn) => { const el = root.querySelector(sel); if (el) el.onclick = fn; };
  root.querySelectorAll('[data-dg]').forEach(b => b.onclick = go(() => dgStart(b.dataset.dg)));
  on('#wbGo', go(wbStart)); on('#wbClaim', () => { wbClaim(); re(); });
  on('#dgOut', () => { if (R.dg.kind === 'wb') wbFinish(false); else { log('Rời phó bản.'); dgExit(); } re(); });
  on('#gTower', go(towerStart)); on('#gTowerOut', () => { towerExit(false); re(); });
  root.querySelectorAll('.petpick [data-p]').forEach(x => x.onclick = () => { petAdopt(+x.dataset.p); re(); });
  if (questTab === 'boat') { bindBoat(root); on('#boatGo', go(boatStart)); const o = root.querySelector('#boatOut'); if (o) { const f = o.onclick; o.onclick = () => { f(); re(); }; } }
  if (questTab === 'horse') { const mb = $('#mBody'); mb.id = 'mBodyX'; root.id = 'mBody'; try { bindStable(re); } finally { root.id = ''; mb.id = 'mBody'; } }
}
function renderQuest20() {
  if (u2IsAct(questTab) || questTab === 'act' || questTab === 'tm') { const k = questTab; questTab = 'dt'; if (k !== 'act') setTimeout(() => actModal(k), 0); }
  const act = false;
  if (act) $('#t-quest').innerHTML = `<div class="dtabs"></div>${u2ActBody(questTab)}`; else U2_ORIG.quest();
  const t = $('#t-quest'), tabs = t.querySelector('.dtabs'); if (!tabs) return;
  const body = document.createElement('div'); body.className = 'u2qd';
  while (tabs.nextSibling) body.appendChild(tabs.nextSibling);
  const item = ([k, n]) => `<button data-qt="${k}" class="${questTab === k ? 'on' : ''}">${n}${k === 'boat' && boatOn() ? ' ●' : ''}</button>`;
  const tree = document.createElement('div'); tree.className = 'u2tree';
  tree.innerHTML = `<div class="u2tg">⊟ Nhiệm vụ</div>${U2_QT.map(item).join('')}<div class="u2tg">⊟ Phó bản · Hoạt động</div>${U2_ACT.map(([k, n]) => `<button data-act="${k}">${n}${k === 'boat' && boatOn() ? ' ●' : ''}</button>`).join('')}<div class="u2tg">⊟ Khác</div><button id="u2gift">Phần thưởng</button>`;
  t.innerHTML = ''; const g = document.createElement('div'); g.className = 'u2quest'; g.appendChild(tree); g.appendChild(body); t.appendChild(g);
  t.insertAdjacentHTML('beforeend', `<div class="u2btns u2qb"><button class="btn sm${u20TrkOn ? ' on' : ''}" id="u2trkB">${u20TrkOn ? 'Hủy theo dõi' : 'Theo dõi NV'}</button></div>`);
  tree.querySelectorAll('[data-qt]').forEach(b => b.onclick = () => { questTab = b.dataset.qt; renderQuest(); });
  tree.querySelectorAll('[data-act]').forEach(b => b.onclick = () => actModal(b.dataset.act));
  $('#u2gift').onclick = () => giftModal(true);
  $('#u2trkB').onclick = () => { u20TrkOn = !u20TrkOn; S.u20trk = u20TrkOn; save(); renderQuest(); u20TrkDraw(); };
  if (act) u2ActBind(body);
}
/* khung "Nhiem vu Theo Dau" tren man hinh */
function u20TrkDraw() {
  const el = $('#u20trk'); if (!el) return;
  const out = [];
  if (S.fac && S.lvl >= (typeof DT_LV !== 'undefined' ? DT_LV : 20)) { const d = DT(), T = d.task; if (T) out.push(`<div data-q="dt"><b>Dã Tẩu</b> <small>chuỗi ${d.chain || 0}</small><br>${esc(dtText(T))} <span class="${dtReady(T) ? 'cp' : 'gold'}">${dtReady(T) ? 'xong' : dtProg(T)}</span></div>`); }
  if (R.sat) out.push('<div data-q="st"><b>Sát Thủ</b><br>Truy sát mục tiêu</div>');
  if (R.dg) out.push(`<div><b>${esc(R.dg.kind === 'boat' ? 'Đi thuyền' : R.dg.d ? R.dg.d.n : 'Phó bản')}</b></div>`);
  const mn = !!S.u20trkMin, h = u20TrkOn && out.length ? `<div class="u2trh" title="Thu gọn / mở rộng">Nhiệm vụ Theo Dấu <b>${mn ? '▸' : '▾'}</b></div>${mn ? '' : out.join('')}` : '';
  if (el.innerHTML !== h) { el.innerHTML = h; el.style.display = h ? '' : 'none'; el.querySelectorAll('[data-q]').forEach(x => x.onclick = () => u20Open('quest', x.dataset.q));
    const hd = el.querySelector('.u2trh'); if (hd) hd.onclick = () => { S.u20trkMin = !S.u20trkMin; save(); u20TrkDraw(); }; }
}

/* ---------- Ky Tran Cac: danh muc trai + the san pham ---------- */
const KTC_CAT = [['Tiện ích', ['knb', 'tt', 'qht', 'ldt']], ['Quý hiếm', ['rht', 'rda', 'mt90', 'dtbk']], ['Đặc biệt', ['ldp', 'dgt']], ['Thú cưỡi', 'tm']];
let u2KtcCat = 0;
function ktcModal20() {
  const have = k => (k === 'mt90' ? matHave('misc', 'bk90') : ['dtbk', 'ldp', 'ldt', 'dgt'].includes(k) ? matHave('misc', k) : null);
  const use = { ldp: 'ktcLdp', ldt: 'ktcLdt', mt90: 'ktcMt', dgt: 'ktcDgt' };
  const tm = KTC_CAT[u2KtcCat][1] === 'tm', list = tm ? [] : KTC_CAT[u2KtcCat][1].map(k => KTC.find(g => g.k === k)).filter(Boolean);
  const card = g => { const ok = ktcOk(g), hv = have(g.k);
    return `<div class="u2card${ok ? '' : ' bad'}" title="${esc(g.d)}"><div class="u2ct">${esc(g.n)}</div><div class="u2cb"><img src="${g.ic}" alt=""><div><div>Giá: <b class="${g.knb ? 'gold' : ''}">${ktcCost(g)}</b></div><small class="dim">${g.k === 'knb' ? `Hôm nay ${knbDay().n}/${KNB_DAY}` : g.k === 'ldt' ? `Hôm nay ${ldtDay().n}/${LDT_BUY_DAY} · có ${hv}` : hv != null ? `Đang có ${hv}` : esc(g.d.slice(0, 40))}</small></div></div>
      <div class="u2cf"><button class="u2buy" data-ktc="${g.k}" ${ok && ktcCan(g) ? '' : 'disabled'}>Mua</button>${g.k === 'dtbk' || g.k === 'ldp' || g.k === 'dgt' || g.k === 'ldt' ? '' : `<button class="u2buy x" data-ktc10="${g.k}" ${ok && ktcCan(g, 10) ? '' : 'disabled'}>×10</button>`}${use[g.k] && hv ? `<button class="u2buy x on" id="${use[g.k]}">${g.k === 'mt90' ? 'Lĩnh ngộ' : 'Dùng'}</button>` : ''}</div></div>`; };
  modal(`<h3>Kỳ Trân Các</h3><div class="u2shop"><div class="u2cat">${KTC_CAT.map(([n], i) => `<button data-kc="${i}" class="${i === u2KtcCat ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div><div class="u2sh"><img src="img/ep/knb.png" alt=""> <span>Kim Nguyên Bảo:</span> <b class="gold">${S.knb || 0}</b> <span>· Ngân lượng:</span> <b>${fmtVan(S.gold)}</b></div>${tm ? `<div class="u2tm">${thanMaBody().replace('<p class="desc">không', '<p class="desc">Thần Mã không')}</div>` : `<div class="u2cards">${list.map(card).join('')}</div>`}
    ${tm ? '' : `${buffText() ? `<div class="small u2buf">Đang có: ${buffText()}</div>` : ''}<p class="dim small">Kim Nguyên Bảo rơi từ trùm (10%), trùm Hoàng Kim / boss tuần (50%). Rương mở ngay khi mua. Rê chuột lên vật phẩm để xem công dụng.</p>`}</div></div>`, () => {
    document.querySelectorAll('#mBody [data-kc]').forEach(b => b.onclick = () => { u2KtcCat = +b.dataset.kc; ktcModal(); });
    if (tm) bindThanMa(() => ktcModal());
    document.querySelectorAll('#mBody [data-ktc]').forEach(b => b.onclick = () => ktcBuy(b.dataset.ktc, 1));
    document.querySelectorAll('#mBody [data-ktc10]').forEach(b => b.onclick = () => ktcBuy(b.dataset.ktc10, 10));
    const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
    on('ktcLdp', doiPhaiModal); on('ktcDgt', doiGioiTinhModal);
    on('ktcMt', () => { if (S.lvl < 80 && !rebornN()) { toast('Võ công 90 cần cấp 80'); return; } closeModal(true); u2Open('skill'); toast('Bấm + ở võ công 90 để lĩnh ngộ (không tốn điểm)'); });
    on('ktcLdt', () => { if (S.lvl < DT_LV) { toast(`Dã Tẩu mở từ cấp ${DT_LV}`); return; } dtUseLdt(false); ktcModal(); });
  });
  $('#modal').classList.add('u2ktc');
}

/* ---------- Tro Thu Kiem Hiep (the Khac, che do tt) + He thong ---------- */
const U2_TT = [['basic', 'Cơ bản'], ['skill', 'Kỹ năng'], ['loot', 'Nhặt đồ'], ['other', 'Khác']];
function u20Tt(tab) { if (tab) u20TtTab = tab; u2Open('tt'); }
function renderTt() {
  const ck = (id, on, t) => `<label><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${t}</label>`, d = typeof DT === 'function' ? DT() : {};
  let body = '';
  if (u20TtTab === 'basic') body = `<div class="u2h">Tự đánh</div>${ck('tAuto', !manual(), 'Tự đánh quái (Auto) · phím F')}${ck('tMap', S.autoMap !== false, 'Tự đổi bãi luyện công theo cấp')}${ck('tRide', S.autoRide !== false, 'Tự lên ngựa khi di chuyển, xuống ngựa khi đánh chiêu không dùng trên ngựa · phím M')}
    <div class="u2h">Dược phẩm</div>${ck('tPot', !S.potOff, `Dùng thuốc khi sinh lực / nội lực dưới 50% · đã dùng ${fmt(S.potUsed || 0)}`)}${ck('tBuy', S.potBuy !== false, 'Tự mua thuốc khi hết (tối đa 20% ngân lượng)')}
    <div class="u2btns">${[0, 1].map(i => { const v = typeof slotShow === 'function' ? slotShow(i) : { name: '' }; return `<button class="btn sm" data-potsl="${i}">${i ? 'Nội lực' : 'Sinh lực'}: ${esc(v.name || 'Tự động')} ▾</button>`; }).join('')}</div>
    <div class="u2h">Trang bị</div>${ck('tEq', !!S.autoEquip, 'Tự mặc đồ tốt hơn khi nhặt')}${ck('tJunk', S.autoJunk !== false, 'Tự bán đồ thừa (yếu hơn đồ đang mặc, vũ khí sai loại; giữ 6 trang sức để hợp Huyền Tinh)')}${ck('tWb', S.autoBuy !== false, 'Tự mua vũ khí đúng loại ở Biện Kinh khi mạnh hơn ≥ 25%')}`;
  else if (u20TtTab === 'skill') body = `<div class="u2h">Xoay chiêu</div>${ck('tRot', S.rot !== false, 'Xoay chiêu tự động: luân phiên chiêu ở ô F1–F4 (phím R), luôn có 2 chiêu mạnh nhất, bỏ chiêu hết nội lực')}${skOptsHTML()}
    <div class="u2h">Cộng điểm</div>${ck('tPts', S.autoPts === true, 'Tự cộng điểm tiềm năng và võ công')}<div class="u2btns"><button class="btn sm" id="tSug">Gợi ý cộng điểm</button></div>`;
  else if (u20TtTab === 'other') body = `<div class="u2h">Lò rèn</div>${ck('fgFuse', S.autoFuse !== false, `Tự hợp Huyền Tinh từ trang sức thừa (3 món → 1, ${fmt(fuseCost())} lượng; mỗi 30 giây) · có ${fusePool().length} món`)}${ck('fgAuto', !!S.autoForge, 'Tự động rèn đồ (ghép mảnh Hoàng Kim, khảm Tím, thăng cấp Huyền Tinh; mỗi 30 giây)')}
    <div class="u2h">Nhiệm vụ</div>${ck('tDt', d.auto !== false, 'Dã Tẩu tự trả / nhận')}${ck('tLdt', S.autoLdt !== false, 'Tự dùng Lệnh Bài Dã Tẩu khi hết lượt')}
`;
  if (u20TtTab === 'sys') { U2_ORIG.more(); u2SysTrim(); $('#t-more').insertAdjacentHTML('afterbegin', u2TtTabs()); u2TtBind(); return; }
  $('#t-more').innerHTML = `<div class="u2tabs">${u2TT().map(([k, n]) => `<button data-tt="${k}" class="${u20TtTab === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="u2tt" id="u2ttBody">${body}</div>`;
  u2TtBind();
  if (u20TtTab === 'loot') { renderInv(); return; }
  const on = (id, fn) => { const el = $(id); if (el) el.onchange = () => { fn(el.checked); save(); }; };
  on('#tAuto', v => setCtrl(v ? 'auto' : 'manual')); on('#tRot', v => { S.rot = v; refreshRotBtn(); R.dirty = true; }); on('#tRide', v => { S.autoRide = v; });
  on('#tMap', v => { S.autoMap = v; }); on('#tPot', v => { S.potOff = !v; }); on('#tBuy', v => { S.potBuy = v; }); on('#tEq', v => { S.autoEquip = v; }); on('#tWb', v => { S.autoBuy = v; });
  on('#tJunk', v => { S.autoJunk = v; }); on('#tPts', v => { S.autoPts = v; if (v) { autoSpendAttrs(); autoSpendSkills(); recalc(); } }); on('#tDt', v => { DT().auto = v; }); on('#tLdt', v => { S.autoLdt = v; });
 
  on('#fgFuse', v => { S.autoFuse = v; if (v) autoFuse(); }); on('#fgAuto', v => { S.autoForge = v; if (v) autoForge(); });
  document.querySelectorAll('#t-more [data-potsl]').forEach(b => b.onclick = () => potSlotModal(+b.dataset.potsl));
  const sg = $('#tSug'); if (sg) sg.onclick = suggestModal; bindSkOpts();
}
const u2TT = () => (u20() ? U2_TT : U2_TT.concat([['sys', 'Hệ thống']]));
const u2TtTabs = () => `<div class="u2tabs">${u2TT().map(([k, n]) => `<button data-tt="${k}" class="${u20TtTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
function u2TtBind() { document.querySelectorAll('#t-more [data-tt]').forEach(b => b.onclick = () => { u20TtTab = b.dataset.tt; renderMore(); }); }
function renderMore20() {
  if (!u20()) u20MoreMode = 'tt';
  if (u20() && u20TtTab === 'sys') u20TtTab = 'basic';
  if (u20MoreMode === 'tt') return renderTt();
  U2_ORIG.more(); u2SysTrim();
  const t = $('#t-more');
  t.insertAdjacentHTML('afterbegin', '<div class="u2btns"><button class="btn sm" id="u2toTt">Trợ Thủ Kiếm Hiệp (tự động, nhặt đồ)…</button></div>');
  $('#u2toTt').onclick = () => u20Tt('basic');
}
/* He thong: bo cac tuy chon tu dong (da gom vao Tro Thu) */
function u2SysTrim() {
  const t = $('#t-more');
  for (const h of t.querySelectorAll('h3')) if (/^Tự động/.test(h.textContent)) { const c = h.nextElementSibling; h.remove(); if (c) c.remove(); }
  for (const id of ['#cForge', '#cBuy']) { const el = $(id); if (el) el.closest('label').remove(); }
  const hd = [...t.querySelectorAll('h3')].find(h => /^Tiện ích/.test(h.textContent)); if (hd) hd.textContent = 'Tiện ích';
}

/* ---------- ghep vao vong ve ---------- */
const u2ttLoot = () => curTab === 'more' && u20MoreMode === 'tt' && u20TtTab === 'loot';
renderChar = () => (u2any() ? (u2win('char'), renderChar20()) : U2_ORIG.char());
renderSkill = () => (u2any() ? (u2win('skill'), renderSkill20()) : U2_ORIG.skill());
renderInv = () => (u2any() ? (u2ttLoot() ? (U2_ORIG.inv(), u2MoveFilter()) : (u2win('inv'), renderInv20())) : U2_ORIG.inv());
renderForge = () => (u2any() ? (u2win('forge'), renderForge20()) : U2_ORIG.forge());
renderQuest = () => (u2any() ? (u2win('quest'), renderQuest20()) : U2_ORIG.quest());
renderMore = () => (u2any() ? (u2win(u20MoreMode === 'tt' ? 'tt' : 'more'), renderMore20()) : U2_ORIG.more());
ktcModal = () => (u2any() ? ktcModal20() : U2_ORIG.ktc());
/* bo loc nhat do (sinh trong the Hanh trang) -> chuyen vao Tro Thu > Nhat do */
function u2MoveFilter() {
  const box = $('#u2ttBody'); if (!box || !u2ttLoot()) return;
  const t = $('#t-inv'); box.innerHTML = '';
  [...t.children].filter(el => el.matches('h3, .lootf, #epLoot')).forEach(el => box.appendChild(el));
  const h = box.querySelector('h3'); if (h) h.classList.add('u2h');
  t.innerHTML = ''; invDirty = true;
}
/* Bang Hoat dong (2.0): Di thuyen la pho ban -> the rieng canh Pho ban; Than Ma chuyen sang Ky Tran Cac */
const U2_ACTT = [['dg', 'Phó bản'], ['boat', 'Đi thuyền'], ['tower', 'Tháp'], ['wb', 'Boss tuần'], ['horse', 'Mã trường'], ['pet', 'Đồng hành'], ['rec', 'Kỷ lục']];
const _actModal = actModal;
actModal = tab => {
  if (!u2any()) return _actModal(tab === 'boat' ? 'dg' : tab);
  if (!S.fac) return; if (tab === 'dt' || tab === 'st') { u2Open('quest', tab); return; } if (tab === 'tm') { u2KtcCat = KTC_CAT.length - 1; ktcModal(); return; }
  if (tab) actTab = tab; if (actTab === 'tm') actTab = 'dg';
  const tabs = () => U2_ACTT.map(([k, n]) => `<button data-a="${k}" class="${k === actTab ? 'on' : ''}">${n}</button>`).join('');
  if (actTab !== 'boat') { _actModal(); const t = $('#actTabs'); if (t) { t.innerHTML = tabs(); t.querySelectorAll('button').forEach(b => b.onclick = () => actModal(b.dataset.a)); } return; }
  modal(`<h3>Hoạt động</h3><div class="dtabs" id="actTabs">${tabs()}</div>${boatBody()}`, () => {
    document.querySelectorAll('#actTabs button').forEach(b => b.onclick = () => actModal(b.dataset.a)); bindBoat($('#mBody'));
  });
};
const _modalClose = closeModal;
closeModal = (f) => { _modalClose(f); $('#modal').classList.remove('u2ktc'); };

/* ---------- Ban do luyen cong: thanh ten ban do duoi ban do nho + danh sach tha xuong ---------- */
function u20ZoneName() {
  const el = $('#u20zn'); if (!el || !S.fac) return;
  const t = R.dg ? (R.dg.kind === 'boat' ? 'Phong Lăng Độ' : R.dg.d ? R.dg.d.n : 'Phó bản') : R.town ? (W.town && W.town.n) || 'Thành thị' : (() => { const i = zoneIdx(Math.min(S.stage, STAGES)), q = ZONES[i], a = ZALT[i], k = (S.zalt || {})[i] || 0; return (a && k ? a[k - 1] || q : q).n; })();
  if (el.textContent !== t) el.textContent = t;
}
function u20ZoneList(keep) {
  const box = $('#u20zl'); if (!keep && !box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
  const z = zoneOf(Math.min(S.stage, STAGES));
  const rows = ZONES.map((q, i) => {
    const open = zoneOpen(i), cur = zoneIdx(Math.min(S.stage, STAGES)) === i, alts = ZALT[i], sel = (S.zalt || {})[i] || 0, zq = alts && sel ? alts[sel - 1] || q : q;
    const chips = alts && open ? `<div class="zalt">${[q].concat(alts).map((a, k) => `<button class="chip2${k === sel ? ' on' : ''}" data-za="${i}:${k}">${esc(a.n)}</button>`).join('')}</div>` : '';
    return `<button class="zrow${cur ? ' cur' : ''}${open ? '' : ' lock'}" data-z="${i}" ${open ? '' : 'disabled'}><b>${esc(zq.n)}</b><span>${seriesDots(zq)} Cấp ${q.lo}–${q.hi}</span></button>${chips}`;
  }).join('');
  box.innerHTML = `<div class="u2zh"><b>Bản đồ luyện công</b><label><input type="checkbox" id="u20za" ${S.autoMap !== false ? 'checked' : ''}> Tự đổi theo cấp</label></div>
    <div class="u2zs">Quái hệ: ${seriesMix(z)}</div><div class="u2zr">${rows}</div>`;
  box.classList.remove('hidden');
  const cur = box.querySelector('.zrow.cur'); if (cur && !keep) cur.scrollIntoView({ block: 'center' });
  const pickMap = i => { if (S.mode === 'quest' || S.mode === 'dg') { S.mode = 'farm'; log('⚔ Chọn bãi luyện công: chuyển sang chế độ Luyện công.'); } S.autoMap = false; gotoZone(i, 'Chọn bãi luyện công'); save(); refresh(); box.classList.add('hidden'); };
  box.querySelectorAll('.zrow').forEach(b => b.onclick = () => pickMap(+b.dataset.z));
  box.querySelectorAll('[data-za]').forEach(b => b.onclick = () => { const [i, k] = b.dataset.za.split(':').map(Number); (S.zalt || (S.zalt = {}))[i] = k;
    if (zoneIdx(Math.min(S.stage, STAGES)) === i) { S.wave = 1; R.enemies = []; R.spawnT = 0.3; R.zoneShown = null; } else pickMap(i); save(); refresh(); u20ZoneList(true); });
  $('#u20za').onchange = e => { S.autoMap = e.target.checked; save(); };
}
document.addEventListener('pointerdown', e => { const z = $('#u20zone'); if (z && !z.contains(e.target)) { const l = $('#u20zl'); if (l) l.classList.add('hidden'); } });
/* ---------- Bang Xep Hang rieng (nut Hang canh Luc chien): the Cap / Luc chien / Thap / Trum, loc phai ---------- */
async function rankModal20() {
  if (typeof netOn !== 'function' || !netOn()) return toast('Bản chơi trên máy không có bảng xếp hạng');
  const tabs = RANKS.map(([k, n]) => `<button data-rk="${k}" class="${k === NET.rank ? 'on' : ''}">${n}</button>`).join('');
  modal(`<h3>Bảng Xếp Hạng</h3><div class="dtabs" id="rkTabs">${tabs}</div><div id="rkBody"><p class="dim small">Đang tải…</p></div>`, () => {
    document.querySelectorAll('#rkTabs [data-rk]').forEach(b => b.onclick = () => { NET.rank = b.dataset.rk; rankModal20(); });
  });
  try { await netClient(); } catch (e) { const b = $('#rkBody'); if (b) b.innerHTML = `<p class="reqbad">${esc(e.message)}</p>`; return; }
  const el = $('#rkBody'); if (!el) return;
  try { await netRankBody(el); } catch (e) { el.innerHTML = `<p class="reqbad">${esc(e.message || e)}</p>`; return; }
  const col = $('#nrCol'); if (col) col.style.display = 'none';
  const fac = $('#nrFac'); if (fac) fac.onchange = e => { NET.rfac = e.target.value; rankModal20(); };
  el.querySelectorAll('[data-pn]').forEach(a => a.onclick = ev => { ev.preventDefault(); profileModal(a.dataset.pn, () => rankModal20()); });
  const me = S && S.name && [...el.querySelectorAll('tr')].findIndex(tr => tr.querySelector('[data-pn]') && tr.querySelector('[data-pn]').dataset.pn === S.name);
  el.insertAdjacentHTML('afterbegin', `<p class="small">Hạng của bạn: <span class="gold" style="font-weight:700">${me > 0 ? '#' + me : 'ngoài top 50'}</span>${NET.user ? '' : ' <span class="dim">(đăng nhập ở Hệ thống › Tài khoản để có tên trên bảng)</span>'}</p>`);
}
