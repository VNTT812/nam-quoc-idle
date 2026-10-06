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
/* Pos ~30Hz khi chay; delay thich ung (chay ~30ms / dung ~80ms) — live test RTT~31ms. */
const MP_MAX = 6, MP_POS = 0.033, MP_POS_IDLE = 0.12, MP_SYNC = 10, MP_WAIT = 1600, MP_PEER_TTL = 45000;
const MP_SNAP = 180, MP_HARD = 560, MP_DELAY = 30, MP_DELAY_IDLE = 80, MP_HIST = 40, MP_EXTRAP = 0.28, MP_MAX_SPD = 300;
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
  // van gui luc retry ngan — tranh peer dung hinh khi badge "nối lại"
  if (!MP.ch || MP.applying) return;
  if (MP.state !== 'ok' && MP.state !== 'retry') return;
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

function mpEnsureEnemy(pack, home, softPos) {
  let e = R.enemies.find(x => x.mid === pack.mid && !x.dead);
  if (e) {
    e.hp = Math.min(e.hp, pack.hp); e.max = pack.max || e.max;
    if (pack.x != null && pack.y != null) {
      const d = Math.hypot(pack.x - e.x, pack.y - e.y);
      // softPos (field sync): chi keo ve khi lech xa — tranh tele/an-hien moi 5s
      if (!softPos || d > 80) {
        if (d > 220) { e.x = pack.x; e.y = pack.y; }
        else { e.x += (pack.x - e.x) * 0.35; e.y += (pack.y - e.y) * 0.35; }
      }
    }
    if (home) { e.home = home; home.e = e; home.mid = pack.mid; }
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

/* Soft-merge field theo mid: khong wipe R.enemies — tranh quai luc an luc hien. */
function mpApplyField(snap) {
  if (!snap || !snap.pts || !S || !S.fac) return;
  MP.applying = true;
  try {
    const key = snap.key || fieldKey();
    const special = R.enemies.filter(e => e && !e.dead && (e.goldBoss || e.sat || e.satG));
    const byMid = new Map();
    for (const e of R.enemies) if (e && e.mid && !e.dead && !(e.goldBoss || e.sat || e.satG)) byMid.set(e.mid, e);

    let pts = R.field && R.field.key === key && R.field.pts && R.field.pts.length === snap.pts.length
      ? R.field.pts : null;
    if (!pts) pts = snap.pts.map(p => ({ x: p.x, y: p.y, cls: p.cls, tid: p.tid, t: p.t || 0, mid: p.mid || null, e: null }));
    R.field = { key, pts, kills: snap.kills | 0, mp: true };

    const live = [], used = new Set();
    for (let i = 0; i < snap.pts.length; i++) {
      const src = snap.pts[i], p = pts[i];
      p.x = src.x; p.y = src.y; p.cls = src.cls; p.tid = src.tid;
      if (src.e && src.e.mid) {
        p.t = 0; p.mid = src.e.mid;
        let e = byMid.get(src.e.mid) || (p.e && p.e.mid === src.e.mid && !p.e.dead ? p.e : null);
        if (e) {
          e.hp = Math.min(e.hp, src.e.hp); e.max = src.e.max || e.max;
          e.home = p; p.e = e; used.add(e.mid);
          const tx = src.e.x != null ? src.e.x : p.x, ty = src.e.y != null ? src.e.y : p.y;
          const d = Math.hypot(tx - e.x, ty - e.y);
          if (d > 280) { e.x = tx; e.y = ty; }
          else if (d > 100) { e.x += (tx - e.x) * 0.2; e.y += (ty - e.y) * 0.2; }
          live.push(e);
        } else {
          live.push(mpEnsureEnemy(src.e, p, true));
          used.add(src.e.mid);
        }
      } else {
        if (p.e && !p.e.dead && p.e.hp > 0) {
          // host bao trong nhung local con song: cho die/hit packet, chi cap timer
          p.t = src.t || 0;
        } else {
          p.e = null; p.mid = src.mid || null; p.t = src.t || 0;
        }
      }
    }
    for (const [mid, e] of byMid) {
      if (!used.has(mid)) { e.dead = true; e.mpSkipReward = true; if (e.home && e.home.e === e) e.home.e = null; }
    }
    // giu thu tu on dinh: special + live (object cu), khong tao lai
    const seen = new Set(live.map(e => e.mid));
    for (const e of special) if (e.mid) seen.add(e.mid);
    R.enemies = special.concat(live);
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

function mpUpsertPeer(row, fromPos) {
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
      life: 1, title: '', titleCol: '', jx: null, x: tx, y: ty, tx, ty, rx: tx, ry: ty, vx: 0, vy: 0,
      seen: now, _t: now, _px: tx, _py: ty, _jo: null, _joCache: '', _joReady: null, seq: 0, clockOff: 0,
      hist: row.x != null ? [{ t: row.t != null ? +row.t : now, x: tx, y: ty, vx: 0, vy: 0 }] : []
    };
    if (typeof toast === 'function') toast('Đồng đội: ' + (row.name || 'Võ lâm') + ' vào map');
  }
  // Chi broadcast pos moi ghi hist. Presence chi meta — tranh toa do cu de tele.
  if (fromPos && row.x != null) {
    const seq = row.seq != null ? (row.seq | 0) : 0;
    const pt = row.t != null ? (+row.t) : now;
    if (seq && p.seq && seq <= p.seq) { p.seen = now; /* stale seq */ }
    else if (p._pt && pt + 80 < p._pt) { p.seen = now; /* out-of-order time */ }
    else if (p.clockOff && (now - pt - p.clockOff) > 900) { p.seen = now; /* goi den tre >0.9s — bo, tranh tele lui */ }
    else {
      if (seq) p.seq = Math.max(p.seq || 0, seq);
      // uoc lech dong ho: now ≈ pt + clockOff (EMA)
      const off = now - pt;
      // bo qua mau lech dong ho vo ly (goi buffer 3s+)
      if (p.clockOff && Math.abs(off - p.clockOff) > 2500) { p.seen = now; }
      else {
        p.clockOff = p.clockOff ? p.clockOff * 0.88 + off * 0.12 : off;
        let vx, vy;
        if (row.vx != null && row.vy != null) { vx = +row.vx; vy = +row.vy; }
        else {
          const dt = Math.max(0.04, ((p._pt ? pt - p._pt : 0) || (now - (p._t || now))) / 1000);
          vx = (tx - p.tx) / dt; vy = (ty - p.ty) / dt;
        }
        const spd = Math.hypot(vx, vy);
        if (spd > MP_MAX_SPD) { const k2 = MP_MAX_SPD / spd; vx *= k2; vy *= k2; }
        if (spd < 6) { vx = 0; vy = 0; }
        p.vx = p.vx != null ? p.vx * 0.3 + vx * 0.7 : vx;
        p.vy = p.vy != null ? p.vy * 0.3 + vy * 0.7 : vy;
        p.tx = tx; p.ty = ty; p._t = now; p._pt = Math.max(p._pt || 0, pt);
        if (!p.hist) p.hist = [];
        const last = p.hist[p.hist.length - 1];
        const ht = pt;
        if (!last || Math.hypot(tx - last.x, ty - last.y) > 0.5 || ht - last.t > 35) {
          if (last && Math.hypot(tx - last.x, ty - last.y) > 220 && ht - last.t < 600) {
            p.hist.push({ t: last.t + Math.max(35, (ht - last.t) * 0.5), x: (last.x + tx) * 0.5, y: (last.y + ty) * 0.5, vx: p.vx, vy: p.vy });
          }
          p.hist.push({ t: ht, x: tx, y: ty, vx: p.vx, vy: p.vy });
          if (p.hist.length > MP_HIST) p.hist.shift();
        } else { last.t = ht; last.x = tx; last.y = ty; last.vx = p.vx; last.vy = p.vy; }
        if (p.rx == null) { p.rx = tx; p.ry = ty; p.x = tx; p.y = ty; }
      }
    }
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
    const nj = { h: row.jx.h | 0, a: row.jx.a | 0, w: row.jx.w | 0, o: row.jx.o | 0 };
    const nk = (p.sex | 0) + ':' + nj.h + ',' + nj.a + ',' + nj.w + ',' + nj.o;
    if (nk !== p._joCache) { p.jx = nj; /* giu _jo cu den khi bo moi san sang — tranh flash do */ }
    else p.jx = nj;
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
    mpUpsertPeer(row, false); // presence: meta only, khong day pos cu vao hist
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
  mpUpsertPeer(p, true);
}

function mpJxPack() {
  if (typeof jxOn !== 'function' || !jxOn() || !R || !R.jx || !R.jx.rows) return null;
  const r = R.jx.rows;
  return { h: r.helm | 0, a: r.armor | 0, w: r.weapon | 0, o: r.horse | 0 };
}
function mpLocalVel() {
  // van toc: uu tien input; click-to-move / auto thi uoc tu dich chuyen thuc (MP._lx)
  const now = performance.now();
  const dt = Math.max(0.016, Math.min(0.12, (now - (MP._lvT || now)) / 1000));
  MP._lvT = now;
  let vx = 0, vy = 0;
  if (typeof inputVec === 'function') {
    const v = inputVec();
    if (v && (v[0] || v[1]) && (H.moving || (H.act || '') === 'run')) {
      const sp = 150 * (typeof curSpeed === 'function' ? curSpeed() : 1);
      vx = v[0] * sp; vy = v[1] * sp;
    }
  }
  // click chuot / auto farm: inputVec = 0 nhung van chay — dung lich su toa do rieng (khong dung H.px, render ghi de)
  if (Math.hypot(vx, vy) < 8 && MP._lx != null) {
    const ddt = Math.max(0.016, Math.min(0.12, (now - (MP._lxT || now)) / 1000));
    const dx = H.x - MP._lx, dy = H.y - MP._ly;
    if (Math.hypot(dx, dy) > 0.35) { vx = dx / ddt; vy = dy / ddt; }
  }
  MP._lx = H.x; MP._ly = H.y; MP._lxT = now;
  const spd = Math.hypot(vx, vy);
  if (spd > MP_MAX_SPD) { const k = MP_MAX_SPD / spd; vx *= k; vy *= k; }
  if (spd < 8) { vx = 0; vy = 0; }
  MP._lvx = vx; MP._lvy = vy;
  return { vx, vy };
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
  const vel = mpLocalVel();
  // goi nhe: toa do + van toc + timestamp nguon + huong + act
  MP.posSeq = (MP.posSeq | 0) + 1;
  const o = {
    cid: mpCid(), seq: MP.posSeq, t: Date.now(),
    x: Math.round(H.x * 10) / 10, y: Math.round(H.y * 10) / 10,
    vx: Math.round(vel.vx * 10) / 10, vy: Math.round(vel.vy * 10) / 10,
    face: H.face >= 0 ? 1 : -1,
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
  if (!MP.ch || (MP.state !== 'ok' && MP.state !== 'retry') || !S || !S.fac) return;
  const now = Date.now();
  const vel = mpLocalVel();
  const moving = !!(H.moving || Math.hypot(vel.vx, vel.vy) > 8 || (H.act || '') === 'run' || (H.act || '') === 'at');
  const minGap = forceBcast ? 0 : (moving ? 32 : 110);
  if (now - (MP.lastTrack || 0) < minGap) return;
  MP.lastTrack = now;
  const act = H.act || 'st';
  const urgent = forceBcast || act === 'at' || act !== MP.lastAct;
  const p = mpPosPayload(!!forceBcast);
  // presence track thua hon (meta): ~10 goi pos / 1 track — giam tai kenh
  MP.posN = (MP.posN || 0) + 1;
  if (urgent || MP.posN % 10 === 0) {
    try { MP.ch.track(Object.assign({}, p, { name: mpName(), fac: S.fac || '', sex: S.sex | 0, lvl: S.lvl | 0, jx: p.jx || mpJxPack() })); } catch (e) { /* bo qua */ }
  }
  mpSend('pos', p);
}

/* ---------- kenh map ---------- */
async function mpLeave(keepPeers) {
  const ch = MP.ch; MP.leaving = ch; MP.ch = null; MP.zoneId = null; MP.fieldSnap = null; MP.host = ''; MP.online = 0; MP.state = 'off';
  if (!keepPeers) MP.peers = {};
  if (ch && MP.sb) { try { await MP.sb.removeChannel(ch); } catch (e) { /* bo qua */ } }
  MP.leaving = null; mpUi();
}

function mpChAlive(ch) {
  if (!ch) return false;
  const st = String(ch.state || '').toLowerCase();
  if (st === 'joined' || st === 'joining' || st === 'subscribed') return true;
  // vua SUBSCRIBED gan day: coi nhu song (tranh flap state → "nối lại" lap)
  if (MP._subOkAt && Date.now() - MP._subOkAt < 10000 && (MP.state === 'ok' || MP.state === 'retry')) return true;
  return false;
}

async function mpJoin(z) {
  z = z || (typeof zoneOf === 'function' ? zoneOf(Math.min(S.stage, STAGES)) : null);
  if (!z || !mpCanPlay()) { if (!NET.user || !S || !S.fac) await mpLeave(); else if (!fieldMode() || R.town || R.dg || R.tower) await mpLeave(); return; }
  const rid = mpRoom(z);
  // kenh cung map con song: KHONG go + tao lai (tranh "nối lại" lap / peer tele)
  if (MP.ch && MP.zoneId === z.id && mpChAlive(MP.ch)) {
    if (MP.state !== 'ok') { MP.state = 'ok'; mpUi(); }
    MP.joinBusy = false; mpTrackNow(true); return;
  }
  if (MP.joinBusy) return;
  // backoff: khong spam recreate khi vua loi
  if (MP._nextJoin && Date.now() < MP._nextJoin && MP.zoneId === z.id) return;
  // grace: neu vua ok < 4s thi chua recreate (tranh CLOSED nhip nhip)
  if (MP.ch && MP.zoneId === z.id && MP._subOkAt && Date.now() - MP._subOkAt < 4000) {
    MP.state = 'ok'; MP.joinBusy = false; mpUi(); return;
  }
  MP.joinBusy = true;
  mpDom();
  const sameZone = MP.zoneId === z.id;
  // chi hien "nối lại" khi mat kenh that su > 2s
  const showRetry = sameZone && Object.keys(MP.peers).length && !(MP._subOkAt && Date.now() - MP._subOkAt < 2000);
  MP.state = showRetry ? 'retry' : 'load';
  MP.zoneId = z.id; MP.joinedAt = Date.now(); MP.waitHost = Date.now() + MP_WAIT; mpUi();
  try {
    if (!MP.sb) MP.sb = await netClient();
  } catch (e) { MP.state = 'err'; MP.joinBusy = false; MP._nextJoin = Date.now() + 4000; mpUi(); return; }
  const old = MP.ch; MP.ch = null; MP.leaving = old;
  if (old) { try { await MP.sb.removeChannel(old); } catch (e) { /* bo qua */ } }
  MP.leaving = null;
  if (!sameZone) MP.peers = {};
  const ch = MP.ch = MP.sb.channel(rid, { config: { broadcast: { self: false, ack: false }, presence: { key: mpCid() } } });
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
        MP.state = 'ok'; MP.err = ''; MP.joinBusy = false; MP.retries = 0; MP._nextJoin = 0; MP._subOkAt = Date.now();
        try { await ch.track(mpPosPayload(true)); } catch (e) { /* bo qua */ }
        mpPresenceSync();
        mpSend('need', { cid: mpCid() });
        mpSend('pos', mpPosPayload(true));
        if (mpIsHost() && R.field) mpSendField(true);
        mpUi();
      } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
        // KHONG go kenh ngay — cho grace, chi recreate neu het grace
        MP.retries = (MP.retries || 0) + 1;
        MP.joinBusy = false;
        if (MP._subOkAt && Date.now() - MP._subOkAt < 5000) {
          MP.state = 'ok'; mpUi(); // blip ngan: giu OK, van gui pos
          return;
        }
        MP.state = 'retry'; mpUi();
        const wait = Math.min(18000, 4000 + MP.retries * 2500);
        MP._nextJoin = Date.now() + wait;
        clearTimeout(MP.reT); MP.reT = setTimeout(() => { if (mpCanPlay()) mpJoin(zoneOf(Math.min(S.stage, STAGES))); }, wait);
      } else if (st === 'CLOSED') {
        if (MP.ch === ch && MP.leaving !== ch) {
          MP.joinBusy = false;
          if (MP._subOkAt && Date.now() - MP._subOkAt < 5000) { MP.state = 'ok'; mpUi(); return; }
          MP.state = 'retry'; mpUi();
          const wait = Math.min(15000, 5000 + (MP.retries || 0) * 2000);
          MP._nextJoin = Date.now() + wait;
          clearTimeout(MP.reT); MP.reT = setTimeout(() => { if (mpCanPlay()) mpJoin(zoneOf(Math.min(S.stage, STAGES))); }, wait);
        }
      }
    });
  setTimeout(() => { if (MP.joinBusy && MP.ch === ch) MP.joinBusy = false; }, 8000);
}

function mpEnsure() {
  if (!mpCanPlay()) { mpUi(); return; }
  const zid = zoneOf(Math.min(S.stage, STAGES)).id;
  if (MP.ch && MP.zoneId === zid && mpChAlive(MP.ch)) {
    if (MP.state !== 'ok') { MP.state = 'ok'; MP._subOkAt = Date.now(); mpUi(); }
    return;
  }
  if (MP.state === 'load' || MP.joinBusy) return;
  if (MP._nextJoin && Date.now() < MP._nextJoin) return;
  // dang retry nhung chua den luc recreate
  if (MP.state === 'retry' && MP.ch && MP.zoneId === zid) return;
  mpJoin(zoneOf(Math.min(S.stage, STAGES)));
}

function mpInit() {
  mpDom(); mpUi();
  if (!netOn || !netOn()) return;
  setTimeout(mpEnsure, 600);
  setTimeout(mpEnsure, 2500);
  if (!MP.timer) MP.timer = setInterval(mpEnsure, 10000); // it poll hon — tranh recreate kenh
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (MP.state === 'ok') mpTrackNow(true); else mpEnsure(); } });
}

/* ---------- ve nguoi choi khac (hook render.js / combat.js) ---------- */
/* Noi suy: delay thich ung — dang chay gan live + extrapolate, dung yen buffer muot. */
function mpInterpAt(p, now) {
  const h = p.hist;
  if (!h || !h.length) return { x: p.tx, y: p.ty };
  const spd = Math.hypot(p.vx || 0, p.vy || 0);
  const delay = spd > 36 ? MP_DELAY : MP_DELAY_IDLE;
  const t = now - (p.clockOff || 0) - delay;
  if (h.length === 1) {
    const age = Math.min(MP_EXTRAP, Math.max(0, (t - h[0].t) / 1000));
    const vx = h[0].vx != null ? h[0].vx : (p.vx || 0), vy = h[0].vy != null ? h[0].vy : (p.vy || 0);
    return { x: h[0].x + vx * age, y: h[0].y + vy * age };
  }
  if (t <= h[0].t) return { x: h[0].x, y: h[0].y };
  const last = h[h.length - 1];
  if (t >= last.t) {
    const vx = last.vx != null ? last.vx : (p.vx || 0), vy = last.vy != null ? last.vy : (p.vy || 0);
    if (Math.hypot(vx, vy) < 10) return { x: last.x, y: last.y };
    // extrapolate + lead nhe khi dang chay (bu RTT ~30ms)
    const lead = spd > 36 ? 0.025 : 0;
    const u = Math.min(MP_EXTRAP, (t - last.t) / 1000 + lead);
    return { x: last.x + vx * u, y: last.y + vy * u };
  }
  for (let i = 1; i < h.length; i++) {
    if (t <= h[i].t) {
      const a = h[i - 1], b = h[i];
      let u = (t - a.t) / Math.max(1, b.t - a.t);
      // dang chay: noi suy thang (it tre hon smoothstep)
      if (spd <= 36) u = u * u * (3 - 2 * u);
      const dtSec = Math.max(0.035, (b.t - a.t) / 1000);
      const m0x = (a.vx != null ? a.vx : (b.x - a.x) / dtSec) * dtSec;
      const m0y = (a.vy != null ? a.vy : (b.y - a.y) / dtSec) * dtSec;
      const m1x = (b.vx != null ? b.vx : (b.x - a.x) / dtSec) * dtSec;
      const m1y = (b.vy != null ? b.vy : (b.y - a.y) / dtSec) * dtSec;
      const u2 = u * u, u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      return { x: h00 * a.x + h10 * m0x + h01 * b.x + h11 * m1x, y: h00 * a.y + h10 * m0y + h01 * b.y + h11 * m1y };
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
    const spd = Math.hypot(p.vx || 0, p.vy || 0);
    if (dist > MP_HARD) { p.rx = goal.x; p.ry = goal.y; }
    else if (spd > 40 && dist > 12) {
      // dang chay: bám goal nhanh (bot delay)
      const a = 1 - Math.exp(-dt * 40);
      p.rx += (goal.x - p.rx) * a; p.ry += (goal.y - p.ry) * a;
    } else {
      const rate = dist > MP_SNAP ? 20 : (dist > 28 ? 28 : 36);
      const a = 1 - Math.exp(-dt * rate);
      p.rx += (goal.x - p.rx) * a; p.ry += (goal.y - p.ry) * a;
    }
    p.x = p.rx; p.y = p.ry;
    p.actT = (p.actT || 0) + dt;
    if (p.act === 'at' && p.actT > 0.5) p.act = spd > 24 ? 'run' : 'st';
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
  MP.trackT = (MP.trackT || 0) + dt;
  const moving = !!(H.moving || (H.act || '') === 'run' || (H.act || '') === 'at');
  const gap = moving ? MP_POS : MP_POS_IDLE;
  if (MP.trackT >= gap) { MP.trackT = 0; mpTrackNow(); }
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
  // uu tien bo JX san sang; neu bo moi chua load — ve bo cu (tranh flash do ao trang <-> ao phai)
  let drawJo = null;
  if (Jo && typeof drawJxHero === 'function' && mpJxBodyReady(Jo, act)) { drawJo = Jo; p._joReady = Jo; }
  else if (p._joReady && typeof drawJxHero === 'function' && mpJxBodyReady(p._joReady, act)) drawJo = p._joReady;
  if (drawJo) h = drawJxHero(act, p.dir || 0, p.actT || 0, px, py, sc, 1, hw && hw.anim, drawJo) || 0;
  if (!h && !p._joReady && hw && hw.anim && typeof drawAnim === 'function') {
    h = drawAnim(hw.anim, act, p.dir || 0, p.actT || 0, px, py, sc) || 0;
  } else if (!h && !p._joReady && hw && typeof drawSprite === 'function') {
    drawSprite(img(hw.img), hw.sz, px, py, 0.85, p.face < 0, 0.92);
    h = 52;
  } else if (!h && !drawJo) {
    c.fillStyle = typeof campCol === 'function' ? campCol(p.fac) : '#c8e6c0';
    c.beginPath(); c.arc(px, py - 18, 12, 0, 7); c.fill();
    h = 40;
  }
  const col = typeof campCol === 'function' ? campCol(p.fac) : (NAME_COL && NAME_COL.hero) || '#fff3c0';
  const top = py - (h ? Math.min(h, 90) * 0.9 : 52) - 4;
  const fxId = p.titleId && typeof titleFxOf === 'function' ? titleFxOf(p.titleId) : (p.title === 'Thiên Hạ Đệ Nhất' ? 'thienha' : (p.title === 'GameMaster' ? 'gm' : null));
  let sub = p.title ? `«${p.title}»` : '';
  if (fxId && typeof drawTitleFx === 'function' && drawTitleFx(c, px, top - 10, fxId, p.title || '')) sub = '';
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
      const same = f && f.pts && (f.key === fieldKey() || (f.mp && MP.zoneId === zid));
      if (!same) {
        // khong _fieldBuild() local — tranh wipe/an-hien; xin lai host
        if (MP.fieldSnap && (MP.fieldSnap.key === fieldKey() || MP.fieldSnap.zone === zid)) mpApplyField(MP.fieldSnap);
        else if (!MP._needT || Date.now() - MP._needT > 1200) { MP._needT = Date.now(); mpSend('need', { cid: mpCid() }); }
        return;
      }
      for (const p of f.pts) {
        if (p.e && p.e.dead) { p.e = null; p.t = p.cls === 'boss' ? FLD_BOSS_RESPAWN : FLD_RESPAWN / (typeof mountHaste === 'function' ? mountHaste() : 1); }
        if (!p.e && p.t > 0) p.t -= dt;
        // khach KHONG tu spawn — chi host; tranh doi mid / luc an luc hien
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
