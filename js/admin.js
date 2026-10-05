/* ======================= ADMIN CHEAT (chi tai khoan admin) =======================
   Chi hien khi dang nhap dung ten "admin". Cheat client-side: gold, KNB, cap, diem,
   hoi mau, bat tu, xoa quai, dich chuyen ban do, nguyen lieu. */
'use strict';

const isAdmin = () => typeof netUname === 'function' && netUname() === 'admin';

function adminApply() {
  if (!S || !S.fac) return;
  R.dirty = true; recalc(); save();
  if (typeof updateTop === 'function') updateTop();
  if (typeof refresh === 'function') refresh();
}

function adminSetLevel(lv) {
  lv = clamp(Math.floor(+lv) || 1, 1, MAX_LEVEL);
  const old = S.lvl | 0;
  if (lv > old) {
    S.attrPts = (S.attrPts | 0) + PTS_PER_LEVEL * (lv - old);
    S.skPts = (S.skPts | 0) + SKILL_PTS_PER_LEVEL * (lv - old);
  }
  S.lvl = lv; S.xp = 0;
  if (typeof syncMaxStage === 'function') syncMaxStage();
  adminApply();
  log(`🛠 Admin: đặt cấp <b>${lv}</b>${lv > old ? ` (+${PTS_PER_LEVEL * (lv - old)} tiềm năng, +${SKILL_PTS_PER_LEVEL * (lv - old)} kỹ năng)` : ''}`);
  toast(`Cấp ${lv}`);
}

function adminHeal() {
  if (!R.P) return;
  R.life = R.P.life; R.mana = R.P.mana;
  R.hpDot = 0; R.hpDotT = 0; R.stunT = 0; R.slowT = 0;
  if (R.deadT > 0) R.deadT = 0;
  toast('Đã hồi đầy');
  if (typeof updateTop === 'function') updateTop();
}

function adminClearMobs() {
  if (!R.enemies) return;
  const n = R.enemies.filter(e => !e.dead).length;
  R.enemies = []; R.corpses = []; R.spawnT = 1.2;
  toast(n ? `Xóa ${n} quái` : 'Không có quái');
  log('🛠 Admin: xóa hết quái trên bản đồ');
}

function adminUnlockMaps() {
  S.maxStage = STAGES;
  if (typeof syncMaxStage === 'function') syncMaxStage();
  adminApply();
  toast('Mở hết bản đồ');
  log('🛠 Admin: mở khóa toàn bộ bản đồ luyện công');
}

function adminGotoZone(i) {
  i = +i; if (!ZONES[i]) return toast('Bản đồ không hợp lệ');
  if (R.dg || R.tower) return toast('Thoát phó bản / tháp trước');
  S.mode = 'farm'; S.autoMap = false;
  S.maxStage = Math.max(S.maxStage || 1, zoneFirst(i) + ZONE_STAGES - 1);
  gotoZone(i, 'Admin dịch chuyển');
  adminApply();
  toast(ZONES[i].n);
}

function adminMats() {
  matAdd('ht', Math.min(10, Math.max(1, Math.floor(S.lvl / 15) + 1)), 20);
  matAdd('misc', 'wc', 10);
  matAdd('misc', 'mys', 10);
  matAdd('misc', 'bk90', 5);
  matAdd('misc', 'dtbk', 3);
  matAdd('misc', 'ldt', 10);
  matAdd('misc', 'ldp', 2);
  adminApply();
  toast('Đã thêm nguyên liệu / lệnh bài');
  log('🛠 Admin: +Huyền Tinh, Thủy Tinh, Khoáng, Mật Tịch, Đại Thành, Lệnh Bài');
}

function adminModal() {
  if (!isAdmin()) return toast('Chỉ tài khoản admin');
  if (!S || !S.fac) return toast('Chọn nhân vật trước');
  const zones = ZONES.map((z, i) => `<option value="${i}">${esc(z.n)} (${z.lo}–${z.hi})</option>`).join('');
  const curZ = zoneIdx(Math.min(S.stage, STAGES));
  modal(`<h3>🛠 Admin Cheat <small class="dim">@${esc(netUname())}</small></h3>
    <p class="desc small dim">Chỉ hiện với tài khoản <b>admin</b>. Thay đổi lưu vào nhân vật đang chơi.</p>
    <div class="card">
      <div class="row">Ngân lượng <input type="number" id="adGold" value="${S.gold | 0}" min="0" step="100000" style="width:9em">
        <button class="btn sm" id="adGoldSet">Đặt</button>
        <button class="btn sm" data-ag="1000000">+1M</button>
        <button class="btn sm" data-ag="100000000">+100M</button></div>
      <div class="row">Kim Nguyên Bảo <input type="number" id="adKnb" value="${S.knb || 0}" min="0" step="10" style="width:6em">
        <button class="btn sm" id="adKnbSet">Đặt</button>
        <button class="btn sm" data-ak="10">+10</button>
        <button class="btn sm" data-ak="100">+100</button></div>
      <div class="row">Cấp <input type="number" id="adLv" value="${S.lvl}" min="1" max="${MAX_LEVEL}" style="width:5em">
        <button class="btn sm" id="adLvSet">Đặt cấp</button>
        <button class="btn sm" data-al="10">+10</button>
        <button class="btn sm" data-al="50">+50</button>
        <button class="btn sm" id="adLvMax">Max ${MAX_LEVEL}</button></div>
      <div class="row">Tiềm năng <input type="number" id="adPts" value="100" min="0" style="width:5em">
        <button class="btn sm" id="adPtsAdd">+ tiềm năng</button>
        Kỹ năng <input type="number" id="adSk" value="20" min="0" style="width:4em">
        <button class="btn sm" id="adSkAdd">+ kỹ năng</button></div>
    </div>
    <div class="card lootf">
      <label><input type="checkbox" id="adGod" ${S.adminGod ? 'checked' : ''}> Bất tử (không mất máu / nội lực)</label>
      <label><input type="checkbox" id="adOhk" ${S.adminOhk ? 'checked' : ''}> Một đòn diệt (sát thương ×999)</label>
    </div>
    <div class="btnrow">
      <button class="btn" id="adHeal">Hồi đầy</button>
      <button class="btn" id="adClear">Xóa quái</button>
      <button class="btn" id="adUnlock">Mở hết bản đồ</button>
      <button class="btn" id="adMats">+ Nguyên liệu</button>
    </div>
    <div class="row" style="margin-top:.5em">Dịch chuyển
      <select id="adZone">${zones}</select>
      <button class="btn sm" id="adGo">Đi</button>
    </div>
    <div class="btnrow" style="margin-top:.6em"><button class="btn" id="adSwitch">Đổi tài khoản</button></div>`, () => {
    const $g = $('#adGold'), $k = $('#adKnb'), $l = $('#adLv');
    $('#adZone').value = String(curZ);
    $('#adGoldSet').onclick = () => { S.gold = Math.max(0, Math.floor(+$g.value) || 0); adminApply(); toast('Ngân lượng: ' + fmt(S.gold)); };
    document.querySelectorAll('[data-ag]').forEach(b => b.onclick = () => { S.gold = (S.gold | 0) + (+b.dataset.ag); $g.value = S.gold; adminApply(); toast('+' + fmt(+b.dataset.ag)); });
    $('#adKnbSet').onclick = () => { S.knb = Math.max(0, Math.floor(+$k.value) || 0); adminApply(); toast('KNB: ' + fmt(S.knb)); };
    document.querySelectorAll('[data-ak]').forEach(b => b.onclick = () => { S.knb = (S.knb || 0) + (+b.dataset.ak); $k.value = S.knb; adminApply(); toast('+' + b.dataset.ak + ' KNB'); });
    $('#adLvSet').onclick = () => adminSetLevel($l.value);
    document.querySelectorAll('[data-al]').forEach(b => b.onclick = () => { adminSetLevel((S.lvl | 0) + (+b.dataset.al)); $l.value = S.lvl; });
    $('#adLvMax').onclick = () => { adminSetLevel(MAX_LEVEL); $l.value = S.lvl; };
    $('#adPtsAdd').onclick = () => { const n = Math.max(0, Math.floor(+$('#adPts').value) || 0); S.attrPts = (S.attrPts | 0) + n; adminApply(); toast('+' + n + ' tiềm năng'); };
    $('#adSkAdd').onclick = () => { const n = Math.max(0, Math.floor(+$('#adSk').value) || 0); S.skPts = (S.skPts | 0) + n; adminApply(); toast('+' + n + ' kỹ năng'); };
    $('#adGod').onchange = e => { S.adminGod = !!e.target.checked; save(); toast(S.adminGod ? 'Bất tử ON' : 'Bất tử OFF'); };
    $('#adOhk').onchange = e => { S.adminOhk = !!e.target.checked; save(); toast(S.adminOhk ? 'Một đòn ON' : 'Một đòn OFF'); };
    $('#adHeal').onclick = () => adminHeal();
    $('#adClear').onclick = () => adminClearMobs();
    $('#adUnlock').onclick = () => adminUnlockMaps();
    $('#adMats').onclick = () => adminMats();
    $('#adGo').onclick = () => adminGotoZone($('#adZone').value);
    $('#adSwitch').onclick = () => typeof netSwitchAccount === 'function' && netSwitchAccount($('#adSwitch'));
  });
}

function adminInjectMore() {
  if (!isAdmin() || !S || !S.fac) return;
  if (typeof u20MoreMode !== 'undefined' && u20MoreMode === 'tt' && typeof u2any === 'function' && u2any()) return;
  const t = $('#t-more'); if (!t || t.querySelector('#bAdmin')) return;
  t.insertAdjacentHTML('afterbegin', `<h3>🛠 Admin</h3><div class="card"><p class="dim small">Cheat chỉ dành cho tài khoản <b>admin</b> (đang đăng nhập: ${esc(netUname())}).</p><div class="btnrow"><button class="btn" id="bAdmin">Mở bảng cheat</button><button class="btn" id="bAdminSwitch">Đổi tài khoản</button></div></div>`);
  $('#bAdmin').onclick = () => adminModal();
  $('#bAdminSwitch').onclick = () => typeof netSwitchAccount === 'function' && netSwitchAccount($('#bAdminSwitch'));
}

/* ---------- hook UI + combat ---------- */
(function adminBoot() {
  const prev = typeof renderMore === 'function' ? renderMore : null;
  if (prev) renderMore = function () { prev(); adminInjectMore(); };

  if (typeof tick === 'function') {
    const _tick = tick;
    tick = function (dt) {
      _tick(dt);
      if (!S || !S.adminGod || !isAdmin() || !R.P) return;
      R.life = R.P.life; R.mana = R.P.mana;
      R.hpDot = 0; R.hpDotT = 0; R.stunT = 0; R.deadT = 0;
    };
  }

  if (typeof heroHit === 'function') {
    const _heroHit = heroHit;
    heroHit = function (a, e) {
      const tot = _heroHit(a, e);
      if (S && S.adminOhk && isAdmin() && e && !e.dead && tot > 0) {
        e.hp = 0;
        addText(e.x, e.y - e.r - 18, 'OHK', '#ffd24a', 14);
      }
      return tot;
    };
  }

  document.addEventListener('keydown', e => {
    if (!e.altKey || e.key !== 'a' && e.key !== 'A') return;
    if (!isAdmin() || !S || !S.fac) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    e.preventDefault();
    adminModal();
  });
})();
