#!/usr/bin/env python3
"""Dựng lại Hoành Sơn Môn (402) — map tân thủ, khác Vân Đồn.

Xóa cờ cam trong sân → thay mộc nhân / cọc tre / đèn đá / bia;
ấm sân tập + vòng cát; chỉ ghi img/z/402.jpg.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
Z = ROOT / "img" / "z"
REVIEW = ROOT / "assets/pack/map-style-review/402-hoanh-son-mon"
ART = Path("/opt/cursor/artifacts/hoanh-son-mon-newbie")
BOX = (1750, 350, 3450, 2050)
STELE = Z / "_tran_tiles" / "prop-tran-stele-vltk.png"


# Vị trí cờ cam đã quan sát trên crop BOX (local px) — bổ sung nếu auto-detect sót
KNOWN_FLAGS = [
    (192, 704),
    (417, 830),
    (503, 550),
    (700, 674),
    (891, 353),
    (1117, 458),
    (1112, 250),
    (1313, 357),
]


def detect_banners(crop: np.ndarray) -> list[dict]:
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
    pole = (bright < 70) & (sat < 40) & (np.abs(r - g) < 18)

    scale = 2
    small = cloth[::scale, ::scale]
    H, W = small.shape
    visited = np.zeros_like(small, dtype=np.uint8)
    comps: list[dict] = []
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
        n = len(pts)
        if n < 18:
            continue
        yy = np.array([p[0] for p in pts]) * scale
        xx = np.array([p[1] for p in pts]) * scale
        h = int(yy.max() - yy.min() + 1)
        w = int(xx.max() - xx.min() + 1)
        aspect = h / max(w, 1)
        if n > 4500 or h < 28 or h > 160:
            continue
        if w > 70:
            continue
        if aspect < 1.05 and w > 40:
            continue
        comps.append(
            dict(
                n=n,
                cx=float(xx.mean()),
                cy=float(yy.mean()),
                x0=int(xx.min()),
                y0=int(yy.min()),
                x1=int(xx.max()),
                y1=int(yy.max()),
                h=h,
                w=w,
                aspect=aspect,
            )
        )

    H0, W0 = cloth.shape
    out = []
    for c in comps:
        x0 = max(0, c["x0"] - 10)
        x1 = min(W0 - 1, c["x1"] + 10)
        y0 = max(0, c["y0"] - 52)
        y1 = min(H0 - 1, c["y1"] + 30)
        if cloth[y0 : y1 + 1, x0 : x1 + 1].sum() < 40:
            continue
        c2 = dict(c)
        c2.update(x0=x0, y0=y0, x1=x1, y1=y1, pole=int(pole[y0 : y1 + 1, x0 : x1 + 1].sum()))
        out.append(c2)

    # merge known flag anchors (ensure 8 vị trí user khoanh)
    for kx, ky in KNOWN_FLAGS:
        if any(abs(c["cx"] - kx) < 36 and abs(c["cy"] - ky) < 40 for c in out):
            continue
        x0, x1 = max(0, kx - 22), min(W0 - 1, kx + 22)
        y0, y1 = max(0, ky - 70), min(H0 - 1, ky + 40)
        n = int(cloth[y0 : y1 + 1, x0 : x1 + 1].sum())
        out.append(dict(n=max(n, 60), cx=float(kx), cy=float(ky), x0=x0, y0=y0, x1=x1, y1=y1, h=y1 - y0, w=x1 - x0, aspect=2.0, pole=0))

    out.sort(key=lambda c: -c["n"])
    kept = []
    for c in out:
        if any(abs(c["cx"] - k["cx"]) < 38 and abs(c["cy"] - k["cy"]) < 42 for k in kept):
            continue
        if c["cy"] < 30 or c["cx"] < 30 or c["cx"] > W0 - 30:
            continue
        # bỏ sợi mái / cột mỏng giả; giữ banner thật (rộng >= 18) hoặc neo KNOWN
        known = any(abs(c["cx"] - kx) < 30 and abs(c["cy"] - ky) < 35 for kx, ky in KNOWN_FLAGS)
        if c["w"] < 18 and not known:
            continue
        if c["w"] < 10:
            continue
        kept.append(c)
    return kept

def inpaint_regions(img: Image.Image, regions: list[dict], box: tuple[int, int, int, int]) -> Image.Image:
    """Che cờ theo từng bbox: mẫu sân đá viền → nhiễu tile → feather."""
    arr = np.asarray(img, dtype=np.float32)
    xB, yB, _, _ = box
    H, W = arr.shape[:2]
    rng = np.random.default_rng(402)
    out = arr.copy()

    for c in regions:
        x0, y0 = xB + c["x0"] - 6, yB + c["y0"] - 6
        x1, y1 = xB + c["x1"] + 6, yB + c["y1"] + 6
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(W - 1, x1), min(H - 1, y1)
        # border ring samples (outside inner rect)
        pad = 28
        X0, Y0 = max(0, x0 - pad), max(0, y0 - pad)
        X1, Y1 = min(W, x1 + pad + 1), min(H, y1 + pad + 1)
        region = arr[Y0:Y1, X0:X1]
        rr, gg, bb = region[..., 0], region[..., 1], region[..., 2]
        bright = (rr + gg + bb) / 3.0
        sat = region.max(2) - region.min(2)
        # local coords of hole inside region
        hx0, hy0 = x0 - X0, y0 - Y0
        hx1, hy1 = x1 - X0, y1 - Y0
        local = np.ones(region.shape[:2], dtype=bool)
        local[hy0 : hy1 + 1, hx0 : hx1 + 1] = False
        stone = local & (sat < 45) & (bright > 60) & (bright < 185) & (np.abs(rr - gg) < 30)
        src = region[stone] if stone.sum() > 30 else region[local]
        if len(src) < 10:
            continue
        hh, ww = hy1 - hy0 + 1, hx1 - hx0 + 1
        picks = src[rng.integers(0, len(src), size=hh * ww)].reshape(hh, ww, 3)
        # blend with horizontal/vertical neighbor means to keep tile feel
        left = arr[y0 : y1 + 1, max(0, x0 - 1)]
        right = arr[y0 : y1 + 1, min(W - 1, x1 + 1)]
        up = arr[max(0, y0 - 1), x0 : x1 + 1]
        down = arr[min(H - 1, y1 + 1), x0 : x1 + 1]
        # broadcast gradient fill
        gy = np.linspace(0, 1, hh)[:, None, None]
        gx = np.linspace(0, 1, ww)[None, :, None]
        vert = left[:, None, :] * (1 - gx) + right[:, None, :] * gx
        horz = up[None, :, :] * (1 - gy) + down[None, :, :] * gy
        fill = vert * 0.35 + horz * 0.35 + picks * 0.30
        # soft alpha inside bbox (stronger center)
        yy, xx = np.mgrid[0:hh, 0:ww]
        edge = np.minimum(np.minimum(xx, ww - 1 - xx), np.minimum(yy, hh - 1 - yy)).astype(np.float32)
        alpha = np.clip(edge / 5.0, 0, 1)[..., None]
        patch = out[y0 : y1 + 1, x0 : x1 + 1]
        out[y0 : y1 + 1, x0 : x1 + 1] = patch * (1 - alpha) + fill * alpha

    # tiny blur on union mask only
    mask = np.zeros((H, W), dtype=bool)
    for c in regions:
        x0, y0 = max(0, xB + c["x0"] - 4), max(0, yB + c["y0"] - 4)
        x1, y1 = min(W - 1, xB + c["x1"] + 4), min(H - 1, yB + c["y1"] + 4)
        mask[y0 : y1 + 1, x0 : x1 + 1] = True
    if mask.any():
        blur = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.9))
        ba = np.asarray(blur, dtype=np.float32)
        feather = Image.fromarray(mask.astype(np.uint8) * 255, "L").filter(ImageFilter.GaussianBlur(1.6))
        a = (np.asarray(feather, dtype=np.float32) / 255.0 * 0.45)[..., None]
        out = out * (1 - a) + ba * a
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def _wood_grad(d: ImageDraw.ImageDraw, box, c0, c1, steps=6):
    x0, y0, x1, y1 = box
    for i in range(steps):
        t = i / max(steps - 1, 1)
        c = tuple(int(a * (1 - t) + b * t) for a, b in zip(c0, c1))
        yy0 = y0 + int((y1 - y0) * i / steps)
        yy1 = y0 + int((y1 - y0) * (i + 1) / steps)
        d.rectangle([x0, yy0, x1, yy1], fill=c)


def make_dummy_rgba(w: int = 72, h: int = 118, variant: int = 0) -> Image.Image:
    """Mộc nhân tập — sprite đặc, bóng đổ, gỗ nâu (không trong suốt kiểu UI)."""
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    shade = variant % 4
    wood = (110 + shade * 8, 72 + shade * 4, 38)
    wood2 = (88 + shade * 5, 56, 30)
    dark = (55, 36, 20)
    # ground shadow (ellipse)
    d.ellipse([w // 2 - 18, h - 16, w // 2 + 20, h - 4], fill=(25, 22, 16, 90))
    # stone base
    d.polygon(
        [(w // 2 - 14, h - 28), (w // 2 + 12, h - 30), (w // 2 + 16, h - 18), (w // 2 - 10, h - 16)],
        fill=(95, 92, 85, 245),
    )
    d.polygon(
        [(w // 2 - 14, h - 28), (w // 2 - 10, h - 16), (w // 2 - 10, h - 12), (w // 2 - 14, h - 22)],
        fill=(70, 68, 62, 245),
    )
    # post body with gradient
    _wood_grad(d, [w // 2 - 8, 34, w // 2 + 7, h - 26], wood, wood2, 8)
    d.line([(w // 2 - 7, 36), (w // 2 - 7, h - 28)], fill=dark + (180,), width=2)
    d.line([(w // 2 + 5, 38), (w // 2 + 5, h - 28)], fill=(140, 100, 60, 100), width=1)
    # head (sphere-ish)
    d.ellipse([w // 2 - 13, 14, w // 2 + 13, 40], fill=wood + (250,))
    d.ellipse([w // 2 - 10, 18, w // 2 + 9, 36], fill=wood2 + (200,))
    d.arc([w // 2 - 13, 14, w // 2 + 13, 40], 200, 340, fill=dark + (160,), width=2)
    # arms (thick wood bar)
    ay = 44 + (shade % 3)
    d.line([(10, ay + 10), (w - 10, ay)], fill=wood + (250,), width=9)
    d.line([(10, ay + 10), (w - 10, ay)], fill=dark + (140,), width=2)
    # fists
    d.ellipse([6, ay + 4, 18, ay + 16], fill=wood2 + (250,))
    d.ellipse([w - 18, ay - 6, w - 6, ay + 6], fill=wood2 + (250,))
    # rope (hemp, not bright orange)
    rope = (150, 125, 80)
    for i in range(3):
        yy = 58 + i * 11
        d.arc([w // 2 - 9, yy, w // 2 + 8, yy + 8], 0, 360, fill=rope + (220,), width=2)
    # worn target
    d.ellipse([w // 2 - 5, 62, w // 2 + 4, 72], outline=(100, 55, 40, 200), width=2)
    im = im.filter(ImageFilter.SMOOTH_MORE)
    return im


def make_bamboo_stake_rgba(w: int = 48, h: int = 100, variant: int = 0) -> Image.Image:
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([w // 2 - 14, h - 14, w // 2 + 16, h - 3], fill=(30, 35, 22, 80))
    # dirt mound
    d.ellipse([w // 2 - 12, h - 22, w // 2 + 14, h - 10], fill=(90, 70, 40, 200))
    colors = [(62, 105, 48), (74, 118, 55), (55, 95, 42)]
    for i, ox in enumerate((-9, 0, 8)):
        col = colors[(i + variant) % 3]
        dark = (35, 60, 28)
        top = 8 + (i % 3) * 5
        # thick bamboo
        d.line([(w // 2 + ox, top), (w // 2 + ox + 1, h - 20)], fill=col + (250,), width=6)
        d.line([(w // 2 + ox - 2, top + 2), (w // 2 + ox - 1, h - 22)], fill=dark + (120,), width=2)
        for yy in range(top + 14, h - 24, 13):
            d.line([(w // 2 + ox - 3, yy), (w // 2 + ox + 3, yy)], fill=dark + (200,), width=1)
        d.polygon(
            [
                (w // 2 + ox - 3, top + 6),
                (w // 2 + ox + 1, top - 1),
                (w // 2 + ox + 4, top + 6),
            ],
            fill=(85, 125, 55, 240),
        )
    return im.filter(ImageFilter.SMOOTH)


def make_lantern_rgba(w: int = 52, h: int = 86) -> Image.Image:
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([w // 2 - 14, h - 14, w // 2 + 16, h - 3], fill=(30, 28, 22, 85))
    # pedestal
    d.polygon(
        [(w // 2 - 12, h - 28), (w // 2 + 12, h - 30), (w // 2 + 14, h - 18), (w // 2 - 10, h - 16)],
        fill=(110, 108, 100, 250),
    )
    stone = (125, 122, 112)
    d.rectangle([w // 2 - 7, 40, w // 2 + 7, h - 26], fill=stone + (250,))
    d.line([(w // 2 - 6, 42), (w // 2 - 6, h - 28)], fill=(70, 68, 60, 180), width=2)
    # lantern body
    d.polygon(
        [(w // 2 - 11, 34), (w // 2 + 11, 34), (w // 2 + 8, 56), (w // 2 - 8, 56)],
        fill=(200, 155, 85, 235),
    )
    d.ellipse([w // 2 - 8, 28, w // 2 + 8, 42], fill=(230, 190, 110, 220))
    d.rectangle([w // 2 - 12, 24, w // 2 + 12, 30], fill=(70, 48, 30, 245))
    d.polygon([(w // 2 - 14, 26), (w // 2, 12), (w // 2 + 14, 26)], fill=(95, 58, 36, 245))
    d.polygon([(w // 2 - 12, 25), (w // 2, 14), (w // 2 + 12, 25)], fill=(140, 80, 45, 200))
    return im.filter(ImageFilter.SMOOTH)


def load_stele_rgba() -> Image.Image | None:
    if not STELE.exists():
        return None
    im = Image.open(STELE).convert("RGBA")
    a = np.asarray(im).copy()
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    # magenta key (even if alpha already 0, clean RGB fringe)
    mag = ((r > 170) & (b > 130) & (g < 130)) | ((r > 200) & (b > 160) & (g < 90))
    al = np.where(mag, 0, al)
    # erode fringe
    am = Image.fromarray(al, "L").filter(ImageFilter.MinFilter(3))
    al = np.asarray(am)
    a[..., 3] = al
    rgba = Image.fromarray(a, "RGBA")
    bb = rgba.split()[-1].getbbox()
    if bb:
        rgba = rgba.crop(bb)
    return rgba


def stamp_prop(canvas: Image.Image, spr: Image.Image, cx: int, cy: int, scale: float = 1.0) -> None:
    w = max(10, int(spr.width * scale))
    h = max(10, int(spr.height * scale))
    s = spr.resize((w, h), Image.LANCZOS)
    # slight darken to match map grade
    arr = np.asarray(s).astype(np.float32)
    arr[..., 0] = np.clip(arr[..., 0] * 0.92, 0, 255)
    arr[..., 1] = np.clip(arr[..., 1] * 0.94, 0, 255)
    arr[..., 2] = np.clip(arr[..., 2] * 0.90, 0, 255)
    s = Image.fromarray(arr.astype(np.uint8), "RGBA")
    r, g, b, a = s.split()
    a = a.filter(ImageFilter.GaussianBlur(0.4))
    s = Image.merge("RGBA", (r, g, b, a))
    canvas.alpha_composite(s, dest=(int(cx - w // 2), int(cy - h + 10)))


def warm_courtyard(img: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    arr = np.asarray(img, dtype=np.float32)
    x0, y0, x1, y1 = box
    patch = arr[y0:y1, x0:x1]
    r, g, b = patch[..., 0], patch[..., 1], patch[..., 2]
    bright = (r + g + b) / 3.0
    sat = patch.max(2) - patch.min(2)
    stone = ((sat < 40) & (bright > 68) & (bright < 175) & (np.abs(r - g) < 28)).astype(np.float32)
    sm = Image.fromarray((stone * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(2.0))
    m = (np.asarray(sm, dtype=np.float32) / 255.0) * 0.28
    warm = patch.copy()
    warm[..., 0] = np.clip(warm[..., 0] * 1.05 + 4, 0, 255)
    warm[..., 1] = np.clip(warm[..., 1] * 1.015 + 1, 0, 255)
    warm[..., 2] = np.clip(warm[..., 2] * 0.94, 0, 255)
    arr[y0:y1, x0:x1] = patch * (1 - m[..., None]) + warm * m[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def draw_training_rings(img: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    out = img.copy()
    d = ImageDraw.Draw(out, "RGBA")
    x0, y0, _, _ = box
    rings = [
        (x0 + 740, y0 + 800, 150, 64),
        (x0 + 1060, y0 + 640, 120, 52),
        (x0 + 500, y0 + 1000, 110, 48),
    ]
    for cx, cy, rx, ry in rings:
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(165, 135, 90, 32))
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=(130, 100, 60, 70), width=2)
        d.ellipse([cx - rx // 2, cy - ry // 2, cx + rx // 2, cy + ry // 2], outline=(140, 110, 70, 45), width=1)
    return out


def rebuild(src: Image.Image) -> tuple[Image.Image, list[dict]]:
    x0, y0, x1, y1 = BOX
    crop = np.asarray(src.crop(BOX))
    banners = detect_banners(crop)
    img = inpaint_regions(src, banners, BOX)
    img = warm_courtyard(img, BOX)
    img = draw_training_rings(img, BOX)

    canvas = img.convert("RGBA")
    stele = load_stele_rgba()
    dummies = [make_dummy_rgba(variant=i) for i in range(5)]
    bamboos = [make_bamboo_stake_rgba(variant=i) for i in range(4)]
    lantern = make_lantern_rgba()

    order = sorted(banners, key=lambda c: (c["cy"], c["cx"]))
    for i, c in enumerate(order):
        gx = x0 + int(c["cx"])
        gy = y0 + int(c["y1"] + 4)
        kind = i % 3
        if kind == 0:
            stamp_prop(canvas, dummies[i % 5], gx, gy, scale=0.92 + (i % 3) * 0.05)
        elif kind == 1:
            stamp_prop(canvas, bamboos[i % 4], gx, gy, scale=0.92 + (i % 2) * 0.06)
        else:
            stamp_prop(canvas, lantern, gx, gy - 2, scale=1.0)

    # landmark stele near front-center of courtyard (newbie sect marker)
    if stele is not None:
        stamp_prop(canvas, stele, x0 + 760, y0 + 1120, scale=0.26)

    out = canvas.convert("RGB")
    out = ImageEnhance.Contrast(out).enhance(1.02)
    out = ImageEnhance.Color(out).enhance(1.03)
    out = ImageEnhance.Sharpness(out).enhance(1.1)
    return out, order


def save_previews(img: Image.Image, banners: list[dict], before: Image.Image | None) -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    full = REVIEW / "402-hoanh-son-mon-newbie.jpg"
    img.save(full, quality=91, optimize=True)
    img.resize((1024, 1024), Image.LANCZOS).save(REVIEW / "thumb-1024.jpg", quality=88)
    crop = img.crop(BOX).resize((960, 960), Image.LANCZOS)
    crop.save(REVIEW / "courtyard.jpg", quality=90)
    crop.save(ART / "courtyard.jpg", quality=90)
    img.resize((1280, 1280), Image.LANCZOS).save(ART / "full-1280.jpg", quality=88)

    # prop sheet
    sheet = Image.new("RGB", (480, 160), (40, 38, 32))
    sheet.paste(make_dummy_rgba().resize((90, 140)), (20, 10), make_dummy_rgba().resize((90, 140)))
    sheet.paste(make_bamboo_stake_rgba().resize((70, 140)), (140, 10), make_bamboo_stake_rgba().resize((70, 140)))
    sheet.paste(make_lantern_rgba().resize((80, 130)), (240, 20), make_lantern_rgba().resize((80, 130)))
    sheet.save(ART / "props.png")

    if before is not None:
        a = before.crop(BOX).resize((480, 480), Image.LANCZOS)
        b = crop.resize((480, 480), Image.LANCZOS)
        strip = Image.new("RGB", (960, 520), (24, 22, 18))
        strip.paste(a, (0, 40))
        strip.paste(b, (480, 40))
        d = ImageDraw.Draw(strip)
        d.text((16, 10), "Truoc: co cam (Van Don)", fill=(220, 200, 160))
        d.text((496, 10), "Sau: tan thu — moc nhan / tre / den da / bia", fill=(220, 200, 160))
        strip.save(ART / "before-after.jpg", quality=90)
        strip.save(REVIEW / "before-after.jpg", quality=90)

    print(f"banners replaced: {len(banners)}")
    for c in banners:
        print(" ", {k: round(c[k], 1) if isinstance(c[k], float) else c[k] for k in ("cx", "cy", "h", "w", "n")})


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--src", default="", help="Nguồn (mặc định: git HEAD 402 hoặc file hiện tại trước apply)")
    args = ap.parse_args()
    if args.src:
        src = Image.open(args.src).convert("RGB")
    else:
        # prefer pristine original if available
        cand = Path("/tmp/402-orig.jpg")
        src = Image.open(cand if cand.exists() else Z / "402.jpg").convert("RGB")
    before = src.copy()
    out, banners = rebuild(src)
    save_previews(out, banners, before)
    if args.apply:
        dest = Z / "402.jpg"
        # re-encode from REVIEW full
        Image.open(REVIEW / "402-hoanh-son-mon-newbie.jpg").save(dest, quality=91, optimize=True)
        print("applied ->", dest, "size", dest.stat().st_size)
    else:
        print("preview only; pass --apply to write img/z/402.jpg")


if __name__ == "__main__":
    main()
