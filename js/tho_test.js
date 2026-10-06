/* ======================= VIỆT★ (TEST) — nhân Việt riêng thay Thổ★ =======================
   Clone skill Võ Đang + Côn Lôn (id 9000+). Hình: VIET_CHAR (pack Kiếm Hiệp + sheet recolor).
   Chi tai khoan admin nhin / choi duoc. */
'use strict';
(function () {
  const SRC = ['wudang', 'kunlun'];
  const BASE = 9000;
  const SER = 5;
  const MAP = Object.create(null);   // oldId -> newId
  const deep = x => JSON.parse(JSON.stringify(x));
  const VC = window.VIET_CHAR || null;

  const canSeeThoTest = () => typeof isAdmin === 'function' && isAdmin();
  const isThoTestFac = f => !!(f && f.test);
  const facVisible = f => !isThoTestFac(f) || canSeeThoTest();
  window.canSeeThoTest = canSeeThoTest;
  window.isThoTestFac = isThoTestFac;
  window.facVisible = facVisible;
  window.THO_TEST_SERIES = SER;
  window.THO_TEST_ID_BASE = BASE;
  window.VIET_CHAR_SERIES = SER;
  window.thoTestId = id => (MAP[+id] || (+id >= BASE ? +id : 0));
  window.thoTestMap = MAP;

  /* Hệ Việt★ thay nhãn Thổ★ cũ */
  const SER_NAME = (VC && VC.series) || 'Việt★';
  const SER_COL = (VC && VC.seriesCol) || '#d4a017';
  const SER_DESC = (VC && VC.seriesDesc) || 'Admin · nhân Việt riêng (Yên Tử★ · Bạch Đằng★)';
  if (SERIES.length <= SER) SERIES.push(SER_NAME);
  else SERIES[SER] = SER_NAME;
  if (SERIES_COL.length <= SER) SERIES_COL.push(SER_COL);
  else SERIES_COL[SER] = SER_COL;
  if (typeof SERIES_DESC !== 'undefined') {
    if (SERIES_DESC.length <= SER) SERIES_DESC.push(SER_DESC);
    else SERIES_DESC[SER] = SER_DESC;
  }
  if (!J.levelAdd[SER]) J.levelAdd[SER] = deep(J.levelAdd[4]);
  /* start stats: copy Tho nam/nu (cùng hệ ngũ hành Thổ) */
  if (J.start.length < 12) {
    const m = deep(J.start[8]), f = deep(J.start[9]);
    m.series = SER; f.series = SER;
    J.start.push(m, f);
  }

  /* --- clone moi skill thuoc wudang / kunlun --- */
  const own = [];
  for (const id of Object.keys(SK)) {
    const s = SK[id];
    if (s && SRC.includes(s.f)) own.push(+s.id);
  }
  own.sort((a, b) => a - b);
  for (const id of own) MAP[id] = BASE + id;

  for (const id of own) {
    const src = SK[id] || SK[String(id)];
    if (!src) continue;
    const nid = MAP[id];
    const s = deep(src);
    s.id = nid;
    s.f = src.f + '_t';
    if (s.series === 4) s.series = SER;
    if (s.child && MAP[s.child]) s.child = MAP[s.child];
    /* remap addskilldamage* / skill id refs trong attr (tham so 1 neu la skill id cua he Tho) */
    if (s.attr) {
      for (const k of Object.keys(s.attr)) {
        if (!/addskilldamage|skill_eventskilllevel|skill_appendskill|addskill/.test(k)) continue;
        const rows = s.attr[k];
        if (!Array.isArray(rows)) continue;
        s.attr[k] = rows.map(row => {
          if (!Array.isArray(row)) return row;
          const out = row.slice();
          if (MAP[out[0]]) out[0] = MAP[out[0]];
          if (MAP[out[2]]) out[2] = MAP[out[2]];
          return out;
        });
      }
    }
    SK[nid] = s;
    SK[String(nid)] = s;
    J.skills[nid] = s;
    J.skills[String(nid)] = s;
    /* Vo cong 90 Test: mo thang — khong can cap 80 / Mat Tich */
    if (s.learn === '90' || s.tier === 90 || s.book === 'bk90') {
      s.req = 1; s.tier = 90; s.learn = '90'; delete s.book;
    }
  }

  /* Remap nhanh ho tro 90 (Tuy Tien Ta Cot → id Test) */
  if (typeof SK9_BRANCH !== 'undefined') {
    for (const oid of Object.keys(SK9_BRANCH)) {
      const nid = MAP[+oid]; if (!nid) continue;
      SK9_BRANCH[nid] = SK9_BRANCH[oid].map(x => MAP[x] || x);
    }
  }

  /* --- factions Việt★ --- */
  const srcFac = Object.fromEntries(J.factions.map(f => [f.key, f]));
  const facNames = (VC && VC.factions) || {};
  const clones = [
    { key: 'wudang_t', src: 'wudang', id: 108, n: (facNames.wudang_t && facNames.wudang_t.n) || 'Yên Tử★', camp: 'C_JUSTICE' },
    { key: 'kunlun_t', src: 'kunlun', id: 109, n: (facNames.kunlun_t && facNames.kunlun_t.n) || 'Bạch Đằng★', camp: 'C_BALANCE' },
  ];
  for (const c of clones) {
    const o = srcFac[c.src];
    if (!o || FAC[c.key]) continue;
    const f = {
      id: c.id, key: c.key, n: c.n, series: SER, camp: o.camp || c.camp,
      skills: (o.skills || []).map(id => MAP[id] || id),
      test: 1, srcKey: c.src, srcId: o.id, viet: 1,
    };
    J.factions.push(f);
    FACTIONS.push(f);
    FAC[c.key] = f;
    /* starter + wcode nhu core.js */
    const first = f.skills.map(id => SK[id]).filter(s => s && s.enemy && ['physicsenhance_p', 'physicsdamage_v', 'poisondamage_v', 'colddamage_v', 'firedamage_v', 'lightingdamage_v'].some(a => s.attr && s.attr[a])).sort((a, b) => a.req - b.req || a.id - b.id);
    if (first.length) { first[0].req = 1; f.starter = first[0].id; }
    const mastery = f.skills.map(id => SK[id]).filter(s => s && !s.enemy && s.attr && s.attr.addphysicsdamage_p).sort((a, b) => a.req - b.req || a.id - b.id)[0];
    const a = mastery && mastery.attr.addphysicsdamage_p[0];
    f.wcode = Array.isArray(a) && [0, 1, 2, 3, 4, 5, 7, 9].includes(a[2]) ? a[2] : (o.wcode != null ? o.wcode : -1);
  }
  FAC['vo' + SER] = { key: 'vo' + SER, n: 'Vô Môn Phái', series: SER, skills: [], wcode: -1, id: -1, novice: true, test: 1, viet: 1 };

  /* --- hinh nhan vat Viet★ rieng (VIET_CHAR) / danh hieu / can bang --- */
  if (typeof W !== 'undefined') {
    W.anim = W.anim || {};
    if (VC && VC.anims) {
      for (const [k, v] of Object.entries(VC.anims)) W.anim[k] = deep(v);
    }
    W.hero = W.hero || {};
    const applyHero = (facKey, fallbackSrc) => {
      const h = VC && VC.heroes && VC.heroes[facKey];
      if (h) {
        /* Sheet 8 hướng (tay/chân chuyển như NV gốc) — không dùng pose đứng 1 khung */
        W.hero[facKey] = { img: h.img, sz: (h.sz || []).slice(), anim: h.anim };
      } else if (W.hero[fallbackSrc]) {
        W.hero[facKey] = deep(W.hero[fallbackSrc]);
      }
    };
    applyHero('wudang_t', 'wudang');
    applyHero('kunlun_t', 'kunlun');
  }
  if (typeof CAMP !== 'undefined') { CAMP.wudang_t = 'chinh'; CAMP.kunlun_t = 'trung'; }
  if (typeof FAC_SHORT !== 'undefined') {
    FAC_SHORT.wudang_t = (facNames.wudang_t && facNames.wudang_t.short) || 'Yên Tử★';
    FAC_SHORT.kunlun_t = (facNames.kunlun_t && facNames.kunlun_t.short) || 'Bạch Đằng★';
  }
  if (typeof POWER_RAW !== 'undefined') {
    if (POWER_RAW.wudang) POWER_RAW.wudang_t = POWER_RAW.wudang.slice();
    if (POWER_RAW.kunlun) POWER_RAW.kunlun_t = POWER_RAW.kunlun.slice();
  }
  if (typeof FAC_DMG_NORM !== 'undefined') {
    if (FAC_DMG_NORM.wudang) FAC_DMG_NORM.wudang_t = FAC_DMG_NORM.wudang.slice();
    if (FAC_DMG_NORM.kunlun) FAC_DMG_NORM.kunlun_t = FAC_DMG_NORM.kunlun.slice();
  }

  /* Tắt JX ghép bộ phận khi chơi Việt★ — hiện đúng sprite nhân Việt riêng (jxOn trong jxparts.js đọc f.viet) */
  const isVietTestFac = key => {
    const f = FAC[key];
    return !!(f && f.test && (f.viet || f.series === SER));
  };
  window.isVietTestFac = isVietTestFac;

  /* --- FX / trang thai / bang phu --- */
  const copyKey = (obj, from, to) => {
    if (!obj) return;
    const v = obj[from] != null ? obj[from] : obj[String(from)];
    if (v == null) return;
    obj[to] = typeof v === 'object' ? deep(v) : v;
    obj[String(to)] = obj[to];
  };
  const JFX = window.JFX, JXST = window.JXST;
  for (const id of own) {
    const nid = MAP[id];
    if (JFX) {
      copyKey(JFX.f, id, nid);
      copyKey(JFX.s, id, nid);
      copyKey(JFX.g, id, nid);
    }
    if (JXST) copyKey(JXST, id, nid);
    if (typeof EV2 !== 'undefined' && EV2[id]) EV2[nid] = deep(EV2[id]);
    if (typeof SK_TRIM !== 'undefined' && SK_TRIM[id] != null) SK_TRIM[nid] = SK_TRIM[id];
    if (typeof HORSE_LIM !== 'undefined' && HORSE_LIM[id]) HORSE_LIM[nid] = HORSE_LIM[id];
    if (typeof JM_SHADOW !== 'undefined' && JM_SHADOW[id]) JM_SHADOW[nid] = JM_SHADOW[id];
    if (typeof NPC_SK_R !== 'undefined' && NPC_SK_R[id] != null) NPC_SK_R[nid] = NPC_SK_R[id];
  }
  /* EV2 Thai Cuc for remapped 368/215/163 */
  if (typeof EV2 !== 'undefined') {
    for (const id of [163, 215, 368]) if (MAP[id] && !EV2[MAP[id]] && EV2[id]) EV2[MAP[id]] = deep(EV2[id]);
  }

  /* --- Tu dung FX Test: recolor + doi form (THO_TEST_FX tu tools/tho_test_fx.py) --- */
  const TFX = window.THO_TEST_FX;
  const facOf = id => { const s = SK[id]; return s && String(s.f || '').endsWith('_t') ? (s.f.startsWith('wudang') ? 'wd' : s.f.startsWith('kunlun') ? 'kl' : null) : null; };
  const FORM_FLIP = { 1: 6, 6: 1, 2: 1, 8: 12, 12: 1, 3: 6, 7: 6 };
  if (TFX && JFX) {
    /* dang ky missile recolor */
    for (const fac of ['wd', 'kl']) {
      const pack = (TFX.mids || {})[fac] || {};
      for (const mid of Object.keys(pack)) {
        const row = pack[mid], nid = row.id, m = deep(row.m);
        JFX.m[nid] = m; JFX.m[String(nid)] = m;
      }
      /* precast rieng */
      const prePath = (TFX.pre || {})[fac];
      if (prePath && JFX.c) {
        const key = 'tt_' + fac;
        const base = JFX.c['4'] || JFX.c[4] || { n: 5, d: 1, w: 111, h: 124, ax: 54, ay: 76, ms: 80 };
        JFX.c[key] = Object.assign(deep(base), { f: prePath, ms: fac === 'wd' ? 70 : 95 });
      }
    }
    for (const id of own) {
      const nid = MAP[id], fac = facOf(nid); if (!fac) continue;
      const pack = (TFX.mids || {})[fac] || {};
      const f = JFX.f[nid] || (JFX.f[nid] = {});
      let mid = f.c != null ? f.c : JFX.s[nid];
      if (mid != null && pack[String(mid)]) {
        const nm = pack[String(mid)].id;
        f.c = nm; JFX.s[nid] = nm; JFX.s[String(nid)] = nm;
      }
      if ((TFX.pre || {})[fac]) f.pre = 'tt_' + fac;
      /* doi form / so dan — nhin khac ban Tho that */
      if (f.form != null && FORM_FLIP[f.form] != null) f.form = FORM_FLIP[f.form];
      else if (f.form == null && SK[nid] && SK[nid].form) f.form = FORM_FLIP[SK[nid].form] || SK[nid].form;
      if (f.num != null) f.num = Math.min(8, Math.max(1, (+f.num || 1) + (fac === 'wd' ? 1 : 0)));
      if (JFX.g && JFX.g[nid]) {
        const g = JFX.g[nid] = deep(JFX.g[nid]);
        if (Array.isArray(g) && g.length) g[0] = FORM_FLIP[g[0]] != null ? FORM_FLIP[g[0]] : g[0];
      }
      if (SK[nid] && SK[nid].form != null && FORM_FLIP[SK[nid].form] != null) SK[nid].form = FORM_FLIP[SK[nid].form];
      /* trang thai recolor */
      const stPack = (TFX.states || {})[fac] || {};
      if (JXST && stPack[String(id)]) {
        JXST[nid] = deep(stPack[String(id)]);
        JXST[String(nid)] = JXST[nid];
      } else if (JXST && JXST[nid] && TFX.map && TFX.map[fac] && TFX.map[fac][JXST[nid].f]) {
        JXST[nid] = deep(JXST[nid]);
        JXST[nid].f = TFX.map[fac][JXST[nid].f];
        JXST[String(nid)] = JXST[nid];
      }
      JFX.f[nid] = f; JFX.f[String(nid)] = f;
    }
  }

  /* --- khoa UI: chi admin thay he / phai Test --- */
  const visibleSeries = () => SERIES.map((_, i) => i).filter(i => i !== SER || canSeeThoTest());
  window.visibleSeries = visibleSeries;

  /* Cap vo cong 90 Test ngay khi vao phai / load save */
  function thoTestUnlock90(facKey) {
    const f = FAC[facKey]; if (!f || !f.test || f.novice || !S) return 0;
    let n = 0;
    const t = typeof SKL === 'function' ? SKL() : (S.skL || (S.skL = {}));
    for (const id of f.skills || []) {
      const s = SK[id]; if (!s || s.tier !== 90) continue;
      s.req = 1; delete s.book;
      if (!(S.sk[id] > 0)) {
        /* Test: mo ca nhanh tan cong + ho tro 90 (Tuy Tien…) ngay cap 1 */
        S.sk[id] = 1; n++;
        if (!(typeof isBr90 === 'function' && isBr90(id))) {
          if (!t[id]) t[id] = { lv: 1, xp: 0 };
          else S.sk[id] = Math.max(1, t[id].lv || 1);
        }
      }
    }
    if (n) { R.dirty = true; if (typeof log === 'function') log(`⚡ Việt★: mở <b>${n}</b> võ công 90 (không cần Mật Tịch).`); }
    return n;
  }
  window.thoTestUnlock90 = thoTestUnlock90;

  /* Dam bao cam dung loai vu khi phai (kiem VD / dao CL) — sau join, doi phai, load save.
     Côn Lôn đao bậc 2 cần Sức mạnh 30 trong khi Thổ★ chỉ có 20 gốc → phải cộng điểm trước rồi mới mặc. */
  function thoTestEnsureWeapon(facKey) {
    const f = FAC[facKey || (S && S.fac)]; if (!f || !f.test || f.novice || !S) return false;
    const fits = it => it && it.d <= 1 && typeof weaponFits === 'function' && weaponFits(it);
    const wear = it => fits(it) && typeof reqOk === 'function' && reqOk(it);
    if (wear(S.eq && S.eq.weapon)) return false;
    let w = (S.inv || []).find(fits) || (S.eq && fits(S.eq.weapon) ? S.eq.weapon : null);
    if (!w && typeof makeItem === 'function' && typeof facWeaponDP === 'function') {
      const dp = facWeaponDP(f), lv = typeof clamp === 'function' ? clamp(Math.round(S.lvl / 12) + 1, 1, 10) : Math.max(1, Math.min(10, Math.round(S.lvl / 12) + 1));
      w = makeItem(dp[0], dp[1], lv, 0);
      if (w) { S.inv = S.inv || []; S.inv.unshift(w); if (typeof invDirty !== 'undefined') invDirty = true; }
    }
    if (!w || !fits(w) || typeof equip !== 'function') return false;
    /* Cong diem tiem nang TRUOC khi kiem reqOk (dao CL can Str 30 > goc Tho 20) */
    if (typeof reqDeficit === 'function' && (S.attrPts || 0) > 0) {
      const d = reqDeficit(w);
      for (const k in d) { const n = Math.min(d[k], S.attrPts); if (n > 0) { S.attr[k] = (S.attr[k] || 0) + n; S.attrPts -= n; } }
    }
    if (wear(w)) { equip(w, true); R.dirty = true; return true; }
    return false;
  }
  window.thoTestEnsureWeapon = thoTestEnsureWeapon;

  /* chan doi phai / join sang Test neu khong phai admin */
  const _joinFaction = typeof joinFaction === 'function' ? joinFaction : null;
  if (_joinFaction) {
    joinFaction = function (key) {
      const f = FAC[key];
      if (f && f.test && !canSeeThoTest()) { toast('Chỉ tài khoản admin'); return; }
      const r = _joinFaction(key);
      if (FAC[key] && FAC[key].test) { thoTestUnlock90(key); thoTestEnsureWeapon(key); }
      return r;
    };
  }
  const _changeFaction = typeof changeFaction === 'function' ? changeFaction : null;
  if (_changeFaction) {
    changeFaction = function (key) {
      const f = FAC[key];
      if (f && f.test && !canSeeThoTest()) { toast('Chỉ tài khoản admin'); return; }
      const r = _changeFaction(key);
      if (FAC[key] && FAC[key].test) { thoTestUnlock90(key); thoTestEnsureWeapon(key); }
      return r;
    };
  }
  const _createCharacter = typeof createCharacter === 'function' ? createCharacter : null;
  if (_createCharacter) {
    createCharacter = function (name, sex, series) {
      if (series === SER && !canSeeThoTest()) { toast('Chỉ tài khoản admin'); return; }
      return _createCharacter(name, sex, series);
    };
  }

  /* neu load save he Test ma khong phai admin → khoa choi */
  window.thoTestGuardSlot = function (fac) {
    const f = FAC[fac];
    if (f && f.test && !canSeeThoTest()) return false;
    if (f && f.series === SER && !canSeeThoTest()) return false;
    return true;
  };

  /* Load save dang o phai Test: tu mo 90 + dam bao vu khi */
  if (typeof S !== 'undefined' && S && S.fac && FAC[S.fac] && FAC[S.fac].test) {
    try { thoTestUnlock90(S.fac); thoTestEnsureWeapon(S.fac); } catch (e) { /* S chua san sang */ }
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (S && S.fac && FAC[S.fac] && FAC[S.fac].test) { thoTestUnlock90(S.fac); thoTestEnsureWeapon(S.fac); }
  });

  console.info('[viet_char] Việt★ series', SER, '· factions Yên Tử★ / Bạch Đằng★ · cloned', own.length, 'skills →', BASE + '+; KH sprite + admin only; 90 unlocked');
})();
