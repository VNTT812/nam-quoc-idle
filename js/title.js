/* ======================= DANH HIEU (kieu JX1) =======================
   - Ten nhan vat to mau theo phe: Chinh phai (vang cam), Trung lap (xanh luc), Ta phai (tim), Tan thu (trang).
   - Danh hieu deo hien phia tren ten, mau theo bac (thuong -> chi ton). Moi luc deo 1 danh hieu, cong 1 chi so nho.
   - Nhom: Cap bac, Chuyen sinh, Mon phai, Chien cong, Hanh hiep, Giang ho. Dat dieu kien la mo khoa vinh vien (luu S.rw.titles). */
'use strict';
const CAMP = { shaolin: 'chinh', wudang: 'chinh', emei: 'chinh', gaibang: 'chinh', tianwang: 'trung', tangmen: 'trung', cuiyan: 'trung', kunlun: 'trung', wudu: 'ta', tianren: 'ta' };
const CAMP_INFO = { chinh: { n: 'Chính phái', c: '#ffb347' }, trung: { n: 'Trung lập', c: '#7ee07e' }, ta: { n: 'Tà phái', c: '#c77bff' }, tan: { n: 'Tân thủ', c: '#ececec' } };
const campOf = fac => CAMP[fac] || 'tan';
const campCol = fac => CAMP_INFO[campOf(fac)].c;
const TIER = [null, { n: 'Thường', c: '#e8e0d0' }, { n: 'Hiếm', c: '#6aa8ff' }, { n: 'Quý', c: '#c77bff' }, { n: 'Truyền kỳ', c: '#ffb52e' }, { n: 'Chí tôn', c: '#ff5a3c' }, { n: 'GameMaster', c: '#ffd76a' }];
const FAC_SHORT = { shaolin: 'Thiếu Lâm', tianwang: 'Thiên Vương', tangmen: 'Đường Môn', wudu: 'Ngũ Độc', emei: 'Nga My', cuiyan: 'Thúy Yên', gaibang: 'Cái Bang', tianren: 'Thiên Nhẫn', wudang: 'Võ Đang', kunlun: 'Côn Lôn' };
const facShort = () => FAC_SHORT[S.fac] || '';
const lvTop = () => (RW().stat.reborn > 0 ? 200 : S.lvl);                        // da chuyen sinh: coi nhu da qua cap 200
const has90 = (minLv = 1) => Object.keys(S.sk || {}).some(id => SK[id] && SK[id].tier === 90 && S.sk[id] >= minLv);
const dtN = () => (S.dt && S.dt.n) || 0;
/* [id, ten (ham neu theo phai), nhom, bac, dieu kien, mo ta dieu kien, chi so [thuoc tinh, gia tri]] */
const TITLES = [
  // Cap bac
  ['xuatson', 'Sơ Nhập Giang Hồ', 'Cấp bậc', 1, () => lvTop() >= 10 && !FAC[S.fac].novice, 'Gia nhập môn phái', ['lifemax_p', 2]],
  ['lv30', 'Xuất Sơn', 'Cấp bậc', 1, () => lvTop() >= 30, 'Đạt cấp 30', ['lifemax_p', 3]],
  ['lv50', 'Thiếu Hiệp', 'Cấp bậc', 2, () => lvTop() >= 50, 'Đạt cấp 50', ['lifemax_p', 4]],
  ['lv80', 'Danh Chấn Giang Hồ', 'Cấp bậc', 2, () => lvTop() >= 80, 'Đạt cấp 80', ['attackspeed_v', 3]],
  ['lv100', 'Đại Hiệp', 'Cấp bậc', 3, () => lvTop() >= 100, 'Đạt cấp 100', ['allres_p', 4]],
  ['lv150', 'Tông Sư', 'Cấp bậc', 4, () => lvTop() >= 150, 'Đạt cấp 150', ['allres_p', 6]],
  ['lv200', 'Võ Lâm Chí Tôn', 'Cấp bậc', 5, () => lvTop() >= 200, 'Đạt cấp 200', ['allres_p', 8]],
  // Chuyen sinh
  ['cs1', 'Nhất Trùng Sinh', 'Chuyển sinh', 3, () => RW().stat.reborn >= 1, 'Chuyển sinh 1 lần', ['lifemax_p', 8]],
  ['cs3', 'Tam Trùng Sinh', 'Chuyển sinh', 4, () => RW().stat.reborn >= 3, 'Chuyển sinh 3 lần', ['lifemax_p', 10]],
  ['cs5', 'Ngũ Trùng Tuyệt Đỉnh', 'Chuyển sinh', 5, () => RW().stat.reborn >= 5, 'Chuyển sinh 5 lần', ['lifemax_p', 14]],
  // Mon phai (ten theo phai dang theo)
  ['mp1', () => facShort() + ' Đệ Tử', 'Môn phái', 1, () => !FAC[S.fac].novice, 'Gia nhập môn phái', ['manamax_p', 3]],
  ['mp2', () => facShort() + ' Hộ Pháp', 'Môn phái', 2, () => !FAC[S.fac].novice && lvTop() >= 60, 'Cấp 60 trong môn phái', ['manamax_p', 5]],
  ['mp3', () => facShort() + ' Trưởng Lão', 'Môn phái', 3, () => !FAC[S.fac].novice && lvTop() >= 90 && has90(), 'Cấp 90 + lĩnh ngộ võ công 90', ['manamax_p', 7]],
  ['mp4', () => facShort() + ' Chưởng Môn', 'Môn phái', 4, () => !FAC[S.fac].novice && lvTop() >= 150 && has90(20), 'Cấp 150 + một võ công 90 cấp 20', ['allres_p', 6]],
  // Chien cong
  ['k1000', 'Sát Thủ', 'Chiến công', 1, () => RW().stat.kills >= 1000, 'Hạ 1.000 quái', ['manamax_p', 4]],
  ['k10000', 'Vạn Nhân Địch', 'Chiến công', 2, () => RW().stat.kills >= 10000, 'Hạ 10.000 quái', ['attackspeed_v', 5]],
  ['k100000', 'Huyết Sát Thiên Hạ', 'Chiến công', 4, () => RW().stat.kills >= 100000, 'Hạ 100.000 quái', ['attackspeed_v', 8]],
  ['b50', 'Diệt Trùm', 'Chiến công', 2, () => RW().stat.bosses >= 50, 'Hạ 50 Trùm', ['allres_p', 3]],
  ['b500', 'Đồ Long Hiệp Sĩ', 'Chiến công', 4, () => RW().stat.bosses >= 500, 'Hạ 500 Trùm', ['allres_p', 6]],
  ['gold5', 'Săn Trùm Hoàng Kim', 'Chiến công', 3, () => RW().stat.goldBoss >= 5, 'Hạ 5 Trùm Hoàng Kim', ['lucky_v', 10]],
  ['tower20', 'Phá Tháp Giả', 'Chiến công', 3, () => RW().stat.towerBest >= 20, 'Leo tháp tầng 20', ['attackspeed_v', 6]],
  ['tower50', 'Thông Thiên Tháp Chủ', 'Chiến công', 5, () => RW().stat.towerBest >= 50, 'Leo tháp tầng 50', ['attackspeed_v', 10]],
  // Hanh hiep
  ['dt100', 'Hành Hiệp Trượng Nghĩa', 'Hành hiệp', 2, () => dtN() >= 100, 'Hoàn thành 100 nhiệm vụ Dã Tẩu', ['lucky_v', 8]],
  ['dt1000', 'Nghĩa Hiệp Thiên Hạ', 'Hành hiệp', 4, () => dtN() >= 1000, 'Hoàn thành 1.000 nhiệm vụ Dã Tẩu', ['lucky_v', 15]],
  ['zone8', 'Nửa Giang Sơn', 'Hành hiệp', 2, () => S.maxStage >= STAGES / 2, 'Mở nửa số bản đồ', ['fastwalkrun_p', 5]],
  ['zone16', 'Trường Bạch Sơn Chủ', 'Hành hiệp', 3, () => S.maxStage > STAGES, 'Mở hết bản đồ', ['lifemax_p', 6]],
  // Giang ho
  ['login30', 'Giang Hồ Lão Luyện', 'Giang hồ', 2, () => RW().login.total >= 30, 'Đăng nhập 30 ngày', ['manamax_p', 6]],
  ['setfull', 'Hoàng Kim Gia Thân', 'Giang hồ', 4, () => typeof enoughToActive === 'function' && enoughToActive(S.eq), 'Mặc đủ 1 bộ Hoàng Kim', ['allres_p', 5]],
  ['vio6', 'Huyền Tinh Thần Tượng', 'Giang hồ', 3, () => Object.values(S.eq || {}).some(it => it && it.vio && (it.mag || []).length >= 6), 'Mặc 1 món Tím đủ 6 dòng', ['allres_p', 4]],
  ['rich', 'Phú Giáp Nhất Phương', 'Giang hồ', 3, () => S.gold >= 10000000, 'Có 10 triệu lượng', ['lucky_v', 12]],
  // Banner trang tri tren dau
  ['thienha', 'Thiên Hạ Đệ Nhất', 'Giang hồ', 5, () => true, 'Danh hiệu trang trí trên đầu', ['allres_p', 10]],
  // GameMaster: chi tai khoan admin (netUname === 'admin')
  ['gm', 'GameMaster', 'Đặc biệt', 6, () => typeof isAdmin === 'function' && isAdmin(), 'Chỉ tài khoản admin', ['allres_p', 20]],
];
const TITLE_BY = Object.fromEntries(TITLES.map(t => [t[0], t]));
const titleName = t => typeof t[1] === 'function' ? t[1]() : t[1];
/* Mau chu tren banner theo bac */
const TITLE_TXT = [
  null,
  { fill: '#f2ebe0', stroke: '#2a2418' },       // Thuong
  { fill: '#c8e0ff', stroke: '#142848' },       // Hiem
  { fill: '#e8c8ff', stroke: '#3a1848' },       // Quy
  { fill: '#ffe29a', stroke: '#4a2808' },       // Truyen ky
  { fill: '#ffd0b0', stroke: '#501810' },       // Chi ton
  { fill: '#fff3c0', stroke: '#5a2808' }        // GM
];
/* Banner: moi danh hieu (tru GM) dung base anim + ve DUNG ten luc deo. GM = SPR rieng noi bat. */
const TITLE_FX_BASE = { src: 'img/title/base.png', w: 158, h: 70, frames: 8, fps: 11, fw: 206, fh: 91, dyn: 1 };
const TITLE_FX = {
  /* SPR GameMaster — lon nhat + glow */
  gm: { src: 'img/title/gm.png', w: 210, h: 144, frames: 8, fps: 14, fw: 254, fh: 174, glow: 1 },
  /* Thien Ha: sheet rieng (moi them) */
  thienha: { src: 'img/title/thienha.png', w: 156, h: 69, frames: 8, fps: 12, fw: 206, fh: 91 }
};
for (const t of TITLES) {
  if (TITLE_FX[t[0]]) continue; // gm / thienha giu nguyen
  TITLE_FX[t[0]] = Object.assign({}, TITLE_FX_BASE, { tier: t[3] | 0 });
}
const titleFxOf = t => {
  const id = !t ? null : (typeof t === 'string' ? t : t[0]);
  return id && TITLE_FX[id] ? id : null;
};
/* Ve chu danh hieu dung ten len banner (IBM Plex Mono — font game) */
function drawTitleLabel(c, x, y, text, tier, scale) {
  if (!text) return;
  const col = TITLE_TXT[tier] || TITLE_TXT[5];
  const size = Math.max(11, Math.min(15, Math.round(13 * (scale || 1))));
  c.font = `bold ${size}px "IBM Plex Mono", monospace`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.miterLimit = 2;
  c.lineWidth = Math.max(3, Math.round(size * 0.28));
  c.strokeStyle = col.stroke;
  c.strokeText(text, x, y);
  // highlight tren
  const g = c.createLinearGradient(x, y - size * 0.55, x, y + size * 0.55);
  g.addColorStop(0, '#fffef5'); g.addColorStop(0.45, col.fill); g.addColorStop(1, col.fill);
  c.fillStyle = g;
  c.fillText(text, x, y);
}
/* Ve banner; labelOpt = ten deo (peer / mon phai dong). Tra ve chieu cao da dung. */
function drawTitleFx(c, x, yTop, id, labelOpt) {
  const fx = id && TITLE_FX[id]; if (!fx || !c) return 0;
  const im = typeof img === 'function' ? img(fx.src) : null;
  if (!im || !im.complete || !im.naturalWidth) return 0;
  const t = (typeof R !== 'undefined' && R.clock) || 0;
  const glow = !!fx.glow;
  const bob = Math.sin(t * (glow ? 3.6 : 3.1)) * (glow ? 2.4 : 1.6);
  const pulse = glow ? (0.96 + 0.07 * Math.sin(t * 5.2)) : (0.97 + 0.04 * Math.sin(t * 4.2));
  const w = fx.w * pulse, h = fx.h * pulse;
  const n = fx.frames | 0;
  const fw = fx.fw || (n > 1 ? (im.naturalWidth / n) | 0 : im.naturalWidth);
  const fh = fx.fh || im.naturalHeight;
  const fi = n > 1 ? ((t * (fx.fps || 10)) | 0) % n : 0;
  const dx = x - w / 2, dy = yTop - h + bob;
  c.save();
  if (glow) {
    const g = c.createRadialGradient(x, yTop - h * 0.45, 4, x, yTop - h * 0.45, w * 0.62);
    g.addColorStop(0, 'rgba(255,220,120,0.45)');
    g.addColorStop(0.45, 'rgba(255,140,40,0.18)');
    g.addColorStop(1, 'rgba(255,80,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(x, yTop - h * 0.42, w * 0.58, h * 0.55, 0, 0, 7); c.fill();
    c.globalAlpha = 0.35 + 0.15 * Math.sin(t * 6);
    c.globalCompositeOperation = 'lighter';
    if (n > 1) c.drawImage(im, fi * fw, 0, fw, fh, dx - 3, dy - 2, w + 6, h + 4);
    else c.drawImage(im, dx - 3, dy - 2, w + 6, h + 4);
    c.globalCompositeOperation = 'source-over';
  }
  c.globalAlpha = glow ? 1 : 0.96;
  if (n > 1) c.drawImage(im, fi * fw, 0, fw, fh, dx, dy, w, h);
  else c.drawImage(im, dx, dy, w, h);
  // chu dung ten danh hieu dang deo (tru sheet GM/thienha da co chu san)
  if (fx.dyn) {
    const row = TITLE_BY[id];
    const label = (labelOpt != null && labelOpt !== '') ? String(labelOpt) : (row ? titleName(row) : '');
    const tier = (fx.tier != null ? fx.tier : (row && row[3])) || 5;
    // chu nam o vung giua banner
    drawTitleLabel(c, x, dy + h * 0.48, label, tier, pulse);
  }
  c.restore();
  return h + (glow ? 6 : 2);
}
const TT = () => {
  const r = RW(); r.titles = r.titles || {};
  for (const id in r.ach || {}) if (TITLE_BY[id]) r.titles[id] = 1;
  // GM: chi admin — cap/thu hoi theo tai khoan
  if (typeof isAdmin === 'function' && isAdmin()) r.titles.gm = 1;
  else { delete r.titles.gm; if (r.title === 'gm') r.title = ''; }
  return r.titles;
};
function titleCheck(quiet) {
  if (!S || !S.fac) return 0;
  const t = TT(); let n = 0;
  for (const x of TITLES) if (!t[x[0]] && x[4]()) { t[x[0]] = 1; n++; if (!quiet && !R.quiet) { log(`🎖 Đạt danh hiệu <b style="color:${TIER[x[3]].c}">«${esc(titleName(x))}»</b> (${TIER[x[3]].n}) — đeo ở thẻ Nhân vật.`); toast('Danh hiệu mới: ' + titleName(x)); } }
  return n;
}
const titleWorn = () => {
  const id = S && S.rw && S.rw.title, x = id && TITLE_BY[id];
  if (!x || !TT()[id]) return null;
  if (id === 'gm' && !(typeof isAdmin === 'function' && isAdmin())) return null;
  return x;
};
function titleAttr(A) { const x = titleWorn(); if (x) addAttr(A, x[6][0], [x[6][1], 0, 0]); }   // goi tu calc()
function titleModal() {
  titleCheck();
  // preload banner sheet
  if (typeof img === 'function') Object.keys(TITLE_FX).forEach(id => img(TITLE_FX[id].src));
  const t = TT(), worn = titleWorn(), cats = [...new Set(TITLES.map(x => x[2]))], got = TITLES.filter(x => t[x[0]]).length;
  const camp = CAMP_INFO[campOf(S.fac)];
  modal(`<h3>🎖 Danh hiệu <small>${got}/${TITLES.length}</small></h3>
    <p class="desc">Phe: <b style="color:${camp.c}">${camp.n}</b> (màu tên nhân vật). Đeo 1 danh hiệu: hiện phía trên tên và cộng 1 chỉ số. ${worn ? `Đang đeo: <b style="color:${TIER[worn[3]].c}">«${esc(titleName(worn))}»</b>` : 'Chưa đeo danh hiệu.'}</p>
    ${cats.map(c => `<h3>${c}</h3>` + TITLES.filter(x => x[2] === c).map(x => { const ok = !!t[x[0]], on = worn === x;
      const fx = TITLE_FX[x[0]] ? ` <small class="cp">${x[0] === 'gm' ? '★ GM' : 'banner'}</small>` : '';
      const tier = TIER[x[3]] || TIER[5];
      return `<div class="qrow${ok ? '' : ' lock'}"><span><b style="color:${ok ? tier.c : '#777'}">«${esc(titleName(x))}»</b>${fx} <small class="dim">${tier.n}</small><small>${esc(x[5])} · ${esc(attrText(x[6][0], [x[6][1], 0, 0]))}</small></span><small></small>
        <button class="btn sm${on ? ' on' : ''}" data-tt="${x[0]}" ${ok ? '' : 'disabled'}>${on ? 'Tháo' : ok ? 'Đeo' : 'Chưa đạt'}</button></div>`; }).join('')).join('')}`, () => {
    document.querySelectorAll('#mBody [data-tt]').forEach(b => b.onclick = () => {
      const id = b.dataset.tt;
      if (id === 'gm' && !(typeof isAdmin === 'function' && isAdmin())) { toast('Chỉ tài khoản admin'); return; }
      const r = RW(); r.title = r.title === id ? '' : id; R.dirty = true; save(); refresh(); titleModal();
    });
  });
}
