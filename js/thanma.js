/* ======================= THAN MA (ngua than co thuoc tinh, kieu JX1) =======================
   Du lieu goc co san ngu dai than ma (Ô Vân Đạp Tuyết, Xích Thố, Tuyệt Ảnh, Đích Lô, Chiếu Dạ Ngọc Sư Tử) va ngua cao cap
   (Phi Vân, Bôn Tiêu, Xích Long Câu, Siêu Quang, Hổ Vương...) nhung yeu cau cap 80-180 / trung sinh, trong khi game gioi han cap 99
   -> khong ai cuoi duoc. O day: dung lai hinh + chi so goc (doi dong "Dương" sang dong thuong, bo The luc), ha cap yeu cau vao 60-97,
   khong phat ne tranh, them 2-4 dong than luc co dinh (luon hieu luc). Than ma tu khoa 🔒 (khong bi ban / hop nham).
   Nhan: roi o pho ban, rương Boss tuan hang S, Trum Hoang Kim; hoac doi o Than Ma Cac (Phuc Duyen + ngan luong). */
'use strict';
/* [ma, kind, ten dong du lieu (null = dong cuoi), ten hien thi, cap yeu cau, bac, [[thuoc tinh, gia tri]...], mo ta] */
const THAN_MA = [
  ['ovan', 5, 'Ô Vân Đạp Tuyết', 'Ô Vân Đạp Tuyết', 60, 1, [['coldres_p', 15], ['lifemax_p', 5], ['five_elements_resist_v', 10]], 'Ngựa đen bốn vó trắng như tuyết, hệ Thủy'],
  ['xtho', 5, 'Xích Thố', 'Xích Thố', 60, 1, [['fireres_p', 15], ['attackspeed_v', 6], ['deadlystrikeenhance_p', 4]], 'Ngày đi nghìn dặm, hệ Hỏa'],
  ['tanh', 5, 'Tuyệt ảnh', 'Tuyệt Ảnh', 60, 1, [['physicsres_p', 10], ['attackratingenhance_p', 15], ['ignoredefense_p', 6]], 'Nhanh tới mức không thấy bóng, hệ Kim'],
  ['dlo', 5, 'Đích Lô', 'Đích Lô', 60, 1, [['poisonres_p', 15], ['steallifeenhance_p', 3], ['lifereplenish_v', 25]], 'Từng cứu chủ nhảy qua suối Đàn Khê, hệ Mộc'],
  ['cdsu', 5, 'Chiếu Dạ Ngọc Sư Tử', 'Chiếu Dạ Ngọc Sư Tử', 60, 1, [['lightingres_p', 15], ['lucky_v', 15], ['meleedamagereturn_p', 6]], 'Sáng rực trong đêm, hệ Thổ'],
  ['pvan', 8, null, 'Phi Vân', 70, 2, [['allres_p', 6], ['attackspeed_v', 6], ['lifemax_p', 6]], 'Lướt như mây bay'],
  ['btieu', 6, null, 'Bôn Tiêu', 70, 2, [['lifemax_p', 8], ['steallifeenhance_p', 4], ['manamax_p', 6]], 'Phi nước đại trong đêm'],
  ['xlc', 9, null, 'Xích Long Câu', 80, 3, [['deadlystrikeenhance_p', 8], ['attackspeed_v', 8], ['five_elements_enhance_v', 15]], 'Long câu đỏ rực, chuyên xung trận'],
  ['duhuy', 11, null, 'Du Huy', 80, 3, [['lifemax_p', 10], ['meleedamagereturn_p', 10], ['lifereplenish_v', 40]], 'Ánh sáng lấp lánh trên bờm'],
  ['tdia', 10, null, 'Tuyệt Địa', 80, 3, [['ignoredefense_p', 10], ['attackratingenhance_p', 20], ['lucky_v', 20]], 'Chân không chạm đất'],
  ['dvu', 12, null, 'Đằng Vụ', 85, 3, [['five_elements_resist_v', 20], ['allres_p', 5], ['manamax_p', 10]], 'Cưỡi sương mà đi'],
  ['squang', 13, null, 'Siêu Quang', 85, 3, [['attackspeed_v', 10], ['deadlystrikeenhance_p', 6], ['lifemax_p', 6]], 'Nhanh hơn cả ánh sáng'],
  ['pvu', 7, null, 'Phiên Vũ', 90, 4, [['allres_p', 8], ['steallifeenhance_p', 5], ['attackspeed_v', 8], ['lifemax_p', 6]], 'Bay lượn như chim'],
  ['hhlc', 18, null, 'Hãn Huyết Long Câu', 92, 4, [['lifemax_p', 12], ['deadlystrikeenhance_p', 8], ['five_elements_enhance_v', 20], ['steallifeenhance_p', 4]], 'Mồ hôi đỏ như máu'],
  ['bhv', 16, null, 'Kim Tinh Bạch Hổ Vương', 95, 4, [['allres_p', 10], ['meleedamagereturn_p', 12], ['lifemax_p', 10], ['attackspeed_v', 8]], 'Chúa sơn lâm lông trắng'],
  ['pvtm', 21, null, 'Phong Vân Thần Mã', 97, 4, [['allres_p', 12], ['attackspeed_v', 10], ['deadlystrikeenhance_p', 8], ['lifemax_p', 10]], 'Thần mã của Phong Vân hội'],
];
const TM_TIER_VI = ['', 'Ngũ đại thần mã', 'Danh mã', 'Bảo mã', 'Thần mã tối thượng'];
const TM_COST = { 1: [120, 60000], 2: [200, 120000], 3: [320, 250000], 4: [500, 500000] };   // [Phuc Duyen, ngan luong goc x (1 + cap/10)]
const TM_ATTR_MAP = { 233: 85, 241: 114 };   // lifemax_yan_v -> lifemax_v, allres_yan_p -> allres_p (calc khong doc dong "Duong")
const TM_BASE_DROP = new Set([93, 243]);      // The luc / skill_enhance: bo
const tmDef = id => THAN_MA.find(t => t[0] === id);
const isThanMa = it => !!(it && it.d === 10 && it.thanma);
const tmCost = def => { const [fd, g] = TM_COST[def[5]]; return { fd, gold: Math.round(g * (1 + S.lvl / 10)) }; };
function makeThanMa(id) {
  const def = tmDef(id), g = J.items[10]; if (!def || !g) return null;
  const rows = g.list.filter(r => r.k === def[1] && (!def[2] || r.n === def[2])); if (!rows.length) return null;
  const row = rows.reduce((b, r) => (r.lvl > b.lvl ? r : b));
  const base = [];
  for (const [id0, mn, mx] of row.base) {
    if (TM_BASE_DROP.has(id0)) continue;
    const a = TM_ATTR_MAP[id0] || id0, v = attrName(a) === 'adddefense_v' ? Math.abs(mn) : mn, vx = attrName(a) === 'adddefense_v' ? Math.abs(mx) : mx;
    const same = base.find(b => b[0] === a); if (same) { same[1] += v; same[2] += vx; } else base.push([a, v, vx]);
  }
  const it = { uid: S.uid++, d: 10, k: def[1], p: row.p, n: def[3], ic: row.ic || '', lvl: 10, s: -1, price: row.price,
    base, req: [[36, def[4]]], r: 4, thanma: def[0], lock: true,
    mag: def[6].filter(([n]) => ATTR_ID[n] !== undefined).map(([n, v]) => ({ a: ATTR_ID[n], p: [v, 0, 0], n: '', pre: 1 })) };
  return it;
}
/* Than ma roi ra: bac phu hop cap nhan vat (cap yeu cau <= cap hien tai), uu tien bac cao; chua du cap 60 -> null */
function thanMaRoll() {
  const ok = THAN_MA.filter(t => t[4] <= S.lvl || (RW().stat.reborn > 0 && t[5] <= 2)); if (!ok.length) return null;
  const top = Math.max(...ok.map(t => t[5])), pool = ok.filter(t => t[5] >= top - 1);
  return makeThanMa(wpick(pool, t => (t[5] === top ? 1 : 2))[0]);
}
/* Ngua quy roi ra: than ma neu du cap, khong thi ngua thuong */
function rareHorse() { return thanMaRoll() || horseRoll(false); }
function tmBuy(id) {
  const def = tmDef(id); if (!def) return { ok: false, msg: 'Không có ngựa này' };
  if (S.lvl < def[4] && !RW().stat.reborn) return { ok: false, msg: `Cần cấp ${def[4]}` };
  const c = tmCost(def), r = RW();
  if (r.fd < c.fd) return { ok: false, msg: `Cần ${c.fd} Phúc Duyên (có ${r.fd})` };
  if (S.gold < c.gold) return { ok: false, msg: 'Không đủ ngân lượng' };
  if (S.inv.length >= INV_MAX) return { ok: false, msg: 'Hành trang đầy' };
  const it = makeThanMa(id); if (!it) return { ok: false, msg: 'Lỗi dữ liệu ngựa' };
  r.fd -= c.fd; S.gold -= c.gold; S.inv.unshift(it); invDirty = true; recItem(it);
  log(`🐎 Đổi được thần mã <b style="color:${RAR_COL[4]}">${esc(it.n)}</b>`); save();
  return { ok: true, msg: 'Nhận ' + it.n, it };
}
function tmLines(def) { return def[6].map(([n, v]) => attrText(n, [v, 0, v]).split('<enter>')[0].replace(/\.\s*$/, '')).join(' · '); }
function thanMaBody() {
  const r = RW(), own = new Set(S.inv.concat(Object.values(S.eq)).filter(isThanMa).map(x => x.thanma));
  let tier = 0;
  return `<p class="desc">không phạt né tránh, có 2–4 dòng thần lực luôn hiệu lực, tự khóa 🔒. Rơi ở phó bản, rương Boss tuần hạng S, Trùm Hoàng Kim; hoặc đổi tại đây bằng Phúc Duyên (đang có <b>${r.fd}</b>) + ngân lượng. Thuần dưỡng như ngựa thường.</p>
    ${THAN_MA.map(def => {
      const head = def[5] !== tier ? `<h4 class="rech">${TM_TIER_VI[(tier = def[5])]} <small class="dim">cấp ${def[4]}+</small></h4>` : '';
      const c = tmCost(def), lvOk = S.lvl >= def[4] || RW().stat.reborn > 0, row = J.items[10].list.find(x => x.k === def[1] && (!def[2] || x.n === def[2]));
      return `${head}<div class="qrow tmrow${lvOk ? '' : ' lock'}">${row && row.ic ? `<img src="${esc(row.ic)}" alt="">` : ''}<span><b style="color:${RAR_COL[4]}">${esc(def[3])}</b>${own.has(def[0]) ? ' <small class="cp">✔ đã có</small>' : ''}<small>${esc(def[7])}<br>${esc(tmLines(def))}</small></span>
        <button class="btn sm" data-tm="${def[0]}" ${lvOk && r.fd >= c.fd && S.gold >= c.gold ? '' : 'disabled'}>${lvOk ? `${c.fd} PD<br>${fmt(c.gold)}` : `Cấp ${def[4]}`}</button></div>`;
    }).join('')}`;
}
function bindThanMa(reopen) {
  document.querySelectorAll('#mBody [data-tm]').forEach(b => b.onclick = () => { const res = tmBuy(b.dataset.tm); toast(res.msg); if (res.ok) uiSfx('learn'); reopen(); });
}
