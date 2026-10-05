/* ======================= CHAT THE GIOI (Supabase Realtime) =======================
   Khung chat goc duoi trai san dau nhu JX1: thu gon hien 4 dong moi nhat, cham 💬 de mo lich su + o nhap.
   Tin nhan luu bang public.chat (xem CHAT_SETUP.sql), nhan tin moi qua realtime, dem nguoi online qua presence. */
'use strict';
const CHAT = { sb: null, ch: null, msgs: [], open: false, unread: 0, online: 0, state: 'off', last: 0, err: '' };
const CHAT_MAX = 150, CHAT_KEEP = 80, CHAT_GAP = 2500;
const chatCid = () => { try { let c = localStorage.getItem('jxidle_cid'); if (!c) { c = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem('jxidle_cid', c); } return c; } catch (e) { return 'anon' + Math.random().toString(36).slice(2, 10); } };
const chatName = () => String(S && (S.name || (FAC[S.fac] && FAC[S.fac].n)) || 'Vô danh').slice(0, 20);
const chatTime = t => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function chatDom() {
  if ($('#chatBox')) return;
  const b = document.createElement('div'); b.id = 'chatBox';
  b.innerHTML = `<div id="chatHead"><b>Thế giới</b><small id="chatOn"></small><button id="chatX" title="Thu gọn">▾</button></div>
    <div id="chatLines"></div>
    <form id="chatIn" autocomplete="off"><span id="chatAtt"></span><input id="chatTxt" maxlength="${CHAT_MAX}" placeholder="Nhập tin nhắn…"><button class="btn sm">Gửi</button></form>
    <button id="chatBtn" title="Chat thế giới">💬<b id="chatN"></b></button>`;
  $('#battle').appendChild(b);
  $('#chatLines').onclick = ev => { const ci = ev.target.closest('[data-ci]'); if (ci) { chatItemShow(+ci.dataset.ci); return; } const n = ev.target.closest('[data-pn]'); if (n && CHAT.open && typeof profileModal === 'function') profileModal(n.dataset.pn); };
  $('#chatBtn').onclick = () => chatToggle(true); $('#chatX').onclick = () => chatToggle(false);
  $('#chatIn').onsubmit = ev => { ev.preventDefault(); chatSend($('#chatTxt').value); };
}
function chatToggle(on) {
  CHAT.open = on; $('#chatBox').classList.toggle('open', on); if (on) { CHAT.unread = 0; setTimeout(() => { const i = $('#chatTxt'); if (i && !matchMedia('(pointer:coarse)').matches) i.focus(); }, 0); }
  chatRender();
}
function chatLine(m) {
  if (m.sys) return `<div class="cl sys">${esc(m.msg)}</div>`;
  const me = m.cid === chatCid();
  return `<div class="cl${me ? ' me' : ''}${m.pending ? ' pend' : ''}"><i>${chatTime(m.ts)}</i> <b data-pn="${esc(m.name)}"${(() => { const f = FACTIONS.find(x => x.n === m.fac); return f && typeof campCol === 'function' ? ` style="color:${campCol(f.key)}"` : ''; })()}>${esc(m.name)}</b>${m.lvl ? `<small> ${esc(m.fac || '')} ${m.lvl}</small>` : ''}: ${chatMsgHTML(m)}</div>`;
}
/* v193: gop nhieu lan ve trong 1 khung hinh (presence / tin moi / poll ban lien tiep) */
function chatRender() { if (CHAT.rq) return; CHAT.rq = requestAnimationFrame(() => { CHAT.rq = 0; chatRenderNow(); }); }
function chatRenderNow() {
  const box = $('#chatBox'); if (!box) return;
  const list = CHAT.open ? CHAT.msgs : CHAT.msgs.slice(-4);
  const st = CHAT.state === 'off' ? '<div class="cl sys">Chat chưa bật (điền js/chatcfg.js)</div>' : CHAT.state === 'load' ? '<div class="cl sys">Đang kết nối…</div>' : CHAT.state === 'err' ? `<div class="cl sys">Không kết nối được chat${CHAT.err ? ': ' + esc(CHAT.err) : ''}</div>` : '';
  const el = $('#chatLines'), atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;   // dang keo len doc tin cu: khong nhay xuong
  const h = (CHAT.open || !CHAT.msgs.length ? st : '') + list.map(chatLine).join('');
  if (h !== CHAT.lastH) { CHAT.lastH = h; el.innerHTML = h; if (atEnd || !CHAT.open) el.scrollTop = el.scrollHeight; }
  $('#chatOn').textContent = CHAT.state === 'ok' && CHAT.online ? ` · ${CHAT.online} người online` : CHAT.state === 'ok' && !CHAT.subOk ? ' · đang nối…' : '';
  $('#chatN').textContent = CHAT.unread ? (CHAT.unread > 9 ? '9+' : CHAT.unread) : '';
  box.classList.toggle('quiet', !CHAT.open && !CHAT.msgs.length && CHAT.state === 'off');
}
function chatPush(m) {
  if (m.id && CHAT.msgs.some(x => x.id === m.id)) return;
  if (m.cid === chatCid()) { const i = CHAT.msgs.findIndex(x => x.pending && x.msg === m.msg); if (i >= 0) { CHAT.msgs[i] = m; chatRender(); return; } }   // tin cua minh ve tu may chu: thay ban hien tam
  CHAT.msgs.push(m); if (CHAT.msgs.length > CHAT_KEEP) CHAT.msgs.shift();
  if (!CHAT.open && !m.sys && m.cid !== chatCid()) CHAT.unread++;
  chatRender();
}
async function chatSend(t) {
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
    const { data, error } = await CHAT.sb.from('chat').select('*').order('id', { ascending: false }).limit(50);
    if (error) throw error;
    CHAT.msgs = (data || []).reverse(); CHAT.state = 'ok'; chatRender();   // doc / gui tin duoc ngay; realtime (tin moi, online) noi sau
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
  const m = CHAT.msgs.find(x => +x.id === id), it = m && chatItemOk(m.item); if (!it) return;
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
  if (!CHAT.ch || CHAT.ch.state === 'closed' || CHAT.ch.state === 'errored') chatSub();   // chi noi lai khi kenh da dong / loi (dang noi thi de yen)
  try {
    const last = CHAT.msgs.reduce((m, x) => Math.max(m, +x.id || 0), 0);
    const { data } = await CHAT.sb.from('chat').select('*').gt('id', last).order('id', { ascending: true }).limit(50);
    (data || []).forEach(chatPush);
    if (CHAT.ch && CHAT.ch.presenceState) { CHAT.online = Object.keys(CHAT.ch.presenceState()).length; chatRender(); }
  } catch (e) { /* thu lai lan sau */ }
}
