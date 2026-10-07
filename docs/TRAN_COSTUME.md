# Trang phục quái người (thời Trần)

Nhuộm màu thân + đầu trên sheet `enemy*` / `boss*` hiện có — không thay sprite.

File: `js/tran_costume.js` · gắn khi `makeEnemy` · vẽ qua `drawMonAnim`.

## Bảng trang phục

| Key | Tên | Gợi ý | Màu áo | Màu khăn/đầu |
|-----|-----|--------|--------|--------------|
| `day` | Áo đay | Sơn dân | `#6b4e2e` | `#3f3224` |
| `cham` | Áo chàm | Lính tuần | `#2f4f6f` | `#1a3044` |
| `reu` | Áo rêu | Phục kích | `#3a5740` | `#24382a` |
| `muc` | Áo mực | Ám sát | `#2c2c32` | `#16161a` |
| `son` | Áo son | Đầu lĩnh | `#8a3030` | `#4e1c1c` |
| `kim` | Áo kim | Trùm cao | `#9a7a2e` | `#5c4818` |

## Gán tự động

- Quái thường (người): xoay `day / cham / reu / muc` theo `tid`
- Tinh anh: `cham / reu / son`
- Boss / đầu lĩnh: `son / cham` (cao cấp → `son / kim`)
- Override: `JW.mon[id].tranCostume = 'cham'`

Thú (`ani*`) không áp dụng.
