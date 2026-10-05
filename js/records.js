/* ======================= BANG KY LUC CA NHAN =======================
   Ghi lai cac moc dang nho cua nhan vat (luu trong S.rec): don manh nhat, DPS cao nhat (cua so 5 giay), ha trum nhanh nhat,
   chuoi ha quai khong guc, do quy nhat nhat duoc, cuong hoa cao nhat, phó bản / boss tuan... Moi ky luc kem ngay dat duoc. */
'use strict';
const DPS_WIN = 5;
function REC() {
  const r = S.rec || (S.rec = {});
  for (const k of ['maxHit', 'maxDps', 'fastBoss', 'bestItem', 'maxEnh', 'bestStreak', 'maxGoldKill', 'wbBest', 'horseLv'])
    if (r[k] && typeof r[k] !== 'object') delete r[k];
  r.deaths = r.deaths | 0; r.play = +r.play || 0; r.goldKill = +r.goldKill || 0; r.streak = r.streak | 0;
  r.dgClear = r.dgClear || {}; r.dgBest = r.dgBest || {}; r.dgRank = r.dgRank || {};
  r.wbTries = r.wbTries | 0; r.horses = r.horses | 0;
  return r;
}
const recNow = () => Date.now();
/* Ghi ky luc neu tot hon (higher = true: so lon hon la tot hon) */
function recSet(key, v, extra, higher = true) {
  if (!S || !S.fac || !Number.isFinite(v)) return false;
  const r = REC(), cur = r[key];
  if (cur && (higher ? v <= cur.v : v >= cur.v)) return false;
  r[key] = Object.assign({ v, t: recNow() }, extra || {});
  return true;
}
/* ---------- moc noi vao tro choi ---------- */
function recHit(dmg, a) {
  if (R.quiet || !(dmg > 0)) return;
  R.dpsAcc = (R.dpsAcc || 0) + dmg;
  if (recSet('maxHit', Math.round(dmg), { n: a ? a.n : '', L: S.lvl }) && !(R.recToastT > 0) && REC().maxHit.v > 1000) { addText(H.x, H.y - 64, 'Kỷ lục đòn đánh!', '#ffd24a', 12); R.recToastT = 20; }
}
function recTick(dt) {
  R.clock = (R.clock || 0) + dt;
  if (R.quiet) return;
  const r = REC(); r.play += dt;
  R.recToastT = (R.recToastT || 0) - dt;
  // DPS: gom sat thuong tung giay, lay tong 5 giay gan nhat (chi khi dang danh)
  R.dpsT = (R.dpsT || 0) + dt;
  if (R.dpsT >= 1) {
    R.dpsT -= 1; const w = R.dpsWin || (R.dpsWin = []); w.push(R.dpsAcc || 0); R.dpsAcc = 0; if (w.length > DPS_WIN) w.shift();
    if (w.length === DPS_WIN && w.every(x => x > 0)) recSet('maxDps', Math.round(w.reduce((a, b) => a + b, 0) / DPS_WIN), { L: S.lvl, n: R.P && R.P.main ? R.P.main.n : '' });
  }
}
function recKill(e, gold) {
  if (R.quiet || !S.fac) return;
  const r = REC();
  r.goldKill += gold || 0; r.streak++;
  if (r.streak > ((r.bestStreak && r.bestStreak.v) || 0)) r.bestStreak = { v: r.streak, t: recNow() };
  if (gold) recSet('maxGoldKill', gold, { n: e.n });
  if (e.cls === 'boss' && e.born != null && !e.wb) { const s = (R.clock || 0) - e.born; if (s > 0.5) recSet('fastBoss', Math.round(s * 10) / 10, { n: e.n, L: e.L }, false); }
}
function recDeath() { if (!S.fac || R.quiet) return; const r = REC(); r.deaths++; r.streak = 0; }
function recItem(it) {
  if (!it || R.quiet || !S.fac) return;
  const r = REC(), cur = r.bestItem, score = it.r * 1000 + it.lvl * 10 + (it.mag || []).length;
  if (!cur || score > cur.v) r.bestItem = { v: score, n: it.n, r: it.r, t: recNow() };
}
function recEnh(it) { if (it && it.enh) recSet('maxEnh', it.enh, { n: it.n }); }

/* ---------- giao dien ---------- */
const recDate = t => { if (!t) return ''; const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`; };
const recTime = s => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} giờ ${m} phút` : `${m} phút ${s % 60} giây`; };
function recRows() {
  const r = REC(), rw = RW().stat, x = (o, f) => o ? f(o) : '<span class="dim">chưa có</span>', d = o => o && o.t ? `<small class="dim">${recDate(o.t)}</small>` : '';
  const dgs = (typeof DUNGEONS !== 'undefined' ? DUNGEONS : []);
  return [
    ['Chiến đấu', [
      ['Đòn đánh mạnh nhất', x(r.maxHit, o => `<b>${fmt(o.v)}</b> ${o.n ? '· ' + esc(o.n) : ''}`), d(r.maxHit)],
      ['DPS cao nhất (5 giây)', x(r.maxDps, o => `<b>${fmt(o.v)}</b>/giây`), d(r.maxDps)],
      ['Hạ trùm nhanh nhất', x(r.fastBoss, o => `<b>${o.v} giây</b> · ${esc(o.n)} Lv${o.L}`), d(r.fastBoss)],
      ['Chuỗi hạ quái không gục', x(r.bestStreak, o => `<b>${fmt(o.v)}</b> quái (hiện ${fmt(r.streak)})`), d(r.bestStreak)],
      ['Ngân lượng 1 quái', x(r.maxGoldKill, o => `<b>${fmt(o.v)}</b> · ${esc(o.n)}`), d(r.maxGoldKill)],
      ['Số lần trọng thương', `<b>${fmt(r.deaths)}</b>`, ''],
    ]],
    ['Tiến trình', [
      ['Bản đồ cao nhất', `<b>${esc(zoneOf(Math.min(S.maxStage, STAGES)).n)}</b>`, ''],
      ['Tổng quái đã hạ', `<b>${fmt(S.totalKills || 0)}</b> · trùm ${fmt(rw.bosses)} · Hoàng Kim ${fmt(rw.goldBoss)}`, ''],
      ['Tháp thử thách', `<b>tầng ${rw.towerBest}</b>`, ''],
      ['Chuyển sinh', `<b>${rw.reborn}</b> lần`, ''],
      ['Thời gian chơi', `<b>${recTime(r.play)}</b>`, ''],
      ['Ngân lượng từ quái', `<b>${fmt(r.goldKill)}</b>`, ''],
    ]],
    ['Trang bị', [
      ['Món quý nhất từng có', x(r.bestItem, o => `<b style="color:${RAR_COL[o.r]}">${esc(o.n)}</b>`), d(r.bestItem)],
      ['Cường hóa cao nhất', x(r.maxEnh, o => `<b>+${o.v}</b> · ${esc(o.n)}`), d(r.maxEnh)],
      ['Ngựa thuần dưỡng cao nhất', x(r.horseLv, o => `<b>cấp ${o.v}</b> · ${esc(o.n)}`), d(r.horseLv)],
      ['Sổ ngựa', `<b>${typeof horseBookCount === 'function' ? horseBookCount() : 0}</b> loài đã cưỡi`, ''],
    ]],
    ['Phó bản & Boss tuần', dgs.map(g => [g.n, r.dgClear[g.id] ? `<b>${r.dgClear[g.id]}</b> lần · nhanh nhất ${r.dgBest[g.id]} giây · hạng ${r.dgRank[g.id] || '—'}` : '<span class="dim">chưa qua</span>', ''])
      .concat([['Boss tuần: sát thương cao nhất', x(r.wbBest, o => `<b>${fmt(o.v)}</b> · ${esc(o.n || '')} · hạng ${o.rank || '—'}`), d(r.wbBest)], ['Boss tuần: số lượt đã đánh', `<b>${r.wbTries}</b>`, '']])],
  ];
}
function recordsBody() {
  return `<p class="desc">Kỷ lục riêng của nhân vật này (lưu trong file lưu). Đòn đánh và DPS chỉ tính khi đang chơi, không tính tiến trình vắng mặt.</p>
    ${recRows().map(([h, rows]) => `<h4 class="rech">${h}</h4><div class="card rect">${rows.map(([a, b, c]) => `<span>${a}</span><span>${b} ${c}</span>`).join('')}</div>`).join('')}`;
}
