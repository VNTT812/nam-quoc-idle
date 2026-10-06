/**
 * Live: A walks via auth WSS; B applies NEW client hist+interp+smooth logic;
 * measure max visual jump per frame (teleport detector).
 */
import WebSocket from 'ws';
import fs from 'fs';

const WSS = (fs.existsSync('/tmp/mp-cf-tunnel.url')
  ? fs.readFileSync('/tmp/mp-cf-tunnel.url', 'utf8').trim().replace('https', 'wss')
  : 'ws://127.0.0.1:3847');

const MP_DELAY = 90, MP_DELAY_IDLE = 110, MP_HIST = 48, MP_EXTRAP = 0.12, MP_HARD = 1400, MP_MAX_SPD = 300;

function upsert(p, row, now) {
  const tx = +row.x, ty = +row.y;
  const seq = row.seq | 0;
  const pt = +row.t;
  const off = now - pt;
  let drop = false;
  if (seq && p.seq && seq <= p.seq) drop = true;
  else if (p._pt && pt + 80 < p._pt) drop = true;
  else if (off < -800 || off > 8000) drop = true;
  else if (p.clockOff && off > p.clockOff + 900) drop = true;
  if (drop) { p.seen = now; return false; }
  if (seq) p.seq = Math.max(p.seq || 0, seq);
  if (!p.clockOff) p.clockOff = off;
  else if (p.clockOff - off > 600) p.clockOff = p.clockOff * 0.4 + off * 0.6;
  else if (off < p.clockOff) p.clockOff = p.clockOff * 0.7 + off * 0.3;
  else p.clockOff = p.clockOff * 0.97 + off * 0.03;
  let vx = +row.vx || 0, vy = +row.vy || 0;
  const spd = Math.hypot(vx, vy);
  if (spd > MP_MAX_SPD) { const k = MP_MAX_SPD / spd; vx *= k; vy *= k; }
  if (spd < 6) { vx = 0; vy = 0; }
  p.vx = p.vx != null ? p.vx * 0.45 + vx * 0.55 : vx;
  p.vy = p.vy != null ? p.vy * 0.45 + vy * 0.55 : vy;
  p.tx = tx; p.ty = ty; p._pt = Math.max(p._pt || 0, pt); p.seen = now;
  if (!p.hist) p.hist = [];
  const last = p.hist[p.hist.length - 1];
  const ht = pt;
  if (!last || Math.hypot(tx - last.x, ty - last.y) > 0.5 || ht - last.t > 30) {
    if (last) {
      const gap = Math.hypot(tx - last.x, ty - last.y);
      const dtH = ht - last.t;
      if (gap > 48 && dtH > 0 && dtH < 800) {
        const n = Math.min(4, Math.max(1, Math.floor(gap / 70)));
        for (let i = 1; i <= n; i++) {
          const u = i / (n + 1);
          p.hist.push({ t: last.t + dtH * u, x: last.x + (tx - last.x) * u, y: last.y + (ty - last.y) * u, vx: p.vx, vy: p.vy });
        }
      }
    }
    p.hist.push({ t: ht, x: tx, y: ty, vx: p.vx, vy: p.vy });
    while (p.hist.length > MP_HIST) p.hist.shift();
  }
  if (p.rx == null) { p.rx = tx; p.ry = ty; }
  return true;
}

function interp(p, now) {
  const h = p.hist; if (!h?.length) return { x: p.tx, y: p.ty };
  const spd = Math.hypot(p.vx || 0, p.vy || 0);
  const delay = spd > 36 ? MP_DELAY : MP_DELAY_IDLE;
  const t = now - (p.clockOff || 0) - delay;
  if (h.length === 1) return { x: h[0].x, y: h[0].y };
  if (t <= h[0].t) return { x: h[0].x, y: h[0].y };
  const last = h[h.length - 1];
  if (t >= last.t) {
    const vx = last.vx || 0, vy = last.vy || 0;
    const u = Math.min(MP_EXTRAP, Math.max(0, (t - last.t) / 1000));
    return { x: last.x + vx * u, y: last.y + vy * u };
  }
  for (let i = 1; i < h.length; i++) {
    if (t <= h[i].t) {
      const a = h[i - 1], b = h[i];
      let u = (t - a.t) / Math.max(1, b.t - a.t);
      u = Math.max(0, Math.min(1, u));
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
  }
  return { x: last.x, y: last.y };
}

function smooth(p, goal, dt) {
  const dist = Math.hypot(goal.x - p.rx, goal.y - p.ry);
  const spd = Math.hypot(p.vx || 0, p.vy || 0);
  if (dist > MP_HARD) { p.rx = goal.x; p.ry = goal.y; return dist; }
  if (dist > 0.05) {
    const cap = Math.max(160, spd * 1.25 + 40) * dt;
    if (dist <= cap) { p.rx = goal.x; p.ry = goal.y; }
    else {
      const k = cap / dist;
      p.rx += (goal.x - p.rx) * k;
      p.ry += (goal.y - p.ry) * k;
    }
  }
  return Math.hypot(goal.x - p.rx, goal.y - p.ry) < dist ? dist : Math.hypot(goal.x - p.rx, goal.y - p.ry);
}

const a = new WebSocket(WSS);
const b = new WebSocket(WSS);
await Promise.all([
  new Promise((r, j) => { a.on('open', r); a.on('error', j); }),
  new Promise((r, j) => { b.on('open', r); b.on('error', j); })
]);

const peer = { seq: 0, clockOff: 0, hist: [] };
const jumps = [];
let prev = null, frames = 0, teleports = 0;

b.on('message', (buf) => {
  const m = JSON.parse(buf);
  if (m.t !== 'snap') return;
  const row = (m.peers || []).find(x => x.cid === 'sm-a');
  if (!row) return;
  upsert(peer, { ...row, t: m.serverT, seq: m.tick | 0 }, Date.now());
});

a.send(JSON.stringify({ t: 'join', devCid: 'sm-a', zone: 2, name: 'Runner', fac: 'shaolin', lvl: 20, x: 100, y: 200 }));
b.send(JSON.stringify({ t: 'join', devCid: 'sm-b', zone: 2, name: 'Viewer', fac: 'wudang', lvl: 20, x: 300, y: 200 }));
await new Promise(r => setTimeout(r, 400));

let seq = 0;
const t0 = Date.now();
const walk = setInterval(() => {
  const now = Date.now();
  const u = (now - t0) / 1000;
  seq++;
  // circle + direction changes (stress tele)
  a.send(JSON.stringify({
    t: 'in', seq,
    vx: -Math.sin(u * 2.2) * 150,
    vy: Math.cos(u * 2.2) * 150,
    x: 400 + Math.cos(u * 2.2) * 100,
    y: 300 + Math.sin(u * 2.2) * 100,
    act: 'run'
  }));
}, 33);

// render sim 60fps
const rend = setInterval(() => {
  if (!peer.hist?.length) return;
  const now = Date.now();
  const goal = interp(peer, now);
  if (peer.rx == null) { peer.rx = goal.x; peer.ry = goal.y; prev = { x: peer.rx, y: peer.ry }; return; }
  smooth(peer, goal, 1 / 60);
  frames++;
  if (prev) {
    const j = Math.hypot(peer.rx - prev.x, peer.ry - prev.y);
    jumps.push(j);
    if (j > 40) teleports++; // >40px in one 16ms frame ≈ tele visual
  }
  prev = { x: peer.rx, y: peer.ry };
}, 16);

await new Promise(r => setTimeout(r, 4500));
clearInterval(walk); clearInterval(rend);
await new Promise(r => setTimeout(r, 200));
a.close(); b.close();

jumps.sort((x, y) => x - y);
const pct = (p) => jumps[Math.min(jumps.length - 1, Math.floor(jumps.length * p))] ?? null;
const out = {
  at: new Date().toISOString(), wss: WSS, frames,
  jumpPx: {
    n: jumps.length,
    p50: +((pct(0.5) || 0).toFixed(2)),
    p90: +((pct(0.9) || 0).toFixed(2)),
    p99: +((pct(0.99) || 0).toFixed(2)),
    max: +((jumps[jumps.length - 1] || 0).toFixed(2))
  },
  teleportsOver40px: teleports,
  ok: teleports === 0 && (pct(0.99) || 0) < 25 && (jumps[jumps.length - 1] || 0) < 45
};
console.log(JSON.stringify(out, null, 2));
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
fs.writeFileSync('/opt/cursor/artifacts/mp-smooth-render-live.json', JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
