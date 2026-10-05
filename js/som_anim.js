/* Hoa Sơn SoM: mỗi hành động 1 strip riêng (st/run/at/hurt/die), 1 hướng + lật trái/phải.
   Spawn: chọn ngẫu nhiên 1 màu trong MON[tid].somColors (không ghi đè mỗi frame). */
'use strict';

const SOM_FACE_DEADZONE = 18;   // px — tránh flip liên tục khi đứng sát trục X
const SOM_MOVE_HOLD = 0.18;     // giây — giữ run thêm chút khi vừa dừng

function isSomMon(tid) {
  const m = MON[tid];
  return !!(m && (m.faceOnly || (m.anim && String(m.anim).indexOf('som_') === 0)));
}

/** Gán màu ngẫu nhiên 1 lần khi spawn (animKey + portrait). */
function somApplyRandomColor(e) {
  const m = MON[e.tid];
  if (!m || !m.somColors || !m.somColors.length) {
    e.animKey = m && m.anim;
    return e;
  }
  const c = m.somColors[Math.floor(Math.random() * m.somColors.length)];
  e.animKey = c.key;
  e.somColor = c.color;
  if (c.img) {
    e.img = (typeof img === 'function') ? img(c.img) : e.img;
  }
  return e;
}

/** Chỉ đổi mặt khi lệch đủ xa — hết xoay trái/phải liên tục. */
function somUpdateFace(e, tx) {
  const dx = tx - e.x;
  if (dx > SOM_FACE_DEADZONE) e.face = 1;
  else if (dx < -SOM_FACE_DEADZONE) e.face = -1;
}

/** State máy anim quái SoM: đúng 1 act tại 1 thời điểm. */
function somEnemyAnimTick(e, dt) {
  if (!e.animKey) {
    const m = MON[e.tid];
    e.animKey = m && m.anim;
  }
  if (e.dead || e.act === 'die') {
    if (e.act !== 'die') { e.act = 'die'; e.actT = 0; }
    else e.actT = (e.actT || 0) + dt;
    return;
  }
  // giữ at/hurt tới hết clip — không nhảy sang run/st giữa chừng
  if (e.act === 'at' || e.act === 'hurt') {
    e.actT = (e.actT || 0) + (e.stun > 0 ? 0 : dt);
    const len = Math.max(0.28, animLen(e.animKey, e.act));
    if (e.actT >= len) {
      e.act = e.moving ? 'run' : 'st';
      e.actT = 0;
    }
    return;
  }
  // hysteresis di chuyển
  if (e.moving) e._somMoveHold = SOM_MOVE_HOLD;
  else e._somMoveHold = Math.max(0, (e._somMoveHold || 0) - dt);
  const want = (e.moving || e._somMoveHold > 0) ? 'run' : 'st';
  if (e.act !== want) { e.act = want; e.actT = 0; }
  else e.actT = (e.actT || 0) + (e.stun > 0 ? 0 : e.slowT > 0 ? dt * ELEM_SLOW : dt);
}

/** Vẽ đúng sheet của act — không fallback st (tránh lẫn frame). */
function somDrawAnim(key, act, t, x, y, sc, alpha, face) {
  const set = W.anim && W.anim[key]; if (!set) return false;
  const m = set[act]; if (!m) return false;   // thiếu sheet act = không vẽ (không lấy st)
  const im = img('img/a/' + m.f); if (!im.complete || !im.naturalWidth) return false;
  let fr = Math.floor(t * 1000 / m.ms);
  fr = ONCE[act] ? Math.min(fr, m.n - 1) : fr % m.n;
  CX.globalAlpha = alpha;
  if (face < 0) {
    CX.save();
    CX.translate(x, y);
    CX.scale(-1, 1);
    CX.drawImage(im, fr * m.w, 0, m.w, m.h, -m.ax * sc, -m.ay * sc, m.w * sc, m.h * sc);
    CX.restore();
  } else {
    CX.drawImage(im, fr * m.w, 0, m.w, m.h, x - m.ax * sc, y - m.ay * sc, m.w * sc, m.h * sc);
  }
  CX.globalAlpha = 1;
  return m.h * sc;
}

/* Hook makeEnemy: SoM spawn → random màu */
(function somHookSpawn() {
  if (typeof makeEnemy !== 'function') return;
  const _make = makeEnemy;
  makeEnemy = function (tid, L, cls, x, y) {
    const e = _make(tid, L, cls, x, y);
    if (e && isSomMon(tid)) somApplyRandomColor(e);
    return e;
  };
})();
