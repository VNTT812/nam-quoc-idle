#!/usr/bin/env python3
"""Giữ bố cục map gốc (đường / đá / vật cản), phủ lại đất–cây–nhà phong cách Trần.

Chạy: python3 tools/reskin_tran_layout.py 7
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import deque
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
Z = ROOT / "img" / "z"
TILES = Z / "_tran_tiles"
ORIG_REV = "5f51470"
CW, CH = 32, 16


def load_orig(stem: str) -> Image.Image:
    data = subprocess.check_output(["git", "show", f"{ORIG_REV}:img/z/{stem}.jpg"])
    return Image.open(BytesIO(data)).convert("RGB")


def tile_fill(tile: Image.Image, W: int, H: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    tw = max(W // 2, 1200)
    base = tile.resize((tw, tw), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H))
    variants = [
        base,
        base.transpose(Image.FLIP_LEFT_RIGHT),
        base.transpose(Image.FLIP_TOP_BOTTOM),
        base.transpose(Image.FLIP_LEFT_RIGHT).transpose(Image.FLIP_TOP_BOTTOM),
    ]
    colored = []
    for i, v in enumerate(variants):
        e = ImageEnhance.Color(v).enhance(0.9 + (i % 3) * 0.04)
        e = ImageEnhance.Brightness(e).enhance(0.93 + (i % 2) * 0.05)
        colored.append(e)
    step = tw - 160
    yi = 0
    for y in range(-80, H + 80, step):
        xi = 0
        for x in range(-80, W + 80, step):
            v = colored[(xi + yi + seed) % len(colored)]
            if rng.random() < 0.3:
                v = ImageEnhance.Contrast(v).enhance(1.06)
            canvas.paste(v, (x, y))
            xi += 1
        yi += 1
    return np.asarray(canvas.filter(ImageFilter.SMOOTH), dtype=np.float32)


def cut_green(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im, dtype=np.float32)
    rr, gg, bb = a[..., 0], a[..., 1], a[..., 2]
    sat = a[..., :3].max(2) - a[..., :3].min(2)
    green = (gg > rr + 12) & (gg > bb + 8) & (gg > 65)
    olive = (gg > 75) & (np.abs(rr - gg) < 40) & (bb < gg + 5) & (sat < 60)
    alpha = (~(green | olive)).astype(np.float32) * 255
    ys, xs = np.where(alpha > 128)
    if len(xs) == 0:
        return im
    y0, y1 = max(0, ys.min() - 4), min(im.height, ys.max() + 5)
    x0, x1 = max(0, xs.min() - 4), min(im.width, xs.max() + 5)
    crop = im.crop((x0, y0, x1, y1))
    ca = np.asarray(crop, dtype=np.float32)
    rr, gg, bb = ca[..., 0], ca[..., 1], ca[..., 2]
    sat = ca[..., :3].max(2) - ca[..., :3].min(2)
    green = (gg > rr + 12) & (gg > bb + 8) & (gg > 65)
    olive = (gg > 75) & (np.abs(rr - gg) < 40) & (bb < gg + 5) & (sat < 60)
    alpha = (~(green | olive)).astype(np.float32) * 255
    alpha = np.clip((alpha - 35) * 1.25, 0, 255)
    al = Image.fromarray(alpha.astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(1.1))
    crop.putalpha(al)
    return crop


def detect_orbs(arr: np.ndarray) -> list[tuple[int, int, int]]:
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    bright = (r + g + b) / 3
    sat = arr.max(2) - arr.min(2)
    orb = (bright > 200) & (sat < 45) & (r > 180) & (g > 180) & (b > 170)
    H, W = bright.shape
    vis = np.zeros((H, W), dtype=np.uint8)
    raw = []
    ys, xs = np.where(orb)
    for y, x in zip(ys, xs):
        if vis[y, x] or not orb[y, x]:
            continue
        q = deque([(y, x)])
        vis[y, x] = 1
        cells = []
        while q:
            cy, cx = q.popleft()
            cells.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and orb[ny, nx] and not vis[ny, nx]:
                        vis[ny, nx] = 1
                        q.append((ny, nx))
        if not (8 <= len(cells) <= 400):
            continue
        cy = int(np.mean([c[0] for c in cells]))
        cx = int(np.mean([c[1] for c in cells]))
        y1, y2 = min(H, cy + 10), min(H, cy + 70)
        x1, x2 = max(0, cx - 25), min(W, cx + 25)
        body = arr[y1:y2, x1:x2]
        if body.size == 0:
            continue
        bb = body.mean(2)
        bs = body.max(2) - body.min(2)
        if ((bs < 40) & (bb > 70) & (bb < 170)).mean() < 0.12:
            continue
        raw.append((cx, cy, len(cells)))
    raw.sort(key=lambda t: -t[2])
    kept = []
    for cx, cy, n in raw:
        if any(abs(cx - kx) < 45 and abs(cy - ky) < 45 for kx, ky, _ in kept):
            continue
        kept.append((cx, cy, n))
    return kept


def paste_prop(dst: Image.Image, spr: Image.Image, cx: int, cy: int, target_h: int) -> None:
    scale = target_h / spr.height
    w = max(16, int(spr.width * scale))
    h = max(16, int(spr.height * scale))
    s = spr.resize((w, h), Image.LANCZOS)
    s = ImageEnhance.Color(s).enhance(0.9)
    s = ImageEnhance.Brightness(s).enhance(0.95)
    dst.alpha_composite(s, dest=(cx - w // 2, cy - int(h * 0.62)))


def reskin(stem: str = "7") -> Path:
    orig = load_orig(stem)
    W, H = orig.size
    og = np.asarray(orig, dtype=np.float32)
    r, g, b = og[..., 0], og[..., 1], og[..., 2]
    bright = (r + g + b) / 3.0
    sat = og.max(2) - og.min(2)
    greenish = (g > r + 8) & (g > b + 5)
    # autumn / warm foliage of original VLTK trees
    autumn = (r > g + 5) & (r > b + 10) & (bright > 70) & (bright < 190) & (sat > 25)
    brown_path = (r > 70) & (g > 55) & (b > 35) & (np.abs(r - g) < 40) & ~greenish & (bright > 75) & (bright < 175)
    dark_rock = (bright < 95) & (sat < 45) & (np.abs(r - g) < 25)
    light_stone = (sat < 35) & (bright > 100) & (bright < 175) & (np.abs(r - g) < 22)

    # textures
    ground_path = TILES / "tran-ground.jpg"
    if not ground_path.exists():
        ground_path = Path("/opt/cursor/artifacts/assets/tran-ground.jpg")
    dirt_src = Image.open(ground_path).convert("RGB") if ground_path.exists() else Image.open(TILES / "tran-yen-tu-map.jpg").convert("RGB")
    grass_src = Image.open(TILES / "04_dong_lua.jpg").convert("RGB") if (TILES / "04_dong_lua.jpg").exists() else Image.open(TILES / "tran-yen-tu-map.jpg").convert("RGB")
    if not (TILES / "04_dong_lua.jpg").exists() and Path("/tmp/maps_tran/04_dong_lua.jpg").exists():
        grass_src = Image.open("/tmp/maps_tran/04_dong_lua.jpg").convert("RGB")
    arch_src = Image.open(TILES / "tran-thang-long-map.jpg").convert("RGB")
    foliage_src = Image.open(TILES / "tran-con-son-map.jpg").convert("RGB")
    bamboo_path = Path("/opt/cursor/artifacts/assets/tran-bamboo-trees.jpg")
    if bamboo_path.exists():
        foliage_src = Image.open(bamboo_path).convert("RGB")

    dirt_t = tile_fill(dirt_src, W, H, seed=71)
    grass_t = tile_fill(grass_src, W, H, seed=17)
    foliage_t = tile_fill(foliage_src, W, H, seed=29)
    arch_t = tile_fill(arch_src, W, H, seed=41)
    rock_t = tile_fill(ImageEnhance.Brightness(arch_src).enhance(0.75), W, H, seed=53)

    # soft masks
    def blur_mask(m: np.ndarray, rad: float = 3.0) -> np.ndarray:
        im = Image.fromarray((m.astype(np.float32) * 255).astype(np.uint8), "L")
        im = im.filter(ImageFilter.GaussianBlur(rad))
        return np.asarray(im, dtype=np.float32) / 255.0

    m_path = blur_mask(brown_path & ~dark_rock, 2.5)
    m_grass = blur_mask((greenish | ((bright > 60) & (bright < 140) & ~dark_rock & ~brown_path)) & ~autumn, 3.0)
    m_tree = blur_mask(autumn | ((greenish) & (sat > 35) & (bright > 55) & (bright < 160)), 2.0)
    m_rock = blur_mask(dark_rock, 1.8)
    m_stone = blur_mask(light_stone, 2.0)

    # normalize competing weights
    stack = np.stack([m_path * 1.35, m_grass * 1.0, m_tree * 1.25, m_rock * 1.4, m_stone * 0.9], axis=-1)
    # residual = keep a whisper of original structure
    wsum = stack.sum(-1, keepdims=True) + 1e-5
    stack = stack / wsum

    out = (
        dirt_t * stack[..., 0:1]
        + grass_t * stack[..., 1:2]
        + foliage_t * stack[..., 2:3]
        + rock_t * stack[..., 3:4]
        + arch_t * stack[..., 4:5]
    )

    # inject original edges / shading so layout stays readable
    og_l = bright[..., None] / 255.0
    out = out * (0.78 + 0.35 * og_l) + og * 0.12
    # paths a bit clearer
    out = out * (1.0 - 0.18 * m_path[..., None]) + dirt_t * (0.18 * m_path[..., None])
    # Vietnamese warm-green grade
    out[..., 0] = np.clip(out[..., 0] * 1.02 + 2, 0, 255)
    out[..., 1] = np.clip(out[..., 1] * 1.06 + 3, 0, 255)
    out[..., 2] = np.clip(out[..., 2] * 0.96, 0, 255)

    img = Image.fromarray(out.astype(np.uint8), "RGB")
    img = ImageEnhance.Contrast(img).enhance(1.08)
    img = ImageEnhance.Color(img).enhance(1.05)
    img = img.filter(ImageFilter.SMOOTH)

    # architecture props
    orbs = detect_orbs(og)
    houses = [(2480, 545), (2575, 505)]
    steles = [(cx, cy, n) for cx, cy, n in orbs if not (2300 < cx < 2700 and 450 < cy < 650)]

    stele_p = TILES / "prop-tran-stele.jpg"
    house_p = TILES / "prop-tran-house.jpg"
    stele_spr = cut_green(stele_p) if stele_p.exists() else None
    house_spr = cut_green(house_p) if house_p.exists() else None
    # also try artifacts
    if stele_spr is None and Path("/opt/cursor/artifacts/assets/tran-stele-iso.jpg").exists():
        stele_spr = cut_green(Path("/opt/cursor/artifacts/assets/tran-stele-iso.jpg"))
    if house_spr is None and Path("/opt/cursor/artifacts/assets/tran-house-iso.jpg").exists():
        house_spr = cut_green(Path("/opt/cursor/artifacts/assets/tran-house-iso.jpg"))

    rgba = img.convert("RGBA")
    # soft clear monument footprints before stamp
    draw = ImageDraw.Draw(rgba)
    for cx, cy, _ in steles:
        draw.ellipse([cx - 28, cy - 10, cx + 28, cy + 55], fill=(90, 110, 78, 180))
    for cx, cy in houses:
        draw.ellipse([cx - 55, cy - 40, cx + 55, cy + 45], fill=(95, 115, 82, 200))

    if stele_spr is not None:
        for cx, cy, n in steles:
            paste_prop(rgba, stele_spr, cx, cy + 28, 80 + min(18, n // 2))
    if house_spr is not None:
        for i, (cx, cy) in enumerate(houses):
            paste_prop(rgba, house_spr, cx, cy + 8, 100 if i == 0 else 88)

    # a few extra small steles along open path nodes for Trần flavor (optional sparse)
    # skip — keep layout clean

    img = rgba.convert("RGB")
    img = ImageEnhance.Contrast(img).enhance(1.02)

    out_path = Z / f"{stem}.jpg"
    img.save(out_path, quality=88, optimize=True)
    return out_path


def ensure_orig_jmo(stem: str = "7") -> None:
    """Keep original obstacle grid for this zone."""
    t = subprocess.check_output(["git", "show", f"{ORIG_REV}:jmo.js"], text=True)
    m = re.search(rf'"{stem}"\s*:\s*\{{', t)
    if not m:
        raise SystemExit(f"no JMO {stem} in {ORIG_REV}")
    i = t.find("{", m.start())
    depth = 0
    for j in range(i, len(t)):
        if t[j] == "{":
            depth += 1
        elif t[j] == "}":
            depth -= 1
            if depth == 0:
                meta = json.loads(t[i : j + 1])
                break
    jmo_path = ROOT / "jmo.js"
    cur = jmo_path.read_text(encoding="utf-8")
    start = cur.find(f'"{stem}":{{')
    if start < 0:
        start = cur.find(f'"{stem}": {{')
    i = cur.find("{", start)
    depth = 0
    for j in range(i, len(cur)):
        if cur[j] == "{":
            depth += 1
        elif cur[j] == "}":
            depth -= 1
            if depth == 0:
                end = j + 1
                break
    new_obj = json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
    cur = cur[:start] + f'"{stem}":' + new_obj + cur[end:]
    if cur.startswith("/*"):
        cur = re.sub(
            r"^/\*.*?\*/",
            "/* Long Hung: layout goc + reskin Tran full */",
            cur,
            count=1,
            flags=re.S,
        )
    jmo_path.write_text(cur, encoding="utf-8")


def bump_cache(stem: str = "7") -> int:
    idx = ROOT / "index.html"
    text = idx.read_text(encoding="utf-8")
    m = re.search(r"\?v=(\d+)", text)
    ver = int(m.group(1)) + 1 if m else 223
    text = re.sub(r"\?v=\d+", f"?v={ver}", text)
    idx.write_text(text, encoding="utf-8")
    sw = ROOT / "sw.js"
    s = sw.read_text(encoding="utf-8")
    s = re.sub(r"jxidle-v\d+", f"jxidle-v{ver}", s)
    s = re.sub(r"jxidle-img-\d+", f"jxidle-img-{ver}", s)
    sw.write_text(s, encoding="utf-8")
    world = ROOT / "world.js"
    w = world.read_text(encoding="utf-8")
    w = re.sub(
        rf'("id":{stem},"n":"[^"]*"[^}}]*?"bg":")[^"]+"',
        rf"\g<1>img/z/{stem}.jpg?v={ver}\"",
        w,
    )
    world.write_text(w, encoding="utf-8")
    return ver


def main() -> None:
    stem = sys.argv[1] if len(sys.argv) > 1 else "7"
    # stage remote maps into tiles
    for name in ("01_hoang_thanh.jpg", "03_yen_tu.jpg", "04_dong_lua.jpg"):
        src = Path("/tmp/maps_tran") / name
        if src.exists():
            (TILES / name).write_bytes(src.read_bytes())
    g = Path("/opt/cursor/artifacts/assets/tran-ground.jpg")
    if g.exists():
        (TILES / "tran-ground.jpg").write_bytes(g.read_bytes())
    b = Path("/opt/cursor/artifacts/assets/tran-bamboo-trees.jpg")
    if b.exists():
        (TILES / "tran-bamboo-trees.jpg").write_bytes(b.read_bytes())

    print(f"reskin {stem}...", flush=True)
    path = reskin(stem)
    ensure_orig_jmo(stem)
    ver = bump_cache(stem)
    print(f"-> {path} ({path.stat().st_size // 1024}KB) v{ver}", flush=True)


if __name__ == "__main__":
    main()
