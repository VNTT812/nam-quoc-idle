/* ======================= PHONG LANG DO · DI THUYEN (nhu JX1) =======================
   Nhan nhiem vu o the Nhiem vu -> tu chuyen len ban do Thuyen (JX1: 中原北区\渡船, map 337 "Ben thuyen").
   Thuyen qua song 4 doan: 3 doan Thuy Tac danh len thuyen, doan 4 Thuy Tac Dau Linh. Gioi han 4 phut, guc nga = that bai (khong mat luot).
   Tren thuyen: Huyen Tinh va da thuoc tinh roi x5. Qua song: ngan luong, Phuc Duyen, do, Huyen Tinh + da thuoc tinh chac chan.
   3 chuyen / ngay (chi tru luot khi qua song). Dung chung che do R.dg cua pho ban (dungeon.js). */
'use strict';
const BOAT = { id: 337, n: 'Phong Lăng Độ · Thuyền', bg: 'img/z/337.jpg', bgFb: 'img/z/336.jpg', lo: 1, hi: 200, m: [674], sw: [20, 20, 20, 20, 20] };
const BOAT_RUNS = 3, BOAT_SEGS = 4, BOAT_LIMIT = 240, BOAT_LV = 30, BOAT_DROP = 5, BOAT_TID = 674;
const boatLeft = () => Math.max(0, BOAT_RUNS - (DG().boat || 0));
const boatOk = () => S.lvl >= BOAT_LV || RW().stat.reborn > 0;
const boatOn = () => !!(R.dg && R.dg.kind === 'boat');
/* doi ban do: anh nen + vat can cua thuyen (chua co anh thuyen: dung ben Phong Lang Do) */
function boatMap(on) {
  if (on) {
    const z = Object.assign({}, BOAT, { bg: window.JMO && window.JMO['337'] ? BOAT.bg : BOAT.bgFb });
    R.zoneShown = 'boat'; obsLoad(window.JMO && window.JMO['337'] ? 337 : 336);
    [H.x, H.y] = inWorld(window.JMO && window.JMO['337'] ? 2150 : WORLD.w / 2, window.JMO && window.JMO['337'] ? 1130 : WORLD.h / 2); snapCamera(); R.bgImg = img(z.bg); playMusic(336);   // giua san thuyen
  } else { R.zoneShown = null; onZoneChange(zoneOf(Math.min(S.stage, STAGES))); }
}
function boatStart() {
  if (dgBusy()) { toast(R.deadT > 0 ? 'Đang trọng thương, chờ hồi phục' : 'Đang ở tháp / phó bản'); return; }
  if (!boatOk()) { toast(`Cần cấp ${BOAT_LV}`); return; }
  if (!boatLeft()) { toast('Hết chuyến đò hôm nay'); return; }
  dgEnterCommon();
  R.dg = { kind: 'boat', d: { n: 'Phong Lăng Độ' }, room: 1, t: 0, limit: BOAT_LIMIT, L: dgLevel(1) };
  boatMap(true);
  R.banner = { t: 2.6, text: 'Phong Lăng Độ', sub: `Lên thuyền qua sông · ${BOAT_SEGS} đoạn · Thủy Tặc chặn đường` };
  log('⛵ Lên thuyền <b>Phong Lăng Độ</b>: Huyền Tinh và đá thuộc tính rơi ×' + BOAT_DROP + ' trên thuyền.');
  if (curTab === 'quest') refresh();
}
function boatSpawn() {
  const g = R.dg, last = g.room >= BOAT_SEGS;
  const near = (a, b) => { const t = rnd(0, Math.PI * 2), r = rnd(a, b); return inWorld(H.x + Math.cos(t) * r, H.y + Math.sin(t) * r); };
  if (last) {
    const [x, y] = near(200, 250), b = makeEnemy(BOAT_TID, g.L + 2, 'boss', x, y);
    b.hp = b.max = b.max * 3; b.dmg *= 1.2; b.n = 'Thủy Tặc Đầu Lĩnh';
    R.enemies.push(b);
    for (let i = 0; i < 3; i++) { const [ex, ey] = near(120, 240); const e = makeEnemy(BOAT_TID, g.L, 'elite', ex, ey); e.n = 'Thủy Tặc'; R.enemies.push(e); }
  } else {
    const n = 5 + g.room;
    for (let i = 0; i < n; i++) { const [x, y] = near(120, 280); const e = makeEnemy(BOAT_TID, g.L, i < g.room ? 'elite' : 'normal', x, y); e.n = 'Thủy Tặc'; R.enemies.push(e); }
  }
}
function boatCleared() {
  const g = R.dg;
  if (g.room >= BOAT_SEGS) { boatWin(); return; }
  g.room++; heal(R.P.life * 0.3, true); R.mana = Math.min(R.P.mana, R.mana + R.P.mana * 0.3); R.spawnT = 1.6;
  R.banner = { t: 1.4, text: `Đoạn sông ${g.room}/${BOAT_SEGS}`, sub: g.room >= BOAT_SEGS ? 'Thủy Tặc Đầu Lĩnh chặn thuyền!' : 'Thủy Tặc nhảy lên thuyền!' };
}
function boatWin() {
  const g = R.dg, G = DG(); G.boat = (G.boat || 0) + 1;
  const r = REC(); r.boatN = (r.boatN || 0) + 1;
  grant({ gold: 3000, fd: 10, item: 5, xp: 0.02 }, 'Qua sông Phong Lăng Độ');
  if (verVio()) { const l = clamp(Math.floor(g.L / 15) + 1, 1, HT_MAX); matAdd('ht', l, 3); const o = [forceOre(g.L), forceOre(g.L)]; log(`⛵ Thưởng qua sông: 3 Huyền Tinh cấp ${l}, ${o.join(', ')}`); }
  if (Math.random() < 0.3) { matAdd('misc', 'wc', 1); log('⛵ Nhận 1 Thủy Tinh Trắng'); }
  questTick('boat');
  R.banner = { t: 3, text: 'Qua sông thành công!', sub: `${Math.round(g.t)} giây · còn ${boatLeft()} chuyến hôm nay` };
  uiSfx('levelup'); achCheck(); boatExit(); save();
}
function boatExit() { dgExit(); boatMap(false); if (curTab === 'quest') refresh(); }
const boatDropMul = () => (boatOn() ? BOAT_DROP : 1);
function boatBody() {
  const busy = boatOn();
  return `<p class="desc">Lên thuyền Phong Lăng Độ qua sông, Thủy Tặc đánh lên thuyền ${BOAT_SEGS - 1} đợt, đợt cuối là <b>Thủy Tặc Đầu Lĩnh</b>. Nhận nhiệm vụ là <b>tự chuyển lên bản đồ Thuyền</b>.</p>
    <div class="card"><div class="stats"><span>Chuyến còn hôm nay</span><span>${boatLeft()}/${BOAT_RUNS}</span><span>Yêu cầu</span><span>cấp ${BOAT_LV}</span><span>Thời gian</span><span>${BOAT_LIMIT / 60} phút</span><span>Đã qua sông</span><span>${REC().boatN || 0} lần</span></div>
      <div class="small">Trên thuyền: <b class="cp">Huyền Tinh và đá thuộc tính rơi ×${BOAT_DROP}</b>. Qua sông: ${fmt(3000 * (1 + S.lvl / 10))} lượng, 10 Phúc Duyên, đồ 5 dòng, 3 Huyền Tinh + 2 đá thuộc tính, 30% Thủy Tinh Trắng. Gục ngã / hết giờ: thất bại, không mất lượt.</div>
      <div class="btnrow">${busy ? '<button class="btn red" id="boatOut">Rời thuyền (không mất lượt)</button>' : `<button class="btn" id="boatGo" ${boatOk() && boatLeft() && !dgBusy() ? '' : 'disabled'}>${!boatOk() ? `Cần cấp ${BOAT_LV}` : boatLeft() ? '⛵ Lên thuyền' : 'Hết chuyến hôm nay'}</button>`}</div></div>`;
}
function bindBoat(root) {
  const go = root.querySelector('#boatGo'); if (go) go.onclick = () => { closeModal(true); boatStart(); };
  const out = root.querySelector('#boatOut'); if (out) out.onclick = () => { log('Rời thuyền Phong Lăng Độ.'); boatExit(); };
}
