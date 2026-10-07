/**
 * Mot phong = 1 map zone.
 * Vi tri: client gui x/y (kinematic), server validate + relay — muot hon tich phan vx thuan.
 */
const TICK_HZ = 40;           // khop client 40Hz — snap day, peer muot hon
const TICK_MS = 1000 / TICK_HZ;
const MAX_SPD = 280;          // px/s
const MAX_PEERS = 8;
const SNAP_META_EVERY = 20;   // ~0.5s kem name/fac/jx
const COAST_AFTER_MS = 40;    // het goi input: coast theo vx (40Hz ~25ms)
const STOP_AFTER_MS = 900;    // het tin hieu lau: dung
/* Map client WORLD = 3072x3072 — TRUOC DAY clamp 2000x1600 → peer dinh mép, nhìn đứng yên */
const MAP_MIN = 20, MAP_MAX_X = 3200, MAP_MAX_Y = 3200;

export class Room {
  constructor(zoneId) {
    this.zoneId = zoneId;
    this.players = new Map();
    this.tickN = 0;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  empty() {
    return this.players.size === 0;
  }

  join(ws, meta) {
    const cid = meta.cid;
    if (this.players.size >= MAX_PEERS && !this.players.has(cid)) {
      ws.send(JSON.stringify({ t: 'err', msg: 'Phòng đầy' }));
      return null;
    }
    let p = this.players.get(cid);
    if (p) {
      try { p.ws.close(4000, 'replaced'); } catch (_) {}
    }
    p = {
      cid,
      ws,
      name: String(meta.name || 'Võ lâm').slice(0, 16),
      fac: meta.fac || '',
      sex: meta.sex | 0,
      lvl: meta.lvl | 0,
      jx: meta.jx && typeof meta.jx === 'object' ? meta.jx : null,
      title: meta.title || '',
      titleId: meta.titleId || '',
      titleCol: meta.titleCol || '',
      x: Number.isFinite(+meta.x) ? +meta.x : 400,
      y: Number.isFinite(+meta.y) ? +meta.y : 300,
      vx: 0, vy: 0,
      face: 1, dir: 0, act: 'st',
      life: 1,
      pk: false,
      inSeq: 0,
      lastIn: Date.now(),
      seen: Date.now()
    };
    this.players.set(cid, p);
    ws.send(JSON.stringify({
      t: 'welcome',
      zone: this.zoneId,
      tickHz: TICK_HZ,
      you: this.publicOne(p, true)
    }));
    return p;
  }

  leave(cid) {
    this.players.delete(cid);
  }

  /** Client gui x/y (+ vx/vy). Server validate buoc nhay, relay cho peer. */
  onInput(cid, msg) {
    const p = this.players.get(cid);
    if (!p) return;
    const seq = msg.seq | 0;
    if (seq && seq <= p.inSeq) return;
    p.inSeq = seq || p.inSeq;
    const now = Date.now();
    const dtIn = Math.min(0.25, Math.max(0.016, (now - p.lastIn) / 1000));
    p.lastIn = now;
    p.seen = now;

    let vx = +msg.vx || 0, vy = +msg.vy || 0;
    const spd = Math.hypot(vx, vy);
    if (spd > MAX_SPD) {
      const k = MAX_SPD / spd;
      vx *= k; vy *= k;
    }
    if (spd < 6) { vx = 0; vy = 0; }
    p.vx = vx; p.vy = vy;
    if (msg.face != null) p.face = msg.face >= 0 ? 1 : -1;
    if (msg.dir != null) p.dir = msg.dir | 0;
    if (msg.act != null) p.act = String(msg.act).slice(0, 8);
    if (msg.life != null) p.life = Math.max(0, Math.min(1, +msg.life));
    if (msg.pk != null) p.pk = !!msg.pk;

    if (msg.x != null && msg.y != null) {
      const tx = +msg.x, ty = +msg.y;
      if (Number.isFinite(tx) && Number.isFinite(ty)) {
        const dist = Math.hypot(tx - p.x, ty - p.y);
        // Chap nhan trong ~0.7s di chuyen — bot keo lech khi tunnel jitter
        const maxStep = Math.max(MAX_SPD * 0.7 + 60, MAX_SPD * dtIn * 3 + 64);
        if (dist <= maxStep) {
          p.x = tx; p.y = ty;
        } else {
          const k = maxStep / dist;
          p.x += (tx - p.x) * k;
          p.y += (ty - p.y) * k;
        }
      }
    }
  }

  onMeta(cid, msg) {
    const p = this.players.get(cid);
    if (!p) return;
    if (msg.name != null) p.name = String(msg.name).slice(0, 16);
    if (msg.fac != null) p.fac = msg.fac;
    if (msg.sex != null) p.sex = msg.sex | 0;
    if (msg.lvl != null) p.lvl = msg.lvl | 0;
    if (msg.jx && typeof msg.jx === 'object') p.jx = msg.jx;
    if (msg.title != null) p.title = String(msg.title).slice(0, 24);
    if (msg.titleId != null) p.titleId = String(msg.titleId).slice(0, 24);
    if (msg.titleCol != null) p.titleCol = msg.titleCol;
  }

  /** Relay hieu ung chieu — khong validate damage (client van tu xu ly hit). */
  onSkill(cid, msg) {
    const p = this.players.get(cid);
    if (!p || !msg) return;
    const now = Date.now();
    // chong spam: toi da ~12 goi / giay / nguoi
    if (p._skAt && now - p._skAt < 70) {
      if ((p._skN | 0) >= 8) return;
      p._skN = (p._skN | 0) + 1;
    } else { p._skAt = now; p._skN = 1; }
    if (msg.act === 'at' || msg.face != null || msg.dir != null) {
      p.act = 'at';
      if (msg.face != null) p.face = msg.face >= 0 ? 1 : -1;
      if (msg.dir != null) p.dir = msg.dir | 0;
    }
    const body = JSON.stringify({
      t: 'skill',
      cid,
      id: msg.id | 0,
      L: msg.L | 0,
      nMis: msg.nMis | 0,
      melee: !!msg.melee,
      around: !!msg.around,
      cast: msg.cast ? 1 : 0,
      mid: msg.mid || null,
      ax: msg.ax != null ? +msg.ax : Math.round(p.x),
      ay: msg.ay != null ? +msg.ay : Math.round(p.y),
      bx: msg.bx != null ? +msg.bx : Math.round(p.x),
      by: msg.by != null ? +msg.by : Math.round(p.y),
      face: p.face,
      dir: p.dir,
      t0: Number.isFinite(+msg.t0) ? +msg.t0 : undefined,
      serverT: now
    });
    for (const o of this.players.values()) {
      if (o.cid === cid) continue;
      if (o.ws.readyState === 1) {
        try { o.ws.send(body); } catch (_) {}
      }
    }
  }

  onPkFlag(cid, msg) {
    const p = this.players.get(cid);
    if (!p) return;
    p.pk = !!(msg && msg.pk);
    const body = JSON.stringify({ t: 'pkflag', cid, pk: p.pk ? 1 : 0, serverT: Date.now() });
    for (const o of this.players.values()) {
      if (o.cid === cid) continue;
      if (o.ws.readyState === 1) {
        try { o.ws.send(body); } catch (_) {}
      }
    }
  }

  onPkHit(cid, msg) {
    const p = this.players.get(cid);
    if (!p || !msg || !msg.to) return;
    const now = Date.now();
    if (p._pkHitAt && now - p._pkHitAt < 80) {
      if ((p._pkHitN | 0) >= 6) return;
      p._pkHitN = (p._pkHitN | 0) + 1;
    } else { p._pkHitAt = now; p._pkHitN = 1; }
    p.act = 'at';
    if (msg.face != null) p.face = msg.face >= 0 ? 1 : -1;
    if (msg.dir != null) p.dir = msg.dir | 0;
    const body = JSON.stringify({
      t: 'pkhit',
      cid,
      to: String(msg.to),
      dmg: Math.max(0, Math.min(50000, Math.round(+msg.dmg || 0))),
      id: msg.id | 0,
      L: msg.L | 0,
      nMis: msg.nMis | 0,
      melee: !!msg.melee,
      around: !!msg.around,
      ax: msg.ax != null ? +msg.ax : Math.round(p.x),
      ay: msg.ay != null ? +msg.ay : Math.round(p.y),
      bx: msg.bx != null ? +msg.bx : 0,
      by: msg.by != null ? +msg.by : 0,
      face: p.face,
      dir: p.dir,
      crit: msg.crit ? 1 : 0,
      t0: Number.isFinite(+msg.t0) ? +msg.t0 : undefined,
      serverT: now
    });
    for (const o of this.players.values()) {
      if (o.cid === cid) continue;
      if (o.ws.readyState === 1) {
        try { o.ws.send(body); } catch (_) {}
      }
    }
  }

  onPkKill(cid, msg) {
    if (!msg) return;
    const body = JSON.stringify({
      t: 'pkkill',
      cid,
      victim: msg.victim || null,
      by: msg.by || cid,
      serverT: Date.now()
    });
    for (const o of this.players.values()) {
      if (o.ws.readyState === 1) {
        try { o.ws.send(body); } catch (_) {}
      }
    }
  }

  tick() {
    this.tickN++;
    const dt = TICK_MS / 1000;
    const now = Date.now();
    for (const p of this.players.values()) {
      const age = now - p.lastIn;
      if (age >= STOP_AFTER_MS) {
        p.vx = 0; p.vy = 0;
        if (p.act === 'run') p.act = 'st';
      } else if (age > COAST_AFTER_MS) {
        // gap ngan / tunnel burst: coast theo van toc cu
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      p.x = Math.max(MAP_MIN, Math.min(MAP_MAX_X, p.x));
      p.y = Math.max(MAP_MIN, Math.min(MAP_MAX_Y, p.y));
    }
    this.broadcastSnap();
  }

  publicOne(p, full) {
    const o = {
      cid: p.cid,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      vx: Math.round(p.vx * 10) / 10,
      vy: Math.round(p.vy * 10) / 10,
      face: p.face, dir: p.dir, act: p.act, life: p.life,
      pk: p.pk ? 1 : 0
    };
    if (full) {
      o.name = p.name; o.fac = p.fac; o.sex = p.sex; o.lvl = p.lvl;
      o.jx = p.jx; o.title = p.title; o.titleId = p.titleId; o.titleCol = p.titleCol;
    }
    return o;
  }

  broadcastSnap() {
    const full = this.tickN % SNAP_META_EVERY === 0;
    const peers = [];
    for (const p of this.players.values()) peers.push(this.publicOne(p, full));
    const body = JSON.stringify({
      t: 'snap',
      tick: this.tickN,
      tickHz: TICK_HZ,
      zone: this.zoneId,
      full: !!full,
      serverT: Date.now(),
      peers
    });
    for (const p of this.players.values()) {
      if (p.ws.readyState === 1) {
        try { p.ws.send(body); } catch (_) {}
      }
    }
  }
}
