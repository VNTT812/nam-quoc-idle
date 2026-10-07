/* ======================= CHAT THE GIOI (Supabase Realtime) =======================
   Khung chat goc duoi trai san dau nhu JX1: thu gon hien 4 dong moi nhat, cham 💬 de mo lich su + o nhap.
   Tin nhan luu bang public.chat (xem CHAT_SETUP.sql / CHAT_TTL.sql), nhan tin moi qua realtime, dem nguoi online qua presence.
   Lich su chat chi giu 24 gio: client loc khi doc + goi RPC chat_purge_old de xoa tren may chu. */
'use strict';
const CHAT = { sb: null, ch: null, msgs: [], open: false, unread: 0, online: 0, state: 'off', last: 0, err: '',
  mode: 'world', fTo: '', fmsgs: [], fUnread: {}, fOk: null };   // mode world|friend; fOk=null chua biet / true co bang fchat
const CHAT_MAX = 150, CHAT_KEEP = 80, CHAT_GAP = 2500, CHAT_TTL_MS = 24 * 60 * 60 * 1000;
const chatCid = () => { try { let c = localStorage.getItem('jxidle_cid'); if (!c) { c = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem('jxidle_cid', c); } return c; } catch (e) { return 'anon' + Math.random().toString(36).slice(2, 10); } };
const chatName = () => String(S && (S.name || (FAC[S.fac] && FAC[S.fac].n)) || 'Vô danh').slice(0, 20);
const chatTime = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const chatSinceIso = () => new Date(Date.now() - CHAT_TTL_MS).toISOString();
const chatMsgAge = m => { const t = m && (m.ts || m.created_at); const ms = t ? +new Date(t) : 0; return ms > 0 ? Date.now() - ms : 0; };
const chatFresh = m => !m || m.pending || m.sys || chatMsgAge(m) < CHAT_TTL_MS;
function chatPruneLocal() {
  const n = CHAT.msgs.length, nf = CHAT.fmsgs.length;
  CHAT.msgs = CHAT.msgs.filter(chatFresh);
  CHAT.fmsgs = (CHAT.fmsgs || []).filter(m => m.sys || chatFresh(m));
  if (CHAT.msgs.length !== n || CHAT.fmsgs.length !== nf) chatRender();
}
async function chatPurgeServer() {
  if (!CHAT.sb || Date.now() - (CHAT.purged || 0) < 10 * 60 * 1000) return;   // toi da 1 lan / 10 phut
  CHAT.purged = Date.now();
  try { await CHAT.sb.rpc('chat_purge_old'); } catch (e) { /* RPC chua cai (CHAT_TTL.sql) — van loc o client */ }
  try { await CHAT.sb.rpc('fchat_purge_old'); CHAT.fpurged = Date.now(); } catch (e) { /* FRIEND_CHAT.sql */ }
  chatPruneLocal();
}
async function fchatPurgeServer() {
  if (!CHAT.sb || Date.now() - (CHAT.fpurged || 0) < 10 * 60 * 1000) return;
  CHAT.fpurged = Date.now();
  try { await CHAT.sb.rpc('fchat_purge_old'); } catch (e) { /* chua cai SQL */ }
  chatPruneLocal();
}

function chatDom() {
  if ($('#chatBox')) return;
  const b = document.createElement('div'); b.id = 'chatBox';
  b.innerHTML = `<div id="chatHead"><b id="chatTitle">Thế giới</b><small id="chatOn"></small><button id="chatX" title="Thu gọn">▾</button></div>
    <div id="chatTabs"><button type="button" data-cm="world" class="on">Thế giới</button><button type="button" data-cm="friend">Bạn bè</button></div>
    <div id="chatFriends" class="hidden"></div>
    <div id="chatLines"></div>
    <form id="chatIn" autocomplete="off"><span id="chatAtt"></span><input id="chatTxt" maxlength="${CHAT_MAX}" placeholder="Nhập tin nhắn… (xóa sau 24h)"><button class="btn sm">Gửi</button></form>
    <button id="chatBtn" title="Chat thế giới / bạn bè · tin & thư tự xóa sau 24 giờ">💬<b id="chatN"></b></button>`;
  $('#battle').appendChild(b);
  $('#chatLines').onclick = ev => {
    const ci = ev.target.closest('[data-ci]'); if (ci) { chatItemShow(+ci.dataset.ci); return; }
    const n = ev.target.closest('[data-pn]'); if (n && CHAT.open && typeof profileModal === 'function') profileModal(n.dataset.pn);
  };
  $('#chatBtn').onclick = () => chatToggle(true); $('#chatX').onclick = () => chatToggle(false);
  $('#chatIn').onsubmit = ev => { ev.preventDefault(); chatSend($('#chatTxt').value); };
  document.querySelectorAll('#chatTabs [data-cm]').forEach(btn => btn.onclick = () => chatSetMode(btn.dataset.cm));
}
function chatToggle(on) {
  CHAT.open = on; $('#chatBox').classList.toggle('open', on);
  if (on) {
    if (CHAT.mode === 'friend') { if (CHAT.fTo) CHAT.fUnread[CHAT.fTo] = 0; }
    else CHAT.unread = 0;
    setTimeout(() => { const i = $('#chatTxt'); if (i && !matchMedia('(pointer:coarse)').matches) i.focus(); }, 0);
  }
  chatRender();
}
function chatLine(m) {
  if (m.sys) return `<div class="cl sys">${esc(m.msg)}</div>`;
  const me = m.cid === chatCid() || (m.from_name && typeof hasRealName === 'function' && hasRealName() && m.from_name === S.name)
    || (CHAT.mode === 'friend' && m.name === chatName() && !m.from_name);
  const who = m.from_name || m.name;
  return `<div class="cl${me ? ' me' : ''}${m.pending ? ' pend' : ''}${m.pm ? ' pm' : ''}"><i>${chatTime(m.ts)}</i> <b data-pn="${esc(who)}"${(() => { const f = FACTIONS.find(x => x.n === m.fac); return f && typeof campCol === 'function' ? ` style="color:${campCol(f.key)}"` : ''; })()}>${esc(me ? 'Bạn' : who)}</b>${m.lvl && !me ? `<small> ${esc(m.fac || '')} ${m.lvl}</small>` : ''}: ${chatMsgHTML(m)}</div>`;
}
function chatFriendNames() {
  return (typeof friendsOf === 'function' ? friendsOf() : (S && S.friends) || []).map(f => f && f.name).filter(Boolean);
}
function chatSetMode(mode) {
  CHAT.mode = mode === 'friend' ? 'friend' : 'world';
  document.querySelectorAll('#chatTabs [data-cm]').forEach(b => b.classList.toggle('on', b.dataset.cm === CHAT.mode));
  const ff = $('#chatFriends'); if (ff) ff.classList.toggle('hidden', CHAT.mode !== 'friend');
  if (CHAT.mode === 'friend') {
    chatPaintFriends();
    if (CHAT.fTo) { CHAT.fUnread[CHAT.fTo] = 0; fchatLoad(CHAT.fTo).catch(() => {}); }
  }
  const t = $('#chatTxt'); if (t) t.placeholder = CHAT.mode === 'friend' ? (CHAT.fTo ? 'Nhắn «' + CHAT.fTo + '»… (xóa sau 24h)' : 'Chọn bạn bên trên rồi nhập tin…') : 'Nhập tin nhắn… (xóa sau 24h)';
  const title = $('#chatTitle'); if (title) title.textContent = CHAT.mode === 'friend' ? (CHAT.fTo ? 'Bạn · ' + CHAT.fTo : 'Bạn bè') : 'Thế giới';
  if (CHAT.mode === 'friend') fchatPurgeServer().catch(() => {});
  chatRender();
}
function chatPaintFriends() {
  const box = $('#chatFriends'); if (!box) return;
  const names = chatFriendNames();
  const on = typeof friendOnlineSet === 'function' ? friendOnlineSet() : new Set();
  if (!names.length) {
    box.innerHTML = `<p class="dim small">Chưa có bạn. <button type="button" class="btn sm" id="chatFrOpen">Mở bạn bè</button></p>`;
    const b = $('#chatFrOpen'); if (b) b.onclick = () => typeof friendsModal === 'function' && friendsModal();
    return;
  }
  box.innerHTML = names.map(n => {
    const u = CHAT.fUnread[n] || 0;
    return `<button type="button" class="chat-fr${CHAT.fTo === n ? ' on' : ''}" data-fto="${esc(n)}">${esc(n)}${on.has(n) ? ' <i>●</i>' : ''}${u ? `<b>${u > 9 ? '9+' : u}</b>` : ''}</button>`;
  }).join('');
  box.querySelectorAll('[data-fto]').forEach(b => b.onclick = () => chatOpenFriend(b.dataset.fto));
}
async function chatOpenFriend(name) {
  name = String(name || '').trim();
  if (!name) return;
  if (typeof friendHas === 'function' && !friendHas(name) && typeof friendAddLocal === 'function') {
    try { friendAddLocal(name); } catch (e) { /* bo qua */ }
  }
  CHAT.mode = 'friend'; CHAT.fTo = name; CHAT.fUnread[name] = 0;
  if (!$('#chatBox')) chatDom();
  chatToggle(true);
  document.querySelectorAll('#chatTabs [data-cm]').forEach(b => b.classList.toggle('on', b.dataset.cm === 'friend'));
  const ff = $('#chatFriends'); if (ff) ff.classList.remove('hidden');
  chatPaintFriends();
  const t = $('#chatTxt'); if (t) t.placeholder = 'Nhắn «' + name + '»…';
  const title = $('#chatTitle'); if (title) title.textContent = 'Bạn · ' + name;
  await fchatLoad(name);
}
async function fchatLoad(name) {
  name = String(name || CHAT.fTo || '').trim();
  if (!name || !CHAT.sb) { CHAT.fmsgs = []; chatRender(); return; }
  const me = typeof hasRealName === 'function' && hasRealName() ? S.name : '';
  if (!me) { CHAT.fmsgs = [{ sys: true, msg: 'Đặt tên nhân vật để chat bạn bè' }]; chatRender(); return; }
  try {
    if (typeof window.__testFchatList === 'function') {
      CHAT.fmsgs = await window.__testFchatList(me, name);
      CHAT.fOk = true; chatRender(); return;
    }
    const { data, error } = await CHAT.sb.from('fchat').select('*')
      .or(`from_name.eq.${me},to_name.eq.${me}`)
      .gte('ts', chatSinceIso()).order('id', { ascending: true }).limit(120);
    if (error) throw error;
    CHAT.fOk = true;
    CHAT.fmsgs = (data || [])
      .filter(m => (m.from_name === me && m.to_name === name) || (m.from_name === name && m.to_name === me))
      .map(m => Object.assign({ pm: 1, name: m.from_name }, m)).filter(chatFresh);
  } catch (e) {
    const msg = (e && e.message) || '';
    if (/relation .*fchat|Could not find the table|schema cache/i.test(msg)) {
      CHAT.fOk = false;
      CHAT.fmsgs = [{ sys: true, msg: 'Máy chủ chưa bật chat bạn bè — chạy sql/FRIEND_CHAT.sql trên Supabase' }];
    } else {
      CHAT.fmsgs = [{ sys: true, msg: 'Không tải được tin: ' + msg }];
    }
  }
  chatRender();
}
function fchatPush(m) {
  if (!m || !chatFresh(m)) return;
  const me = typeof hasRealName === 'function' && hasRealName() ? S.name : '';
  if (!me) return;
  const other = m.from_name === me ? m.to_name : m.from_name;
  if (!other) return;
  if (m.id && CHAT.fmsgs.some(x => x.id === m.id)) return;
  const row = Object.assign({ pm: 1, name: m.from_name }, m);
  const active = CHAT.mode === 'friend' && CHAT.fTo === other;
  if (active) {
    if (m.cid === chatCid() || m.from_name === me) {
      const i = CHAT.fmsgs.findIndex(x => x.pending && x.msg === m.msg);
      if (i >= 0) { CHAT.fmsgs[i] = row; chatRender(); return; }
    }
    CHAT.fmsgs.push(row); if (CHAT.fmsgs.length > CHAT_KEEP) CHAT.fmsgs.shift();
  } else if (m.from_name !== me) {
    CHAT.fUnread[other] = (CHAT.fUnread[other] || 0) + 1;
    if (!CHAT.open) CHAT.unread++;
    if (typeof log === 'function') log(`💬 <b>${esc(m.from_name)}</b>: ${esc(String(m.msg || '').slice(0, 40))}`);
  }
  if (active || CHAT.mode === 'friend') { chatPaintFriends(); chatRender(); }
  else chatRender();
}
async function fchatSend(t) {
  t = String(t || '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX); if (!t && CHAT.att) t = `[${CHAT.att.n}]`; if (!t) return;
  if (!CHAT.fTo) return toast('Chọn bạn để chat');
  if (!CHAT.sb) return toast('Chat chưa kết nối');
  if (!hasRealName()) return nameModal(() => { chatOpenFriend(CHAT.fTo); $('#chatTxt').value = t; });
  if (typeof friendHas === 'function' && !friendHas(CHAT.fTo)) return toast('Chỉ chat với người trong danh sách bạn');
  if (Date.now() - CHAT.last < CHAT_GAP) return toast('Gửi chậm lại một chút');
  if (CHAT.fOk === false) return toast('Chạy sql/FRIEND_CHAT.sql trên Supabase rồi F5');
  CHAT.last = Date.now(); $('#chatTxt').value = '';
  const row = { from_name: S.name, to_name: CHAT.fTo, cid: chatCid(), fac: FAC[S.fac] ? FAC[S.fac].n : '', lvl: S.lvl | 0, msg: t };
  const att = CHAT.att; if (att) { row.item = att; const tag = `[${att.n}]`; if (!t.includes(tag)) row.msg = (t === tag ? '' : t.slice(0, CHAT_MAX - tag.length - 1) + ' ') + tag; }
  const tmp = Object.assign({ id: 'tmp' + Date.now(), ts: Date.now(), pending: true, pm: 1, name: S.name }, row);
  CHAT.fmsgs.push(tmp); chatAttach(null); chatRender();
  if (typeof window.__testFchatSend === 'function') {
    const data = await window.__testFchatSend(row);
    const i = CHAT.fmsgs.indexOf(tmp); if (i >= 0) CHAT.fmsgs[i] = Object.assign({ pm: 1, name: row.from_name }, data || row);
    chatRender(); return;
  }
  const { data, error } = await CHAT.sb.from('fchat').insert(row).select().single();
  if (error) {
    CHAT.fmsgs = CHAT.fmsgs.filter(x => x !== tmp); chatRender(); if (att) chatAttach(att);
    if (/relation .*fchat|Could not find the table/i.test(error.message || '')) {
      CHAT.fOk = false; toast('Máy chủ chưa bật chat bạn bè — chạy sql/FRIEND_CHAT.sql');
    } else toast('Gửi lỗi: ' + (error.message || ''));
    $('#chatTxt').value = t; return;
  }
  CHAT.fOk = true;
  if (data) { const i = CHAT.fmsgs.indexOf(tmp); if (i >= 0) CHAT.fmsgs[i] = Object.assign({ pm: 1, name: data.from_name }, data); chatRender(); }
}
/* v193: gop nhieu lan ve trong 1 khung hinh (presence / tin moi / poll ban lien tiep) */
function chatRender() { if (CHAT.rq) return; CHAT.rq = requestAnimationFrame(() => { CHAT.rq = 0; chatRenderNow(); }); }
function chatRenderNow() {
  const box = $('#chatBox'); if (!box) return;
  const friendMode = CHAT.mode === 'friend';
  const src = friendMode ? CHAT.fmsgs : CHAT.msgs;
  const list = CHAT.open ? src : (friendMode ? [] : CHAT.msgs.slice(-4));
  const st = CHAT.state === 'off' ? '<div class="cl sys">Chat chưa bật (điền js/chatcfg.js)</div>' : CHAT.state === 'load' ? '<div class="cl sys">Đang kết nối…</div>' : CHAT.state === 'err' ? `<div class="cl sys">Không kết nối được chat${CHAT.err ? ': ' + esc(CHAT.err) : ''}</div>`
    : (friendMode && !CHAT.fTo ? '<div class="cl sys">Chọn bạn ở trên để chat riêng</div>' : '');
  const el = $('#chatLines'), atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
  const h = (CHAT.open || !src.length ? st : '') + list.map(chatLine).join('');
  if (h !== CHAT.lastH) { CHAT.lastH = h; el.innerHTML = h; if (atEnd || !CHAT.open) el.scrollTop = el.scrollHeight; }
  const fUnread = Object.values(CHAT.fUnread || {}).reduce((a, n) => a + (n | 0), 0);
  $('#chatOn').textContent = friendMode
    ? (CHAT.fTo ? ` · ${CHAT.fTo}` : ' · chọn bạn')
    : (CHAT.state === 'ok' && CHAT.online ? ` · ${CHAT.online} online · 24h` : CHAT.state === 'ok' && !CHAT.subOk ? ' · đang nối…' : CHAT.state === 'ok' ? ' · giữ 24h' : '');
  const badge = (CHAT.unread | 0) + fUnread;
  $('#chatN').textContent = badge ? (badge > 9 ? '9+' : badge) : '';
  box.classList.toggle('quiet', !CHAT.open && !CHAT.msgs.length && !fUnread && CHAT.state === 'off');
  box.classList.toggle('friend', friendMode);
  const title = $('#chatTitle'); if (title && CHAT.open) title.textContent = friendMode ? (CHAT.fTo ? 'Bạn · ' + CHAT.fTo : 'Bạn bè') : 'Thế giới';
}
function chatPush(m) {
  if (!chatFresh(m)) return;
  if (m.id && CHAT.msgs.some(x => x.id === m.id)) return;
  if (m.cid === chatCid()) { const i = CHAT.msgs.findIndex(x => x.pending && x.msg === m.msg); if (i >= 0) { CHAT.msgs[i] = m; chatRender(); return; } }   // tin cua minh ve tu may chu: thay ban hien tam
  CHAT.msgs.push(m); if (CHAT.msgs.length > CHAT_KEEP) CHAT.msgs.shift();
  if (!CHAT.open && !m.sys && m.cid !== chatCid()) CHAT.unread++;
  chatRender();
}
async function chatSend(t) {
  if (CHAT.mode === 'friend') return fchatSend(t);
  t = String(t || '').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX); if (!t && CHAT.att) t = `[${CHAT.att.n}]`; if (!t) return;
  if (!CHAT.sb) return toast(CHAT.state === 'load' ? 'Chat đang kết nối, thử lại sau giây lát' : 'Chat chưa kết nối');   // gui tin chi can ket noi may chu (realtime co the dang noi lai)
  if (!hasRealName()) return nameModal(() => { chatToggle(true); $('#chatTxt').value = t; });
  if (Date.now() - CHAT.last < CHAT_GAP) return toast('Gửi chậm lại một chút');
  CHAT.last = Date.now(); $('#chatTxt').value = '';
  const row = { cid: chatCid(), name: chatName(), fac: FAC[S.fac] ? FAC[S.fac].n : '', lvl: S.lvl | 0, msg: t };
  const att = CHAT.att; if (att) { row.item = att; const tag = `[${att.n}]`; if (!t.includes(tag)) row.msg = (t === tag ? '' : t.slice(0, CHAT_MAX - tag.length - 1) + ' ') + tag; }
  const tmp = Object.assign({ id: 'tmp' + Date.now(), ts: Date.now(), pending: true }, row); CHAT.msgs.push(tmp); chatAttach(null); chatRender();   // v193: hien ngay, khong cho may chu
  const { data, error } = await CHAT.sb.from('chat').insert(row).select().single();
  if (error) { CHAT.msgs = CHAT.msgs.filter(x => x !== tmp); chatRender(); if (att) chatAttach(att); toast(att && /item/.test(error.message || '') ? 'Máy chủ chat chưa bật khoe đồ (chạy CHAT_ITEM.sql trên Supabase)' : 'Gửi lỗi: ' + (error.message || '')); $('#chatTxt').value = t; return; }
  if (data) { const i = CHAT.msgs.indexOf(tmp); if (i >= 0) { if (CHAT.msgs.some(x => x.id === data.id)) CHAT.msgs.splice(i, 1); else CHAT.msgs[i] = data; } else chatPush(data); chatRender(); }
}
function chatLoadLib() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve();
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js'; s.onload = ok; s.onerror = () => no(new Error('không tải được thư viện (mất mạng?)')); document.head.appendChild(s); });
}
async function chatInit() {
  if (typeof netOn === 'function' && !netOn()) { document.body.classList.add('nochat'); return; }   // ban tren may: khong co chat
  chatDom();
  const c = window.CHAT_CFG || {};
  if (!c.url || !c.key) { CHAT.state = 'off'; chatRender(); return; }
  CHAT.state = 'load'; chatRender();
  try {
    await chatLoadLib();
    CHAT.sb = await netClient();
    const { data, error } = await CHAT.sb.from('chat').select('*').gte('ts', chatSinceIso()).order('id', { ascending: false }).limit(50);
    if (error) throw error;
    CHAT.msgs = (data || []).reverse().filter(chatFresh); CHAT.state = 'ok'; chatRender();   // doc / gui tin duoc ngay; realtime (tin moi, online) noi sau
    chatPurgeServer();   // xoa tin > 24h tren may chu (can CHAT_TTL.sql)
    chatSub();
    if (!CHAT.polling) { CHAT.polling = true; setInterval(chatPoll, 15000);    // du phong: lay tin bi lo + noi lai kenh khi rot
      document.addEventListener('visibilitychange', () => { if (!document.hidden) chatPoll(true); }); }   // quay lai tab (trinh duyet bop websocket khi an)
  } catch (e) { CHAT.state = 'err'; CHAT.err = (e.message || String(e)) + ' · thử lại sau 10 giây'; chatRender(); clearTimeout(CHAT.initT); CHAT.initT = setTimeout(chatInit, 10000); }
}

/* ---------- KHOE DO LEN CHAT ----------
   Mo chi tiet mon do > "Khoe lên chat": dinh kem ban sao mon do (cot item jsonb, xem CHAT_ITEM.sql) vao tin nhan.
   Trong chat hien [Ten do] theo mau do hiem; bam vao xem day du dong thuoc tinh. Du lieu tu nguoi khac: chi giu so / chuoi ngan,
   kiem tra loai do, mau, duong dan hinh; ve bang itemHTML (da esc). */
const CHAT_IT_DROP = new Set(['uid', 'lock', 'price', 'dtk']);
function chatItemClean(src, depth = 0) {
  if (depth > 4 || src == null) return undefined;
  if (typeof src === 'number') return Number.isFinite(src) ? src : undefined;
  if (typeof src === 'boolean') return src;
  if (typeof src === 'string') return src.slice(0, 60);
  if (Array.isArray(src)) return src.slice(0, 24).map(x => chatItemClean(x, depth + 1)).filter(x => x !== undefined);
  if (typeof src === 'object') { const o = {}; let n = 0; for (const k in src) { if (CHAT_IT_DROP.has(k) || ++n > 30 || !/^\w{1,12}$/.test(k)) continue; const v = chatItemClean(src[k], depth + 1); if (v !== undefined) o[k] = v; } return o; }
  return undefined;
}
function chatItemOk(it) {
  if (!it || typeof it !== 'object' || !J.items[it.d] || typeof it.n !== 'string' || !it.n) return null;
  it = chatItemClean(it); it.r = clamp(Math.round(+it.r || 0), 0, RAR_COL.length - 1); it.lvl = clamp(Math.round(+it.lvl || 1), 1, 99);
  if (typeof it.ic !== 'string' || !/^img\/[\w\/.-]+\.(png|webp|jpg)$/.test(it.ic) || it.ic.includes('..')) delete it.ic;
  if (!Array.isArray(it.mag)) it.mag = []; return it;
}
function chatAttach(it) {
  CHAT.att = it ? chatItemOk(chatItemClean(it)) : null;
  const a = $('#chatAtt'); if (!a) return;
  a.innerHTML = CHAT.att ? `<b style="color:${RAR_COL[CHAT.att.r]}">[${esc(CHAT.att.n)}]</b><button type="button" title="Bỏ đính kèm">✕</button>` : '';
  const x = a.querySelector('button'); if (x) x.onclick = () => chatAttach(null);
}
function chatMsgHTML(m) {
  const it = m.item && chatItemOk(m.item); let h = esc(m.msg);
  if (it) { const tag = esc(`[${it.n}]`), link = `<a class="chit" data-ci="${+m.id || 0}" style="color:${RAR_COL[it.r]}">${tag}</a>`; h = h.includes(tag) ? h.replace(tag, link) : h + ' ' + link; }
  return h;
}
function chatItemShow(id) {
  const m = CHAT.msgs.find(x => +x.id === id) || CHAT.fmsgs.find(x => +x.id === id), it = m && chatItemOk(m.item); if (!it) return;
  let body = ''; try { body = itemHTML(it); } catch (e) { body = `<h4 style="color:${RAR_COL[it.r]}">${esc(it.n)}</h4><p class="dim">Không đọc được chi tiết món đồ.</p>`; }
  modal(`<h3>Đồ của ${esc(m.name)} <small>${esc(m.fac || '')} ${m.lvl || ''}</small></h3>${body}`);
}
function chatShowItem(it) {
  if (document.body.classList.contains('nochat')) return toast('Bản chơi trên máy không có chat');
  if (!$('#chatBox')) return toast('Chat chưa bật');
  closeModal(true); chatAttach(it); chatToggle(true);
  toast('Đã đính kèm vào chat · gõ thêm lời nhắn rồi bấm Gửi');
}
/* nut "Khoe lên chat" trong chi tiet mon do */
if (typeof itemModal === 'function') {
  const _itemModal = itemModal;
  itemModal = (it, slot) => {
    _itemModal(it, slot);
    if (document.body.classList.contains('nochat') || !$('#chatBox')) return;
    const row = document.querySelector('#mBody .btnrow'); if (!row || !it) return;
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = '💬 Khoe lên chat'; b.onclick = () => chatShowItem(it); row.appendChild(b);
  };
}

/* ---------- kenh realtime: tu noi lai khi rot (truoc day phai F5) ---------- */
async function chatSub() {
  if (!CHAT.sb || CHAT.subBusy) return;
  CHAT.subBusy = true;
  const old = CHAT.ch; CHAT.ch = null; clearTimeout(CHAT.reT);                // v186: bo kenh cu TRUOC khi go (go kenh -> bao CLOSED -> truoc day lai noi lai -> vong lap 3 giay)
  if (old) { try { await CHAT.sb.removeChannel(old); } catch (e) { /* bo qua */ } }   // v188: cho go xong (cung ten kenh: tao ngay se lay lai kenh dang dong)
  CHAT.subBusy = false;
  const ch = CHAT.ch = CHAT.sb.channel('the-gioi', { config: { presence: { key: chatCid() } } });
  const cnt = () => { if (CHAT.ch !== ch) return; CHAT.online = Object.keys(ch.presenceState()).length; chatRender(); };
  ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat' }, p => chatPush(p.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fchat' }, p => fchatPush(p.new))
    .on('presence', { event: 'sync' }, cnt).on('presence', { event: 'join' }, cnt).on('presence', { event: 'leave' }, cnt)
    .subscribe(async st => {
      if (CHAT.ch !== ch) return;
      if (st === 'SUBSCRIBED') { CHAT.subOk = true; CHAT.state = 'ok'; CHAT.err = ''; chatRender(); try { await ch.track({ name: chatName(), lvl: S.lvl | 0 }); } catch (e) { /* bo qua */ } cnt(); }
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { CHAT.subOk = false; clearTimeout(CHAT.reT); CHAT.reT = setTimeout(chatSub, 3000); }   // noi lai sau 3 giay
    });
}
async function chatPoll(force) {
  if (!CHAT.sb || document.hidden) return;
  const live = CHAT.subOk && CHAT.ch && CHAT.ch.state === 'joined';
  if (live && force !== true && Date.now() - (CHAT.polled || 0) < 60000) return;   // kenh truc tiep dang song: 60 giay moi kiem 1 lan
  CHAT.polled = Date.now();
  chatPruneLocal();
  chatPurgeServer();
  if (!CHAT.ch || CHAT.ch.state === 'closed' || CHAT.ch.state === 'errored') chatSub();   // chi noi lai khi kenh da dong / loi (dang noi thi de yen)
  try {
    const last = CHAT.msgs.reduce((m, x) => Math.max(m, +x.id || 0), 0);
    const { data } = await CHAT.sb.from('chat').select('*').gt('id', last).gte('ts', chatSinceIso()).order('id', { ascending: true }).limit(50);
    (data || []).forEach(chatPush);
    if (CHAT.ch && CHAT.ch.presenceState) { CHAT.online = Object.keys(CHAT.ch.presenceState()).length; chatRender(); }
  } catch (e) { /* thu lai lan sau */ }
  try {
    if (typeof hasRealName === 'function' && hasRealName() && CHAT.fOk !== false) {
      const lastF = CHAT.fmsgs.reduce((m, x) => Math.max(m, +x.id || 0), 0);
      const { data: fd } = await CHAT.sb.from('fchat').select('*').or(`from_name.eq.${S.name},to_name.eq.${S.name}`).gt('id', lastF).gte('ts', chatSinceIso()).order('id', { ascending: true }).limit(40);
      (fd || []).forEach(fchatPush);
      CHAT.fOk = true;
    }
  } catch (e) {
    if (/relation .*fchat|Could not find the table/i.test((e && e.message) || '')) CHAT.fOk = false;
  }
  await fchatPurgeServer();
}
