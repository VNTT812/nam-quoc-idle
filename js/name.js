/* Ten nhan vat: save cu (truoc khi co man tao nhan vat) chi co ten mon phai -> cho dat ten (dung cho chat / xep hang). */
'use strict';
const NAME_MIN = 2, NAME_MAX = 14;
const hasRealName = () => !!(S && S.name && S.name !== 'Tân thủ' && !FACTIONS.some(f => f.n === S.name));
function nameCheck(n) {
  n = String(n || '').replace(/\s+/g, ' ').trim();
  if (n.length < NAME_MIN) return { ok: false, msg: `Tên cần ít nhất ${NAME_MIN} ký tự` };
  if (n.length > NAME_MAX) return { ok: false, msg: `Tên tối đa ${NAME_MAX} ký tự` };
  if (FACTIONS.some(f => f.n.toLowerCase() === n.toLowerCase()) || /^tân thủ$/i.test(n)) return { ok: false, msg: 'Không dùng tên môn phái' };
  if (/[<>"'`\\]/.test(n)) return { ok: false, msg: 'Tên có ký tự không hợp lệ' };
  return { ok: true, n };
}
function nameModal(after) {
  const cur = hasRealName() ? S.name : '';
  modal(`<h3>${cur ? 'Đổi tên nhân vật' : 'Đặt tên nhân vật'}</h3>
    <p class="desc">${cur ? '' : 'Nhân vật này tạo từ bản cũ nên chưa có tên riêng. '}Tên hiện trên đầu nhân vật, và trong chat thế giới. Miễn phí, đổi lại được.</p>
    <div class="row">Tên <input id="nmIn" maxlength="${NAME_MAX}" placeholder="${NAME_MIN}–${NAME_MAX} ký tự" value="${esc(cur)}"></div>
    <div class="btnrow"><button class="btn" id="nmOk">Lưu tên</button><button class="btn" id="nmNo">Để sau</button></div>`, () => {
    const inp = $('#nmIn'); setTimeout(() => inp.focus(), 0);
    const go = () => { const r = nameCheck(inp.value); if (!r.ok) return toast(r.msg);
      S.name = r.n; save(); log(`Đặt tên nhân vật: <b>${esc(r.n)}</b>`); closeModal(true);
      try { if (CHAT.ch && CHAT.state === 'ok') CHAT.ch.track({ name: r.n, lvl: S.lvl | 0 }); } catch (e) { /* bo qua */ }
      refresh(); if (after) after(); };
    $('#nmOk').onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
    $('#nmNo').onclick = () => closeModal();
  });
}
