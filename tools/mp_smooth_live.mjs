/**
 * Live smoothness test:
 *  A) Dedicated auth WS server (local)
 *  B) Supabase Realtime broadcast (if reachable)
 * Metrics: input→see lag, snap interval jitter, position stutter (dx variance)
 */
import WebSocket from 'ws';
import fs from 'fs';

const AUTH = 'ws://127.0.0.1:3847';
const pct = (arr, p) => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor(a.length * p))];
};
const stats = (arr) => {
  if (!arr.length) return null;
  const sum = arr.reduce((s, x) => s + x, 0);
  const avg = sum / arr.length;
  const v = arr.reduce((s, x) => s + (x - avg) ** 2, 0) / arr.length;
  return { n: arr.length, min: Math.min(...arr), p50: pct(arr, 0.5), p90: pct(arr, 0.9), p99: pct(arr, 0.99), max: Math.max(...arr), avg: +avg.toFixed(2), std: +Math.sqrt(v).toFixed(2) };
};

async function testAuth(seconds = 4) {
  const a = new WebSocket(AUTH);
  const b = new WebSocket(AUTH);
  await Promise.all([
    new Promise((r, j) => { a.on('open', r); a.on('error', j); }),
    new Promise((r, j) => { b.on('open', r); b.on('error', j); })
  ]);
  a.send(JSON.stringify({ t: 'join', devCid: 'smooth-a', zone: 2, name: 'Walker', fac: 'shaolin', lvl: 14, x: 100, y: 200, jx: { h: 1, a: 2, w: 0, o: -1 } }));
  b.send(JSON.stringify({ t: 'join', devCid: 'smooth-b', zone: 2, name: 'Watcher', fac: 'wudang', lvl: 10, x: 300, y: 200 }));

  const lags = [], intervals = [], dxs = [];
  let lastSnapAt = 0, lastX = null, snaps = 0;
  const pending = new Map(); // seq -> sendAt, expectedX roughly

  b.on('message', (buf) => {
    const m = JSON.parse(buf);
    if (m.t !== 'snap') return;
    const now = Date.now();
    snaps++;
    if (lastSnapAt) intervals.push(now - lastSnapAt);
    lastSnapAt = now;
    const p = (m.peers || []).find(x => x.cid === 'smooth-a');
    if (!p) return;
    if (lastX != null) dxs.push(p.x - lastX);
    lastX = p.x;
    // match newest pending input by time
    let best = null;
    for (const [seq, info] of pending) {
      if (!best || info.sendAt > best.sendAt) best = { seq, ...info };
    }
    if (best && now - best.sendAt < 500) {
      lags.push(now - best.sendAt);
      // clear older
      for (const [seq, info] of [...pending]) if (info.sendAt <= best.sendAt) pending.delete(seq);
    }
  });

  await new Promise(r => setTimeout(r, 250));
  const t0 = Date.now();
  let seq = 0;
  await new Promise((res) => {
    const iv = setInterval(() => {
      const now = Date.now();
      const ang = (now - t0) / 400;
      seq++;
      const vx = -Math.sin(ang) * 150;
      const vy = Math.cos(ang) * 150;
      const x = 400 + Math.cos(ang) * 80;
      const y = 300 + Math.sin(ang) * 80;
      pending.set(seq, { sendAt: now, x, y });
      if (pending.size > 40) pending.delete(seq - 40);
      a.send(JSON.stringify({ t: 'in', seq, vx, vy, x, y, act: 'run', face: 1, dir: 0 }));
      if (now - t0 > seconds * 1000) { clearInterval(iv); res(); }
    }, 50); // 20Hz input like client
  });
  await new Promise(r => setTimeout(r, 300));
  a.close(); b.close();

  // stutter score: dx should be fairly steady while circling; high std of |dx| = jittery
  const adx = dxs.map(Math.abs).filter(x => x < 80);
  return {
    mode: 'auth-server',
    snaps,
    lagMs: stats(lags),
    snapIntervalMs: stats(intervals),
    stepAbsPx: stats(adx),
    smooth: lags.length && stats(lags).p90 < 80 && stats(intervals).p90 < 80 && (stats(adx)?.std ?? 99) < 8
  };
}

async function testSupabase(seconds = 3.5) {
  let createClient;
  try {
    ({ createClient } = await import('/tmp/node_modules/@supabase/supabase-js/dist/index.mjs'));
  } catch {
    return { mode: 'supabase', skipped: true, reason: 'no supabase-js' };
  }
  const URL = 'https://khwkokiflhzwxuzoilux.supabase.co';
  const KEY = 'sb_publishable_4s1aei2J-OEdupk1EzbVvg_nqRtUG2u';
  const ROOM = 'map:smooth_' + Date.now();
  const ts = Date.now();

  async function user(tag) {
    const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.signUp({ email: `smooth_${tag}_${ts}@volamidle.com`, password: 'testpass12345' });
    if (error || !data.session) throw error || new Error('no session');
    return { sb, id: data.user.id };
  }

  let a, b;
  try { a = await user('a'); b = await user('b'); }
  catch (e) { return { mode: 'supabase', skipped: true, reason: String(e.message || e) }; }

  const lags = [], intervals = [];
  let lastAt = 0, snaps = 0;
  const pending = new Map();

  function join(u, onPos) {
    return new Promise((resolve, reject) => {
      const ch = u.sb.channel(ROOM, { config: { broadcast: { self: false }, presence: { key: u.id } } });
      let ok = false;
      ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
        if (payload && payload.cid !== u.id) onPos(payload, Date.now());
      });
      ch.subscribe(async (st) => {
        if (st === 'SUBSCRIBED') {
          ok = true;
          try { await ch.track({ cid: u.id, name: 'x' }); } catch (_) {}
          resolve(ch);
        } else if ((st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') && !ok) reject(new Error(st));
      });
      setTimeout(() => { if (!ok) reject(new Error('timeout')); }, 12000);
    });
  }

  const chB = await join(b, (p, now) => {
    snaps++;
    if (lastAt) intervals.push(now - lastAt);
    lastAt = now;
    if (p.seq != null && pending.has(p.seq)) {
      lags.push(now - pending.get(p.seq));
      pending.delete(p.seq);
    } else if (p.t != null) lags.push(now - p.t);
  });
  const chA = await join(a, () => {});

  let seq = 0;
  const t0 = Date.now();
  await new Promise((res) => {
    const iv = setInterval(() => {
      const now = Date.now();
      seq++;
      pending.set(seq, now);
      chA.send({
        type: 'broadcast', event: 'pos',
        payload: {
          cid: a.id, seq, t: now,
          x: 400 + Math.cos(now / 400) * 80,
          y: 300 + Math.sin(now / 400) * 80,
          vx: 100, vy: 0, act: 'run',
          name: 'Walker', fac: 'shaolin', lvl: 14
        }
      });
      if (now - t0 > seconds * 1000) { clearInterval(iv); res(); }
    }, 33);
  });
  await new Promise(r => setTimeout(r, 400));
  try { await a.sb.removeChannel(chA); } catch (_) {}
  try { await b.sb.removeChannel(chB); } catch (_) {}
  await a.sb.auth.signOut(); await b.sb.auth.signOut();

  return {
    mode: 'supabase-realtime',
    snaps,
    lagMs: stats(lags),
    snapIntervalMs: stats(intervals),
    // client buffer ~12ms + spring still on top of this network lag
    perceivedEstMs: stats(lags) ? { p50: stats(lags).p50 + 12, p90: stats(lags).p90 + 30 } : null,
    smooth: lags.length && stats(lags).p90 < 120
  };
}

const auth = await testAuth(4);
let sb;
try { sb = await testSupabase(3.5); }
catch (e) { sb = { mode: 'supabase', error: String(e.message || e) }; }

const out = {
  at: new Date().toISOString(),
  auth,
  supabase: sb,
  verdict: auth.smooth
    ? 'AUTH server: mượt (lag p90 < 80ms, snap ổn). Pages mặc định vẫn Supabase trừ khi ?mp_auth=1.'
    : 'AUTH server vẫn giật — cần chỉnh tick/buffer.'
};
console.log(JSON.stringify(out, null, 2));
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
fs.writeFileSync('/opt/cursor/artifacts/mp-smooth-live.json', JSON.stringify(out, null, 2));
process.exit(auth.smooth ? 0 : 1);
