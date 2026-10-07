/* ======================= NPC TINH · KIEM HIEP =======================
   PNG pose dung tu assets/pack/kiem_hiep — khong can chay/danh.
   Dat o Hoành Sơn Môn (map 402 · alt Yên Tử, cấp 1–10).
   Ve bang drawSprite + flip trai/phai. Click / lai gan de noi chuyen. */
'use strict';
/** Zone id JMO2 — Hoành Sơn Môn (zones2 alt index 0). */
const KH_NPC_ZONE = 402;
const KH_TALK_R = 48;   // ban kinh bat dau noi chuyen
const KH_HIT_R = 42;    // ban kinh click trung sprite
/* Mot NPC dung truoc nha / canh gia vu khi trong san luyen */
const KH_ZONE_NPC = [
  /* kh20 = pose mặt sân (xoay ngược khỏi nhà); đứng sát cột (ô walk gần chân cột) */
  {
    kh: 20, n: 'Ngọc Lan', x: 0.512, y: 0.152, face: 1,
    talk: {
      title: 'Ngọc Lan · Hoành Sơn Môn',
      open: 'Tiểu nữ hầu hạ tại sân luyện. Hiệp khách cần gì?',
      choices: [
        {
          t: 'Hỏi về môn phái',
          a: 'Hoành Sơn Môn lấy kiếm làm gốc, trọng lễ nghĩa hơn lực. Sân này dành cho đệ tử mới nhập môn luyện chiêu.',
        },
        {
          t: 'Hỏi đường quanh môn',
          a: 'Phía trước là nhà chính cửa song. Bên phải có giá binh khí — nhớ trả giáo về chỗ cũ sau khi luyện.',
        },
        {
          t: 'Xin chỉ giáo một chiêu',
          a: 'Kiếm pháp khởi từ vững chân. Hiệp khách đứng vững như cột nhà này, rồi mới nghĩ đến chiêu thức.',
        },
        { t: 'Tạm biệt', a: 'Xin chào. Cầu chúc bằng hữu bình an trên đường giang hồ.' },
      ],
    },
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
      talk: d.talk || null,
    };
  });
}

function ensureKhNpcs() {
  if (!khNpcZoneActive()) { R.khNpcs = null; R.talkTarget = null; return; }
  if (R.khNpcs && R.khNpcs.length) return;
  if (window._khStubs) khZonePlace();
  else khNpcLoadStubs().then(() => { if (khNpcZoneActive()) khZonePlace(); });
}

function ensureTownNpcs() { ensureKhNpcs(); }

/* ---------- tuong tac: click / lai gan noi chuyen ---------- */
function khNpcAt(sx, sy) {
  if (!khNpcZoneActive() || !R.khNpcs) return null;
  let best = null, bd = KH_HIT_R;
  for (const n of R.khNpcs) {
    const torsoY = n.y - (n.sz ? n.sz[1] * 0.45 : 60);
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
  if (!n || !n.talk) { toast('Không có gì để nói.'); return; }
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
  const t = n.talk;
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
  c.fillStyle = '#0006';
  c.beginPath();
  c.ellipse(n.x, n.y, 14, 5, 0, 0, 7);
  c.fill();
  if (im && im.complete && im.naturalWidth) {
    const sz = n.sz || [im.naturalWidth, im.naturalHeight, im.naturalWidth / 2, im.naturalHeight - 2];
    drawSprite(im, sz, n.x, n.y, 1, n.face < 0);
  }
  const near = n.talk && khNpcNear(n, KH_TALK_R + 24);
  const nameY = n.y - (n.sz ? n.sz[1] * 0.9 : 100);
  label(n.x, nameY, n.n, '#e8d5a3', 11, null, null, near ? 'Nói chuyện' : null, near ? '#9fe8a0' : null);
}

function townNpcEnts() {
  if (!khNpcZoneActive() || !R.khNpcs) return [];
  return R.khNpcs.map(n => ({ khNpc: n, y: n.y }));
}
