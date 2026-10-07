#!/usr/bin/env python3
"""Dựng lại Hoành Sơn Môn (402) — map tân thủ đàng hoàng.

Pipeline:
1) Base = ảnh gốc (cờ cam còn nguyên, layout/collision khớp jmo)
2) Xóa sạch cờ cam trong sân
3) Ghép prop isometric chất lượng (generate) đã chroma-key
4) Grade sân tập ấm nhẹ — chỉ ghi img/z/402.jpg
"""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
Z = ROOT / "img" / "z"
REVIEW = ROOT / "assets/pack/map-style-review/402-hoanh-son-mon"
ART = Path("/opt/cursor/artifacts/hoanh-son-mon-newbie")
GEN = Path("/opt/cursor/artifacts/assets")
BOX = (1750, 350, 3450, 2050)

# Vị trí cờ cam trên crop BOX (local px)
FLAG_SPOTS = [
    (192, 704),
    (417, 830),
    (503, 550),
    (700, 674),
    (891, 353),
    (1117, 458),
    (1112, 250),
    (1313, 357),
]


def chroma_key_rgba(path: Path) -> Image.Image:
    """Key nền hồng/magenta → RGBA, crop tight."""
    im = Image.open(path).convert("RGB")
    a = np.asarray(im, dtype=np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # magenta / hot pink backgrounds from generators (varied)
    mag = (
        ((r > 170) & (b > 110) & (g < 90) & (r + b > g * 3.2))
        | ((r > 190) & (b > 150) & (g < 120) & (r > g + 60) & (b > g + 40))
        | ((r > 200) & (b > 180) & (g < 160) & (np.abs(r - b) < 50))
    )
    # also pure-ish pink corners
    bright = (r + g + b) / 3.0
    pink = (r > 200) & (b > 140) & (g < 100) & (bright > 120)
    key = mag | pink
    # grow key slightly to eat fringe
    km = Image.fromarray((key.astype(np.uint8) * 255), "L")
    km = km.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(0.8))
    alpha = 255 - np.asarray(km, dtype=np.uint8)
    # crush near-key fringe
    alpha = np.where(alpha < 40, 0, alpha)
    alpha = np.where(alpha > 220, 255, alpha)
    rgba = np.dstack([a.astype(np.uint8), alpha])
    out = Image.fromarray(rgba, "RGBA")
    bb = out.split()[-1].getbbox()
    if bb:
        out = out.crop(bb)
    # trim more: drop rows/cols almost empty
    return out


def detect_flag_regions(crop: np.ndarray) -> list[dict]:
    ca = crop.astype(np.float32)
    r, g, b = ca[..., 0], ca[..., 1], ca[..., 2]
    bright = (r + g + b) / 3.0
    sat = ca.max(2) - ca.min(2)
    target = np.array([165.0, 70.0, 40.0], dtype=np.float32)
    dist = np.sqrt(((ca - target) ** 2).sum(2))
    cloth = (
        (dist < 58)
        & (r > 118)
        & (r > g + 35)
        & (r > b + 45)
        & (g < 125)
        & (b < 105)
        & (bright > 75)
        & (bright < 205)
        & (sat > 45)
    )
    H0, W0 = cloth.shape
    regions = []
    for kx, ky in FLAG_SPOTS:
        x0, x1 = max(0, kx - 26), min(W0 - 1, kx + 26)
        y0, y1 = max(0, ky - 78), min(H0 - 1, ky + 42)
        n = int(cloth[y0 : y1 + 1, x0 : x1 + 1].sum())
        regions.append(dict(cx=kx, cy=ky, x0=x0, y0=y0, x1=x1, y1=y1, n=max(n, 1)))
    # also auto-detect leftover tall cloth blobs
    scale = 2
    small = cloth[::scale, ::scale]
    H, W = small.shape
    visited = np.zeros_like(small, dtype=np.uint8)
    dirs = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    ys, xs = np.where(small)
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if visited[y0, x0]:
            continue
        q = [(y0, x0)]
        visited[y0, x0] = 1
        pts = []
        while q:
            y, x = q.pop()
            pts.append((y, x))
            for dy, dx in dirs:
                ny, nx = y + dy, x + dx
                if 0 <= ny < H and 0 <= nx < W and small[ny, nx] and not visited[ny, nx]:
                    visited[ny, nx] = 1
                    q.append((ny, nx))
        if len(pts) < 40:
            continue
        yy = np.array([p[0] for p in pts]) * scale
        xx = np.array([p[1] for p in pts]) * scale
        h = int(yy.max() - yy.min() + 1)
        w = int(xx.max() - xx.min() + 1)
        if w < 18 or w > 55 or h < 40 or h > 130:
            continue
        cx, cy = float(xx.mean()), float(yy.mean())
        if any(abs(cx - r["cx"]) < 36 and abs(cy - r["cy"]) < 40 for r in regions):
            continue
        if cy < 40 or cx < 40 or cx > W0 - 40:
            continue
        regions.append(
            dict(
                cx=cx,
                cy=cy,
                x0=max(0, int(xx.min()) - 10),
                y0=max(0, int(yy.min()) - 50),
                x1=min(W0 - 1, int(xx.max()) + 10),
                y1=min(H0 - 1, int(yy.max()) + 28),
                n=len(pts),
            )
        )
    return regions


def inpaint_flags(img: Image.Image, regions: list[dict]) -> Image.Image:
    arr = np.asarray(img, dtype=np.float32)
    xB, yB, _, _ = BOX
    H, W = arr.shape[:2]
    rng = np.random.default_rng(402)
    out = arr.copy()
    for c in regions:
        x0 = max(0, xB + int(c["x0"]) - 4)
        y0 = max(0, yB + int(c["y0"]) - 4)
        x1 = min(W - 1, xB + int(c["x1"]) + 4)
        y1 = min(H - 1, yB + int(c["y1"]) + 4)
        pad = 32
        X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
        X1, Y1 = min(W, x1 + pad + 1), min(H, y1 + pad + 1)
        region = arr[Y0:Y1, X0:X1]
        rr, gg, bb = region[..., 0], region[..., 1], region[..., 2]
        bright = (rr + gg + bb) / 3.0
        sat = region.max(2) - region.min(2)
        hx0, hy0 = x0 - X0, y0 - Y0
        hx1, hy1 = x1 - X0, y1 - Y0
        local = np.ones(region.shape[:2], dtype=bool)
        local[hy0 : hy1 + 1, hx0 : hx1 + 1] = False
        stone = local & (sat < 45) & (bright > 60) & (bright < 185) & (np.abs(rr - gg) < 30)
        src = region[stone] if stone.sum() > 40 else region[local]
        if len(src) < 8:
            continue
        hh, ww = hy1 - hy0 + 1, hx1 - hx0 + 1
        picks = src[rng.integers(0, len(src), size=hh * ww)].reshape(hh, ww, 3)
        left = arr[y0 : y1 + 1, max(0, x0 - 1)]
        right = arr[y0 : y1 + 1, min(W - 1, x1 + 1)]
        up = arr[max(0, y0 - 1), x0 : x1 + 1]
        down = arr[min(H - 1, y1 + 1), x0 : x1 + 1]
        gy = np.linspace(0, 1, hh)[:, None, None]
        gx = np.linspace(0, 1, ww)[None, :, None]
        fill = left[:, None, :] * (1 - gx) * 0.35 + right[:, None, :] * gx * 0.35
        fill = fill + up[None, :, :] * (1 - gy) * 0.35 + down[None, :, :] * gy * 0.35
        fill = fill * 0.55 / 0.7 + picks * 0.45  # normalize-ish blend
        # simpler stable blend:
        fill = (
            left[:, None, :] * (1 - gx) * 0.25
            + right[:, None, :] * gx * 0.25
            + up[None, :, :] * (1 - gy) * 0.25
            + down[None, :, :] * gy * 0.25
            + picks * 0.35
        )
        yy, xx = np.mgrid[0:hh, 0:ww]
        edge = np.minimum(np.minimum(xx, ww - 1 - xx), np.minimum(yy, hh - 1 - yy)).astype(np.float32)
        alpha = np.clip(edge / 4.5, 0, 1)[..., None]
        patch = out[y0 : y1 + 1, x0 : x1 + 1]
        out[y0 : y1 + 1, x0 : x1 + 1] = patch * (1 - alpha) + fill * alpha

    mask = np.zeros((H, W), dtype=bool)
    for c in regions:
        x0 = max(0, xB + int(c["x0"]) - 2)
        y0 = max(0, yB + int(c["y0"]) - 2)
        x1 = min(W - 1, xB + int(c["x1"]) + 2)
        y1 = min(H - 1, yB + int(c["y1"]) + 2)
        mask[y0 : y1 + 1, x0 : x1 + 1] = True
    if mask.any():
        blur = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        ba = np.asarray(blur, dtype=np.float32)
        feather = Image.fromarray(mask.astype(np.uint8) * 255, "L").filter(ImageFilter.GaussianBlur(1.4))
        a = (np.asarray(feather, dtype=np.float32) / 255.0 * 0.35)[..., None]
        out = out * (1 - a) + ba * a
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def warm_courtyard(img: Image.Image) -> Image.Image:
    arr = np.asarray(img, dtype=np.float32)
    x0, y0, x1, y1 = BOX
    patch = arr[y0:y1, x0:x1]
    r, g, b = patch[..., 0], patch[..., 1], patch[..., 2]
    bright = (r + g + b) / 3.0
    sat = patch.max(2) - patch.min(2)
    stone = ((sat < 40) & (bright > 68) & (bright < 175) & (np.abs(r - g) < 28)).astype(np.float32)
    sm = Image.fromarray((stone * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(2.0))
    m = (np.asarray(sm, dtype=np.float32) / 255.0) * 0.22
    warm = patch.copy()
    warm[..., 0] = np.clip(warm[..., 0] * 1.04 + 3, 0, 255)
    warm[..., 1] = np.clip(warm[..., 1] * 1.01, 0, 255)
    warm[..., 2] = np.clip(warm[..., 2] * 0.95, 0, 255)
    arr[y0:y1, x0:x1] = patch * (1 - m[..., None]) + warm * m[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def stamp(canvas: Image.Image, spr: Image.Image, cx: int, cy: int, scale: float) -> None:
    w = max(12, int(spr.width * scale))
    h = max(12, int(spr.height * scale))
    s = spr.resize((w, h), Image.LANCZOS)
    # match map grade slightly
    arr = np.asarray(s).astype(np.float32)
    arr[..., 0] = np.clip(arr[..., 0] * 0.96, 0, 255)
    arr[..., 1] = np.clip(arr[..., 1] * 0.97, 0, 255)
    arr[..., 2] = np.clip(arr[..., 2] * 0.94, 0, 255)
    # soft contact shadow under feet
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.ellipse([w * 0.22, h * 0.86, w * 0.78, h * 0.98], fill=(20, 18, 14, 75))
    s = Image.fromarray(arr.astype(np.uint8), "RGBA")
    r, g, b, a = s.split()
    a = a.filter(ImageFilter.GaussianBlur(0.35))
    s = Image.merge("RGBA", (r, g, b, a))
    dest = (int(cx - w // 2), int(cy - h + 12))
    canvas.alpha_composite(sh, dest=dest)
    canvas.alpha_composite(s, dest=dest)


def load_props() -> dict[str, Image.Image]:
    files = {
        "dummy": GEN / "prop-moc-nhan.jpg",
        "lantern": GEN / "prop-den-da.jpg",
        "bamboo": GEN / "prop-coc-tre.jpg",
        "stele": GEN / "prop-bia-da.jpg",
    }
    # also copy into review pack for reproducibility
    prop_dir = REVIEW / "props"
    prop_dir.mkdir(parents=True, exist_ok=True)
    out = {}
    for k, p in files.items():
        if not p.exists():
            raise FileNotFoundError(p)
        rgba = chroma_key_rgba(p)
        # save keyed png
        rgba.save(prop_dir / f"{k}.png")
        out[k] = rgba
        print(f"prop {k}: {rgba.size} alpha>0={(np.asarray(rgba.split()[-1]) > 0).mean()*100:.1f}%")
    return out


def rebuild(src: Image.Image) -> tuple[Image.Image, list[dict]]:
    x0, y0, _, _ = BOX
    crop = np.asarray(src.crop(BOX))
    regions = detect_flag_regions(crop)
    img = inpaint_flags(src, regions)
    img = warm_courtyard(img)
    props = load_props()
    canvas = img.convert("RGBA")

    # order spots for variety
    spots = sorted(regions, key=lambda c: (c["cy"], c["cx"]))
    cycle = ["dummy", "bamboo", "lantern", "dummy", "bamboo", "lantern", "dummy", "bamboo"]
    scales = {
        "dummy": 0.118,
        "bamboo": 0.105,
        "lantern": 0.112,
        "stele": 0.155,
    }
    for i, c in enumerate(spots):
        kind = cycle[i % len(cycle)]
        gx = x0 + int(c["cx"])
        gy = y0 + int(c["y1"])
        stamp(canvas, props[kind], gx, gy, scales[kind] * (1.0 + (i % 3) * 0.04))

    # landmark stele front-center courtyard
    stamp(canvas, props["stele"], x0 + 760, y0 + 1120, scales["stele"])

    out = canvas.convert("RGB")
    out = ImageEnhance.Contrast(out).enhance(1.02)
    out = ImageEnhance.Color(out).enhance(1.03)
    out = ImageEnhance.Sharpness(out).enhance(1.08)
    return out, spots


def save_previews(img: Image.Image, before: Image.Image, spots: list[dict]) -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    img.save(REVIEW / "402-preview.jpg", quality=91, optimize=True)
    crop = img.crop(BOX).resize((960, 960), Image.LANCZOS)
    crop.save(REVIEW / "courtyard.jpg", quality=90)
    crop.save(ART / "courtyard.jpg", quality=90)
    img.resize((1024, 1024), Image.LANCZOS).save(REVIEW / "thumb-1024.jpg", quality=88)

    a = before.crop(BOX).resize((480, 480), Image.LANCZOS)
    b = crop.resize((480, 480), Image.LANCZOS)
    strip = Image.new("RGB", (960, 520), (24, 22, 18))
    strip.paste(a, (0, 40))
    strip.paste(b, (480, 40))
    d = ImageDraw.Draw(strip)
    d.text((16, 10), "Truoc: co cam", fill=(220, 200, 160))
    d.text((496, 10), "Sau: moc nhan / tre / den da / bia (prop generate)", fill=(220, 200, 160))
    strip.save(ART / "before-after.jpg", quality=90)
    strip.save(REVIEW / "before-after.jpg", quality=90)

    # spot grid
    grid = Image.new("RGB", (900, 620), (20, 18, 16))
    d = ImageDraw.Draw(grid)
    bc = before.crop(BOX)
    cc = img.crop(BOX)
    for i, c in enumerate(spots[:6]):
        x, y = int(c["cx"]), int(c["cy"])
        aa = bc.crop((x - 45, y - 85, x + 45, y + 45)).resize((140, 180))
        bb = cc.crop((x - 45, y - 85, x + 45, y + 45)).resize((140, 180))
        col, row = i % 3, i // 3
        grid.paste(aa, (col * 300 + 10, row * 300 + 30))
        grid.paste(bb, (col * 300 + 155, row * 300 + 30))
        d.text((col * 300 + 10, row * 300 + 10), f"{i} before", fill=(200, 180, 140))
        d.text((col * 300 + 155, row * 300 + 10), f"{i} after", fill=(140, 200, 140))
    grid.save(ART / "spots-compare.jpg", quality=92)
    print("spots", len(spots))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--src", default="/tmp/402-orig.jpg")
    args = ap.parse_args()
    src_path = Path(args.src)
    if not src_path.exists():
        # fallback: extract clean from git if possible
        src_path = Z / "402.jpg"
    src = Image.open(src_path).convert("RGB")
    before = src.copy()
    out, spots = rebuild(src)
    save_previews(out, before, spots)
    if args.apply:
        out.save(Z / "402.jpg", quality=91, optimize=True)
        print("applied ->", Z / "402.jpg", (Z / "402.jpg").stat().st_size)
    else:
        print("preview only")


if __name__ == "__main__":
    main()
