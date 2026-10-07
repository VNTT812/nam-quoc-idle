/* ======================= SAN DAU PK (thoi Tran) =======================
   Ban do rieng id 403 — KHONG nam trong ZONES (khong hien o luyen cong).
   Moi PK: A moi B, B dong y (hoac doi ben moi nhau) → ca hai dich chuyen vao san,
   danh PK; het tran (thang/thua/hoa) → ve cho dung cu. */
'use strict';

const PK_ARENA = {
  id: 403,
  n: 'Sàn Đấu · Đình Trần',
  bg: 'img/z/403.jpg?v=336',
  music: 400,
  limit: 180,
  // Gan nhau de melee/tam xa danh duoc ngay (truoc ~620px → khong cham duoc)
  spawnA: [1720, 1780],
  spawnB: [1880, 1780]
};
const PKA = { pending: {}, inbox: null, lastInvite: 0 };

const pkArenaOn = () => !!(R && R.pkArena);
const pkArenaBusy = () => !!(R && (R.pkArena || R.dg || R.tower || R.deadT > 0));

function pkArenaRoomId(a, b) {
  const pair = [String(a || ''), String(b || '')].map(s => s.trim()).filter(Boolean).sort();
  if (pair.length < 2) return '';
  return 'pk_' + pair[0] + '_' + pair[1];
}

function pkArenaSaveReturn() {
  const zi = typeof zoneIdx === 'function' ? zoneIdx() : -1;
  return {
    stage: S.stage | 0,
    zi,
    zalt: (zi >= 0 && S.zalt) ? S.zalt[zi] : null,
    x: H.x, y: H.y,
    town: !!R.town
  };
}

function pkArenaRestore(ret) {
  if (!ret) {
    if (typeof onZoneChange === 'function') onZoneChange(zoneOf(Math.min(S.stage, STAGES)));
    return;
  }
  if (ret.town && typeof goTown === 'function') {
    goTown();
    return;
  }
  S.stage = clamp(ret.stage | 0, 1, STAGES);
  if (ret.zi >= 0 && S.zalt && ret.zalt != null) S.zalt[ret.zi] = ret.zalt;
  const z = zoneOf(Math.min(S.stage, STAGES));
  if (typeof onZoneChange === 'function') onZoneChange(z);
  [H.x, H.y] = inWorld(ret.x, ret.y);
  if (typeof snapCamera === 'function') snapCamera();
}

async function pkArenaSend(to, act, extra) {
  to = String(to || '').trim();
  if (!to || !S || !hasRealName()) return false;
  const room = (extra && extra.room) || pkArenaRoomId(S.name, to);
  const item = Object.assign({ __duel: 1, act, room, n: 'Mời PK sàn đấu' }, extra || {});
  const row = {
    from_name: S.name, to_name: to, cid: typeof chatCid === 'function' ? chatCid() : '',
    fac: FAC[S.fac] ? FAC[S.fac].n : '', lvl: S.lvl | 0,
    msg: act === 'req' ? '⚔️ Mời PK sàn đấu — đồng ý để vào' : act === 'ok' ? '⚔️ Đồng ý PK' : act === 'no' ? '⚔️ Từ chối PK' : act === 'end' ? '⚔️ Kết thúc sàn đấu' : '⚔️ PK',
    item
  };
  if (typeof window.__testPkDuelSend === 'function') {
    await window.__testPkDuelSend(row);
    return true;
  }
  const sb = (typeof CHAT !== 'undefined' && CHAT.sb) || (typeof NET !== 'undefined' && NET.sb);
  if (!sb) { toast('Cần đăng nhập / chat để mời PK'); return false; }
  try {
    const { error } = await sb.from('fchat').insert(row);
    if (error) {
      if (/relation .*fchat|Could not find the table/i.test(error.message || '')) {
        toast('Chạy sql/FRIEND_CHAT.sql trên Supabase rồi F5');
      } else toast('Gửi lời mời PK lỗi: ' + (error.message || ''));
      return false;
    }
    return true;
  } catch (e) {
    toast('Gửi lời mời PK lỗi');
    return false;
  }
}

function pkArenaInvite(name) {
  name = String(name || '').trim();
  if (!name) return toast('Chọn người chơi');
  if (!S || !hasRealName()) return nameModal(() => pkArenaInvite(name));
  if (name === S.name) return toast('Không thể PK với chính mình');
  if (pkArenaBusy()) return toast('Đang bận (sàn đấu / phó bản / trọng thương)');
  if (Date.now() - PKA.lastInvite < 2500) return toast('Gửi chậm lại một chút');
  if (typeof friendHas === 'function' && !friendHas(name)) {
    toast('Chỉ mời PK người trong danh sách bạn');
    return;
  }
  const room = pkArenaRoomId(S.name, name);
  PKA.lastInvite = Date.now();
  PKA.pending[name] = { room, t: Date.now(), out: true };
  // Neu doi phuong da moi minh truoc → coi nhu ca hai dong y
  if (PKA.inbox && PKA.inbox.from === name && PKA.inbox.room === room) {
    pkArenaAccept(name, room);
    return;
  }
  pkArenaSend(name, 'req', { room }).then(ok => {
    if (!ok) { delete PKA.pending[name]; return; }
    toast('Đã mời «' + name + '» PK sàn đấu — chờ họ đồng ý');
    if (typeof log === 'function') log('⚔️ Đã mời <b>' + esc(name) + '</b> vào <b>Sàn Đấu</b>.');
  });
}

function pkArenaShowInvite(from, room) {
  PKA.inbox = { from, room, t: Date.now() };
  if (typeof log === 'function') log('⚔️ <b>' + esc(from) + '</b> mời bạn PK sàn đấu.');
  if (typeof modal !== 'function') {
    toast(from + ' mời PK — mở Bạn bè để đồng ý');
    return;
  }
  modal(`<h3>⚔️ Mời PK sàn đấu</h3>
    <p><b>${esc(from)}</b> mời bạn vào <b>${esc(PK_ARENA.n)}</b>.</p>
    <p class="dim small">Cả hai đồng ý sẽ dịch chuyển tới sàn đấu. Thắng/thua → về chỗ đứng cũ.</p>
    <div class="btnrow">
      <button class="btn" id="pkaOk">Đồng ý PK</button>
      <button class="btn red" id="pkaNo">Từ chối</button>
    </div>`, () => {});
  const ok = $('#pkaOk'), no = $('#pkaNo');
  if (ok) ok.onclick = () => { closeModal(true); pkArenaAccept(from, room); };
  if (no) no.onclick = () => { closeModal(true); pkArenaDecline(from, room); };
}

async function pkArenaAccept(from, room) {
  from = String(from || '').trim();
  room = room || pkArenaRoomId(S.name, from);
  if (pkArenaBusy() && !pkArenaOn()) return toast('Đang bận, không vào sàn đấu được');
  PKA.inbox = null;
  PKA.pending[from] = { room, t: Date.now(), out: false };
  await pkArenaSend(from, 'ok', { room });
  pkArenaEnter(room, from, false);
}

async function pkArenaDecline(from, room) {
  PKA.inbox = null;
  delete PKA.pending[from];
  await pkArenaSend(from, 'no', { room: room || pkArenaRoomId(S.name, from) });
  toast('Đã từ chối lời mời PK');
}

function pkArenaEnter(room, foe, asHost) {
  if (!room || !foe) return;
  if (R.pkArena && R.pkArena.room === room) return;
  if (R.town && typeof backFromTown === 'function') backFromTown();
  if (R.dg && typeof dgExit === 'function') {
    try { dgExit(); } catch (e) { R.dg = null; }
  }
  const ret = pkArenaSaveReturn();
  R.enemies = []; R.corpses = []; R.pickTarget = null; R.moveTo = null; R.spawnT = 1e9;
  R.field = null; R.deadT = 0; R.stall = 0;
  if (R.P) { R.life = R.P.life; R.mana = R.P.mana; }
  R.pkArena = {
    room, foe, ret, t: 0, limit: PK_ARENA.limit, ended: false,
    host: asHost != null ? !!asHost : (S.name < foe)
  };
  R.zoneShown = 'pk';
  if (typeof obsLoad === 'function') obsLoad(PK_ARENA.id);
  const [sx, sy] = R.pkArena.host ? PK_ARENA.spawnA : PK_ARENA.spawnB;
  [H.x, H.y] = inWorld(sx, sy);
  H.act = 'st'; H.actT = 0;
  if (typeof snapCamera === 'function') snapCamera();
  R.bgImg = typeof img === 'function' ? img(PK_ARENA.bg) : null;
  if (typeof playMusic === 'function') playMusic(PK_ARENA.music);
  if (typeof MP !== 'undefined') {
    MP.pk = true; MP.pkTarget = null;
    MP.roomOverride = 'map:pk:' + room;
    MP.peers = {}; // doi phong — bo peer map farm cu
  }
  // Supabase channel san dau
  if (typeof mpJoin === 'function') {
    try { mpJoin({ id: 'pk:' + room, n: PK_ARENA.n }); } catch (e) { /* bo qua */ }
  }
  // Auth WSS: join zone pk:room (mpaTick cung tu doi khi zone lech)
  if (typeof mpaClose === 'function') { try { mpaClose(); } catch (e) { /* bo qua */ } }
  if (typeof mpaJoin === 'function') {
    try { mpaJoin(); } catch (e) { /* bo qua */ }
  }
  // Auto danh trong san (PK) — nguoi choi van doi sang manual neu muon
  if (typeof S !== 'undefined') { S.ctrl = S.ctrl || 'auto'; }
  R.banner = { t: 2.8, text: PK_ARENA.n, sub: 'PK với ' + foe + ' · hạ đối thủ để thắng' };
  if (typeof log === 'function') log('⚔️ Vào <b>' + esc(PK_ARENA.n) + '</b> — đối thủ: <b>' + esc(foe) + '</b>.');
  if (typeof toast === 'function') toast('Sàn đấu: PK với ' + foe);
  if (typeof mpUi === 'function') mpUi();
  if (typeof mpPkEmitFlag === 'function') mpPkEmitFlag();
  // Khoa muc tieu peer khi thay mat
  setTimeout(() => {
    if (!pkArenaOn() || typeof MP === 'undefined') return;
    for (const p of Object.values(MP.peers || {})) {
      if (p && p.name === foe) { MP.pkTarget = p.cid; p.pk = true; break; }
    }
  }, 800);
}

function pkArenaExit(why) {
  if (!R.pkArena) return;
  const ret = R.pkArena.ret;
  const foe = R.pkArena.foe;
  R.pkArena = null;
  R.zoneShown = null;
  R.enemies = []; R.corpses = []; R.pickTarget = null; R.moveTo = null; R.deadT = 0;
  if (typeof MP !== 'undefined') {
    MP.roomOverride = null;
    MP.pk = false; MP.pkTarget = null;
    MP.peers = {};
  }
  if (typeof mpLeave === 'function') {
    try { mpLeave(); } catch (e) { /* bo qua */ }
  }
  if (typeof mpaClose === 'function') {
    try { mpaClose(); } catch (e) { /* bo qua */ }
  }
  pkArenaRestore(ret);
  if (R.P) { R.life = R.P.life; R.mana = R.P.mana; }
  H.act = 'st'; H.actT = 0;
  if (typeof toast === 'function') toast(why || 'Rời sàn đấu');
  if (typeof log === 'function') log('⚔️ Rời sàn đấu' + (why ? ': ' + esc(why) : '') + (foe ? ' (vs ' + esc(foe) + ')' : '') + '.');
  if (typeof mpUi === 'function') mpUi();
  // join lai map farm + auth zone farm
  if (typeof mpJoin === 'function' && typeof zoneOf === 'function') {
    try { mpJoin(zoneOf(Math.min(S.stage, STAGES))); } catch (e) { /* bo qua */ }
  }
  if (typeof mpaJoin === 'function') {
    try { mpaJoin(); } catch (e) { /* bo qua */ }
  }
}

function pkArenaFinish(win, reason) {
  if (!R.pkArena || R.pkArena.ended) return;
  R.pkArena.ended = true;
  const foe = R.pkArena.foe;
  const sub = win ? ('Thắng «' + foe + '»!') : (win === false ? ('Thua «' + foe + '»') : (reason || 'Hòa'));
  R.banner = { t: 2.4, text: win ? 'Chiến thắng!' : (win === false ? 'Thất bại' : 'Hết giờ'), sub };
  if (typeof uiSfx === 'function' && win) uiSfx('levelup');
  pkArenaSend(foe, 'end', { room: R.pkArena.room, win: win ? 1 : 0, reason: reason || '' }).catch(() => {});
  if (typeof MP !== 'undefined' && typeof mpSend === 'function') {
    try { mpSend('duelend', { room: R.pkArena.room, win: win ? 1 : 0, by: typeof mpCid === 'function' ? mpCid() : '' }); } catch (e) { /* bo qua */ }
  }
  setTimeout(() => pkArenaExit(sub), 1600);
}

function pkArenaOnFchat(m) {
  if (!m || !m.item || !m.item.__duel) return false;
  // Chi xu ly tin gui TOI minh (tranh self-echo / poll trung)
  if (m.to_name && S && S.name && m.to_name !== S.name) return true;
  const act = m.item.act, from = m.from_name, room = m.item.room || pkArenaRoomId(S.name, from);
  if (!from || from === S.name) return true;
  // Chong xu ly 2 lan cung id
  if (m.id != null) {
    if (!PKA.seen) PKA.seen = new Set();
    if (PKA.seen.has(m.id)) return true;
    PKA.seen.add(m.id);
    if (PKA.seen.size > 80) {
      const arr = [...PKA.seen];
      PKA.seen = new Set(arr.slice(-40));
    }
  }
  if (act === 'req') {
    if (pkArenaOn()) return true;
    // Da gui moi nguoc lai → ca hai dong y
    if (PKA.pending[from] && PKA.pending[from].out) {
      pkArenaAccept(from, room);
      return true;
    }
    pkArenaShowInvite(from, room);
    return true;
  }
  if (act === 'ok') {
    // Nguoi moi nhan OK → vao san (host spawn A)
    if (PKA.pending[from] || (pkArenaRoomId(S.name, from) === room)) {
      delete PKA.pending[from];
      if (!pkArenaOn()) pkArenaEnter(room, from, true);
    }
    return true;
  }
  if (act === 'no') {
    delete PKA.pending[from];
    if (PKA.inbox && PKA.inbox.from === from) PKA.inbox = null;
    toast(from + ' từ chối lời mời PK');
    return true;
  }
  if (act === 'end' && pkArenaOn()) {
    if (room && R.pkArena.room && room !== R.pkArena.room) return true;
    if (!R.pkArena.ended) {
      // win=1 tu doi thu nghia la HO bi thua (ho thang)
      const theyWin = m.item.win === 1 || m.item.win === true;
      pkArenaFinish(theyWin ? false : (m.item.win === 0 ? true : null), m.item.reason || 'Kết thúc trận');
    }
    return true;
  }
  return true;
}

function pkArenaTick(dt) {
  const g = R.pkArena; if (!g || g.ended) return;
  g.t = (g.t || 0) + dt;
  if (g.t >= g.limit) pkArenaFinish(null, 'Hết giờ — hòa');
}

function pkArenaHud() {
  if (!pkArenaOn()) return '';
  const g = R.pkArena, left = Math.max(0, Math.ceil(g.limit - (g.t || 0)));
  return `<div id="pkaHud"><b>⚔️ ${esc(PK_ARENA.n)}</b> · vs ${esc(g.foe)} · ${left}s
    <button type="button" class="btn sm red" id="pkaFlee">Bỏ cuộc</button></div>`;
}

function pkArenaEnsureHud() {
  let el = $('#pkaHud');
  if (!pkArenaOn()) { if (el) el.remove(); return; }
  const g = R.pkArena, left = Math.max(0, Math.ceil(g.limit - (g.t || 0)));
  if (!el) {
    el = document.createElement('div');
    el.id = 'pkaHud';
    const battle = $('#battle'); if (battle) battle.appendChild(el);
  }
  el.innerHTML = `<b>⚔️ ${esc(PK_ARENA.n)}</b> · vs ${esc(g.foe)} · ${left}s
    <button type="button" class="btn sm red" id="pkaFlee">Bỏ cuộc</button>`;
  const b = $('#pkaFlee');
  if (b) b.onclick = () => {
    if (!pkArenaOn() || R.pkArena.ended) return;
    pkArenaFinish(false, 'Bỏ cuộc');
  };
}

function pkArenaHook() {
  if (pkArenaHook._ok) return;
  pkArenaHook._ok = true;
  // fchat
  if (typeof fchatPush === 'function' && !fchatPush._pka) {
    const _fp = fchatPush;
    fchatPush = function (m) {
      try { if (m && m.item && m.item.__duel) pkArenaOnFchat(m); } catch (e) { /* bo qua */ }
      return _fp.apply(this, arguments);
    };
    fchatPush._pka = true;
  }
  // ket thuc khi ha / bi ha trong san
  if (typeof mpOnPkKill === 'function' && !mpOnPkKill._pka) {
    const _k = mpOnPkKill;
    mpOnPkKill = function (p) {
      _k.apply(this, arguments);
      if (!pkArenaOn() || !p) return;
      if (p.by === (typeof mpCid === 'function' ? mpCid() : '') && p.victim !== p.by) pkArenaFinish(true, 'Hạ đối thủ');
    };
    mpOnPkKill._pka = true;
  }
  if (typeof mpOnPkHit === 'function' && !mpOnPkHit._pka) {
    const _h = mpOnPkHit;
    mpOnPkHit = function (p) {
      _h.apply(this, arguments);
      if (!pkArenaOn() || !p) return;
      if (R.life <= 0 && !R.pkArena.ended) pkArenaFinish(false, 'Bị hạ');
    };
    mpOnPkHit._pka = true;
  }
  // mp duelend broadcast
  if (typeof mpJoin === 'function' && !mpJoin._pkaEnd) {
    /* listeners attached in mpPk / mp — also poll via document */
  }
  document.addEventListener('mp:duelend', ev => {
    if (!pkArenaOn() || R.pkArena.ended) return;
    const p = ev.detail || {};
    if (p.room && R.pkArena.room && p.room !== R.pkArena.room) return;
    pkArenaFinish(p.by === (typeof mpCid === 'function' ? mpCid() : '') ? true : false, 'Kết thúc');
  });
}

function pkArenaInit() {
  pkArenaHook();
  setInterval(() => { if (pkArenaOn()) pkArenaEnsureHud(); }, 400);
}

if (typeof window !== 'undefined') {
  window.pkArenaInvite = pkArenaInvite;
  window.pkArenaOn = pkArenaOn;
  window.pkArenaEnter = pkArenaEnter;
  window.pkArenaExit = pkArenaExit;
  window.pkArenaTick = pkArenaTick;
  window.pkArenaInit = pkArenaInit;
  window.PK_ARENA = PK_ARENA;
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(pkArenaInit, 0));
  else setTimeout(pkArenaInit, 0);
}
