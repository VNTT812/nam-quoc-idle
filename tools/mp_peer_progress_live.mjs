/**
 * Live 2-client test: A walks, B applies NEW upsert logic — peer must keep moving
 * even after a synthetic late/poison packet is injected.
 */
import { createClient } from '/tmp/node_modules/@supabase/supabase-js/dist/esm/index.js';
import fs from 'fs';

const URL = 'https://khwkokiflhzwxuzoilux.supabase.co';
const KEY = 'sb_publishable_4s1aei2J-OEdupk1EzbVvg_nqRtUG2u';
const ROOM = 'map:2';
const ts = Date.now();
const MP_HIST = 24;

function upsert(p, row, now) {
  const tx = +row.x, ty = +row.y;
  const seq = row.seq != null ? (row.seq | 0) : 0;
  const pt = row.t != null ? +row.t : now;
  const off = now - pt;
  let drop = false;
  if (seq && p.seq && seq <= p.seq) drop = true;
  else if (p._pt && pt + 80 < p._pt) drop = true;
  else if (off < -800 || off > 8000) drop = true;
  else if (p.clockOff && off > p.clockOff + 900) drop = true;
  if (drop) {
    if (seq && (!p.seq || seq > p.seq) && p._acceptAt && now - p._acceptAt > 450 && off >= 0 && off < 2000) {
      p.clockOff = off; p.seq = seq; drop = false;
    } else { p.seen = now; return false; }
  }
  if (!drop) {
    if (seq) p.seq = Math.max(p.seq || 0, seq);
    if (!p.clockOff) p.clockOff = off;
    else if (p.clockOff - off > 600) p.clockOff = off;
    else if (off < p.clockOff) p.clockOff = p.clockOff * 0.65 + off * 0.35;
    else p.clockOff = p.clockOff * 0.96 + off * 0.04;
    p.tx = tx; p.ty = ty; p._t = now; p._pt = Math.max(p._pt || 0, pt); p._acceptAt = now; p.seen = now;
    if (!p.hist) p.hist = [];
    p.hist.push({ t: pt, x: tx, y: ty });
    if (p.hist.length > MP_HIST) p.hist.shift();
    return true;
  }
  return false;
}

async function makeUser(tag) {
  const email = `mpprog_${tag}_${ts}@volamidle.com`;
  const password = 'testpass12345';
  const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error('no session');
  console.log(`[${tag}]`, data.user.id.slice(0, 8), email);
  return { sb, id: data.user.id, email };
}

function joinRoom(user, tag, onPos) {
  return new Promise((resolve, reject) => {
    const ch = user.sb.channel(ROOM, { config: { broadcast: { self: false }, presence: { key: user.id } } });
    let ready = false;
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (payload && payload.cid !== user.id) onPos(payload, Date.now());
    });
    ch.subscribe(async (st) => {
      if (st === 'SUBSCRIBED') {
        ready = true;
        try { await ch.track({ cid: user.id, name: tag, x: 0, y: 0 }); } catch (e) {}
        resolve(ch);
      } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') {
        if (!ready) reject(new Error(tag + ' ' + st));
      }
    });
    setTimeout(() => { if (!ready) reject(new Error(tag + ' timeout')); }, 12000);
  });
}

async function main() {
  const a = await makeUser('a');
  const b = await makeUser('b');
  const peer = { seq: 0, clockOff: 0, hist: [] };
  const samples = [];
  let accepted = 0, dropped = 0;

  // Inject poison BEFORE live packets: fake first late packet on B
  upsert(peer, { seq: 1, t: Date.now() - 3200, x: 50, y: 50, cid: a.id }, Date.now());
  console.log('poisoned clockOff=', peer.clockOff);

  const chB = await joinRoom(b, 'b', (p, recvAt) => {
    const ok = upsert(peer, p, recvAt);
    if (ok) accepted++; else dropped++;
    samples.push({ seq: p.seq, x: p.x, y: p.y, ok, tx: peer.tx, clockOff: peer.clockOff, lag: recvAt - p.t });
  });
  const chA = await joinRoom(a, 'a', () => {});

  let seq = 1; // A starts at 1; B already has synthetic seq 1 — real will be 2+
  const t0 = Date.now();
  await new Promise((res) => {
    const iv = setInterval(() => {
      const now = Date.now();
      const ang = (now - t0) / 500;
      seq++;
      chA.send({
        type: 'broadcast', event: 'pos',
        payload: {
          cid: a.id, seq, t: now,
          x: 400 + Math.cos(ang) * 80,
          y: 300 + Math.sin(ang) * 80,
          vx: -Math.sin(ang) * 160, vy: Math.cos(ang) * 160,
          act: 'run', name: 'walkerA'
        }
      });
      if (now - t0 > 3500) { clearInterval(iv); res(); }
    }, 33);
  });
  await new Promise(r => setTimeout(r, 400));

  const xs = samples.filter(s => s.ok).map(s => s.tx);
  const minX = xs.length ? Math.min(...xs) : null;
  const maxX = xs.length ? Math.max(...xs) : null;
  const span = (minX != null && maxX != null) ? maxX - minX : 0;
  const lags = samples.map(s => s.lag).filter(n => n > -500 && n < 5000).sort((a, b) => a - b);
  const pct = (p) => lags[Math.min(lags.length - 1, Math.floor(lags.length * p))] ?? null;

  const summary = {
    at: new Date().toISOString(),
    received: samples.length, accepted, dropped,
    peerSpanX: span, lastTx: peer.tx, lastTy: peer.ty, clockOff: peer.clockOff,
    lagP50: pct(0.5), lagP90: pct(0.9), lagMax: lags[lags.length - 1] ?? null,
    poisonRecovered: accepted >= 40 && span > 40
  };
  console.log('--- RESULT ---');
  console.log(JSON.stringify(summary, null, 2));
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync('/opt/cursor/artifacts/mp-peer-progress-live.json', JSON.stringify(summary, null, 2));

  try { await a.sb.removeChannel(chA); } catch (e) {}
  try { await b.sb.removeChannel(chB); } catch (e) {}
  await a.sb.auth.signOut(); await b.sb.auth.signOut();

  if (!summary.poisonRecovered) {
    console.error('FAIL: peer did not keep moving after poison');
    process.exit(1);
  }
  console.log('PASS: peer keeps moving after clockOff poison');
  process.exit(0);
}

main().catch(e => { console.error('FAIL', e); process.exit(1); });
