/* ======================= PK ONLINE (dong doi bai luyen) =======================
   Ca hai bat PK moi danh nhau. Click peer de khoa muc tieu; Auto/tay danh nhu danh quai.
   Sat thuong: attacker tinh + gui; victim ap dung (tran theo % mau). Relay qua auth WSS + SB. */
'use strict';

const MP_PK_RANGE_PAD = 56; // melee PK: them le mang (peer interp)
const MP_PK_HIT_GAP = 0.12;
const MP_PK_MAX_FRAC = 0.32; // toi da ~32% mau max / don (chong 1-shot hack)

function mpPkReady() {
  return !!(typeof mpCid === 'function' && typeof fieldMode === 'function' && fieldMode()
    && S && S.fac && R && !R.town && !R.dg && !R.tower && R.deadT <= 0
    && typeof mpSkillNetOk === 'function' && mpSkillNetOk());
}
function mpPkOn() { return !!(MP && MP.pk && mpPkReady()); }

function mpPkToggle() {
  if (!mpPkReady() && !(MP && MP.pk)) {
    if (typeof toast === 'function') toast('PK chỉ dùng trên bãi luyện khi đã nối Đồng đội');
    return;
  }
  MP.pk = !MP.pk;
  if (!MP.pk) MP.pkTarget = null;
  mpPkEmitFlag();
  if (typeof mpUi === 'function') mpUi();
  if (typeof toast === 'function') {
    toast(MP.pk
      ? 'PK BẬT — click người chơi (họ cũng phải bật PK) để đánh'
      : 'PK TẮT');
  }
}

function mpPkEmitFlag() {
  const payload = { pk: MP.pk ? 1 : 0 };
  if (typeof mpaEnabled === 'function' && mpaEnabled() && typeof MPA !== 'undefined' && MPA.state === 'ok' && typeof mpaSend === 'function') {
    try { mpaSend(Object.assign({ t: 'pkflag' }, payload)); } catch (e) { /* bo qua */ }
  }
  if (typeof mpSend === 'function') {
    try { mpSend('pkflag', payload); } catch (e) { /* bo qua */ }
  }
}

function mpPkEmitHit(payload) {
  if (!payload) return;
  let via = false;
  if (typeof mpaEnabled === 'function' && mpaEnabled() && typeof MPA !== 'undefined' && MPA.state === 'ok' && typeof mpaSend === 'function') {
    try { mpaSend(Object.assign({ t: 'pkhit' }, payload)); via = true; } catch (e) { /* bo qua */ }
  }
  if (!via && typeof mpSend === 'function') mpSend('pkhit', payload);
  else if (via && typeof mpSend === 'function' && MP.ch && (MP.state === 'ok' || MP.state === 'retry')) {
    try { mpSend('pkhit', payload); } catch (e) { /* bo qua */ }
  }
}

function mpPkPeerXY(p) {
  if (!p) return { x: 0, y: 0 };
  return { x: p.rx != null ? p.rx : p.x, y: p.ry != null ? p.ry : p.y };
}

function mpPkAlive(p) {
  if (!p || p.cid === mpCid()) return false;
  if (p.act === 'die') return false;
  if ((p.life == null ? 1 : +p.life) <= 0.001) return false;
  return !!p.pk;
}

function mpPkNearest() {
  let best = null, bd = 1e9;
  for (const p of Object.values(MP.peers || {})) {
    if (!mpPkAlive(p)) continue;
    const { x, y } = mpPkPeerXY(p);
    const d = Math.hypot(x - H.x, y - H.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function mpPkPickAt(wx, wy) {
  let best = null, bd = 42;
  for (const p of Object.values(MP.peers || {})) {
    if (!p || p.cid === mpCid()) continue;
    const { x, y } = mpPkPeerXY(p);
    const d = Math.hypot(x - wx, y - (wy + 10));
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

/** Uoc tinh sat thuong PK tu chiêu — khong dung heroHit (tranh mutate quai). */
function mpPkCalcDmg(a, peer) {
  if (!a || !R.P) return 1;
  const L = peer.lvl || 1;
  const def = 8 + L * 3.2;
  const series = (typeof FAC !== 'undefined' && FAC[peer.fac] && FAC[peer.fac].series != null)
    ? FAC[peer.fac].series
    : (typeof SERIES !== 'undefined' ? 0 : 0);
  // res nhe theo cap
  const res = {};
  for (const el of (typeof ELEM !== 'undefined' ? ELEM : ['phys'])) res[el] = Math.min(35, 5 + L * 0.35);
  let tot = 0, best = 'phys', bv = 0;
  const crit = Math.random() * 100 < (a.crit || 0);
  for (const el in (a.parts || { phys: 20 })) {
    let d = a.parts[el] * (0.88 + Math.random() * 0.24);
    if (typeof applyPart === 'function') {
      d = applyPart(d, el, a.series, series, res, 75, a.series5 || 0);
    }
    if (crit && el === 'phys') d *= (typeof CRIT_MULT !== 'undefined' ? CRIT_MULT : 1.8);
    tot += d; if (d > bv) { bv = d; best = el; }
  }
  if (typeof counters === 'function' && typeof SERIES_BONUS !== 'undefined') {
    if (counters(a.series, series)) tot *= 1 + SERIES_BONUS;
    else if (counters(series, a.series)) tot *= 1 - SERIES_BONUS;
  }
  // giam nhe theo def (hitPercent-style soft)
  const ar = R.P.ar || 100;
  const hit = typeof hitPercent === 'function' ? hitPercent(ar, def, a.ignore || 0) : 85;
  if (Math.random() * 100 >= hit) return { dmg: 0, miss: true, el: best, crit: false };
  tot = Math.max(1, Math.round(tot * 0.85)); // PK: ~15% nhe hon danh quai
  return { dmg: tot, miss: false, el: best, crit };
}

function mpPkStrike(peer, forceAtk) {
  if (!mpPkOn() || !mpPkAlive(peer) || !R.P) return 0.25;
  const { x, y } = mpPkPeerXY(peer);
  let a = forceAtk || (typeof pickAttack === 'function' ? pickAttack(R.P, false) : (R.P.main || R.P.basic));
  if (!a) return 0.3;
  // Dam bao co parts de tinh sat thuong
  if ((!a.parts || !Object.keys(a.parts).length) && a.id && typeof activeInfo === 'function' && SK[a.id]) {
    try { a = Object.assign({}, a, activeInfo(R.P, SK[a.id], a.L || S.sk[a.id] || 1)); } catch (e) { /* bo qua */ }
  }
  const d = Math.hypot(x - H.x, y - H.y) - 18;
  const reach = (a.rad || 80) + MP_PK_RANGE_PAD;
  if (d > reach) {
    // Auto: duoi theo; Manual: van co the "kep" them neu lech < 1.35*tam (jitter mang)
    if (!manual()) { R.moveTo = { x, y, hp: 1 }; return 0.05; }
    if (d > reach * 1.35) return 0.05;
  }
  // PK sat: bo qua tuong neu dang dung sat (tranh interp/obs map chan sai)
  if (d > 90 && typeof obsSee === 'function' && !obsSee(H.x, H.y, x, y)) {
    if (!manual()) { R.moveTo = { x, y, hp: 1 }; return 0.05; }
    return 0.05;
  }
  R.moveTo = null;
  if (a.cost > 0) R.mana = Math.max(0, R.mana - a.cost);
  const hit = mpPkCalcDmg(a, peer);
  H.face = x >= H.x ? 1 : -1;
  H.dir = typeof dirOf === 'function' ? dirOf(x - H.x, y - H.y) : 0;
  H.act = 'at'; H.actT = 0;
  const tgt = { x, y, r: 18 };
  if (typeof skillFx === 'function') skillFx(H, tgt, a);
  if (a.id && typeof skillSfx === 'function') skillSfx(a.id);
  else if (typeof npcSfx === 'function' && typeof heroGfx === 'function') npcSfx(heroGfx() && heroGfx().anim, 'at', 0.4);

  if (hit.miss) {
    if (typeof addText === 'function') addText(x, y - 28, 'Trượt', '#aaa', 11);
  } else {
    if (typeof addText === 'function') {
      addText(x, y - 28, (typeof fmt === 'function' ? fmt(hit.dmg) : hit.dmg) + (hit.crit ? '!' : ''),
        hit.crit ? '#ffe14a' : ((typeof ELEM_COL !== 'undefined' && ELEM_COL[hit.el]) || '#ffb070'),
        hit.crit ? 15 : 12);
    }
    // Optimistic: giam life peer local (victim se chinh lai)
    peer.life = Math.max(0, (peer.life == null ? 1 : +peer.life) - (hit.dmg / Math.max(200, (peer.lvl || 1) * 40 + 400)));
    mpPkEmitHit({
      to: peer.cid,
      dmg: hit.dmg,
      id: a.id | 0,
      L: a.L | 0,
      nMis: a.nMis | 0,
      melee: !!a.melee,
      around: !!a.around,
      ax: Math.round(H.x), ay: Math.round(H.y),
      bx: Math.round(x), by: Math.round(y),
      face: H.face >= 0 ? 1 : -1, dir: H.dir | 0, act: 'at',
      crit: hit.crit ? 1 : 0
    });
  }
  // Ep gui act at qua auth ngay
  if (typeof mpaSend === 'function' && typeof MPA !== 'undefined' && MPA.state === 'ok') {
    try {
      mpaSend({
        t: 'in', seq: (MPA.seq = (MPA.seq | 0) + 1),
        x: Math.round(H.x * 10) / 10, y: Math.round(H.y * 10) / 10,
        vx: 0, vy: 0, face: H.face >= 0 ? 1 : -1, dir: H.dir | 0, act: 'at',
        life: R.P && R.P.life ? +(R.life / R.P.life).toFixed(2) : 1,
        pk: 1
      });
    } catch (e) { /* bo qua */ }
  }
  if (typeof mpTrackNow === 'function') mpTrackNow(true);
  return a.rate > 0 ? 1 / a.rate : 0.4;
}

/** Build attack tu skill id (dung de test / ep chieu). */
function mpPkAtkFromSkill(id) {
  if (!id || !SK[id] || !R.P || typeof activeInfo !== 'function') return null;
  const L = Math.max(1, (S.sk && S.sk[id]) || 1);
  try { return activeInfo(R.P, SK[id], L); } catch (e) { return null; }
}

function mpOnPkFlag(p) {
  if (!p || p.cid === mpCid()) return;
  const peer = MP.peers[String(p.cid || '')];
  if (!peer) return;
  peer.pk = !!(p.pk);
  if (!peer.pk && MP.pkTarget === peer.cid) MP.pkTarget = null;
}

function mpOnPkHit(p) {
  if (!p || !p.to) return;
  const my = mpCid();
  const atk = MP.peers[String(p.cid || '')];
  const vic = p.to === my ? null : MP.peers[String(p.to)];

  // Cap nhat anim attacker (neu co)
  if (atk) {
    atk.act = 'at'; atk.actT = 0;
    if (p.face != null) atk.face = p.face >= 0 ? 1 : -1;
    if (p.dir != null) atk.dir = p.dir | 0;
    atk._cVx = 0; atk._cVy = 0; atk._coast = false;
  }

  // Spectator / attacker client: so huyet + hurt — FX chiêu do mpOnSkill lo (tranh double)
  if (p.to !== my) {
    if (vic) {
      const to = mpPkPeerXY(vic);
      // Fallback FX neu skill broadcast bi rot (~200ms)
      const skAt = (MP._pkSkAt && MP._pkSkAt[p.cid]) || 0;
      if (typeof skillFx === 'function' && Date.now() - skAt > 180) {
        const from = (p.ax != null && p.ay != null)
          ? { x: +p.ax, y: +p.ay }
          : (atk ? mpPkPeerXY(atk) : to);
        skillFx(from, to, { id: p.id | 0, L: p.L || 1, nMis: p.nMis || 1, melee: !!p.melee, around: !!p.around });
      }
      if (typeof addText === 'function' && p.dmg > 0) {
        addText(to.x, to.y - 28, '-' + (typeof fmt === 'function' ? fmt(p.dmg) : p.dmg),
          p.crit ? '#ffe14a' : '#ff6a5a', p.crit ? 15 : 12);
      }
      vic.act = 'hurt'; vic.actT = 0;
      if (p.dmg > 0 && vic.life != null) {
        const estMax = Math.max(200, (vic.lvl || 1) * 40 + 400);
        vic.life = Math.max(0, +vic.life - (+p.dmg) / estMax);
      }
    }
    return;
  }

  // Toi bi danh
  if (R.deadT > 0 || R.town) return;
  // Chi nhan neu minh dang bat PK (tranh grief)
  if (!MP.pk) {
    if (typeof toast === 'function') toast(((atk && atk.name) || 'Ai đó') + ' muốn PK — bật PK để đáp trả');
    return;
  }
  let dmg = Math.max(0, Math.round(+p.dmg || 0));
  if (dmg <= 0) {
    if (typeof addText === 'function') addText(H.x, H.y - 30, 'Né', '#9cf', 11);
    return;
  }
  const cap = Math.max(1, (R.P && R.P.life ? R.P.life : 100) * MP_PK_MAX_FRAC);
  dmg = Math.min(dmg, cap);

  // Fallback FX neu skill broadcast rot
  const skAt = (MP._pkSkAt && MP._pkSkAt[p.cid]) || 0;
  if (typeof skillFx === 'function' && Date.now() - skAt > 180) {
    const from = (p.ax != null && p.ay != null)
      ? { x: +p.ax, y: +p.ay }
      : (atk ? mpPkPeerXY(atk) : { x: H.x, y: H.y });
    skillFx(from, H, { id: p.id | 0, L: p.L || 1, nMis: p.nMis || 1, melee: !!p.melee, around: !!p.around });
  }
  R.life -= dmg;
  R.hurtT = 0.25;
  if (H.act !== 'at') { H.act = 'hurt'; H.actT = 0; }
  if (typeof addText === 'function') {
    addText(H.x + (Math.random() * 20 - 10), H.y - 36, '-' + (typeof fmt === 'function' ? fmt(dmg) : dmg), '#ff6a5a', 12);
  }
  if (typeof mpTrackNow === 'function') mpTrackNow(true);

  if (R.life <= 0) {
    R.life = 0;
    MP.pkTarget = null;
    // Field: khong xoa quai chung
    R.deadT = 4;
    R.slowT = R.stunT = R.hpDotT = R.hpDot = 0;
    H.act = 'die'; H.actT = 0;
    if (typeof recDeath === 'function') recDeath();
    const killer = (atk && atk.name) || 'Đối thủ';
    if (typeof log === 'function') log('<span class="bad">Bạn bị ' + killer + ' hạ gục (PK).</span>');
    if (typeof toast === 'function') toast('Bị ' + killer + ' PK hạ!');
    // thong bao kill
    const killPayload = { victim: my, by: p.cid };
    if (typeof mpaSend === 'function' && typeof MPA !== 'undefined' && MPA.state === 'ok') {
      try { mpaSend(Object.assign({ t: 'pkkill' }, killPayload)); } catch (e) { /* bo qua */ }
    }
    if (typeof mpSend === 'function') mpSend('pkkill', killPayload);
  }
}

function mpOnPkKill(p) {
  if (!p) return;
  if (p.victim && MP.peers[String(p.victim)]) {
    const v = MP.peers[String(p.victim)];
    v.life = 0; v.act = 'die'; v.actT = 0;
  }
  if (p.by === mpCid() && p.victim !== mpCid()) {
    const name = (MP.peers[String(p.victim)] && MP.peers[String(p.victim)].name) || 'Đối thủ';
    if (typeof toast === 'function') toast('Hạ ' + name + ' (PK)!');
    if (typeof log === 'function') log('<b class="up">PK:</b> Hạ <b>' + name + '</b>');
    if (MP.pkTarget === p.victim) MP.pkTarget = null;
  }
}

/** Hook heroAttack: uu tien muc tieu PK khi dang khoa / Auto gan peer PK. */
function mpPkTryAttack() {
  if (!mpPkOn()) return null;
  let peer = MP.pkTarget ? MP.peers[String(MP.pkTarget)] : null;
  if (peer && !mpPkAlive(peer)) { MP.pkTarget = null; peer = null; }
  if (!peer && !manual()) {
    // Auto: neu peer PK gan hon quai gan nhat (trong tam) thi danh peer
    peer = mpPkNearest();
    if (peer) {
      const { x, y } = mpPkPeerXY(peer);
      const pd = Math.hypot(x - H.x, y - H.y);
      const list = typeof alive === 'function' ? alive() : [];
      const mon = list.length && typeof nearest === 'function' ? nearest(list) : null;
      const md = mon ? Math.hypot(mon.x - H.x, mon.y - H.y) : 1e9;
      if (pd > md + 40) peer = null; // quai gan hon nhieu → farm
      else if (pd < 420) MP.pkTarget = peer.cid;
      else peer = null;
    }
  }
  if (!peer) return null;
  return mpPkStrike(peer);
}

function mpPkHookCombat() {
  if (typeof heroAttack !== 'function' || heroAttack._mpPk) return;
  const _ha = heroAttack;
  heroAttack = function () {
    const pk = mpPkTryAttack();
    if (pk != null) return pk;
    return _ha.apply(this, arguments);
  };
  heroAttack._mpPk = true;

  if (typeof heroDeath === 'function' && !heroDeath._mpPk) {
    const _hd = heroDeath;
    heroDeath = function () {
      if (typeof fieldMode === 'function' && fieldMode()) {
        if (R.enemies.some(e => e.goldBoss && !e.dead) && typeof RW === 'function') RW().gbT = (typeof GB_RETRY !== 'undefined' ? GB_RETRY : 300);
        R.deadT = Math.max(R.deadT || 0, 3);
        R.life = 0;
        R.slowT = R.stunT = R.hpDotT = R.hpDot = 0;
        H.act = 'die'; H.actT = 0;
        if (typeof recDeath === 'function') recDeath();
        if (typeof log === 'function') log('<span class="bad">Bạn đã trọng thương.</span>');
        // GIU quai field (MP) — khong R.enemies = []
        return;
      }
      return _hd.apply(this, arguments);
    };
    heroDeath._mpPk = true;
  }
}

function mpPkHookClick() {
  if (typeof CV === 'undefined' || !CV || CV._mpPkClick) return;
  CV._mpPkClick = true;
  CV.addEventListener('pointerup', ev => {
    if (!MP || !MP.pk || !mpPkReady()) return;
    if (INPUT && INPUT.moved) return;
    try {
      const r = CV.getBoundingClientRect();
      const k = typeof uiScale === 'function' ? uiScale() : 1;
      const sx = (ev.clientX - r.left) / k, sy = (ev.clientY - r.top) / k;
      const wx = sx + (typeof CAM !== 'undefined' ? CAM.x : 0);
      const wy = sy + (typeof CAM !== 'undefined' ? CAM.y : 0);
      const peer = mpPkPickAt(wx, wy);
      if (!peer) return;
      if (!peer.pk) {
        if (typeof toast === 'function') toast((peer.name || 'Họ') + ' chưa bật PK');
        return;
      }
      MP.pkTarget = peer.cid;
      if (typeof toast === 'function') toast('PK → ' + (peer.name || 'Đối thủ'));
      // dam bao co the duoi danh
      if (typeof setCtrl === 'function' && typeof manual === 'function' && manual()) {
        /* giu manual — danh khi trong tam */
      }
      ev.stopImmediatePropagation?.();
    } catch (e) { /* bo qua */ }
  }, true);
}

function mpPkHookDraw() {
  if (typeof othDraw !== 'function' || othDraw._mpPk) return;
  const _od = othDraw;
  othDraw = function (c, p) {
    _od.apply(this, arguments);
    if (!p || !c) return;
    const px = p.rx != null ? p.rx : p.x, py = p.ry != null ? p.ry : p.y;
    if (p.pk) {
      c.save();
      c.strokeStyle = MP.pkTarget === p.cid ? '#ff5050' : '#c05050';
      c.globalAlpha = MP.pkTarget === p.cid ? 0.95 : 0.55;
      c.lineWidth = MP.pkTarget === p.cid ? 2.5 : 1.5;
      c.beginPath(); c.ellipse(px, py, 22, 8, 0, 0, 7); c.stroke();
      c.restore();
    }
  };
  othDraw._mpPk = true;
}

function mpPkHookUi() {
  if (typeof mpDom === 'function') {
    const _dom = mpDom;
    mpDom = function () {
      _dom.apply(this, arguments);
      const b = typeof $ === 'function' ? $('#mpBadge') : document.getElementById('mpBadge');
      if (!b || b._mpPkBind) return;
      b._mpPkBind = true;
      b.style.pointerEvents = 'auto';
      b.style.cursor = 'pointer';
      b.title = 'Đồng đội — click để BẬT/TẮT PK';
      b.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        mpPkToggle();
      });
      // nut PK rieng
      if (!document.getElementById('mpPkBtn')) {
        const pk = document.createElement('button');
        pk.id = 'mpPkBtn';
        pk.type = 'button';
        pk.textContent = 'PK';
        pk.title = 'Bật/tắt chế độ PK (cả hai phải bật mới đánh nhau)';
        pk.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); mpPkToggle(); });
        b.appendChild(pk);
      }
    };
  }
  if (typeof mpUi === 'function') {
    const _ui = mpUi;
    mpUi = function () {
      _ui.apply(this, arguments);
      const b = typeof $ === 'function' ? $('#mpBadge') : document.getElementById('mpBadge');
      const pkBtn = document.getElementById('mpPkBtn');
      if (pkBtn) {
        pkBtn.className = MP.pk ? 'on' : '';
        pkBtn.textContent = MP.pk ? 'PK●' : 'PK';
      }
      if (b && MP.pk) b.classList.add('pk');
      else if (b) b.classList.remove('pk');
    };
  }
}

function mpPkHookNet() {
  // kem co PK trong pos/meta
  if (typeof mpPosPayload === 'function' && !mpPosPayload._mpPk) {
    const _pp = mpPosPayload;
    mpPosPayload = function (full) {
      const o = _pp.apply(this, arguments);
      if (o) o.pk = MP.pk ? 1 : 0;
      return o;
    };
    mpPosPayload._mpPk = true;
  }
  if (typeof mpMetaPayload === 'function' && !mpMetaPayload._mpPk) {
    const _mm = mpMetaPayload;
    mpMetaPayload = function () {
      const o = _mm.apply(this, arguments);
      if (o) o.pk = MP.pk ? 1 : 0;
      return o;
    };
    mpMetaPayload._mpPk = true;
  }
  if (typeof mpUpsertPeer === 'function' && !mpUpsertPeer._mpPk) {
    const _up = mpUpsertPeer;
    mpUpsertPeer = function (row, fromPos) {
      const p = _up.apply(this, arguments);
      if (row && row.pk != null && MP.peers[String(row.cid || '')]) {
        MP.peers[String(row.cid)].pk = !!row.pk;
      }
      return p;
    };
    mpUpsertPeer._mpPk = true;
  }
  // SB broadcast listeners — patch mpJoin is heavy; listen via document after join
  if (typeof mpJoin === 'function' && !mpJoin._mpPk) {
    const _join = mpJoin;
    mpJoin = async function () {
      const r = await _join.apply(this, arguments);
      try {
        if (MP.ch && !MP.ch._mpPkEv) {
          MP.ch._mpPkEv = true;
          MP.ch.on('broadcast', { event: 'pkflag' }, ({ payload }) => { if (MP.ch) mpOnPkFlag(payload); });
          MP.ch.on('broadcast', { event: 'pkhit' }, ({ payload }) => { if (MP.ch) mpOnPkHit(payload); });
          MP.ch.on('broadcast', { event: 'pkkill' }, ({ payload }) => { if (MP.ch) mpOnPkKill(payload); });
        }
      } catch (e) { /* bo qua */ }
      if (MP.pk) mpPkEmitFlag();
      return r;
    };
    mpJoin._mpPk = true;
  }
}

function mpPkHookAuth() {
  if (typeof mpaSend === 'function' && !mpaSend._mpPkWrap) {
    const orig = mpaSend;
    mpaSend = function (obj) {
      if (obj && (obj.t === 'in' || obj.t === 'pos' || obj.t === 'meta' || obj.t === 'join')) {
        obj.pk = MP.pk ? 1 : 0;
      }
      return orig.apply(this, arguments);
    };
    mpaSend._mpPkWrap = true;
  }
  if (typeof mpaApplySnap === 'function' && !mpaApplySnap._mpPk) {
    const _as = mpaApplySnap;
    mpaApplySnap = function (msg) {
      _as.apply(this, arguments);
      if (!msg || !Array.isArray(msg.peers)) return;
      for (const row of msg.peers) {
        if (!row || !row.cid) continue;
        const p = MP.peers[String(row.cid)];
        if (p && row.pk != null) p.pk = !!row.pk;
      }
    };
    mpaApplySnap._mpPk = true;
  }
  if (typeof mpaJoin === 'function' && !mpaJoin._mpPk) {
    const _mj = mpaJoin;
    mpaJoin = async function () {
      const r = await _mj.apply(this, arguments);
      if (MP.pk) setTimeout(() => { try { mpPkEmitFlag(); } catch (e) {} }, 400);
      return r;
    };
    mpaJoin._mpPk = true;
  }
}

function mpPkInit() {
  if (typeof MP === 'undefined') return;
  MP.pk = !!MP.pk;
  MP.pkTarget = MP.pkTarget || null;
  mpPkHookUi();
  mpPkHookCombat();
  mpPkHookClick();
  mpPkHookDraw();
  mpPkHookNet();
  mpPkHookAuth();
  if (typeof mpDom === 'function') mpDom();
  if (typeof mpUi === 'function') mpUi();
}

// boot sau mpInit
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(mpPkInit, 0));
  } else {
    setTimeout(mpPkInit, 0);
  }
}
