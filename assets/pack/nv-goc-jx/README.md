# SPR gốc nhân vật game (JX / VLTK)

Đây mới là SPR gốc đang dùng trong game cho 10 môn phái — **không** phải pack Kiếm Thế (`kiem_hiep/`).

## Cấu trúc
| Thư mục | Nội dung |
|---------|----------|
| `portraits/` | `img/pl/{fac}.png` — icon môn |
| `frames/` | 1 frame idle cắt từ `pl_*_st.webp` |
| `sheets/` | Sheet `st` unique (đã bỏ trùng) |

## Sheet trùng trong idle hiện tại
- `pl_kunlun` = `pl_wudang`
- `pl_tianren` = `pl_shaolin`

## File gốc trong repo
- Portrait: `img/pl/{shaolin,tianwang,tangmen,wudu,emei,cuiyan,gaibang,tianren,wudang,kunlun}.png`
- Anim: `img/a/pl_{fac}_{st,run,at,hurt,die}.webp`
- Meta: `world.js` → `JW.hero` / `JW.anim`

## Review board
`assets/pack/nv-goc-jx-review/0_goc-jx10.png`
