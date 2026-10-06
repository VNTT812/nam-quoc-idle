/**
 * Live test: 2 Supabase accounts join map:2, measure pos broadcast latency.
 */
import { createClient } from '@supabase/supabase-js';

const URL = 'https://khwkokiflhzwxuzoilux.supabase.co';
const KEY = 'sb_publishable_4s1aei2J-OEdupk1EzbVvg_nqRtUG2u';
const ROOM = 'map:2';
const ts = Date.now();

async function makeUser(tag) {
  const email = `mplat_${tag}_${ts}@volamidle.com`;
  const password = 'testpass12345';
  const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error('no session (confirm email?)');
  console.log(`[${tag}] ok`, data.user.id.slice(0, 8), email);
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
    setTimeout(() => { if (!ready) reject(new Error(tag + ' subscribe timeout')); }, 12000);
  });
}

async function main() {
  const a = await makeUser('a');
  const b = await makeUser('b');
  const samples = [];
  const chB = await joinRoom(b, 'b', (p, recvAt) => {
    if (p.seq != null && p.t != null) samples.push({ seq: p.seq, sendT: p.t, recvAt, lag: recvAt - p.t });
  });
  const chA = await joinRoom(a, 'a', () => {});

  // A walks in a circle, sending pos ~30Hz for 3s
  let seq = 0;
  const t0 = Date.now();
  await new Promise((res) => {
    const iv = setInterval(() => {
      const now = Date.now();
      const ang = (now - t0) / 500;
      seq++;
      chA.send({
        type: 'broadcast',
        event: 'pos',
        payload: {
          cid: a.id, seq, t: now,
          x: 400 + Math.cos(ang) * 80,
          y: 300 + Math.sin(ang) * 80,
          vx: -Math.sin(ang) * 160,
          vy: Math.cos(ang) * 160,
          act: 'run', name: 'testerA'
        }
      });
      if (now - t0 > 3000) { clearInterval(iv); res(); }
    }, 33);
  });

  await new Promise(r => setTimeout(r, 500));
  samples.sort((x, y) => x.seq - y.seq);
  const lags = samples.map(s => s.lag).filter(n => n > -500 && n < 5000);
  lags.sort((x, y) => x - y);
  const pct = (p) => lags[Math.min(lags.length - 1, Math.floor(lags.length * p))] ?? null;
  const avg = lags.length ? lags.reduce((a, b) => a + b, 0) / lags.length : null;

  console.log('--- RESULT ---');
  console.log('received', samples.length, 'pos packets');
  console.log('lag ms: min', lags[0], 'p50', pct(0.5), 'p90', pct(0.9), 'max', lags[lags.length - 1], 'avg', avg && avg.toFixed(1));
  console.log('accounts', a.email, b.email);

  try { await a.sb.removeChannel(chA); } catch (e) {}
  try { await b.sb.removeChannel(chB); } catch (e) {}
  await a.sb.auth.signOut();
  await b.sb.auth.signOut();

  // Write summary for artifacts
  const fs = await import('fs');
  fs.writeFileSync('/opt/cursor/artifacts/mp-latency-live.json', JSON.stringify({
    received: samples.length, lagMin: lags[0], lagP50: pct(0.5), lagP90: pct(0.9),
    lagMax: lags[lags.length - 1], lagAvg: avg, room: ROOM, at: new Date().toISOString()
  }, null, 2));

  if (!lags.length) process.exit(2);
  if (avg > 250) console.log('WARN: high network lag — client delay compounds this');
  else console.log('Network OK — client interp/spring is main delay source');
  process.exit(0);
}

main().catch(e => { console.error('FAIL', e); process.exit(1); });
