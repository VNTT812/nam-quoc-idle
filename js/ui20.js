/* ======================= GIAO DIEN KIEU VO LAM 2.0 (ui20.css) =======================
   Bat khi man hinh ngang rong >= 900px (dien thoai doc giu giao dien cu). v192: chi con giao dien moi (bo chuyen ve Co dien). */
'use strict';
const U20_TABS = [['char', 'char', 'Nhân vật', 'Nhân vật'], ['inv', 'inv', 'Hành trang', 'Vật phẩm'], ['skill', 'skill', 'Võ công', 'Kỹ năng'], ['forge', 'forge', 'Lò rèn', 'Lò rèn'],
  ['quest', 'quest', 'Nhiệm vụ · Phó bản', 'Chỉ nam nhiệm vụ'], ['ride', 'ride', 'Lên / xuống ngựa (M)', ''], ['more', 'more', 'Hệ thống', 'Hệ thống']];
const U20_SIDE = [];
const U20_LOGT = [['all', 'Tổng hợp'], ['chat', 'Thế giới'], ['friend', 'Bạn'], ['fight', 'Chiến đấu'], ['loot', 'Nhặt đồ'], ['quest', 'Nhiệm vụ'], ['sys', 'Hệ thống']];
let u20LogT = 'all', u20Cur = null;
const u20On = () => !!S && window.innerWidth > window.innerHeight && (window.innerWidth >= 900 || (window.innerWidth >= 640 && window.innerHeight <= 520));   // may tinh + dien thoai cam ngang
const u2mOn = () => !!S && !u20On();                                     // dien thoai cam doc: giu bo cuc tren / duoi, phong cach 2.0
function u20Init() {
  if (document.getElementById('u20menu')) return;
  const add = h => { const d = document.createElement('div'); d.innerHTML = h; document.body.appendChild(d.firstElementChild); };
  add(`<div id="u20menu">${U20_TABS.map(([k, ic, n]) => `<button class="u20mi" data-u="${k}" title="${n}" style="background-image:url(img/u2/${ic}.png)"><i class="dot"></i></button>`).join('')}</div>`);
  add('<div id="u20rc"><div id="u20trk" style="display:none"></div><button id="u20mail" title="Hộp thư: quà, đồ gửi, đồ mua ở Chợ"><b id="u20mailN"></b></button></div>');
  { const pw = $('#pwS'); if (pw && !$('#u20rank')) pw.parentNode.insertAdjacentHTML('afterend', '<button id="u20rank" title="Bảng xếp hạng">🏆 Hạng</button>'); }
  add('<div id="u20zone"><button id="u20zb" title="Bản đồ luyện công"><span id="u20zn"></span> ▾</button><div id="u20zl" class="hidden"></div></div>');
  add(`<div id="u20side">${U20_SIDE.map(([ic, n], i) => `<button class="u20sq" data-s="${i}" data-n="${n}">${ic}</button>`).join('')}</div>`);
  add(`<div id="u20r"><button class="u20rb" id="u20gift">Phần<br>thưởng</button><button class="u20rb" id="u20ktc">Kỳ Trân<br>Các</button><button class="u20rb" id="u20mkt">Chợ</button></div>`);
  add(`<div id="u20gold"><span><img src="img/ep/knb.png" alt=""><b id="u20knb">0</b></span><span>🪙 <b id="u20g">0</b></span></div>`);
  add(`<div id="u20log"><div id="u20lines"></div><div id="u20ct"><button id="u20lt" title="Ẩn / hiện khung thông báo">📜</button>${U20_LOGT.map(([k, n]) => `<button data-lt="${k}" class="${k === u20LogT ? 'on' : ''}">${n}</button>`).join('')}</div></div>`);
  add(`<div id="u20boss"><div class="t"></div><div class="b"><i></i><span></span></div></div>`);
  const p = document.getElementById('panel'); const h = document.createElement('div'); h.id = 'u20wh'; h.innerHTML = '<span id="u20wt"></span><button id="u20wx">✕</button>'; p.prepend(h);
  document.querySelectorAll('#u20menu .u20mi').forEach(b => b.onclick = () => (b.dataset.u === 'ride' ? toggleMount() : u20Toggle(b.dataset.u))); u20TrkOn = !S || S.u20trk !== false;
  document.querySelectorAll('#u20side .u20sq').forEach(b => b.onclick = () => U20_SIDE[+b.dataset.s][2]());
  $('#u20lt').onclick = () => { S.u20logOff = !S.u20logOff; save(); u20LogVis(); };
  document.querySelectorAll('#u20ct button[data-lt]').forEach(b => b.onclick = () => { u20LogT = b.dataset.lt; document.querySelectorAll('#u20ct button[data-lt]').forEach(x => x.classList.toggle('on', x === b)); u20LogDraw(); });
  u20LogVis();
  const nm = t => () => (typeof netModal === 'function' && typeof netOn === 'function' && netOn() ? netModal(t) : toast('Bản chơi trên máy không có xếp hạng / chợ / thư'));
  $('#u20mkt').onclick = nm('mkt'); $('#u20mail').onclick = nm('mail'); const rk = $('#u20rank'); if (rk) rk.onclick = () => rankModal20();
  if (!$('#u20fr') && $('#u20mail')) {
    $('#u20mail').insertAdjacentHTML('afterend', '<button id="u20fr" title="Bạn bè">👥</button>');
    $('#u20fr').onclick = () => (typeof friendsModal === 'function' ? friendsModal() : nm('friends')());
  }
  $('#u20zb').onclick = () => { u20ZoneList(); u20Front($('#u20zone')); }; $('#u20wx').onclick = u20Close; $('#u20gift').onclick = () => giftModal(true); $('#u20ktc').onclick = () => ktcModal();
  u20Drag(h, p);
  p.addEventListener('pointerdown', () => { if ($('#modal').classList.contains('hidden')) u20Front(p); });
  if (typeof modal === 'function') { const _m = modal; modal = (...a) => { const r = _m(...a); u20Front($('#modal')); return r; }; }
  if (typeof chatToggle === 'function') { const _c = chatToggle; chatToggle = on => { _c(on); if (on) u20Front($('#chatBox')); }; }
  u20Apply(); window.addEventListener('resize', u20Apply);
  setInterval(u20Tick, 250);
}
/* dien thoai doc: thanh ten ban do nam ngay duoi ban do nho (ve tren canvas) */
function u2mZonePos() {
  const cv = $('#arena'), z = $('#u20zone'); if (!cv || !z) return; const r = cv.getBoundingClientRect(), k = r.width / (cv.clientWidth || r.width || 1);
  Object.assign(z.style, { top: (r.top + (MINI.top + MINI.s + 2) * k) + 'px', right: (window.innerWidth - r.right + MINI.m * k) + 'px', width: (MINI.s * k) + 'px' });
}
/* an / hien khung thong bao (giu nut, nhu chat) */
function u20LogVis() { const off = !!(S && S.u20logOff); document.body.classList.toggle('u20logoff', off); const b = $('#u20lt'); if (b) { b.classList.toggle('on', !off); b.title = off ? 'Hiện khung thông báo' : 'Ẩn khung thông báo'; } }
/* cua so / hop thoai mo sau (hoac vua bam vao) nam tren cung */
let u20Z = 50;
function u20Front(el) { if (el && document.body.classList.contains('u20')) el.style.setProperty('z-index', String(++u20Z), 'important'); }
/* keo cua so */
function u20Drag(h, p) {
  let sx, sy, ox, oy, on = false;
  h.addEventListener('pointerdown', e => { if (e.target.tagName === 'BUTTON') return; on = true; sx = e.clientX; sy = e.clientY; const r = p.getBoundingClientRect(); ox = r.left; oy = r.top; h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove', e => { if (!on) return; p.style.left = (ox + e.clientX - sx) + 'px'; p.style.top = Math.max(0, oy + e.clientY - sy) + 'px'; p.style.transform = 'none'; });
  h.addEventListener('pointerup', () => { on = false; });
}
function u20Apply() {
  const on = u20On(), sm = on && window.innerHeight < 560, mo = u2mOn(); document.body.classList.toggle('u20', on); document.body.classList.toggle('u2s', sm); document.body.classList.toggle('u2m', mo);
  for (const id of ['u20menu', 'u20side', 'u20r', 'u20gold', 'u20log', 'u20boss', 'u20rc', 'u20rank']) { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; }
  $('#u20zone').style.display = on || mo ? '' : 'none';
  if (typeof MINI !== 'undefined') { if (on) { MINI.s = sm ? 104 : 150; MINI.top = sm ? 2 : 4; MINI.m = sm ? 4 : 6; } else { MINI.s = 92; MINI.top = 62; MINI.m = 8; } }
  if (on) { $('#u20r').style.right = (MINI.s + MINI.m + (sm ? 6 : 12)) + 'px'; const zt = MINI.s + MINI.top + 2; Object.assign($('#u20zone').style, { top: zt + 'px', right: MINI.m + 'px', width: MINI.s + 'px' });
    const zh = sm && matchMedia('(pointer: coarse)').matches ? 32 : 24; $('#u20side').style.top = (zt + zh + 4) + 'px'; $('#u20rc').style.top = (zt + zh + 4) + 'px'; }
  if (mo) u2mZonePos();
  const cb = $('#chatBox'); if (cb) { const want = on ? document.body : $('#battle'); if (cb.parentNode !== want) want.appendChild(cb); }
  const tm = document.querySelector('#tabs [data-t=more]'); if (tm && tm.firstChild && tm.firstChild.nodeType === 3) tm.firstChild.textContent = mo ? 'Trợ thủ' : 'Khác';
  if (!on && typeof curTab !== 'undefined' && S && S.fac) { document.body.classList.remove('u20win'); u20Cur = null; u20MoreMode = mo ? 'tt' : 'sys'; refresh(); }
  if (typeof resizeArena === 'function' && typeof CV !== 'undefined' && CV) resizeArena();
}
function u20Open(t, sub) {
  if (sub && typeof questTab !== 'undefined') questTab = sub;
  u20Cur = t; if (t === 'tt' || t === 'more') u20MoreMode = t === 'tt' ? 'tt' : 'sys';
  if (t !== 'tt' && $('#u2ttBody')) $('#t-more').innerHTML = '';
  showTab(t === 'tt' ? 'more' : t); document.body.classList.add('u20win'); u20Front($('#panel'));
  const def = U20_TABS.find(x => x[0] === t); $('#u20wt').textContent = def ? def[3] : t === 'tt' ? 'Trợ Thủ Kiếm Hiệp' : '';
  document.querySelectorAll('#u20menu .u20mi:not([data-u=ride])').forEach(b => b.classList.toggle('on', b.dataset.u === t));
}
function u20Close() { u20Cur = null; document.body.classList.remove('u20win'); document.querySelectorAll('#u20menu .u20mi:not([data-u=ride])').forEach(b => b.classList.remove('on')); }
function u20Toggle(t) { if (u20Cur === t && document.body.classList.contains('u20win')) u20Close(); else u20Open(t); }
/* Tro Thu Kiem Hiep: gom cac tuy chon tu dong */
function u20Helper() {
  const ck = (id, on, t) => `<label><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${t}</label>`, d = typeof DT === 'function' ? DT() : {};
  modal(`<h3>Trợ Thủ Kiếm Hiệp</h3><div class="u20tt">
    <h4>Chiến đấu</h4>${ck('tAuto', !manual(), 'Tự đánh (Auto) · phím F')}${ck('tRot', S.rot !== false, 'Xoay chiêu ô F1–F4 · phím R')}${ck('tRide', S.autoRide !== false, 'Tự lên ngựa khi di chuyển, xuống ngựa khi đánh chiêu không dùng trên ngựa · phím M')}${ck('tMap', S.autoMap !== false, 'Tự đổi bãi luyện công theo cấp')}
    <h4>Thuốc</h4>${ck('tPot', !S.potOff, 'Dùng thuốc khi sinh lực / nội lực dưới 50%')}${ck('tBuy', S.potBuy !== false, 'Tự mua thuốc khi hết (tối đa 20% ngân lượng)')}
    <h4>Đồ đạc</h4>${ck('tEq', !!S.autoEquip, 'Tự mặc đồ tốt hơn khi nhặt')}${ck('tJunk', S.autoJunk !== false, 'Tự bán đồ thừa')}${ck('tPts', S.autoPts === true, 'Tự cộng điểm tiềm năng và võ công')}
    <h4>Nhiệm vụ</h4>${ck('tDt', d.auto !== false, 'Dã Tẩu tự trả / nhận')}${ck('tLdt', S.autoLdt !== false, 'Tự dùng Lệnh Bài Dã Tẩu khi hết lượt')}</div>`, () => {
    const on = (id, fn) => { const el = $(id); if (el) el.onchange = () => { fn(el.checked); save(); }; };
    on('#tAuto', v => setCtrl(v ? 'auto' : 'manual')); on('#tRot', v => { S.rot = v; refreshRotBtn(); R.dirty = true; }); on('#tRide', v => { S.autoRide = v; });
    on('#tMap', v => { S.autoMap = v; }); on('#tPot', v => { S.potOff = !v; }); on('#tBuy', v => { S.potBuy = v; }); on('#tEq', v => { S.autoEquip = v; });
    on('#tJunk', v => { S.autoJunk = v; }); on('#tPts', v => { S.autoPts = v; }); on('#tDt', v => { DT().auto = v; }); on('#tLdt', v => { S.autoLdt = v; });
  });
}
/* nhat ky loc theo tab (theo noi dung dong) */
const u20Kind = l => /Nhặt được|rơi ra|Tự mua|Hành trang đầy/.test(l) ? 'loot' : /📜|Dã Tẩu|Sát Thủ|Phó bản|🏯|thuyền/i.test(l) ? 'quest' : /Hạ |xuất hiện|trọng thương|Trùm|trốn thoát/.test(l) ? 'fight' : 'sys';
let u20LogN = -1;
function u20LogDraw() {
  const box = $('#u20lines'); if (!box) return;
  if (u20LogT === 'chat') { box.innerHTML = typeof CHAT !== 'undefined' && CHAT.msgs.length ? CHAT.msgs.slice(-10).map(chatLine).join('') : '<div style="color:#999">Chưa có tin nhắn · bấm 💬 để chat thế giới</div>'; return; }
  if (u20LogT === 'friend') {
    const rows = (typeof CHAT !== 'undefined' && CHAT.fmsgs && CHAT.fmsgs.length) ? CHAT.fmsgs.filter(m => !m.sys).slice(-10) : [];
    box.innerHTML = rows.length
      ? rows.map(chatLine).join('') + `<div style="color:#9fe8ff;margin-top:4px"><a href="#" id="u20frChat">💬 Mở chat bạn bè</a></div>`
      : `<div style="color:#999">Chat riêng với bạn · <a href="#" id="u20frChat">bấm 💬 → tab Bạn bè</a></div>`;
    const a = $('#u20frChat'); if (a) a.onclick = ev => {
      ev.preventDefault();
      if (typeof chatOpenFriend === 'function' && CHAT.fTo) chatOpenFriend(CHAT.fTo);
      else if (typeof chatToggle === 'function') { chatToggle(true); if (typeof chatSetMode === 'function') chatSetMode('friend'); }
    };
    return;
  }
  const L = (R.logs || []).filter(l => {
    if (u20LogT === 'all') return true;
    if (u20LogT === 'sys' && /💬|Kết bạn|Nhận thư/.test(l)) return true;
    return u20Kind(l) === u20LogT;
  }).slice(0, 10).reverse();
  box.innerHTML = L.map(l => `<div>${l}</div>`).join('');
}
function u20Tick() {
  if (document.body.classList.contains('u2m') && S && S.fac) { u20ZoneName(); u2mZonePos(); return; }
  if (!document.body.classList.contains('u20') || !S || !S.fac) return;
  u20TrkDraw(); u20ZoneName(); { const on = typeof netOn === 'function' && netOn(), n = (typeof NET !== 'undefined' && NET.mailN) || 0; $('#u20mail').style.display = on ? '' : 'none'; $('#u20mkt').style.display = on ? '' : 'none'; const rk = $('#u20rank'); if (rk) rk.style.display = on ? 'block' : 'none'; $('#u20mailN').textContent = n ? (n > 9 ? '9+' : n) : ''; $('#u20mail').classList.toggle('on', n > 0); } const cb = $('#chatBox'); if (cb && cb.parentNode !== document.body) document.body.appendChild(cb); const rb = document.querySelector('#u20menu [data-u="ride"]'); if (rb) { rb.classList.toggle('on', !!R.mounted); rb.classList.toggle('off', !canRide()); }
  const n = (R.logs || []).length + '|' + (R.logs || [])[0] + '|' + (typeof CHAT !== 'undefined' ? CHAT.msgs.length + '|' + CHAT.fmsgs.length + '|' + CHAT.mode + '|' + CHAT.fTo : 0); if (n !== u20LogN) { u20LogN = n; u20LogDraw(); }
  $('#u20g').textContent = fmt(S.gold); $('#u20knb').textContent = fmt(S.knb || 0);
  // thanh mau trum dang danh / gan nhat
  const b = R.enemies && R.enemies.filter(e => !e.dead && (e.cls === 'boss') && Math.hypot(e.x - H.x, e.y - H.y) < 700).sort((p, q) => Math.hypot(p.x - H.x, p.y - H.y) - Math.hypot(q.x - H.x, q.y - H.y))[0], bb = $('#u20boss');
  if (b) { bb.style.display = 'block'; bb.querySelector('.t').textContent = `${b.n} · Lv ${b.L}`; const pc = Math.max(0, b.hp / b.max * 100); bb.querySelector('i').style.width = pc + '%'; bb.querySelector('span').textContent = pc.toFixed(1) + '%'; }
  else bb.style.display = 'none';
  // cham do tren menu (dung chung cham cu)
  for (const [k, id] of [['char', 'dotChar'], ['skill', 'dotSkill'], ['forge', 'dotForge'], ['quest', 'dotQuest']]) { const o = document.getElementById(id), m = document.querySelector(`#u20menu [data-u="${k}"] .dot`); if (o && m) m.classList.toggle('on', o.classList.contains('on')); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(u20Init, 300)); else setTimeout(u20Init, 300);
