/* ======================= HE THONG CHIEU THUC JX1: bi dong · bua loi · vong sang · bua hai =======================
   Phan loai theo du lieu Skills.txt (tham so 2 cua moi thuoc tinh = so khung hieu luc, 18 khung = 1 giay):
   - Bi dong   : khong ton noi luc (thoi gian -1) -> luon co hieu luc.
   - Bua loi   : tu than (self), ton noi luc, co thoi gian (vd Kim Chung Trao 148s, Thien Ma Giai The 194s) -> tu thi trien lai khi het.
                 Thoi gian rat ngan (Tu Hang Pho Do 2s) = chieu hoi phuc tuc thi, dung khi sinh luc < 60%.
   - Vong sang : aura (Nga Mi Mong Diep, Pho Do Chung Sinh, Phat Tam Tu Huu...) -> chi 1 vong sang bat cung luc, hieu luc lien tuc.
   - Bua hai   : len quai (Thien Nhan Ao anh Phi Ho, Phi Hong Vo Tich; Ngu Doc Xich Diem Thuc Thien, Xuyen Y Pha Giap...)
                 gia tri am, giam khang / ne / chinh xac / sat thuong / toc do cua quai trong thoi gian cua chieu (vd 78s).
   Truoc day moi chieu khong tan cong deu cong thang vao nhan vat (ca bua hai -> tu tru khang chinh minh). */
'use strict';
const FPS_JX = 18;
/* Vong sang gay sat thuong (Skills.txt: IsAura, ChildSkillId 203 'Vo Hinh Doc', TimePerCast 72 khung = 4s, AttackRadius 200).
   Bang cap (script may chu wudu.lua 'wuxing_gu', khong co trong client) lay tu bang du lieu ky nang Ngu Doc cua 17173
   (news.17173.com/z/jx/jn/skill_wdu.htm, "毒攻伤害点数/次" cap 1-30): 1 1 1 1 2 2 2 2 2 3 3 3 3 3 4 4 4 4 4 5 5 5 5 5 6 6 6 6 6 7.
   Thoi gian / chu ky doc lay nhu cac chieu doc khac cua Ngu Doc (60 khung, moi 10 khung) -> tinh qua activeInfo nhu moi chieu doc
   (Noi cong, cuong hoa doc, bac ky nang...). */
const WXG_POISON = [1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7];
const AURA_DMG = { 69: { el: 'poison', every: 72 / 18, rad: 200, tab: WXG_POISON, col: '#8fe34a' } };
const auraSkill = id => { const A = AURA_DMG[id]; return A.sk || (A.sk = Object.assign({}, SK[id], { aura: 0, attr: { poisondamage_v: A.tab.map(v => [v, 60, 10]) } })); };
const auraHit = (id, L) => { const A = AURA_DMG[id], k = Math.min(L, A.tab.length); return R.P ? ((activeInfo(R.P, auraSkill(id), k).parts || {})[A.el] || 0) : 0; };
const hasCost = s => !!(s.attr && s.attr.skill_cost_v);
function skKind(s) {
  if (!s) return 'none';
  if (isAttack(s)) return 'atk';
  if (s.aura) return Object.keys(s.attr || {}).length || AURA_DMG[s.id] ? 'aura' : 'none';
  if (!hasCost(s)) return 'passive';
  if (s.enemy) return 'curse';
  return 'buff';
}
const SK_KIND_VI = { atk: 'Tấn công', passive: 'Bị động', buff: 'Bùa lợi', aura: 'Vòng sáng', curse: 'Bùa hại', none: '—' };
/* thoi gian hieu luc (giay) o cap L: lay tham so 2 lon nhat cua cac thuoc tinh co thoi gian */
function skDur(s, L) {
  let f = 0; for (const n in s.attr) { if (/^(skill_|missle_|addskill)/.test(n)) continue; const p = skVal(s, n, L); if (p && p[1] > f) f = p[1]; }
  return f > 0 ? f / FPS_JX : 0;
}
const skCost = (s, L) => ((skVal(s, 'skill_cost_v', L) || [0])[0]) || 0;
const SKS = () => R.sks || (R.sks = { buff: {}, cd: {} });   // trang thai tran: bua loi dang co (het han theo R.clock)
const clk = () => R.clock || 0;
const buffOn = id => (SKS().buff[id] || 0) > clk() && !!S.sk[id];
/* vong sang: bat cung luc moi vong sang da hoc (tat rieng tung cai: S.auraOff) */
const auraList = () => Object.keys(S.sk || {}).filter(id => S.sk[id] && SK[id] && skKind(SK[id]) === 'aura' && !(S.auraOff || {})[id]).map(Number);
const auraOn = id => auraList().includes(+id);
function auraActive() { return auraList()[0] || 0; }
/* vong sang sat thuong: dang bat, moi 'every' giay danh 1 nhip */
const auraT = {};
function auraDmgTick(dt) { for (const id of auraList()) if (AURA_DMG[id]) auraDmg1(id, dt); }
function auraDmg1(id, dt) {
  const A = AURA_DMG[id]; if (!A || !R.P || !R.P.main || R.town || R.deadT > 0) return;
  if ((auraT[id] = (auraT[id] || 0) - dt) > 0) return; auraT[id] = A.every;
  const L = (S.sk[id] || 1) + (R.P.plusSkill || 0), hit = auraHit(id, L); if (!(hit > 0)) return;
  const tg = R.enemies.filter(e => !e.dead && e.hp > 0 && Math.hypot(e.x - H.x, e.y - H.y) <= A.rad); if (!tg.length) return;
  const ser = heroSeries();
  for (const e of tg) {
    const cm = curseMod(e), res = cm ? Object.fromEntries(ELEM.map(x => [x, e.res[x] + (cm.res[x] || 0)])) : e.res;
    let d = applyPart(hit * rnd(0.9, 1.1) * (cm && cm.poison ? 1 + cm.poison / 100 : 1), A.el, ser, e.series, res, 75, R.P.series5 || 0);
    if (A.el === 'poison') { const left = e.poison > 0 ? e.poisonDmg * e.poison : 0; e.poisonDmg = (left + d) / POISON_TIME; e.poison = POISON_TIME; }
    else e.hp -= d;
  }
}
/* calc(): chieu khong tan cong nao duoc cong vao nhan vat luc nay */
function skApplies(s) {
  const k = skKind(s);
  if (k === 'passive') return true;
  if (k === 'aura') return auraOn(s.id);
  if (k === 'buff') return buffOn(s.id) || !!R.buffAssume;             // goi y cong diem: coi nhu bua loi dang bat
  return false;                                                          // bua hai: chi tac dung len quai
}
/* ---------- tu thi trien ---------- */
let skT = 0;
function skillSysTick(dt) {
  auraDmgTick(dt);
  skT -= dt; if (skT > 0) return; skT = 0.5;
  if (!S.fac || !R.P || R.deadT > 0 || R.town) return;
  const now = clk(), st = SKS(); let changed = false;
  for (const id in st.buff) if (st.buff[id] <= now && st.buff[id] > 0) { st.buff[id] = 0; changed = true; }
  const fight = R.enemies.some(e => !e.dead);
  for (const id in S.sk) {
    const s = SK[id], L = (S.sk[id] || 0); if (!L) continue;
    const k = skKind(s); if (k !== 'buff' && k !== 'curse') continue;
    if (k === 'buff' && S.autoBuff === false) continue;
    if (k === 'curse' && S.autoCurse === false) continue;
    const Lv = L + (R.P.plusSkill || 0), cost = skCost(s, Lv), dur = skDur(s, Lv);
    if (R.mana < cost + R.P.mana * 0.15) continue;                       // chua noi luc cho chieu danh
    if (k === 'buff') {
      if (buffOn(id)) continue;
      if (dur < 5) {                                                      // hoi phuc tuc thi (Tu Hang Pho Do)
        if (!(fight && R.life < R.P.life * 0.6) || (st.cd[id] || 0) > now) continue;
        const p = skVal(s, 'lifereplenish_v', Lv); R.mana -= cost; heal((p ? p[0] : 0) * dur * 2, false); st.cd[id] = now + 8;
        addText(H.x, H.y - 60, '✚ ' + s.n, '#8f8', 12); continue;
      }
      R.mana -= cost; st.buff[id] = now + dur; changed = true;
      if (typeof uiSfx === 'function') uiSfx('use');
    } else if (fight) {
      const tgts = R.enemies.filter(e => !e.dead && !((e.curse || {})[id] > now)).sort((a, b) => (b.cls === 'boss') - (a.cls === 'boss') || (b.cls === 'elite') - (a.cls === 'elite') || Math.hypot(a.x - H.x, a.y - H.y) - Math.hypot(b.x - H.x, b.y - H.y));
      const e = tgts[0]; if (!e || Math.hypot(e.x - H.x, e.y - H.y) > 420) continue;
      if (e.cls === 'normal' && R.enemies.filter(x => !x.dead).length < 3) continue;   // quai thuong le te: khong ton bua
      R.mana -= cost; const c = e.curse || (e.curse = {}); c[id] = now + Math.min(dur, 60);
      if (typeof castFx === 'function') castFx({ id: +id });   // hinh luc bat bua (PreCastSpr)
      // bua hai pham vi (Ngu Doc / Thien Nhan): trung them quai dung gan muc tieu
      for (const o of R.enemies) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < 120) (o.curse || (o.curse = {}))[id] = now + Math.min(dur, 60);
    }
  }
  if (changed) R.dirty = true;
}
/* ---------- bua hai: tong hop tac dung tren 1 quai ---------- */
function curseMod(e) {
  const c = e.curse; if (!c) return null;
  const now = clk(), m = { res: {}, def: 0, ar: 0, dmg: 0, ret: 0, slow: 0, regen: 0, poison: 0, crit: 0 }; let any = false;
  for (const id in c) {
    if (c[id] <= now) continue; const s = SK[id], L = (S.sk[id] || 1) + ((R.P && R.P.plusSkill) || 0); if (!s) continue; any = true;
    for (const n in s.attr) {
      if (/^(skill_|missle_|addskill)/.test(n)) continue; const p = skVal(s, n, L); if (!p) continue; const v = p[0];
      if (n === 'allres_p') for (const el of ELEM) m.res[el] = (m.res[el] || 0) + v;
      else if (/res_p$/.test(n)) { const el = n.startsWith('physics') ? 'phys' : n.startsWith('lighting') ? 'light' : n.replace('res_p', ''); m.res[el] = (m.res[el] || 0) + v; }
      else if (n === 'adddefense_v') m.def += v;
      else if (n === 'attackratingenhance_p') m.ar += v;
      else if (n === 'addphysicsdamage_p') m.dmg += v;
      else if (n === 'meleedamagereturn_p') m.ret += -v;               // Hoa Lien Phan Hoa: quai danh can chien bi phan lai
      else if (n === 'fasthitrecover_v') m.slow += -v;
      else if (n === 'lifereplenish_v') m.regen += v;
      else if (n === 'poisontimereduce_p') m.poison += -v;
      else if (n === 'deadlystrikeenhance_p') m.crit += v;
    }
  }
  return any ? m : null;
}
const isCursed = e => !!curseMod(e);
/* ---------- giao dien Vo cong: dong trang thai ---------- */
function skStateTag(s) {
  const k = skKind(s), L = S.sk[s.id] || 0;
  if (k === 'buff') { const d = skDur(s, Math.max(1, L)); return d < 5 ? `<span class="tag buff">Hồi phục</span>` : `<span class="tag buff">Bùa lợi ${Math.round(d)}s</span>${L && buffOn(s.id) ? ` <small class="cp">đang có ${Math.ceil(SKS().buff[s.id] - clk())}s</small>` : ''}`; }
  if (k === 'aura' && AURA_DMG[s.id]) return `<span class="tag aura">Vòng sáng độc</span> <small class="dim">mỗi ${AURA_DMG[s.id].every}s phủ độc quái trong ${AURA_DMG[s.id].rad} · độc ${AURA_DMG[s.id].tab[Math.min(Math.max(1, L + ((R.P && R.P.plusSkill) || 0)), 30) - 1]} điểm/lần → ~${fmt(auraHit(s.id, Math.max(1, L + ((R.P && R.P.plusSkill) || 0))))}/nhịp</small>${L ? (auraActive() === s.id ? ' <small class="cp">● đang bật</small>' : ` <button class="btn sm" data-aura="${s.id}">Bật</button>`) : ''}`;
  if (k === 'aura') return `<span class="tag aura">Vòng sáng</span>${L ? (auraOn(s.id) ? ` <small class="cp">● đang bật</small> <button class="btn sm" data-aura="${s.id}">Tắt</button>` : ` <button class="btn sm" data-aura="${s.id}">Bật</button>`) : ''}`;
  if (k === 'curse') return `<span class="tag curse">Bùa hại ${Math.round(Math.min(60, skDur(s, Math.max(1, L))))}s</span>`;
  if (k === 'passive') return '<span class="tag">Bị động</span>';
  return '';
}
function bindSkState(root) {
  root.querySelectorAll('[data-aura]').forEach(b => b.onclick = e => { e.stopPropagation(); const id = b.dataset.aura, off = S.auraOff || (S.auraOff = {}); if (off[id]) delete off[id]; else off[id] = 1; R.dirty = true; recalc(); save(); toast(`${off[id] ? 'Tắt' : 'Bật'} vòng sáng: ${SK[id].n}`); refresh(); });
}
function skOptsHTML() {
  return `<label><input type="checkbox" id="cBuff" ${S.autoBuff === false ? '' : 'checked'}> Tự thi triển bùa lợi khi hết thời gian (tốn nội lực)</label>
    <label><input type="checkbox" id="cCurse" ${S.autoCurse === false ? '' : 'checked'}> Tự thi triển bùa hại lên trùm, tinh anh hoặc đám từ 3 quái</label>`;
}
function bindSkOpts() {
  const b = $('#cBuff'), c = $('#cCurse');
  if (b) b.onchange = () => { S.autoBuff = b.checked; save(); };
  if (c) c.onchange = () => { S.autoCurse = c.checked; save(); };
}
/* thanh bieu tuong trang thai kieu JX1 (goc trai tren): icon + thoi gian con lai (N/A = vong sang / vinh vien) */
const BUF_ITEM_IC = { tt: 'img/ep/tt.png', luck: 'img/ep/qht.png', xp: 'img/ep/fd.png', drop: 'img/ep/mys.png' };
const fmtLeft = s => s < 0 ? 'N/A' : s >= 3600 ? Math.floor(s / 3600) + 'h' : s >= 60 ? Math.floor(s / 60) + 'm' : Math.ceil(s) + 's';
function stateIcons() {
  const out = [];
  if (newbieOn()) out.push({ ic: 'img/ep/tanthu.png', t: -1, n: `Hỗ Trợ Tân Thủ: mỗi giây hồi ${NEWBIE_REGEN.life * 100}% sinh lực, ${NEWBIE_REGEN.mana * 100}% nội lực, +${NEWBIE_XP * 100}% kinh nghiệm (đến cấp ${NEWBIE_LV})` });
  for (const a of auraList()) out.push({ ic: SK[a].ic, t: -1, n: 'Vòng sáng: ' + SK[a].n });
  const now = clk(); for (const id in SKS().buff) if (SKS().buff[id] > now && SK[id] && S.sk[id]) out.push({ ic: SK[id].ic, t: SKS().buff[id] - now, n: SK[id].n });
  const tn = Date.now(); for (const k in (S.buf || {})) { const b = S.buf[k]; if (b && b.until > tn && BUFF_VI[k]) out.push({ ic: BUF_ITEM_IC[k] || 'img/ep/fd.png', t: (b.until - tn) / 1000, n: `${BUFF_VI[k]} +${k === 'luck' ? Math.round(b.p) : Math.round(b.p * 100) + '%'}` }); }
  return out;
}
