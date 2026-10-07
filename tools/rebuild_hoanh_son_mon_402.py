#!/usr/bin/env python3
"""Hoành Sơn Môn (402) — khớp footprint VLTK, không đè layout.

Giữ nguyên bố cục/sàn đá zone 56 gốc (tránh patch đá lệch mạch gạch).
Chỉ: recolor Trần rất nhẹ + stamp prop chroma-key sạch trên sân trống.
Cờ gốc giữ lại (là một phần layout VLTK) — không inpaint/patch gây 'dè'.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from collections import deque
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from rebuild_hoanh_son_56 import recolor_tran  # noqa: E402

Z = ROOT / "img" / "z"
REVIEW = ROOT / "assets/pack/map-style-review/402-hoanh-son-mon"
ART = Path("/opt/cursor/artifacts/hoanh-son-mon-newbie")
GEN = Path("/opt/cursor/artifacts/assets")
ORIG_REV = "5f51470"
BOX = (1750, 350, 3450, 2050)

# Sân đá trống — tránh giá vũ khí / cột cờ / tường
PROP_SPOTS = [
    (500, 760),
    (640, 580),
    (780, 460),
    (900, 700),
    (600, 980),
    (1040, 880),
    (1200, 640),
]


def load_clean_vltk() -> Image.Image:
    data = subprocess.check_output(["git", "show", f"{ORIG_REV}:img/z/56.jpg"])
    return Image.open(BytesIO(data)).convert("RGB")


def chroma_key_rgba(path: Path) -> Image.Image:
    """Flood-key magenta; bỏ pad sàn đáy; alpha cứng quanh silhouette."""
    im = Image.open(path).convert("RGB")
    a = np.asarray(im, dtype=np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h, w = r.shape
    sat = a.max(2) - a.min(2)
    bright = (r + g + b) / 3.0
    border = np.concatenate([a[0, :], a[-1, :], a[:, 0], a[:, -1]], 0)
    mag_border = border[(border[:, 0] > 160) & (border[:, 2] > 90) & (border[:, 1] < 130)]
    bg_mean = mag_border.mean(0) if len(mag_border) > 8 else border.mean(0)

    def is_bg_pixel(y: int, x: int) -> bool:
        rr, gg, bb = float(r[y, x]), float(g[y, x]), float(b[y, x])
        br, ss = float(bright[y, x]), float(sat[y, x])
        if rr > 150 and bb > 90 and gg < 125 and (rr + bb) > gg * 2.5:
            return True
        if rr > 175 and bb > 125 and gg < 150:
            return True
        d = float(np.sqrt(((a[y, x] - bg_mean) ** 2).sum()))
        if d < 52:
            return True
        if d < 80 and ss < 42:
            return True
        if ss < 22 and 28 < br < 210 and d < 105:
            return True
        return False

    key = np.zeros((h, w), dtype=bool)
    seen = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.append((0, x))
        q.append((h - 1, x))
    for y in range(h):
        q.append((y, 0))
        q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if seen[y, x]:
            continue
        seen[y, x] = True
        if not is_bg_pixel(y, x):
            continue
        key[y, x] = True
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx]:
                q.append((ny, nx))

    alpha = np.where(key, 0, 255).astype(np.uint8)
    pink = (r > 168) & (b > 110) & (g < 125) & (r + b > g * 2.6)
    trans_d = Image.fromarray(((alpha == 0).astype(np.uint8) * 255), "L").filter(
        ImageFilter.MaxFilter(5)
    )
    alpha = np.where(pink & (np.asarray(trans_d) > 0), 0, alpha)

    near_t = np.asarray(trans_d) > 0
    y_lo = int(h * 0.62)
    cand = (alpha > 0) & (sat < 32) & (bright < 98) & (np.arange(h)[:, None] >= y_lo)
    drop = np.zeros((h, w), dtype=bool)
    seen2 = np.zeros((h, w), dtype=bool)
    q2: deque[tuple[int, int]] = deque()
    ys, xs = np.where(cand & (near_t | (np.arange(h)[:, None] >= h - 2)))
    for y, x in zip(ys.tolist(), xs.tolist()):
        q2.append((y, x))
        seen2[y, x] = True
    while q2:
        y, x = q2.popleft()
        if not cand[y, x]:
            continue
        drop[y, x] = True
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen2[ny, nx] and cand[ny, nx]:
                seen2[ny, nx] = True
                q2.append((ny, nx))
    if drop.any():
        dm = Image.fromarray(drop.astype(np.uint8) * 255, "L").filter(ImageFilter.MaxFilter(5))
        alpha = np.where(np.asarray(dm) > 0, 0, alpha)

    # erode nhẹ — hết AA nền nhưng giữ đế prop
    al_im = Image.fromarray(alpha, "L").filter(ImageFilter.MinFilter(3)).filter(
        ImageFilter.GaussianBlur(0.3)
    )
    alpha = np.asarray(al_im)
    alpha = np.where(alpha < 48, 0, alpha)
    alpha = np.where(alpha > 230, 255, alpha)

    out = np.dstack([a.astype(np.uint8), alpha.astype(np.uint8)])
    im_out = Image.fromarray(out, "RGBA")
    bb = im_out.split()[-1].getbbox()
    if bb:
        im_out = im_out.crop(bb)
    return im_out


def soft_recolor_orange_banners(img: Image.Image, box: tuple[int, int, int, int] = BOX) -> Image.Image:
    """Không xóa cờ — chỉ dịu màu cam → nâu gỗ để bớt chói, giữ layout gốc."""
    arr = np.asarray(img, dtype=np.float32)
    x0, y0, x1, y1 = box
    crop = arr[y0:y1, x0:x1]
    r, g, b = crop[..., 0], crop[..., 1], crop[..., 2]
    bright = (r + g + b) / 3.0
    sat = crop.max(2) - crop.min(2)
    orange = (
        (r > 140)
        & (r > g + 28)
        & (r > b + 40)
        & (g < 160)
        & (b < 110)
        & (sat > 50)
        & (bright > 85)
        & (bright < 220)
    )
    if not orange.any():
        return img
    # kéo về nâu ấm gần gỗ cột
    target = np.array([110.0, 78.0, 48.0], dtype=np.float32)
    m = Image.fromarray(orange.astype(np.uint8) * 255, "L").filter(
        ImageFilter.GaussianBlur(0.8)
    )
    a = (np.asarray(m, dtype=np.float32) / 255.0)[..., None] * 0.72
    out = crop * (1 - a) + target * a
    arr[y0:y1, x0:x1] = out
    print(f"soft-recolor orange banner px={int(orange.sum())}")
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def stamp_matched(canvas: Image.Image, spr: Image.Image, cx: int, cy: int, scale: float) -> None:
    w = max(16, int(spr.width * scale))
    h = max(16, int(spr.height * scale))
    s = spr.resize((w, h), Image.LANCZOS)
    arr = np.asarray(s).astype(np.float32)

    base = np.asarray(canvas.convert("RGB"), dtype=np.float32)
    H, W = base.shape[:2]
    floor = base[max(0, cy - 6) : min(H, cy + 14), max(0, cx - 18) : min(W, cx + 18)]
    if floor.size:
        fmean = floor.reshape(-1, 3).mean(0)
        opaque = arr[..., 3] > 200
        pmean = (
            arr[..., :3][opaque].mean(0)
            if opaque.any()
            else np.array([128.0, 128.0, 128.0])
        )
        scale_rgb = np.clip(0.65 + 0.35 * (fmean / (pmean + 1e-5)), 0.74, 1.04)
        arr[..., 0] = np.clip(arr[..., 0] * scale_rgb[0] * 0.93, 0, 255)
        arr[..., 1] = np.clip(arr[..., 1] * scale_rgb[1] * 0.96, 0, 255)
        arr[..., 2] = np.clip(arr[..., 2] * scale_rgb[2] * 0.99, 0, 255)

    sat = arr[..., :3].max(2) - arr[..., :3].min(2)
    bright = arr[..., :3].mean(2)
    yy = np.arange(h)[:, None] >= int(h * 0.72)
    arr[..., 3] = np.where((arr[..., 3] > 0) & (sat < 20) & (bright < 85) & yy, 0, arr[..., 3])

    al = Image.fromarray(arr[..., 3].astype(np.uint8), "L")
    al = al.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.35))
    arr[..., 3] = np.asarray(al)
    arr[..., 3] = np.where(arr[..., 3] < 50, 0, arr[..., 3])

    rr, gg, bb = arr[..., 0], arr[..., 1], arr[..., 2]
    pink = (arr[..., 3] > 40) & (rr > 175) & (bb > 120) & (gg < 130)
    if pink.mean() > 0.008:
        print("skip stamp: residual pink")
        return
    arr[..., 3] = np.where(pink, 0, arr[..., 3])

    s = Image.fromarray(arr.astype(np.uint8), "RGBA")
    # bóng tiếp xúc cực nhẹ — ellipse nhỏ, không hộp
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.ellipse(
        [int(w * 0.40), int(h * 0.95), int(w * 0.60), int(h * 0.995)],
        fill=(12, 10, 8, 24),
    )
    dest = (int(cx - w // 2), int(cy - h + 3))
    canvas.alpha_composite(sh, dest=dest)
    canvas.alpha_composite(s, dest=dest)


def load_props() -> dict[str, Image.Image]:
    files = {
        "dummy": GEN / "prop-moc-nhan.jpg",
        "lantern": GEN / "prop-den-da.jpg",
    }
    prop_dir = REVIEW / "props"
    prop_dir.mkdir(parents=True, exist_ok=True)
    out = {}
    for k, p in files.items():
        rgba = chroma_key_rgba(p)
        rgba.save(prop_dir / f"{k}.png")
        al = np.asarray(rgba.split()[-1])
        print(f"prop {k}: {rgba.size} opaque%={(al > 0).mean()*100:.1f}")
        out[k] = rgba
    return out


def light_tran_recolor(orig: Image.Image) -> Image.Image:
    warm = recolor_tran(orig)
    a = np.asarray(orig, dtype=np.float32)
    b = np.asarray(warm, dtype=np.float32)
    r, g, bl = a[..., 0], a[..., 1], a[..., 2]
    bright = (r + g + bl) / 3.0
    sat = a.max(2) - a.min(2)
    stone = ((sat < 42) & (bright > 65) & (bright < 175) & (np.abs(r - g) < 30)).astype(
        np.float32
    )
    stone = (
        np.asarray(
            Image.fromarray((stone * 255).astype(np.uint8), "L").filter(
                ImageFilter.GaussianBlur(2.5)
            ),
            dtype=np.float32,
        )
        / 255.0
    )
    foliage = ((g > r + 12) & (g > bl + 8) & (sat > 35) & (bright > 50)).astype(np.float32)
    foliage = (
        np.asarray(
            Image.fromarray((foliage * 255).astype(np.uint8), "L").filter(
                ImageFilter.GaussianBlur(1.5)
            ),
            dtype=np.float32,
        )
        / 255.0
    )
    w = 0.24 * (1.0 - stone) * (1.0 - foliage) + 0.04 * stone + 0.03 * foliage
    out = a * (1 - w[..., None]) + b * w[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def rebuild() -> tuple[Image.Image, list[tuple[int, int]]]:
    clean = load_clean_vltk()
    x0, y0, _, _ = BOX
    # giữ footprint: chỉ dịu cờ cam + recolor nhẹ — không patch sàn
    img = soft_recolor_orange_banners(clean)
    img = light_tran_recolor(img)

    props = load_props()
    canvas = img.convert("RGBA")
    cycle = ["dummy", "lantern", "dummy", "lantern", "dummy", "lantern", "dummy"]
    scales = {"dummy": 0.115, "lantern": 0.108}
    for i, (cx, cy) in enumerate(PROP_SPOTS):
        kind = cycle[i % len(cycle)]
        stamp_matched(
            canvas,
            props[kind],
            x0 + int(cx),
            y0 + int(cy),
            scales[kind] * (1.0 + (i % 2) * 0.025),
        )

    out = canvas.convert("RGB")
    out = ImageEnhance.Contrast(out).enhance(1.01)
    out = ImageEnhance.Sharpness(out).enhance(1.02)
    return out, PROP_SPOTS


def save_previews(img: Image.Image, spots: list[tuple[int, int]]) -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    crop = img.crop(BOX).resize((960, 960), Image.LANCZOS)
    crop.save(REVIEW / "courtyard.jpg", quality=90)
    crop.save(ART / "courtyard.jpg", quality=90)
    img.resize((1024, 1024), Image.LANCZOS).save(REVIEW / "thumb-1024.jpg", quality=88)

    clean = load_clean_vltk()
    side = Image.new("RGB", (960, 500), (20, 18, 16))
    side.paste(clean.crop(BOX).resize((470, 470)), (10, 20))
    side.paste(crop.resize((470, 470)), (490, 20))
    d = ImageDraw.Draw(side)
    d.text((20, 2), "VLTK clean", fill=(200, 200, 160))
    d.text((500, 2), "402 no overlay", fill=(160, 220, 160))
    side.save(ART / "footprint-match.jpg", quality=90)
    side.save(REVIEW / "footprint-match.jpg", quality=90)

    zooms = Image.new("RGB", (800, 220), (18, 16, 14))
    for i, (cx, cy) in enumerate(spots[:4]):
        patch = img.crop(BOX).crop((cx - 70, cy - 140, cx + 70, cy + 30)).resize((190, 200))
        zooms.paste(patch, (10 + i * 195, 10))
    zooms.save(ART / "stamp-zooms.jpg", quality=90)

    ca = np.asarray(clean.crop(BOX), dtype=float)
    ba = np.asarray(img.crop(BOX), dtype=float)
    pink = (
        (ba[..., 0] > 180)
        & (ba[..., 2] > 130)
        & (ba[..., 1] < 140)
        & (ba[..., 0] + ba[..., 2] > ba[..., 1] * 2.3)
    )
    print(
        f"metrics: mean_diff={np.abs(ba-ca).mean():.2f} pink_px={int(pink.sum())} spots={len(spots)}"
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    out, spots = rebuild()
    save_previews(out, spots)
    if args.apply:
        out.save(Z / "402.jpg", quality=91, optimize=True)
        print("applied", Z / "402.jpg", (Z / "402.jpg").stat().st_size)
    else:
        print("preview only")


if __name__ == "__main__":
    main()
