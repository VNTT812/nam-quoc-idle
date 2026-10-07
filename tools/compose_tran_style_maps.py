#!/usr/bin/env python3
"""Ghép map phong cách VLTK + hơi Trần: giữ layout gốc (khớp vật cản), phủ texture AI isometric."""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
Z = ROOT / "img" / "z"
TILES = Z / "_tran_tiles"
REV_ORIG = "cf2d468"  # bản map gốc game

# zone stem -> tile stem
THEME = {
    "2": "tran-yen-tu-map",
    "3": "tran-thang-long-map",
    "7": "tran-thang-long-map",
    "19": "tran-con-son-map",
    "21": "tran-con-son-map",
    "41": "tran-con-son-map",
    "90": "tran-bach-dang-map",
    "70": "tran-bach-dang-map",
    "92": "tran-con-son-map",
    "56": "tran-van-don-map",
    "122": "tran-bach-dang-map",
    "140": "tran-yen-tu-map",
    "224": "tran-thang-long-map",
    "319": "tran-con-son-map",
    "320": "tran-yen-tu-map",
    "322": "tran-yen-tu-map",
    "town": "tran-thang-long-map",
    "195": "tran-yen-tu-map",
    "43": "tran-con-son-map",
    "179": "tran-con-son-map",
    "193": "tran-yen-tu-map",
    "74": "tran-con-son-map",
    "145": "tran-cave-map",
    "167": "tran-yen-tu-map",
    "68": "tran-van-don-map",
    "342": "tran-van-don-map",
    "341": "tran-van-don-map",
    "123": "tran-cave-map",
    "93": "tran-cave-map",
    "75": "tran-cave-map",
    "336": "tran-van-don-map",
    "337": "tran-van-don-map",
    "340": "tran-cave-map",
    "201": "tran-cave-map",
    "205": "tran-cave-map",
    "400": "tran-pho-minh-map",
    "401": "tran-ho-tay-map",
}


def load_orig(stem: str) -> Image.Image:
    import subprocess

    data = subprocess.check_output(["git", "show", f"{REV_ORIG}:img/z/{stem}.jpg"])
    from io import BytesIO

    return Image.open(BytesIO(data)).convert("RGB")


def tile_fill(tile: Image.Image, W: int, H: int, seed: int) -> Image.Image:
    """Lát tile AI lên canvas lớn, flip + lệch nhẹ để bớt lặp."""
    rng = np.random.default_rng(seed)
    tw = max(W // 2, 1400)
    base = tile.resize((tw, tw), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H))
    variants = [
        base,
        base.transpose(Image.FLIP_LEFT_RIGHT),
        base.transpose(Image.FLIP_TOP_BOTTOM),
        base.transpose(Image.FLIP_LEFT_RIGHT).transpose(Image.FLIP_TOP_BOTTOM),
    ]
    # slight color variants
    colored = []
    for i, v in enumerate(variants):
        e = ImageEnhance.Color(v).enhance(0.92 + (i % 3) * 0.04)
        e = ImageEnhance.Brightness(e).enhance(0.94 + (i % 2) * 0.06)
        colored.append(e)
    step = tw - 180
    yi = 0
    for y in range(-100, H + 100, step):
        xi = 0
        for x in range(-100, W + 100, step):
            v = colored[(xi + yi + seed) % len(colored)]
            if rng.random() < 0.35:
                v = ImageEnhance.Contrast(v).enhance(1.05)
            canvas.paste(v, (x, y))
            xi += 1
        yi += 1
    return canvas.filter(ImageFilter.SMOOTH)


def structure_mask(orig: Image.Image) -> Image.Image:
    """Mask sáng = đường/đất trống (giữ layout gốc), tối = cây/đá."""
    g = np.asarray(orig.convert("L"), dtype=np.float32)
    # paths are usually mid-bright brown; foliage darker green
    arr = np.asarray(orig, dtype=np.float32)
    r, gg, b = arr[..., 0], arr[..., 1], arr[..., 2]
    greenish = (gg > r + 8) & (gg > b + 5)
    pathish = (r > 70) & (gg > 60) & (b > 40) & (np.abs(r - gg) < 35) & ~greenish
    m = np.zeros_like(g)
    m[pathish] = 200
    m[greenish] = 40
    m[~pathish & ~greenish] = 100
    im = Image.fromarray(m.astype(np.uint8), "L")
    return im.filter(ImageFilter.GaussianBlur(8))


def compose(stem: str, tile_name: str, out_path: Path | None = None) -> Path:
    orig = load_orig(stem)
    W, H = orig.size
    tile = Image.open(TILES / f"{tile_name}.jpg").convert("RGB")
    # also mix in style-match for temple maps
    filled = tile_fill(tile, W, H, seed=hash(stem) % 10000)

    # keep original structure: paths from orig show through
    mask = structure_mask(orig)
    # where pathish (bright mask), prefer more original; foliage prefer AI
    # blend: out = AI*(1-a) + orig*a, a higher on paths
    a = np.asarray(mask, dtype=np.float32) / 255.0
    a = 0.25 + 0.45 * a  # 0.25..0.70 original
    a = a[..., None]
    ai = np.asarray(filled, dtype=np.float32)
    og = np.asarray(orig, dtype=np.float32)
    out = ai * (1.0 - a) + og * a

    # warm Vietnamese grade
    out[..., 0] = np.clip(out[..., 0] * 1.04 + 4, 0, 255)  # slight warm
    out[..., 1] = np.clip(out[..., 1] * 1.02, 0, 255)
    out[..., 2] = np.clip(out[..., 2] * 0.97, 0, 255)

    img = Image.fromarray(out.astype(np.uint8), "RGB")
    img = ImageEnhance.Contrast(img).enhance(1.06)
    img = ImageEnhance.Color(img).enhance(0.98)
    img = img.filter(ImageFilter.SMOOTH_MORE)

    # stamp a few clear AI landmarks (architecture) without covering whole map
    stamp = tile.resize((900, 900), Image.LANCZOS)
    # soft circular alpha
    alpha = Image.new("L", stamp.size, 0)
    from PIL import ImageDraw

    d = ImageDraw.Draw(alpha)
    d.ellipse([40, 40, 860, 860], fill=210)
    alpha = alpha.filter(ImageFilter.GaussianBlur(28))
    rgba = stamp.copy()
    rgba.putalpha(alpha)
    # place 2-3 stamps away from exact center so walkable center less blocked visually
    positions = [(W // 2 - 450, H // 2 - 520), (W // 5, H // 4), (3 * W // 5, 3 * H // 5)]
    base = img.convert("RGBA")
    for i, pos in enumerate(positions[: 2 + (hash(stem) % 2)]):
        s = rgba if i == 0 else stamp.transpose(Image.FLIP_LEFT_RIGHT)
        if i:
            sa = alpha.transpose(Image.FLIP_LEFT_RIGHT) if i else alpha
            s = stamp.transpose(Image.FLIP_LEFT_RIGHT).copy()
            s.putalpha(sa)
        base.alpha_composite(s.convert("RGBA"), dest=pos)
    img = base.convert("RGB")

    dest = out_path or (Z / f"{stem}.jpg")
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, quality=85, optimize=True)
    return dest


def bump_cache():
    idx = ROOT / "index.html"
    text = idx.read_text(encoding="utf-8")
    m = re.search(r"\?v=(\d+)", text)
    ver = int(m.group(1)) + 1 if m else 212
    text = re.sub(r"\?v=\d+", f"?v={ver}", text)
    idx.write_text(text, encoding="utf-8")
    sw = ROOT / "sw.js"
    s = sw.read_text(encoding="utf-8")
    s = re.sub(r"jxidle-v\d+", f"jxidle-v{ver}", s)
    s = re.sub(r"jxidle-img-\d+", f"jxidle-img-{ver}", s)
    sw.write_text(s, encoding="utf-8")
    return ver


def main():
    assert TILES.is_dir(), TILES
    for i, (stem, tile) in enumerate(THEME.items()):
        print(f"[{i+1}/{len(THEME)}] {stem} <- {tile}", flush=True)
        p = compose(stem, tile)
        print(f"  -> {p.name} {p.stat().st_size//1024}KB", flush=True)
    ver = bump_cache()
    print(f"Done v{ver}", flush=True)


if __name__ == "__main__":
    main()
