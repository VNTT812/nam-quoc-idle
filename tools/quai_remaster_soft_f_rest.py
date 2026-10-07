#!/usr/bin/env python3
"""Soft+F cho toàn bộ quái thú còn lại (ani*) — không đụng enemy/boss người."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from quai_remaster_jf import ACTS, BACKUP, CATALOG, ROOT  # noqa: E402
from quai_soft_f_lib import (  # noqa: E402
    apply_soft_f,
    color_style,
    st_cell_from,
)

OUT = Path("/opt/cursor/artifacts/quai-soft-f-rest")
REVIEW = ROOT / "assets/pack/quai-style-review/rest-animals"

# stem → (tên hiển thị, hệ màu Soft+F)
ANIMALS = {
    "ani001": ("Đông Bắc hổ", "Kim"),
    "ani002": ("Hoa Nam hổ", "Hỏa"),
    "ani003": ("Bạch Hổ", "Băng"),
    "ani005": ("Kim Tiền báo", "Kim"),
    "ani006": ("Báo trắng", "Băng"),
    "ani012": ("Sói tuyết", "Băng"),
    "ani013": ("Hồ ly", "Hồng Ngọc"),
    "ani015": ("Hỏa Hồ", "Hỏa"),
    "ani021": ("Đại Tượng", "Kim"),
    "ani024": ("Voi Hoàng hà", "Hỏa"),
    "ani025": ("Gấu nâu", "Kim"),
    "ani026": ("Gấu đen", "U Minh"),
    "ani029": ("Trâu rừng", "Lục Bảo"),
    "ani033": ("Cá sấu", "Lục Bảo"),
    "ani036": ("Thằn lằn đỏ", "Huyết"),
    "ani037": ("Nhãn Kính Mãng xà", "Độc"),
    "ani038": ("Rắn xanh", "Lục Bảo"),
    "ani039": ("Kim Hoàn Mãng Xà", "Kim"),
    "ani040": ("Xích Luyện Xà", "Huyết"),
    "ani041": ("Kim Điêu", "Kim"),
    "ani042": ("Thương ưng", "Lôi"),
    "ani043": ("Kền Kền", "U Minh"),
    "ani045": ("Dơi chúa", "Ám"),
    "ani046": ("Dơi chúa đỏ", "Huyết"),
    "ani047": ("Dơi Dong", "Lôi"),
    "ani048": ("Dơi hút máu", "Huyết"),
    "ani049": ("Kim Miêu", "Kim"),
    "ani053": ("Tàng Vực hầu", "Ám"),
    "ani054": ("Khỉ xám", "Lục Bảo"),
    "ani055": ("Hắc Diệp Hầu", "U Minh"),
    "ani058": ("Sài", "Hỏa"),
    "ani059": ("Tuyết Quái", "Băng"),
    "ani060": ("Cóc", "Độc"),
    "ani061": ("Hươu đốm", "Lục Bảo"),
    "ani063": ("Heo trắng", "Băng"),
    "ani065": ("Bọ cạp", "Độc"),
    "ani066": ("Nhện", "Ám"),
    "ani067": ("Rết", "Huyết"),
}

CACHE_V = "312"


def tile(cell: Image.Image, bg, label, size=(132, 110)) -> Image.Image:
    up = cell.resize((max(1, cell.width * 3), max(1, cell.height * 3)), Image.Resampling.NEAREST)
    # scale down if huge (voi/hổ)
    while up.width > size[0] - 8 or up.height > size[1] - 28:
        up = up.resize((max(1, up.width * 2 // 3), max(1, up.height * 2 // 3)), Image.Resampling.NEAREST)
    t = Image.new("RGB", size, bg)
    t.paste(up, ((size[0] - up.width) // 2, 20 + max(0, (size[1] - 28 - up.height) // 2)), up)
    ImageDraw.Draw(t).text((3, 3), label[:20], fill=(230, 230, 240))
    return t


def bump_world_cache(stems: list[str], ver: str) -> None:
    import re

    path = ROOT / "world.js"
    text = path.read_text(encoding="utf-8")
    for stem in stems:
        for act in ACTS:
            pat = rf'("{stem}_{act}\.webp)(\?v=\d+)?"'
            text = re.sub(pat, rf'\1?v={ver}"', text)
    path.write_text(text, encoding="utf-8")


def bump_index_sw(ver: str) -> None:
    import re

    for name in ("index.html", "sw.js"):
        p = ROOT / name
        if not p.exists():
            continue
        t = p.read_text(encoding="utf-8")
        t2 = re.sub(r"\?v=\d+", f"?v={ver}", t)
        # sw may use CACHE_V = number
        t2 = re.sub(r"(CACHE_V\s*=\s*)\d+", rf"\g<1>{ver}", t2)
        t2 = re.sub(r"(cacheName\s*=\s*['\"][^'\"]*?)\d+(['\"])", rf"\g<1>{ver}\2", t2)
        if t2 != t:
            p.write_text(t2, encoding="utf-8")


def main() -> None:
    cat = json.loads(CATALOG.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)

    before_after = []
    for stem, (name, cname) in ANIMALS.items():
        style = color_style(name, cname)
        meta = cat["stems"][stem]["acts"]["st"]
        before = st_cell_from(BACKUP / f"{stem}_st.webp" if (BACKUP / f"{stem}_st.webp").exists() else ROOT / f"img/a/{stem}_st.webp", meta)
        # backup before apply (ensure_backup inside apply)
        apply_soft_f(stem, style, cat)
        after = st_cell_from(ROOT / f"img/a/{stem}_st.webp", meta)
        glow = style[1]
        before_after.append((stem, name, cname, before, after, glow))
        print("ok", stem, style[0], flush=True)

    bump_world_cache(list(ANIMALS.keys()), CACHE_V)
    bump_index_sw(CACHE_V)

    # boards: 2 cột (gốc | Soft+F), nhiều hàng — chia trang
    tw, th = 132, 110
    cols = 2
    per_page = 12
    pages = []
    for page_i in range(0, len(before_after), per_page):
        chunk = before_after[page_i : page_i + per_page]
        rows = len(chunk)
        board = Image.new("RGB", (24 + tw * cols * 2 + 40, 48 + th * rows), (8, 10, 18))
        d = ImageDraw.Draw(board)
        d.text(
            (12, 10),
            f"Quái thú Soft+F (trang {page_i // per_page + 1}) — GỐC | Soft+F · cache v={CACHE_V}",
            fill=(230, 210, 160),
        )
        for ri, (stem, name, cname, before, after, glow) in enumerate(chunk):
            y = 40 + ri * th
            board.paste(tile(before, (28, 70, 45), f"{name}"), (16, y))
            board.paste(
                tile(after, (glow[0] // 7, glow[1] // 7, glow[2] // 7), f"{cname}"),
                (16 + tw + 8, y),
            )
            # second pair slot unused — keep compact 2-col
        outp = OUT / f"01-board-{page_i // per_page + 1:02d}.png"
        board.save(outp)
        board.save(REVIEW / outp.name)
        pages.append(board)
        print("board", outp)

    # overview strip: all after tiles
    n = len(before_after)
    cols_o = 8
    rows_o = (n + cols_o - 1) // cols_o
    overview = Image.new("RGB", (16 + tw * cols_o, 40 + th * rows_o), (8, 10, 18))
    ImageDraw.Draw(overview).text((12, 10), f"Soft+F remaining animals overview · v={CACHE_V}", fill=(230, 210, 160))
    for i, (stem, name, cname, before, after, glow) in enumerate(before_after):
        r, c = divmod(i, cols_o)
        overview.paste(
            tile(after, (glow[0] // 7, glow[1] // 7, glow[2] // 7), f"{name[:10]}"),
            (16 + c * tw, 40 + r * th),
        )
    overview.save(OUT / "00-overview.png")
    overview.save(REVIEW / "00-overview.png")
    overview.save("/opt/cursor/artifacts/quai_soft_f_rest_overview.png")

    (REVIEW / "README.md").write_text(
        f"""# Soft+F — quái thú còn lại

Đã áp **Soft → Pixel remaster** cho {len(ANIMALS)} stem `ani*` (chưa đụng enemy/boss người).

Cache `?v={CACHE_V}` trên sheet trong `world.js` + index/sw.

## Hệ màu gán theo loại
"""
        + "\n".join(f"- `{s}` {n} → **{c}**" for s, (n, c) in ANIMALS.items())
        + "\n\nBoss/địch dạng người: xem `assets/pack/quai-style-review/boss-human/` (chỉ duyệt, chưa apply).\n",
        encoding="utf-8",
    )
    print("done", OUT, "n=", len(ANIMALS))


if __name__ == "__main__":
    main()
