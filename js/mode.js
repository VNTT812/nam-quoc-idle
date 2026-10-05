/* ======================= CHE DO CHOI: LUYEN CONG / LAM NHIEM VU (bo che do vuot ai) =======================
   Luyen cong: danh quai o mot ban do binh thuong (nhu JX1), quai theo cap ban do (gan cap nhan vat), cu 3 vong co trum ban do.
     Tuy chon tu doi ban do theo cap. Khong con "vuot ai" / lui ai khi guc.
   Lam nhiem vu (tu dong): Da Tau (nhiem vu danh quai o ban do nao thi tu chuyen toi ban do do) -> Sat Thu (trum xuat hien
     o ban do co cap tuong ung) -> Di thuyen Phong Lang Do -> het viec thi luyen cong.
   Ben trong van dung S.stage (vung = 10 "ai"): S.stage chi chon cap quai trong vung, S.maxStage mo khoa theo cap nhan vat. */
'use strict';
const BOSS_ROUNDS = 3;                                       // moi 3 vong (3 x WAVES dot) co trum ban do
const zoneFirst = i => i * ZONE_STAGES + 1;
const effLv = () => (rebornN() ? MAX_LEVEL : S.lvl);
const zoneOpen = i => !!ZONES[i] && (ZONES[i].lo <= effLv() + 3 || S.maxStage >= zoneFirst(i));
/* ban do hop cap: vung cao nhat co cap thap nhat <= cap nhan vat */
function bestZoneIdx(L = S.lvl) { let b = 0; ZONES.forEach((z, i) => { if (z.lo <= L && zoneOpen(i)) b = i; }); return b; }
const zoneIdxForLevel = L => { const i = ZONES.findIndex(z => L <= z.hi); return i < 0 ? ZONES.length - 1 : i; };
/* ai trong vung co cap quai gan cap nhan vat nhat (cap ban do: lo..hi) */
function farmStage(i) {
  const f = zoneFirst(i); let best = f, bd = 1e9;
  for (let k = 0; k < ZONE_STAGES; k++) { const st = f + k; if (st > STAGES) break; const d = Math.abs(stageLevel(st) - S.lvl); if (d < bd) { bd = d; best = st; } }
  return best;
}
function syncMaxStage() { for (let i = 0; i < ZONES.length; i++) if (zoneOpen(i)) S.maxStage = Math.max(S.maxStage || 1, Math.min(STAGES, zoneFirst(i) + ZONE_STAGES - 1)); }
/* chuyen ban do ngay (doi nen, vat can, nhac) - giu quai dang co neu keep */
function gotoZone(i, why, keep) {
  if (!ZONES[i] || R.dg || R.tower) return false;
  if (R.town) backFromTown();
  const st = farmStage(i), same = zoneIdx(Math.min(S.stage, STAGES)) === i;
  S.stage = st; S.wave = 1;
  if (!same) {
    if (!keep) { R.enemies = []; R.corpses = []; R.spawnT = 0.6; }
    const z = zoneOf(st); R.zoneShown = z.id; onZoneChange(z);
    R.banner = { t: 2.2, text: z.n, sub: why || `Cấp ${z.lo}–${z.hi}` };
    if (why) log(`🗺 ${esc(why)}: tới <b>${esc(z.n)}</b>`);
  }
  return true;
}
/* ---------- vong luyen cong: so vong da qua de goi trum ban do ---------- */
const bossRoundDue = () => (R.round || 0) % BOSS_ROUNDS === BOSS_ROUNDS - 1;
/* ---------- tu doi ban do theo cap (luyen cong) ---------- */
function autoMapCheck() {
  syncMaxStage();
  if (S.mode === 'quest' || S.autoMap === false || R.dg || R.tower || R.town || R.sat) return;
  const b = bestZoneIdx(), cur = zoneIdx(Math.min(S.stage, STAGES));
  if (b !== cur) gotoZone(b, 'Đủ cấp, đổi bãi luyện công');
  else { const st = farmStage(b); if (st !== S.stage) { S.stage = st; } }
}
/* ---------- LAM NHIEM VU (tu dong) ---------- */
let qpT = 0;
function questPilot(dt) {
  qpT -= dt; if (qpT > 0) return; qpT = 1.5;
  if (S.mode !== 'quest' || !S.fac || isNovice() || R.dg || R.tower || R.deadT > 0) return;
  if (R.sat) return;                                                            // dang truy sat Sat Thu
  if (R.town) backFromTown();
  const d = DT();
  if (S.lvl >= DT_LV && d.today >= dtMax() && S.autoLdt !== false && matHave('misc', 'ldt') > 0) dtUseLdt(true);   // het luot: tu dung Lenh Bai Da Tau
  if (S.lvl >= DT_LV && d.today < dtMax()) {
    d.auto = true; if (!d.task) dtNew();
    const T = d.task;
    if (T) {
      if (dtReady(T)) { dtComplete(true); return; }
      if ((T.t === 'killm' || T.t === 'elite' || T.t === 'boss') && T.zi != null) {
        const za = (S.zalt || {})[T.zi] || 0;
        if (zoneIdx(Math.min(S.stage, STAGES)) !== T.zi) { (S.zalt || (S.zalt = {}))[T.zi] = T.za || 0; gotoZone(T.zi, `Dã Tẩu: ${dtText(T)}`); }
        else if (za !== (T.za || 0)) { S.zalt[T.zi] = T.za || 0; R.enemies = []; R.corpses = []; R.field = null; R.zoneShown = null; log(`🗺 Dã Tẩu: tới <b>${esc(T.zn)}</b>`); }   // cung bac, khac ban do thay the
        return; }
      const b = bestZoneIdx(); if (zoneIdx(Math.min(S.stage, STAGES)) !== b) gotoZone(b, `Dã Tẩu: ${dtText(T)}`);
      return;
    }
  }
  if (matHave('misc', 'lb') > 0 && S.lvl >= 20) { stStart(stTierMax()); return; }  // Sat Thu: tu chuyen toi ban do cung cap roi goi
  if (typeof boatLeft === 'function' && boatOk() && boatLeft() > 0 && verVio()) { boatStart(); return; }
  const b = bestZoneIdx(); if (zoneIdx(Math.min(S.stage, STAGES)) !== b) gotoZone(b, 'Hết nhiệm vụ, luyện công');
}
const MODES = [['farm', '⚔', 'Luyện Công', 'Dịch chuyển tới bãi luyện công hợp cấp'], ['dg', '🏯', 'Phó Bản', 'Dịch chuyển vào phó bản cao nhất còn lượt, lần lượt đi hết; hết lượt thì luyện công'], ['quest', '📜', 'Nhiệm Vụ', 'Dịch chuyển tới bản đồ nhiệm vụ: Dã Tẩu, Sát Thủ, đi thuyền; xong thì luyện công']];
const modeOf = () => MODES.find(m => m[0] === (S.mode || 'farm')) || MODES[0];
function setMode(m) {
  if ((S.mode || 'farm') === m) return;
  S.mode = m; R.dgSkip = {}; save();
  if (R.dg && R.dg.kind !== 'wb') { dgExit(); }                 // dang o pho ban / thuyen: roi ra (khong mat luot)
  if (R.town) backFromTown();
  R.dgPilotT = 0; qpT = 0;
  if (m === 'quest') log('📜 Chế độ <b>Nhiệm Vụ</b>: dịch chuyển tới bản đồ nhiệm vụ.');
  else if (m === 'dg') { log('🏯 Chế độ <b>Phó Bản</b>: tự vào phó bản còn lượt.'); if (!dgNext()) toast('Hết lượt phó bản hôm nay: luyện công'); }
  else { log('⚔ Chế độ <b>Luyện Công</b>.'); const b = S.autoMap === false ? zoneIdx(Math.min(S.stage, STAGES)) : bestZoneIdx(); gotoZone(b, 'Luyện công'); }
  refresh();
}
function modeCard(z) {
  const q = S.mode === 'quest', pd = S.mode === 'dg', d = DT(), T = d.task;
  const doing = R.dg ? (R.dg.kind === 'boat' ? '⛵ Đang đi thuyền Phong Lăng Độ' : `Trong ${R.dg.kind === 'wb' ? 'Boss tuần' : esc(R.dg.d.n)}`) : R.sat ? `🗡 Truy sát Sát Thủ cấp ${R.sat.tier}` : q ? (S.lvl >= DT_LV && d.today < DT_DAY && T ? `📜 Dã Tẩu: ${esc(dtText(T))} ${dtProg(T)}` : 'Hết nhiệm vụ: luyện công') : pd ? (dgNext() ? `🏯 Sắp vào ${esc(dgNext().n)}` : '🏯 Hết lượt phó bản: luyện công') : '';
  return `<div class="card modec">
    <div><b>${esc(z.n)}</b> <small class="dim">bản đồ cấp ${z.lo}–${z.hi} · quái cấp ~${stageLevel(S.stage)} · trùm hồi sinh ${FLD_BOSS_RESPAWN / 60} phút</small></div>
    ${doing ? `<div class="small cp">${doing}</div>` : ''}
    ${q ? '' : `<label class="small"><input type="checkbox" id="cAutoMap" ${S.autoMap === false ? '' : 'checked'}> Tự đổi bãi luyện công khi lên cấp</label>`}</div>`;
}
/* Nut "Che do:" o goc duoi trai san dau (canh nut chat): bam mo danh sach 3 che do */
function modeSwSync() {
  let w = $('#modeSw');
  if (!w) {
    w = document.createElement('div'); w.id = 'modeSw';
    w.innerHTML = `<button id="mswBtn"></button><div id="mswMenu" class="hidden">${MODES.map(m => `<button data-msw="${m[0]}" title="${m[3]}">${m[1]} ${m[2]}</button>`).join('')}</div>`;
    $('#battle').appendChild(w);
    $('#mswBtn').onclick = e => { e.stopPropagation(); $('#mswMenu').classList.toggle('hidden'); };
    w.querySelectorAll('[data-msw]').forEach(b => b.onclick = e => { e.stopPropagation(); $('#mswMenu').classList.add('hidden'); setMode(b.dataset.msw); });
    document.addEventListener('pointerdown', e => { if (!w.contains(e.target)) $('#mswMenu').classList.add('hidden'); });
  }
  w.classList.toggle('hidden', !S.fac);
  const m = modeOf(); $('#mswBtn').innerHTML = `Chế Độ: <b>${m[1]} ${m[2]}</b> ▴`;
  w.querySelectorAll('[data-msw]').forEach(b => b.classList.toggle('on', b.dataset.msw === m[0]));
}
function bindModeCard() {
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  const a = $('#cAutoMap'); if (a) a.onchange = () => { S.autoMap = a.checked; if (a.checked) autoMapCheck(); save(); refresh(); };
}
