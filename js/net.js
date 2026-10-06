/* ======================= GIANG HO ONLINE (Supabase) =======================
   Tai khoan (ten dang nhap + mat khau), Luu dam may, Bang xep hang, Xem trang bi nguoi khac, Thu (gui qua), Cho (bay ban).
   May chu: NET_SETUP.sql. Moi mon trong Thu chi nhan duoc 1 lan (may chu kiem tra); mua o Cho: 1 nguoi mua, tien 95% ve Thu nguoi ban. */
'use strict';
const NET = { sb: null, user: null, tab: 'acc', mkt: 'buy', rank: 'lvl', rfac: '', mailN: 0, lastChar: 0, lastUp: 0, sel: null, q: '', offline: false };
const NET_DOMAIN = '@volamidle.com', NET_TAX = 0.05;   // v198: supabase moi chan TLD .game (email_address_invalid)
/* v182: moi ban (web, launcher tren may) deu phai dang nhap, chi luu dam may. NET_LOCAL chi cho bo thu tu dong (?offline_test=1). */
const NET_LOCAL = /[?&]offline_test=1\b/.test(location.search);
const netOn = () => { const c = window.CHAT_CFG || {}; return !!(c.url && c.key) && !NET_LOCAL && !NET.offline; };
const netUname = () => NET.user && NET.user.email ? NET.user.email.replace(NET_DOMAIN, '') : '';
const netErr = e => { const m = (e && (e.message || e.error_description)) || String(e || 'Lỗi mạng');
  if (/chars_name|duplicate key/i.test(m)) return 'Tên nhân vật đã có người dùng — hãy đổi tên (thẻ Nhân vật ✏)';
  if (/Invalid login/i.test(m)) return 'Sai tên đăng nhập hoặc mật khẩu';
  if (/already registered|already exists/i.test(m)) return 'Tên đăng nhập đã có người dùng';
  if (/Email not confirmed/i.test(m)) return 'Supabase đang bật "Confirm email" — hãy tắt (xem HUONG_DAN_WEB.txt)';
  if (/relation .* does not exist|Could not find the (table|function)/i.test(m)) return 'Máy chủ chưa chạy NET_SETUP.sql';
  if (/Failed to fetch|NetworkError|Load failed|timed out|522|503|fetch/i.test(m)) return 'Máy chủ đăng nhập đang tắt hoặc mất mạng — thử lại sau, hoặc chơi offline';
  return m; };
const netGoOffline = () => {
  NET.offline = true; NET.user = null; NET.sb = null;
  try { const u = new URL(location.href); u.searchParams.set('offline_test', '1'); location.replace(u.toString()); }
  catch (e) { location.replace((location.pathname || '/') + '?offline_test=1'); }
};
async function netClient() {
  if (NET.sb) return NET.sb;
  if (!netOn()) throw new Error('Chưa cấu hình máy chủ (js/chatcfg.js)');
  await chatLoadLib();
  const c = window.CHAT_CFG;
  NET.sb = window.supabase.createClient(c.url, c.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'jxidle_auth' } });
  try { const { data } = await NET.sb.auth.getSession(); NET.user = data && data.session ? data.session.user : null; } catch (e) { NET.user = null; }
  NET.sb.auth.onAuthStateChange((ev, s) => {
    if (s && s.user) {
      NET.user = s.user;
      if (ev === 'SIGNED_IN' && typeof mpEnsure === 'function') setTimeout(() => { try { mpEnsure(); } catch (e) { /* dong doi */ } }, 300);
      if (typeof netThoAdminReady === 'function') setTimeout(() => { try { netThoAdminReady(); } catch (e) { /* bo qua */ } }, 0);
    } else if (ev === 'SIGNED_OUT') {
      const was = !!NET.user; NET.user = null;
      if (typeof netAdminSticky === 'function') netAdminSticky(false);
      if (typeof mpLeave === 'function') try { mpLeave(); } catch (e) { /* bo qua */ }
      if (was && !NET.loggingOut && S && S.fac) setTimeout(() => netRelogin(), 0);   // v194: phien het han giua chung -> bat dang nhap lai
    }
    netDot();
  });
  return NET.sb;
}
/** Sau khi session admin restore: mo khoa phai Test bi khoa o F5. */
function netThoAdminReady() {
  if (NET.user && netUname() === 'admin' && typeof netAdminSticky === 'function') netAdminSticky(true);
  if (!window.__thoAwaitAdmin) return;
  if (typeof isAdmin === 'function' && isAdmin()) {
    window.__thoAwaitAdmin = false;
    try { localStorage.setItem(SLOT_PTR, String(SLOT)); } catch (e) { /* bo qua */ }
    location.reload();
    return;
  }
  if (NET.user && typeof isAdmin === 'function' && !isAdmin()) {
    window.__thoAwaitAdmin = false;
    toast('Hệ Thổ★ / phái Test chỉ tài khoản admin');
    if (typeof slotMenu === 'function') slotMenu();
  }
}
const netCall = async fn => { try { const sb = await netClient(); const r = await fn(sb); if (r && r.error) throw r.error; return r; } catch (e) { throw new Error(netErr(e)); } };

/* ---------- tai khoan ---------- */
const NET_REMEMBER_KEY = 'nqi_remember_login';
function netRememberLoad() {
  try { const o = JSON.parse(localStorage.getItem(NET_REMEMBER_KEY) || 'null'); return o && o.u && o.p ? o : null; } catch (e) { return null; }
}
function netRememberSave(u, p, on) {
  try {
    if (on && u && p) localStorage.setItem(NET_REMEMBER_KEY, JSON.stringify({ u: String(u).trim().toLowerCase(), p: String(p) }));
    else localStorage.removeItem(NET_REMEMBER_KEY);
  } catch (e) { /* che do rieng tu */ }
}
function netRememberFill(uId, pId, cId) {
  const o = netRememberLoad(), u = $(uId), p = $(pId), c = $(cId);
  if (o && u && p) { u.value = o.u; p.value = o.p; if (c) c.checked = true; }
  else if (c) c.checked = false;
}

async function netAuth(kind, u, p) {
  u = String(u || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,16}$/.test(u)) throw new Error('Tên đăng nhập 3–16 ký tự: chữ không dấu, số, _');
  if (String(p || '').length < 6) throw new Error('Mật khẩu ít nhất 6 ký tự');
  const r = await netCall(sb => kind === 'up' ? sb.auth.signUp({ email: u + NET_DOMAIN, password: p }) : sb.auth.signInWithPassword({ email: u + NET_DOMAIN, password: p }));
  if (!r.data || !r.data.session) throw new Error('Supabase đang bật "Confirm email" — hãy tắt (xem HUONG_DAN_WEB.txt)');
  NET.user = r.data.session.user;
  netMailCount();
}

/* ---------- nhan vat cong khai (xep hang / xem trang bi) ---------- */
function netGear() { const o = {}; for (const [k, it] of Object.entries(S.eq || {})) if (it) o[k] = it; return o; }
async function netSyncChar(quiet) {
  if (!NET.user) throw new Error('Chưa đăng nhập');
  if (!S || !S.fac) throw new Error('Chưa có nhân vật');
  if (!hasRealName()) { if (!quiet) nameModal(); throw new Error('Cần đặt tên nhân vật trước'); }
  const st = RW().stat || {};
  const row = { owner: NET.user.id, slot: SLOT, name: S.name, fac: S.fac, sex: S.sex | 0, lvl: S.lvl | 0, reborn: st.reborn | 0, power: Math.round(R.power || 0), tower: st.towerBest | 0, bosses: st.bosses | 0, gear: netGear(), updated: new Date().toISOString() };
  await netCall(sb => sb.from('chars').upsert(row));
  NET.lastChar = Date.now();
}
const netNeedChar = async () => { if (Date.now() - NET.lastChar > 60000) await netSyncChar(); };

/* ---------- luu dam may ---------- */
/* Du lieu dam may: { v: 2, d: <ban luu nhan vat da ky>, k: <Kho chung da ky> } (ban cu: chi chuoi ban luu) */
const cloudPack = (d, k) => JSON.stringify({ v: 2, d, k: k || null });
function cloudParse(data) { try { const o = JSON.parse(data); if (o && o.v === 2 && typeof o.d === 'string') return { d: o.d, k: o.k }; } catch (e) { /* ban cu */ } return { d: data, k: null }; }
const stashRaw = () => { try { return localStorage.getItem(STASH_KEY); } catch (e) { return null; } };
const slotState = i => { try { const t = localStorage.getItem(slotKey(i)); const u = t && unpack(t); return u && u.ok && u.state && u.state.fac ? u.state : null; } catch (e) { return null; } };
const stateFromPacked = d => parseSaveText(JSON.stringify({ game: 'jxidle', data: d }));
const netForeign = st => !!(st && st.netOwner && NET.user && st.netOwner !== NET.user.id);   // nhan vat thuoc tai khoan khac (cung trinh duyet)
async function netUpload() {
  if (!NET.user) throw new Error('Chưa đăng nhập');
  if (!S || !S.fac) throw new Error('Chưa có nhân vật');
  if (netForeign(S)) throw new Error('Nhân vật thuộc tài khoản khác');            // v195: chong tai nhan vat cua tai khoan A len tai khoan B
  const t = new Date(), prev = S.cloudAt; S.cloudAt = t.getTime(); S.netOwner = NET.user.id;
  try { await netCall(sb => sb.from('saves').upsert({ owner: NET.user.id, slot: SLOT, name: S.name || '', lvl: S.lvl | 0, fac: S.fac, data: cloudPack(pack(S), stashRaw()), updated: t.toISOString() })); }
  catch (e) { S.cloudAt = prev; throw e; }                                   // v188: chi danh dau da tai len khi may chu nhan
  save(); NET.lastUp = Date.now();
}
async function netUploadSlot(i, st) {                      // slot khac (khong dang choi): lay tu bo nho may
  const t = new Date(); st.cloudAt = t.getTime();
  try { localStorage.setItem(slotKey(i), pack(st)); } catch (e) { /* bo qua */ }
  await netCall(sb => sb.from('saves').upsert({ owner: NET.user.id, slot: i, name: st.name || '', lvl: st.lvl | 0, fac: st.fac, data: cloudPack(pack(st), stashRaw()), updated: t.toISOString() }));
}
function netApplyStash(k) {                               // Kho chung: lay ban co rev cao hon
  if (!k) return false;
  try { const u = unpack(k); if (!u.ok) return false; const cur = stashRead().st; if ((u.state.rev | 0) <= (cur.rev | 0)) return false; localStorage.setItem(STASH_KEY, k); return true; } catch (e) { return false; }
}
/* Dong bo ca 3 slot luc dang nhap / vao game: slot trong -> lay tu dam may; may chua co tren dam may -> tai len;
   ca hai co -> lay ban moi hon (slot dang choi thi hoi). Tra ve true neu da ghi slot / kho moi vao may. */
/* v195: doi tai khoan tren cung trinh duyet -> bo Kho chung cua tai khoan truoc (giu ban sao), lay kho cua tai khoan nay tu dam may */
function netUserSwitch() {
  try { const last = localStorage.getItem('jxidle_lastuser');
    if (last && last !== NET.user.id) { const k = localStorage.getItem(STASH_KEY); if (k) localStorage.setItem(STASH_KEY + '_' + last, k); localStorage.removeItem(STASH_KEY); }
    localStorage.setItem('jxidle_lastuser', NET.user.id); } catch (e) { /* bo qua */ }
}
async function netSyncAll() {
  if (!NET.user) return false;
  netUserSwitch();
  const r = await netCall(sb => sb.from('saves').select('slot,updated').order('slot')), rows = r.data || [];
  let changed = false;
  for (let i = 0; i < SLOT_N; i++) {
    const c = rows.find(x => x.slot === i), cu = c ? Date.parse(c.updated) : 0;
    if (i === SLOT && S && S.fac) continue;                                   // slot dang choi: netCheckCloud
    const loc = slotState(i);
    if (!c) {                                                                 // dam may chua co: tai len neu chua gan chu / dung chu / admin (tranh mat NV Test)
      if (loc && !netForeign(loc) && (!loc.netOwner || loc.netOwner === NET.user.id || (typeof isAdmin === 'function' && isAdmin()))) {
        loc.netOwner = NET.user.id; await netUploadSlot(i, loc);
      } else if (loc) { try { const k = slotKey(i); localStorage.setItem(k + '_bak', localStorage.getItem(k)); localStorage.removeItem(k); changed = true; } catch (e) { /* bo qua */ } }
      continue;
    }
    if (!netCloudStale(loc, cu) && !netForeign(loc)) continue;                // ban may nay = ban dam may (cung tai khoan)
    const d = await netCall(sb => sb.from('saves').select('data').eq('slot', i).single()), cp = cloudParse(d.data.data);
    const st = stateFromPacked(cp.d); st.cloudAt = cu; st.netOwner = NET.user.id;
    try { const k = slotKey(i), prev = localStorage.getItem(k); if (prev) localStorage.setItem(k + '_bak', prev); localStorage.setItem(k, pack(st)); changed = true; } catch (e) { /* bo nho day */ }
  }
  const newest = rows.slice().sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated))[0];
  if (newest) { const d = await netCall(sb => sb.from('saves').select('data').eq('slot', newest.slot).single()); if (netApplyStash(cloudParse(d.data.data).k)) changed = true; }
  return changed;
}
/* v181: chi dung ban dam may. Ban may khac ban dam may (khac moc cloudAt, hoac co tien trinh chua tai len qua 4 phut) -> lay ban dam may */
const netCloudStale = (st, cu) => !st || !st.cloudAt || cu > st.cloudAt + 5000;   // v188: chi lay ban dam may khi dam may MOI HON (choi o may khac); tien trinh may nay chua kip tai len thi tai len (truoc day tai lai trang moi lan vao -> cham)
/* Dong bo slot dang choi: dam may co ban moi hon (choi o may khac) -> hoi dung ban nao; chua co ban -> tai len luon */
async function netCheckCloud() {
  if (!NET.user || !S || !S.fac) return;
  const r = await netCall(sb => sb.from('saves').select('slot,name,lvl,fac,updated').eq('slot', SLOT).maybeSingle()), c = r.data;
  if (!c) {
    /* Chua co ban dam may: neu chua gan chu hoac dung chu → danh dau + tai len (tranh F5 xoa nhan vat Test vua tao). */
    if (!S.netOwner || S.netOwner === NET.user.id || (typeof isAdmin === 'function' && isAdmin())) {
      S.netOwner = NET.user.id; save();
      await netUpload(); return;
    }
    SAVE_LOCK = true; try { const k = slotKey(SLOT); localStorage.setItem(k + '_bak', localStorage.getItem(k)); localStorage.removeItem(k); localStorage.setItem(SLOT_PTR, 'menu'); } catch (e) { /* bo qua */ }
    toast('Nhân vật chỉ có trên máy này, không có trên đám mây: không dùng được'); setTimeout(() => location.reload(), 1500); return;
  }
  const cu = Date.parse(c.updated);
  if (!S.netOwner || netForeign(S) || netCloudStale(S, cu)) { toast('Đang tải nhân vật từ đám mây…'); await netUseCloud(SLOT, cu); }   // chua ro chu (ban cu) / tai khoan khac: lay ban dam may
  else if ((S.last || 0) > cu + 5000) await netUpload();                    // may nay co tien trinh moi hon: tai len ngay
}
async function netUseCloud(slot, cu) {
  const r = await netCall(sb => sb.from('saves').select('data,updated').eq('slot', slot).single()), cp = cloudParse(r.data.data);
  const st = stateFromPacked(cp.d); st.cloudAt = cu || Date.parse(r.data.updated); st.netOwner = NET.user.id;
  netApplyStash(cp.k); writeSlot(slot, st); location.reload();
}
async function netCloudList() { const r = await netCall(sb => sb.from('saves').select('slot,name,lvl,fac,updated').order('slot')); return r.data || []; }
async function netCloudLoad(slot) { await netUseCloud(slot); }

/* ---------- man dang nhap luc vao game ---------- */
function netGate(err) {
  const off = err ? `<p class="reqbad">${esc(err)}</p>` : '';
  const rem = netRememberLoad();
  modal(`<div class="ngate"><h3>⚔ NamQuoc Idle</h3><p class="desc">Đăng nhập để chơi: nhân vật lưu trên máy chủ, chơi tiếp ở mọi máy / điện thoại. Chưa có tài khoản thì bấm <b>Đăng ký</b>.</p>
    <div class="card"><div class="row">Tên đăng nhập <input id="ngU" maxlength="16" autocomplete="username" placeholder="chữ không dấu, số, _" autocapitalize="off"></div>
      <div class="row">Mật khẩu <input id="ngP" type="password" maxlength="64" autocomplete="current-password" placeholder="ít nhất 6 ký tự"></div>
      <label class="row small" style="gap:.4em;align-items:center;cursor:pointer"><input type="checkbox" id="ngRem" ${rem ? 'checked' : ''}> Nhớ tài khoản &amp; mật khẩu trên máy này</label>
      <div class="btnrow"><button class="btn" id="ngIn">Đăng nhập</button><button class="btn" id="ngUp">Đăng ký</button></div>
      <p class="dim small">Một tài khoản dùng cho 3 nhân vật. Tick nhớ mật khẩu để không phải nhập lại mỗi lần mở game.</p></div>
    ${off}
    <div class="btnrow"><button class="btn sm" id="ngRetry">Thử kết nối lại</button><button class="btn sm" id="ngOff">Chơi offline</button></div>
    <p class="dim small">Offline: lưu trên máy này, không đăng nhập / xếp hạng / chợ / thư.</p></div>`, () => {
    netRememberFill('#ngU', '#ngP', '#ngRem');
    const go = k => busy($(k === 'up' ? '#ngUp' : '#ngIn'), async () => {
      const u = $('#ngU').value, p = $('#ngP').value;
      await netAuth(k, u, p);
      netRememberSave(u, p, $('#ngRem') && $('#ngRem').checked);
      return netAfterLogin();
    }, () => {});
    $('#ngIn').onclick = () => go('in'); $('#ngUp').onclick = () => go('up');
    $('#ngP').onkeydown = e => { if (e.key === 'Enter') go('in'); };
    const rm = $('#ngRem'); if (rm) rm.onchange = () => { if (!rm.checked) netRememberSave('', '', false); };
    const rt = $('#ngRetry'); if (rt) rt.onclick = () => location.reload();
    const of = $('#ngOff'); if (of) of.onclick = () => netGoOffline();
    // Da luu TK: tu dang nhap khi mo man (vd sau khi rest server / het phien)
    if (rem && !err) setTimeout(() => { if ($('#ngIn') && !NET.user) go('in'); }, 80);
  }, true);
}
async function netAfterLogin() {
  const changed = await netSyncAll();
  if (typeof netThoAdminReady === 'function') netThoAdminReady();
  if (window.__thoAwaitAdmin === false && typeof isAdmin === 'function' && isAdmin()) return; // dang reload vao phai Test
  if (!S || !S.fac) {                                       // chua vao nhan vat: tai lai de hien nhan vat vua lay tu dam may
    const used = [...Array(SLOT_N).keys()].filter(i => slotInfo(i));
    if (used.length) { try { localStorage.setItem(SLOT_PTR, used.length > 1 ? 'menu' : String(used[0])); } catch (e) { /* bo qua */ } location.reload(); return; }
    closeModal(true); pickFaction(); return;
  }
  closeModal(true); toast('Đã đăng nhập: ' + netUname());
  netSyncChar(true).catch(() => {}); netCheckCloud().catch(() => {}); netMailCount();
  if (typeof mpEnsure === 'function') try { mpEnsure(); } catch (e) { /* dong doi */ }
  else if (typeof mpJoin === 'function') try { mpJoin(zoneOf(Math.min(S.stage, STAGES))); } catch (e) { /* bo qua */ }
}

/* ---------- thu ---------- */
async function netMailCount() {
  if (!NET.user) { NET.mailN = 0; netDot(); return; }
  try { const r = await netCall(sb => sb.from('mail').select('id', { count: 'exact', head: true })); NET.mailN = r.count || 0; } catch (e) { /* bo qua */ }
  netDot();
}
function netCleanItem(it) {
  if (!it || typeof it !== 'object') return null;
  if (it.__admin) return it;                                                 // goi cap phat admin (cap / knb / do)
  if (!Array.isArray(it.base) || !Array.isArray(it.mag)) return null;
  const x = JSON.parse(JSON.stringify(it)); x.uid = S.uid++; delete x.lock; return x;
}
function netMailLabel(m) {
  if (!m) return '';
  const it = m.item;
  if (it && it.__admin) {
    const bits = [];
    if (it.lvl) bits.push('cấp → ' + it.lvl);
    if (it.addLv) bits.push('+' + it.addLv + ' cấp');
    if (it.attrPts) bits.push('+' + it.attrPts + ' tiềm năng');
    if (it.skPts) bits.push('+' + it.skPts + ' kỹ năng');
    if (it.knb) bits.push('+' + fmt(it.knb) + ' KNB');
    if (it.gear && it.gear.n) bits.push(it.gear.n);
    return bits.join(' · ') || 'Quà Admin';
  }
  return it ? it.n : '';
}
function netApplyAdminGrant(a) {
  const parts = [];
  if (!a || !a.__admin) return parts;
  if (a.lvl != null) {
    const lv = clamp(Math.floor(+a.lvl) || 1, 1, typeof MAX_LEVEL !== 'undefined' ? MAX_LEVEL : 200);
    const old = S.lvl | 0;
    if (lv > old) {
      S.attrPts = (S.attrPts | 0) + (typeof PTS_PER_LEVEL !== 'undefined' ? PTS_PER_LEVEL : 5) * (lv - old);
      S.skPts = (S.skPts | 0) + (typeof SKILL_PTS_PER_LEVEL !== 'undefined' ? SKILL_PTS_PER_LEVEL : 1) * (lv - old);
    }
    S.lvl = lv; S.xp = 0;
    if (typeof syncMaxStage === 'function') syncMaxStage();
    parts.push('cấp ' + lv);
  }
  if (a.addLv > 0) {
    const n = clamp(Math.floor(+a.addLv) || 0, 0, 200);
    const nv = Math.min(typeof MAX_LEVEL !== 'undefined' ? MAX_LEVEL : 200, (S.lvl | 0) + n);
    const gained = nv - (S.lvl | 0);
    if (gained > 0) {
      S.attrPts = (S.attrPts | 0) + (typeof PTS_PER_LEVEL !== 'undefined' ? PTS_PER_LEVEL : 5) * gained;
      S.skPts = (S.skPts | 0) + (typeof SKILL_PTS_PER_LEVEL !== 'undefined' ? SKILL_PTS_PER_LEVEL : 1) * gained;
      S.lvl = nv; S.xp = 0;
      if (typeof syncMaxStage === 'function') syncMaxStage();
      parts.push('+' + gained + ' cấp');
    }
  }
  if (a.attrPts > 0) { S.attrPts = (S.attrPts | 0) + (a.attrPts | 0); parts.push('+' + (a.attrPts | 0) + ' tiềm năng'); }
  if (a.skPts > 0) { S.skPts = (S.skPts | 0) + (a.skPts | 0); parts.push('+' + (a.skPts | 0) + ' kỹ năng'); }
  if (a.knb > 0) { S.knb = (S.knb || 0) + (a.knb | 0); parts.push('+' + fmt(a.knb) + ' KNB'); }
  if (a.gear && Array.isArray(a.gear.base)) {
    if (S.inv.length >= INV_MAX) throw new Error('Hành trang đầy — nhận quà Admin sau khi dọn túi');
    const it = netCleanItem(a.gear);
    if (it) { S.inv.push(it); parts.push(it.n); invDirty = true; }
  }
  R.dirty = true; if (typeof recalc === 'function') recalc();
  return parts;
}
async function netClaim(m, quiet) {
  const isAdminMail = !!(m.item && m.item.__admin);
  if (m.item && !isAdminMail && S.inv.length >= INV_MAX) throw new Error('Hành trang đầy');
  if (isAdminMail && m.item.gear && S.inv.length >= INV_MAX) throw new Error('Hành trang đầy');
  const r = await netCall(sb => sb.rpc('claim_mail', { mid: m.id })), d = r.data || m;
  const parts = [];
  if (d.item && d.item.__admin) parts.push(...netApplyAdminGrant(d.item));
  else if (d.item) { const it = netCleanItem(d.item); if (it) { S.inv.push(it); parts.push(it.n); invDirty = true; } }
  if (d.gold > 0) { S.gold += +d.gold; parts.push(fmt(+d.gold) + ' lượng'); }
  save(); if (!quiet) log(`📨 Nhận thư từ <b>${esc(d.from_name)}</b>: ${esc(parts.join(', ') || netMailLabel(d) || 'quà')}`);
  if (typeof updateTop === 'function') updateTop();
  if (typeof refresh === 'function') refresh();
  netUpload().catch(() => {});                                               // v195: luu ngay (thu da nhan tren may chu, tranh mat do neu tat game)
  return parts.length ? parts : [netMailLabel(d) || 'quà'];
}
async function netSendGift(to, it, gold, note) {
  to = String(to || '').trim(); gold = Math.max(0, Math.floor(+gold || 0));
  if (!to) throw new Error('Nhập tên người nhận');
  if (!it && !gold) throw new Error('Chọn món đồ hoặc nhập số lượng');
  if (gold > S.gold) throw new Error('Không đủ ngân lượng');
  if (it && (it.lock || !S.inv.includes(it))) throw new Error('Món không gửi được (đang khóa / đang mặc)');
  await netNeedChar();
  const i = it ? S.inv.indexOf(it) : -1;
  if (it) S.inv.splice(i, 1); S.gold -= gold; invDirty = true; save();          // rut khoi nhan vat truoc, loi thi tra lai
  try { await netCall(sb => sb.from('mail').insert({ to_name: to, from_name: S.name, from_owner: NET.user.id, kind: 'gift', item: it || null, gold, note: String(note || '').slice(0, 100) })); }
  catch (e) { if (it) S.inv.splice(i, 0, it); S.gold += gold; invDirty = true; save(); throw e; }
  log(`📨 Gửi <b>${esc(to)}</b>: ${esc([it && it.n, gold && fmt(gold) + ' lượng'].filter(Boolean).join(', '))}`);
  netUpload().catch(() => {});                                               // v195: luu ngay (chong nhan doi do / tien)
}

/* ---------- cho ---------- */
async function netSell(it, price) {
  price = Math.floor(+price || 0);
  if (price < 1) throw new Error('Nhập giá bán');
  if (!it || it.lock || !S.inv.includes(it)) throw new Error('Món không bán được (đang khóa / đang mặc)');
  await netNeedChar();
  const i = S.inv.indexOf(it); S.inv.splice(i, 1); invDirty = true; save();
  try { await netCall(sb => sb.from('market').insert({ seller: NET.user.id, seller_name: S.name, item: it, iname: String(it.n).slice(0, 80), price })); }
  catch (e) { S.inv.splice(i, 0, it); invDirty = true; save(); throw e; }
  log(`🏪 Bày bán <b>${esc(it.n)}</b> giá ${fmt(price)} lượng`);
  netUpload().catch(() => {});
}
async function netBuy(l) {
  if (S.gold < l.price) throw new Error('Không đủ ngân lượng');
  await netNeedChar();
  S.gold -= l.price; save();
  try { await netCall(sb => sb.rpc('market_buy', { lid: l.id, buyer: S.name })); }
  catch (e) { S.gold += l.price; save(); throw e; }
  log(`🏪 Mua <b>${esc(l.iname)}</b> của ${esc(l.seller_name)} giá ${fmt(l.price)} lượng (món đã vào Thư)`);
  netMailCount(); netUpload().catch(() => {});
}

/* ---------- giao dien ---------- */
function netDot() { const b = $('#netBtn'); if (b) { b.classList.toggle('on', NET.mailN > 0); b.dataset.n = NET.mailN > 9 ? '9+' : NET.mailN || ''; } }
const facName = k => FAC[k] ? FAC[k].n : (k || '');
const netCell = it => itemCell(it).replace(' bad', '').replace(/ title="[^"]*"/, '');
function netItemModal(it, extra, back) {
  modal(`${itemHTML(it)}${extra || ''}<div class="btnrow"><button class="btn" id="niBack">Quay lại</button></div>`, () => { $('#niBack').onclick = back; });
}
/* v194: kiem tra lai phien (token co the dang lam moi); mat phien that thi khoa game bang man dang nhap */
async function netEnsureUser() {
  if (NET.user || !NET.sb) return !!NET.user;
  try { const { data } = await NET.sb.auth.getSession(); NET.user = data && data.session ? data.session.user : null; } catch (e) { /* bo qua */ }
  return !!NET.user;
}
async function netRelogin() { if (await netEnsureUser()) return; netGate('Phiên đăng nhập đã hết — đăng nhập lại để tiếp tục lưu nhân vật lên đám mây.'); }
async function netModal(tab, msg) {
  if (tab) NET.tab = tab;
  if (NET.sb) await netEnsureUser();
  if (!netOn()) return modal('<h3>🌐 Giang hồ online</h3><p class="desc">Chưa cấu hình máy chủ (js/chatcfg.js).</p>');
  const tabs = [['acc', 'Tài khoản'], ['rank', 'Xếp hạng'], ['mail', `Thư${NET.mailN ? ` (${NET.mailN})` : ''}`], ['mkt', 'Chợ']];
  const head = `<h3>🌐 Giang hồ online <small>${NET.user ? esc(netUname()) : 'chưa đăng nhập'}</small></h3><div class="dtabs" id="netTabs">${tabs.map(([k, n]) => `<button data-nt="${k}" class="${k === NET.tab ? 'on' : ''}">${n}</button>`).join('')}</div>${msg ? `<p class="cn small">${esc(msg)}</p>` : ''}${S && S.fac ? '' : '<div class="btnrow"><button class="btn sm" id="netSlot">← Chọn nhân vật</button></div>'}`;
  modal(head + '<div id="netBody"><p class="dim small">Đang tải…</p></div>', () => { document.querySelectorAll('#netTabs [data-nt]').forEach(b => b.onclick = () => netModal(b.dataset.nt)); const s = $('#netSlot'); if (s) s.onclick = () => slotMenu(); }, !(S && S.fac));
  try { await netClient(); } catch (e) { $('#netBody').innerHTML = `<p class="reqbad">${esc(e.message)}</p>`; return; }
  const body = $('#netBody'); if (!body) return;
  const need = !NET.user && NET.tab !== 'rank';
  try { await ({ acc: netAccBody, rank: netRankBody, mail: netMailBody, mkt: netMktBody })[need ? 'acc' : NET.tab](body); }
  catch (e) { body.innerHTML = `<p class="reqbad">${esc(e.message || e)}</p>`; }
}
const busy = async (btn, fn, after) => { if (btn) btn.disabled = true; try { const m = await fn(); after ? after(m) : null; } catch (e) { toast(e.message || String(e)); if (btn) btn.disabled = false; } };

/* Dang xuat + mo man dang nhap de doi sang tai khoan khac (tu dong luu dam may truoc). */
async function netSwitchAccount(btn) {
  if (!netOn() || NET.offline) return toast('Bản offline không có tài khoản máy chủ');
  if (!NET.user) { closeModal(true); return netGate(); }
  return busy(btn, async () => {
    if (S && S.fac) await netUpload().catch(() => {});
    try { await netClient(); } catch (e) { /* van thu dang xuat local */ }
    NET.loggingOut = true;
    if (typeof netAdminSticky === 'function') netAdminSticky(false);
    try { if (NET.sb) await NET.sb.auth.signOut(); } catch (e) { /* bo qua */ }
    NET.loggingOut = false; NET.user = null; NET.mailN = 0; netDot();
  }, () => { closeModal(true); toast('Đã đăng xuất — đăng nhập tài khoản khác'); netGate(); });
}

async function netAccBody(el) {
  if (!NET.user) {
    const rem = netRememberLoad();
    el.innerHTML = `<div class="card"><b>Đăng nhập / Đăng ký</b><p class="dim small">Một tài khoản dùng cho cả 3 nhân vật: lưu đám mây, bảng xếp hạng, gửi thư, Chợ. Không cần email.</p>
      <div class="row">Tên đăng nhập <input id="naU" maxlength="16" autocomplete="username" placeholder="chữ không dấu, số, _"></div>
      <div class="row">Mật khẩu <input id="naP" type="password" maxlength="64" autocomplete="current-password" placeholder="ít nhất 6 ký tự"></div>
      <label class="row small" style="gap:.4em;align-items:center;cursor:pointer"><input type="checkbox" id="naRem" ${rem ? 'checked' : ''}> Nhớ tài khoản &amp; mật khẩu trên máy này</label>
      <div class="btnrow"><button class="btn" id="naIn">Đăng nhập</button><button class="btn" id="naUp">Đăng ký mới</button></div>
      <p class="dim small">Tick nhớ mật khẩu để lần sau mở game tự điền / tự đăng nhập.</p></div>`;
    netRememberFill('#naU', '#naP', '#naRem');
    const go = k => busy($(k === 'up' ? '#naUp' : '#naIn'), async () => {
      const u = $('#naU').value, p = $('#naP').value;
      await netAuth(k, u, p);
      netRememberSave(u, p, $('#naRem') && $('#naRem').checked);
    }, () => { toast(k === 'up' ? 'Đã tạo tài khoản' : 'Đã đăng nhập'); netModal('acc'); });
    $('#naIn').onclick = () => go('in'); $('#naUp').onclick = () => go('up');
    const rm = $('#naRem'); if (rm) rm.onchange = () => { if (!rm.checked) netRememberSave('', '', false); };
    return;
  }
  const list = await netCloudList(), ago = t => t ? new Date(t).toLocaleString('vi-VN') : '—';
  el.innerHTML = `<div class="card"><b>Tài khoản ${esc(netUname())}</b>
      <div class="btnrow" style="margin:.4em 0"><button class="btn sm" id="naSwitch">Đổi tài khoản</button><button class="btn sm red" id="naOut">Đăng xuất</button></div>
      ${S.fac ? `<p class="small">Nhân vật đang chơi: <b>${esc(hasRealName() ? S.name : '(chưa đặt tên)')}</b> · ${esc(facName(S.fac))} cấp ${S.lvl} · slot ${SLOT + 1}</p>
      <div class="btnrow"><button class="btn sm" id="naSync">Cập nhật lên bảng xếp hạng</button>${hasRealName() ? '' : '<button class="btn sm on" id="naName">✏ Đặt tên</button>'}</div>` : ''}</div>
    <div class="card"><b>☁ Lưu đám mây</b> <small class="dim">mỗi slot 1 bản, chơi tiếp trên máy khác</small>
      ${S.fac ? `<div class="btnrow"><button class="btn sm" id="naUp">Tải lên ngay (slot ${SLOT + 1})</button></div>
      <p class="dim small">Nhân vật chỉ lưu trên đám mây: tự lưu lên mỗi 2 phút và khi rời trang; vào game luôn lấy bản đám mây.</p>` : ''}
      <table class="dktbl small"><tr><th>Slot</th><th>Nhân vật</th><th>Lưu lúc</th><th></th></tr>
      ${[0, 1, 2].map(i => { const s = list.find(x => x.slot === i); return `<tr><td>${i + 1}</td><td>${s ? `${esc(s.name || '')} · ${esc(facName(s.fac))} ${s.lvl}` : '<span class="dim">trống</span>'}</td><td>${s ? ago(s.updated) : ''}</td><td>${s ? `<button class="btn sm" data-cl="${i}">Tải về</button>` : ''}</td></tr>`; }).join('')}</table>
      <p class="dim small">Tải về: thay nhân vật slot đó trên máy này bằng bản đám mây (bản cũ giữ 1 bản sao lưu). Bình thường game tự đồng bộ, không cần bấm.</p></div>`;
  const on = (id, fn) => { const b = $(id); if (b) b.onclick = fn; };
  on('#naSwitch', () => netSwitchAccount($('#naSwitch')));
  on('#naOut', () => netSwitchAccount($('#naOut')));

  on('#naSync', () => busy($('#naSync'), () => netSyncChar(), () => toast('Đã cập nhật')));
  on('#naName', () => nameModal(() => netModal('acc')));
  on('#naUp', () => busy($('#naUp'), () => netUpload(), () => { toast('Đã lưu lên đám mây'); netModal('acc'); }));
  const a = $('#naAuto'); if (a) a.onchange = () => { S.cloudAuto = a.checked; save(); };
  el.querySelectorAll('[data-cl]').forEach(b => b.onclick = () => busy(b, () => netCloudLoad(+b.dataset.cl)));
}

const RANKS = [['lvl', 'Cấp'], ['power', 'Lực chiến'], ['tower', 'Tháp'], ['bosses', 'Trùm đã hạ']];
async function netRankBody(el) {
  const col = NET.rank;
  const r = await netCall(sb => { let q = sb.from('chars').select('name,fac,lvl,reborn,power,tower,bosses'); if (NET.rfac) q = q.eq('fac', NET.rfac);
    q = col === 'lvl' ? q.order('reborn', { ascending: false }).order('lvl', { ascending: false }).order('power', { ascending: false }) : q.order(col, { ascending: false }); return q.limit(50); });
  const rows = r.data || [], val = x => col === 'lvl' ? `${x.reborn ? `<small class="cp">CS${x.reborn}</small> ` : ''}${x.lvl}` : fmt(x[col] || 0);
  el.innerHTML = `<div class="row"><select id="nrCol">${RANKS.map(([k, n]) => `<option value="${k}" ${k === col ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select id="nrFac"><option value="">Mọi phái</option>${FACTIONS.filter(f => !f.novice && (typeof facVisible !== 'function' || facVisible(f))).map(f => `<option value="${f.key}" ${f.key === NET.rfac ? 'selected' : ''}>${esc(f.n)}</option>`).join('')}</select></div>
    <table class="dktbl small"><tr><th>#</th><th>Nhân vật</th><th>Phái</th><th>${RANKS.find(x => x[0] === col)[1]}</th></tr>
    ${rows.map((x, i) => `<tr${S && x.name === S.name ? ' style="background:#2a2410"' : ''}><td>${i + 1}</td><td><a href="#" data-pn="${esc(x.name)}" style="color:${typeof campCol === 'function' ? campCol(x.fac) : '#ffd76a'}">${esc(x.name)}</a></td><td>${esc(facName(x.fac))}</td><td>${val(x)}</td></tr>`).join('') || '<tr><td colspan="4" class="dim">Chưa có ai</td></tr>'}</table>
    <p class="dim small">Bấm tên để xem trang bị. Nhân vật của bạn tự cập nhật khi đã đăng nhập.</p>`;
  $('#nrCol').onchange = e => { NET.rank = e.target.value; netModal('rank'); };
  $('#nrFac').onchange = e => { NET.rfac = e.target.value; netModal('rank'); };
  el.querySelectorAll('[data-pn]').forEach(a => a.onclick = ev => { ev.preventDefault(); profileModal(a.dataset.pn, () => netModal('rank')); });
}

async function profileModal(name, back) {
  back = back || (() => closeModal());
  modal(`<h3>${esc(name)}</h3><p class="dim small">Đang tải…</p>`);
  let r; try { r = await netCall(sb => sb.from('chars').select('name,fac,sex,lvl,reborn,power,tower,bosses,gear,updated').eq('name', name).maybeSingle()); }
  catch (e) { return modal(`<h3>${esc(name)}</h3><p class="reqbad">${esc(e.message)}</p>`); }
  const x = r.data;
  if (!x) return modal(`<h3>${esc(name)}</h3><p class="desc">Nhân vật này chưa liên kết tài khoản online nên chưa xem được trang bị.</p><div class="btnrow"><button class="btn" id="pfB">Quay lại</button></div>`, () => { $('#pfB').onclick = back; });
  const g = x.gear || {}, f = FAC[x.fac];
  const cells = SLOTS.map(([k, n]) => `<div class="pfs"><small class="dim">${n}</small>${g[k] ? netCell(g[k]).replace('data-uid=', `data-pk="${k}" data-x=`) : '<div class="it"></div>'}</div>`).join('');
  modal(`<h3>${esc(x.name)} <small>${esc(f ? f.n : '')} · cấp ${x.lvl}${x.reborn ? ` · chuyển sinh ${x.reborn}` : ''}</small></h3>
    <p class="small">Lực chiến <b>${fmt(x.power || 0)}</b> · Tháp tầng <b>${x.tower || 0}</b> · Trùm đã hạ <b>${fmt(x.bosses || 0)}</b> <small class="dim">· cập nhật ${new Date(x.updated).toLocaleString('vi-VN')}</small></p>
    <div class="pfgrid">${cells}</div>
    <div class="btnrow">${S && S.fac && x.name !== S.name ? '<button class="btn" id="pfMail">📨 Gửi thư</button>' : ''}<button class="btn" id="pfB">Quay lại</button></div>`, () => {
    document.querySelectorAll('#mBody [data-pk]').forEach(b => b.onclick = () => netItemModal(g[b.dataset.pk], '', () => profileModal(name, back)));
    $('#pfB').onclick = back;
    const m = $('#pfMail'); if (m) m.onclick = () => { NET.mailTo = x.name; netModal('mail'); };
  });
}

async function netMailBody(el) {
  const r = await netCall(sb => sb.from('mail').select('*').order('id', { ascending: false }).limit(50)), list = r.data || [];
  NET.mailN = list.length; netDot();
  const inv = S.fac ? S.inv.filter(it => !it.lock) : [];
  const rowHtml = m => {
    const adm = !!(m.item && m.item.__admin);
    const label = netMailLabel(m);
    let icon = '<span class="nmg">💰</span>';
    if (adm && m.item.gear && Array.isArray(m.item.gear.base)) icon = netCell(m.item.gear).replace('data-uid=', `data-mi="${m.id}" data-x=`);
    else if (adm) icon = '<span class="nmg">🛠</span>';
    else if (m.item) icon = netCell(m.item).replace('data-uid=', `data-mi="${m.id}" data-x=`);
    const nameHtml = adm
      ? `<span class="cp">${esc(label || 'Quà Admin')}</span>`
      : (m.item ? `<span style="color:${RAR_COL[m.item.r] || '#ddd'}">${esc(m.item.n)}</span>` : '');
    return `<div class="nmrow">${icon}<span><b>${esc(m.from_name)}</b> <small class="dim">${new Date(m.created).toLocaleString('vi-VN')}</small><br>
        ${nameHtml}${m.gold > 0 ? ` <span class="cp">+${fmt(m.gold)} lượng</span>` : ''}${m.note ? `<br><small class="dim">${esc(m.note)}</small>` : ''}</span>
        <button class="btn sm" data-take="${m.id}" ${S.fac ? '' : 'disabled'}>Nhận</button></div>`;
  };
  el.innerHTML = `<div class="card"><b>📥 Hộp thư</b> ${list.length ? `<button class="btn sm" id="nmAll">Nhận tất cả</button>` : ''}
      ${list.map(rowHtml).join('') || '<p class="dim small">Không có thư.</p>'}</div>
    ${S.fac ? `<div class="card"><b>📤 Gửi thư</b> <small class="dim">từ ${esc(hasRealName() ? S.name : '(chưa đặt tên)')} · tối đa 30 thư / ngày</small>
      <div class="row">Gửi cho <input id="nmTo" maxlength="14" placeholder="Tên nhân vật" value="${esc(NET.mailTo || '')}"></div>
      <div class="row">Ngân lượng <input id="nmGold" type="number" min="0" placeholder="0"> <small class="dim">có ${fmt(S.gold)}</small></div>
      <div class="row">Lời nhắn <input id="nmNote" maxlength="100" placeholder="(không bắt buộc)"></div>
      <div class="small">Kèm món đồ (chạm để chọn, chạm lại để bỏ):</div>
      <div class="invgrid" id="nmInv">${inv.map(it => netCell(it).replace('class="it', `class="it${NET.sel === it.uid ? ' ep-on' : ''}`)).join('') || '<small class="dim">Hành trang trống</small>'}</div>
      <div class="btnrow"><button class="btn" id="nmSend">Gửi</button></div></div>` : ''}`;
  el.querySelectorAll('[data-mi]').forEach(b => b.onclick = () => {
    const m = list.find(x => x.id === +b.dataset.mi); if (!m) return;
    const it = (m.item && m.item.__admin && m.item.gear) ? m.item.gear : m.item;
    if (it && !it.__admin) netItemModal(it, '', () => netModal('mail'));
  });
  el.querySelectorAll('[data-take]').forEach(b => b.onclick = () => busy(b, () => netClaim(list.find(x => x.id === +b.dataset.take)), p => { toast('Đã nhận: ' + p.join(', ')); refresh(); netModal('mail'); }));
  const all = $('#nmAll'); if (all) all.onclick = () => busy(all, async () => { let n = 0; for (const m of list) { try { await netClaim(m, false); n++; } catch (e) { toast(e.message); break; } } return n; }, n => { toast(`Đã nhận ${n} thư`); refresh(); netModal('mail'); });
  if (!S.fac) return;
  const keep = () => { NET.mailTo = $('#nmTo').value; };
  el.querySelectorAll('#nmInv [data-uid]').forEach(b => b.onclick = () => { keep(); NET.sel = NET.sel === +b.dataset.uid ? null : +b.dataset.uid; netModal('mail'); });
  $('#nmSend').onclick = () => { keep(); const it = NET.sel ? S.inv.find(i => i.uid === NET.sel) : null;
    busy($('#nmSend'), () => netSendGift($('#nmTo').value, it, $('#nmGold').value, $('#nmNote').value), () => { toast('Đã gửi'); NET.sel = null; refresh(); netModal('mail'); }); };
}

async function netMktBody(el) {
  const sub = [['buy', 'Mua'], ['sell', 'Bày bán'], ['mine', 'Hàng của tôi']];
  const nav = `<div class="seg" id="nkSub">${sub.map(([k, n]) => `<button class="btn sm${NET.mkt === k ? ' on' : ''}" data-nk="${k}">${n}</button>`).join('')}</div>`;
  const bindNav = () => el.querySelectorAll('[data-nk]').forEach(b => b.onclick = () => { NET.mkt = b.dataset.nk; NET.sel = null; netModal('mkt'); });
  if (NET.mkt === 'sell') {
    const inv = S.fac ? S.inv.filter(it => !it.lock) : [], it = NET.sel ? inv.find(i => i.uid === NET.sel) : null;
    el.innerHTML = `${nav}<p class="dim small">Bày tối đa 10 món. Bán được: nhận ${100 - NET_TAX * 100}% giá vào Thư. Gỡ hàng: món về Thư.</p>
      <div class="invgrid" id="nkInv">${inv.map(i => netCell(i).replace('class="it', `class="it${NET.sel === i.uid ? ' ep-on' : ''}`)).join('') || '<small class="dim">Hành trang trống (món khóa 🔒 không bày được)</small>'}</div>
      ${it ? `<div class="card">${itemHTML(it)}<div class="row">Giá <input id="nkPrice" type="number" min="1" placeholder="lượng"> <small class="dim">giá bán NPC ${fmt(itemValue(it))}</small></div><div class="btnrow"><button class="btn" id="nkGo">Bày bán</button></div></div>` : '<p class="dim small">Chạm món muốn bán.</p>'}`;
    bindNav();
    el.querySelectorAll('#nkInv [data-uid]').forEach(b => b.onclick = () => { NET.sel = NET.sel === +b.dataset.uid ? null : +b.dataset.uid; netModal('mkt'); });
    const g = $('#nkGo'); if (g) g.onclick = () => busy(g, () => netSell(it, $('#nkPrice').value), () => { toast('Đã bày bán'); NET.sel = null; refresh(); netModal('mkt'); });
    return;
  }
  const mine = NET.mkt === 'mine';
  const r = await netCall(sb => { let q = sb.from('market').select('*').order('id', { ascending: false }).limit(100); if (mine) q = q.eq('seller', NET.user.id); return q; });
  let list = r.data || []; const q = NET.q.trim().toLowerCase();
  if (!mine && q) list = list.filter(l => l.iname.toLowerCase().includes(q) || l.seller_name.toLowerCase().includes(q));
  el.innerHTML = `${nav}${mine ? '' : `<div class="row"><input id="nkQ" placeholder="Tìm tên món / người bán" value="${esc(NET.q)}"></div>`}
    ${list.map(l => `<div class="nmrow">${netCell(l.item).replace('data-uid=', `data-li="${l.id}" data-x=`)}<span><span style="color:${RAR_COL[l.item.r] || '#ddd'}">${esc(l.iname)}</span><br><small class="dim">${esc(l.seller_name)}</small></span>
      <span class="cp">${fmt(l.price)}</span>${mine ? `<button class="btn sm red" data-cx="${l.id}">Gỡ</button>` : l.seller === NET.user.id ? '<small class="dim">của bạn</small>' : `<button class="btn sm" data-buy="${l.id}" ${S.fac && S.gold >= l.price ? '' : 'disabled'}>Mua</button>`}</div>`).join('') || '<p class="dim small">Chưa có món nào.</p>'}
    ${mine ? '' : `<p class="dim small">Bạn có ${S.fac ? fmt(S.gold) : 0} lượng. Món mua được gửi vào Thư.</p>`}`;
  bindNav();
  const qi = $('#nkQ'); if (qi) qi.onchange = () => { NET.q = qi.value; netModal('mkt'); };
  el.querySelectorAll('[data-li]').forEach(b => b.onclick = () => { const l = list.find(x => x.id === +b.dataset.li); netItemModal(l.item, `<p class="small">Người bán <b>${esc(l.seller_name)}</b> · giá <b class="cp">${fmt(l.price)}</b> lượng</p>`, () => netModal('mkt')); });
  el.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => busy(b, () => netBuy(list.find(x => x.id === +b.dataset.buy)), () => { toast('Đã mua — món trong Thư'); refresh(); netModal('mkt'); }));
  el.querySelectorAll('[data-cx]').forEach(b => b.onclick = () => busy(b, () => netCall(sb => sb.rpc('market_cancel', { lid: +b.dataset.cx })), () => { toast('Đã gỡ — món về Thư'); netMailCount(); netModal('mkt'); }));
}

/* ---------- khoi dong + dong bo dinh ky ---------- */
async function netProbe() {
  const c = window.CHAT_CFG || {}; if (!c.url || !c.key) throw new Error('Chưa cấu hình máy chủ (js/chatcfg.js)');
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => { try { ctrl && ctrl.abort(); } catch (e) { /* bo qua */ } }, 8000);
  try {
    const r = await fetch(c.url.replace(/\/$/, '') + '/auth/v1/health', { method: 'GET', headers: { apikey: c.key }, signal: ctrl ? ctrl.signal : undefined });
    if (!r.ok && r.status >= 500) throw new Error('Máy chủ đăng nhập đang lỗi (HTTP ' + r.status + ')');
  } catch (e) {
    if (e && (e.name === 'AbortError' || /abort/i.test(String(e.message || e)))) throw new Error('Máy chủ đăng nhập không phản hồi (timeout)');
    throw new Error(netErr(e));
  } finally { clearTimeout(t); }
}
async function netInit() {
  if (!netOn()) return;
  const h = $('#giftBtn'); if (h && !$('#netBtn')) { const b = document.createElement('button'); b.id = 'netBtn'; b.title = 'Giang hồ online: tài khoản, xếp hạng, thư, chợ'; b.textContent = '🌐'; h.parentNode.insertBefore(b, h); b.onclick = () => { if (typeof uiSfx === 'function') uiSfx('click'); netModal(); }; }
  try { await netProbe(); await netClient(); } catch (e) { netGate('Không kết nối được máy chủ: ' + (e.message || e)); return; }
  if (!NET.user) { netGate(); return; }
  if (typeof netThoAdminReady === 'function') netThoAdminReady();
  if (window.__thoAwaitAdmin) return;                                       // dang cho reload vao phai Test
  netSyncAll().then(ch => { if (ch && (!S || !S.fac)) location.reload(); }).catch(() => {});
  netMailCount();
  netCheckCloud().catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.hidden && NET.user && S && S.fac && Date.now() - NET.lastUp > 20000) netUpload().catch(() => {}); });
  setInterval(async () => {
    if (!NET.user && S && S.fac && !document.hidden && $('#modal').classList.contains('hidden')) { netRelogin(); return; }   // dang choi ma mat phien: dang nhap lai
    if (!NET.user || !S || !S.fac || document.hidden) return;
    try {
      if (hasRealName() && Date.now() - NET.lastChar > 3 * 60000) await netSyncChar(true);
      if (Date.now() - NET.lastUp > 2 * 60000) await netUpload();
    } catch (e) { /* thu lai lan sau */ }
    if (Date.now() % 120000 < 60000) netMailCount();
  }, 60000);
}
