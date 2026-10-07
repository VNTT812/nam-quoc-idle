/* ======================= ADMIN CHEAT (chi tai khoan admin) =======================
   Chi hien khi dang nhap dung ten "admin". Cheat client-side: gold, KNB, cap, diem,
   hoi mau, bat tu, xoa quai, dich chuyen, nguyen lieu, trieu hoi quai/trum, them do.
   Cap cho nguoi khac: gui thu item.__admin (cap / diem / KNB / do) — ho nhan trong Thu. */
'use strict';

/** Sticky + doc session localStorage dong bo (F5: Supabase chua kip restore). */
function netAdminSticky(on) {
  try {
    if (on) { sessionStorage.setItem('nqi_is_admin', '1'); localStorage.setItem('nqi_is_admin', '1'); }
    else { sessionStorage.removeItem('nqi_is_admin'); localStorage.removeItem('nqi_is_admin'); }
  } catch (e) { /* private */ }
}
/** Doc email admin tu ban ghi Supabase / nho dang nhap — khong can await. */
function netAdminHintSync() {
  try {
    if (sessionStorage.getItem('nqi_is_admin') === '1' || localStorage.getItem('nqi_is_admin') === '1') return true;
    const rem = JSON.parse(localStorage.getItem('nqi_remember_login') || 'null');
    if (rem && String(rem.u || '').toLowerCase() === 'admin') return true;
    const auth = JSON.parse(localStorage.getItem('jxidle_auth') || 'null');
    if (!auth) return false;
    const email = (auth.user && auth.user.email)
      || (auth.currentSession && auth.currentSession.user && auth.currentSession.user.email)
      || (auth.session && auth.session.user && auth.session.user.email)
      || '';
    return /^admin@/i.test(String(email));
  } catch (e) { return false; }
}
const isAdmin = () => {
  const u = typeof netUname === 'function' ? netUname() : '';
  if (u === 'admin') { netAdminSticky(true); return true; }
  if (u) { netAdminSticky(false); return false; }                             // da dang nhap TK khac
  return netAdminHintSync();
};

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
  const reqOf = (r, id) => (r.req.find(q => q[0] === id) || [0, -1])[1];
  let pool = (J.sets[kind] || []).filter(r => sexReqOk(r.req) && setRowOk(r) && reqOf(r, 36) <= S.lvl + 20);
  const mine = pool.filter(r => facIdMatch(reqOf(r, 39)));   // phái Test dùng srcId (8/9)
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

/** Tạo đồ để gửi người khác (không bỏ vào túi admin). */
function adminMakeGear(detail, part, tier, nMagic) {
  detail = +detail; tier = clamp(Math.floor(+tier) || Math.max(1, Math.floor(S.lvl / 12)), 1, 10);
  nMagic = clamp(Math.floor(+nMagic) || 0, 0, 6);
  const g = J.items[detail]; if (!g) throw new Error('Loại đồ không hợp lệ');
  if (part === '' || part == null || part === 'auto') {
    const ks = [...new Set(g.list.filter(r => sexReqOk(r.req)).map(r => r.k))];
    part = ks.length ? pick(ks) : (g.list[0] && g.list[0].k);
  } else part = +part;
  part = typeof sexPart === 'function' ? sexPart(detail, part) : part;
  let it = makeItem(detail, part, tier, nMagic);
  for (let t = 0; it && !sexOk(it) && t < 8; t++) it = makeItem(detail, part, tier, nMagic);
  if (!it || !sexOk(it)) throw new Error('Không tạo được món (sai giới tính / dữ liệu)');
  delete it.lock;
  return it;
}
function adminMakeSetGear(kind) {
  kind = kind === 'platina' && typeof verPlat === 'function' && verPlat() ? 'platina' : 'gold';
  const reqOf = (r, id) => (r.req.find(q => q[0] === id) || [0, -1])[1];
  let pool = (J.sets[kind] || []).filter(r => sexReqOk(r.req) && setRowOk(r) && reqOf(r, 36) <= S.lvl + 20);
  const mine = pool.filter(r => facIdMatch(reqOf(r, 39)));
  if (mine.length) pool = mine;
  if (!pool.length) throw new Error('Không có bộ phù hợp');
  const it = makeSetItem(kind, pick(pool), 10);
  if (!it) throw new Error('Không tạo được bộ');
  delete it.lock;
  return it;
}
function adminMakeHorseGear() {
  const it = typeof rareHorse === 'function' ? rareHorse() : (typeof horseRoll === 'function' ? horseRoll(true) : null);
  if (!it) throw new Error('Không tạo được ngựa');
  delete it.lock;
  return it;
}

async function adminFindChar(name) {
  name = String(name || '').trim();
  if (!name) throw new Error('Nhập tên nhân vật nhận');
  if (typeof netOn !== 'function' || !netOn() || !NET.user) throw new Error('Cần đăng nhập online');
  let r = await netCall(sb => sb.from('chars').select('name,fac,lvl,power,sex').eq('name', name).maybeSingle());
  if (r.data) return r.data;
  r = await netCall(sb => sb.from('chars').select('name,fac,lvl,power,sex').ilike('name', name).limit(8));
  const rows = r.data || [];
  if (rows.length === 1) return rows[0];
  if (rows.length > 1) throw new Error('Nhiều tên gần giống — nhập đúng: ' + rows.map(x => x.name).join(', '));
  throw new Error('Không tìm thấy «' + name + '» (họ cần đặt tên + vào xếp hạng một lần)');
}

/** Mo danh sach nhan vat de click chon (khong can go tung chu). */
async function adminPickPlayer(onPick, q) {
  const host = $('#adPickBox');
  if (!host) throw new Error('Không mở được danh sách');
  host.hidden = false;
  host.innerHTML = '<p class="dim small">Đang tải danh sách người chơi…</p>';
  try {
    const list = typeof netListChars === 'function'
      ? await netListChars(q || '', 100)
      : (await netCall(sb => sb.from('chars').select('name,fac,lvl,reborn,power,sex,updated').order('updated', { ascending: false }).limit(100))).data || [];
    if (!list.length) {
      host.innerHTML = '<p class="dim small">Chưa có nhân vật trên xếp hạng.</p><button class="btn sm" id="adPickClose">Đóng</button>';
      $('#adPickClose').onclick = () => { host.hidden = true; host.innerHTML = ''; };
      return;
    }
    host.innerHTML = `<div class="adpick-h"><b>Chọn người nhận</b> <small class="dim">${list.length} người</small>
      <input id="adPickFilter" placeholder="Lọc tên…" value="${esc(q || '')}" style="width:8em;margin-left:.4em">
      <button class="btn sm" id="adPickClose">Đóng</button></div>
      <div class="adpick-list" id="adPickList"></div>`;
    const paint = (filter) => {
      filter = String(filter || '').trim().toLowerCase();
      const rows = filter ? list.filter(x => (x.name || '').toLowerCase().includes(filter)) : list;
      const box = $('#adPickList');
      box.innerHTML = rows.map(x => `<button type="button" class="adpick-i" data-an="${esc(x.name)}"><b>${esc(x.name)}</b>
        <small>Lv${x.lvl}${x.reborn ? ' CS' + x.reborn : ''} · ${esc(typeof facName === 'function' ? facName(x.fac) : (x.fac || ''))} · LC ${fmt(x.power || 0)}</small></button>`).join('')
        || '<p class="dim small">Không khớp lọc.</p>';
      box.querySelectorAll('[data-an]').forEach(b => b.onclick = () => {
        const name = b.dataset.an;
        const ch = list.find(x => x.name === name);
        if ($('#adTo')) $('#adTo').value = name;
        host.hidden = true; host.innerHTML = '';
        if (typeof onPick === 'function') onPick(ch || { name });
        toast('Đã chọn «' + name + '»');
      });
    };
    paint(q);
    $('#adPickFilter').oninput = e => paint(e.target.value);
    $('#adPickClose').onclick = () => { host.hidden = true; host.innerHTML = ''; };
  } catch (e) {
    host.innerHTML = `<p class="reqbad">${esc(e.message || e)}</p><button class="btn sm" id="adPickClose">Đóng</button>`;
    $('#adPickClose').onclick = () => { host.hidden = true; host.innerHTML = ''; };
  }
}

/** Gui mail admin: uu tien RPC admin_send_mail (SQL MAIL_FIX), fallback insert. Khong sync chars. */
async function adminSendMailRow(to, item, kind, note) {
  const from = 'Admin';
  const row = {
    to_name: to, from_name: from, from_owner: NET.user.id,
    kind: kind || 'gift', item: item || null, gold: 0, note: String(note || '').slice(0, 100)
  };
  try {
    await netCall(sb => sb.rpc('admin_send_mail', {
      p_to: to, p_item: item, p_gold: 0, p_note: note || '', p_kind: kind || 'gift', p_from: from
    }));
    return 'rpc';
  } catch (e) {
    const msg = (e && e.message) || '';
    // Chi tai khoan admin that su bi tu choi boi RPC (da cai SQL) — khong fallback
    if (/Chỉ tài khoản admin/i.test(msg) && !/Could not find|schema cache|function/i.test(msg)) throw e;
    try {
      await netCall(sb => sb.from('mail').insert(row));
      return 'insert';
    } catch (e2) {
      const m2 = (e2 && e2.message) || msg;
      if (/chars_name|duplicate key|đổi tên/i.test(m2)) {
        throw new Error('Gửi thư lỗi máy chủ (không liên quan tên người nhận). Chạy sql/MAIL_FIX.sql trên Supabase rồi thử lại');
      }
      throw new Error('Gửi thư thất bại: ' + m2);
    }
  }
}

/** Gửi quà Admin qua thư. Đồ = gift; cấp/điểm/KNB = __admin. */
async function adminGrantPlayer(opts) {
  if (!isAdmin()) throw new Error('Chỉ tài khoản admin');
  if (typeof netOn !== 'function' || !netOn() || !NET.user) throw new Error('Cần đăng nhập online');
  const to = String((opts && opts.to) || '').trim();
  const ch = await adminFindChar(to);
  // KHONG goi netSyncChar/netNeedChar — ten NV admin trung se chan viec gui qua
  const note = String(opts.note || 'Quà từ Admin').slice(0, 100);
  const labels = [];
  let sent = 0;

  if (opts.gear && Array.isArray(opts.gear.base)) {
    const g = JSON.parse(JSON.stringify(opts.gear));
    delete g.uid; delete g.lock;
    await adminSendMailRow(ch.name, g, 'gift', note);
    labels.push(g.n || 'đồ'); sent++;
  }

  const payload = { __admin: 1, n: 'Quà Admin', base: [], mag: [], r: 5, d: 99, lvl: 1 };
  let hasStat = false;
  if (opts.lvl != null && opts.lvl !== '') {
    payload.lvl = clamp(Math.floor(+opts.lvl) || 1, 1, MAX_LEVEL);
    hasStat = true;
  }
  if (opts.addLv > 0) {
    payload.addLv = clamp(Math.floor(+opts.addLv) || 0, 0, 200);
    hasStat = true;
  }
  if (opts.attrPts > 0) { payload.attrPts = Math.max(0, Math.floor(+opts.attrPts) || 0); hasStat = true; }
  if (opts.skPts > 0) { payload.skPts = Math.max(0, Math.floor(+opts.skPts) || 0); hasStat = true; }
  if (opts.knb > 0) { payload.knb = Math.max(0, Math.floor(+opts.knb) || 0); hasStat = true; }
  if (hasStat) {
    payload.n = 'Quà Admin: ' + (typeof netMailLabel === 'function' ? netMailLabel({ item: payload }) : 'cấp / điểm');
    await adminSendMailRow(ch.name, payload, 'admin', note);
    labels.push(typeof netMailLabel === 'function' ? netMailLabel({ item: payload }) : 'cấp/điểm');
    sent++;
  }
  if (!sent) throw new Error('Chọn cấp, điểm, KNB hoặc đồ để cấp');
  const label = labels.join(' · ');
  log(`🛠 Admin cấp <b>${esc(ch.name)}</b> (Lv${ch.lvl}): ${esc(label)} — họ mở 🌐 Thư → Nhận`);
  toast('Đã gửi tới «' + ch.name + '» — bảo họ Ctrl+F5 → 🌐 Thư → Nhận');
  return { char: ch, label, payload: hasStat ? payload : null };
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
    <p class="desc small dim">Chỉ hiện với tài khoản <b>admin</b>. Phần trên = cheat bản thân; phần dưới = cấp cho người khác qua Thư.</p>
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
    <div class="card" style="margin-top:.7em;border-color:#c9a227">
      <b>📨 Cấp cho người khác</b>
      <p class="desc small dim">Gửi qua Thư (họ bấm <b>Nhận</b>). Cần đăng nhập online; tên nhân vật phải có trên xếp hạng.</p>
      <div class="row" style="flex-wrap:wrap;gap:.35em">
        Tên NV <input id="adTo" maxlength="14" placeholder="Tên nhân vật" style="width:9em">
        <button class="btn sm" id="adToList" title="Hiện tất cả người chơi — bấm tên để chọn">Danh sách</button>
        <button class="btn sm" id="adToFind">Tìm</button>
        <small id="adToInfo" class="dim"></small>
      </div>
      <div id="adPickBox" class="adpick" hidden></div>
      <div class="row" style="margin-top:.35em;flex-wrap:wrap;gap:.35em">
        Đặt cấp <input type="number" id="adGLv" min="1" max="${MAX_LEVEL}" placeholder="vd 90" style="width:4em">
        hoặc +cấp <input type="number" id="adGAdd" min="0" max="200" value="0" style="width:3em">
        KNB <input type="number" id="adGKnb" min="0" value="0" style="width:4em">
        TN <input type="number" id="adGPts" min="0" value="0" style="width:4em" title="Tiềm năng">
        KN <input type="number" id="adGSk" min="0" value="0" style="width:3em" title="Điểm kỹ năng">
        <button class="btn sm" id="adGSendStat">Gửi cấp / điểm</button>
      </div>
      <div class="row" style="margin-top:.35em;flex-wrap:wrap;gap:.35em">
        <select id="adGItemD" style="max-width:12em">${itemOpts}</select>
        Part <input type="number" id="adGItemK" placeholder="auto" style="width:4em">
        Tier <input type="number" id="adGItemT" value="${Math.max(1, Math.floor(S.lvl / 12))}" min="1" max="10" style="width:3em">
        Dòng <input type="number" id="adGItemM" value="4" min="0" max="6" style="width:3em">
        <button class="btn sm" id="adGSendItem">Gửi đồ</button>
      </div>
      <div class="btnrow" style="margin-top:.35em">
        <button class="btn sm" id="adGWep">Gửi vũ khí phái</button>
        <button class="btn sm" id="adGGold">Gửi Hoàng Kim</button>
        <button class="btn sm" id="adGPlat">Gửi Bạch Kim</button>
        <button class="btn sm" id="adGHorse">Gửi ngựa</button>
      </div>
      <div class="row" style="margin-top:.35em">Lời nhắn <input id="adGNote" maxlength="100" value="Quà từ Admin" style="flex:1;min-width:10em"></div>
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
    const grantTo = () => ($('#adTo') && $('#adTo').value) || '';
    const grantNote = () => ($('#adGNote') && $('#adGNote').value) || 'Quà từ Admin';
    const showTo = ch => {
      const el = $('#adToInfo'); if (!el) return;
      if (!ch) { el.textContent = ''; return; }
      el.innerHTML = `→ <b>${esc(ch.name)}</b> Lv${ch.lvl}${FAC[ch.fac] ? ' · ' + esc(FAC[ch.fac].n) : ''}`;
    };
    const done = (btn, msg, ch) => { toast(msg); if (ch) showTo(ch); if (btn) btn.disabled = false; };
    $('#adToList').onclick = () => busy($('#adToList'), () => adminPickPlayer(ch => { showTo(ch); }, grantTo()), () => { if ($('#adToList')) $('#adToList').disabled = false; });
    $('#adToFind').onclick = () => {
      const q = grantTo();
      if (!q) return busy($('#adToFind'), () => adminPickPlayer(ch => showTo(ch), ''), () => { if ($('#adToFind')) $('#adToFind').disabled = false; });
      busy($('#adToFind'), async () => {
        try { return await adminFindChar(q); }
        catch (e) {
          if (/Nhiều tên|Không tìm thấy/i.test(e.message || '')) {
            await adminPickPlayer(ch => showTo(ch), q);
            return null;
          }
          throw e;
        }
      }, ch => { if (ch) done($('#adToFind'), 'Tìm thấy ' + ch.name, ch); else if ($('#adToFind')) $('#adToFind').disabled = false; });
    };
    $('#adTo').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#adToList').click(); } });
    $('#adGSendStat').onclick = () => {
      const btn = $('#adGSendStat'), lvRaw = $('#adGLv').value, addLv = +$('#adGAdd').value || 0;
      const opts = { to: grantTo(), note: grantNote(), knb: +$('#adGKnb').value || 0, attrPts: +$('#adGPts').value || 0, skPts: +$('#adGSk').value || 0 };
      if (lvRaw !== '') opts.lvl = lvRaw;
      if (addLv > 0) opts.addLv = addLv;
      busy(btn, () => adminGrantPlayer(opts), r => done(btn, 'Đã gửi: ' + r.label, r.char));
    };
    const sendGear = (btn, make) => busy(btn, async () => {
      const ch = await adminFindChar(grantTo());
      const oldSex = S.sex, oldFac = S.fac;
      let gear;
      try {
        if (ch.sex != null) S.sex = ch.sex | 0;
        if (ch.fac && FAC[ch.fac]) S.fac = ch.fac;           // bộ / vũ khí theo phái người nhận
        gear = typeof make === 'function' ? make() : make;
      } finally { S.sex = oldSex; S.fac = oldFac; }
      const r = await adminGrantPlayer({ to: ch.name, note: grantNote(), gear });
      return r;
    }, r => done(btn, 'Đã gửi: ' + r.label, r.char));
    $('#adGSendItem').onclick = () => {
      const k = $('#adGItemK').value;
      sendGear($('#adGSendItem'), () => adminMakeGear($('#adGItemD').value, k === '' ? 'auto' : k, $('#adGItemT').value, $('#adGItemM').value));
    };
    $('#adGWep').onclick = () => sendGear($('#adGWep'), () => {
      const [d, p] = wantWeaponDP();
      return adminMakeGear(d, p, Math.max(1, Math.floor(S.lvl / 12)), 4);
    });
    $('#adGGold').onclick = () => sendGear($('#adGGold'), () => adminMakeSetGear('gold'));
    $('#adGPlat').onclick = () => sendGear($('#adGPlat'), () => adminMakeSetGear('platina'));
    $('#adGHorse').onclick = () => sendGear($('#adGHorse'), () => adminMakeHorseGear());
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
function friendsInjectMore() {
  if (!S || !S.fac) return;
  const t = $('#t-more'); if (!t || t.querySelector('#bFriends')) return;
  const card = `<h3>👥 Bạn bè</h3><div class="card"><p class="dim small">Danh sách bạn, mời kết bạn, gửi thư nhanh.</p><div class="btnrow"><button class="btn" id="bFriends">Mở bạn bè${S.friends && S.friends.length ? ` (${S.friends.length})` : ''}</button></div></div>`;
  const adm = t.querySelector('#bAdmin');
  if (adm) adm.closest('.card')?.previousElementSibling?.insertAdjacentHTML?.('beforebegin', card);
  else t.insertAdjacentHTML('afterbegin', card);
  if (!t.querySelector('#bFriends')) t.insertAdjacentHTML('afterbegin', card);
  const b = $('#bFriends'); if (b) b.onclick = () => typeof friendsModal === 'function' && friendsModal();
}

/* ---------- hook UI + combat ---------- */
(function adminBoot() {
  const prev = typeof renderMore === 'function' ? renderMore : null;
  if (prev) renderMore = function () { prev(); friendsInjectMore(); adminInjectMore(); };

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
