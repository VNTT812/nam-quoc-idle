/* ======================= ADMIN CHEAT (chi tai khoan admin) =======================
   Chi hien khi dang nhap dung ten "admin". Cheat client-side: gold, KNB, cap, diem,
   hoi mau, bat tu, xoa quai, dich chuyen, nguyen lieu, trieu hoi quai/trum, them do. */
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

/** Gần nhân vật (ngoài tầm sát thương cận chiến một chút). */
function adminNearPos(r0 = 70, r1 = 140) {
  const a = rnd(0, Math.PI * 2), r = rnd(r0, r1);
  return inWorld(H.x + Math.cos(a) * r, H.y + Math.sin(a) * r);
}

/** Danh sách quái cho cheat: map hiện tại + trùm mọi map. */
function adminMobOptions() {
  const z = zoneOf(Math.min(S.stage, STAGES)), seen = new Set(), opts = [];
  const add = (tid, tag) => {
    tid = +tid; if (!MON[tid] || seen.has(tid)) return;
    seen.add(tid);
    opts.push({ tid, label: `${MON[tid].n}${tag || ''} · #${tid}` });
  };
  (z.m || []).forEach(t => add(t, ' · map'));
  if (z.boss) add(z.boss, ' · trùm map');
  ZONES.forEach(zz => { if (zz.boss) add(zz.boss, ` · trùm ${zz.n}`); });
  return opts;
}

function adminSummon(tid, cls, lv, n) {
  if (!isAdmin() || !S || !S.fac) return toast('Chỉ tài khoản admin');
  if (R.town) return toast('Ra khỏi thành trước');
  tid = +tid; cls = cls || 'normal'; n = clamp(Math.floor(+n) || 1, 1, 20);
  lv = clamp(Math.floor(+lv) || stageLevel(S.stage), 1, levelCap());
  if (!MON[tid]) return toast('Quái không hợp lệ');
  if (!['normal', 'elite', 'boss'].includes(cls)) cls = 'normal';
  const z = zoneOf(Math.min(S.stage, STAGES));
  let spawned = 0;
  for (let i = 0; i < n; i++) {
    const [x, y] = adminNearPos(cls === 'boss' ? 120 : 70, cls === 'boss' ? 200 : 150);
    const e = makeEnemy(tid, lv + (cls === 'boss' ? 1 : 0), cls, x, y);
    if (cls === 'boss') e.n = bossName(tid, z.n);
    e.aggro = true;
    R.enemies.push(e);
    spawned++;
  }
  toast(`Triệu hồi ${spawned}× ${MON[tid].n} (${cls}, Lv${lv})`);
  log(`🛠 Admin: triệu hồi <b>${esc(MON[tid].n)}</b> ×${spawned} · ${cls} · Lv${lv}`);
}

function adminGiveItem(detail, part, tier, nMagic) {
  if (!isAdmin() || !S || !S.fac) return toast('Chỉ tài khoản admin');
  detail = +detail; tier = clamp(Math.floor(+tier) || Math.max(1, Math.floor(S.lvl / 12)), 1, 10);
  nMagic = clamp(Math.floor(+nMagic) || 0, 0, 6);
  const g = J.items[detail]; if (!g) return toast('Loại đồ không hợp lệ');
  if (part === '' || part == null || part === 'auto') {
    const ks = [...new Set(g.list.filter(r => sexReqOk(r.req)).map(r => r.k))];
    part = ks.length ? pick(ks) : (g.list[0] && g.list[0].k);
  } else part = +part;
  part = typeof sexPart === 'function' ? sexPart(detail, part) : part;
  let it = makeItem(detail, part, tier, nMagic);
  for (let t = 0; it && !sexOk(it) && t < 8; t++) it = makeItem(detail, part, tier, nMagic);
  if (!it || !sexOk(it)) return toast('Không tạo được món (sai giới tính / dữ liệu)');
  if (!addItem(it, false, true, true)) return toast('Túi đầy — không thêm được');
  adminApply();
  toast(`+ ${it.n}`);
  log(`🛠 Admin: thêm <span style="color:${RAR_COL[it.r]}">${esc(it.n)}</span> (cấp đồ ${it.lvl}, ${nMagic} dòng)`);
  return it;
}

function adminGiveWeapon() {
  const [d, p] = wantWeaponDP();
  return adminGiveItem(d, p, Math.max(1, Math.floor(S.lvl / 12)), 4);
}

function adminGiveSet(kind) {
  if (!isAdmin() || !S || !S.fac) return toast('Chỉ tài khoản admin');
  kind = kind === 'platina' && typeof verPlat === 'function' && verPlat() ? 'platina' : 'gold';
  const fid = FAC[S.fac] ? FAC[S.fac].id : -1;
  const reqOf = (r, id) => (r.req.find(q => q[0] === id) || [0, -1])[1];
  let pool = (J.sets[kind] || []).filter(r => sexReqOk(r.req) && setRowOk(r) && reqOf(r, 36) <= S.lvl + 20);
  const mine = pool.filter(r => reqOf(r, 39) === fid);
  if (mine.length) pool = mine;
  if (!pool.length) return toast('Không có bộ phù hợp');
  const it = makeSetItem(kind, pick(pool), 10);
  if (!addItem(it, false, true, true)) return toast('Túi đầy');
  adminApply();
  toast(`+ ${it.n}`);
  log(`🛠 Admin: thêm bộ <span style="color:${RAR_COL[it.r]}">${esc(it.n)}</span>`);
  return it;
}

function adminGiveHorse() {
  if (!isAdmin() || !S || !S.fac) return toast('Chỉ tài khoản admin');
  const it = typeof rareHorse === 'function' ? rareHorse() : (typeof horseRoll === 'function' ? horseRoll(true) : null);
  if (!it) return toast('Không tạo được ngựa');
  if (!addItem(it, false, true, true)) return toast('Túi đầy');
  adminApply();
  toast(`+ ${it.n}`);
  log(`🛠 Admin: thêm ngựa <span style="color:${RAR_COL[it.r]}">${esc(it.n)}</span>`);
  return it;
}

function adminModal() {
  if (!isAdmin()) return toast('Chỉ tài khoản admin');
  if (!S || !S.fac) return toast('Chọn nhân vật trước');
  const zones = ZONES.map((z, i) => `<option value="${i}">${esc(z.n)} (${z.lo}–${z.hi})</option>`).join('');
  const curZ = zoneIdx(Math.min(S.stage, STAGES));
  const mobs = adminMobOptions();
  const mobOpts = mobs.map(o => `<option value="${o.tid}">${esc(o.label)}</option>`).join('');
  const itemOpts = Object.keys(J.items).map(d => {
    const g = J.items[d]; return `<option value="${d}">${+d}. ${esc(g.n || ('Loại ' + d))}</option>`;
  }).join('');
  const defLv = stageLevel(S.stage);
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
    <div class="card" style="margin-top:.55em">
      <b>👹 Triệu hồi quái / trùm</b>
      <div class="row" style="margin-top:.35em;flex-wrap:wrap;gap:.35em">
        <select id="adMob" style="max-width:16em">${mobOpts}</select>
        <select id="adCls">
          <option value="normal">Thường</option>
          <option value="elite">Tinh anh</option>
          <option value="boss" selected>Trùm</option>
        </select>
        Lv <input type="number" id="adMobLv" value="${defLv}" min="1" max="${MAX_LEVEL}" style="width:4em">
        Số <input type="number" id="adMobN" value="1" min="1" max="20" style="width:3em">
        <button class="btn sm" id="adSummon">Triệu hồi</button>
      </div>
      <div class="btnrow" style="margin-top:.35em">
        <button class="btn sm" id="adSumBoss">Trùm map này</button>
        <button class="btn sm" id="adSumElite">1 tinh anh map</button>
        <button class="btn sm" id="adSumPack">5 quái map</button>
      </div>
    </div>
    <div class="card" style="margin-top:.55em">
      <b>🎁 Thêm vật phẩm</b>
      <div class="row" style="margin-top:.35em;flex-wrap:wrap;gap:.35em">
        <select id="adItemD" style="max-width:12em">${itemOpts}</select>
        Part <input type="number" id="adItemK" placeholder="auto" style="width:4em" title="Để trống = ngẫu nhiên đúng giới tính">
        Tier <input type="number" id="adItemT" value="${Math.max(1, Math.floor(S.lvl / 12))}" min="1" max="10" style="width:3em">
        Dòng <input type="number" id="adItemM" value="4" min="0" max="6" style="width:3em">
        <button class="btn sm" id="adGive">Thêm</button>
      </div>
      <div class="btnrow" style="margin-top:.35em">
        <button class="btn sm" id="adGiveWep">Vũ khí phái</button>
        <button class="btn sm" id="adGiveGold">Hoàng Kim</button>
        <button class="btn sm" id="adGivePlat">Bạch Kim</button>
        <button class="btn sm" id="adGiveHorse">Ngựa</button>
      </div>
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
    $('#adSummon').onclick = () => adminSummon($('#adMob').value, $('#adCls').value, $('#adMobLv').value, $('#adMobN').value);
    $('#adSumBoss').onclick = () => {
      const z = zoneOf(Math.min(S.stage, STAGES));
      if (!z.boss) return toast('Map không có trùm');
      adminSummon(z.boss, 'boss', stageLevel(S.stage), 1);
    };
    $('#adSumElite').onclick = () => {
      const z = zoneOf(Math.min(S.stage, STAGES)), tid = pick(z.m || []);
      if (!tid) return toast('Map không có quái');
      adminSummon(tid, 'elite', stageLevel(S.stage), 1);
    };
    $('#adSumPack').onclick = () => {
      const z = zoneOf(Math.min(S.stage, STAGES));
      if (!(z.m || []).length) return toast('Map không có quái');
      for (let i = 0; i < 5; i++) adminSummon(pick(z.m), 'normal', stageLevel(S.stage), 1);
    };
    $('#adGive').onclick = () => {
      const k = $('#adItemK').value;
      adminGiveItem($('#adItemD').value, k === '' ? 'auto' : k, $('#adItemT').value, $('#adItemM').value);
    };
    $('#adGiveWep').onclick = () => adminGiveWeapon();
    $('#adGiveGold').onclick = () => adminGiveSet('gold');
    $('#adGivePlat').onclick = () => adminGiveSet('platina');
    $('#adGiveHorse').onclick = () => adminGiveHorse();
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
