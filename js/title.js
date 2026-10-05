/* ======================= DANH HIEU (kieu JX1) =======================
   - Ten nhan vat to mau theo phe: Chinh phai (vang cam), Trung lap (xanh luc), Ta phai (tim), Tan thu (trang).
   - Danh hieu deo hien phia tren ten, mau theo bac (thuong -> chi ton). Moi luc deo 1 danh hieu, cong 1 chi so nho.
   - Nhom: Cap bac, Chuyen sinh, Mon phai, Chien cong, Hanh hiep, Giang ho. Dat dieu kien la mo khoa vinh vien (luu S.rw.titles). */
'use strict';
const CAMP = { shaolin: 'chinh', wudang: 'chinh', emei: 'chinh', gaibang: 'chinh', tianwang: 'trung', tangmen: 'trung', cuiyan: 'trung', kunlun: 'trung', wudu: 'ta', tianren: 'ta' };
const CAMP_INFO = { chinh: { n: 'Chính phái', c: '#ffb347' }, trung: { n: 'Trung lập', c: '#7ee07e' }, ta: { n: 'Tà phái', c: '#c77bff' }, tan: { n: 'Tân thủ', c: '#ececec' } };
const campOf = fac => CAMP[fac] || 'tan';
const campCol = fac => CAMP_INFO[campOf(fac)].c;
const TIER = [null, { n: 'Thường', c: '#e8e0d0' }, { n: 'Hiếm', c: '#6aa8ff' }, { n: 'Quý', c: '#c77bff' }, { n: 'Truyền kỳ', c: '#ffb52e' }, { n: 'Chí tôn', c: '#ff5a3c' }];
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
];
const TITLE_BY = Object.fromEntries(TITLES.map(t => [t[0], t]));
const titleName = t => typeof t[1] === 'function' ? t[1]() : t[1];
const TT = () => { const r = RW(); r.titles = r.titles || {}; for (const id in r.ach || {}) if (TITLE_BY[id]) r.titles[id] = 1; return r.titles; };   // thanh tuu cu cung ten -> mo khoa luon
function titleCheck(quiet) {
  if (!S || !S.fac) return 0;
  const t = TT(); let n = 0;
  for (const x of TITLES) if (!t[x[0]] && x[4]()) { t[x[0]] = 1; n++; if (!quiet && !R.quiet) { log(`🎖 Đạt danh hiệu <b style="color:${TIER[x[3]].c}">«${esc(titleName(x))}»</b> (${TIER[x[3]].n}) — đeo ở thẻ Nhân vật.`); toast('Danh hiệu mới: ' + titleName(x)); } }
  return n;
}
const titleWorn = () => { const id = S && S.rw && S.rw.title, x = id && TITLE_BY[id]; return x && TT()[id] ? x : null; };
function titleAttr(A) { const x = titleWorn(); if (x) addAttr(A, x[6][0], [x[6][1], 0, 0]); }   // goi tu calc()
function titleModal() {
  titleCheck();
  const t = TT(), worn = titleWorn(), cats = [...new Set(TITLES.map(x => x[2]))], got = TITLES.filter(x => t[x[0]]).length;
  const camp = CAMP_INFO[campOf(S.fac)];
  modal(`<h3>🎖 Danh hiệu <small>${got}/${TITLES.length}</small></h3>
    <p class="desc">Phe: <b style="color:${camp.c}">${camp.n}</b> (màu tên nhân vật). Đeo 1 danh hiệu: hiện phía trên tên và cộng 1 chỉ số. ${worn ? `Đang đeo: <b style="color:${TIER[worn[3]].c}">«${esc(titleName(worn))}»</b>` : 'Chưa đeo danh hiệu.'}</p>
    ${cats.map(c => `<h3>${c}</h3>` + TITLES.filter(x => x[2] === c).map(x => { const ok = !!t[x[0]], on = worn === x;
      return `<div class="qrow${ok ? '' : ' lock'}"><span><b style="color:${ok ? TIER[x[3]].c : '#777'}">«${esc(titleName(x))}»</b> <small class="dim">${TIER[x[3]].n}</small><small>${esc(x[5])} · ${esc(attrText(x[6][0], [x[6][1], 0, 0]))}</small></span><small></small>
        <button class="btn sm${on ? ' on' : ''}" data-tt="${x[0]}" ${ok ? '' : 'disabled'}>${on ? 'Tháo' : ok ? 'Đeo' : 'Chưa đạt'}</button></div>`; }).join('')).join('')}`, () => {
    document.querySelectorAll('#mBody [data-tt]').forEach(b => b.onclick = () => { const r = RW(); r.title = r.title === b.dataset.tt ? '' : b.dataset.tt; R.dirty = true; save(); refresh(); titleModal(); });
  });
}
