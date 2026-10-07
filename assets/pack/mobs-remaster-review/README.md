# Remaster pixel quái người

- Tool: `tools/remaster_human_mobs.py`
- Scope: `img/a/enemy*_*.webp` + `boss*_*.webp` (330 file) — **không** đụng `ani*`
- Backup gốc: `assets/pack/mobs-goc/`
- Preview: `before-after.png`

```bash
python3 tools/remaster_human_mobs.py   # idempotent từ backup
cp assets/pack/mobs-goc/*.webp img/a/  # rollback
```
