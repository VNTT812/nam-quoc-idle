/* ======================= BAN BE =======================
   Luu trong S.friends = [{ name, at }]. Them tu xep hang / profile / o tab Ban be.
   Loi moi ket ban: thu kind=friend, item={ __friend:1, act:'req'|'ok' }. */
'use strict';

const FRIEND_MAX = 40;
const friendsOf = () => (S && (S.friends || (S.friends = [])));
const friendNorm = n => String(n || '').trim().slice(0, 14);
const friendHas = n => {
  n = friendNorm(n); if (!n) return false;
  return friendsOf().some(f => f && f.name === n);
};
function friendAddLocal(name) {
  name = friendNorm(name);
  if (!name) throw new Error('Thiếu tên nhân vật');
  if (!S || !S.fac) throw new Error('Vào nhân vật trước');
  if (typeof hasRealName === 'function' && hasRealName() && name === S.name) throw new Error('Không thể kết bạn với chính mình');
  if (friendHas(name)) return { ok: true, already: true, name };
  if (friendsOf().length >= FRIEND_MAX) throw new Error('Danh sách bạn đầy (' + FRIEND_MAX + ')');
  friendsOf().unshift({ name, at: Date.now() });
  if (typeof save === 'function') save();
  return { ok: true, name };
}
function friendRemove(name) {
  name = friendNorm(name);
  S.friends = friendsOf().filter(f => f && f.name !== name);
  if (typeof save === 'function') save();
  return true;
}

/** Danh sách nhân vật trên máy chủ (xếp hạng / admin / bạn bè). */
async function netListChars(q, lim) {
  q = friendNorm(q); lim = Math.min(200, Math.max(1, lim | 0) || 80);
  if (typeof window.__testListChars === 'function') return window.__testListChars(q, lim);
  if (typeof netOn !== 'function' || !netOn()) throw new Error('Cần bản online');
  if (!NET.user && typeof netEnsureUser === 'function') await netEnsureUser();
  if (!NET.user) throw new Error('Cần đăng nhập');
  await netClient();
  let r;
  if (q) {
    r = await netCall(sb => sb.from('chars').select('name,fac,lvl,reborn,power,sex,updated')
      .ilike('name', '%' + q.replace(/[%_]/g, '') + '%')
      .order('lvl', { ascending: false }).limit(lim));
  } else {
    r = await netCall(sb => sb.from('chars').select('name,fac,lvl,reborn,power,sex,updated')
      .order('updated', { ascending: false }).limit(lim));
  }
  return r.data || [];
}

function friendOnlineSet() {
  const out = new Set();
  try {
    const st = typeof CHAT !== 'undefined' && CHAT.ch && CHAT.ch.presenceState && CHAT.ch.presenceState();
    if (!st) return out;
    for (const k of Object.keys(st)) {
      for (const p of st[k] || []) if (p && p.name) out.add(p.name);
    }
  } catch (e) { /* bo qua */ }
  return out;
}

async function friendRefreshRows() {
  const list = friendsOf().slice(0, FRIEND_MAX);
  if (!list.length) return [];
  if (typeof netOn !== 'function' || !netOn() || !NET.user) {
    return list.map(f => ({ name: f.name, fac: '', lvl: 0, power: 0, offline: false, local: true }));
  }
  const names = list.map(f => f.name);
  let rows = [];
  try {
    const r = await netCall(sb => sb.from('chars').select('name,fac,lvl,reborn,power,updated').in('name', names));
    rows = r.data || [];
  } catch (e) { rows = []; }
  const by = Object.fromEntries(rows.map(x => [x.name, x]));
  const on = friendOnlineSet();
  return list.map(f => {
    const x = by[f.name];
    return x
      ? { name: x.name, fac: x.fac, lvl: x.lvl, reborn: x.reborn, power: x.power, online: on.has(x.name) }
      : { name: f.name, fac: '', lvl: 0, power: 0, online: on.has(f.name), missing: true };
  });
}

async function friendRequest(name) {
  name = friendNorm(name);
  if (!name) throw new Error('Nhập tên nhân vật');
  if (typeof netOn !== 'function' || !netOn() || !NET.user) throw new Error('Cần đăng nhập online');
  if (typeof hasRealName !== 'function' || !hasRealName()) throw new Error('Cần đặt tên nhân vật trước');
  if (name === S.name) throw new Error('Không thể kết bạn với chính mình');
  if (friendHas(name)) throw new Error('Đã là bạn');
  const found = await netListChars(name, 8);
  const hit = found.find(x => x.name === name) || (found.length === 1 ? found[0] : null);
  if (!hit) throw new Error('Không tìm thấy «' + name + '» trên xếp hạng');
  await netNeedChar();
  await netCall(sb => sb.from('mail').insert({
    to_name: hit.name, from_name: S.name, from_owner: NET.user.id,
    kind: 'friend', item: { __friend: 1, act: 'req', n: 'Lời mời kết bạn' }, gold: 0,
    note: (S.name || '') + ' muốn kết bạn'
  }));
  return hit;
}

async function friendAccept(fromName) {
  fromName = friendNorm(fromName);
  friendAddLocal(fromName);
  if (typeof netOn === 'function' && netOn() && NET.user && typeof hasRealName === 'function' && hasRealName()) {
    try {
      await netCall(sb => sb.from('mail').insert({
        to_name: fromName, from_name: S.name, from_owner: NET.user.id,
        kind: 'friend', item: { __friend: 1, act: 'ok', n: 'Đã chấp nhận kết bạn' }, gold: 0,
        note: (S.name || '') + ' đã chấp nhận kết bạn'
      }));
    } catch (e) { /* van ket ban 1 chieu */ }
  }
  return fromName;
}

/** Xu ly thu ket ban trong netClaim — tra ve chuoi phan thuong / null neu khong phai. */
function friendClaimItem(it, fromName) {
  if (!it || !it.__friend) return null;
  const act = it.act || 'req';
  if (act === 'ok') {
    friendAddLocal(fromName);
    return 'Kết bạn với ' + fromName;
  }
  // req: chi ghi nhan — UI Thu se co nut Chap nhan; neu nhan nhanh thi tu chap nhan
  friendAddLocal(fromName);
  if (typeof netOn === 'function' && netOn() && NET.user) {
    netCall(sb => sb.from('mail').insert({
      to_name: fromName, from_name: S.name, from_owner: NET.user.id,
      kind: 'friend', item: { __friend: 1, act: 'ok', n: 'Đã chấp nhận kết bạn' }, gold: 0,
      note: (S.name || '') + ' đã chấp nhận kết bạn'
    })).catch(() => {});
  }
  return 'Kết bạn với ' + fromName;
}

/** Modal ban be (online = tab net; offline = danh sach cuc bo). */
function friendsModal() {
  if (typeof netOn === 'function' && netOn()) return netModal('friends');
  modal(`<h3>👥 Bạn bè</h3><div id="frBody"><p class="dim small">Đang tải…</p></div>`, () => {});
  const el = $('#frBody'); if (el) netFriendsBody(el);
}

async function netFriendsBody(el) {
  const needLogin = typeof netOn === 'function' && netOn() && !NET.user;
  if (needLogin) {
    el.innerHTML = `<p class="dim small">Đăng nhập để kết bạn online (gửi lời mời / xem cấp lực).</p>
      <div class="btnrow"><button class="btn" id="frAcc">Đăng nhập</button></div>`;
    $('#frAcc').onclick = () => netModal('acc');
    return;
  }
  let rows = [];
  try { rows = await friendRefreshRows(); } catch (e) { rows = friendsOf().map(f => ({ name: f.name, local: true })); }
  const onN = rows.filter(r => r.online).length;
  el.innerHTML = `<div class="card"><b>👥 Bạn bè</b> <small class="dim">${rows.length}/${FRIEND_MAX}${onN ? ` · ${onN} online` : ''}</small>
      <p class="desc small dim">Thêm bạn từ xếp hạng / trang nhân vật, hoặc gõ tên rồi mời. Lời mời gửi qua Thư.</p>
      <div class="row" style="flex-wrap:wrap;gap:.35em">
        <input id="frQ" maxlength="14" placeholder="Tên nhân vật" style="width:9em">
        <button class="btn sm" id="frFind">Danh sách</button>
        <button class="btn sm" id="frAdd">Mời kết bạn</button>
        <button class="btn sm" id="frAddLocal" title="Lưu tên vào danh sách (không gửi thư)">Thêm nhanh</button>
      </div>
      <div id="frPick" class="adpick" hidden></div>
      <div class="frlist">${rows.map(r => {
    const fac = r.fac && FAC[r.fac] ? FAC[r.fac].n : (r.missing ? 'chưa xếp hạng' : '—');
    const st = r.online ? '<span class="fron">● online</span>' : (r.missing ? '<span class="dim">?</span>' : '<span class="dim">offline</span>');
    return `<div class="frrow"><span><b class="frname" data-pn="${esc(r.name)}">${esc(r.name)}</b>
        <small class="dim">Lv${r.lvl || '?'} · ${esc(fac)}${r.power ? ' · ' + fmt(r.power) : ''}</small> ${st}</span>
        <span class="btnrow">
          <button class="btn sm" data-fchat="${esc(r.name)}">Chat</button>
          <button class="btn sm" data-fmail="${esc(r.name)}">Thư</button>
          <button class="btn sm red" data-frm="${esc(r.name)}">Xóa</button>
        </span></div>`;
  }).join('') || '<p class="dim small">Chưa có bạn. Bấm <b>Danh sách</b> chọn người chơi hoặc <b>Mời kết bạn</b>.</p>'}</div>
    </div>`;

  const openPick = async (q) => {
    const box = $('#frPick'); if (!box) return;
    box.hidden = false; box.innerHTML = '<p class="dim small">Đang tải…</p>';
    try {
      const list = await netListChars(q, 80);
      if (!list.length) { box.innerHTML = '<p class="dim small">Không có ai khớp.</p>'; return; }
      box.innerHTML = `<div class="adpick-h">Chọn người chơi <button class="btn sm" id="frPickX">Đóng</button></div>
        <div class="adpick-list">${list.map(x => `<button type="button" class="adpick-i" data-fn="${esc(x.name)}"><b>${esc(x.name)}</b>
          <small>Lv${x.lvl}${x.reborn ? ' CS' + x.reborn : ''} · ${esc(facName(x.fac))} · ${fmt(x.power || 0)}</small></button>`).join('')}</div>`;
      $('#frPickX').onclick = () => { box.hidden = true; box.innerHTML = ''; };
      box.querySelectorAll('[data-fn]').forEach(b => b.onclick = () => {
        $('#frQ').value = b.dataset.fn;
        box.hidden = true;
        toast('Đã chọn «' + b.dataset.fn + '» — bấm Mời kết bạn hoặc Thêm nhanh');
      });
    } catch (e) { box.innerHTML = `<p class="reqbad">${esc(e.message || e)}</p>`; }
  };

  $('#frFind').onclick = () => openPick(($('#frQ') && $('#frQ').value) || '');
  $('#frAdd').onclick = () => busy($('#frAdd'), () => friendRequest($('#frQ').value), ch => {
    toast('Đã gửi lời mời tới «' + ch.name + '»');
    netModal('friends');
  });
  $('#frAddLocal').onclick = () => {
    try {
      const r = friendAddLocal($('#frQ').value);
      toast(r.already ? 'Đã có trong danh sách' : 'Đã thêm «' + r.name + '»');
      netModal('friends');
    } catch (e) { toast(e.message || String(e)); }
  };
  el.querySelectorAll('[data-pn]').forEach(a => a.onclick = ev => {
    ev.preventDefault();
    if (typeof profileModal === 'function') profileModal(a.dataset.pn, () => netModal('friends'));
  });
  el.querySelectorAll('[data-fchat]').forEach(b => b.onclick = () => {
    closeModal(true);
    if (typeof chatOpenFriend === 'function') chatOpenFriend(b.dataset.fchat);
    else toast('Chat chưa sẵn sàng');
  });
  el.querySelectorAll('[data-fmail]').forEach(b => b.onclick = () => { NET.mailTo = b.dataset.fmail; netModal('mail'); });
  el.querySelectorAll('[data-frm]').forEach(b => b.onclick = () => {
    friendRemove(b.dataset.frm); toast('Đã xóa bạn'); netModal('friends');
  });
}
