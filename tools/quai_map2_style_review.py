#!/usr/bin/env python3
"""Map 2 review: nhiều màu + vài style gần J+F — chỉ xuất preview duyệt."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from quai_remaster_jf import BACKUP, ROOT, mythic_cell, pixel_remaster_cell  # noqa: E402

OUT = Path("/opt/cursor/artifacts/thientruong-style-review")
REVIEW = ROOT / "assets/pack/quai-style-review/map2"

WOLVES = [
    ("ani009", "Sói xám"),
    ("ani010", "Sói đỏ"),
    ("ani011", "Sói xanh"),
]

# Nhiều hệ màu (glow RGB, warm, cool, sat, contrast)
COLORS = [
    ("Ám", (100, 50, 240), 0.78, 1.32, 1.30, 1.30),
    ("Hỏa", (255, 95, 15), 1.38, 0.68, 1.50, 1.28),
    ("Lôi", (45, 220, 255), 0.82, 1.38, 1.45, 1.25),
    ("Độc", (80, 230, 70), 0.88, 1.05, 1.45, 1.25),
    ("Băng", (140, 210, 255), 0.75, 1.35, 1.20, 1.22),
    ("Kim", (255, 200, 60), 1.20, 0.85, 1.40, 1.25),
    ("Huyết", (220, 30, 70), 1.25, 0.80, 1.45, 1.28),
    ("U Minh", (60, 40, 90), 0.70, 1.20, 1.15, 1.35),
    ("Hồng Ngọc", (255, 90, 160), 1.15, 1.05, 1.40, 1.22),
    ("Lục Bảo", (40, 180, 140), 0.90, 1.10, 1.35, 1.25),
]


def load_st(stem: str) -> tuple[Image.Image, dict]:
    import json

    cat = json.loads((ROOT / "assets/pack/quai/catalog.json").read_text())
    meta = cat["stems"][stem]["acts"]["st"]
    im = Image.open(BACKUP / f"{stem}_st.webp").convert("RGBA")
    cell = im.crop((0, 2 * meta["h"], meta["w"], 3 * meta["h"]))
    bb = cell.split()[-1].getbbox()
    if bb:
        cell = cell.crop(bb)
    return cell, meta


def style_jf(cell, glow, warm, cool, sat, contrast):
    return pixel_remaster_cell(mythic_cell(cell, glow, warm, cool, sat, contrast))


def style_soft(cell, glow, warm, cool, sat, contrast):
    """Mythic nhẹ hơn — aura mỏng, còn màu gốc nhiều."""
    w, h = cell.size
    up = cell.resize((w * 4, h * 4), Image.Resampling.NEAREST)
    up = ImageEnhance.Contrast(up).enhance(1.12)
    up = ImageEnhance.Color(up).enhance(1.15)
    a = np.asarray(up).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    tint = np.array(glow, dtype=np.float32)
    gray = rgb.mean(axis=2, keepdims=True)
    rgb = rgb * 0.72 + gray * 0.08 + tint * 0.20
    mask = Image.fromarray(np.clip(alpha, 0, 255).astype(np.uint8))
    edge = np.asarray(mask.filter(ImageFilter.FIND_EDGES)).astype(np.float32) / 255.0
    edge = np.clip(edge * 1.8, 0, 1)
    dil = np.asarray(mask.filter(ImageFilter.MaxFilter(7))).astype(np.float32)
    ring = (dil > 40) & (alpha <= 40)
    for i in range(3):
        rgb[..., i] = np.where(edge > 0.05, np.clip(rgb[..., i] * 0.85 + glow[i] * edge * 0.7, 0, 255), rgb[..., i])
    out_a = alpha.copy()
    for i in range(3):
        rgb[..., i] = np.where(ring, glow[i] * 0.45, rgb[..., i])
    out_a = np.where(ring, np.maximum(out_a, 100), out_a)
    out = np.dstack([rgb.clip(0, 255), out_a.clip(0, 255)]).astype(np.uint8)
    return Image.fromarray(out, "RGBA").resize((w, h), Image.Resampling.NEAREST)


def style_neon(cell, glow, warm, cool, sat, contrast):
    """Neon đậm — rim sáng + body tối hơn."""
    base = mythic_cell(cell, glow, warm * 0.9, cool * 1.1, sat * 1.15, contrast * 1.1)
    w, h = base.size
    up = base.resize((w * 4, h * 4), Image.Resampling.NEAREST)
    a = np.asarray(up).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    # darken mid, boost glow edges
    gray = rgb.mean(axis=2, keepdims=True)
    rgb = rgb * 0.65 + gray * 0.1
    mask = Image.fromarray(np.clip(alpha, 0, 255).astype(np.uint8))
    edge = np.asarray(mask.filter(ImageFilter.FIND_EDGES)).astype(np.float32) / 255.0
    edge = np.clip(edge * 3.0, 0, 1)
    dil = np.asarray(mask.filter(ImageFilter.MaxFilter(9))).astype(np.float32)
    ring = (dil > 40) & (alpha <= 40)
    for i in range(3):
        rgb[..., i] = np.clip(rgb[..., i] + edge * glow[i] * 1.2, 0, 255)
        rgb[..., i] = np.where(ring, np.clip(glow[i] * 1.05, 0, 255), rgb[..., i])
    out_a = np.where(ring, np.maximum(alpha, 210), alpha)
    out = np.dstack([rgb.clip(0, 255), out_a.clip(0, 255)]).astype(np.uint8)
    crisp = Image.fromarray(out, "RGBA").resize((w, h), Image.Resampling.NEAREST)
    return pixel_remaster_cell(crisp)


def style_ember(cell, glow, warm, cool, sat, contrast):
    """Thân tối + lõi sáng / viền lửa-linh."""
    w, h = cell.size
    up = cell.resize((w * 4, h * 4), Image.Resampling.NEAREST)
    up = ImageEnhance.Contrast(up).enhance(1.35)
    a = np.asarray(up).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    gray = rgb.mean(axis=2, keepdims=True)
    # darken body
    rgb = gray * 0.35 + np.array(glow, dtype=np.float32) * 0.15
    lum = (a[..., :3].mean(axis=2) / 255.0)
    core = np.clip((lum - 0.35) * 2.5, 0, 1)
    for i in range(3):
        rgb[..., i] = np.clip(rgb[..., i] + core * glow[i] * 0.85, 0, 255)
    mask = Image.fromarray(np.clip(alpha, 0, 255).astype(np.uint8))
    edge = np.asarray(mask.filter(ImageFilter.FIND_EDGES)).astype(np.float32) / 255.0
    edge = np.clip(edge * 2.5, 0, 1)
    dil = np.asarray(mask.filter(ImageFilter.MaxFilter(7))).astype(np.float32)
    ring = (dil > 40) & (alpha <= 40)
    for i in range(3):
        rgb[..., i] = np.where(edge > 0.05, np.clip(glow[i] * edge * 1.1 + rgb[..., i] * 0.4, 0, 255), rgb[..., i])
        rgb[..., i] = np.where(ring, glow[i] * 0.75, rgb[..., i])
    out_a = np.where(ring, np.maximum(alpha, 170), alpha)
    out = np.dstack([rgb.clip(0, 255), out_a.clip(0, 255)]).astype(np.uint8)
    return pixel_remaster_cell(Image.fromarray(out, "RGBA").resize((w, h), Image.Resampling.NEAREST))


def style_crystal(cell, glow, warm, cool, sat, contrast):
    """Crystal — highlight trắng + tint lạnh."""
    base = mythic_cell(cell, glow, 0.7, 1.4, 1.2, 1.2)
    w, h = base.size
    up = base.resize((w * 4, h * 4), Image.Resampling.NEAREST)
    a = np.asarray(up).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    gray = rgb.mean(axis=2)
    hi = np.clip((gray / 255.0 - 0.55) * 3.0, 0, 1)
    for i in range(3):
        rgb[..., i] = np.clip(rgb[..., i] * 0.85 + hi * 220, 0, 255)
    out = np.dstack([rgb.clip(0, 255), alpha]).astype(np.uint8)
    return pixel_remaster_cell(Image.fromarray(out, "RGBA").resize((w, h), Image.Resampling.NEAREST))


STYLES = [
    ("J+F", style_jf),
    ("Soft", style_soft),
    ("Neon", style_neon),
    ("Ember", style_ember),
    ("Crystal", style_crystal),
]


def tile(cell: Image.Image, bg, label, size=(140, 120)) -> Image.Image:
    up = cell.resize((max(1, cell.width * 3), max(1, cell.height * 3)), Image.Resampling.NEAREST)
    t = Image.new("RGB", size, bg)
    t.paste(up, ((size[0] - up.width) // 2, 22 + max(0, (size[1] - 28 - up.height) // 2)), up)
    ImageDraw.Draw(t).text((4, 4), label[:18], fill=(230, 230, 240))
    return t


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)

    # --- Board 1: nhiều màu (J+F) ---
    tw, th = 140, 120
    cols = len(COLORS) + 1  # + gốc
    rows = len(WOLVES)
    board = Image.new("RGB", (16 + tw * cols, 40 + th * rows), (8, 10, 18))
    d = ImageDraw.Draw(board)
    d.text((12, 10), "Thiên Trường — đa dạng màu (J Mythic + F remaster) · duyệt", fill=(230, 210, 160))
    for ci, (cname, *_) in enumerate([("GỐC", (0, 0, 0), 1, 1, 1, 1)] + COLORS):
        d.text((16 + ci * tw + 4, 28), cname, fill=(180, 190, 210))
    for ri, (stem, wname) in enumerate(WOLVES):
        cell, _ = load_st(stem)
        # gốc
        board.paste(tile(cell, (28, 70, 45), wname), (16, 40 + ri * th))
        for ci, (cname, glow, warm, cool, sat, contrast) in enumerate(COLORS):
            out = style_jf(cell, glow, warm, cool, sat, contrast)
            bg = (glow[0] // 7, glow[1] // 7, glow[2] // 7)
            board.paste(tile(out, bg, cname), (16 + (ci + 1) * tw, 40 + ri * th))
            out.save(OUT / f"{stem}_{cname}.png")
    board.save(OUT / "01-colors-board.png")
    board.save("/opt/cursor/artifacts/thientruong_colors_board.png")
    board.save(REVIEW / "01-colors-board.png")
    print("colors board", board.size)

    # --- Board 2: style gần J+F (dùng 3 hệ Ám/Hỏa/Lôi mặc định theo sói) ---
    default_color = {
        "ani009": COLORS[0],  # Ám
        "ani010": COLORS[1],  # Hỏa
        "ani011": COLORS[2],  # Lôi
    }
    cols2 = len(STYLES) + 1
    board2 = Image.new("RGB", (16 + tw * cols2, 40 + th * rows), (8, 10, 18))
    d2 = ImageDraw.Draw(board2)
    d2.text((12, 10), "Style gần J+F — Soft / Neon / Ember / Crystal (duyệt)", fill=(230, 210, 160))
    headers = ["GỐC"] + [s[0] for s in STYLES]
    for ci, h in enumerate(headers):
        d2.text((16 + ci * tw + 4, 28), h, fill=(180, 190, 210))
    for ri, (stem, wname) in enumerate(WOLVES):
        cell, _ = load_st(stem)
        cname, glow, warm, cool, sat, contrast = default_color[stem]
        board2.paste(tile(cell, (28, 70, 45), wname), (16, 40 + ri * th))
        for ci, (sname, fn) in enumerate(STYLES):
            out = fn(cell, glow, warm, cool, sat, contrast)
            bg = (glow[0] // 7, glow[1] // 7, glow[2] // 7)
            board2.paste(tile(out, bg, f"{sname}"), (16 + (ci + 1) * tw, 40 + ri * th))
            out.save(OUT / f"{stem}_style_{sname}.png")
    board2.save(OUT / "02-styles-board.png")
    board2.save("/opt/cursor/artifacts/thientruong_styles_board.png")
    board2.save(REVIEW / "02-styles-board.png")
    print("styles board", board2.size)

    # --- Board 3: mix gợi ý (mỗi sói 1 hàng màu khác nhau) ---
    picks = [
        ("ani009", "Sói xám", [("Ám", COLORS[0]), ("U Minh", COLORS[7]), ("Băng", COLORS[4]), ("Kim", COLORS[5])]),
        ("ani010", "Sói đỏ", [("Hỏa", COLORS[1]), ("Huyết", COLORS[6]), ("Hồng Ngọc", COLORS[8]), ("Kim", COLORS[5])]),
        ("ani011", "Sói xanh", [("Lôi", COLORS[2]), ("Độc", COLORS[3]), ("Lục Bảo", COLORS[9]), ("Băng", COLORS[4])]),
    ]
    cols3 = 5
    board3 = Image.new("RGB", (16 + tw * cols3, 40 + th * 3), (8, 10, 18))
    d3 = ImageDraw.Draw(board3)
    d3.text((12, 10), "Gợi ý mix màu đa dạng / sói (J+F) — chọn combo", fill=(230, 210, 160))
    for ri, (stem, wname, opts) in enumerate(picks):
        cell, _ = load_st(stem)
        board3.paste(tile(cell, (28, 70, 45), "Gốc"), (16, 40 + ri * th))
        for ci, (cname, params) in enumerate(opts):
            _, glow, warm, cool, sat, contrast = params
            out = style_jf(cell, glow, warm, cool, sat, contrast)
            bg = (glow[0] // 7, glow[1] // 7, glow[2] // 7)
            board3.paste(tile(out, bg, f"{wname[:6]}·{cname}"), (16 + (ci + 1) * tw, 40 + ri * th))
    board3.save(OUT / "03-mix-suggestions.png")
    board3.save("/opt/cursor/artifacts/thientruong_mix_suggestions.png")
    board3.save(REVIEW / "03-mix-suggestions.png")

    readme = REVIEW / "README.md"
    readme.write_text(
        """# Thiên Trường map2 — duyệt màu & style

## Màu (J+F)
Ám · Hỏa · Lôi · Độc · Băng · Kim · Huyết · U Minh · Hồng Ngọc · Lục Bảo

## Style gần J+F
- **J+F**: Mythic aura + Pixel remaster (đang dùng map1)
- **Soft**: mythic nhẹ, còn màu gốc nhiều
- **Neon**: rim sáng, thân tối hơn
- **Ember**: thân tối + lõi/viền sáng
- **Crystal**: highlight trắng / lạnh

Chọn: `style + màu/sói` (vd `Neon + Huyết cho Sói đỏ`) rồi apply.
""",
        encoding="utf-8",
    )
    print("done", OUT)


if __name__ == "__main__":
    main()
