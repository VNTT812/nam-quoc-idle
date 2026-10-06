#!/usr/bin/env python3
"""Map 2 Thiên Trường — J Mythic + F Pixel remaster (3 sói) for review."""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

# reuse cell pipelines from map1 JF tool
sys.path.insert(0, str(Path(__file__).resolve().parent))
from quai_remaster_jf import (  # noqa: E402
    ACTS,
    BACKUP,
    CATALOG,
    ROOT,
    jf_cell,
    remaster_sheet,
    remaster_portrait,
)

from PIL import Image, ImageDraw

OUT = Path("/opt/cursor/artifacts/thientruong-jf-remaster")

# Sói xám=Ám · Sói đỏ=Hỏa · Sói xanh=Lôi
STYLES = {
    "ani009": ("Sói xám · Ám + F", (100, 50, 240), 0.78, 1.32, 1.30, 1.30),
    "ani010": ("Sói đỏ · Hỏa + F", (255, 95, 15), 1.38, 0.68, 1.50, 1.28),
    "ani011": ("Sói xanh · Lôi + F", (45, 220, 255), 0.82, 1.38, 1.45, 1.25),
}


def preview(stem: str, meta: dict, style, path: Path) -> None:
    label, glow, *_ = style
    tiles = []
    for act in ACTS:
        m = meta[act]
        im = Image.open(ROOT / f"img/a/{stem}_{act}.webp").convert("RGBA")
        cell = im.crop(
            (
                0,
                min(2 * m["h"], max(0, im.height - 1)),
                min(m["w"], im.width),
                min(3 * m["h"], im.height),
            )
        )
        bb = cell.split()[-1].getbbox()
        if bb:
            cell = cell.crop(bb)
        up = cell.resize((max(1, cell.width * 4), max(1, cell.height * 4)), Image.Resampling.NEAREST)
        tile = Image.new("RGB", (160, 140), (glow[0] // 6, glow[1] // 6, glow[2] // 6))
        tile.paste(up, ((160 - up.width) // 2, 28 + max(0, (100 - up.height) // 2)), up)
        ImageDraw.Draw(tile).text((6, 6), act, fill=(230, 235, 255))
        tiles.append(tile)
    strip = Image.new("RGB", (20 + 165 * len(tiles), 170), (8, 10, 18))
    ImageDraw.Draw(strip).text((10, 6), label, fill=(glow[0], glow[1], glow[2]))
    for i, t in enumerate(tiles):
        strip.paste(t, (10 + i * 165, 24))
    path.parent.mkdir(parents=True, exist_ok=True)
    strip.save(path)


def main() -> None:
    cat = json.loads(CATALOG.read_text())
    BACKUP.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    strips = []
    for stem, style in STYLES.items():
        acts = cat["stems"][stem]["acts"]
        for act in ACTS:
            src = ROOT / f"img/a/{stem}_{act}.webp"
            bkp = BACKUP / f"{stem}_{act}.webp"
            if not bkp.exists():
                shutil.copy2(src, bkp)
            remaster_sheet(bkp, acts[act]["n"], acts[act]["d"], acts[act]["w"], acts[act]["h"], src, style)
            pack = ROOT / f"assets/pack/quai/stems/{stem}/{act}.webp"
            if pack.parent.exists():
                if pack.exists():
                    pack.unlink()
                shutil.copy2(src, pack)
        pb = BACKUP / f"{stem}_portrait.png"
        por = ROOT / f"img/m/{stem}.png"
        if por.exists() and not pb.exists():
            shutil.copy2(por, pb)
        if pb.exists():
            remaster_portrait(pb, por, style)
        p = OUT / f"{stem}_jf.png"
        preview(stem, acts, style, p)
        strips.append(Image.open(p))
        print("ok", stem, style[0])

    # before/after board
    before_tiles = []
    for stem, style in STYLES.items():
        label, glow, *_ = style
        m = cat["stems"][stem]["acts"]["st"]
        im = Image.open(BACKUP / f"{stem}_st.webp").convert("RGBA")
        cell = im.crop((0, min(2 * m["h"], im.height - 1), min(m["w"], im.width), min(3 * m["h"], im.height)))
        bb = cell.split()[-1].getbbox()
        if bb:
            cell = cell.crop(bb)
        up = cell.resize((max(1, cell.width * 4), max(1, cell.height * 4)), Image.Resampling.NEAREST)
        t = Image.new("RGB", (160, 140), (28, 70, 45))
        t.paste(up, ((160 - up.width) // 2, 28 + max(0, (100 - up.height) // 2)), up)
        ImageDraw.Draw(t).text((6, 6), label.split(" · ")[0], fill=(255, 240, 180))
        before_tiles.append(t)

    after = strips
    W = 20 + 165 * 3
    board = Image.new("RGB", (W, 36 + 170 * 2 + 20), (6, 8, 16))
    d = ImageDraw.Draw(board)
    d.text((12, 10), "Thiên Trường (map 2) — GỐC vs J Mythic + F remaster (duyệt)", fill=(230, 210, 160))
    d.text((12, 36), "GỐC", fill=(180, 200, 160))
    for i, t in enumerate(before_tiles):
        board.paste(t, (10 + i * 165, 52))
    d.text((12, 210), "J+F", fill=(200, 180, 255))
    for i, t in enumerate(after):
        # crop just first tile from strip? strips are full act rows — use st only from after strips
        # rebuild st-only from current sheets
        pass

    # rebuild after as st-only matching before layout
    after_tiles = []
    for stem, style in STYLES.items():
        label, glow, *_ = style
        m = cat["stems"][stem]["acts"]["st"]
        im = Image.open(ROOT / f"img/a/{stem}_st.webp").convert("RGBA")
        cell = im.crop((0, min(2 * m["h"], im.height - 1), min(m["w"], im.width), min(3 * m["h"], im.height)))
        bb = cell.split()[-1].getbbox()
        if bb:
            cell = cell.crop(bb)
        up = cell.resize((max(1, cell.width * 4), max(1, cell.height * 4)), Image.Resampling.NEAREST)
        t = Image.new("RGB", (160, 140), (glow[0] // 6, glow[1] // 6, glow[2] // 6))
        t.paste(up, ((160 - up.width) // 2, 28 + max(0, (100 - up.height) // 2)), up)
        ImageDraw.Draw(t).text((6, 6), label, fill=(glow[0], min(255, glow[1] + 40), glow[2]))
        after_tiles.append(t)
    for i, t in enumerate(after_tiles):
        board.paste(t, (10 + i * 165, 226))
    board.save(OUT / "00-before-after.png")
    board.save("/opt/cursor/artifacts/thientruong_jf_before_after.png")

    # full acts board
    W2 = max(s.width for s in strips)
    H2 = sum(s.height for s in strips) + 10 * (len(strips) - 1) + 36
    board2 = Image.new("RGB", (W2, H2), (6, 8, 16))
    ImageDraw.Draw(board2).text((12, 10), "Thiên Trường — J+F full acts (st/run/at/hurt/die)", fill=(230, 210, 160))
    y = 32
    for s in strips:
        board2.paste(s, (0, y))
        y += s.height + 10
    board2.save(OUT / "00-acts-board.png")
    board2.save("/opt/cursor/artifacts/thientruong_jf_acts.png")
    print("done", OUT)


if __name__ == "__main__":
    main()
