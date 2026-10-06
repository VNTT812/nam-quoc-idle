/* ======================= MP AUTH CLIENT (dedicated server) =======================
   Bat bang ?mp_auth=1 hoac localStorage mp_auth_url = ws://host:3847
   Khi bat: vi tri peer lay tu server snapshot; tat broadcast pos Supabase (van dung field/hit neu can). */
'use strict';
const MPA = {
  ws: null, url: '', state: 'off', zone: null, tick: 0, rtt: 0,
  lastSnap: 0, sendT: 0, metaT: 0, seq: 0, timer: null
};

function mpaCfg() {
  return (typeof window !== 'undefined' && window.CHAT_CFG) ? window.CHAT_CFG : {};
}
function mpaEnabled() {
  try {
    if (/[?&]mp_auth=0\b/.test(location.search)) return false;
    if (/[?&]mp_auth=1\b/.test(location.search)) return true;
    if (localStorage.getItem('mp_auth') === '0') return false;
    if (localStorage.getItem('mp_auth') === '1') return true;
    if (localStorage.getItem('mp_auth_url')) return true;
    const c = mpaCfg();
    if (c.mpAuth && c.mpAuthUrl) return true;
  } catch (e) {}
  return false;
}
function mpaUrl() {
  try {
    const u = localStorage.getItem('mp_auth_url');
    if (u) return u;
  } catch (e) {}
  const c = mpaCfg();
  if (c.mpAuthUrl) return String(c.mpAuthUrl);
  // mac dinh local
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
    return 'ws://127.0.0.1:3847';
  return proto + '//' + location.hostname + ':3847';
}

async function mpaToken() {
  try {
    if (typeof netClient === 'function') {
      const sb = await netClient();
      const { data } = await sb.auth.getSession();
      if (data && data.session && data.session.access_token) return data.session.access_token;
    }
  } catch (e) {}
  return '';
}

function mpaSend(obj) {
  if (!MPA.ws || MPA.ws.readyState !== 1) return;
  try { MPA.ws.send(JSON.stringify(obj)); } catch (e) {}
}

function mpaApplySnap(msg) {
  if (!msg || !Array.isArray(msg.peers)) return;
  MPA.tick = msg.tick | 0;
  MPA.lastSnap = Date.now();
  if (typeof MP === 'undefined') return;
  const my = typeof mpCid === 'function' ? mpCid() : '';
  const live = new Set();
  for (const row of msg.peers) {
    if (!row || !row.cid || row.cid === my) continue;
    live.add(String(row.cid));
    // tai su dung upsert + clockOff cua mp.js
    if (typeof mpUpsertPeer === 'function') {
      // seq = tick server (monotonic) — TRUOC DAY XOR theo x → seq lung tung → drop/tele
      const pack = Object.assign({}, row, {
        t: msg.serverT || Date.now(),
        seq: (msg.tick | 0) || (++MPA._seqFake || (MPA._seqFake = 1))
      });
      mpUpsertPeer(pack, true);
    }
  }
  // xoa peer bien mat khoi snap lau
  for (const k of Object.keys(MP.peers)) {
    if (live.has(k)) continue;
    const p = MP.peers[k];
    if (Date.now() - (p.seen || 0) > 5000) delete MP.peers[k];
  }
  if (typeof mpUi === 'function') mpUi();
}

async function mpaJoin() {
  if (!mpaEnabled()) return;
  if (typeof mpCanPlay === 'function' && !mpCanPlay()) return;
  const z = typeof zoneOf === 'function' ? zoneOf(Math.min(S.stage, STAGES)) : null;
  if (!z) return;
  const url = mpaUrl();
  if (MPA.ws && MPA.url === url && MPA.zone === z.id && MPA.ws.readyState <= 1) return;
  mpaClose();
  MPA.url = url; MPA.zone = z.id; MPA.state = 'load';
  const token = await mpaToken();
  const ws = MPA.ws = new WebSocket(url);
  ws.onopen = () => {
    const jx = typeof mpJxPack === 'function' ? mpJxPack() : null;
    const tw = typeof titleWorn === 'function' && titleWorn();
    const join = {
      t: 'join', zone: z.id, token,
      name: typeof mpName === 'function' ? mpName() : (S.name || ''),
      fac: S.fac || '', sex: S.sex | 0, lvl: S.lvl | 0, jx,
      title: tw && typeof titleName === 'function' ? String(titleName(tw)).slice(0, 24) : '',
      titleId: tw ? tw[0] : '',
      titleCol: tw && typeof TIER !== 'undefined' && TIER[tw[3]] ? TIER[tw[3]].c : '',
      x: H && H.x, y: H && H.y
    };
    // local khong login: dung dev cid neu server MP_DEV_OPEN=1
    if (!token) {
      try { join.devCid = localStorage.getItem('mp_dev_cid') || ('dev-' + Math.random().toString(36).slice(2, 10)); localStorage.setItem('mp_dev_cid', join.devCid); } catch (e) { join.devCid = 'dev'; }
    }
    mpaSend(join);
    MPA.state = 'ok';
    if (typeof toast === 'function') toast('MP server: đã nối ' + url.replace(/^ws(s)?:\/\//, ''));
  };
  ws.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.t === 'snap') mpaApplySnap(msg);
    else if (msg.t === 'pong' && msg.t0) MPA.rtt = Date.now() - msg.t0;
    else if (msg.t === 'err' && typeof toast === 'function') toast('MP: ' + (msg.msg || 'lỗi'));
    else if (msg.t === 'welcome') MPA.state = 'ok';
  };
  ws.onclose = () => {
    if (MPA.ws === ws) { MPA.ws = null; MPA.state = 'off'; }
  };
  ws.onerror = () => { /* onclose xu ly */ };
}

function mpaClose() {
  const ws = MPA.ws; MPA.ws = null; MPA.state = 'off';
  if (ws) try { ws.close(); } catch (e) {}
}

function mpaSendInput(dt) {
  if (!MPA.ws || MPA.ws.readyState !== 1 || MPA.state !== 'ok') return;
  if (typeof fieldMode === 'function' && (!fieldMode() || R.town || R.dg || R.tower)) return;
  MPA.sendT = (MPA.sendT || 0) + dt;
  if (MPA.sendT < 0.05) return; // 20Hz
  MPA.sendT = 0;
  const vel = typeof mpLocalVel === 'function' ? mpLocalVel() : { vx: 0, vy: 0 };
  MPA.seq++;
  mpaSend({
    t: 'in', seq: MPA.seq,
    vx: Math.round(vel.vx * 10) / 10, vy: Math.round(vel.vy * 10) / 10,
    x: H.x, y: H.y,
    face: H.face >= 0 ? 1 : -1, dir: H.dir | 0, act: H.act || 'st',
    life: R.P && R.P.life ? +(R.life / R.P.life).toFixed(2) : 1
  });
  MPA.metaT = (MPA.metaT || 0) + 0.05;
  if (MPA.metaT > 2) {
    MPA.metaT = 0;
    const jx = typeof mpJxPack === 'function' ? mpJxPack() : null;
    mpaSend({
      t: 'meta',
      name: typeof mpName === 'function' ? mpName() : S.name,
      fac: S.fac, sex: S.sex | 0, lvl: S.lvl | 0, jx
    });
  }
}

/** Hook: goi moi frame tu main — an toan neu chua bat */
function mpaTick(dt) {
  if (!mpaEnabled()) return;
  if (MPA.state === 'off' || !MPA.ws) {
    if (!MPA._nextJoin || Date.now() > MPA._nextJoin) {
      MPA._nextJoin = Date.now() + 2000;
      mpaJoin();
    }
    return;
  }
  mpaSendInput(dt || 0.016);
  // ping RTT moi 2s
  if (!MPA._pingAt || Date.now() - MPA._pingAt > 2000) {
    MPA._pingAt = Date.now();
    mpaSend({ t: 'ping', t0: Date.now() });
  }
}

function mpaInit() {
  if (!mpaEnabled()) return;
  // Khi auth bat: khong gui pos qua Supabase (tranh 2 nguon). Van giu channel field neu mp.js da join.
  if (typeof mpTrackNow === 'function' && !mpTrackNow._mpaWrapped) {
    const _track = mpTrackNow;
    mpTrackNow = function (force) {
      if (mpaEnabled() && MPA.state === 'ok') {
        // chi track presence meta nhe neu van dung Supabase room — bo broadcast pos
        return;
      }
      return _track(force);
    };
    mpTrackNow._mpaWrapped = true;
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && mpaEnabled()) { MPA._nextJoin = 0; mpaJoin(); }
  });
  setTimeout(mpaJoin, 800);
  if (!MPA.timer) MPA.timer = setInterval(() => mpaTick(0.1), 100);
}

// tu khoi dong sau mp.js
if (typeof window !== 'undefined') {
  window.MPA = MPA;
  window.mpaInit = mpaInit;
  window.mpaTick = mpaTick;
  window.mpaEnabled = mpaEnabled;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mpaInit, 0));
  else setTimeout(mpaInit, 0);
}
