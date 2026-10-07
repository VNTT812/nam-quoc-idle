# Trang phục quái người (thời Trần) — đã build vào spawn

Nhuộm màu thân + đầu trên sheet `enemy*` / `boss*`. Thú `ani*` không đổi.

- Code: `js/tran_costume.js` (hook `makeEnemy` + `drawMonAnim`)
- **Remaster pixel:** `tools/remaster_human_mobs.py` · backup gốc `assets/pack/mobs-goc/` · preview `assets/pack/mobs-remaster-review/before-after.png`
- Gallery màu: [`tran_costume_preview/index.html`](tran_costume_preview/index.html)
- Field quái: [`tran_costume_preview/mobs_field.png`](tran_costume_preview/mobs_field.png)

Rollback remaster:
```bash
cp assets/pack/mobs-goc/*.webp img/a/
```

## Spawn pool (đã gắn)

| Lớp | Keys |
|-----|------|
| Thường | `day cham reu muc dat thao dong ho bach lam` |
| Tinh anh | `cham reu son lam ngoc sam lua tu dong` |
| Boss | `son cham tu ngoc lua huyen` · cao cấp `son kim hoang lua tu` |

Override: `JW.mon[id].tranCostume = 'ngoc'`

## Bảng màu (18 áo)

| Key | Tên | Áo | Đầu |
|-----|-----|----|-----|
| `day` | Áo đay | `#6b4e2e` | `#3f3224` |
| `cham` | Áo chàm | `#2f4f6f` | `#1a3044` |
| `reu` | Áo rêu | `#3a5740` | `#24382a` |
| `muc` | Áo mực | `#2c2c32` | `#16161a` |
| `son` | Áo son | `#8a3030` | `#4e1c1c` |
| `kim` | Áo kim | `#9a7a2e` | `#5c4818` |
| `bach` | Áo bạch | `#d8d2c4` | `#8a8478` |
| `lam` | Áo lam | `#4a6d8c` | `#2c4458` |
| `dat` | Áo đất | `#5a3a22` | `#2e1e12` |
| `thao` | Áo thảo | `#7a6a38` | `#4a4020` |
| `huyen` | Áo huyền | `#3a2a3a` | `#1e1620` |
| `ngoc` | Áo ngọc | `#2a5a55` | `#163832` |
| `hoang` | Áo hoàng | `#c4a035` | `#6e5818` |
| `tu` | Áo tử | `#6a3a58` | `#3a2030` |
| `dong` | Áo đồng | `#8a5a32` | `#4a3018` |
| `lua` | Áo lửa | `#b04828` | `#5c2414` |
| `sam` | Áo sẫm | `#1e2a3a` | `#101820` |
| `ho` | Áo hổ | `#8a5228` | `#4a2c14` |
