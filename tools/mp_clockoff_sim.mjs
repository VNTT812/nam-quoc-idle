/**
 * Simulate mpUpsertPeer clockOff logic: late buffered packet must NOT freeze peer forever.
 */
const MP_HIST = 24;

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
  if (drop) {
    if (seq && (!p.seq || seq > p.seq) && p._acceptAt && now - p._acceptAt > 450 && off >= 0 && off < 2000) {
      p.clockOff = off; p.seq = seq; drop = false;
    } else { p.seen = now; return { drop: true, accepted: false }; }
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
    return { drop: false, accepted: true, off, clockOff: p.clockOff };
  }
  return { drop: true, accepted: false };
}

function oldUpsert(p, row, now) {
  const tx = +row.x, ty = +row.y;
  const seq = row.seq | 0;
  const pt = +row.t;
  const off = now - pt;
  if (seq && p.seq && seq <= p.seq) { p.seen = now; return { accepted: false }; }
  if (p._pt && pt + 80 < p._pt) { p.seen = now; return { accepted: false }; }
  if (p.clockOff && (now - pt - p.clockOff) > 900) { p.seen = now; return { accepted: false }; }
  if (seq) p.seq = Math.max(p.seq || 0, seq);
  if (p.clockOff && Math.abs(off - p.clockOff) > 2500) { p.seen = now; return { accepted: false, poisoned: true }; }
  p.clockOff = p.clockOff ? p.clockOff * 0.88 + off * 0.12 : off;
  p.tx = tx; p.ty = ty; p._t = now; p._pt = Math.max(p._pt || 0, pt); p.seen = now;
  return { accepted: true, clockOff: p.clockOff };
}

function runScenario(label, fn) {
  const p = { seq: 0, clockOff: 0, hist: [] };
  const t0 = 1_000_000;
  // Poison path: FIRST pos packet arrives ~3s late (Realtime buffer / tab thaw)
  // → clockOff ≈ 3000; old code then abs(off-clockOff)>2500 drops ALL fresh forever.
  fn(p, { seq: 1, t: t0, x: 100, y: 100 }, t0 + 3200);
  let accepted = 0, dropped = 0;
  let lastX = p.tx;
  for (let i = 0; i < 40; i++) {
    const sendT = t0 + 200 + i * 33;
    const now = sendT + 35;
    const r = fn(p, { seq: 2 + i, t: sendT, x: 120 + i * 8, y: 100 }, now);
    if (r.accepted) { accepted++; lastX = p.tx; }
    else dropped++;
  }
  const moved = lastX > 120 + 8 * 10;
  console.log(`[${label}] accepted=${accepted} dropped=${dropped} lastX=${lastX} clockOff=${Number(p.clockOff).toFixed(1)} moved=${moved}`);
  return { accepted, dropped, lastX, moved, clockOff: p.clockOff };
}

const oldR = runScenario('OLD (bug)', oldUpsert);
const newR = runScenario('NEW (fix)', upsert);

const ok = newR.moved && newR.accepted >= 30 && oldR.accepted < 5 && !oldR.moved;
console.log(ok ? 'PASS: fix recovers after late first-packet poison' : 'FAIL: peer still frozen or old not reproducing');
process.exit(ok ? 0 : 1);
