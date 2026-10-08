/* ======================= NPC TINH · KIEM HIEP =======================
   PNG pose dung tu assets/pack/kiem_hiep — khong can chay/danh.
   Dat o Hoành Sơn Môn (map 402 · alt Yên Tử, cấp 1–10).
   Liễu Như Yên: hướng dẫn tân thủ + quà nhập môn 1 lần.
   Ve bang drawSprite + flip trai/phai. Click / lai gan de noi chuyen. */
'use strict';
/** Zone id JMO2 — Hoành Sơn Môn (zones2 alt index 0 → S.zalt[0]=2). */
const KH_NPC_ZONE = 402;
const KH_ZALT_IDX = 0;   // vung Yen Tu (cap 1–10)
const KH_ZALT_HOANH = 2; // alt Hoành Sơn Môn trong ZALT[0]
const KH_TALK_R = 48;   // ban kinh bat dau noi chuyen
const KH_HIT_R = 42;    // ban kinh click trung sprite
/* PNG kiem_hiep — scale 0.75 (ngang tầm người chơi) */
const KH_NPC_SCALE = 0.75;
/** Vi tri NPC (ti le map) — spawn tan thu dung phia truoc mat NPC */
const KH_NPC_X = 0.512, KH_NPC_Y = 0.152;
const KH_GIFT_FLAG = 'khYenGift';
const KH_QUEST_FLAG = 'khGuardDone';   // da tra nhiem vu canh cua
const KH_QUEST_NEED = 8;               // ha 8 quai o Yen Tu
/* Qua tan thu (1 lan): luong + thuoc + KNB + Phuc Duyen + Huyển Tinh nhe */
const KH_NEWBIE_GIFT_A = { gold: 800, pot: { kind: 'life', tier: 1, n: 30 }, knb: 2, fd: 10 };
const KH_NEWBIE_GIFT_B = { pot: { kind: 'mana', tier: 1, n: 20 }, ht: 1 };
const KH_QUEST_REWARD = { gold: 600, pot: { kind: 'life', tier: 1, n: 20 }, knb: 1, fd: 5 };

/* Mot NPC dung truoc nha / canh gia vu khi trong san luyen */
const KH_ZONE_NPC = [
  /* kh20 = pose mặt sân (xoay ngược khỏi nhà); đứng sát cột (ô walk gần chân cột) */
  {
    kh: 20, n: 'Liễu Như Yên', x: KH_NPC_X, y: KH_NPC_Y, face: 1, sc: 0.75,
    guide: 1,
  },
  /* kh600 = NPC nam sát cửa song — giao nhiệm vụ canh môn */
  {
    kh: 600, n: 'Huyền Kiếm Khách', x: 0.702, y: 0.081, face: -1, sc: 0.75,
    quest: 1,
  },
];

function khNpcImg(kh) {
  if (typeof Assets !== 'undefined' && Assets.pack && Assets.pack.kh) {
    const p = Assets.pack.kh(kh);
    if (p) return p;
  }
  return `assets/pack/kiem_hiep/${kh}.png`;
}

async function khNpcLoadStubs() {
  if (window._khStubs) return window._khStubs;
  try {
    const r = await fetch('assets/pack/kiem_hiep/stubs.json');
    window._khStubs = await r.json();
  } catch (_) { window._khStubs = {}; }
  return window._khStubs;
}

function khNpcZoneActive() {
  if (!R || R.town || R.dg) return false;
  try {
    const z = typeof zoneOf === 'function' ? zoneOf(Math.min(S.stage, STAGES)) : null;
    if (z && z.id === KH_NPC_ZONE) return true;
  } catch (_) { /* chua co S */ }
  return OBS && String(OBS.key) === String(KH_NPC_ZONE);
}

function khGiftClaimed() {
  return !!(S && S.rw && S.rw[KH_GIFT_FLAG]);
}

function khQuestDone() {
  return !!(S && S.rw && S.rw[KH_QUEST_FLAG]);
}

function khQuest() {
  return (S && S.khQ) || null;
}

function khQuestReady() {
  const q = khQuest();
  return !!(q && q.have >= q.need);
}

/** Hoi thoai giao nhiem vu — Huyền Kiếm Khách. */
function khBuildQuestTalk(n) {
  const done = khQuestDone(), q = khQuest(), choices = [];
  if (done) {
    choices.push({
      t: 'Hỏi về canh cửa',
      a: 'Cửa này đã yên. Hiệp khách có công — giữ kiếm sát thân khi ra ngoài môn.',
    });
    choices.push({ t: 'Tạm biệt', a: 'Đi đi. Đừng lộ khí trên đường.' });
    return {
      title: 'Huyền Kiếm Khách · Hoành Sơn Môn',
      open: 'Việc canh cửa tạm ổn nhờ hiệp khách. Còn muốn hỏi gì?',
      choices,
    };
  }
  if (q && khQuestReady()) {
    choices.push({
      t: `Trả nhiệm vụ (${q.have}/${q.need})`,
      turnInQ: 1,
      a: 'Tốt. Đây là thù lao canh cửa — lượng, thuốc, Kim Nguyên Bảo và Phúc Duyên. Nhớ luyện chân vững trước khi ra xa.',
    });
    choices.push({ t: 'Để sau', a: 'Nhanh lên. Ta còn đứng đây.' });
    return {
      title: 'Huyền Kiếm Khách · Nhiệm vụ',
      open: `Đủ ${q.need} mạng rồi. Trả nhiệm vụ đi.`,
      choices,
    };
  }
  if (q) {
    choices.push({
      t: 'Đưa tôi đi Yên Tử Sơn',
      goYenTu: 1,
      a: 'Yên Tử Sơn có quái hợp cấp. Hạ đủ rồi quay lại đây trả việc.',
    });
    choices.push({
      t: `Tiến độ: ${q.have}/${q.need} quái`,
      a: `Còn thiếu ${Math.max(0, q.need - q.have)} mạng. Ra Yên Tử Sơn hạ quái rồi về báo.`,
    });
    choices.push({ t: 'Tạm biệt', a: 'Đi luyện đi. Đừng về tay không.' });
    return {
      title: 'Huyền Kiếm Khách · Nhiệm vụ',
      open: `Đang làm: hạ ${q.need} quái ở Yên Tử Sơn (${q.have}/${q.need}).`,
      choices,
    };
  }
  choices.push({
    t: 'Nhận nhiệm vụ canh cửa',
    acceptQ: 1,
    a: `Ra Yên Tử Sơn hạ ${KH_QUEST_NEED} quái bất kỳ, rồi quay lại đây báo. Xong có thù lao.`,
  });
  choices.push({
    t: 'Hỏi về luyện kiếm',
    a: 'Kiếm không chỉ sắc ở mũi. Hơi thở đều, bước chân vững — mới giữ được chiêu lâu.',
  });
  choices.push({ t: 'Để sau', a: 'Có việc thì tìm ta. Đứng sát cửa này.' });
  return {
    title: 'Huyền Kiếm Khách · Hoành Sơn Môn',
    open: 'Ta canh cửa luyện võ. Hiệp khách muốn nhận việc không?',
    choices,
  };
}

function khAcceptQuest() {
  if (!S || khQuestDone() || khQuest()) return false;
  S.khQ = { id: 'guard', need: KH_QUEST_NEED, have: 0 };
  if (typeof save === 'function') save();
  log(`📜 Nhận nhiệm vụ: <b>Canh cửa Hoành Sơn</b> — hạ ${KH_QUEST_NEED} quái ở Yên Tử Sơn.`);
  toast(`Nhận nhiệm vụ: hạ ${KH_QUEST_NEED} quái`);
  return true;
}

function khTurnInQuest() {
  if (!S || !khQuestReady()) return false;
  if (typeof RW === 'function') RW();
  else S.rw = S.rw || {};
  S.rw[KH_QUEST_FLAG] = 1;
  S.khQ = null;
  const why = 'Huyền Kiếm Khách · canh cửa';
  if (typeof grant === 'function') {
    const prev = R.batch;
    R.batch = true;
    grant(KH_QUEST_REWARD, why);
    R.batch = prev;
    log(`🎁 ${why}: lượng, thuốc, Kim Nguyên Bảo, Phúc Duyên`);
    if (!R.quiet && typeof uiSfx === 'function') uiSfx('learn');
  }
  if (typeof save === 'function') save();
  if (typeof refresh === 'function') refresh();
  toast('Hoàn thành nhiệm vụ canh cửa');
  return true;
}

/** Dem so quai ha khi dang lam nhiem vu canh cua. Goi tu ghOnKill. */
function khOnKill(e) {
  const q = khQuest();
  if (!q || khQuestDone()) return;
  q.have = Math.min(q.need, (q.have || 0) + 1);
  if (q.have >= q.need) {
    toast('Đủ số quái — về gặp Huyền Kiếm Khách');
    log('📜 Nhiệm vụ canh cửa: <b>đã đủ</b> — về Hoành Sơn Môn trả việc.');
  } else if (q.have === 1 || q.have % 2 === 0) {
    toast(`Nhiệm vụ: ${q.have}/${q.need} quái`);
  }
  if (typeof save === 'function') save();
}

/** Noi dung hoi thoai huong dan — dong theo trang thai qua. */
function khBuildTalk(n) {
  const got = khGiftClaimed();
  const choices = [];
  if (!got) {
    choices.push({
      t: 'Nhận vật tư nhập môn',
      gift: 1,
      a: 'Đây là vật tư nhập môn: lượng, thuốc hồi sinh lực / nội lực, Kim Nguyên Bảo, Phúc Duyên và một ít Huyền Tinh. Ra Yên Tử Sơn luyện công khi sẵn sàng — nhớ mở nút 🎁 nhận quà điểm danh mỗi ngày.',
    });
  }
  choices.push({
    t: 'Cách chơi thế nào?',
    a: 'Kéo joystick hoặc chạm đất để đi. Bật Tự đánh (phím F) để nhân vật tự đánh quái. Bản đồ này không có quái — chọn «Đưa tôi đi Yên Tử Sơn» hoặc mở thẻ Giang hồ → bản đồ luyện công. Thuốc uống tự động; nút 🎁 có điểm danh và mốc cấp.',
  });
  choices.push({
    t: 'Đưa tôi đi Yên Tử Sơn luyện công',
    goYenTu: 1,
    a: 'Yên Tử Sơn có quái hợp cấp tân thủ. Bật tự đánh, nhặt đồ, uống thuốc — lên cấp rồi quay lại gặp tiểu nữ nếu cần chỉ dẫn.',
  });
  choices.push({
    t: got ? 'Tạm biệt' : 'Để sau',
    a: got
      ? 'Xin chào. Cầu chúc bằng hữu bình an trên đường giang hồ.'
      : 'Nhớ nhận vật tư nhập môn trước khi ra bãi. Tiểu nữ đợi ở đây.',
  });
  return {
    title: 'Liễu Như Yên · Hướng dẫn tân thủ',
    open: got
      ? 'Hiệp khách đã nhận vật tư rồi. Còn muốn hỏi gì, hoặc muốn tiểu nữ đưa sang Yên Tử Sơn luyện công?'
      : 'Chào hiệp khách mới vào giang hồ. Tiểu nữ Liễu Như Yên được giao hướng dẫn đệ tử mới tại Hoành Sơn Môn. Cứ hỏi — và nhớ nhận vật tư nhập môn trước khi ra bãi luyện công.',
    choices,
  };
}

function khZonePlace() {
  const w = (typeof WORLD !== 'undefined' && WORLD.w) || 3584;
  const h = (typeof WORLD !== 'undefined' && WORLD.h) || 3584;
  const stubs = window._khStubs || {};
  R.khNpcs = KH_ZONE_NPC.map(d => {
    const st = stubs[String(d.kh)];
    const sz = (st && st.sz) || [64, 128, 32, 126];
    return {
      n: d.n,
      kh: d.kh,
      x: d.x * w,
      y: d.y * h,
      face: d.face || 1,
      imgPath: khNpcImg(d.kh),
      sz,
      sc: d.sc != null ? d.sc : KH_NPC_SCALE,
      guide: d.guide,
      quest: d.quest,
      talk: d.talk || (d.guide ? khBuildTalk(d) : null) || (d.quest ? khBuildQuestTalk(d) : null),
    };
  });
}

function ensureKhNpcs() {
  if (!khNpcZoneActive()) { R.khNpcs = null; R.talkTarget = null; return; }
  if (R.khNpcs && R.khNpcs.length) return;
  /* Dat ngay bang sz mac dinh de NPC hien khi vua spawn; stubs load xong thi dat lai chuan */
  khZonePlace();
  if (!window._khStubs) {
    khNpcLoadStubs().then(() => { if (khNpcZoneActive()) { R.khNpcs = null; khZonePlace(); } });
  }
}

function ensureTownNpcs() { ensureKhNpcs(); }

/** Spawn tan thu tai Hoành Sơn Môn, dung gan Liễu Như Yên. Goi sau createCharacter / startFaction. */
function khNewbieSpawn() {
  if (!S || typeof H === 'undefined' || !H) return;
  (S.zalt || (S.zalt = {}))[KH_ZALT_IDX] = KH_ZALT_HOANH;
  S.stage = typeof farmStage === 'function' ? farmStage(KH_ZALT_IDX) : 1;
  S.wave = 1;
  /* Giữ sân môn: không để autoMap kéo sang bản đồ gốc cùng vùng */
  S.autoMap = false;
  R.enemies = []; R.corpses = []; R.spawnT = 0.6; R.field = null; R.talkTarget = null;
  const z = typeof zoneOf === 'function' ? zoneOf(Math.min(S.stage, STAGES)) : null;
  if (z) {
    R.zoneShown = z.id;
    if (typeof onZoneChange === 'function') onZoneChange(z);
    else if (typeof obsLoad === 'function') obsLoad(z.id);
  }
  const w = (typeof WORLD !== 'undefined' && WORLD.w) || 3584;
  const h = (typeof WORLD !== 'undefined' && WORLD.h) || 3584;
  const nx = KH_NPC_X * w, ny = KH_NPC_Y * h;
  [H.x, H.y] = typeof inWorld === 'function' ? inWorld(nx, ny + 56) : [nx, ny + 56];
  if (typeof snapCamera === 'function') snapCamera();
  R.khNpcs = null;
  if (typeof ensureKhNpcs === 'function') ensureKhNpcs();
  log('🏯 Tân thủ nhập môn tại <b>Hoành Sơn Môn</b>. Gặp <b>Liễu Như Yên</b> để nhận chỉ dẫn và vật tư nhập môn.');
  toast('Gặp Liễu Như Yên nhận quà tân thủ');
}

function khClaimNewbieGift() {
  if (!S || khGiftClaimed()) return false;
  if (typeof RW === 'function') RW();
  else S.rw = S.rw || {};
  S.rw[KH_GIFT_FLAG] = 1;
  const why = 'Liễu Như Yên · vật tư nhập môn';
  if (typeof grant === 'function') {
    const prev = R.batch;
    R.batch = true;
    grant(KH_NEWBIE_GIFT_A, why);
    grant(KH_NEWBIE_GIFT_B, why);
    R.batch = prev;
    log(`🎁 ${why}: lượng, thuốc hồi sinh lực / nội lực, Kim Nguyên Bảo, Phúc Duyên, Huyền Tinh`);
    if (!R.quiet && typeof uiSfx === 'function') uiSfx('learn');
    if (typeof save === 'function') save();
    if (typeof refresh === 'function') refresh();
    if (typeof dotGift === 'function') dotGift();
  }
  toast('Đã nhận vật tư nhập môn');
  return true;
}

function khSendToYenTu() {
  if (!S) return;
  /* Cùng vùng Yên Tử (zi=0) chỉ đổi alt — gotoZone bỏ qua onZoneChange khi same zone → buộc reload */
  (S.zalt || (S.zalt = {}))[KH_ZALT_IDX] = 0;
  S.stage = typeof farmStage === 'function' ? farmStage(KH_ZALT_IDX) : 1;
  S.wave = 1;
  R.enemies = []; R.corpses = []; R.field = null; R.talkTarget = null; R.khNpcs = null;
  const z = typeof zoneOf === 'function' ? zoneOf(Math.min(S.stage, STAGES)) : null;
  if (z) {
    R.zoneShown = z.id;
    if (typeof onZoneChange === 'function') onZoneChange(z);
    else if (typeof obsLoad === 'function') obsLoad(z.id);
    R.banner = { t: 2.2, text: z.n, sub: 'Luyện công Yên Tử Sơn' };
    log(`🗺 Luyện công: tới <b>${esc(z.n)}</b>`);
  }
  const w = (typeof WORLD !== 'undefined' && WORLD.w) || 3584;
  const h = (typeof WORLD !== 'undefined' && WORLD.h) || 3584;
  [H.x, H.y] = typeof inWorld === 'function' ? inWorld(w / 2, h / 2) : [w / 2, h / 2];
  if (typeof snapCamera === 'function') snapCamera();
  toast('Đã tới Yên Tử Sơn — bắt đầu luyện công');
  if (typeof save === 'function') save();
  if (typeof refresh === 'function') refresh();
}

/** Ve Hoành Sơn Môn (tra nhiem vu). */
function khSendToHoanh() {
  if (!S) return;
  (S.zalt || (S.zalt = {}))[KH_ZALT_IDX] = KH_ZALT_HOANH;
  S.stage = typeof farmStage === 'function' ? farmStage(KH_ZALT_IDX) : 1;
  S.wave = 1;
  S.autoMap = false;
  R.enemies = []; R.corpses = []; R.field = null; R.talkTarget = null; R.khNpcs = null;
  const z = typeof zoneOf === 'function' ? zoneOf(Math.min(S.stage, STAGES)) : null;
  if (z) {
    R.zoneShown = z.id;
    if (typeof onZoneChange === 'function') onZoneChange(z);
    else if (typeof obsLoad === 'function') obsLoad(z.id);
    R.banner = { t: 2.2, text: z.n, sub: 'Trả nhiệm vụ canh cửa' };
  }
  const w = (typeof WORLD !== 'undefined' && WORLD.w) || 3584;
  const h = (typeof WORLD !== 'undefined' && WORLD.h) || 3584;
  const nx = 0.702 * w, ny = 0.081 * h;
  [H.x, H.y] = typeof inWorld === 'function' ? inWorld(nx, ny + 48) : [nx, ny + 48];
  if (typeof snapCamera === 'function') snapCamera();
  if (typeof ensureKhNpcs === 'function') ensureKhNpcs();
  toast('Về Hoành Sơn Môn — gặp Huyền Kiếm Khách');
  if (typeof save === 'function') save();
  if (typeof refresh === 'function') refresh();
}

/* ---------- tuong tac: click / lai gan noi chuyen ---------- */
function khNpcAt(sx, sy) {
  if (!khNpcZoneActive() || !R.khNpcs) return null;
  let best = null, bd = KH_HIT_R;
  for (const n of R.khNpcs) {
    const sc = n.sc || KH_NPC_SCALE;
    const torsoY = n.y - (n.sz ? n.sz[1] * sc * 0.45 : 30);
    const k = Math.hypot(n.x - sx, torsoY - sy);
    if (k < bd) { bd = k; best = n; }
  }
  return best;
}

function khNpcNear(n, r) {
  if (!n || typeof H === 'undefined' || !H) return false;
  return Math.hypot(n.x - H.x, n.y - H.y) <= (r == null ? KH_TALK_R : r);
}

function startTalkNpc(n) {
  if (!n || !(n.talk || n.guide || n.quest)) { toast('Không có gì để nói.'); return; }
  R.pickTarget = null;
  if (khNpcNear(n)) { openKhTalk(n); return; }
  R.talkTarget = n;
  if (typeof manual === 'function' && !manual() && typeof setCtrl === 'function') setCtrl('manual');
  INPUT.target = { x: n.x, y: n.y };
  toast(`Đến nói chuyện: ${n.n}`);
}

function openKhTalk(n, reply) {
  R.talkTarget = null;
  INPUT.target = null;
  let t = n.talk || null;
  if (n.guide) t = n.talk = khBuildTalk(n);
  else if (n.quest) t = n.talk = khBuildQuestTalk(n);
  if (!t) return;
  const body = reply
    ? `<p class="desc">${esc(reply)}</p>
       <div class="btnrow"><button class="btn" id="khTalkBack">Quay lại</button><button class="btn" id="khTalkBye">Tạm biệt</button></div>`
    : `<p class="desc">${esc(t.open || '…')}</p>
       <div class="btncol">${(t.choices || []).map((c, i) =>
         `<button class="btn kh-choice" data-i="${i}">${esc(c.t)}</button>`).join('')}</div>`;
  modal(`<h3>${esc(t.title || n.n)}</h3>${body}`, () => {
    const bye = $('#khTalkBye');
    if (bye) bye.onclick = () => closeModal();
    const back = $('#khTalkBack');
    if (back) back.onclick = () => openKhTalk(n);
    document.querySelectorAll('#mBody .kh-choice').forEach(b => {
      b.onclick = () => {
        const c = (t.choices || [])[+b.dataset.i];
        if (!c) return;
        if (c.gift) khClaimNewbieGift();
        if (c.acceptQ) {
          khAcceptQuest();
          openKhTalk(n, c.a);
          return;
        }
        if (c.turnInQ) {
          khTurnInQuest();
          openKhTalk(n, c.a);
          return;
        }
        if (c.goYenTu) {
          closeModal();
          khSendToYenTu();
          toast(c.a || 'Đã tới Yên Tử Sơn');
          return;
        }
        if (!c.a) { closeModal(); toast('Tạm biệt.'); return; }
        openKhTalk(n, c.a);
      };
    });
  });
}

/** Di toi NPC dang chon roi mo hoi thoai. Tra ve true neu dang xu ly (chan danh). */
function updateKhTalk(dt) {
  const n = R.talkTarget;
  if (!n || !R.khNpcs || !R.khNpcs.includes(n)) { R.talkTarget = null; return false; }
  if (khNpcNear(n)) { openKhTalk(n); return true; }
  if (typeof obsSteer === 'function') {
    obsSteer(H, n.x, n.y, 170 * (typeof curSpeed === 'function' ? curSpeed() : 1) * dt);
    H.face = n.x >= H.x ? 1 : -1;
  } else {
    INPUT.target = { x: n.x, y: n.y };
  }
  return true;
}

function drawOneTownNpc(c, n) {
  const im = img(n.imgPath);
  const sc = n.sc || KH_NPC_SCALE;
  c.fillStyle = '#0006';
  c.beginPath();
  c.ellipse(n.x, n.y, 10, 3.5, 0, 0, 7);
  c.fill();
  if (im && im.complete && im.naturalWidth) {
    const sz = n.sz || [im.naturalWidth, im.naturalHeight, im.naturalWidth / 2, im.naturalHeight - 2];
    drawSprite(im, sz, n.x, n.y, sc, n.face < 0);
  }
  const near = (n.talk || n.guide || n.quest) && khNpcNear(n, KH_TALK_R + 24);
  const nameY = n.y - (n.sz ? n.sz[1] * sc * 0.9 : 62);
  let hint = null, hintCol = null;
  if (near) {
    if (n.guide && !khGiftClaimed()) { hint = 'Nhận quà tân thủ'; hintCol = '#ffd24a'; }
    else if (n.quest && !khQuestDone() && !khQuest()) { hint = 'Nhận nhiệm vụ'; hintCol = '#ffd24a'; }
    else if (n.quest && khQuestReady()) { hint = 'Trả nhiệm vụ'; hintCol = '#ffd24a'; }
    else { hint = 'Nói chuyện'; hintCol = '#9fe8a0'; }
  }
  label(n.x, nameY, n.n, '#e8d5a3', 11, null, null, hint, hintCol);
}

function townNpcEnts() {
  if (!khNpcZoneActive() || !R.khNpcs) return [];
  return R.khNpcs.map(n => ({ khNpc: n, y: n.y }));
}
