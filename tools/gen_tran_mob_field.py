#!/usr/bin/env python3
"""Build preview bầy quái người mặc áo Trần — nhiều sheet enemy/boss."""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_ART = Path("/opt/cursor/artifacts")
OUT_DOC = ROOT / "docs/tran_costume_preview"

# (sheet, w, h, ax, ay) — frame0 dir0 từ *_st.webp
SHEETS = [
    ("enemy122", 59, 49, 29, 47),
    ("enemy050", 56, 58, 28, 55),
    ("enemy076", 52, 55, 26, 52),
    ("enemy107", 60, 58, 30, 55),
    ("enemy129", 58, 52, 29, 50),
    ("boss002", 70, 70, 35, 66),
    ("boss008", 72, 70, 36, 66),
    ("boss015", 68, 72, 34, 68),
]

COSTUMES = [
    ("day", "#6b4e2e", 0.40, "#3f3224", 0.28, "Áo đay"),
    ("cham", "#2f4f6f", 0.42, "#1a3044", 0.30, "Áo chàm"),
    ("reu", "#3a5740", 0.38, "#24382a", 0.26, "Áo rêu"),
    ("muc", "#2c2c32", 0.44, "#16161a", 0.32, "Áo mực"),
    ("son", "#8a3030", 0.42, "#4e1c1c", 0.30, "Áo son"),
    ("kim", "#9a7a2e", 0.40, "#5c4818", 0.28, "Áo kim"),
    ("bach", "#d8d2c4", 0.46, "#8a8478", 0.28, "Áo bạch"),
    ("lam", "#4a6d8c", 0.40, "#2c4458", 0.28, "Áo lam"),
    ("dat", "#5a3a22", 0.44, "#2e1e12", 0.30, "Áo đất"),
    ("thao", "#7a6a38", 0.40, "#4a4020", 0.28, "Áo thảo"),
    ("huyen", "#3a2a3a", 0.42, "#1e1620", 0.32, "Áo huyền"),
    ("ngoc", "#2a5a55", 0.42, "#163832", 0.30, "Áo ngọc"),
    ("hoang", "#c4a035", 0.44, "#6e5818", 0.30, "Áo hoàng"),
    ("tu", "#6a3a58", 0.42, "#3a2030", 0.30, "Áo tử"),
    ("dong", "#8a5a32", 0.44, "#4a3018", 0.30, "Áo đồng"),
    ("lua", "#b04828", 0.44, "#5c2414", 0.30, "Áo lửa"),
    ("sam", "#1e2a3a", 0.46, "#101820", 0.34, "Áo sẫm"),
    ("ho", "#8a5228", 0.42, "#4a2c14", 0.30, "Áo hổ"),
]


def hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def detect_cell(path: Path):
    im = Image.open(path).convert("RGBA")
    # guess cell: first opaque blob in top-left quadrant
    # prefer known meta if sheet name matches
    return im


def load_frame(sheet: str, w: int, h: int) -> Image.Image | None:
    path = ROOT / "img/a" / f"{sheet}_st.webp"
    if not path.exists():
        return None
    im = Image.open(path).convert("RGBA")
    # if sheet wider than w, crop cell; else scale-fit
    if im.width >= w and im.height >= h:
        cell = im.crop((0, 0, w, h))
    else:
        # try square-ish first cell
        cw = min(im.width, w if w else im.width)
        ch = min(im.height, h if h else im.height)
        # auto: use height as cell if multi-dir
        if im.height >= 40 and im.width >= im.height:
            # assume 8 dirs stacked? or frames horizontal
            ch = im.height // 8 if im.height // 8 >= 40 else im.height
            if ch * 8 == im.height:
                cell = im.crop((0, 0, min(w or 64, im.width), ch))
            else:
                cell = im.crop((0, 0, min(96, im.width), min(96, im.height)))
        else:
            cell = im.crop((0, 0, cw, ch))
    if cell.split()[-1].getbbox() is None:
        return None
    return cell


def auto_frame(sheet: str) -> tuple[Image.Image, int, int, int] | None:
    path = ROOT / "img/a" / f"{sheet}_st.webp"
    if not path.exists():
        return None
    im = Image.open(path).convert("RGBA")
    # Prefer: frames in row, dirs in columns — JX often n frames × d dirs
    # Heuristic: find first non-empty tile by scanning common sizes
    for h in (40, 45, 47, 49, 50, 52, 55, 58, 60, 65, 70, 72, 75, 80):
        for w in (40, 45, 50, 52, 55, 56, 58, 59, 60, 65, 68, 70, 72, 80, 90, 97):
            if im.width < w or im.height < h:
                continue
            cell = im.crop((0, 0, w, h))
            bb = cell.split()[-1].getbbox()
            if not bb:
                continue
            # content should fill a reasonable portion
            area = (bb[2] - bb[0]) * (bb[3] - bb[1])
            if area < w * h * 0.08:
                continue
            # next cell empty or similar → good guess if multi-frame
            ay = bb[3] - 2
            return cell, w, h, ay
    # fallback whole top-left 64
    w = min(64, im.width)
    h = min(64, im.height)
    cell = im.crop((0, 0, w, h))
    bb = cell.split()[-1].getbbox() or (0, 0, w, h)
    return cell, w, h, bb[3]


def tint(cell: Image.Image, body_c, body_a, head_c, head_a, ay: int) -> Image.Image:
    im = cell.convert("RGBA")
    w, h = im.size
    head_y = max(0, ay - h * 0.8)
    split = head_y + (ay - head_y) * 0.28
    br, bg, bb = hex_rgb(body_c)
    hr, hg, hb = hex_rgb(head_c)
    px = im.load()
    out = im.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            r0, g0, b0, a0 = px[x, y]
            if a0 < 8:
                continue
            if y < split:
                cr, cg, cb, ca = hr, hg, hb, head_a
            else:
                t = 1.0
                if y < split + 6:
                    t = max(0.0, min(1.0, (y - (split - 4)) / 10.0))
                cr, cg, cb, ca = br, bg, bb, body_a * t
            op[x, y] = (
                int(r0 * (1 - ca) + cr * ca),
                int(g0 * (1 - ca) + cg * ca),
                int(b0 * (1 - ca) + cb * ca),
                a0,
            )
    return out


def main():
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
        font2 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    except Exception:
        font = font2 = ImageFont.load_default()

    OUT_ART.mkdir(parents=True, exist_ok=True)
    OUT_DOC.mkdir(parents=True, exist_ok=True)

    # resolve sheets that exist
    resolved = []
    for name, w, h, ax, ay in SHEETS:
        fr = auto_frame(name)
        if fr:
            cell, ww, hh, aay = fr
            resolved.append((name, cell, aay))
    if not resolved:
        raise SystemExit("no enemy/boss sheets found")

    # field: rows = sheets, cols = costumes (sample subset per row cycling all)
    scale = 3
    cell_w, cell_h = 120, 130
    cols = 6
    # pick 18 costume entries → 3 rows of costumes × sheets mix
    picks = []
    for i, cos in enumerate(COSTUMES):
        sheet = resolved[i % len(resolved)]
        picks.append((sheet, cos))

    rows = (len(picks) + cols - 1) // cols
    W = 16 + cols * (cell_w + 8)
    H = 44 + rows * (cell_h + 8)
    board = Image.new("RGB", (W, H), (18, 22, 20))
    draw = ImageDraw.Draw(board)
    draw.text((12, 12), "Quai nguoi ao Tran — spawn pool (enemy/boss sheets)", fill=(230, 215, 170), font=font)

    for i, ((sname, base, ay), cos) in enumerate(picks):
        key, bc, ba, hc, ha, label = cos
        tinted = tint(base, bc, ba, hc, ha, ay)
        big = tinted.resize((base.width * scale, base.height * scale), Image.NEAREST)
        r, c = divmod(i, cols)
        x0 = 12 + c * (cell_w + 8)
        y0 = 40 + r * (cell_h + 8)
        draw.rectangle([x0, y0, x0 + cell_w - 1, y0 + cell_h - 1], fill=(28, 32, 30), outline=(50, 56, 52))
        bx = x0 + (cell_w - big.width) // 2
        by = y0 + 18 + (cell_h - 36 - big.height) // 2
        board.paste(big, (bx, by), big)
        draw.text((x0 + 4, y0 + 2), f"{key}", fill=(235, 220, 180), font=font2)
        draw.text((x0 + 4, y0 + cell_h - 14), f"{sname}", fill=(140, 150, 140), font=font2)

    out1 = OUT_ART / "tran_costume_mobs.png"
    out2 = OUT_DOC / "mobs_field.png"
    board.save(out1)
    board.save(out2)
    print("OK field", board.size, "→", out1)


if __name__ == "__main__":
    main()
