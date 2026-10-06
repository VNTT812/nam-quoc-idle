/* ======================= DONG DOI BAN DO (Supabase Realtime beta) =======================
   Cung instance map (kenh map:{zoneId}): presence + broadcast vi tri/spawn/hit/die.
   Luat beta: HP quai chung; drop + exp chi nguoi last-hit. Host = cid nho nhat (trong tai spawn).
   Chi bai luyen cong (field); pho ban / thap / thanh pho van solo. Toi da MP_MAX nguoi / map. */
'use strict';
const MP = {
  sb: null, ch: null, zoneId: null, peers: {}, host: '', online: 0, state: 'off',
  fieldSnap: null, waitHost: 0, applying: false, lastSend: 0, syncT: 0, trackT: 0,
  seq: 0, uiT: 0, joinedAt: 0, ensureT: 0
};
const MP_MAX = 6, MP_POS = 0.1, MP_SYNC = 1.6, MP_WAIT = 1400;
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

function mpUpsertPeer(row) {
  if (!row) return;
  const k = String(row.cid || row.key || '');
  if (!k || k === mpCid()) return;
  const prev = MP.peers[k];
  const tx = row.x != null ? +row.x : (prev ? prev.tx : 0);
  const ty = row.y != null ? +row.y : (prev ? prev.ty : 0);
  const was = !!prev;
  const jx = row.jx && typeof row.jx === 'object' ? { h: row.jx.h | 0, a: row.jx.a | 0, w: row.jx.w | 0, o: row.jx.o | 0 } : (prev && prev.jx) || null;
  const jxKey = jx ? JSON.stringify(jx) + '|' + (row.sex != null ? row.sex | 0 : (prev ? prev.sex | 0 : 0)) : '';
  MP.peers[k] = {
    cid: k,
    name: String(row.name || (prev && prev.name) || 'Võ lâm').slice(0, 16),
    fac: row.fac || (prev && prev.fac) || '',
    sex: row.sex != null ? (row.sex | 0) : (prev ? prev.sex | 0 : 0),
    lvl: row.lvl != null ? (row.lvl | 0) : (prev ? prev.lvl | 0 : 0),
    face: row.face != null ? (row.face >= 0 ? 1 : -1) : (prev ? prev.face : 1),
    dir: row.dir != null ? (row.dir | 0) : (prev ? prev.dir | 0 : 0),
    act: row.act || (prev && prev.act) || 'st',
    actT: prev ? prev.actT || 0 : 0,
    life: Math.max(0, Math.min(1, row.life != null ? +row.life : (prev ? prev.life : 1))),
    title: row.title != null ? String(row.title).slice(0, 24) : (prev && prev.title) || '',
    titleCol: row.titleCol || (prev && prev.titleCol) || '',
    jx, x: prev ? prev.x : tx, y: prev ? prev.y : ty,
    tx, ty, seen: Date.now(),
    _px: prev ? prev._px : tx, _py: prev ? prev._py : ty,
    _jo: prev && prev._jxKey === jxKey ? prev._jo : null,
    _jxKey: jxKey
  };
  if (!was && typeof toast === 'function') toast('Đồng đội: ' + MP.peers[k].name + ' vào map');
}

/* Ghep bo JX1 tu hang trang bi dong bo (khong can item day du) */
function mpJxFromPeer(p) {
  if (!p || !p.jx || typeof JXL === 'undefined' || !JXL || !JX_PART_IDX) return null;
  if (p._jo && p._jxKey && p._jo.key && p._jo.key.indexOf(p._jxKey.split('|')[0]) >= 0) return p._jo;
  const sx = p.sex ? 'f' : 'm';
  const rows = { helm: p.jx.h | 0, armor: p.jx.a | 0, weapon: p.jx.w | 0, horse: p.jx.o | 0 };
  if (rows.weapon < 0) rows.weapon = 0;
  const wn = (JXL.wnames[sx] || [])[rows.weapon] || '空手';
  const ascTab = JXL.assoc[sx] || {}, asc = ascTab[wn] || ascTab['空手'];
  const ride = rows.horse >= 0 && asc && asc[1] ? 1 : 0;
  const Jo = { sx, rows, asc: asc ? asc[ride] || asc[0] || {} : {}, ride, key: JSON.stringify([sx, rows, ride]) };
  p._jo = Jo; p._jxKey = JSON.stringify(p.jx) + '|' + (p.sex | 0);
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
  for (const k of Object.keys(MP.peers)) if (!live.has(k) && Date.now() - (MP.peers[k].seen || 0) > 12000) delete MP.peers[k];
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
function mpPosPayload() {
  const tw = typeof titleWorn === 'function' && titleWorn();
  return {
    cid: mpCid(), name: mpName(), fac: S.fac || '', sex: S.sex | 0, lvl: S.lvl | 0,
    x: Math.round(H.x), y: Math.round(H.y), face: H.face >= 0 ? 1 : -1,
    dir: H.dir | 0, act: H.act || 'st', life: R.P && R.P.life ? R.life / R.P.life : 1,
    jx: mpJxPack(),
    title: tw && typeof titleName === 'function' ? String(titleName(tw)).slice(0, 24) : '',
    titleCol: tw && typeof TIER !== 'undefined' && TIER[tw[3]] ? TIER[tw[3]].c : ''
  };
}
function mpTrackNow() {
  if (!MP.ch || MP.state !== 'ok' || !S || !S.fac) return;
  const p = mpPosPayload();
  try { MP.ch.track(p); } catch (e) { /* bo qua */ }
  mpSend('pos', p);   // backup: broadcast vi tri (presence doi khi cham / mat sync)
}

/* ---------- kenh map ---------- */
async function mpLeave() {
  const ch = MP.ch; MP.ch = null; MP.zoneId = null; MP.peers = {}; MP.fieldSnap = null; MP.host = ''; MP.online = 0; MP.state = 'off';
  if (ch && MP.sb) { try { await MP.sb.removeChannel(ch); } catch (e) { /* bo qua */ } }
  mpUi();
}

async function mpJoin(z) {
  z = z || (typeof zoneOf === 'function' ? zoneOf(Math.min(S.stage, STAGES)) : null);
  if (!z || !mpCanPlay()) { if (!NET.user || !S || !S.fac) await mpLeave(); else if (!fieldMode() || R.town || R.dg || R.tower) await mpLeave(); return; }
  const rid = mpRoom(z);
  if (MP.ch && MP.zoneId === z.id && MP.state === 'ok') { mpTrackNow(); return; }
  if (MP.joinBusy) return;
  MP.joinBusy = true;
  mpDom();
  MP.state = 'load'; MP.zoneId = z.id; MP.joinedAt = Date.now(); MP.waitHost = Date.now() + MP_WAIT; MP.fieldSnap = null; MP.peers = {}; mpUi();
  try {
    if (!MP.sb) MP.sb = await netClient();
  } catch (e) { MP.state = 'err'; MP.joinBusy = false; mpUi(); return; }
  const old = MP.ch; MP.ch = null;
  if (old) { try { await MP.sb.removeChannel(old); } catch (e) { /* bo qua */ } }
  const ch = MP.ch = MP.sb.channel(rid, { config: { broadcast: { self: false }, presence: { key: mpCid() } } });
  ch.on('presence', { event: 'sync' }, () => { if (MP.ch === ch) mpPresenceSync(); })
    .on('presence', { event: 'join' }, () => { if (MP.ch === ch) { mpPresenceSync(); if (mpIsHost()) mpSendField(); } })
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
    .on('broadcast', { event: 'need' }, ({ payload }) => { if (MP.ch === ch && mpIsHost() && payload && payload.cid !== mpCid()) mpSendField(); })
    .subscribe(async st => {
      if (MP.ch !== ch) return;
      if (st === 'SUBSCRIBED') {
        MP.state = 'ok'; MP.err = ''; MP.joinBusy = false;
        try { await ch.track(mpPosPayload()); } catch (e) { /* bo qua */ }
        mpPresenceSync();
        mpSend('need', { cid: mpCid() });
        mpSend('pos', mpPosPayload());
        if (mpIsHost() && R.field) mpSendField();
        mpUi();
        if (typeof log === 'function') log(`<span class="dim">Đồng đội: phòng <b>${esc(rid)}</b> — cần cùng bản đồ (cùng id map).</span>`);
      } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') {
        MP.state = 'err'; MP.joinBusy = false; mpUi();
        clearTimeout(MP.reT); MP.reT = setTimeout(() => { if (mpCanPlay()) mpJoin(zoneOf(Math.min(S.stage, STAGES))); }, 3000);
      }
    });
  setTimeout(() => { if (MP.joinBusy && MP.ch === ch) MP.joinBusy = false; }, 4000);
}

function mpEnsure() {
  if (!mpCanPlay()) { mpUi(); return; }
  if (MP.state === 'ok' && MP.ch && MP.zoneId === zoneOf(Math.min(S.stage, STAGES)).id) { mpTrackNow(); return; }
  if (MP.state === 'load' || MP.joinBusy) return;
  mpJoin(zoneOf(Math.min(S.stage, STAGES)));
}

function mpInit() {
  mpDom(); mpUi();
  if (!netOn || !netOn()) return;
  setTimeout(mpEnsure, 500);
  setTimeout(mpEnsure, 2000);
  setTimeout(mpEnsure, 5000);
  if (!MP.timer) MP.timer = setInterval(mpEnsure, 4000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) mpEnsure(); });
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
    MP.waitHost = 0;
    if (!R.field) fieldBuild();
    else mpSendField();
  }
  for (const p of Object.values(MP.peers)) {
    const k = Math.min(1, dt * 10);
    p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k;
    p.actT = (p.actT || 0) + dt;
    if (Date.now() - (p.seen || 0) > 15000) delete MP.peers[p.cid];
  }
}
function othDraw(c, p) {
  if (!p) return;
  // ngoai man hinh: ve mui ten mep khung nhin (de biet dong doi o dau)
  const vx0 = CAM.x, vy0 = CAM.y, vx1 = CAM.x + AR.w, vy1 = CAM.y + AR.h;
  const margin = 28;
  if (p.x < vx0 - 40 || p.x > vx1 + 40 || p.y < vy0 - 40 || p.y > vy1 + 40) {
    const cx = clamp(p.x, vx0 + margin, vx1 - margin), cy = clamp(p.y, vy0 + margin, vy1 - margin);
    const col = typeof campCol === 'function' ? campCol(p.fac) : '#9fe0b0';
    c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, 7, 0, 7); c.fill(); c.stroke();
    c.font = '10px "IBM Plex Mono", monospace'; c.textAlign = 'center';
    c.fillStyle = '#000'; c.fillText(p.name, cx + 1, cy - 11); c.fillStyle = col; c.fillText(p.name, cx, cy - 12);
    return;
  }
  c.fillStyle = '#0006'; c.beginPath(); c.ellipse(p.x, p.y, 14, 5, 0, 0, 7); c.fill();
  c.strokeStyle = typeof campCol === 'function' ? campCol(p.fac) : '#8fe0b8'; c.lineWidth = 2; c.globalAlpha = 0.85;
  c.beginPath(); c.ellipse(p.x, p.y, 18, 7, 0, 0, 7); c.stroke(); c.globalAlpha = 1;
  const hw = typeof heroGfx === 'function' ? heroGfx(p.fac, p.sex) : null;
  const act = p.act === 'at' || p.act === 'hurt' || p.act === 'die' ? p.act : (Math.hypot(p.tx - p._px, p.ty - p._py) > 2 ? 'run' : 'st');
  const sc = typeof HERO_SCALE !== 'undefined' ? HERO_SCALE : 1;
  let h = 0;
  // QUAN TRONG: khong goi drawHeroAnim — ham do dung R.jx/R.look cua MINH -> ve do minh len nguoi khac (loi trang phuc + bong ma)
  const Jo = mpJxFromPeer(p);
  if (Jo && typeof drawJxHero === 'function') {
    h = drawJxHero(act, p.dir || 0, p.actT || 0, p.x, p.y, sc, 1, hw && hw.anim, Jo) || 0;
  }
  if (!h && hw && hw.anim && typeof drawAnim === 'function') {
    h = drawAnim(hw.anim, act, p.dir || 0, p.actT || 0, p.x, p.y, sc) || 0;
  } else if (!h && hw && typeof drawSprite === 'function') {
    drawSprite(img(hw.img), hw.sz, p.x, p.y, 0.85, p.face < 0, 0.92);
    h = 52;
  } else if (!h) {
    c.fillStyle = typeof campCol === 'function' ? campCol(p.fac) : '#c8e6c0';
    c.beginPath(); c.arc(p.x, p.y - 18, 12, 0, 7); c.fill();
    h = 40;
  }
  const col = typeof campCol === 'function' ? campCol(p.fac) : (NAME_COL && NAME_COL.hero) || '#fff3c0';
  const sub = p.title ? `«${p.title}»` : '';
  label(p.x, p.y - (h ? Math.min(h, 90) * 0.9 : 52) - 4, `${p.name} · Lv${p.lvl || '?'}`, col, 11, p.life, '#6bcf6b', sub, p.titleCol || '');
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
