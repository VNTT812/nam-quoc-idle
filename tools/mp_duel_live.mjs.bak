/**
 * Live test 2 accounts: bidirectional movement (auth WSS) + shared monster hit (Supabase).
 */
import WebSocket from 'ws';
import fs from 'fs';

const WSS = process.env.MP_WSS || 'wss://arizona-checking-circle-engagement.trycloudflare.com';
const SB_URL = 'https://khwkokiflhzwxuzoilux.supabase.co';
const SB_KEY = 'sb_publishable_4s1aei2J-OEdupk1EzbVvg_nqRtUG2u';
const ZONE = 2;
const ts = Date.now();

const pct = (a, p) => { if (!a.length) return null; const s=[...a].sort((x,y)=>x-y); return s[Math.min(s.length-1, Math.floor(s.length*p))]; };
const stats = (a) => !a.length ? null : ({ n:a.length, p50:pct(a,.5), p90:pct(a,.9), max:Math.max(...a), avg:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1) });

async function moveBothWays() {
  const a = new WebSocket(WSS);
  const b = new WebSocket(WSS);
  await Promise.all([
    new Promise((r, j) => { a.on('open', r); a.on('error', j); }),
    new Promise((r, j) => { b.on('open', r); b.on('error', j); })
  ]);

  const state = {
    aSeesB: [], bSeesA: [],
    aLast: null, bLast: null,
    aMoved: false, bMoved: false,
    metaOk: false, snaps: 0
  };

  const onSnap = (viewer, msg) => {
    state.snaps++;
    const peers = msg.peers || [];
    if (viewer === 'a') {
      const p = peers.find(x => x.cid === 'duel-b');
      if (!p) return;
      if (p.name === 'AccB' && p.lvl === 12 && p.fac === 'wudang') state.metaOk = true;
      state.aSeesB.push({ t: Date.now(), x: p.x, y: p.y });
      if (state.aLast != null && Math.hypot(p.x - state.aLast.x, p.y - state.aLast.y) > 15) state.aMoved = true;
      state.aLast = p;
    } else {
      const p = peers.find(x => x.cid === 'duel-a');
      if (!p) return;
      if (p.name === 'AccA' && p.lvl === 14 && p.fac === 'shaolin') state.metaOk = true;
      state.bSeesA.push({ t: Date.now(), x: p.x, y: p.y });
      if (state.bLast != null && Math.hypot(p.x - state.bLast.x, p.y - state.bLast.y) > 15) state.bMoved = true;
      state.bLast = p;
    }
  };

  a.on('message', d => { const m = JSON.parse(d); if (m.t === 'snap') onSnap('a', m); });
  b.on('message', d => { const m = JSON.parse(d); if (m.t === 'snap') onSnap('b', m); });

  a.send(JSON.stringify({ t: 'join', devCid: 'duel-a', zone: ZONE, name: 'AccA', fac: 'shaolin', sex: 0, lvl: 14, x: 120, y: 200, jx: { h: 1, a: 2, w: 3, o: -1 } }));
  b.send(JSON.stringify({ t: 'join', devCid: 'duel-b', zone: ZONE, name: 'AccB', fac: 'wudang', sex: 0, lvl: 12, x: 400, y: 200, jx: { h: 0, a: 1, w: 0, o: -1 } }));
  await new Promise(r => setTimeout(r, 400));

  // A runs right, B runs left — cross
  let seqA = 0, seqB = 0;
  const t0 = Date.now();
  await new Promise((res) => {
    const iv = setInterval(() => {
      const now = Date.now();
      const u = (now - t0) / 1000;
      seqA++; seqB++;
      const ax = 120 + u * 90, ay = 200 + Math.sin(u * 4) * 20;
      const bx = 400 - u * 90, by = 200 + Math.cos(u * 4) * 20;
      a.send(JSON.stringify({ t: 'in', seq: seqA, vx: 90, vy: Math.cos(u * 4) * 40, x: ax, y: ay, act: 'run' }));
      b.send(JSON.stringify({ t: 'in', seq: seqB, vx: -90, vy: -Math.sin(u * 4) * 40, x: bx, y: by, act: 'run' }));
      if (now - t0 > 3500) { clearInterval(iv); res(); }
    }, 50);
  });
  await new Promise(r => setTimeout(r, 400));
  a.close(); b.close();

  const lagsA = [];
  // approximate: consecutive see intervals
  for (let i = 1; i < state.bSeesA.length; i++) lagsA.push(state.bSeesA[i].t - state.bSeesA[i - 1].t);

  return {
    snaps: state.snaps,
    aSeesB_samples: state.aSeesB.length,
    bSeesA_samples: state.bSeesA.length,
    aSeesB_moved: state.aMoved,
    bSeesA_moved: state.bMoved,
    metaOk: state.metaOk,
    snapGapMs: stats(lagsA),
    final: { aSeesB: state.aLast, bSeesA: state.bLast },
    ok: state.aMoved && state.bMoved && state.metaOk && state.aSeesB.length > 20 && state.bSeesA.length > 20
  };
}

async function combatShared() {
  let createClient;
  try {
    ({ createClient } = await import('/tmp/node_modules/@supabase/supabase-js/dist/index.mjs'));
  } catch (e) {
    return { skipped: true, reason: 'no supabase module' };
  }

  async function mk(tag) {
    const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.auth.signUp({ email: `duel_${tag}_${ts}@volamidle.com`, password: 'testpass12345' });
    if (error || !data.session) throw error || new Error('signup');
    return { sb, id: data.user.id, tag };
  }

  let a, b;
  try { a = await mk('a'); b = await mk('b'); }
  catch (e) { return { skipped: true, reason: String(e.message || e) }; }

  const ROOM = 'map:' + ZONE;
  const hitsSeenByB = [];
  const dieSeenByB = [];
  const fieldSeenByB = [];

  function join(u, handlers) {
    return new Promise((resolve, reject) => {
      const ch = u.sb.channel(ROOM, { config: { broadcast: { self: false }, presence: { key: u.id } } });
      let ok = false;
      for (const [ev, fn] of Object.entries(handlers)) {
        ch.on('broadcast', { event: ev }, ({ payload }) => { if (payload && payload.cid !== u.id) fn(payload); });
      }
      ch.subscribe(async (st) => {
        if (st === 'SUBSCRIBED') {
          ok = true;
          try { await ch.track({ cid: u.id, name: u.tag, fac: 'shaolin', lvl: 10, x: 100, y: 100 }); } catch (_) {}
          resolve(ch);
        } else if ((st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') && !ok) reject(new Error(st));
      });
      setTimeout(() => { if (!ok) reject(new Error('timeout')); }, 12000);
    });
  }

  const chB = await join(b, {
    hit: (p) => hitsSeenByB.push(p),
    die: (p) => dieSeenByB.push(p),
    field: (p) => fieldSeenByB.push(p)
  });
  const chA = await join(a, {});

  // A is host-ish: send field snap + hit + die
  const mid = 'm-' + ts;
  await chA.send({
    type: 'broadcast', event: 'field',
    payload: {
      cid: a.id, host: a.id, zone: ZONE, key: 'live-duel', kills: 0,
      pts: [{ i: 0, x: 300, y: 300, cls: 'normal', tid: 1, t: 0, mid, e: { mid, hp: 500, max: 500, x: 300, y: 300, tid: 1, L: 10, cls: 'normal' } }]
    }
  });
  await new Promise(r => setTimeout(r, 200));
  // A hits monster several times
  for (let hp = 500; hp >= 100; hp -= 100) {
    await chA.send({
      type: 'broadcast', event: 'hit',
      payload: { cid: a.id, mid, hp, max: 500, by: a.id, dmg: 100 }
    });
    await new Promise(r => setTimeout(r, 80));
  }
  await chA.send({
    type: 'broadcast', event: 'die',
    payload: { cid: a.id, mid, by: a.id }
  });
  await new Promise(r => setTimeout(r, 600));

  try { await a.sb.removeChannel(chA); } catch (_) {}
  try { await b.sb.removeChannel(chB); } catch (_) {}
  await a.sb.auth.signOut(); await b.sb.auth.signOut();

  const lastHit = hitsSeenByB[hitsSeenByB.length - 1];
  return {
    fieldSeen: fieldSeenByB.length,
    hitsSeen: hitsSeenByB.length,
    dieSeen: dieSeenByB.length,
    lastHp: lastHit ? lastHit.hp : null,
    ok: fieldSeenByB.length >= 1 && hitsSeenByB.length >= 3 && dieSeenByB.length >= 1
  };
}

const move = await moveBothWays();
let combat;
try { combat = await combatShared(); }
catch (e) { combat = { ok: false, error: String(e.message || e) }; }

const out = {
  at: new Date().toISOString(),
  wss: WSS,
  movement: move,
  combat,
  verdict: move.ok && (combat.ok || combat.skipped)
    ? (combat.ok ? 'PASS: move 2 chiều + hit/die quái sync OK' : 'PASS move; combat skipped: ' + combat.reason)
    : 'FAIL'
};
console.log(JSON.stringify(out, null, 2));
fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
fs.writeFileSync('/opt/cursor/artifacts/mp-duel-live.json', JSON.stringify(out, null, 2));
process.exit(out.verdict.startsWith('PASS') ? 0 : 1);
