# Trang phục Trần trên quái remaster

- Tool: `tools/rebuild_tran_mob_costume.py`
- Nguồn remaster sạch: `assets/pack/mobs-remaster/`
- Gốc pixel: `assets/pack/mobs-goc/`
- Output: `img/a/enemy*|boss*` (cloth remap, giữ da/kim loại)
- Map stem→áo: `stem_costume.json`
- Preview: `remaster-vs-tran.png`

```bash
python3 tools/remaster_human_mobs.py          # remaster từ goc
python3 tools/rebuild_tran_mob_costume.py     # dựng áo Trần lên remaster
```
