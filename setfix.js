/* ======================= VA DU LIEU DO BO (Hoang Kim / Bach Kim) =======================
   Du lieu xuat tu ban web cu bi thieu o 3 cho:
   1. 330 dong Hoang Kim (138 mon Dang Long, Tinh Suong, Thuong gioi / Ha gioi...) tro toi chi so dong ma thuat (J.ge) khong ton tai
      -> dong do bi bo, mon chi con chi so goc.
   2. 500 dong Bach Kim khong co dong ma thuat nao (vd [Bach Kim] Dang Long Ngoc Hu Tu chi co Ne tranh).
   3. 3.200 dong Bach Kim (va 227 dong Hoang Kim) khong co so mon kich hoat bo (n1 / n2 = 0) -> hien "du 99 mon".
   Cach va (luc nap game, khong sua data.js):
   - Dong thieu: lay dong cung vi tri cua mon MAU = cung mon phai, cung loai trang bi, du dong, cap yeu cau cao nhat; nhan he so
     theo chenh lech cap (Dang Long 180 so voi mau 120-160: manh hon) -> tao chi so dong moi (id 100000+).
   - Bach Kim khong dong: lay dong cua mon Hoang Kim cung ten, x1.15 (Bach Kim manh hon Hoang Kim cung ten).
   - n1 / n2 = 0: lay cua bo Hoang Kim cung nhom; khong co thi 40% / 70% so mon cua bo.
   Do da roi truoc day: save.js goi setRepair() de lam lai dong cho mon thieu va sua so mon kich hoat. */
'use strict';
(function () {
  const G = JX.sets.gold, P = JX.sets.platina, GE = JX.ge;
  const req = (r, id) => (r.req.find(q => q[0] === id) || [0, -1])[1];
  const bare = n => String(n).replace(/^\[[^\]]*\]\s*/, '');
  let nid = 100000;
  const scaled = (id, k) => {                     // dong ma thuat moi = dong id nhan he so k
    const m = GE[id]; if (!m) return null; if (Math.abs(k - 1) < 0.01) return id;
    const p = m.p.map(([lo, hi]) => (lo === -1 && hi === -1 ? [lo, hi] : [Math.round(lo * k), Math.round(hi * k)]));
    GE[++nid] = { a: m.a, p }; return nid;
  };
  const ok = r => r.mag.length && r.mag.every(i => GE[i]);
  // 1. Hoang Kim thieu dong
  const complete = G.filter(ok);
  for (const r of G) {
    if (ok(r)) continue;
    const L = req(r, 36), f = req(r, 39);
    const pool = complete.filter(x => x.d === r.d && req(x, 39) === f && req(x, 36) <= L);
    const tpl = pool.sort((a, b) => req(b, 36) - req(a, 36))[0] || complete.filter(x => x.d === r.d).sort((a, b) => req(b, 36) - req(a, 36))[0];
    if (!tpl) continue;
    const k = 1 + Math.max(0, L - req(tpl, 36)) / 400;   // vd mau 120 -> mon 180: x1.15
    const src = r.mag.length ? r.mag : tpl.mag.map(() => -1);   // dong rong hoan toan (Dinh Nghiep, Dinh Quoc ban moi...): lay du dong cua mau
    r.mag = src.map((id, i) => (GE[id] ? id : scaled(tpl.mag[i % tpl.mag.length], k))).filter(id => id != null);
    if (!r.ext || !r.ext.length) r.ext = (tpl.ext || []).map(() => -1);
    r.ext = (r.ext || []).map((id, i) => (GE[id] ? id : (tpl.ext && tpl.ext.length ? scaled(tpl.ext[i % tpl.ext.length], k) : null))).filter(id => id != null);
    r.fixed = 1;
  }
  // ca bo co mon thieu du lieu JX1 -> danh dau ca bo (khong roi / khong che, sets.js setRowOk) - giu du lieu da va cho do nguoi choi da co
  const badGrp = new Set(G.filter(r => r.fixed).map(r => r.grp));
  for (const r of G) if (badGrp.has(r.grp)) r.fixed = 1;
  for (const r of P) if (badGrp.has(r.grp)) r.fixed = 1;
  // 3. so mon kich hoat bo
  const grp = {}; for (const r of G) (grp[r.grp] = grp[r.grp] || []).push(r);
  for (const g in grp) {
    const l = grp[g], src = l.find(r => r.n2 > 0 && r.n2 < 99);
    for (const r of l) if (!(r.n2 > 0 && r.n2 < 99)) { r.n1 = src ? src.n1 : Math.max(2, Math.round(l.length * 0.4)); r.n2 = src ? src.n2 : Math.max(2, Math.round(l.length * 0.7)); r.sid = r.sid || (src && src.sid) || 1; }
  }
  // 2. Bach Kim
  const gByName = {}; for (const r of G) gByName[bare(r.n)] = r;
  for (const r of P) {
    const g = gByName[bare(r.n)] || (grp[r.grp] || []).find(x => x.d === r.d);
    if (g && (!r.mag.length || !r.mag.every(i => GE[i]))) {
      r.mag = g.mag.map(id => scaled(id, 1.15)).filter(id => id != null);
      if (!r.ext || !r.ext.length || !r.ext.every(i => GE[i])) r.ext = (g.ext || []).map(id => scaled(id, 1.15)).filter(id => id != null);
      r.fixed = 1;
    }
    if (!(r.n2 > 0 && r.n2 < 99)) { const s = (grp[r.grp] || [])[0]; r.n1 = s ? s.n1 : 3; r.n2 = s ? s.n2 : 5; r.sid = r.sid || (s && s.sid) || 1; }
  }
})();
/* Mon bo da co trong file luu: so mon kich hoat sai -> sua; it dong hon du lieu da va -> gieo lai dong (giu cuong hoa, thang cap Bach Kim) */
function setRowOf(it) {
  const rows = JX.sets[it.set.kind] || [], n = String(it.n).replace(/^\[(Bạch Kim)\]\s*/, '');
  return rows.find(r => r.n === n || r.n === it.n) || rows.find(r => r.grp === it.set.grp && r.d === it.d) || null;
}
/* Mon thuoc bo khong co du lieu JX1 (hoac Phi phong) -> xoa khoi file luu (theo yeu cau) */
function setNoData(it) { if (!it || !it.set) return false; const r = setRowOf(it); return !!r && (!!r.fixed || r.d > 10); }
function setRepair(it) {
  if (!it || !it.set) return false;
  const row = setRowOf(it);
  if (!row) return false;
  let ch = false;
  if (!(it.set.n2 > 0 && it.set.n2 < 99)) { it.set.n1 = row.n1; it.set.n2 = row.n2; it.set.sid = it.set.sid || row.sid; ch = true; }
  if ((it.mag || []).length < row.mag.length) {
    const g = () => 5 + Math.floor(Math.random() * 6);   // may man 5..10 nhu do roi ra co may man trung binh
    it.mag = row.mag.map(i => geValue(i, g())).filter(Boolean); it.ext = (row.ext || []).map(i => geValue(i, g())).filter(Boolean); ch = true;
  }
  return ch;
}
