/* ======================= SAN DAU PK — ĐÃ TẮT =======================
   Chế độ mời PK / sàn đấu đã gỡ. Stub giữ load an toàn + dọn HUD/state cũ. */
'use strict';

const PK_ARENA = { id: 403, n: 'Sàn Đấu · Đình Trần', disabled: true };
const PKA = { pending: {}, inbox: null, lastInvite: 0 };

const pkArenaOn = () => false;
const pkArenaBusy = () => !!(R && (R.dg || R.tower || R.deadT > 0));

function pkArenaHudRemove() {
  try { document.querySelectorAll('#pkaHud').forEach(el => el.remove()); } catch (e) { /* bo qua */ }
}

function pkArenaForceClear() {
  try {
    if (typeof R !== 'undefined' && R && R.pkArena) {
      const ret = R.pkArena.ret;
      R.pkArena = null;
      R.zoneShown = null;
      try {
        if (ret) {
          if (ret.town && typeof goTown === 'function') goTown();
          else if (typeof onZoneChange === 'function' && typeof zoneOf === 'function' && typeof STAGES !== 'undefined') {
            if (ret.stage != null && typeof S !== 'undefined') S.stage = ret.stage | 0;
            onZoneChange(zoneOf(Math.min((typeof S !== 'undefined' ? S.stage : 1) | 0, STAGES)));
            if (typeof H !== 'undefined' && ret.x != null) {
              H.x = ret.x; H.y = ret.y;
              if (typeof snapCamera === 'function') snapCamera();
            }
          }
        }
      } catch (e) { /* bo qua */ }
    }
  } catch (e) { /* bo qua */ }
  pkArenaHudRemove();
  PKA.pending = {};
  PKA.inbox = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('pka_cool_v1');
      sessionStorage.removeItem('pka_done_v1');
    }
  } catch (e) { /* bo qua */ }
  try {
    if (typeof MP !== 'undefined' && MP.roomOverride && String(MP.roomOverride).indexOf('map:pk:') === 0) {
      MP.roomOverride = null;
    }
  } catch (e) { /* bo qua */ }
}

function pkArenaInvite() {
  if (typeof toast === 'function') toast('Chế độ PK sàn đấu đã tắt');
}
function pkArenaAccept() {}
function pkArenaSend() { return Promise.resolve(false); }
function pkArenaEnter() {}
function pkArenaExit() { pkArenaForceClear(); }
function pkArenaFinish() { pkArenaForceClear(); }
function pkArenaFlee() { pkArenaForceClear(); }
function pkArenaTick() {}
function pkArenaEnsureHud() { pkArenaHudRemove(); }
function pkArenaHud() { return ''; }
function pkArenaOnFchat(m) {
  return !!(m && m.item && m.item.__duel);
}
function pkArenaPollInbox() {}
function pkArenaKickPoll() {}
function pkArenaRoomId() { return ''; }
function pkArenaNewRoom() { return ''; }
function pkArenaForceReset() { pkArenaForceClear(); }

function pkArenaHook() {
  if (pkArenaHook._ok) return;
  pkArenaHook._ok = true;
  if (typeof fchatPush === 'function' && !fchatPush._pkaOff) {
    const _fp = fchatPush;
    fchatPush = function (m) {
      try {
        if (m && m.item && m.item.__duel) return;
      } catch (e) { /* bo qua */ }
      return _fp.apply(this, arguments);
    };
    fchatPush._pkaOff = true;
  }
}

function pkArenaInit() {
  pkArenaHook();
  pkArenaForceClear();
  let n = 0;
  const t = setInterval(() => {
    pkArenaForceClear();
    if (++n >= 8) clearInterval(t);
  }, 500);
}

if (typeof window !== 'undefined') {
  window.pkArenaInvite = pkArenaInvite;
  window.pkArenaOn = pkArenaOn;
  window.pkArenaOnFchat = pkArenaOnFchat;
  window.pkArenaAccept = pkArenaAccept;
  window.pkArenaSend = pkArenaSend;
  window.pkArenaRoomId = pkArenaRoomId;
  window.pkArenaNewRoom = pkArenaNewRoom;
  window.pkArenaEnter = pkArenaEnter;
  window.pkArenaExit = pkArenaExit;
  window.pkArenaFinish = pkArenaFinish;
  window.pkArenaFlee = pkArenaFlee;
  window.pkArenaEnsureHud = pkArenaEnsureHud;
  window.pkArenaTick = pkArenaTick;
  window.pkArenaInit = pkArenaInit;
  window.pkArenaPollInbox = pkArenaPollInbox;
  window.pkArenaKickPoll = pkArenaKickPoll;
  window.pkArenaForceReset = pkArenaForceReset;
  window.pkArenaForceClear = pkArenaForceClear;
  window.PK_ARENA = PK_ARENA;
  window.PKA = PKA;
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(pkArenaInit, 0));
  else setTimeout(pkArenaInit, 0);
}
