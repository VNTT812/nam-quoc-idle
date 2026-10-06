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
  const tick = msg.tick | 0;
  const now = Date.now();
  // goi cu / out-of-order — bo; neu tick tut (server/room reset) thi neo lai (tranh freeze vinh vien)
  if (MPA._lastTick != null && tick <= MPA._lastTick) {
    if (MPA._lastTick - tick > 30) {
      MPA._lastTick = null; MPA._histCleared = false;
    } else return;
  }
  MPA.tick = tick;
  MPA.lastSnap = now;
  MPA._tickMs = msg.tickHz ? (1000 / msg.tickHz) : (MPA._tickMs || 33.33);
  MPA._lastTick = tick;
  if (typeof MP === 'undefined') return;
  // Lan snap dau sau reconnect: xoa hist Supabase cu
  if (!MPA._histCleared) {
    MPA._histCleared = true;
    for (const p of Object.values(MP.peers || {})) {
      p.hist = []; p.clockOff = 0; p.seq = 0; p._pt = 0; p._acceptAt = 0; p._recvAt = 0;
      if (p.rx != null) { p.x = p.rx; p.y = p.ry; p.tx = p.rx; p.ty = p.ry; }
    }
  }
  const my = typeof mpCid === 'function' ? mpCid() : '';
  const live = new Set();
  for (const row of msg.peers) {
    if (!row || !row.cid || row.cid === my) continue;
    const cid = String(row.cid);
    live.add(cid);
    // Auth render: ahist Hermite tren serverT (xem mpAuthGoal)
    let p = MP.peers[cid];
    if (!p) {
      if (typeof mpUpsertPeer === 'function') {
        mpUpsertPeer(Object.assign({}, row, { t: now, seq: tick }), true);
        p = MP.peers[cid];
      }
    }
    if (!p) continue;
    // meta
    if (row.name != null) p.name = String(row.name).slice(0, 16);
    if (row.fac != null) p.fac = row.fac || p.fac;
    if (row.sex != null) p.sex = row.sex | 0;
    if (row.lvl != null) p.lvl = row.lvl | 0;
    if (row.face != null) p.face = row.face >= 0 ? 1 : -1;
    if (row.dir != null) p.dir = row.dir | 0;
    if (row.act != null && row.act !== p.act) {
      p.act = row.act;
      if (row.act === 'at' || row.act === 'hurt') p.actT = 0;
    }
    if (row.life != null) p.life = Math.max(0, Math.min(1, +row.life));
    if (row.title != null) p.title = String(row.title).slice(0, 24);
    if (row.titleCol != null) p.titleCol = row.titleCol;
    if (row.titleId != null) p.titleId = String(row.titleId).slice(0, 24);
    if (row.jx && typeof row.jx === 'object') {
      const nj = { h: row.jx.h | 0, a: row.jx.a | 0, w: row.jx.w | 0, o: row.jx.o | 0 };
      const nk = (p.sex | 0) + ':' + nj.h + ',' + nj.a + ',' + nj.w + ',' + nj.o;
      if (nk !== p._joCache) p.jx = nj;
      else p.jx = nj;
    }
    // vi tri + van toc tu server (client kinematic relay)
    if (row.x != null && row.y != null) {
      const tx = +row.x, ty = +row.y;
      let vx = row.vx != null ? +row.vx : 0, vy = row.vy != null ? +row.vy : 0;
      const spd = Math.hypot(vx, vy);
      if (spd > 300) { const k = 300 / spd; vx *= k; vy *= k; }
      if (spd < 6) { vx = 0; vy = 0; }
      // Dung yen / danh: XOA coast — neu giu _cVx, peer se "chay mai" o tab kia
      if (spd < 10 || row.act === 'st' || row.act === 'at' || row.act === 'hurt') {
        p._cVx = 0; p._cVy = 0;
        p.vx = vx; p.vy = vy;
      } else {
        p.vx = p.vx != null ? p.vx * 0.3 + vx * 0.7 : vx;
        p.vy = p.vy != null ? p.vy * 0.3 + vy * 0.7 : vy;
        if (Math.hypot(p.vx, p.vy) > 20) { p._cVx = p.vx; p._cVy = p.vy; }
      }
      p.tx = tx; p.ty = ty;
      p._recvAt = now;
      p.seq = tick;
      // ahist theo thoi diem NHAN — don gian, on dinh
      if (!p.ahist) p.ahist = [];
      const last = p.ahist[p.ahist.length - 1];
      if (!last || now - last.t > 10) {
        p.ahist.push({ t: now, x: tx, y: ty, vx: p.vx, vy: p.vy });
        while (p.ahist.length > MP_AUTH_HIST) p.ahist.shift();
      } else {
        last.x = tx; last.y = ty; last.vx = p.vx; last.vy = p.vy; last.t = now;
      }
      if (p.rx == null) { p.rx = tx; p.ry = ty; p.x = tx; p.y = ty; }
      else if (Math.hypot(tx - p.rx, ty - p.ry) > 220) {
        p.rx = tx; p.ry = ty; p.x = tx; p.y = ty;
        p.ahist = [{ t: now, x: tx, y: ty, vx: p.vx, vy: p.vy }];
      }
    }
    p.seen = now;
  }
  for (const k of Object.keys(MP.peers)) {
    if (live.has(k)) continue;
    const p = MP.peers[k];
    if (Date.now() - (p.seen || 0) > 5000) delete MP.peers[k];
  }
  // Auth snap cung peer — bat buoc elect host (truoc do chi elect o presence → 2 host / quai lech)
  if (typeof mpElect === 'function') mpElect();
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
    // KHONG set ok o day — doi welcome (tranh gui in khi chua join → peer đứng yên)
  };
  ws.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.t === 'snap') mpaApplySnap(msg);
    else if (msg.t === 'skill') {
      if (typeof mpOnSkill === 'function') mpOnSkill(msg);
    } else if (msg.t === 'pkflag') {
      if (typeof mpOnPkFlag === 'function') mpOnPkFlag(msg);
    } else if (msg.t === 'pkhit') {
      if (typeof mpOnPkHit === 'function') mpOnPkHit(msg);
    } else if (msg.t === 'pkkill') {
      if (typeof mpOnPkKill === 'function') mpOnPkKill(msg);
    } else if (msg.t === 'pong' && msg.t0) MPA.rtt = Date.now() - msg.t0;
    else if (msg.t === 'err') {
      if (typeof toast === 'function') toast('MP: ' + (msg.msg || 'lỗi'));
      // auth fail / chua join: ha state de thu lai + fallback Supabase pos
      if (MPA.state === 'ok' || MPA.state === 'load') {
        MPA.state = 'bad';
        MPA._nextJoin = Date.now() + 1500;
      }
    } else if (msg.t === 'welcome') {
      MPA.state = 'ok';
      MPA._lastTick = null; MPA._histCleared = false;
      if (typeof toast === 'function') toast('MP server: đã nối ' + url.replace(/^ws(s)?:\/\//, ''));
    }
  };
  ws.onclose = () => {
    if (MPA.ws === ws) { MPA.ws = null; MPA.state = 'off'; }
  };
  ws.onerror = () => { /* onclose xu ly */ };
}

function mpaClose() {
  const ws = MPA.ws; MPA.ws = null; MPA.state = 'off';
  MPA._lastTick = null; MPA._lastSampleT = null; MPA._histCleared = false;
  if (ws) try { ws.close(); } catch (e) {}
}

function mpaSendInput(dt) {
  if (!MPA.ws || MPA.ws.readyState !== 1 || MPA.state !== 'ok') return;
  if (typeof fieldMode === 'function' && (!fieldMode() || R.town || R.dg || R.tower)) return;
  MPA.sendT = (MPA.sendT || 0) + dt;
  if (MPA.sendT < 0.025) return; // 40Hz — muot hon 30Hz khi cua/doi huong
  MPA.sendT = 0;
  const vel = typeof mpLocalVel === 'function' ? mpLocalVel() : { vx: 0, vy: 0 };
  MPA.seq++;
  // Gui ca x/y + vx/vy — server relay kinematic (khop duong di local, het khựng tich phan)
  mpaSend({
    t: 'in', seq: MPA.seq,
    x: H ? Math.round(H.x * 10) / 10 : 0,
    y: H ? Math.round(H.y * 10) / 10 : 0,
    vx: Math.round(vel.vx * 10) / 10, vy: Math.round(vel.vy * 10) / 10,
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
        // van track presence META (look) — BO broadcast pos (1 nguon = auth)
        if (!MP || !MP.ch || (MP.state !== 'ok' && MP.state !== 'retry')) return;
        const now = Date.now();
        if (!force && MP._metaAt && now - MP._metaAt < 1500) return;
        MP._metaAt = now;
        try {
          const m = typeof mpMetaPayload === 'function' ? mpMetaPayload() : null;
          if (m) {
            // GIU x/y trong presence — peer moi / mat auth dung bootstrap (auth snap van uu tien)
            MP.ch.track(m);
          }
        } catch (e) { /* bo qua */ }
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
