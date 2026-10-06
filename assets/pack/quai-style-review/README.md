# Style review — quái Yên Tử Sơn (map đầu)

Sprites gốc: `ani019` Nhím · `ani018` Heo rừng · `ani051` Hoán hùng · `ani052` Linh Miêu

## Files
- `0_goc.png` — 4 SPR gốc (idle, side)
- `00-board-all-styles.png` — filter thử trên SPR (A–E)
- `style-F-pixel-remaster-4mons.jpg` — Pixel remaster hiện đại
- `style-G-watercolor-wuxia-4mons.jpg` — Watercolor / thủy mặc
- `style-H-folk-woodcut-4mons.jpg` — Folk / khắc gỗ
- `style-I-chibi-cute-4mons.jpg` — Chibi dễ thương
- `style-J-mythic-night-4mons.jpg` — Mythic / hệ nguyên tố đêm

Chọn 1 (hoặc mix) → dựng lại full sheet 8 hướng × 5 act.

## Đã áp thử: F · Pixel remaster
- Tool: `tools/quai_remaster_f.py`
- Backup gốc: `assets/pack/quai-orig-backup/`
- Sheets ghi đè `img/a/ani018|019|051|052_*.webp` (giữ n/d/w/h), cache `?v=301` trong `world.js`

## Đã áp thử: J · Mythic đêm
- Tool: `tools/quai_remaster_j.py`
- Nhím=Độc · Heo rừng=Hỏa · Hoán hùng=Ám · Linh Miêu=Lôi
- Sheets từ backup gốc, cache `?v=302`

## Đang áp: F · Pixel remaster (chốt)
- Từ backup gốc, cache `?v=305`
- Thay bản J mythic trên 4 stem

## Đang áp: J Mythic + F Pixel remaster
- Tool: `tools/quai_remaster_jf.py` (Mythic J rồi Pixel remaster F)
- Cache `?v=306`
