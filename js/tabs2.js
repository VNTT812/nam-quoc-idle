/* ======================= THE LO REN + THE NHIEM VU (thanh duoi: 7 the) ======================= */
'use strict';
/* ---------- Lo Ren: tong hop moi he thong ren ---------- */
function renderForge() {
  const fr = forgeReadyCounts(), ores = Object.keys(mats().ore).reduce((t, k) => t + matHave('ore', k), 0), hts = Object.keys(mats().ht).reduce((t, k) => t + matHave('ht', k), 0);
  const phoi = S.inv.concat(epBox(), Object.values(S.eq)).filter(i => i && typeof isPhoi === 'function' && isPhoi(i)).length;
  const shardReady = Object.keys(mats().shard).filter(n => SHARDS[n] && matHave('shard', n) >= SHARDS[n]).length;
  const plat = Object.values(S.eq).filter(x => x && canPlatBase(x)).concat(S.inv.filter(canPlatBase)).filter(i => !platReady(i)).length;
  const eq = SLOTS.map(([k]) => S.eq[k]).filter(Boolean);
  $('#t-forge').innerHTML = `
    <div class="card fcard"><div class="fic"><img src="img/ep/ht.png" alt=""></div><div><b>💎 Lò Ép Đồ</b> <small class="dim">tinh luyện Huyền Tinh · lấy thuộc tính · chế tạo phôi · khảm nạm đồ Tím</small>
      ${verVio() ? `<div class="small">Huyền Tinh <b>${hts}</b> · đá thuộc tính <b>${ores}</b> · phôi <b>${phoi}</b> · Rương ép <b>${epBox().length}</b>/${EP_BOX_MAX}${fr.ench ? ' · <span class="cp">có thể khảm</span>' : ''}${fr.up ? ' · <span class="cp">thăng cấp được</span>' : ''}</div>
      <div class="btnrow"><button class="btn sm" data-ep="kham">Khảm nạm</button><button class="btn sm" data-ep="hut">Lấy thuộc tính</button><button class="btn sm" data-ep="phoi">Chế phôi</button><button class="btn sm" data-ep="tl">Tinh luyện</button><button class="btn sm" data-ep="box">Rương ép</button></div>`
      : ''}</div></div>
    <div class="card fcard"><div class="fic"><img src="img/ep/mys.png" alt=""></div><div><b>🔥 Lò Hoàng Kim · Bạch Kim</b> <small class="dim">ghép mảnh Hoàng Kim, chế và thăng cấp Bạch Kim</small>
      <div class="small">Mảnh đủ ghép <b>${shardReady}</b> · Hoàng Kim chế được Bạch Kim <b>${plat}</b> · Thủy Tinh Trắng ${matHave('misc', 'wc')} · Thần Bí Khoáng Thạch ${matHave('misc', 'mys')}</div>
      <div class="btnrow"><button class="btn" id="fgHt">Mở Lò Hoàng Kim</button></div></div></div>
    <div class="card"><b>⚒ Cường hóa</b> <small class="dim">+1…+${ENH_MAX}, mỗi cấp +${Math.round(ENH_STEP * 100)}% thuộc tính gốc · chạm món đang mặc để rèn riêng (cường hóa, tẩy luyện, Bạch Kim)</small>
      <div class="invgrid">${eq.map(it => itemCell(it).replace('</button>', `${it.enh ? `<em class="fenh">+${it.enh}</em>` : ''}</button>`)).join('')}</div>
      <div class="btnrow"><button class="btn" id="fgBatch">Cường hóa hàng loạt</button></div></div>
    <div class="card"><label><input type="checkbox" id="fgFuse" ${S.autoFuse === false ? '' : 'checked'}> 💎 Tự hợp Huyền Tinh từ nhẫn / dây chuyền / ngọc bội thừa (3 món → 1 Huyền Tinh, ${fmt(fuseCost())} lượng; mỗi 30 giây)</label>
      <div class="dim small">Trang sức thừa có ${fusePool().length} món. Không dùng đồ đang mặc, đồ khóa 🔒, đồ tốt hơn đồ đang mặc.</div>
      <label><input type="checkbox" id="fgAuto" ${S.autoForge ? 'checked' : ''}> Tự động rèn đồ (ghép mảnh Hoàng Kim, khảm Tím, thăng cấp Huyền Tinh; mỗi 30 giây)</label></div>`;
  document.querySelectorAll('#t-forge [data-ep]').forEach(b => b.onclick = () => epModal(b.dataset.ep));
  $('#fgHt').onclick = () => htModal(); $('#fgBatch').onclick = () => batchForgeModal();
  $('#fgFuse').onchange = e => { S.autoFuse = e.target.checked; if (S.autoFuse) { autoFuse(); renderForge(); } save(); };
  $('#fgAuto').onchange = e => { S.autoForge = e.target.checked; if (S.autoForge) autoForge(); save(); };
  document.querySelectorAll('#t-forge .invgrid [data-uid]').forEach(b => b.onclick = () => { const it = Object.values(S.eq).find(i => i && i.uid === +b.dataset.uid); if (it) forgeModal(it); });
}
/* ---------- Nhiem Vu: Da Tau, Sat Thu, nhiem vu ngay, hoat dong ---------- */
let questTab = 'dt';   // (the Nhiem vu ngay da bo)
function openQuest(t) { if (!S.fac) return; if (t) questTab = t; closeModal(true); showTab('quest'); }   // moi loi vao nhiem vu / hoat dong -> the Nhiem vu
function renderQuest() {
  const T = [['dt', '📜 Dã Tẩu'], ['boat', `⛵ Đi thuyền${boatOn() ? ' ●' : ''}`], ['st', '🗡 Sát Thủ'], ['act', 'Hoạt động']];
  let body = '';
  if (questTab === 'dt') body = dtBody();
  else if (questTab === 'st') body = stBody();
  else if (questTab === 'boat') body = boatBody();
  else body = `<div class="card"><div class="btnrow">${[['dg', 'Phó bản'], ['tower', 'Tháp thử thách'], ['wb', 'Boss tuần'], ['horse', 'Mã trường'], ['tm', 'Thần mã'], ['pet', 'Đồng hành'], ['rec', 'Kỷ lục']].map(([k, n]) => `<button class="btn" data-act="${k}">${n}</button>`).join('')}</div>
      <div class="btnrow"><button class="btn" id="qGift">🎁 Phần thưởng: điểm danh · mốc cấp · Phúc Duyên · sự kiện · thành tựu</button></div></div>`;
  $('#t-quest').innerHTML = `<div class="dtabs">${T.map(([k, n]) => `<button data-qt="${k}" class="${questTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>${body}`;
  document.querySelectorAll('#t-quest [data-qt]').forEach(b => b.onclick = () => { questTab = b.dataset.qt; renderQuest(); });
  if (questTab === 'dt') bindDt();
  if (questTab === 'boat') bindBoat($('#t-quest'));
  if (questTab === 'st') document.querySelectorAll('#t-quest [data-st]').forEach(b => b.onclick = () => { stStart(+b.dataset.st); renderQuest(); });
  document.querySelectorAll('#t-quest [data-act]').forEach(b => b.onclick = () => actModal(b.dataset.act));
  const g = $('#qGift'); if (g) g.onclick = () => giftModal(true);
}
const questDot = () => !!S.fac && !isNovice() && (((typeof DT === 'function') && DT().task && dtReady(DT().task) && !DT().auto));
const forgeDot = () => { if (!S.fac) return false; const f = forgeReadyCounts(); return !S.autoForge && f.shard + f.ench + f.up > 0; };
