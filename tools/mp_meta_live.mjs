/**
 * Live test: A sends light-then-full style pos like the game; B must get name/fac/lvl/jx
 * even when joining "late" (only receiving broadcasts, simulating missing presence).
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const URL = 'https://khwkokiflhzwxuzoilux.supabase.co';
const KEY = 'sb_publishable_4s1aei2J-OEdupk1EzbVvg_nqRtUG2u';
const ROOM = 'map:2';
const ts = Date.now();

async function makeUser(tag) {
  const email = `mpmeta_${tag}_${ts}@volamidle.com`;
  const password = 'testpass12345';
  const sb = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error('no session');
  return { sb, id: data.user.id, email, tag };
}

function join(user, onPos, onWho) {
  return new Promise((resolve, reject) => {
    const ch = user.sb.channel(ROOM, { config: { broadcast: { self: false }, presence: { key: user.id } } });
    let ready = false;
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => { if (payload?.cid !== user.id) onPos?.(payload); });
    ch.on('broadcast', { event: 'who' }, ({ payload }) => { if (payload?.cid !== user.id) onWho?.(payload, ch); });
    ch.subscribe(async (st) => {
      if (st === 'SUBSCRIBED') {
        ready = true;
        try {
          await ch.track({
            cid: user.id, name: user.tag === 'a' ? 'TesterA' : 'TesterB',
            fac: 'shaolin', sex: 0, lvl: 14,
            jx: { h: 1, a: 2, w: 3, o: -1 }
          });
        } catch (e) {}
        resolve(ch);
      } else if ((st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') && !ready) reject(new Error(st));
    });
    setTimeout(() => { if (!ready) reject(new Error('timeout')); }, 12000);
  });
}

async function main() {
  const a = await makeUser('a');
  const b = await makeUser('b');

  // B joins first and only listens to pos (ignore presence) — worst case
  const peer = { name: 'Võ lâm', fac: '', lvl: 0, jx: null };
  const apply = (p) => {
    if (p.name != null) peer.name = p.name;
    if (p.fac != null) peer.fac = p.fac;
    if (p.lvl != null) peer.lvl = p.lvl | 0;
    if (p.jx && typeof p.jx === 'object') peer.jx = p.jx;
    peer.x = p.x; peer.y = p.y;
  };
  let whoHits = 0;
  const chB = await join(b, apply, () => {});
  // A joins later; answers who + sends pos with always-on meta (new protocol)
  const chA = await join(a, () => {}, (_p, ch) => {
    whoHits++;
    ch.send({
      type: 'broadcast', event: 'pos',
      payload: {
        cid: a.id, seq: 999, t: Date.now(), x: 400, y: 300, vx: 0, vy: 0,
        name: 'HomNayAnhMet', fac: 'shaolin', sex: 0, lvl: 14,
        jx: { h: 1, a: 2, w: 3, o: -1 }, title: 'GameMaster', titleId: 'gm'
      }
    });
  });

  // Simulate A walking with NEW always-meta packets
  let seq = 0;
  const t0 = Date.now();
  await new Promise((res) => {
    const iv = setInterval(() => {
      const now = Date.now();
      seq++;
      const fullLook = seq === 1 || seq % 18 === 0;
      const payload = {
        cid: a.id, seq, t: now,
        x: 400 + seq * 2, y: 300,
        vx: 60, vy: 0,
        name: 'HomNayAnhMet', fac: 'shaolin', sex: 0, lvl: 14,
        act: 'run'
      };
      if (fullLook) payload.jx = { h: 1, a: 2, w: 3, o: -1 };
      chA.send({ type: 'broadcast', event: 'pos', payload });
      if (now - t0 > 2500) { clearInterval(iv); res(); }
    }, 33);
  });

  // B asks who (like incomplete peer)
  chB.send({ type: 'broadcast', event: 'who', payload: { cid: b.id, want: b.id } });
  await new Promise(r => setTimeout(r, 800));

  const ok = peer.name === 'HomNayAnhMet' && peer.fac === 'shaolin' && peer.lvl === 14 && peer.jx && peer.jx.a === 2;
  const summary = { ok, peer, whoHits, at: new Date().toISOString() };
  console.log(JSON.stringify(summary, null, 2));
  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
  fs.writeFileSync('/opt/cursor/artifacts/mp-meta-live.json', JSON.stringify(summary, null, 2));

  try { await a.sb.removeChannel(chA); } catch (e) {}
  try { await b.sb.removeChannel(chB); } catch (e) {}
  await a.sb.auth.signOut(); await b.sb.auth.signOut();
  process.exit(ok ? 0 : 1);
}

main().catch(e => { console.error('FAIL', e); process.exit(1); });
