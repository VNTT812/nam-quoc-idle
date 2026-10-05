/* ======================= CUOI NGUA (JX1: KNpc m_bRideHorse, skills.txt HorseLimit) =======================
   HorseLimit: 1 = khong dung duoc khi dang cuoi ngua, 2 = chi dung khi cuoi ngua (KSkills.cpp CanCast).
   Dang cuoi: hinh nhan vat cuoi ngua, toc do chay cong them toc do cua ngua. Xuong ngua: toc do bo.
   Auto (S.autoRide): di chuyen / di nhat do -> len ngua; danh quai bang chieu khong dung duoc tren ngua -> xuong ngua
   (phai danh tren ngua nhu Thien Vuong Pha Thien Tram, Thien Nhan Van Long Kich: giu nguyen tren ngua). */
'use strict';
const HORSE_LIM = { 10: 1, 11: 1, 271: 1, 318: 1, 319: 1, 29: 1, 30: 1, 31: 1, 35: 1, 41: 1, 324: 1, 323: 1, 325: 1, 347: 1, 303: 1, 47: 1, 50: 1, 54: 1, 343: 1, 345: 1, 349: 1, 249: 1, 341: 1, 339: 1, 342: 1, 351: 1, 68: 1, 71: 1, 353: 1, 85: 1, 82: 1, 385: 1, 88: 1, 91: 1, 328: 1, 380: 1, 102: 1, 105: 1, 113: 1, 108: 1, 111: 1, 336: 1, 337: 1, 122: 1, 125: 1, 128: 1, 357: 1, 359: 1, 145: 1, 138: 1, 148: 1, 362: 1, 155: 1, 158: 1, 164: 1, 165: 1, 267: 1, 365: 1, 368: 1, 179: 1, 172: 1, 176: 1, 182: 1, 372: 1, 375: 1 };
const RIDE_CD = 0.6;                                                  // giay giua 2 lan len / xuong ngua
const skHorseLim = s => (s && HORSE_LIM[s.id]) || 0;
const skHorseOk = (s, m = !!R.mounted) => { const h = skHorseLim(s); return h === 1 ? !m : h === 2 ? m : true; };
const canRide = () => !!(S && S.eq && S.eq.horse && reqOk(S.eq.horse));   // chua du dieu kien (cap) thi khong cuoi duoc
const autoRide = () => S.autoRide !== false && !(typeof manual === 'function' && manual());
/* toc do chay hien tai: tren ngua = P.speed, xuong ngua = bo toc do cua ngua */
const curSpeed = () => (R.P ? (R.mounted ? R.P.speed : R.P.speedFoot || R.P.speed) : 1);
function setMount(on, quiet) {
  on = !!on && canRide();
  if (!!R.mounted === on || (R.rideCd || 0) > 0) return false;
  R.mounted = on; R.rideCd = RIDE_CD; R.dirty = true;
  refreshRideBtn();
  if (!quiet && typeof uiSfx === 'function') uiSfx('use');
  return true;
}
function toggleMount() {
  if (!canRide()) { toast(S.eq.horse ? 'Chưa đủ điều kiện cưỡi ngựa này' : 'Chưa có ngựa: mặc ngựa ở ô Ngựa (thẻ Nhân vật)'); return; }
  R.rideCd = 0; setMount(!R.mounted);
}
function rideTick(dt) {
  if (R.rideCd > 0) R.rideCd -= dt;
  if (R.rideCan !== canRide()) { R.rideCan = canRide(); refreshRideBtn(); }
  if (!canRide()) { if (R.mounted) { R.mounted = false; R.dirty = true; refreshRideBtn(); } return; }
  if (!autoRide() || R.deadT > 0) return;
  // het quai dang danh / dang di xa: len ngua
  const busy = R.enemies.some(e => !e.dead && (!e.home || e.aggro) && Math.hypot(e.x - H.x, e.y - H.y) < 320);
  if (!R.mounted && !busy && (H.moving || R.town)) setMount(true, true);
}
/* chieu dinh danh co dung duoc voi trang thai ngua hien tai khong; Auto: doi trang thai ngua cho hop (tra ve true = cho 1 nhip) */
function rideForAttack(a) {
  const s = SK[a.id]; if (!s || skHorseOk(s)) return false;
  if (autoRide()) { setMount(!R.mounted, true); return true; }
  return null;                                                        // tu dieu khien: khong dung duoc chieu nay
}
function refreshRideBtn() {
  const b = typeof $ === 'function' && $('#rideBtn'); if (!b) return;
  b.style.display = canRide() ? '' : 'none';
  b.innerHTML = (R.mounted ? 'Xuống ngựa' : 'Lên ngựa') + ' <small>(M)</small>';
  b.classList.toggle('on', !!R.mounted);
}
