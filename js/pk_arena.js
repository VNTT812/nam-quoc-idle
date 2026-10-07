/* ======================= SAN DAU PK (thoi Tran) =======================
   Ban do rieng id 403 — KHONG nam trong ZONES (khong hien o luyen cong).
   Moi PK: A moi B, B dong y (hoac doi ben moi nhau) → ca hai dich chuyen vao san,
   danh PK; het tran (thang/thua/hoa) → ve cho dung cu. */
'use strict';

const PK_ARENA = {
  id: 403,
  n: 'Sàn Đấu · Đình Trần',
  bg: 'img/z/403.jpg?v=345',
  music: 400,
  limit: 180,
  // Plaza giua san (obs 403 rebuild v345)
  spawnA: [1480, 1780],
  spawnB: [2100, 1780]
};
const PKA = { pending: {}, inbox: null, lastInvite: 0, seen: null, cool: {}, done: null, lastEnter: 0, lastExitFoe: '', lastExitT: 0 };
const PKA_SS_COOL = 'pka_cool_v1';
const PKA_SS_DONE = 'pka_done_v1';
const PKA_FOE_COOL_MS = 90000;
const PKA_MATCH_COOL_MS = 90000;

const pkArenaOn = () => !!(R && R.pkArena);
const pkArenaBusy = () => !!(R && (R.pkArena || R.dg || R.tower || R.deadT > 0));

function pkArenaSsLoad() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const cool = JSON.parse(sessionStorage.getItem(PKA_SS_COOL) || '{}');
    const now = Date.now();
    for (const k of Object.keys(cool || {})) {
      if ((cool[k] | 0) > now) PKA.cool[k] = cool[k] | 0;
    }
    const done = JSON.parse(sessionStorage.getItem(PKA_SS_DONE) || '[]');
    PKA.done = new Set(Array.isArray(done) ? done.slice(-60) : []);
  } catch (e) {
    if (!PKA.done) PKA.done = new Set();
  }
}
function pkArenaSsSave() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const now = Date.now();
    const cool = {};
    for (const k of Object.keys(PKA.cool || {})) {
      if ((PKA.cool[k] | 0) > now) cool[k] = PKA.cool[k] | 0;
    }
    sessionStorage.setItem(PKA_SS_COOL, JSON.stringify(cool));
    sessionStorage.setItem(PKA_SS_DONE, JSON.stringify([...(PKA.done || [])].slice(-60)));
  } catch (e) { /* bo qua */ }
}

/** Room co nonce (moi tran) — bo qua pk_A_B legacy (ten acc khong co so). */
function pkArenaHasNonce(room) {
  const r = String(room || '').trim();
  if (!/^pk_/i.test(r)) return false;
  const tail = r.split('_').pop() || '';
  return tail.length >= 6 && /[0-9]/.test(tail);
}
function pkArenaMergeRoom(a, b) {
  a = String(a || '').trim(); b = String(b || '').trim();
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}
function pkArenaRoomTrusted(room, pendRoom) {
  room = String(room || '').trim();
  if (!room) return false;
  if (pendRoom && room === pendRoom) return true;
  return pkArenaHasNonce(room);
}
function pkArenaPairCoolKey(a, b) {
  const k = pkArenaPairKey(a, b);
  return k ? ('pair:' + k) : '';
}

/** Sau tran / roi san: chan req/ok cung room + foe + cap doi legacy (sessionStorage). */
function pkArenaCoolSet(room, foe, ms) {
  const until = Date.now() + (ms || PKA_MATCH_COOL_MS);
  if (room) {
    PKA.cool[room] = until;
    if (!PKA.done) PKA.done = new Set();
    PKA.done.add(String(room));
  }
  if (foe) {
    PKA.cool['foe:' + foe] = until;
    PKA.lastExitFoe = foe;
    PKA.lastExitT = Date.now();
  }
  if (foe && S && S.name) {
    const pk = pkArenaPairCoolKey(S.name, foe);
    if (pk) {
      PKA.cool[pk] = until;
      if (!PKA.done) PKA.done = new Set();
      PKA.done.add(pk.replace('pair:', ''));
    }
  }
  pkArenaSsSave();
}
function pkArenaRoomDone(room) {
  return !!(room && PKA.done && PKA.done.has(String(room)));
}
function pkArenaCooling(room, foe) {
  const now = Date.now();
  if (room && PKA.cool[room] && PKA.cool[room] > now) return true;
  if (room && pkArenaRoomDone(room)) return true;
  if (foe && PKA.cool['foe:' + foe] && PKA.cool['foe:' + foe] > now) return true;
  if (foe && S && S.name) {
    const pk = pkArenaPairCoolKey(S.name, foe);
    if (pk && PKA.cool[pk] && PKA.cool[pk] > now) return true;
    const pair = pk.replace('pair:', '');
    if (pair && pkArenaRoomDone(pair)) return true;
  }
  if (foe && PKA.lastExitFoe === foe && now - (PKA.lastExitT || 0) < PKA_FOE_COOL_MS) return true;
  return false;
}
function pkArenaHudRemove() {
  try {
    document.querySelectorAll('#pkaHud').forEach(el => el.remove());
  } catch (e) { /* bo qua */ }
}
function pkArenaClearWait(foe) {
  if (foe) delete PKA.pending[foe];
  if (PKA.inbox && (!foe || PKA.inbox.from === foe)) PKA.inbox = null;
  // Het cho → dung kick-poll
  if (!Object.keys(PKA.pending || {}).length && !PKA.inbox && PKA.pollT) {
    clearInterval(PKA.pollT); PKA.pollT = null;
  }
}
function pkArenaMarkSeen(m) {
  if (m == null || m.id == null) return false;
  if (!PKA.seen) PKA.seen = new Set();
  const id = String(m.id);
  if (PKA.seen.has(id)) return true;
  PKA.seen.add(id);
  if (PKA.seen.size > 120) {
    const arr = [...PKA.seen];
    PKA.seen = new Set(arr.slice(-60));
  }
  return false;
}

/** Khoa cap doi (legacy / cool foe). Moi tran dung pkArenaNewRoom — nonce rieng. */
function pkArenaPairKey(a, b) {
  const pair = [String(a || ''), String(b || '')].map(s => s.trim()).filter(Boolean).sort();
  if (pair.length < 2) return '';
  return 'pk_' + pair[0] + '_' + pair[1];
}
function pkArenaRoomId(a, b) {
  return pkArenaPairKey(a, b);
}
/** Room id 1 lan / tran — tranh fchat ok/req cu cung pk_A_B keo vao lai. */
function pkArenaNewRoom(a, b) {
  const base = pkArenaPairKey(a, b) || ('pk_' + String(a || 'x').trim());
  const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  return base + '_' + nonce;
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

async function pkArenaSb() {
  let sb = (typeof CHAT !== 'undefined' && CHAT.sb) || (typeof NET !== 'undefined' && NET.sb);
  if (!sb && typeof netClient === 'function') {
    try {
      sb = await netClient();
      if (typeof CHAT !== 'undefined' && sb) CHAT.sb = sb;
      if (typeof NET !== 'undefined' && sb) NET.sb = sb;
    } catch (e) { /* bo qua */ }
  }
  return sb || null;
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
  const sb = await pkArenaSb();
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

/** Poll fchat riêng cho duel — chỉ khi đang chờ mời/OK (không poll khi đã trong sàn / cooldown). */
async function pkArenaPollInbox() {
  if (!S || !hasRealName()) return;
  if (pkArenaOn()) return;
  const waiting = Object.keys(PKA.pending || {}).length || PKA.inbox;
  if (!waiting) return;
  const sb = await pkArenaSb();
  if (!sb) return;
  try {
    const since = new Date(Date.now() - 90 * 1000).toISOString();
    const { data, error } = await sb.from('fchat').select('*')
      .eq('to_name', S.name).gte('ts', since).order('id', { ascending: true }).limit(20);
    if (error || !data) return;
    for (const m of data) {
      if (m && m.item && m.item.__duel) {
        try { pkArenaOnFchat(m); } catch (e) { /* bo qua */ }
      }
    }
  } catch (e) { /* bo qua */ }
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
  if (pkArenaCooling(null, name)) return toast('Vừa xong trận với «' + name + '» — chờ chút rồi mời lại');
  // Doi thu da moi minh → dong y room cua ho (khong tao room moi)
  if (PKA.inbox && PKA.inbox.from === name && PKA.inbox.room) {
    PKA.lastInvite = Date.now();
    pkArenaAccept(name, PKA.inbox.room);
    return;
  }
  const room = pkArenaNewRoom(S.name, name);
  PKA.lastInvite = Date.now();
  PKA.pending[name] = { room, t: Date.now(), out: true };
  // Async: init chat neu can, roi gui moi
  (async () => {
    try {
      await pkArenaSb();
      if (typeof chatInit === 'function' && (!CHAT || !CHAT.sb || CHAT.state === 'off' || CHAT.state === 'err')) {
        await Promise.race([
          chatInit(),
          new Promise(r => setTimeout(r, 4000))
        ]);
      } else if (typeof chatSub === 'function' && CHAT && CHAT.sb && !CHAT.subOk) {
        chatSub();
      }
    } catch (e) { /* bo qua */ }
    const ok = await pkArenaSend(name, 'req', { room });
    if (!ok) { delete PKA.pending[name]; return; }
    toast('Đã mời «' + name + '» PK sàn đấu — chờ họ đồng ý');
    if (typeof log === 'function') log('⚔️ Đã mời <b>' + esc(name) + '</b> vào <b>Sàn Đấu</b>.');
    pkArenaKickPoll();
  })();
}

function pkArenaKickPoll() {
  try { pkArenaPollInbox(); } catch (e) { /* bo qua */ }
  if (typeof chatPoll === 'function') {
    try { chatPoll(true); } catch (e) { /* bo qua */ }
  }
  if (PKA.pollT) { clearInterval(PKA.pollT); PKA.pollT = null; }
  let n = 0;
  PKA.pollT = setInterval(() => {
    n++;
    const waiting = Object.keys(PKA.pending || {}).length || PKA.inbox;
    if (!waiting || n > 24) { clearInterval(PKA.pollT); PKA.pollT = null; return; }
    try { pkArenaPollInbox(); } catch (e) { /* bo qua */ }
    try { if (typeof chatPoll === 'function') chatPoll(true); } catch (e) { /* bo qua */ }
  }, 1200);
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
  if (pkArenaOn()) return;
  if (pkArenaCooling(room, from)) return toast('Vừa xong trận — chờ giây lát rồi mời lại');
  if (pkArenaBusy()) return toast('Đang bận, không vào sàn đấu được');
  try { await pkArenaSb(); } catch (e) { /* bo qua */ }
  // Clear wait TRUOC enter — khong de pending treo → poll vao lai
  pkArenaClearWait(from);
  PKA.inbox = null;
  // Nguoi dong y = guest (spawn B); nguoi moi = host khi nhan ok
  pkArenaEnter(room, from, false);
  const okSent = await pkArenaSend(from, 'ok', { room });
  if (!okSent) toast('Đã vào sàn — gửi đồng ý lỗi, đối thủ có thể cần mời lại');
}

async function pkArenaDecline(from, room) {
  pkArenaClearWait(from);
  PKA.inbox = null;
  await pkArenaSend(from, 'no', { room: room || pkArenaRoomId(S.name, from) });
  toast('Đã từ chối lời mời PK');
}

function pkArenaEnter(room, foe, asHost) {
  if (!room || !foe) return;
  room = String(room).trim();
  if (!pkArenaRoomTrusted(room)) return;
  if (R.pkArena && R.pkArena.room === room) return;
  if (R.pkArena && R.pkArena.room !== room) {
    pkArenaExit('Chuyển trận', R.pkArena.room);
  }
  // Room da ket thuc / cool → khong vao lai (ke ca sau F5)
  if (!pkArenaOn() && (pkArenaRoomDone(room) || pkArenaCooling(room, foe))) return;
  // Chong double-enter spam (<2s)
  if (Date.now() - (PKA.lastEnter || 0) < 2000 && R.pkArena) return;
  PKA.lastEnter = Date.now();
  // Dong modal moi / welcome neu dang che
  try { if (typeof closeModal === 'function') closeModal(true); } catch (e) { /* bo qua */ }
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
  // Het cho moi — dung poll; pending treo la nguyen nhan loop
  pkArenaClearWait(foe);
  PKA.pending = {};
  PKA.inbox = null;
  if (PKA.pollT) { clearInterval(PKA.pollT); PKA.pollT = null; }
  if (typeof obsLoad === 'function') obsLoad(PK_ARENA.id);
  const [sx, sy] = R.pkArena.host ? PK_ARENA.spawnA : PK_ARENA.spawnB;
  // Dat spawn truc tiep — plaza da walkable; tranh obsSnap keo xa
  if (typeof obsWalk === 'function' && obsWalk(sx, sy)) {
    H.x = sx; H.y = sy;
  } else {
    [H.x, H.y] = typeof inWorld === 'function' ? inWorld(sx, sy) : [sx, sy];
  }
  H.act = 'st'; H.actT = 0;
  R.moveTo = null; R.pickTarget = null;
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

function pkArenaExit(why, onlyRoom) {
  if (!R.pkArena) return;
  // Chi exit dung room (tran moi khong bi timeout finish cu keo ra)
  if (onlyRoom && R.pkArena.room && R.pkArena.room !== onlyRoom) return;
  const ret = R.pkArena.ret;
  const foe = R.pkArena.foe;
  const room = R.pkArena.room;
  R.pkArena = null;
  R.zoneShown = null;
  R.enemies = []; R.corpses = []; R.pickTarget = null; R.moveTo = null; R.deadT = 0;
  pkArenaHudRemove();
  // Chan re-enter tu ok/req cu trong fchat (+ sessionStorage)
  pkArenaCoolSet(room, foe, 45000);
  pkArenaClearWait(foe);
  PKA.pending = {};
  PKA.inbox = null;
  if (PKA.pollT) { clearInterval(PKA.pollT); PKA.pollT = null; }
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
  R.pkArena._exitWait = 0;
  const foe = R.pkArena.foe;
  const room = R.pkArena.room;
  const sub = win ? ('Thắng «' + foe + '»!') : (win === false ? ('Thua «' + foe + '»') : (reason || 'Hòa'));
  R.pkArena._exitWhy = reason || sub;
  // Cool ngay khi ket thuc — tranh ok/req poll trong 1.6s truoc exit
  pkArenaCoolSet(room, foe, PKA_MATCH_COOL_MS);
  pkArenaClearWait(foe);
  PKA.pending = {};
  PKA.inbox = null;
  if (PKA.pollT) { clearInterval(PKA.pollT); PKA.pollT = null; }
  R.banner = { t: 2.4, text: win ? 'Chiến thắng!' : (win === false ? 'Thất bại' : 'Hết giờ'), sub };
  if (typeof uiSfx === 'function' && win) uiSfx('levelup');
  pkArenaSend(foe, 'end', { room, win: win ? 1 : 0, reason: reason || '' }).catch(() => {});
  if (typeof MP !== 'undefined' && typeof mpSend === 'function') {
    try { mpSend('duelend', { room, win: win ? 1 : 0, by: typeof mpCid === 'function' ? mpCid() : '' }); } catch (e) { /* bo qua */ }
  }
  // Chi exit dung room nay — tranh race neu (hiếm) vao tran moi trong 1.6s
  setTimeout(() => pkArenaExit(sub, room), 1600);
}

/** Bo cuoc: thoat NGAY (khong cho HUD treo 1.6s / ended khoa nut). */
function pkArenaFlee() {
  if (!pkArenaOn()) { pkArenaHudRemove(); return; }
  const g = R.pkArena;
  const foe = g.foe, room = g.room;
  if (!g.ended) {
    g.ended = true;
    pkArenaCoolSet(room, foe, PKA_MATCH_COOL_MS);
    pkArenaClearWait(foe);
    PKA.pending = {};
    PKA.inbox = null;
    if (PKA.pollT) { clearInterval(PKA.pollT); PKA.pollT = null; }
    pkArenaSend(foe, 'end', { room, win: 0, reason: 'Bỏ cuộc' }).catch(() => {});
    if (typeof MP !== 'undefined' && typeof mpSend === 'function') {
      try { mpSend('duelend', { room, win: 0, by: typeof mpCid === 'function' ? mpCid() : '' }); } catch (e) { /* bo qua */ }
    }
  }
  pkArenaExit('Bỏ cuộc', room);
}

function pkArenaOnFchat(m) {
  if (!m || !m.item || !m.item.__duel) return false;
  // Chi xu ly tin gui TOI minh (tranh self-echo / poll trung)
  if (m.to_name && S && S.name && m.to_name !== S.name) return true;
  const act = m.item.act, from = m.from_name;
  const rawRoom = m.item.room || '';
  const pendEarly = PKA.pending[from];
  const room = String(rawRoom || (pendEarly && pendEarly.room) || '').trim();
  if (!from || from === S.name) return true;
  // Chong xu ly 2 lan cung id (string hoa so)
  if (pkArenaMarkSeen(m)) return true;
  const age = m.ts ? (Date.now() - +new Date(m.ts)) : 0;
  if (act === 'req') {
    if (pkArenaOn()) return true;
    if (pkArenaCooling(room, from) || pkArenaRoomDone(room)) return true;
    if (!pkArenaRoomTrusted(room, pendEarly && pendEarly.room)) return true;
    // Bo loi moi cu (>90s)
    if (age > 90000) return true;
    // Da gui moi nguoc lai (con pending.out tuoi) → dong y theo room MINH da tao (tranh 2 room lech)
    const pend = PKA.pending[from];
    if (pend && pend.out && (Date.now() - (pend.t || 0) < 90000)) {
      pkArenaAccept(from, pkArenaMergeRoom(pend.room, room));
      return true;
    }
    // Da co inbox cung nguoi+room → khong mo modal lan nua
    if (PKA.inbox && PKA.inbox.from === from && PKA.inbox.room === room) return true;
    pkArenaShowInvite(from, room);
    return true;
  }
  if (act === 'ok') {
    if (pkArenaOn()) { pkArenaClearWait(from); return true; }
    if (pkArenaCooling(room, from) || pkArenaRoomDone(room)) { pkArenaClearWait(from); return true; }
    if (age > 90000) { pkArenaClearWait(from); return true; }
    if (!pkArenaRoomTrusted(room)) { pkArenaClearWait(from); return true; }
    // CHI vao san khi MINH dang cho OK dung room nay — ok cu / room khac bi bo
    const pend = PKA.pending[from];
    if (pend && pend.out && pend.room === room) {
      pkArenaClearWait(from);
      pkArenaEnter(room, from, true);
    } else {
      // ok khong khop pending → bo, tranh treo poll
      pkArenaClearWait(from);
    }
    return true;
  }
  if (act === 'no') {
    pkArenaClearWait(from);
    toast(from + ' từ chối lời mời PK');
    return true;
  }
  if (act === 'end') {
    if (!pkArenaOn()) return true;
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
  const g = R.pkArena; if (!g) return;
  if (g.ended) {
    g._exitWait = (g._exitWait || 0) + dt;
    if (g._exitWait > 2.2) pkArenaExit(g._exitWhy || 'Hết trận', g.room);
    return;
  }
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
  if (!pkArenaOn()) { pkArenaHudRemove(); return; }
  let el = $('#pkaHud');
  const g = R.pkArena, left = Math.max(0, Math.ceil(g.limit - (g.t || 0)));
  if (!el) {
    el = document.createElement('div');
    el.id = 'pkaHud';
    const battle = $('#battle'); if (battle) battle.appendChild(el);
  }
  el.innerHTML = `<b>⚔️ ${esc(PK_ARENA.n)}</b> · vs ${esc(g.foe)} · ${left}s
    <button type="button" class="btn sm red" id="pkaFlee">Bỏ cuộc</button>`;
  const b = $('#pkaFlee');
  if (b) b.onclick = () => { pkArenaFlee(); };
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
  pkArenaSsLoad();
  pkArenaHook();
  if (!pkArenaInit._fleeCap) {
    document.addEventListener('click', ev => {
      const t = ev.target && ev.target.closest && ev.target.closest('#pkaFlee, [data-pka-flee]');
      if (!t) return;
      ev.preventDefault();
      ev.stopPropagation();
      pkArenaFlee();
    }, true);
    pkArenaInit._fleeCap = true;
  }
  setInterval(() => { pkArenaEnsureHud(); }, 400);
  // Chi poll khi dang CHO moi/OK — khong poll trong san / sau tran
  setInterval(() => {
    if (pkArenaOn()) return;
    const keys = Object.keys(PKA.pending || {});
    // Quet pending qua 90s
    for (const k of keys) {
      if (Date.now() - (PKA.pending[k].t || 0) > 90000) delete PKA.pending[k];
    }
    if (PKA.inbox && Date.now() - (PKA.inbox.t || 0) > 90000) PKA.inbox = null;
    if (!Object.keys(PKA.pending || {}).length && !PKA.inbox) return;
    try { pkArenaPollInbox(); } catch (e) { /* bo qua */ }
  }, 2000);
}

if (typeof window !== 'undefined') {
  window.pkArenaInvite = pkArenaInvite;
  window.pkArenaOn = pkArenaOn;
  window.pkArenaOnFchat = pkArenaOnFchat;
  window.pkArenaAccept = pkArenaAccept;
  window.pkArenaSend = pkArenaSend;
  window.pkArenaRoomId = pkArenaRoomId;
  window.pkArenaNewRoom = pkArenaNewRoom;
  window.pkArenaEnter = pkArenaEnter;
  window.pkArenaExit = pkArenaExit;
  window.pkArenaFinish = pkArenaFinish;
  window.pkArenaFlee = pkArenaFlee;
  window.pkArenaEnsureHud = pkArenaEnsureHud;
  window.pkArenaTick = pkArenaTick;
  window.pkArenaInit = pkArenaInit;
  window.pkArenaPollInbox = pkArenaPollInbox;
  window.pkArenaKickPoll = pkArenaKickPoll;
  window.pkArenaHudRemove = pkArenaHudRemove;
  window.pkArenaRoomTrusted = pkArenaRoomTrusted;
  window.PK_ARENA = PK_ARENA;
  window.PKA = PKA;
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(pkArenaInit, 0));
  else setTimeout(pkArenaInit, 0);
}
