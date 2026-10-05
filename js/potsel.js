/* ======================= THUOC: o vat pham 1 / 2 chon loai thuoc (potion.txt: Thua Tien Mat, That Xao Bo Tam Dan, Ngu Hoa Ngoc Lo Hoan hoi ca sinh luc lan noi luc) ======================= */
'use strict';
const BOTH_POTS = [   // potion.txt: tong = gia tri x so khung / 10, thoi gian = so khung / 18
  { n: 'Thừa Tiên Mật (tiểu)', kind: 'both', total: 100, dur: 5.6, mtotal: 60, mdur: 5.6, price: 80, tier: 1, ic: 'img/i/potb1.png' },
  { n: 'Thừa Tiên Mật (trung)', kind: 'both', total: 250, dur: 5.6, mtotal: 150, mdur: 13.9, price: 150, tier: 2, ic: 'img/i/potb1.png' },
  { n: 'Thừa Tiên Mật (đại)', kind: 'both', total: 500, dur: 11.1, mtotal: 300, mdur: 11.1, price: 750, tier: 3, ic: 'img/i/potb3.png' },
  { n: 'Thất Xảo Bổ Tâm Đan', kind: 'both', total: 1000, dur: 11.1, mtotal: 600, mdur: 11.1, price: 1500, tier: 4, ic: 'img/i/potb3.png' },
  { n: 'Ngũ Hoa Ngọc Lộ Hoàn', kind: 'both', total: 5000, dur: 5.6, mtotal: 5000, mdur: 5.6, price: 3000, tier: 5, ic: 'img/i/potb5.png' },
];
if (!J.potions.some(p => p.kind === 'both')) J.potions.push(...BOTH_POTS);
if (J.shops && J.shops.med && !J.shops.med.items.some(g => g.g === 1 && g.d === 2)) for (const p of BOTH_POTS) J.shops.med.items.push({ g: 1, d: 2, k: 0, lvl: p.tier, price: p.price });
const potKey = p => p.kind + ':' + p.tier;
const potByKey = k => J.potions.find(p => potKey(p) === k) || null;
const potOpen = p => S.lvl >= (POT_TIER_LV[p.tier] || 999);
const SLOT_KIND = ['life', 'mana'];
function potSlots() { if (!Array.isArray(S.potSlot)) S.potSlot = ['auto', 'auto']; return S.potSlot; }
const slotPot = i => { const k = potSlots()[i]; return k && k !== 'auto' ? potByKey(k) : null; };
/* thuoc se uong cho o i: thuoc da chon (trong tui truoc, khong co thi mua) hoac tu chon tot nhat */
function slotPick(i) {
  const kind = SLOT_KIND[i], p = slotPot(i);
  if (p) {
    const st = potStock(p.kind);
    if ((st[p.tier] || 0) > 0) { st[p.tier]--; return { p, free: true }; }
    if (potOpen(p) && potPrice(p) <= S.gold) return { p, free: false };
  }
  const own = takeStock(kind), b = own || bestPotion(kind);
  return b ? { p: b, free: !!own } : null;
}
/* bieu tuong + so luong hien tren o */
function slotShow(i) {
  const p = slotPot(i), kind = SLOT_KIND[i];
  if (p) return { ic: p.ic, n: potStock(p.kind)[p.tier] || 0, name: p.n };
  const st = potStock(kind), tier = Math.max(0, ...Object.keys(st).filter(t => st[t] > 0).map(Number));
  const b = (tier && J.potions.find(x => x.kind === kind && x.tier === tier)) || bestPotion(kind) || J.potions.find(x => x.kind === kind);
  return { ic: b ? b.ic : '', n: stockCount(kind), name: 'Tự động: ' + (b ? b.n : '') };
}
function potSlotModal(i) {
  const kind = SLOT_KIND[i], cur = potSlots()[i];
  const list = J.potions.filter(p => p.kind === kind || p.kind === 'both').sort((a, b) => (a.kind === 'both') - (b.kind === 'both') || a.tier - b.tier);
  const row = p => { const ok = potOpen(p), n = potStock(p.kind)[p.tier] || 0;
    return `<button class="shoprow${ok ? '' : ' bad'}${cur === potKey(p) ? ' own' : ''}" data-pk="${potKey(p)}" ${ok ? '' : 'disabled'}><img src="${esc(p.ic)}" alt=""><span><b>${esc(p.n)}</b><small>Hồi ${fmt(p.total)} ${p.kind === 'mana' ? 'nội lực' : 'sinh lực'}${p.kind === 'both' ? ` + ${fmt(p.mtotal)} nội lực` : ''} · ${ok ? `${fmt(potPrice(p))} lượng / bình · trong túi ${n}` : `cần cấp ${POT_TIER_LV[p.tier]}`}</small></span></button>`; };
  modal(`<h3>Ô ${i + 1}: chọn thuốc</h3>
    <div class="shoplist"><button class="shoprow${cur === 'auto' ? ' own' : ''}" data-pk="auto"><span><b>Tự động</b><small>Thuốc ${kind === 'life' ? 'sinh lực' : 'nội lực'} tốt nhất mua được</small></span></button>${list.map(row).join('')}</div>`, () => {
    document.querySelectorAll('#mBody [data-pk]').forEach(b => b.onclick = () => { potSlots()[i] = b.dataset.pk; R.dirty = true; save(); closeModal(true); if (typeof curTab !== 'undefined' && curTab === 'more') refresh(); toast(`Ô ${i + 1}: ${b.dataset.pk === 'auto' ? 'Tự động' : potByKey(b.dataset.pk).n}`); const el = i ? $('#bMp') : $('#bHp'); if (el) el._k = ''; });
  });
}
