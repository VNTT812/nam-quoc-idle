/**
 * Mot phong = 1 map zone. Server tick la nguon dung vi tri.
 */
const TICK_HZ = 20;
const TICK_MS = 1000 / TICK_HZ;
const MAX_SPD = 280;          // px/s — khop client ~150*speed, cho buffer
const MAX_PEERS = 8;
const SNAP_META_EVERY = 10;   // moi 10 tick kem name/fac/jx

export class Room {
  constructor(zoneId) {
    this.zoneId = zoneId;
    this.players = new Map(); // cid -> Player
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

  /** Client gui input: van toc mong muon (+ optional predicted x/y de reconcile). */
  onInput(cid, msg) {
    const p = this.players.get(cid);
    if (!p) return;
    const seq = msg.seq | 0;
    if (seq && seq <= p.inSeq) return;
    p.inSeq = seq || p.inSeq;
    p.lastIn = Date.now();
    p.seen = p.lastIn;

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

    // Soft reconcile: chap nhan predicted neu lech nhe; reject teleport
    if (msg.x != null && msg.y != null) {
      const dx = +msg.x - p.x, dy = +msg.y - p.y;
      const dist = Math.hypot(dx, dy);
      const slack = MAX_SPD * (TICK_MS / 1000) * 3 + 40;
      if (dist <= slack) {
        p.x = +msg.x; p.y = +msg.y;
      }
      // neu lech xa: bo qua predicted — server giu quyen
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
      // timeout khong input: dung yen
      if (now - p.lastIn > 400) { p.vx = 0; p.vy = 0; if (p.act === 'run') p.act = 'st'; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // clamp map nhe (field ~800x600 thuong dung)
      p.x = Math.max(40, Math.min(2000, p.x));
      p.y = Math.max(40, Math.min(1600, p.y));
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
