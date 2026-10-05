/* ======================= VO CONG 90 (Mat Tich) + TAY TUY =======================
   Nhu JX1: chieu 90 yeu cau cap 90; hoc lan dau can 1 Vo Lam Mat Tich 90 (S.mats.misc.bk90), sau do cong diem nhu thuong.
   Tay Tuy: tra lai toan bo diem tiem nang / ky nang (giu quyen da hoc bang Mat Tich). */
'use strict';
const BOOK_N = { bk90: 'Võ Lâm Mật Tịch 90' };
(function initHiSkills() {
  // chieu 90: yeu cau cap 80 (v118) + Mat Tich 90 (du lieu cu ghi cap 80). Chieu 120 / 150: da bo theo yeu cau.
  for (const s of Object.values(SK)) if (s && s.learn === '90') { s.req = 80; s.book = 'bk90'; s.tier = 90; }
})();
/* ---------- hoc bang Mat Tich ---------- */
const bookOk = s => !s.book || rebornN() > 0 || (S.sk[s.id] || 0) > 0 || !!(S.bkOk && S.bkOk[s.id]) || (typeof matHave === 'function' && matHave('misc', s.book) > 0);
/* goi TRUOC khi tang cap ky nang tu 0 -> 1: tru 1 Mat Tich (moi chieu chi 1 lan, rut diem roi hoc lai khong mat them) */
function bookUse(id) {
  const s = SK[id]; if (!s || !s.book || (S.sk[id] || 0) > 0 || (S.bkOk && S.bkOk[id])) return;
  matAdd('misc', s.book, -1); (S.bkOk || (S.bkOk = {}))[id] = 1;
  log(`📖 Lĩnh ngộ <b style="color:#ffd24a">${esc(s.n)}</b> (dùng 1 ${BOOK_N[s.book]})`);
}
/* ---------- Tay Tuy ---------- */
function tayTuyModal() {
  const spentA = Object.values(S.attr).reduce((t, v) => t + v, 0), spentS = Object.keys(S.sk).reduce((t, id) => t + (SK[id] && SK[id].tier === 90 && !isBr90(id) ? 0 : S.sk[id]), 0) - (FAC[S.fac].starter && S.sk[FAC[S.fac].starter] ? 1 : 0);
  modal(`<h3>Tẩy Tủy</h3><p class="desc">Trả lại điểm đã cộng để phân phối lại. Miễn phí, dùng bao nhiêu lần cũng được. Võ công đã lĩnh ngộ bằng Mật Tịch học lại không cần sách.</p>
    <div class="card stats"><span>Tiềm năng đã cộng</span><span>${spentA}</span><span>Điểm kỹ năng đã cộng</span><span>${Math.max(0, spentS)}</span></div>
    <div class="btnrow"><button class="btn" id="ttA" ${spentA ? '' : 'disabled'}>Tẩy tiềm năng</button><button class="btn" id="ttS" ${spentS > 0 ? '' : 'disabled'}>Tẩy kỹ năng</button><button class="btn" id="ttAll" ${spentA || spentS > 0 ? '' : 'disabled'}>Tẩy cả hai</button></div>`, () => {
    $('#ttA').onclick = () => tayTuy(true, false); $('#ttS').onclick = () => tayTuy(false, true); $('#ttAll').onclick = () => tayTuy(true, true);
  });
}
function tayTuy(a, s) {
  if (a) { for (const k in S.attr) { S.attrPts += S.attr[k]; S.attr[k] = 0; } }
  if (s) {
    const st = FAC[S.fac].starter, bk = S.bkOk || (S.bkOk = {});
    for (const id in S.sk) { if (SK[id] && SK[id].book) bk[id] = 1; S.skPts += SK[id] && SK[id].tier === 90 && !isBr90(id) ? 0 : S.sk[id]; }
    S.sk = {}; if (st) { S.sk[st] = 1; S.skPts--; S.main = st; } S.mainLock = false; S.slots = [0, 0, 0, 0];
  }
  R.dirty = true; recalc(); R.life = Math.min(R.life, R.P.life); R.mana = Math.min(R.mana, R.P.mana);
  fillSlots(); renderPad(); closeModal(true); refresh(); save(); uiSfx('learn');
  log(`🌊 Tẩy Tủy: ${[a && 'tiềm năng', s && 'kỹ năng'].filter(Boolean).join(' + ')} đã hoàn lại (${S.attrPts} tiềm năng, ${S.skPts} điểm kỹ năng).`);
}
/* ---------- Hoc / cong 1 diem ky nang (moi nut + dung ham nay) ---------- */
function skLearn(id) {
  const s = SK[id]; if (!s || !canLearn(s)) return false;
  if (!R.sim) bookUse(id); if (!sk9Free(s)) S.skPts--;
  if (s.tier === 90 && !isBr90(id)) { const t = SKL(); S.sk[id] = Math.max(1, t[id] ? t[id].lv : 1); if (!t[id]) t[id] = { lv: 1, xp: 0 }; }
  else S.sk[id] = (S.sk[id] || 0) + 1;
  return true;
}
/* ---------- LUYEN VO CONG 90 (nhu JX1): hoc cap 1 bang Mat Tich + 1 diem, len cap bang cach dung chieu ha quai ----------
   - Chieu tan cong 90: phai dat o chieu chinh hoac o 1-4; noi tai 90: tu luyen khi da hoc.
   - Quai phai >= cap nhan vat - 10 (quai yeu khong tinh). Thuong 1, tinh anh 3, trum 20.
   - Cap da luyen luu rieng (S.skL): Tay Tuy / chuyen sinh / rut diem khong mat, hoc lai la ve dung cap. */
/* 5 chieu 90 nhanh ho tro (skills.txt IsExpSkill = 0): khong luyen, cong bang diem ky nang.
   Gioi han cap = theo cac chieu ho tro cung duong: tat ca dat 5 -> toi da 1; moi lan tat ca +1 cap -> toi da +1; tat ca 20 -> toi da 20 */
const SK9_BRANCH = {
  332: [93, 89, 86, 92, 282],            // Pho Do Chung Sinh: Tu Hang Pho Do, Mong Diep, Luu Thuy, Phat Tam Tu Huu, Thanh Am Phan Xuong
  391: [136, 137, 140, 364, 143],        // Nhiep Hon Loan Tam: bua Thien Nhan
  394: [392, 174, 393, 175, 181, 90],    // Tuy Tien Ta Cot: bua Con Lon
  390: [67, 70, 64, 73, 356, 72],        // Doan Can Hu Cot: bua Ngu Doc
  351: [347, 303, 343, 345, 349],        // Loan Hoan Kich: bay Duong Mon
};
const isBr90 = id => !!SK9_BRANCH[id];
function sk9BranchCap(id) {
  const br = SK9_BRANCH[id], s = SK[id]; if (!br || !s) return 0;
  const m = Math.min(...br.map(x => S.sk[x] || 0)); if (m < 5) return 0;
  return Math.min(s.max, 1 + Math.round((m - 5) * 19 / 15));   // 5 -> 1, 6 -> 2 ... 20 -> 20
}
function sk9SyncBranch() {   // chieu ho tro bi rut diem: cap 90 vuot gioi han thi hoan diem
  if (S.sk && !S.br90) { S.br90 = 1; for (const id in SK9_BRANCH) if (S.sk[id] > 1) S.sk[id] = 1; }   // save cu (cap do luyen, chi ton 1 diem): ve cap 1
  for (const id in SK9_BRANCH) { const L = S.sk && S.sk[id] || 0; if (!L) continue; const c = sk9BranchCap(+id);
    if (L > c) { S.skPts += L - c; if (c > 0) S.sk[id] = c; else delete S.sk[id]; } }
}
const SK9_NEED = L => Math.round(25 * Math.pow(L, 1.35) + 25);
const SKL = () => S.skL || (S.skL = {});
/* v122: chieu tan cong 90 chi luyen khi CHINH chieu do danh trung con quai bi ha (used = cac chieu da trung quai); noi tai 90 luon luyen */
function sk9Using(id, used) { const s = SK[id]; return !isAttack(s) || !!(used && used[id]); }
function sk9Gain(n, quiet, used) {
  if (!S.fac || !FAC[S.fac] || !(n > 0)) return;
  const t = SKL();
  for (const id in S.sk) {
    const s = SK[id]; if (!s || s.tier !== 90 || !S.sk[id] || SK9_BRANCH[id] || !sk9Using(id, used)) continue;
    const r = t[id] || (t[id] = { lv: S.sk[id], xp: 0 }); if (r.lv >= s.max) continue;
    r.xp += n;
    while (r.lv < s.max && r.xp >= SK9_NEED(r.lv)) {
      r.xp -= SK9_NEED(r.lv); r.lv++; S.sk[id] = r.lv; R.dirty = true;
      if (!quiet) { log(`🔥 Luyện thành <b style="color:#ffd24a">${esc(s.n)}</b> cấp ${r.lv}/${s.max}`); toast(`${s.n} lên cấp ${r.lv}`); }
    }
    if (r.lv >= s.max) r.xp = 0;
  }
}
function sk9OnKill(e) { if (!e || !(e.L >= S.lvl - 10)) return; sk9Gain(e.cls === 'boss' ? 20 : e.cls === 'elite' ? 3 : 1, false, e.hitSk); }
function sk9Text(id) { const s = SK[id], r = SKL()[id]; if (!s || s.tier !== 90) return '';
  if (SK9_BRANCH[id]) { const br = SK9_BRANCH[id].filter(x => SK[x]); return `Không luyện: cộng điểm kỹ năng, tối đa cấp ${sk9BranchCap(id)} (tất cả chiêu hỗ trợ đạt 5 → 1, mỗi lần tất cả +1 → +1, tất cả 20 → 20) · ${br.map(x => `${SK[x].n} ${S.sk[x] || 0}`).join(', ')}`; } if (!r || r.lv >= s.max) return r ? 'Đã luyện tối đa' : 'Học xong rồi luyện bằng cách đánh quái'; return `Luyện ${r.xp}/${SK9_NEED(r.lv)}`; }
