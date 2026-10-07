# Style review — SPR gốc JX → trang phục thời Trần

## Đã chốt: **A · Áo giao lĩnh** (rebuild sâu + redraw run/at)

| Vòng | Tool | Nội dung |
|------|------|----------|
| Form áo | `tools/nv_rebuild_a_deep.py` | Base AI giao lĩnh → sheet st/hurt/die |
| Run/At | `tools/nv_rebuild_a_anim.py` | Pose strip run/windup/strike → từng frame |
| Cache | `?v=310` / `jxidle-v310` | |

Pose nguồn: `rebuildA-poses/pose-*-run-at*.jpg`  
Preview anim: `applied-A-anim-redraw.png`

## Rollback
```bash
cp assets/pack/nv-goc-jx/sheets_all/*.webp img/a/
cp assets/pack/nv-goc-jx/portraits/*.png img/pl/
```
