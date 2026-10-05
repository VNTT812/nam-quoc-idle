/* ======================= DIEU KHIEN: joystick, o ky nang, thuoc, Tho Dia Phu (mau GD_Idle) ======================= */
'use strict';
const INPUT = { active: false, id: null, fromJoy: false, ox: 0, oy: 0, x: 0, y: 0, moved: false, keys: {}, target: null };
const JOY_R = 45, TAP_MOVE = 8, TP_CD = 20, POT_CD = 1.5;
const manual = () => S.ctrl === 'manual';
const joyFixed = () => S.joy !== 'float';
/* Che do dieu khien: tren may tinh man hinh ngang co chuot -> chuot (bam / giu chuot de di, bam do tren dat de nhat) hoac joystick, doi bang nut tren san dau.
   Dien thoai / may bang / man hinh doc: luon joystick (nut doi khong hien). */
const isDesktopLandscape = () => !!(window.matchMedia && window.matchMedia('(orientation: landscape) and (min-width: 900px) and (hover: hover) and (pointer: fine)').matches);
const inputMode = () => isDesktopLandscape() ? (S.inputMode === 'joy' ? 'joy' : 'mouse') : 'joy';
const mouseMode = () => inputMode() === 'mouse';
function refreshRotBtn() { const b = $('#rotBtn'); if (!b) return; const on = S.rot !== false; b.innerHTML = 'Xoay chiêu: <i class="ck"></i>'; b.title = on ? 'Xoay chiêu: luân phiên chiêu ở ô F1–F4 khi tự đánh' : 'Chỉ đánh chiêu chính'; b.classList.toggle('on', on); }
function toggleRot() { S.rot = S.rot === false; refreshRotBtn(); R.dirty = true; save(); toast(S.rot !== false ? 'Xoay chiêu: luân phiên các chiêu ở ô F1 đến F4 khi tự đánh' : 'Xoay chiêu tắt: chỉ đánh chiêu chính'); }
function refreshInputBtn() {
  const on = isDesktopLandscape(); document.body.classList.toggle('deskland', on);
  const b = $('#inBtn'); if (b) b.textContent = mouseMode() ? '🖱 Chuột' : '🕹 Joystick';
}
const joyAnchor = () => ({ x: JOY_R + 14, y: AR.h - JOY_R - 14 });   // goc trai duoi san dau

/* ---------- tay cam (Gamepad API): analog / D-pad di chuyen, A B X Y = chieu 1-4, LB / RB = thuoc HP / MP, Start = tam dung Luyen Cong ---------- */
const GP = { v: [0, 0], prev: [] };
function gamepadPoll() {
  const list = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [], p = list.find(x => x && x.connected);
  if (!p) { GP.v = [0, 0]; GP.prev = []; return; }
  const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
  let x = p.axes[0] || 0, y = p.axes[1] || 0; if (Math.hypot(x, y) < 0.25) { x = 0; y = 0; }
  if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
  GP.v = [x, y];
  if ((x || y) && S.fac && !R.town && !manual()) setCtrl('manual', true);
  const edge = i => b(i) && !GP.prev[i];
  if (S.fac) {
    for (let i = 0; i < 4; i++) if (edge(i)) pressSlot(i);
    if (edge(4)) drinkNow('life'); if (edge(5)) drinkNow('mana'); if (edge(8)) R.town ? backFromTown() : goTown();
  }
  GP.prev = p.buttons.map(bt => !!bt.pressed);
}
/* Vector di chuyen: keo tren san (joystick noi), phim WASD / mui ten, hoac diem da cham */
function inputVec() {
  if (INPUT.active && INPUT.moved) {
    const x = INPUT.x - INPUT.ox, y = INPUT.y - INPUT.oy, l = Math.hypot(x, y);
    if (l < 6) return [0, 0];
    const k = Math.min(1, l / JOY_R) / l; return [x * k, y * k];
  }
  if (GP.v[0] || GP.v[1]) { INPUT.target = null; const l = Math.hypot(GP.v[0], GP.v[1]); return l > 1 ? [GP.v[0] / l, GP.v[1] / l] : GP.v.slice(); }
  const K = INPUT.keys; let x = 0, y = 0;
  if (K.ArrowLeft || K.a) x -= 1; if (K.ArrowRight || K.d) x += 1; if (K.ArrowUp || K.w) y -= 1; if (K.ArrowDown || K.s) y += 1;
  const l = Math.hypot(x, y); if (l) { INPUT.target = null; return [x / l, y / l]; }
  if (INPUT.target) {
    const dx = INPUT.target.x - H.x, dy = INPUT.target.y - H.y, d = Math.hypot(dx, dy);
    if (d < 6) { INPUT.target = null; return [0, 0]; }
    return [dx / d, dy / d];
  }
  return [0, 0];
}
function moveManual(dt) {
  const [vx, vy] = inputVec(); if (!vx && !vy) return false;
  const sp = 150 * curSpeed();
  const [nx, ny] = clampWorld(H.x + vx * sp * dt, H.y + vy * sp * dt);
  if (!obsMove(H, nx, ny) && INPUT.target) INPUT.target = null;      // cham vat can: bo diem cham
  R.pickTarget = null; return true;
}
function setCtrl(mode, quiet) {
  S.ctrl = mode; INPUT.target = null; renderPad();
  if (!quiet) toast(mode === 'manual' ? 'Tự điều khiển: kéo trên sân để đi, nhân vật tự đánh quái trong tầm' : 'Tự động: nhân vật tự đi đánh và nhặt đồ');
}

/* ---------- o ky nang ---------- */
function learnedAttacks() { return Object.keys(S.sk).map(Number).filter(id => S.sk[id] && isAttack(SK[id])); }
function fillSlots() {
  S.slots = (S.slots || [0, 0, 0, 0]).map(id => (id && S.sk[id] ? id : 0));
  for (const id of learnedAttacks().sort((a, b) => SK[b].req - SK[a].req)) {
    if (S.slots.includes(id)) continue;
    const i = S.slots.indexOf(0); if (i < 0) break; S.slots[i] = id;
  }
}
function assignSlot(i, id) { fillSlots(); const j = S.slots.indexOf(id); if (j >= 0) S.slots[j] = S.slots[i]; S.slots[i] = id; renderPad(); save(); }
/* chon chieu cho o F1-F4 (kieu JX1: bang bieu tuong bat len ngay tren thanh ky nang) - ▾ / chuot phai / o trong */
function skSlotModal(i) {
  fillSlots(); let w = $('#skPick'); if (w && w.dataset.i === String(i)) { w.remove(); return; } if (w) w.remove();
  const cur = S.slots[i], list = learnedAttacks().sort((a, b) => SK[a].req - SK[b].req), bat = $('#battle');
  w = document.createElement('div'); w.id = 'skPick'; w.dataset.i = i;
  const nm = id => { const s = SK[id], j = S.slots.indexOf(id); return `<b>${esc(s.n)}</b> <small>cấp ${S.sk[id] || 0}${j >= 0 && j !== i ? ` · đang ở F${j + 1}` : ''}</small>`; };
  w.innerHTML = `<div class="nm">F${i + 1} · ${cur ? nm(cur) : '<small>chưa gán</small>'}</div>` + (list.map(id => { const j = S.slots.indexOf(id);
    return `<button class="spk${id === cur ? ' on' : ''}" data-ss="${id}" style="background-image:url('${esc(SK[id].ic || '')}')">${j >= 0 ? `<i>F${j + 1}</i>` : ''}<u>${S.sk[id] || 0}</u></button>`; }).join('') || '<small class="dim">Chưa học chiêu tấn công</small>');
  bat.appendChild(w);
  const k = uiScale(), br = bat.getBoundingClientRect(), sb = $(`#pad .sk[data-i="${i}"]`).getBoundingClientRect(), pr = $('#pad').getBoundingClientRect();
  const W = w.offsetWidth, x = clamp((sb.left + sb.width / 2 - br.left) / k - W / 2, 4, br.width / k - W - 4);
  w.style.left = x + 'px'; w.style.bottom = ((br.bottom - pr.top) / k + 6) + 'px';
  w.querySelectorAll('[data-ss]').forEach(b => {
    b.onpointerenter = () => { w.querySelector('.nm').innerHTML = `F${i + 1} · ${nm(+b.dataset.ss)}`; };
    b.onclick = e => { e.stopPropagation(); assignSlot(i, +b.dataset.ss); w.remove(); if (curTab === 'skill') refresh(); };
  });
  setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!w.contains(e.target)) { w.remove(); document.removeEventListener('pointerdown', off, true); } }, true), 0);
}
function pressSlot(i) {
  fillSlots(); const id = S.slots[i]; if (!id) { skSlotModal(i); return; }
  S.main = id; S.mainLock = true; R.dirty = true; recalc(); renderPad(); toast('Chiêu chính: ' + SK[id].n);
}

/* ---------- thuoc & Tho Dia Phu ---------- */
function drinkNow(kind) {
  R.potCd = R.potCd || { life: 0, mana: 0 };
  if (R.potCd[kind] > 0) return;
  const r = slotPick(kind === 'mana' ? 1 : 0); if (!r) { toast('Không đủ ngân lượng mua thuốc'); return; }
  const p = r.p; usePotion(kind, p, r.free); R.potCd[kind] = POT_CD;
  toast(r.free ? `${p.n} (còn ${potStock(p.kind)[p.tier] || 0})` : `${p.n} (-${fmt(potPrice(p))} lượng)`);
}
function goTown() {
  if (R.town) return;
  if (R.dg) { toast('Đang trong phó bản / boss tuần'); return; }
  if ((R.tpCd || 0) > 0) { toast(`Thổ Địa Phù hồi sau ${Math.ceil(R.tpCd)} giây`); return; }
  R.town = true; R.enemies = []; R.corpses = []; R.pickTarget = null; R.moveTo = null; INPUT.target = null;
  obsLoad('town'); [H.x, H.y] = inWorld(WORLD.w / 2, WORLD.h / 2); snapCamera();
  R.bgImg = img(W.town.bg); uiSfx('use');
  playMusic(W.town.id);
  $('#townName').textContent = W.town.n; $('#townBar').classList.remove('hidden');
  R.banner = { t: 2.2, text: W.town.n, sub: 'Hồi phục · bán đồ · trở lại bãi' };
  log(`Dùng Thổ Địa Phù về <b>${esc(W.town.n)}</b>.`);
}
function backFromTown() {
  if (!R.town) return;
  R.town = false; { const z = zoneOf(Math.min(S.stage, STAGES)); obsLoad(z.id); [H.x, H.y] = inWorld(H.x, H.y); snapCamera(); } R.tpCd = TP_CD; S.wave = 1; R.spawnT = 0.5; R.zoneShown = null;
  $('#townBar').classList.add('hidden');
  onZoneChange(zoneOf(Math.min(S.stage, STAGES)));
}
function townTick(dt) { // trong thanh: hoi day nhanh, khong co quai
  R.life = Math.min(R.P.life, R.life + R.P.life * 0.25 * dt); R.mana = Math.min(R.P.mana, R.mana + R.P.mana * 0.25 * dt);
  moveManual(dt);
}

/* ---------- nut / phim ---------- */
function renderPad() {
  if (!S || !S.fac) return;
  fillSlots();
  document.querySelectorAll('#pad .sk').forEach(b => {
    const id = S.slots[+b.dataset.i], s = SK[id];
    b.classList.toggle('empty', !s); b.classList.toggle('nowp', !!s && !skWOk(s)); b.classList.toggle('cur', !!(s && R.P && R.P.main.id === id));
    b.querySelector('i').style.backgroundImage = s && s.ic ? `url('${s.ic}')` : '';
    const lv = s ? (S.sk[id] || 0) + (typeof skillBonusLv === 'function' ? skillBonusLv(id) : 0) : 0, bon = s && typeof skillBonusLv === 'function' ? skillBonusLv(id) : 0;
    b.title = s ? `${s.n} · cấp ${lv}${bon ? ` (${S.sk[id]}+${bon})` : ''}${skWOk(s) ? '' : ' · cần ' + EQT_VI[skEqt(s)]}` : 'Ô trống';
    let lb = b.querySelector('.sklv'); if (!lb) { lb = document.createElement('u'); lb.className = 'sklv'; b.appendChild(lb); } lb.textContent = s ? lv : ''; lb.classList.toggle('up', !!bon);
  });
  const m = R.P && R.P.main, mb = $('#bMain');
  if (mb) { const w = S.eq && S.eq.weapon, bas = m && R.P.basic === m, ic = bas ? 'img/s/8.png' : m && SK[m.id] && SK[m.id].ic;
    mb.querySelector('i').style.backgroundImage = ic ? `url('${ic}')` : ''; mb.title = 'Chiêu chính: ' + (bas ? 'Đánh thường' : m && SK[m.id] ? SK[m.id].n : '—'); }
  const b = $('#ctrlBtn'); b.innerHTML = 'Auto: <i class="ck"></i>'; b.classList.toggle('on', !manual()); b.title = manual() ? 'Tự điều khiển (F)' : 'Tự động đánh (F)';
}
function updatePadCd() {
  const pc = R.potCd || {}, set = (el, v, max) => el && el.querySelector('.cd').style.setProperty('--p', `${clamp(v / max, 0, 1) * 100}%`);
  set($('#bHp'), pc.life || 0, POT_CD); set($('#bMp'), pc.mana || 0, POT_CD); set($('#bTp'), R.tpCd || 0, TP_CD);
  for (const [id, i] of [['#bHp', 0], ['#bMp', 1]]) {          // o thuoc: thuoc da chon / tot nhat + so luong trong tui
    const el = $(id); if (!el || typeof slotShow !== 'function') continue;
    const v = slotShow(i), key = v.ic + '|' + v.n + '|' + v.name; if (el._k === key) continue; el._k = key;
    el.querySelector('i').style.backgroundImage = v.ic ? `url('${v.ic}')` : ''; el.querySelector('em').textContent = v.n || ''; el.title = `${v.name} (phím ${i + 1}) · chuột phải / ▾ để chọn thuốc`;
  }
}
function bindControls() {
  const pos = ev => { const r = CV.getBoundingClientRect(), k = uiScale(); return [(ev.clientX - r.left) / k, (ev.clientY - r.top) / k]; }; // toa do man hinh
  CV.addEventListener('pointerdown', ev => {
    if (INPUT.active) return;
    if (mouseMode() && ev.pointerType !== 'touch') {              // che do chuot: bam / giu chuot de di toi do, bam do tren dat de nhat
      const [x, y] = pos(ev), d = groundAt(x + CAM.x, y + CAM.y);
      Object.assign(INPUT, { active: true, id: ev.pointerId, fromJoy: false, mouse: true, moved: false, x, y });
      CV.setPointerCapture && CV.setPointerCapture(ev.pointerId);
      if (d) { R.pickTarget = R.pickTarget === d ? null : d; if (R.pickTarget) toast(`Đi nhặt: ${d.it.n}`); INPUT.mouse = false; return; }
      if (!manual()) setCtrl('manual');
      const [wx, wy] = inWorld(x + CAM.x, y + CAM.y); INPUT.target = { x: wx, y: wy }; R.pickTarget = null;
      return;
    }
    const [x, y] = pos(ev), a = joyAnchor(), fromJoy = !joyFixed() || Math.hypot(x - a.x, y - a.y) <= JOY_R * 1.7;
    Object.assign(INPUT, { active: true, id: ev.pointerId, fromJoy, ox: fromJoy && joyFixed() ? a.x : x, oy: fromJoy && joyFixed() ? a.y : y, x, y, moved: false });
    CV.setPointerCapture && CV.setPointerCapture(ev.pointerId);
  });
  CV.addEventListener('pointermove', ev => {
    if (!INPUT.active || ev.pointerId !== INPUT.id) return;
    const [x, y] = pos(ev); INPUT.x = x; INPUT.y = y;
    if (INPUT.mouse) { const [wx, wy] = inWorld(x + CAM.x, y + CAM.y); INPUT.target = { x: wx, y: wy }; return; }   // giu chuot: di theo con tro
    if (joyFixed() && !INPUT.fromJoy) return;                   // joystick co dinh: keo ngoai vung khong di chuyen
    if (!INPUT.moved && Math.hypot(x - INPUT.ox, y - INPUT.oy) > TAP_MOVE) { INPUT.moved = true; INPUT.target = null; if (!manual()) setCtrl('manual'); }
  });
  const up = ev => {
    if (ev.pointerId !== INPUT.id) return;
    const [x, y] = pos(ev), tap = !INPUT.moved && !INPUT.mouse;
    INPUT.mouse = false; INPUT.active = false; INPUT.id = null; INPUT.moved = false;
    if (!tap) return;
    const d = groundAt(x + CAM.x, y + CAM.y);                   // cham vao do: di nhat (doi sang toa do the gioi)
    if (d) { R.pickTarget = R.pickTarget === d ? null : d; if (R.pickTarget) toast(`Đi nhặt: ${d.it.n}`); return; }
    if (manual()) { const [wx, wy] = inWorld(x + CAM.x, y + CAM.y); INPUT.target = { x: wx, y: wy }; }   // cham dat: di toi do
  };
  CV.addEventListener('pointerup', up);
  CV.addEventListener('pointercancel', ev => { if (ev.pointerId === INPUT.id) { INPUT.active = false; INPUT.id = null; INPUT.moved = false; } });
  window.addEventListener('keydown', ev => {
    if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key; INPUT.keys[k] = true;
    if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k) && !manual()) setCtrl('manual');
    if (ev.repeat) return;
    if (/^F[1-4]$/.test(k)) { ev.preventDefault(); pressSlot(+k[1] - 1); }          // F1-F4: o vo cong
    if (k === '1' || k === 'q') drinkNow('life'); if (k === '2' || k === 'e') drinkNow('mana'); if (k === '3' || k === 't') R.town ? backFromTown() : goTown();   // 1 2 3: o vat pham
    if (k === 'f') setCtrl(manual() ? 'auto' : 'manual');
    if (k === 'r') toggleRot();
    if (k === 'm') toggleMount();                                    // M: len / xuong ngua
    if (k === ' ') { ev.preventDefault(); pickNearest(); }            // Space: nhat mon gan nhat (nhu JX1)
  });
  window.addEventListener('keyup', ev => { INPUT.keys[ev.key.length === 1 ? ev.key.toLowerCase() : ev.key] = false; });
  const tapBtn = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
  document.querySelectorAll('#pad .sk').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (e.button === 2) return; const i = +b.dataset.i; fillSlots(); if (e.target.closest('.pk') || !S.slots[i]) skSlotModal(i); else pressSlot(i); });
    b.addEventListener('contextmenu', e => { e.preventDefault(); skSlotModal(+b.dataset.i); });
  });
  for (const [id, i, k] of [['#bHp', 0, 'life'], ['#bMp', 1, 'mana']]) {   // cham: uong; ▾ / chuot phai: chon thuoc
    const el = $(id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (e.button === 2) return; if (e.target.closest('.pk')) potSlotModal(i); else drinkNow(k); });
    el.addEventListener('contextmenu', e => { e.preventDefault(); potSlotModal(i); });
  }
  tapBtn($('#bTp'), () => R.town ? backFromTown() : goTown());
  $('#bMain').onclick = () => typeof showTab === 'function' && showTab('skill');
  $('#ctrlBtn').onclick = () => setCtrl(manual() ? 'auto' : 'manual');
  $('#inBtn').onclick = () => { S.inputMode = mouseMode() ? 'joy' : 'mouse'; INPUT.target = null; refreshInputBtn(); save(); toast(mouseMode() ? 'Điều khiển bằng chuột: bấm hoặc giữ chuột để đi' : 'Điều khiển bằng joystick: kéo ở góc trái dưới'); };
  refreshInputBtn(); window.addEventListener('resize', refreshInputBtn);
  $('#rotBtn').onclick = () => toggleRot(); $('#rideBtn').onclick = () => toggleMount(); refreshRideBtn();
  refreshRotBtn();
  $('#bBack').onclick = backFromTown;
  { const kb = $('#ktcBtn'); if (kb) kb.onclick = () => ktcModal(); }
  $('#bShop').onclick = () => shopModal(); $('#bKtcT').onclick = () => ktcModal(); $('#bStashT').onclick = () => stashModal();
  $('#bSellTown').onclick = () => { const r = sellUnmatched(); toast(`Bán ${r.n} món`); refresh(); };
}
function drawJoystick(c) {
  if (mouseMode()) return;
  const fixed = joyFixed(), a = joyAnchor(), on = INPUT.active && (fixed ? INPUT.fromJoy : true);
  if (!fixed && !(on && INPUT.moved)) return;
  const ox = fixed ? a.x : INPUT.ox, oy = fixed ? a.y : INPUT.oy;
  c.globalAlpha = on ? 0.35 : 0.12; c.fillStyle = '#000'; c.beginPath(); c.arc(ox, oy, JOY_R, 0, 7); c.fill();
  const ring = img('ui/ring.png');                           // vong sang vang goc (tools/extract_ui.py), thieu thi ve vien
  if (ring && ring.complete && ring.naturalWidth) {
    const n = 4, fw = ring.naturalWidth / n, fr = Math.floor(performance.now() / 90) % n, sz = JOY_R * 2.6;
    c.globalAlpha = on ? 0.9 : 0.4; c.drawImage(ring, fr * fw, 0, fw, ring.naturalHeight, ox - sz / 2, oy - sz / 2, sz, sz);
  } else { c.globalAlpha = on ? 0.8 : 0.35; c.strokeStyle = '#e6c67a'; c.lineWidth = 2; c.beginPath(); c.arc(ox, oy, JOY_R, 0, 7); c.stroke(); }
  if (on) {
    const dx = INPUT.x - ox, dy = INPUT.y - oy, l = Math.hypot(dx, dy), k = l > JOY_R ? JOY_R / l : 1;
    c.globalAlpha = 0.8; c.fillStyle = '#e6c67a'; c.beginPath(); c.arc(ox + dx * k, oy + dy * k, 14, 0, 7); c.fill();
  }
  c.globalAlpha = 1;
}
