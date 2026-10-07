# Trang phục quái người (thời Trần) — chờ duyệt

Nhuộm màu thân + đầu trên sheet `enemy*` / `boss*`. Thú `ani*` không đổi.

- Code: `js/tran_costume.js`
- **Gallery duyệt:** mở [`tran_costume_preview/index.html`](tran_costume_preview/index.html) (sau `python3 tools/gen_tran_costume_preview.py`)

## Cách duyệt

Reply key muốn **giữ** / **bỏ** / **đưa vào spawn**, ví dụ:

> giữ: day cham son kim ngoc · bỏ: thao huyen · spawn thường thêm dat lam

## Bảng đang dùng (`active`)

| Key | Tên | Gợi ý | Áo | Đầu |
|-----|-----|--------|----|-----|
| `day` | Áo đay | Sơn dân | `#6b4e2e` | `#3f3224` |
| `cham` | Áo chàm | Lính tuần | `#2f4f6f` | `#1a3044` |
| `reu` | Áo rêu | Phục kích | `#3a5740` | `#24382a` |
| `muc` | Áo mực | Ám sát | `#2c2c32` | `#16161a` |
| `son` | Áo son | Đầu lĩnh | `#8a3030` | `#4e1c1c` |
| `kim` | Áo kim | Trùm cao | `#9a7a2e` | `#5c4818` |

## Ứng viên mới (`candidate` — chưa vào vòng spawn)

| Key | Tên | Gợi ý | Áo | Đầu |
|-----|-----|--------|----|-----|
| `bach` | Áo bạch | Văn quan | `#d8d2c4` | `#8a8478` |
| `lam` | Áo lam | Thư sinh | `#4a6d8c` | `#2c4458` |
| `dat` | Áo đất | Nông binh | `#5a3a22` | `#2e1e12` |
| `thao` | Áo thảo | Dân dã | `#7a6a38` | `#4a4020` |
| `huyen` | Áo huyền | Đặc sứ | `#3a2a3a` | `#1e1620` |
| `ngoc` | Áo ngọc | Cận vệ | `#2a5a55` | `#163832` |

## Gán spawn hiện tại

- Thường: `day / cham / reu / muc`
- Tinh anh: `cham / reu / son`
- Boss: `son / cham` (cao cấp → `son / kim`)
- Override: `JW.mon[id].tranCostume = 'ngoc'`
