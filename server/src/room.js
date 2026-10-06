/**
 * Mot phong = 1 map zone.
 * Vi tri: client gui x/y (kinematic), server validate + relay — muot hon tich phan vx thuan.
 */
const TICK_HZ = 30;
const TICK_MS = 1000 / TICK_HZ;
const MAX_SPD = 280;          // px/s
const MAX_PEERS = 8;
const SNAP_META_EVERY = 15;   // ~0.5s kem name/fac/jx
const COAST_AFTER_MS = 55;    // het goi input: coast theo vx
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

    if (msg.x != null && msg.y != null) {
      const tx = +msg.x, ty = +msg.y;
      if (Number.isFinite(tx) && Number.isFinite(ty)) {
        const dist = Math.hypot(tx - p.x, ty - p.y);
        // Chap nhan trong ~0.5s di chuyen max — burst tunnel khong keo lech manh
        const maxStep = Math.max(MAX_SPD * 0.5 + 40, MAX_SPD * dtIn * 2.5 + 48);
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
      face: p.face, dir: p.dir, act: p.act, life: p.life
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
