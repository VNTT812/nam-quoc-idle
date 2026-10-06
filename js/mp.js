/* ======================= DONG DOI BAN DO (Supabase Realtime beta) =======================
   Cung instance map (kenh map:{zoneId}): presence + broadcast vi tri/spawn/hit/die.
   Luat beta: HP quai chung; drop + exp chi nguoi last-hit. Host = cid nho nhat (trong tai spawn).
   Chi bai luyen cong (field); pho ban / thap / thanh pho van solo. Toi da MP_MAX nguoi / map. */
'use strict';
const MP = {
  sb: null, ch: null, zoneId: null, peers: {}, host: '', online: 0, state: 'off',
  fieldSnap: null, waitHost: 0, applying: false, lastSend: 0, syncT: 0, trackT: 0,
  seq: 0, uiT: 0, joinedAt: 0, ensureT: 0, posN: 0, lastJx: '', leaving: null, retries: 0
};
/* Pos ~12Hz + noi suy tre 90ms (FPS man hinh): muot nhu local, it giat */
const MP_MAX = 6, MP_POS = 0.08, MP_SYNC = 5, MP_WAIT = 1600, MP_PEER_TTL = 30000, MP_SNAP = 260, MP_DELAY = 90;
/* cid theo user dang nhap (2 tab / 2 TK cung may khong de chung chatCid localStorage) */
const mpCid = () => {
  if (typeof NET !== 'undefined' && NET.user && NET.user.id) return String(NET.user.id);
  return typeof chatCid === 'function' ? chatCid() : 'anon';
};
const mpActive = () => !!(MP.ch && MP.state === 'ok' && typeof fieldMode === 'function' && fieldMode() && S && S.fac && !R.town && !R.dg && !R.tower);
const mpIsHost = () => !MP.host || MP.host === mpCid();
const mpRoom = z => 'map:' + ((z && z.id) || 0);
const mpName = () => String((S && typeof hasRealName === 'function' && hasRealName() ? S.name : (S && FAC[S.fac] && FAC[S.fac].n) || 'Vô danh')).slice(0, 16);
const mpCanPlay = () => !!(typeof netOn === 'function' && netOn() && NET.user && S && S.fac && typeof fieldMode === 'function' && fieldMode() && !R.town && !R.dg && !R.tower);

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
  if (MP.state === 'load' || MP.state === 'retry') { badge.className = 'load'; el.textContent = MP.state === 'retry' ? 'nối lại…' : 'đang nối…'; return; }
  if (MP.state === 'err') { badge.className = 'err'; el.textContent = 'mất mạng'; return; }
  if (MP.state !== 'ok') { badge.className = 'off'; el.textContent = 'chưa nối'; return; }
  const n = Math.max(1, MP.online | 0, 1 + Object.keys(MP.peers).length);
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

function mpSendField(force) {
  const f = R.field; if (!f || !mpIsHost()) return;
  if (!force && Date.now() - (MP.lastFieldSend || 0) < 2000) return;
  MP.lastFieldSend = Date.now();
  // chi gui quai con song + diem spawn (bo n/aggro text) — goi nhe hon, it rot kenh
  const pts = f.pts.map((p, i) => {
    const e = p.e && !p.e.dead ? p.e : null;
    if (e && !e.mid) e.mid = mpMid(p);
    return {
      i, x: Math.round(p.x), y: Math.round(p.y), cls: p.cls, tid: p.tid, t: e ? 0 : Math.max(0, Math.round(p.t || 0)),
      mid: e ? e.mid : (p.mid || null),
      e: e ? { mid: e.mid, hp: Math.round(e.hp), max: Math.round(e.max), x: Math.round(e.x), y: Math.round(e.y), tid: e.tid, L: e.L | 0, cls: e.cls, dens: e.dens ? 1 : 0 } : null
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

function mpUpsertPeer(row) {
  if (!row) return;
  const k = String(row.cid || row.key || '');
  if (!k || k === mpCid()) return;
  let p = MP.peers[k];
  const now = Date.now();
  const tx = row.x != null ? +row.x : (p ? p.tx : 0);
  const ty = row.y != null ? +row.y : (p ? p.ty : 0);
  if (!p) {
    p = MP.peers[k] = {
      cid: k, name: 'Võ lâm', fac: '', sex: 0, lvl: 0, face: 1, dir: 0, act: 'st', actT: 0,
      life: 1, title: '', titleCol: '', jx: null, x: tx, y: ty, tx, ty, vx: 0, vy: 0,
      seen: now, _t: now, _px: tx, _py: ty, _jo: null, _joCache: ''
    };
    if (typeof toast === 'function') toast('Đồng đội: ' + (row.name || 'Võ lâm') + ' vào map');
  }
  if (row.x != null) {
    const dt = Math.max(0.04, (now - (p._t || now)) / 1000);
    p.vx = (tx - p.tx) / dt;
    p.vy = (ty - p.ty) / dt;
    const spd = Math.hypot(p.vx, p.vy);
    if (spd > 480) { p.vx *= 480 / spd; p.vy *= 480 / spd; }
    p.tx = tx; p.ty = ty; p._t = now;
    // lich su pos de noi suy muot (FPS man hinh)
    if (!p.hist) p.hist = [];
    const last = p.hist[p.hist.length - 1];
    if (!last || Math.hypot(tx - last.x, ty - last.y) > 0.5 || now - last.t > 40) {
      p.hist.push({ t: now, x: tx, y: ty });
      if (p.hist.length > 8) p.hist.shift();
    } else { last.t = now; last.x = tx; last.y = ty; }
    if (p.rx == null) { p.rx = tx; p.ry = ty; p.x = tx; p.y = ty; }
  }
  if (row.name != null) p.name = String(row.name).slice(0, 16);
  if (row.fac != null) p.fac = row.fac || p.fac;
  if (row.sex != null) p.sex = row.sex | 0;
  if (row.lvl != null) p.lvl = row.lvl | 0;
  if (row.face != null) p.face = row.face >= 0 ? 1 : -1;
  if (row.dir != null) p.dir = row.dir | 0;
  if (row.act != null && row.act !== p.act) {
    p.act = row.act;
    if (row.act === 'at' || row.act === 'hurt') p.actT = 0; // reset anim danh / trung
  }
  if (row.life != null) p.life = Math.max(0, Math.min(1, +row.life));
  if (row.title != null) p.title = String(row.title).slice(0, 24);
  if (row.titleCol != null) p.titleCol = row.titleCol;
  if (row.titleId != null) p.titleId = String(row.titleId).slice(0, 24);
  if (row.jx && typeof row.jx === 'object') {
    p.jx = { h: row.jx.h | 0, a: row.jx.a | 0, w: row.jx.w | 0, o: row.jx.o | 0 };
    p._jo = null; p._joCache = '';
  }
  p.seen = now;
}

/* Ghep bo JX1 tu hang trang bi dong bo (khong can item day du) */
function mpJxFromPeer(p) {
  if (!p || !p.jx || typeof JXL === 'undefined' || !JXL || typeof JX_PART_IDX === 'undefined') return null;
  const cacheKey = (p.sex | 0) + ':' + (p.jx.h | 0) + ',' + (p.jx.a | 0) + ',' + (p.jx.w | 0) + ',' + (p.jx.o | 0);
  if (p._jo && p._joCache === cacheKey) return p._jo;
  const sx = p.sex ? 'f' : 'm';
  const rows = { helm: p.jx.h | 0, armor: p.jx.a | 0, weapon: p.jx.w | 0, horse: p.jx.o | 0 };
  if (rows.weapon < 0) rows.weapon = 0;
  const wn = (JXL.wnames[sx] || [])[rows.weapon] || '空手';
  const ascTab = JXL.assoc[sx] || {}, asc = ascTab[wn] || ascTab['空手'];
  const ride = rows.horse >= 0 && asc && asc[1] ? 1 : 0;
  const Jo = { sx, rows, asc: asc ? asc[ride] || asc[0] || {} : {}, ride, key: JSON.stringify([sx, rows, ride]) };
  p._jo = Jo; p._joCache = cacheKey;
  try {
    for (const jact of Object.values(Jo.asc)) {
      if (!jact) continue;
      for (const part in JX_PART_IDX) {
        const row = Jo.rows[JX_GROUP[part]]; if (row < 0) continue;
        const nm = (((JXL.tabs[Jo.sx] || {})[part] || {})[row] || {})[jact];
        if (nm && JXL.sheets[jxSheetKey(Jo.sx, nm)]) img('img/jx/' + jxSheetKey(Jo.sx, nm) + '.webp');
      }
    }
  } catch (e) { /* bo qua */ }
  return Jo;
}

function mpPresenceSync() {
  if (!MP.ch) return;
  const st = MP.ch.presenceState() || {}, live = new Set();
  for (const k of Object.keys(st)) {
    const row = Object.assign({}, (st[k] && st[k][0]) || {}, { cid: k });
    live.add(k);
    if (k === mpCid()) continue;
    mpUpsertPeer(row);
  }
  // chi xoa peer khi mat presence LAU + khong con nhan pos (tranh nhap nhay khi sync nhip)
  for (const k of Object.keys(MP.peers)) {
    if (live.has(k)) continue;
    if (Date.now() - (MP.peers[k].seen || 0) > MP_PEER_TTL) delete MP.peers[k];
  }
  mpElect();
}

function mpOnPos(p) {
  if (!p || p.cid === mpCid()) return;
  mpUpsertPeer(p);
  mpElect();
}

function mpJxPack() {
  if (typeof jxOn !== 'function' || !jxOn() || !R || !R.jx || !R.jx.rows) return null;
  const r = R.jx.rows;
  return { h: r.helm | 0, a: r.armor | 0, w: r.weapon | 0, o: r.horse | 0 };
}
function mpPosPayload(full) {
  const tw = typeof titleWorn === 'function' && titleWorn();
  const jx = mpJxPack();
  const jxKey = jx ? (jx.h + ',' + jx.a + ',' + jx.w + ',' + jx.o) : '';
  const act = H.act || 'st';
  const changed = full || jxKey !== MP.lastJx;
  const actChanged = act !== MP.lastAct;
  if (changed) MP.lastJx = jxKey;
  if (actChanged) MP.lastAct = act;
  // goi nhe: chi toa do + huong + act (jx/title khi doi do / full)
  const o = {
    cid: mpCid(),
    x: Math.round(H.x), y: Math.round(H.y), face: H.face >= 0 ? 1 : -1,
    dir: H.dir | 0, act, life: R.P && R.P.life ? +(R.life / R.P.life).toFixed(2) : 1
  };
  if (full || changed || actChanged) {
    o.name = mpName(); o.fac = S.fac || ''; o.sex = S.sex | 0; o.lvl = S.lvl | 0;
  }
  if (changed || full) {
    o.jx = jx;
    o.title = tw && typeof titleName === 'function' ? String(titleName(tw)).slice(0, 24) : '';
    o.titleCol = tw && typeof TIER !== 'undefined' && TIER[tw[3]] ? TIER[tw[3]].c : '';
    o.titleId = tw ? tw[0] : '';
  }
  return o;
}
function mpTrackNow(forceBcast) {
  if (!MP.ch || MP.state !== 'ok' || !S || !S.fac) return;
  const now = Date.now();
  if (now - (MP.lastTrack || 0) < 80 && !forceBcast) return;
  MP.lastTrack = now;
  const act = H.act || 'st';
  const urgent = forceBcast || act === 'at' || act !== MP.lastAct;
  const p = mpPosPayload(!!forceBcast);
  // presence track thua hon (meta nang): ~3 goi pos / 1 track
  MP.posN = (MP.posN || 0) + 1;
  if (urgent || MP.posN % 3 === 0) {
    try { MP.ch.track(Object.assign({}, p, { name: mpName(), fac: S.fac || '', sex: S.sex | 0, lvl: S.lvl | 0, jx: p.jx || mpJxPack() })); } catch (e) { /* bo qua */ }
  }
  // broadcast pos moi tick — payload nho, muot di chuyen
  mpSend('pos', p);
}

/* ---------- kenh map ---------- */
async function mpLeave() {
  const ch = MP.ch; MP.leaving = ch; MP.ch = null; MP.zoneId = null; MP.fieldSnap = null; MP.host = ''; MP.online = 0; MP.state = 'off';
  // giu MP.peers nhe — roi map thi xoa
  MP.peers = {};
  if (ch && MP.sb) { try { await MP.sb.removeChannel(ch); } catch (e) { /* bo qua */ } }
  MP.leaving = null; mpUi();
}

async function mpJoin(z) {
  z = z || (typeof zoneOf === 'function' ? zoneOf(Math.min(S.stage, STAGES)) : null);
  if (!z || !mpCanPlay()) { if (!NET.user || !S || !S.fac) await mpLeave(); else if (!fieldMode() || R.town || R.dg || R.tower) await mpLeave(); return; }
  const rid = mpRoom(z);
  if (MP.ch && MP.zoneId === z.id && (MP.state === 'ok' || MP.state === 'load') && MP.ch.state === 'joined') { mpTrackNow(true); return; }
  if (MP.joinBusy) return;
  MP.joinBusy = true;
  mpDom();
  // KHONG xoa peers khi noi lai — tranh nhan vat phu luc an luc hien
  MP.state = MP.state === 'ok' ? 'retry' : 'load'; MP.zoneId = z.id; MP.joinedAt = Date.now(); MP.waitHost = Date.now() + MP_WAIT; mpUi();
  try {
    if (!MP.sb) MP.sb = await netClient();
  } catch (e) { MP.state = 'err'; MP.joinBusy = false; mpUi(); return; }
  const old = MP.ch; MP.ch = null; MP.leaving = old;
  if (old) { try { await MP.sb.removeChannel(old); } catch (e) { /* bo qua */ } }
  MP.leaving = null;
  const ch = MP.ch = MP.sb.channel(rid, { config: { broadcast: { self: false }, presence: { key: mpCid() } } });
  ch.on('presence', { event: 'sync' }, () => { if (MP.ch === ch) mpPresenceSync(); })
    .on('presence', { event: 'join' }, () => { if (MP.ch === ch) { mpPresenceSync(); if (mpIsHost()) mpSendField(true); } })
    .on('presence', { event: 'leave' }, () => { if (MP.ch === ch) mpPresenceSync(); })
    .on('broadcast', { event: 'pos' }, ({ payload }) => { if (MP.ch === ch) mpOnPos(payload); })
    .on('broadcast', { event: 'field' }, ({ payload }) => {
      if (MP.ch !== ch || !payload || payload.cid === mpCid()) return;
      if (payload.host && MP.host && payload.host !== MP.host && payload.host > MP.host) return;
      mpApplyField(payload); MP.waitHost = 0; mpUi();
    })
    .on('broadcast', { event: 'spawn' }, ({ payload }) => { if (MP.ch === ch) mpOnSpawn(payload); })
    .on('broadcast', { event: 'hit' }, ({ payload }) => { if (MP.ch === ch) mpOnHit(payload); })
    .on('broadcast', { event: 'die' }, ({ payload }) => { if (MP.ch === ch) mpOnDie(payload); })
    .on('broadcast', { event: 'need' }, ({ payload }) => { if (MP.ch === ch && mpIsHost() && payload && payload.cid !== mpCid()) mpSendField(true); })
    .subscribe(async st => {
      if (MP.ch !== ch || MP.leaving === ch) return;
      if (st === 'SUBSCRIBED') {
        MP.state = 'ok'; MP.err = ''; MP.joinBusy = false; MP.retries = 0;
        try { await ch.track(mpPosPayload(true)); } catch (e) { /* bo qua */ }
        mpPresenceSync();
        mpSend('need', { cid: mpCid() });
        mpSend('pos', mpPosPayload(true));
        if (mpIsHost() && R.field) mpSendField(true);
        mpUi();
      } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
        MP.state = 'retry'; MP.joinBusy = false; MP.retries = (MP.retries || 0) + 1; mpUi();
        const wait = Math.min(12000, 2000 + MP.retries * 1500);
        clearTimeout(MP.reT); MP.reT = setTimeout(() => { if (mpCanPlay()) mpJoin(zoneOf(Math.min(S.stage, STAGES))); }, wait);
      } else if (st === 'CLOSED') {
        // rot that (khong phai removeChannel chu dong): noi lai em
        if (MP.ch === ch) {
          MP.state = 'retry'; MP.joinBusy = false; mpUi();
          clearTimeout(MP.reT); MP.reT = setTimeout(() => { if (mpCanPlay()) mpJoin(zoneOf(Math.min(S.stage, STAGES))); }, 2500);
        }
      }
    });
  setTimeout(() => { if (MP.joinBusy && MP.ch === ch) MP.joinBusy = false; }, 5000);
}

function mpEnsure() {
  if (!mpCanPlay()) { mpUi(); return; }
  const zid = zoneOf(Math.min(S.stage, STAGES)).id;
  if (MP.state === 'ok' && MP.ch && MP.zoneId === zid) return; // othTick da track dinh ky
  if (MP.state === 'load' || MP.state === 'retry' || MP.joinBusy) return;
  mpJoin(zoneOf(Math.min(S.stage, STAGES)));
}

function mpInit() {
  mpDom(); mpUi();
  if (!netOn || !netOn()) return;
  setTimeout(mpEnsure, 600);
  setTimeout(mpEnsure, 2500);
  if (!MP.timer) MP.timer = setInterval(mpEnsure, 6000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (MP.state === 'ok') mpTrackNow(true); else mpEnsure(); } });
}

/* ---------- ve nguoi choi khac (hook render.js / combat.js) ---------- */
/* Noi suy tre MP_DELAY ms tren lich su pos — muot theo FPS man hinh (60/120) */
function mpInterpAt(p, now) {
  const h = p.hist;
  if (!h || !h.length) return { x: p.tx, y: p.ty };
  if (h.length === 1) return { x: h[0].x, y: h[0].y };
  const t = now - MP_DELAY;
  if (t <= h[0].t) return { x: h[0].x, y: h[0].y };
  const last = h[h.length - 1], prev = h[h.length - 2];
  if (t >= last.t) {
    const span = Math.max(1, last.t - prev.t);
    const u = Math.min(0.1, (t - last.t) / 1000); // extrapolate toi da 100ms
    return { x: last.x + (last.x - prev.x) / span * 1000 * u, y: last.y + (last.y - prev.y) / span * 1000 * u };
  }
  for (let i = 1; i < h.length; i++) {
    if (t <= h[i].t) {
      const a = h[i - 1], b = h[i];
      let u = (t - a.t) / Math.max(1, b.t - a.t);
      u = u * u * (3 - 2 * u); // smoothstep
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
  }
  return { x: last.x, y: last.y };
}
/* Goi moi frame ve (qua othEnts) — tach khoi tick 60Hz de muot tren man 120Hz */
function othSmoothRender(dt) {
  const now = Date.now();
  dt = Math.max(0.001, Math.min(0.05, dt));
  for (const id of Object.keys(MP.peers)) {
    const p = MP.peers[id];
    if (now - (p.seen || 0) > MP_PEER_TTL) { delete MP.peers[id]; continue; }
    const goal = mpInterpAt(p, now);
    if (p.rx == null) { p.rx = goal.x; p.ry = goal.y; }
    const dist = Math.hypot(goal.x - p.rx, goal.y - p.ry);
    if (dist > MP_SNAP) { p.rx = goal.x; p.ry = goal.y; }
    else {
      // spring nhanh theo FPS — 120Hz van muot
      const a = 1 - Math.exp(-dt * 26);
      p.rx += (goal.x - p.rx) * a;
      p.ry += (goal.y - p.ry) * a;
    }
    p.x = p.rx; p.y = p.ry;
    p.actT = (p.actT || 0) + dt;
    if (p.act === 'at' && p.actT > 0.5) p.act = Math.hypot(p.vx || 0, p.vy || 0) > 24 ? 'run' : 'st';
  }
}
function othEnts() {
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0, (now - (MP._drawT || now)) / 1000));
  MP._drawT = now;
  othSmoothRender(dt || 1 / 60);
  return Object.values(MP.peers).map(p => ({ oth: p, y: p.ry != null ? p.ry : p.y }));
}
function mpJxBodyReady(Jo, act) {
  if (!Jo || !JXL) return false;
  const jact = (Jo.asc && (Jo.asc[act] || Jo.asc.st)) || null; if (!jact) return false;
  const row = Jo.rows.armor; if (row < 0) return false;
  const nm = (((JXL.tabs[Jo.sx] || {})['躯体'] || {})[row] || {})[jact];
  if (!nm) return false;
  const sk = jxSheetKey(Jo.sx, nm), m = JXL.sheets[sk]; if (!m) return false;
  const im = img('img/jx/' + sk + '.webp');
  return !!(im && im.complete && im.naturalWidth);
}
function othTick(dt) {
  if ((MP.uiT = (MP.uiT || 0) + dt) > 0.5) { MP.uiT = 0; mpUi(); }
  // di chuyen ve o othSmoothRender (theo FPS). Day chi gui mang.
  if (!(MP.ch && (MP.state === 'ok' || MP.state === 'retry') && typeof fieldMode === 'function' && fieldMode() && S && S.fac && !R.town && !R.dg && !R.tower)) return;
  if (MP.state !== 'ok') return;
  MP.trackT = (MP.trackT || 0) + dt;
  if (MP.trackT >= MP_POS) { MP.trackT = 0; mpTrackNow(); }
  if ((H.act || '') === 'at' && MP.lastAct !== 'at') mpTrackNow(true);
  if (mpIsHost()) {
    MP.syncT = (MP.syncT || 0) + dt;
    if (MP.syncT >= MP_SYNC) { MP.syncT = 0; mpSendField(); }
  } else if (MP.waitHost && Date.now() > MP.waitHost && !MP.fieldSnap) {
    MP.waitHost = 0;
    if (!R.field) fieldBuild();
    else mpSendField(true);
  }
}
function othDraw(c, p) {
  if (!p) return;
  const px = p.rx != null ? p.rx : p.x, py = p.ry != null ? p.ry : p.y;
  const vx0 = CAM.x, vy0 = CAM.y, vx1 = CAM.x + AR.w, vy1 = CAM.y + AR.h;
  const margin = 28;
  if (px < vx0 - 40 || px > vx1 + 40 || py < vy0 - 40 || py > vy1 + 40) {
    const cx = clamp(px, vx0 + margin, vx1 - margin), cy = clamp(py, vy0 + margin, vy1 - margin);
    const col = typeof campCol === 'function' ? campCol(p.fac) : '#9fe0b0';
    c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, 7, 0, 7); c.fill(); c.stroke();
    c.font = '10px "IBM Plex Mono", monospace'; c.textAlign = 'center';
    c.fillStyle = '#000'; c.fillText(p.name, cx + 1, cy - 11); c.fillStyle = col; c.fillText(p.name, cx, cy - 12);
    return;
  }
  c.fillStyle = '#0006'; c.beginPath(); c.ellipse(px, py, 14, 5, 0, 0, 7); c.fill();
  c.strokeStyle = typeof campCol === 'function' ? campCol(p.fac) : '#8fe0b8'; c.lineWidth = 2; c.globalAlpha = 0.85;
  c.beginPath(); c.ellipse(px, py, 18, 7, 0, 0, 7); c.stroke(); c.globalAlpha = 1;
  const hw = typeof heroGfx === 'function' ? heroGfx(p.fac, p.sex) : null;
  const moving = Math.hypot(p.vx || 0, p.vy || 0) > 18 || Math.hypot((p.tx || px) - px, (p.ty || py) - py) > 3;
  const act = p.act === 'at' || p.act === 'hurt' || p.act === 'die' ? p.act : (moving ? 'run' : 'st');
  const sc = typeof HERO_SCALE !== 'undefined' ? HERO_SCALE : 1;
  let h = 0;
  const Jo = mpJxFromPeer(p);
  if (Jo && typeof drawJxHero === 'function' && mpJxBodyReady(Jo, act)) {
    h = drawJxHero(act, p.dir || 0, p.actT || 0, px, py, sc, 1, hw && hw.anim, Jo) || 0;
  }
  if (!h && hw && hw.anim && typeof drawAnim === 'function') {
    h = drawAnim(hw.anim, act, p.dir || 0, p.actT || 0, px, py, sc) || 0;
  } else if (!h && hw && typeof drawSprite === 'function') {
    drawSprite(img(hw.img), hw.sz, px, py, 0.85, p.face < 0, 0.92);
    h = 52;
  } else if (!h) {
    c.fillStyle = typeof campCol === 'function' ? campCol(p.fac) : '#c8e6c0';
    c.beginPath(); c.arc(px, py - 18, 12, 0, 7); c.fill();
    h = 40;
  }
  const col = typeof campCol === 'function' ? campCol(p.fac) : (NAME_COL && NAME_COL.hero) || '#fff3c0';
  const top = py - (h ? Math.min(h, 90) * 0.9 : 52) - 4;
  const fxId = p.titleId && typeof titleFxOf === 'function' ? titleFxOf(p.titleId) : (p.title === 'Thiên Hạ Đệ Nhất' ? 'thienha' : null);
  let sub = p.title ? `«${p.title}»` : '';
  if (fxId && typeof drawTitleFx === 'function' && drawTitleFx(c, px, top - 10, fxId)) sub = '';
  label(px, top, `${p.name} · Lv${p.lvl || '?'}`, col, 11, p.life, '#6bcf6b', sub, p.titleCol || '');
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
