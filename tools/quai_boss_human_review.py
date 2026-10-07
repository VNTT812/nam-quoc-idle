#!/usr/bin/env python3
"""Board duyệt Soft / Soft+F / J+F / Neon cho boss & địch dạng người — KHÔNG apply vào img/."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from quai_map2_style_review import (  # noqa: E402
    COLORS as COLOR_LIST,
    style_crystal,
    style_ember,
    style_jf,
    style_neon,
    style_soft,
)
from quai_remaster_jf import BACKUP, CATALOG, ROOT, mythic_cell, pixel_remaster_cell  # noqa: E402
from quai_soft_f_lib import st_cell_from  # noqa: E402

OUT = Path("/opt/cursor/artifacts/boss-human-review")
REVIEW = ROOT / "assets/pack/quai-style-review/boss-human"

# Unique stems dùng trên map (enemy/boss) — lấy từ world.js zones
def zone_humanoid_stems() -> list[tuple[str, str, str]]:
    """Return [(stem, display_name, role)] unique, stable order."""
    text = (ROOT / "world.js").read_text(encoding="utf-8")
    m = re.search(r"window\.JW=(\{.*\});\s*$", text, re.S)
    JW = json.loads(m.group(1))
    seen = {}
    order = []
    for z in JW["zones"]:
        mids = list(z.get("m") or [])
        if z.get("boss") is not None:
            mids = mids + [z["boss"]]
        for mid in mids:
            mon = JW["mon"][str(mid)]
            stem = mon.get("anim") or Path(mon["img"]).stem
            if not stem.startswith(("enemy", "boss")):
                continue
            if stem in seen:
                continue
            role = "boss" if mid == z.get("boss") or "Boss" in mon["n"] or "đầu lĩnh" in mon["n"] else "humanoid"
            seen[stem] = (stem, mon["n"], role)
            order.append(stem)
    return [seen[s] for s in order]


# Gợi ý màu theo tên/role
def pick_color(name: str, stem: str) -> tuple:
    n = name.lower()
    if any(k in n for k in ("hỏa", "xích", "đỏ", "huyết")):
        return COLOR_LIST[1]  # Hỏa
    if any(k in n for k in ("lôi", "sấm", "thiên")):
        return COLOR_LIST[2]
    if any(k in n for k in ("độc", "rắn", "mãng")):
        return COLOR_LIST[3]
    if any(k in n for k in ("băng", "hàn", "tuyết", "sương")):
        return COLOR_LIST[4]
    if any(k in n for k in ("kim", "vàng", "hoàng")):
        return COLOR_LIST[5]
    if any(k in n for k in ("hắc", "ám", "ảnh", "u")):
        return COLOR_LIST[0]  # Ám
    if "boss" in n or "đầu lĩnh" in n:
        return COLOR_LIST[6]  # Huyết
    # default by stem hash
    return COLOR_LIST[hash(stem) % len(COLOR_LIST)]


STYLES = [
    ("Soft", style_soft),
    ("Soft+F", lambda cell, g, w, c, s, ct: pixel_remaster_cell(style_soft(cell, g, w, c, s, ct))),
    ("J+F", style_jf),
    ("Neon", style_neon),
    ("Ember", style_ember),
]


def load_orig_st(stem: str, meta: dict) -> Image.Image:
    bkp = BACKUP / f"{stem}_st.webp"
    src = bkp if bkp.exists() else ROOT / f"img/a/{stem}_st.webp"
    # backup copy for review source (don't overwrite if already remastered later)
    if not bkp.exists() and src.exists():
        BACKUP.mkdir(parents=True, exist_ok=True)
        import shutil

        shutil.copy2(src, bkp)
        src = bkp
    return st_cell_from(src, meta)


def tile(cell: Image.Image, bg, label, size=(120, 100)) -> Image.Image:
    up = cell.resize((max(1, cell.width * 2), max(1, cell.height * 2)), Image.Resampling.NEAREST)
    while up.width > size[0] - 6 or up.height > size[1] - 22:
        up = up.resize((max(1, int(up.width * 0.75)), max(1, int(up.height * 0.75))), Image.Resampling.NEAREST)
    t = Image.new("RGB", size, bg)
    t.paste(up, ((size[0] - up.width) // 2, 18 + max(0, (size[1] - 24 - up.height) // 2)), up)
    ImageDraw.Draw(t).text((2, 2), label[:18], fill=(230, 230, 240))
    return t


def main() -> None:
    cat = json.loads(CATALOG.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    rows_data = zone_humanoid_stems()
    print(f"humanoid stems: {len(rows_data)}", flush=True)

    tw, th = 120, 100
    headers = ["GỐC"] + [s[0] for s in STYLES]
    cols = len(headers)
    per_page = 8
    for page_i in range(0, len(rows_data), per_page):
        chunk = rows_data[page_i : page_i + per_page]
        board = Image.new("RGB", (16 + tw * cols, 44 + th * len(chunk)), (8, 10, 18))
        d = ImageDraw.Draw(board)
        d.text(
            (10, 8),
            f"Boss/địch dạng người — duyệt style (CHƯA apply) · trang {page_i // per_page + 1}",
            fill=(230, 210, 160),
        )
        for ci, h in enumerate(headers):
            d.text((16 + ci * tw + 4, 26), h, fill=(180, 190, 210))
        for ri, (stem, name, role) in enumerate(chunk):
            if stem not in cat["stems"]:
                print("skip missing", stem)
                continue
            meta = cat["stems"][stem]["acts"]["st"]
            cell = load_orig_st(stem, meta)
            cname, glow, warm, cool, sat, contrast = pick_color(name, stem)
            board.paste(tile(cell, (28, 70, 45), f"{name[:14]}"), (16, 40 + ri * th))
            for ci, (sname, fn) in enumerate(STYLES):
                out = fn(cell, glow, warm, cool, sat, contrast)
                bg = (glow[0] // 7, glow[1] // 7, glow[2] // 7)
                board.paste(tile(out, bg, f"{cname}"), (16 + (ci + 1) * tw, 40 + ri * th))
                # save sample Soft+F per stem for zoom
                if sname == "Soft+F":
                    out.save(OUT / f"{stem}_soft_f.png")
                    out.save(REVIEW / f"{stem}_soft_f.png")
        outp = OUT / f"board-{page_i // per_page + 1:02d}.png"
        board.save(outp)
        board.save(REVIEW / outp.name)
        board.save(f"/opt/cursor/artifacts/boss_human_board_{page_i // per_page + 1:02d}.png")
        print("board", outp, flush=True)

    # compact Soft+F-only overview
    n = len(rows_data)
    cols_o = 8
    rows_o = (n + cols_o - 1) // cols_o
    overview = Image.new("RGB", (16 + tw * cols_o, 40 + th * rows_o), (8, 10, 18))
    ImageDraw.Draw(overview).text((10, 8), "Boss/humanoid Soft+F preview only (chưa apply)", fill=(230, 210, 160))
    for i, (stem, name, role) in enumerate(rows_data):
        if stem not in cat["stems"]:
            continue
        meta = cat["stems"][stem]["acts"]["st"]
        cell = load_orig_st(stem, meta)
        cname, glow, warm, cool, sat, contrast = pick_color(name, stem)
        out = pixel_remaster_cell(style_soft(cell, glow, warm, cool, sat, contrast))
        r, c = divmod(i, cols_o)
        overview.paste(
            tile(out, (glow[0] // 7, glow[1] // 7, glow[2] // 7), name[:12]),
            (16 + c * tw, 40 + r * th),
        )
    overview.save(OUT / "00-soft-f-overview.png")
    overview.save(REVIEW / "00-soft-f-overview.png")
    overview.save("/opt/cursor/artifacts/boss_human_soft_f_overview.png")

    lines = [
        "# Boss / địch dạng người — chỉ duyệt",
        "",
        "Không ghi đè `img/a` hay `img/m`. Chọn style (+ màu) rồi bảo apply.",
        "",
        "## Styles",
        "- Soft · Soft+F · J+F · Neon · Ember",
        "",
        "## Roster",
    ]
    for stem, name, role in rows_data:
        cname = pick_color(name, stem)[0]
        lines.append(f"- `{stem}` — {name} ({role}) · gợi ý màu **{cname}**")
    (REVIEW / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("done", OUT)


if __name__ == "__main__":
    main()
