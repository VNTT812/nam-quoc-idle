/* ======================= DONG DOI BAN DO (Supabase Realtime beta) =======================
   Cung instance map (kenh map:{zoneId}): presence vi tri nguoi choi, broadcast spawn/hit/die.
   Luat beta: HP quai chung; drop + exp chi nguoi last-hit. Host = cid nho nhat (trong tai spawn).
   Chi bai luyen cong (field); pho ban / thap / thanh pho van solo. Toi da MP_MAX nguoi / map. */
'use strict';
const MP = {
  sb: null, ch: null, zoneId: null, peers: {}, host: '', online: 0, state: 'off',
  fieldSnap: null, waitHost: 0, applying: false, lastSend: 0, syncT: 0, trackT: 0,
  seq: 0, uiT: 0, joinedAt: 0
};
const MP_MAX = 6, MP_POS = 0.12, MP_SYNC = 1.6, MP_WAIT = 1400;
const mpCid = () => (typeof chatCid === 'function' ? chatCid() : 'anon');
const mpActive = () => !!(MP.ch && MP.state === 'ok' && typeof fieldMode === 'function' && fieldMode() && S && S.fac && !R.town && !R.dg && !R.tower);
const mpIsHost = () => !MP.host || MP.host === mpCid();
const mpRoom = z => 'map:' + ((z && z.id) || 0);
const mpName = () => String((S && hasRealName && hasRealName() ? S.name : (S && FAC[S.fac] && FAC[S.fac].n) || 'Vô danh')).slice(0, 16);

function mpMid(p) {
  if (p && p.mid) return p.mid;
  MP.seq++;
  const mid = mpCid().slice(0, 6) + '-' + (MP.zoneId || 0) + '-' + MP.seq + '-' + (Date.now() % 1e7);
  if (p) p.mid = mid;
  return mid;
}

function mpDom() {
  if ($('#mpBadge')) return;
  const b = document.createElement('div');
  b.id = 'mpBadge'; b.title = 'Đồng đội trên bản đồ (beta)';
  b.innerHTML = `<b>Đồng đội</b><span id="mpPeerTxt">…</span>`;
  const battle = $('#battle'); if (battle) battle.appendChild(b);
}
function mpUi() {
  const badge = $('#mpBadge'), el = badge && badge.querySelector('#mpPeerTxt'); if (!el || !badge) return;
  if (typeof netOn !== 'function' || !netOn() || (typeof NET !== 'undefined' && NET.offline)) {
    badge.className = 'off'; el.textContent = 'offline'; return;
  }
  if (typeof fieldMode !== 'function' || !fieldMode() || R.town || R.dg || R.tower) {
    badge.className = 'idle'; el.textContent = 'solo'; return;
  }
  if (MP.state === 'load') { badge.className = 'load'; el.textContent = 'đang nối…'; return; }
  if (MP.state === 'err') { badge.className = 'err'; el.textContent = 'lỗi'; return; }
  if (MP.state !== 'ok') { badge.className = 'off'; el.textContent = 'chưa nối'; return; }
  const n = Math.max(1, MP.online);
  badge.className = n > 1 ? 'on' : 'ok';
  el.textContent = n > 1 ? `${n} người · ${mpIsHost() ? 'chủ' : 'khách'}` : '1 người (chủ)';
}

/* ---------- goi / nhan broadcast ---------- */
function mpSend(ev, payload) {
  if (!MP.ch || MP.state !== 'ok' || MP.applying) return;
  try { MP.ch.send({ type: 'broadcast', event: ev, payload: Object.assign({ t: Date.now(), cid: mpCid() }, payload) }); }
  catch (e) { /* bo qua */ }
}

function mpPackEnemy(e, p) {
  return {
    mid: e.mid, tid: e.tid, L: e.L, cls: e.cls, x: Math.round(e.x), y: Math.round(e.y),
    hp: Math.round(e.hp), max: Math.round(e.max), dens: !!e.dens, n: e.n || '',
    pi: p && R.field ? R.field.pts.indexOf(p) : -1, homeX: p ? Math.round(p.x) : Math.round(e.x), homeY: p ? Math.round(p.y) : Math.round(e.y)
  };
}

function mpSendField() {
  const f = R.field; if (!f || !mpIsHost()) return;
  const pts = f.pts.map((p, i) => {
    const e = p.e && !p.e.dead ? p.e : null;
    if (e && !e.mid) e.mid = mpMid(p);
    return {
      i, x: Math.round(p.x), y: Math.round(p.y), cls: p.cls, tid: p.tid, t: Math.max(0, +(p.t || 0).toFixed(1)),
      mid: e ? e.mid : (p.mid || null),
      e: e ? { mid: e.mid, hp: Math.round(e.hp), max: Math.round(e.max), x: Math.round(e.x), y: Math.round(e.y), tid: e.tid, L: e.L, cls: e.cls, dens: !!e.dens, n: e.n || '', aggro: !!e.aggro } : null
    };
  });
  const snap = { key: f.key, kills: f.kills | 0, zone: MP.zoneId, pts, host: mpCid() };
  MP.fieldSnap = snap;
  mpSend('field', snap);
}

function mpEnsureEnemy(pack, home) {
  let e = R.enemies.find(x => x.mid === pack.mid && !x.dead);
  if (e) {
    e.hp = Math.min(e.hp, pack.hp); e.max = pack.max || e.max;
    if (pack.x != null) { e.x = pack.x; e.y = pack.y; }
    return e;
  }
  const L = pack.L || stageLevel(S.stage) + (pack.cls === 'boss' ? 1 : 0);
  e = makeEnemy(pack.tid, L, pack.cls || 'normal', pack.x, pack.y);
  e.mid = pack.mid; e.hp = pack.hp; e.max = pack.max || pack.hp;
  if (pack.dens) { e.dens = true; e.dmg *= DENS_DMG; }
  if (pack.n) e.n = pack.n;
  if (home) { e.home = home; home.e = e; home.mid = pack.mid; }
  e.aggro = !!pack.aggro; e.mpRemote = true;
  R.enemies.push(e);
  return e;
}

function mpApplyField(snap) {
  if (!snap || !snap.pts || !S || !S.fac) return;
  MP.applying = true;
  try {
    const keep = R.enemies.filter(e => (e.goldBoss || e.sat || e.satG) && !e.dead);
    const pts = snap.pts.map(p => ({ x: p.x, y: p.y, cls: p.cls, tid: p.tid, t: p.t || 0, mid: p.mid || null, e: null }));
    R.field = { key: snap.key || fieldKey(), pts, kills: snap.kills | 0, mp: true };
    R.enemies = keep;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], src = snap.pts[i];
      if (src.e && src.e.mid) mpEnsureEnemy(src.e, p);
    }
    MP.fieldSnap = snap;
  } finally { MP.applying = false; }
}

function mpOnHit(p) {
  if (!p || !p.mid || p.by === mpCid()) return;
  const e = R.enemies.find(x => x.mid === p.mid && !x.dead);
  if (!e) return;
  MP.applying = true;
  try {
    const next = Math.max(0, +p.hp);
    if (next < e.hp) {
      const dmg = Math.max(1, Math.round(p.dmg || (e.hp - next)));
      e.hp = next; e.lastBy = p.by; e.aggro = true; e.hitT = 0.12;
      if (e.act !== 'at') { e.act = 'hurt'; e.actT = 0; }
      addText(e.x, e.y - e.r - 8, '-' + fmt(dmg), '#ffb070', 11);
    } else e.lastBy = p.by;
    if (e.hp <= 0 && !e.dead) {
      e.dead = true; e.mpSkipReward = p.by !== mpCid();
      onKill(e); npcSfx(MON[e.tid].anim, 'die', 0.5);
      if (!R.quiet) { e.act = 'die'; e.actT = 0; R.corpses.push(e); }
    }
  } finally { MP.applying = false; }
}

function mpOnDie(p) {
  if (!p || !p.mid) return;
  const e = R.enemies.find(x => x.mid === p.mid && !x.dead);
  if (!e) return;
  if (p.by === mpCid() && e.dead) return;
  MP.applying = true;
  try {
    e.hp = 0; e.dead = true; e.lastBy = p.by;
    e.mpSkipReward = p.by !== mpCid();
    onKill(e); npcSfx(MON[e.tid].anim, 'die', 0.5);
    if (!R.quiet) { e.act = 'die'; e.actT = 0; R.corpses.push(e); }
  } finally { MP.applying = false; }
}

function mpOnSpawn(p) {
  if (!p || !p.mid || mpIsHost()) return;
  MP.applying = true;
  try {
    let home = null;
    if (R.field && p.pi >= 0 && R.field.pts[p.pi]) home = R.field.pts[p.pi];
    else if (R.field) {
      home = R.field.pts.find(x => !x.e && x.cls === p.cls && x.tid === p.tid) || null;
      if (!home) { home = { x: p.homeX || p.x, y: p.homeY || p.y, cls: p.cls, tid: p.tid, t: 0, mid: p.mid }; R.field.pts.push(home); }
    }
    if (home) { home.mid = p.mid; home.t = 0; }
    mpEnsureEnemy(p, home);
  } finally { MP.applying = false; }
}

function mpElect() {
  const ids = Object.keys(MP.peers);
  if (!ids.includes(mpCid())) ids.push(mpCid());
  ids.sort();
  const prev = MP.host;
  MP.host = ids[0] || mpCid();
  MP.online = Math.min(MP_MAX, new Set(ids).size);
  if (prev && prev !== MP.host && mpIsHost() && R.field) mpSendField();
  mpUi();
}

function mpPresenceSync() {
  if (!MP.ch) return;
  const st = MP.ch.presenceState() || {}, peers = {};
  for (const k of Object.keys(st)) {
    const row = (st[k] && st[k][0]) || {};
    if (k === mpCid()) continue;
    const prev = MP.peers[k];
    peers[k] = {
      cid: k, name: String(row.name || 'Võ lâm').slice(0, 16), fac: row.fac || '', sex: row.sex | 0,
      lvl: row.lvl | 0, face: row.face >= 0 ? 1 : -1,
      dir: row.dir | 0, act: row.act || 'st', actT: prev ? prev.actT || 0 : 0,
      life: Math.max(0, Math.min(1, +row.life || 1)),
      x: prev ? prev.x : (+row.x || 0), y: prev ? prev.y : (+row.y || 0),
      tx: +row.x || 0, ty: +row.y || 0, seen: Date.now(),
      _px: prev ? prev._px : +row.x || 0, _py: prev ? prev._py : +row.y || 0
    };
  }
  MP.peers = peers;
  mpElect();
}

function mpTrackNow() {
  if (!MP.ch || MP.state !== 'ok' || !S || !S.fac) return;
  try {
    MP.ch.track({
      name: mpName(), fac: S.fac || '', sex: S.sex | 0, lvl: S.lvl | 0,
      x: Math.round(H.x), y: Math.round(H.y), face: H.face >= 0 ? 1 : -1,
      dir: H.dir | 0, act: H.act || 'st', life: R.P && R.P.life ? R.life / R.P.life : 1
    });
  } catch (e) { /* bo qua */ }
}

/* ---------- kenh map ---------- */
async function mpLeave() {
  const ch = MP.ch; MP.ch = null; MP.zoneId = null; MP.peers = {}; MP.fieldSnap = null; MP.host = ''; MP.online = 0; MP.state = 'off';
  if (ch && MP.sb) { try { await MP.sb.removeChannel(ch); } catch (e) { /* bo qua */ } }
  mpUi();
}

async function mpJoin(z) {
  if (!z || !netOn || !netOn() || !NET.user || !S || !S.fac) { await mpLeave(); return; }
  if (typeof fieldMode === 'function' && !fieldMode()) { await mpLeave(); return; }
  const rid = mpRoom(z);
  if (MP.ch && MP.zoneId === z.id && MP.state === 'ok') { mpTrackNow(); return; }
  mpDom();
  MP.state = 'load'; MP.zoneId = z.id; MP.joinedAt = Date.now(); MP.waitHost = Date.now() + MP_WAIT; MP.fieldSnap = null; mpUi();
  try {
    if (!MP.sb) MP.sb = await netClient();
  } catch (e) { MP.state = 'err'; mpUi(); return; }
  const old = MP.ch; MP.ch = null;
  if (old) { try { await MP.sb.removeChannel(old); } catch (e) { /* bo qua */ } }
  const ch = MP.ch = MP.sb.channel(rid, { config: { presence: { key: mpCid() } } });
  ch.on('presence', { event: 'sync' }, () => { if (MP.ch === ch) mpPresenceSync(); })
    .on('presence', { event: 'join' }, () => { if (MP.ch === ch) { mpPresenceSync(); if (mpIsHost()) mpSendField(); } })
    .on('presence', { event: 'leave' }, () => { if (MP.ch === ch) mpPresenceSync(); })
    .on('broadcast', { event: 'field' }, ({ payload }) => {
      if (MP.ch !== ch || !payload || payload.cid === mpCid()) return;
      if (payload.host && MP.host && payload.host !== MP.host && payload.host > MP.host) return;
      mpApplyField(payload); MP.waitHost = 0; mpUi();
    })
    .on('broadcast', { event: 'spawn' }, ({ payload }) => { if (MP.ch === ch) mpOnSpawn(payload); })
    .on('broadcast', { event: 'hit' }, ({ payload }) => { if (MP.ch === ch) mpOnHit(payload); })
    .on('broadcast', { event: 'die' }, ({ payload }) => { if (MP.ch === ch) mpOnDie(payload); })
    .on('broadcast', { event: 'need' }, ({ payload }) => { if (MP.ch === ch && mpIsHost() && payload && payload.cid !== mpCid()) mpSendField(); })
    .subscribe(async st => {
      if (MP.ch !== ch) return;
      if (st === 'SUBSCRIBED') {
        MP.state = 'ok'; MP.err = '';
        try { await ch.track({ name: mpName(), fac: S.fac || '', sex: S.sex | 0, lvl: S.lvl | 0, x: Math.round(H.x), y: Math.round(H.y), face: H.face >= 0 ? 1 : -1, dir: H.dir | 0, act: H.act || 'st', life: 1 }); } catch (e) { /* bo qua */ }
        mpPresenceSync();
        mpSend('need', { cid: mpCid() });
        if (mpIsHost() && R.field) mpSendField();
        mpUi();
      } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') {
        MP.state = 'err'; mpUi();
        clearTimeout(MP.reT); MP.reT = setTimeout(() => { if (S && S.fac) mpJoin(zoneOf(Math.min(S.stage, STAGES))); }, 3000);
      }
    });
}

function mpInit() {
  mpDom(); mpUi();
  if (!netOn || !netOn()) return;
  const tryJoin = () => { if (NET.user && S && S.fac && fieldMode()) mpJoin(zoneOf(Math.min(S.stage, STAGES))); };
  setTimeout(tryJoin, 800);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && MP.state === 'ok') mpTrackNow(); });
}

/* ---------- ve nguoi choi khac (hook render.js / combat.js) ---------- */
function othEnts() {
  return Object.values(MP.peers).map(p => ({ oth: p, y: p.y }));
}
function othTick(dt) {
  if ((MP.uiT = (MP.uiT || 0) + dt) > 0.5) { MP.uiT = 0; mpUi(); }
  if (!mpActive()) return;
  MP.trackT = (MP.trackT || 0) + dt;
  if (MP.trackT >= MP_POS) { MP.trackT = 0; mpTrackNow(); }
  if (mpIsHost()) {
    MP.syncT = (MP.syncT || 0) + dt;
    if (MP.syncT >= MP_SYNC) { MP.syncT = 0; mpSendField(); }
  } else if (MP.waitHost && Date.now() > MP.waitHost && !MP.fieldSnap) {
    MP.waitHost = 0; // timeout: tu choi nhu host neu khong ai gui field
    if (!R.field) fieldBuild();
    else mpSendField();
  }
  for (const p of Object.values(MP.peers)) {
    const k = Math.min(1, dt * 8);
    p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
    p.actT = (p.actT || 0) + dt;
    if (Date.now() - (p.seen || 0) > 8000) delete MP.peers[p.cid];
  }
}
function othDraw(c, p) {
  if (!p) return;
  c.fillStyle = '#0006'; c.beginPath(); c.ellipse(p.x, p.y, 14, 5, 0, 0, 7); c.fill();
  const hw = typeof heroGfx === 'function' ? heroGfx(p.fac, p.sex) : null;
  const act = p.act === 'at' || p.act === 'hurt' || p.act === 'die' ? p.act : (Math.hypot(p.tx - p._px, p.ty - p._py) > 2 ? 'run' : 'st');
  let h = 0;
  if (hw && hw.anim && typeof drawHeroAnim === 'function') {
    h = drawHeroAnim(hw.anim, act, p.dir || 0, p.actT || 0, p.x, p.y, typeof HERO_SCALE !== 'undefined' ? HERO_SCALE : 1) || 0;
  } else if (hw && typeof drawSprite === 'function') {
    drawSprite(img(hw.img), hw.sz, p.x, p.y, 0.85, p.face < 0, 0.92);
    h = 52;
  } else {
    c.fillStyle = typeof campCol === 'function' ? campCol(p.fac) : '#c8e6c0';
    c.beginPath(); c.arc(p.x, p.y - 18, 12, 0, 7); c.fill();
    h = 40;
  }
  const col = typeof campCol === 'function' ? campCol(p.fac) : (NAME_COL && NAME_COL.hero) || '#fff3c0';
  label(p.x, p.y - (h ? Math.min(h, 90) * 0.9 : 52) - 4, `${p.name} · Lv${p.lvl || '?'}`, col, 11, p.life, '#6bcf6b');
  p._px = p.tx; p._py = p.ty;
}

/* ---------- moc field / combat ---------- */
(function mpHook() {
  if (typeof fieldBuild !== 'function') return;
  const _fieldBuild = fieldBuild;
  fieldBuild = function () {
    const zid = zoneOf(Math.min(S.stage, STAGES)).id;
    if (mpActive() && !mpIsHost() && MP.fieldSnap && (MP.fieldSnap.key === fieldKey() || MP.fieldSnap.zone === zid)) {
      mpApplyField(MP.fieldSnap); return;
    }
    if (mpActive() && !mpIsHost() && MP.waitHost && Date.now() < MP.waitHost) {
      // cho host gui field; tam thoi chua build layout rieng
      R.field = R.field || { key: fieldKey(), pts: [], kills: 0, mp: true };
      return;
    }
    _fieldBuild();
    if (R.field) {
      for (const p of R.field.pts) if (p.e && !p.e.mid) p.e.mid = mpMid(p);
    }
    if (mpActive() && mpIsHost()) mpSendField();
  };

  const _fieldSpawn = fieldSpawn;
  fieldSpawn = function (p) {
    if (mpActive() && !mpIsHost() && !MP.applying) return; // khach: chi nhan spawn tu host
    _fieldSpawn(p);
    if (p && p.e) {
      if (!p.e.mid) p.e.mid = mpMid(p);
      if (mpActive() && mpIsHost() && !MP.applying) mpSend('spawn', mpPackEnemy(p.e, p));
    }
  };

  const _fieldTick = fieldTick;
  fieldTick = function (dt) {
    if (mpActive() && !mpIsHost()) {
      const zid = zoneOf(Math.min(S.stage, STAGES)).id, f = R.field;
      const same = f && (f.key === fieldKey() || (f.mp && MP.zoneId === zid));
      if (!same) {
        if (MP.fieldSnap && (MP.fieldSnap.key === fieldKey() || MP.fieldSnap.zone === zid)) mpApplyField(MP.fieldSnap);
        else if (!MP.waitHost || Date.now() > MP.waitHost) _fieldBuild();
        return;
      }
      for (const p of f.pts) {
        if (p.e && p.e.dead) { p.e = null; p.t = p.cls === 'boss' ? FLD_BOSS_RESPAWN : FLD_RESPAWN / (typeof mountHaste === 'function' ? mountHaste() : 1); }
        if (!p.e && p.t > 0) p.t -= dt;
      }
      if (R.enemies.some(e => e.dead)) R.enemies = R.enemies.filter(e => !e.dead);
      return;
    }
    _fieldTick(dt);
  };

  const _heroHit = heroHit;
  heroHit = function (a, e) {
    const tot = _heroHit(a, e);
    if (tot > 0 && e && e.mid && mpActive() && !MP.applying) {
      e.lastBy = mpCid();
      mpSend('hit', { mid: e.mid, hp: Math.max(0, Math.round(e.hp)), max: Math.round(e.max), by: mpCid(), dmg: Math.round(tot) });
      if (e.hp <= 0) mpSend('die', { mid: e.mid, by: mpCid() });
    }
    return tot;
  };

  const _onKill = onKill;
  onKill = function (e) {
    if (e && e.mpSkipReward) {
      R.kills++; S.totalKills = (S.totalKills || 0) + 1; R.stall = 0;
      if (typeof fieldOnKill === 'function') fieldOnKill();
      if (typeof burst === 'function') burst(e.x, e.y, SERIES_COL[e.series]);
      return;
    }
    if (e && e.mid && mpActive() && !MP.applying && e.lastBy && e.lastBy !== mpCid()) {
      e.mpSkipReward = true; return onKill(e);
    }
    _onKill(e);
  };
})();
