/* ======================= HE THO (TEST) — clone day du Võ Đang + Côn Lôn =======================
   Chi tai khoan admin nhin / choi duoc. Skill id = 9000 + id goc → chinh sua khong dung data Tho that. */
'use strict';
(function () {
  const SRC = ['wudang', 'kunlun'];
  const BASE = 9000;
  const SER = 5;
  const MAP = Object.create(null);   // oldId -> newId
  const deep = x => JSON.parse(JSON.stringify(x));

  const canSeeThoTest = () => typeof isAdmin === 'function' && isAdmin();
  const isThoTestFac = f => !!(f && f.test);
  const facVisible = f => !isThoTestFac(f) || canSeeThoTest();
  window.canSeeThoTest = canSeeThoTest;
  window.isThoTestFac = isThoTestFac;
  window.facVisible = facVisible;
  window.THO_TEST_SERIES = SER;
  window.THO_TEST_ID_BASE = BASE;
  window.thoTestId = id => (MAP[+id] || (+id >= BASE ? +id : 0));
  window.thoTestMap = MAP;

  if (!SERIES.includes('Thổ★')) SERIES.push('Thổ★');
  if (SERIES_COL.length < 6) SERIES_COL.push('#e0b070');
  SERIES_DESC && SERIES_DESC.length < 6 && SERIES_DESC.push('Admin · clone Thổ (Võ Đang + Côn Lôn)');
  if (!J.levelAdd[SER]) J.levelAdd[SER] = deep(J.levelAdd[4]);
  /* start stats: copy Tho nam/nu */
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
  }

  /* --- factions --- */
  const srcFac = Object.fromEntries(J.factions.map(f => [f.key, f]));
  const clones = [
    { key: 'wudang_t', src: 'wudang', id: 108, n: 'Võ Đang (Test)', camp: 'C_JUSTICE' },
    { key: 'kunlun_t', src: 'kunlun', id: 109, n: 'Côn Lôn (Test)', camp: 'C_BALANCE' },
  ];
  for (const c of clones) {
    const o = srcFac[c.src];
    if (!o || FAC[c.key]) continue;
    const f = {
      id: c.id, key: c.key, n: c.n, series: SER, camp: o.camp || c.camp,
      skills: (o.skills || []).map(id => MAP[id] || id),
      test: 1, srcKey: c.src, srcId: o.id,
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
  FAC['vo' + SER] = { key: 'vo' + SER, n: 'Vô Môn Phái', series: SER, skills: [], wcode: -1, id: -1, novice: true, test: 1 };

  /* --- hinh nhan vat / danh hieu / can bang --- */
  if (typeof W !== 'undefined' && W.hero) {
    if (W.hero.wudang) W.hero.wudang_t = W.hero.wudang;
    if (W.hero.kunlun) W.hero.kunlun_t = W.hero.kunlun;
  }
  if (typeof CAMP !== 'undefined') { CAMP.wudang_t = 'chinh'; CAMP.kunlun_t = 'trung'; }
  if (typeof FAC_SHORT !== 'undefined') { FAC_SHORT.wudang_t = 'Võ Đang★'; FAC_SHORT.kunlun_t = 'Côn Lôn★'; }
  if (typeof POWER_RAW !== 'undefined') {
    if (POWER_RAW.wudang) POWER_RAW.wudang_t = POWER_RAW.wudang.slice();
    if (POWER_RAW.kunlun) POWER_RAW.kunlun_t = POWER_RAW.kunlun.slice();
  }
  if (typeof FAC_DMG_NORM !== 'undefined') {
    if (FAC_DMG_NORM.wudang) FAC_DMG_NORM.wudang_t = FAC_DMG_NORM.wudang.slice();
    if (FAC_DMG_NORM.kunlun) FAC_DMG_NORM.kunlun_t = FAC_DMG_NORM.kunlun.slice();
  }

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

  /* --- khoa UI: chi admin thay he / phai Test --- */
  const visibleSeries = () => SERIES.map((_, i) => i).filter(i => i !== SER || canSeeThoTest());
  window.visibleSeries = visibleSeries;

  /* chan doi phai / join sang Test neu khong phai admin */
  const _joinFaction = typeof joinFaction === 'function' ? joinFaction : null;
  if (_joinFaction) {
    joinFaction = function (key) {
      const f = FAC[key];
      if (f && f.test && !canSeeThoTest()) { toast('Chỉ tài khoản admin'); return; }
      return _joinFaction(key);
    };
  }
  const _changeFaction = typeof changeFaction === 'function' ? changeFaction : null;
  if (_changeFaction) {
    changeFaction = function (key) {
      const f = FAC[key];
      if (f && f.test && !canSeeThoTest()) { toast('Chỉ tài khoản admin'); return; }
      return _changeFaction(key);
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

  console.info('[tho_test] cloned', own.length, 'skills → ids', BASE + '+; factions wudang_t / kunlun_t; series', SER, 'Thổ★ (admin only)');
})();
