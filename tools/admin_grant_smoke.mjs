/** Smoke: netApplyAdminGrant + payload shape (không cần browser). */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
const MAX_LEVEL = 200, PTS_PER_LEVEL = 5, SKILL_PTS_PER_LEVEL = 1, INV_MAX = 60;
const fmt = n => String(n);
let S = { lvl: 10, xp: 0, attrPts: 0, skPts: 0, knb: 0, inv: [], uid: 1 };
const R = { dirty: false };
function syncMaxStage() {}
function recalc() {}
function netCleanItem(it) {
  if (!it || typeof it !== 'object') return null;
  if (it.__admin) return it;
  if (!Array.isArray(it.base) || !Array.isArray(it.mag)) return null;
  const x = JSON.parse(JSON.stringify(it)); x.uid = S.uid++; delete x.lock; return x;
}
function netApplyAdminGrant(a) {
  const parts = [];
  if (!a || !a.__admin) return parts;
  if (a.lvl != null) {
    const lv = clamp(Math.floor(+a.lvl) || 1, 1, MAX_LEVEL);
    const old = S.lvl | 0;
    if (lv > old) {
      S.attrPts = (S.attrPts | 0) + PTS_PER_LEVEL * (lv - old);
      S.skPts = (S.skPts | 0) + SKILL_PTS_PER_LEVEL * (lv - old);
    }
    S.lvl = lv; S.xp = 0; syncMaxStage(); parts.push('cấp ' + lv);
  }
  if (a.addLv > 0) {
    const n = clamp(Math.floor(+a.addLv) || 0, 0, 200);
    const nv = Math.min(MAX_LEVEL, (S.lvl | 0) + n);
    const gained = nv - (S.lvl | 0);
    if (gained > 0) {
      S.attrPts = (S.attrPts | 0) + PTS_PER_LEVEL * gained;
      S.skPts = (S.skPts | 0) + SKILL_PTS_PER_LEVEL * gained;
      S.lvl = nv; S.xp = 0; syncMaxStage(); parts.push('+' + gained + ' cấp');
    }
  }
  if (a.attrPts > 0) { S.attrPts = (S.attrPts | 0) + (a.attrPts | 0); parts.push('+' + (a.attrPts | 0) + ' tiềm năng'); }
  if (a.skPts > 0) { S.skPts = (S.skPts | 0) + (a.skPts | 0); parts.push('+' + (a.skPts | 0) + ' kỹ năng'); }
  if (a.knb > 0) { S.knb = (S.knb || 0) + (a.knb | 0); parts.push('+' + fmt(a.knb) + ' KNB'); }
  if (a.gear && Array.isArray(a.gear.base)) {
    if (S.inv.length >= INV_MAX) throw new Error('Hành trang đầy');
    const it = netCleanItem(a.gear);
    if (it) { S.inv.push(it); parts.push(it.n); }
  }
  R.dirty = true; recalc();
  return parts;
}

function assert(c, m) { if (!c) throw new Error(m); }

S = { lvl: 10, xp: 99, attrPts: 0, skPts: 0, knb: 0, inv: [], uid: 1 };
let p = netApplyAdminGrant({ __admin: 1, lvl: 50, knb: 20, attrPts: 10, skPts: 3 });
assert(S.lvl === 50, 'lvl');
assert(S.attrPts === 5 * 40 + 10, 'attrPts');
assert(S.skPts === 1 * 40 + 3, 'skPts');
assert(S.knb === 20, 'knb');
assert(S.xp === 0, 'xp reset');
assert(p.includes('cấp 50') && p.includes('+20 KNB'), 'parts ' + p);

S = { lvl: 90, xp: 0, attrPts: 0, skPts: 0, knb: 0, inv: [], uid: 1 };
p = netApplyAdminGrant({ __admin: 1, addLv: 10, gear: { n: 'Đao Thử', base: [1], mag: [], r: 3 } });
assert(S.lvl === 100, 'addLv');
assert(S.inv.length === 1 && S.inv[0].n === 'Đao Thử' && S.inv[0].uid === 1, 'gear');
assert(!S.inv[0].lock, 'no lock');

assert(netApplyAdminGrant(null).length === 0, 'null');
assert(netApplyAdminGrant({ lvl: 200 }).length === 0, 'no __admin ignored');

console.log('admin_grant_smoke OK');
