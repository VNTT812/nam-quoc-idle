#!/usr/bin/env python3
"""Phổ Minh Tự (400): bố cục map gốc giữ nguyên — chỉ dựng lại phong cảnh.

- Layout gốc = tran-pho-minh-map.jpg (điện, ao sen, sư tử, đường, tre).
- Không lát tile AI / không inpaint đè footprint.
- Đổi cảnh: tán cây + tre trúc Trần, soft-stamp điện Trần trên đúng chân điện gốc.
"""
from __future__ import annotations

import base64
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from reskin_tran_layout import (  # noqa: E402
    TILES,
    Z,
    bias_params,
    blur_mask,
    bump_cache,
    patch_jmo2_assign_zone,
    classify,
    ground_grain,
    hsv_to_rgb,
    mix_hue_sat,
    open_tile,
    rgb_to_hsv,
)

CW, CH = 32, 16
SIZE = 3584
# Lõi bố cục gốc — nhỏ hơn trước (3300) để điện/đường không chiếm full map
CORE_SZ = 2600  # ~79% bản cũ (3300) — điện nhỏ vừa phải
CORE_OY_BIAS = -28  # hơi lệch lên
ART = Path("/opt/cursor/artifacts/pho-minh-scenery")
REVIEW = ROOT / "assets/pack/map-style-review/400-pho-minh"

# Tỉ lệ so với bản cũ core≈3300 (obs/crop cũ viết theo scale đó)
LEGACY_CORE = 3300.0
LAYOUT_SCALE = CORE_SZ / LEGACY_CORE


def extract_zone(js_text: str, stem: str):
    for pat in (f'"{stem}":{{', f'"{stem}": {{'):
        start = js_text.find(pat)
        if start >= 0:
            break
    else:
        raise SystemExit(f"zone {stem} not found")
    i = js_text.find("{", start)
    depth = 0
    for j in range(i, len(js_text)):
        if js_text[j] == "{":
            depth += 1
        elif js_text[j] == "}":
            depth -= 1
            if depth == 0:
                return json.loads(js_text[i : j + 1]), start, j + 1
    raise SystemExit("parse fail")


def decode_obs(meta: dict) -> list[int]:
    raw = base64.b64decode(meta["obs"])
    n = meta["gw"] * meta["gh"]
    blocked = [0] * n
    for k in range(n):
        if raw[k >> 3] & (1 << (k & 7)):
            blocked[k] = 1
    return blocked


def encode_obs(blocked: list[int]) -> str:
    n = len(blocked)
    raw = bytearray((n + 7) // 8)
    for k, b in enumerate(blocked):
        if b:
            raw[k >> 3] |= 1 << (k & 7)
    return base64.b64encode(bytes(raw)).decode("ascii")


def mark_rect(blocked, x, y, w, h, val, gw, gh):
    x0 = max(0, int(x // CW))
    y0 = max(0, int(y // CH))
    x1 = min(gw - 1, int((x + w) // CW))
    y1 = min(gh - 1, int((y + h) // CH))
    for gy in range(y0, y1 + 1):
        for gx in range(x0, x1 + 1):
            blocked[gy * gw + gx] = 1 if val else 0


def carve_path(blocked, pts, radius, gw, gh):
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        steps = int(max(1, ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 / 8))
        for s in range(steps + 1):
            t = s / steps
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            gx0 = max(0, int((x - radius) // CW))
            gy0 = max(0, int((y - radius) // CH))
            gx1 = min(gw - 1, int((x + radius) // CW))
            gy1 = min(gh - 1, int((y + radius) // CH))
            r2 = radius * radius
            for gy in range(gy0, gy1 + 1):
                wy = (gy + 0.5) * CH
                for gx in range(gx0, gx1 + 1):
                    wx = (gx + 0.5) * CW
                    if (wx - x) ** 2 + (wy - y) ** 2 <= r2:
                        blocked[gy * gw + gx] = 0


def load_layout_orig() -> Image.Image:
    """Map gốc Phổ Minh — asset bố cục điện/ao/đường (không Yên Tử)."""
    p = TILES / "tran-pho-minh-map.jpg"
    if not p.exists():
        raise SystemExit(f"missing layout orig {p}")
    return Image.open(p).convert("RGB")


def core_origin(size: int = SIZE, core_sz: int = CORE_SZ) -> tuple[int, int]:
    ox = (size - core_sz) // 2
    oy = (size - core_sz) // 2 + CORE_OY_BIAS
    return ox, oy


def layout_to_world(lx: float, ly: float, size: int = SIZE, core_sz: int = CORE_SZ) -> tuple[int, int]:
    """Đổi offset cũ (theo core≈3300, tâm map) → tọa độ world khi core nhỏ hơn."""
    ox, oy = core_origin(size, core_sz)
    old_ox = (size - int(LEGACY_CORE)) // 2
    old_oy = (size - int(LEGACY_CORE)) // 2 - 40
    rx = (lx - old_ox) * (core_sz / LEGACY_CORE)
    ry = (ly - old_oy) * (core_sz / LEGACY_CORE)
    return int(ox + rx), int(oy + ry)


def _margin_forest(size: int, src: Image.Image) -> np.ndarray:
    """Rừng mép khớp tông layout — không mirror, không ô tile lộ."""
    sa = np.asarray(src.convert("RGB"), dtype=np.float32)
    h, w = sa.shape[:2]
    # lấy màu trung bình vành đai ngoài (tán cây layout)
    band = max(8, h // 10)
    rim = np.concatenate(
        [sa[:band].reshape(-1, 3), sa[-band:].reshape(-1, 3), sa[:, :band].reshape(-1, 3), sa[:, -band:].reshape(-1, 3)],
        0,
    )
    mean = rim.mean(0)
    rng = np.random.default_rng(400)
    yy, xx = np.mgrid[0:size, 0:size]
    base = np.zeros((size, size, 3), dtype=np.float32)
    for i in range(3):
        base[..., i] = mean[i] + rng.normal(0, 4.0, (size, size))
    wave = (4.0 * np.sin(xx / 200.0) * np.cos(yy / 240.0)).astype(np.float32)
    base = base + wave[..., None]

    bamboo = open_tile("tran-bamboo-trees.jpg", "tran-ground.jpg")
    if bamboo is not None:
        b = bamboo.resize((1500, 1500), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
        b0 = np.asarray(b, dtype=np.float32)
        b1 = np.asarray(b.transpose(Image.FLIP_LEFT_RIGHT), dtype=np.float32)
        bpix = 0.55 * b0[yy % 1500, xx % 1500] + 0.45 * b1[(yy + 380) % 1500, (xx + 290) % 1500]
        # kéo về tông rim layout
        bL = bpix.mean(axis=2, keepdims=True) + 1e-5
        tL = float(mean.mean()) + 1e-5
        bpix = bpix * (0.55 + 0.45 * (tL / bL))  # giữ texture tre, chỉ kéo luminance vừa
        bpix = bpix * 0.82 + mean.reshape(1, 1, 3) * 0.18
        dens = (0.78 + 0.14 * np.sin(xx / 120.0 + yy / 150.0)).astype(np.float32)[..., None]
        base = base * (1.0 - dens) + bpix * dens
    # blur nhẹ phá đường may, vẫn giữ chi tiết tán
    out = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGB").filter(
        ImageFilter.GaussianBlur(0.8)
    )
    return np.asarray(out, dtype=np.float32)


def build_canvas_from_layout(src: Image.Image, size: int = SIZE) -> Image.Image:
    """Thu nhỏ bố cục giữa map; mép rừng tông khớp, feather rộng."""
    core_sz = CORE_SZ
    core = src.resize((core_sz, core_sz), Image.LANCZOS)
    ca = np.asarray(core, dtype=np.float32)
    ox, oy = core_origin(size, core_sz)
    forest = _margin_forest(size, src)
    sharp = forest.copy()
    sharp[oy : oy + core_sz, ox : ox + core_sz] = ca

    mask = np.zeros((size, size), dtype=np.float32)
    mask[oy : oy + core_sz, ox : ox + core_sz] = 1.0
    mask = (
        np.asarray(
            Image.fromarray((mask * 255).astype(np.uint8), "L").filter(
                ImageFilter.GaussianBlur(48)
            ),
            dtype=np.float32,
        )
        / 255.0
    )
    ba = forest * (1.0 - mask[..., None]) + sharp * mask[..., None]
    ba[oy : oy + core_sz, ox : ox + core_sz] = ca

    print(f"core {core_sz} at ({ox},{oy}) scale={LAYOUT_SCALE:.2f} vs legacy {int(LEGACY_CORE)}")
    return Image.fromarray(np.clip(ba, 0, 255).astype(np.uint8), "RGB")


def roof_mask(og: np.ndarray, path_m: np.ndarray | None = None) -> np.ndarray:
    """Mái ngói đỏ — loại đường đất cam (tránh nhuộm path thành đỏ phẳng)."""
    r, g, b = og[..., 0], og[..., 1], og[..., 2]
    bright = (r + g + b) / 3.0
    sat = og.max(2) - og.min(2)
    # mái: đỏ hơn đường, thường sáng vừa + có kết cấu ngói (sat cao hơn đất)
    m = (
        (r > g + 12)
        & (r > b + 18)
        & (r > 90)
        & (g < 140)
        & (bright > 70)
        & (bright < 190)
        & (sat > 35)
    ).astype(np.float32)
    if path_m is not None:
        m = m * (1.0 - np.clip(path_m, 0, 1))
    return m


def dirt_path_mask(og: np.ndarray, c: dict) -> np.ndarray:
    """Đường đất cam/nâu layout gốc — bảo vệ khỏi restyle mái."""
    r, g, b = og[..., 0], og[..., 1], og[..., 2]
    bright = (r + g + b) / 3.0
    # đường đất: nâu-cam, không quá đỏ thuần, trải ngang
    dirt = (
        (r > g + 4)
        & (r > b + 8)
        & (g > b)
        & (r > 55)
        & (r < 160)
        & (bright > 40)
        & (bright < 150)
        & (g > 25)
    ).astype(np.float32)
    return blur_mask(np.clip(c["path"] * 1.4 + dirt * 0.85, 0, 1), 1.3)


def water_mask(og: np.ndarray) -> np.ndarray:
    r, g, b = og[..., 0], og[..., 1], og[..., 2]
    bright = (r + g + b) / 3.0
    return (
        (b > r + 10) & (b >= g - 2) & (bright < 100) & (bright > 20) & (g < 140)
    ).astype(np.float32)


def retexture_trees(img: Image.Image) -> Image.Image:
    """Đổi phong cảnh tán/tre trúc — chỉ canopy, giữ đường/ao/điện/sư tử."""
    arr = np.asarray(img, dtype=np.float32)
    H, W = arr.shape[:2]
    c = classify(arr)
    m_path = dirt_path_mask(arr, c)
    m_roof = roof_mask(arr, m_path)
    m_water = water_mask(arr)
    m_built = blur_mask(np.clip(c["built"] + m_roof, 0, 1), 1.3)
    m_tree = blur_mask(c["canopy"] * (1.0 - m_roof), 1.2)

    protect = np.clip(m_path * 1.5 + m_built * 1.2 + m_water * 1.4, 0, 1)
    cover = np.clip(m_tree * (1.0 - protect), 0, 1)
    cover = blur_mask(cover, 1.6)

    bamboo = open_tile("tran-bamboo-trees.jpg", "tran-ground.jpg")
    if bamboo is None:
        return img

    yy, xx = np.mgrid[0:H, 0:W]
    bimg = bamboo.resize((960, 960), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
    b0 = np.asarray(bimg, dtype=np.float32)
    b1 = np.asarray(bimg.transpose(Image.FLIP_LEFT_RIGHT), dtype=np.float32)
    b2 = np.asarray(bimg.transpose(Image.FLIP_TOP_BOTTOM), dtype=np.float32)
    bpix = (
        0.45 * b0[yy % 960, xx % 960]
        + 0.35 * b1[(yy + 180) % 960, (xx + 240) % 960]
        + 0.20 * b2[(yy + 320) % 960, (xx + 120) % 960]
    )
    # ép tông xanh rêu Trần
    br, bg, bb = bpix[..., 0], bpix[..., 1], bpix[..., 2]
    bpix[..., 0] = np.clip(br * 0.82 + bg * 0.10, 0, 255)
    bpix[..., 1] = np.clip(bg * 1.08, 0, 255)
    bpix[..., 2] = np.clip(bb * 0.90, 0, 255)
    oL = arr.mean(2) + 1e-5
    bL = bpix.mean(2) + 1e-5
    bpix = bpix * (oL / bL)[..., None]

    edge = np.minimum(np.minimum(xx, W - 1 - xx), np.minimum(yy, H - 1 - yy)).astype(np.float32)
    edge_m = np.clip(1.0 - edge / 480.0, 0, 1)
    # tán giữa map vừa; mép/rừng dày hơn
    dens = 0.55 + 0.45 * edge_m + 0.22 * (1.0 - yy / max(H - 1, 1))
    a = blur_mask(cover * dens, 2.2)[..., None]
    out = arr * (1.0 - a * 0.92) + bpix * (a * 0.92)

    lock = np.clip(protect + blur_mask(m_roof, 1.0), 0, 1)[..., None]
    out = out * (1.0 - lock) + arr * lock
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def load_house_rgba() -> Image.Image:
    """Key nền ô vuông + bỏ pad cỏ/đá đáy — tránh khung card khi stamp."""
    p = TILES / "prop-tran-house.jpg"
    im = Image.open(p).convert("RGB")
    a = np.asarray(im, dtype=np.float32)
    h, w = a.shape[:2]
    corners = np.stack([a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]]).mean(0)
    diff = np.abs(a - corners).sum(2)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    sat = a.max(2) - a.min(2)
    bright = (r + g + b) / 3.0
    grass = (g > r + 6) & (g > b + 4) & (g > 70) & (g < 165) & (sat < 58)
    # pad sàn đá xám ở đáy sprite
    y = np.arange(h)[:, None]
    foot_band = y >= int(h * 0.78)
    stone_pad = foot_band & (sat < 35) & (bright > 70) & (bright < 170) & (np.abs(r - g) < 22)
    alpha = np.clip((diff - 32) / 55.0, 0, 1)
    alpha = np.where(grass, alpha * 0.08, alpha)
    alpha = np.where(stone_pad, alpha * 0.2, alpha)
    # fade đáy — để bậc thềm gốc layout lộ ra, hết mép chữ nhật
    fade = np.clip((h - 1 - y) / (h * 0.22), 0, 1)
    alpha = alpha * (0.35 + 0.65 * fade)
    alpha = (alpha * 255).astype(np.uint8)
    am = Image.fromarray(alpha, "L").filter(ImageFilter.GaussianBlur(3.2))
    # erode nhẹ mép ngoài
    am = Image.fromarray(
        np.minimum(np.asarray(am), np.asarray(am.filter(ImageFilter.MinFilter(3)))), "L"
    )
    rgba = im.convert("RGBA")
    rgba.putalpha(am)
    bb = am.getbbox()
    if bb:
        rgba = rgba.crop(bb)
    return rgba


def soften_old_hall(base: Image.Image, cx: int, cy: int, w: int, h: int) -> Image.Image:
    """Làm mờ điện cũ trong footprint trước khi stamp — tránh chồng 2 mái."""
    arr = np.asarray(base, dtype=np.float32)
    H, W = arr.shape[:2]
    x0, y0 = max(0, cx - w // 2), max(0, cy - h // 2)
    x1, y1 = min(W, cx + w // 2), min(H, cy + h // 2)
    patch = arr[y0:y1, x0:x1].copy()
    ph, pw = patch.shape[:2]
    yy, xx = np.ogrid[:ph, :pw]
    # ellipse mềm quanh điện
    ey = ((yy - ph * 0.42) / (ph * 0.42)) ** 2
    ex = ((xx - pw * 0.5) / (pw * 0.42)) ** 2
    ell = np.clip(1.0 - (ex + ey), 0, 1).astype(np.float32)
    ell = blur_mask(ell, 2.5)
    # chỉ đè mái/thân cũ (đỏ/nâu), giữ đường đá dưới
    r, g, b = patch[..., 0], patch[..., 1], patch[..., 2]
    bright = (r + g + b) / 3.0
    roofish = ((r > g + 4) & (r > b + 6) & (r > 70) & (bright < 200)).astype(np.float32)
    body = ((np.abs(r - g) < 35) & (bright > 40) & (bright < 140) & (b < g + 10)).astype(np.float32)
    m = blur_mask(np.clip(roofish + body * 0.7, 0, 1) * ell, 1.8)[..., None]
    # hòa vào đất/cỏ quanh (lấy biên patch)
    edge = np.concatenate(
        [patch[0, :], patch[-1, :], patch[:, 0], patch[:, -1]], 0
    ).mean(0)
    # ưu tiên xanh cỏ nếu biên xanh
    fill = edge * np.array([0.92, 1.02, 0.88], dtype=np.float32)
    fill = np.clip(fill, 0, 255)
    patch = patch * (1.0 - 0.78 * m) + fill * (0.78 * m)
    arr[y0:y1, x0:x1] = patch
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


def stamp_matched(
    canvas: Image.Image, spr: Image.Image, cx: int, cy: int, strength: float = 0.78
) -> None:
    """Stamp prop khớp luminance — mép feather rộng, không khung card."""
    sw, sh = spr.size
    x0, y0 = cx - sw // 2, cy - sh // 2
    x1, y1 = x0 + sw, y0 + sh
    if x1 <= 0 or y1 <= 0 or x0 >= canvas.width or y0 >= canvas.height:
        return
    sx0 = max(0, -x0)
    sy0 = max(0, -y0)
    sx1 = sw - max(0, x1 - canvas.width)
    sy1 = sh - max(0, y1 - canvas.height)
    dx0, dy0 = max(0, x0), max(0, y0)
    spr2 = spr.crop((sx0, sy0, sx1, sy1))
    r, g, b, a = spr2.split()
    a = a.point(lambda p: int(p * strength))
    a = a.filter(ImageFilter.GaussianBlur(2.8))
    spr2 = Image.merge("RGBA", (r, g, b, a))

    base = canvas.crop((dx0, dy0, dx0 + spr2.width, dy0 + spr2.height)).convert("RGB")
    ba = np.asarray(base, dtype=np.float32)
    sa = np.asarray(spr2, dtype=np.float32)
    hh = sa.shape[0]
    foot = slice(int(hh * 0.55), int(hh * 0.85))
    am = sa[foot, :, 3:4] / 255.0
    if float(am.mean()) > 0.04:
        bL = float(((ba[foot] * am).sum() / (am.sum() * 3 + 1e-5)))
        sL = float(((sa[foot, :, :3] * am).sum() / (am.sum() * 3 + 1e-5)))
        gain = float(np.clip(bL / (sL + 1e-5), 0.78, 1.18))
        sa[..., :3] = np.clip(sa[..., :3] * gain, 0, 255)
        spr2 = Image.fromarray(sa.astype(np.uint8), "RGBA")

    canvas.alpha_composite(spr2, dest=(dx0, dy0))


def restyle_temple(base: Image.Image) -> Image.Image:
    """Đổi kiến trúc chùa trên đúng footprint — chỉ mái + cột gần dính mái.

    Không stamp, không ridge giả, không nhuộm đường đất.
    """
    arr = np.asarray(base, dtype=np.float32)
    c = classify(arr)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    bright = (r + g + b) / 3.0
    sat = arr.max(2) - arr.min(2)
    h, s, v = rgb_to_hsv(arr)

    m_path = dirt_path_mask(arr, c)
    m_roof = blur_mask(roof_mask(arr, m_path), 0.6)

    # chỉ giữ cụm mái lớn gần trung tâm điện (bỏ đốm đỏ lẻ trên cây/đường)
    roof_bin = (m_roof > 0.35).astype(np.uint8)
    # centroid trọng số — giữ pixel gần điện chính
    ys, xs = np.where(roof_bin)
    if len(ys) > 80:
        cy = int(np.median(ys))
        cx = int(np.median(xs))
        yy, xx = np.ogrid[: arr.shape[0], : arr.shape[1]]
        dist = np.sqrt((yy - cy) ** 2 + (xx - cx) ** 2)
        m_roof = m_roof * np.clip(1.0 - (dist - 220) / 160.0, 0, 1)

    roof_near = Image.fromarray((m_roof * 255).astype(np.uint8), "L")
    for _ in range(2):
        roof_near = roof_near.filter(ImageFilter.MaxFilter(7))
    roof_near = np.asarray(roof_near, dtype=np.float32) / 255.0
    wood = (
        (r > g + 10)
        & (r > b + 12)
        & (r > 65)
        & (r < 150)
        & (bright < 125)
        & (sat > 25)
        & (sat < 80)
        & (roof_near > 0.4)
        & (m_path < 0.2)
    ).astype(np.float32)
    m_wood = blur_mask(wood, 0.7)

    h = h * (1.0 - 0.70 * m_roof) + 0.04 * (0.70 * m_roof)
    s = np.clip(s * (1.0 - 0.22 * m_roof) + 0.46 * m_roof, 0, 1)
    v = np.clip(v * (1.0 + 0.02 * m_roof), 0, 1)

    h = h * (1.0 - 0.50 * m_wood) + 0.065 * (0.50 * m_wood)
    s = np.clip(s * (1.0 - 0.20 * m_wood) + 0.28 * m_wood, 0, 1)
    v = np.clip(v * (1.0 - 0.04 * m_wood), 0, 1)

    out = hsv_to_rgb(h, s, v)
    warm = np.array([1.06, 1.00, 0.92], dtype=np.float32)
    add = np.array([4.0, 1.0, -1.0], dtype=np.float32)
    wm = (m_roof * 0.40 + m_wood * 0.28)[..., None]
    out = out * (1.0 - wm) + np.clip(out * warm + add, 0, 255) * wm
    # khóa cứng đường đất gốc
    pm = np.clip(m_path, 0, 1)[..., None]
    out = out * (1.0 - pm) + arr * pm
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def reskin_scenery(img: Image.Image, bias: str = "warm") -> Image.Image:
    """Grade Trần ấm — khóa mái ngói, tán xanh rêu, đường đất."""
    W, H = img.size
    og = np.asarray(img, dtype=np.float32)
    c = classify(og)
    p = bias_params(bias)
    h, s, v = rgb_to_hsv(og)
    r, g, b = og[..., 0], og[..., 1], og[..., 2]

    roof_raw = roof_mask(og)
    m_roof = blur_mask(roof_raw, 0.7)
    m_path = blur_mask(c["path"], 0.9)
    m_grass = blur_mask(c["grass"], 1.0)
    m_tree = blur_mask(c["canopy"] * (1.0 - roof_raw), 0.9)
    m_rock = blur_mask(c["rock"], 0.8)
    m_built = blur_mask(np.clip(c["built"] + roof_raw, 0, 1), 1.0)

    stack = np.stack(
        [
            m_roof * 2.2,
            m_built * 1.35,
            m_tree * 1.25,
            m_path * 1.15,
            m_grass * 1.0,
            m_rock * 1.05,
        ],
        axis=-1,
    )
    wgt = stack / (stack.sum(-1, keepdims=True) + 1e-5)
    mrf, mb, mt, mp, mg, mr = [wgt[..., i] for i in range(6)]

    h, s = mix_hue_sat(h, s, mb * (1.0 - mrf), p["built"][0], p["built"][1], hue_w=0.55, sat_w=0.35)
    # Tán: xanh rêu Đại Việt rõ hơn
    h, s = mix_hue_sat(h, s, mt, 0.30, 0.40, hue_w=0.72, sat_w=0.52)
    h, s = mix_hue_sat(h, s, mp, p["path"][0], p["path"][1], hue_w=0.4, sat_w=0.28)
    h, s = mix_hue_sat(h, s, mg, 0.29, 0.34, hue_w=0.55, sat_w=0.38)
    h, s = mix_hue_sat(h, s, mr, p["rock"][0], p["rock"][1], hue_w=0.4, sat_w=0.25)

    # Khóa hue mái ngói đỏ-cam (vừa — đã restyle_temple)
    h = h * (1.0 - 0.55 * mrf) + 0.04 * (0.55 * mrf)
    s = np.clip(s * (1.0 - 0.18 * mrf) + 0.42 * mrf, 0, 1)
    v = np.clip(v * (1.0 + 0.02 * mrf), 0, 1)

    body = mb * (1.0 - mrf) * np.clip((130.0 - c["bright"]) / 70.0, 0, 1)
    h = h * (1.0 - 0.30 * body) + 0.07 * (0.30 * body)
    s = np.clip(s * (1.0 - 0.15 * body) + 0.20 * body, 0, 1)

    mw = blur_mask(water_mask(og), 1.0) * (1.0 - mrf)
    h = h * (1.0 - 0.48 * mw) + 0.56 * (0.48 * mw)
    s = np.clip(s * (1.0 - 0.2 * mw) + 0.34 * mw, 0, 1)

    out = hsv_to_rgb(h, s, v)
    warm_mul = np.array([1.12, 1.02, 0.88], dtype=np.float32)
    warm_add = np.array([8.0, 3.0, -2.0], dtype=np.float32)
    warm_m = (mb * 0.35 + mrf * 0.55)[..., None]
    out = out * (1.0 - warm_m) + np.clip(out * warm_mul + warm_add, 0, 255) * warm_m

    grain = ground_grain(W, H, seed=400)
    if grain is not None:
        gmask = ((mp * 0.22 + mg * 0.12) * (1.0 - mrf))[..., None]
        gL = grain.mean(2) + 1e-5
        oL = out.mean(2) + 1e-5
        grain2 = grain * (oL / gL)[..., None]
        out = out * (1.0 - gmask) + grain2 * gmask

    out[..., 0] = np.clip(out[..., 0] * 1.02 + 1, 0, 255)
    out[..., 1] = np.clip(out[..., 1] * 1.015, 0, 255)
    out[..., 2] = np.clip(out[..., 2] * 0.96, 0, 255)

    img2 = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    img2 = ImageEnhance.Contrast(img2).enhance(1.04)
    img2 = ImageEnhance.Color(img2).enhance(1.02)
    img2 = ImageEnhance.Sharpness(img2).enhance(1.12)
    return img2


def obs_for_layout(meta2: dict, size: int = SIZE) -> dict:
    """Vật cản Phổ Minh: trong lõi mở rộng (không kế thừa núi Yên Tử).

    Chỉ chặn điện / sư tử / ao; đường + cỏ + khúc gỗ đi xuyên được.
    Ngoài lõi vẫn chặn để giữ người chơi trong khu chùa.
    """
    gw, gh = meta2["gw"], meta2["gh"]
    # bỏ obs zone 2 — footprint Phổ Minh khác hẳn
    blocked = [0] * (gw * gh)
    ox, oy = core_origin(size, CORE_SZ)
    margin = 36
    for gy in range(gh):
        for gx in range(gw):
            wx, wy = (gx + 0.5) * CW, (gy + 0.5) * CH
            if (
                wx < ox + margin
                or wy < oy + margin
                or wx > ox + CORE_SZ - margin
                or wy > oy + CORE_SZ - margin
            ):
                blocked[gy * gw + gx] = 1

    s = LAYOUT_SCALE
    cx0, cy0 = size // 2, size // 2

    def R(dx, dy, w, h):
        x, y = layout_to_world(cx0 + dx, cy0 + dy, size, CORE_SZ)
        mark_rect(blocked, x, y, max(32, int(w * s)), max(16, int(h * s)), True, gw, gh)

    def P(pts, radius):
        world = [layout_to_world(cx0 + dx, cy0 + dy, size, CORE_SZ) for dx, dy in pts]
        carve_path(blocked, world, max(36, int(radius * s)), gw, gh)

    # chỉ khối kiến trúc / nước — không chặn khúc gỗ / cỏ
    R(-260, -500, 520, 380)  # điện chính (hẹp hơn — chừa thềm đi)
    R(-300, -140, 160, 120)  # sư tử L
    R(100, -120, 160, 120)  # sư tử R
    R(-700, -60, 240, 220)  # ao sen

    # mạng đường rộng (gồm nhánh qua khu khúc gỗ bên trái điện)
    P([(-200, 1100), (0, 220), (0, -40)], 110)
    P([(-600, 400), (-280, 220), (-80, 80)], 90)
    P([(500, 500), (160, 180), (40, 40)], 80)
    P([(-450, 80), (-200, 40), (0, 60)], 85)  # ngang qua logs → sân
    P([(-120, 400), (-80, 160), (200, 200)], 75)
    # vòng sau điện
    P([(-200, -80), (-400, -200), (-100, -360), (200, -200), (80, -40)], 70)

    meta = dict(meta2)
    meta["w"] = size
    meta["h"] = size
    meta["gw"] = gw
    meta["gh"] = gh
    meta["cw"] = CW
    meta["ch"] = CH
    meta["obs"] = encode_obs(blocked)
    meta["blocked"] = int(sum(blocked))
    return meta


def light_grade(img: Image.Image) -> Image.Image:
    """Grade rất nhẹ — giữ đường đất layout, không nhuộm đỏ toàn map."""
    arr = np.asarray(img, dtype=np.float32)
    arr[..., 0] = np.clip(arr[..., 0] * 1.01 + 1, 0, 255)
    arr[..., 1] = np.clip(arr[..., 1] * 1.02, 0, 255)
    arr[..., 2] = np.clip(arr[..., 2] * 0.985, 0, 255)
    out = Image.fromarray(arr.astype(np.uint8), "RGB")
    out = ImageEnhance.Contrast(out).enhance(1.03)
    out = ImageEnhance.Sharpness(out).enhance(1.10)
    return out


def rebuild() -> Image.Image:
    src = load_layout_orig()
    print(f"layout orig {src.size} from {TILES / 'tran-pho-minh-map.jpg'}")
    canvas = build_canvas_from_layout(src, SIZE)
    canvas = retexture_trees(canvas)
    print("retextured trees/bamboo")
    canvas = restyle_temple(canvas)
    print("restyled temple roof/pillars on footprint")
    # không chạy full warm reskin (tránh đè đường cam thành đỏ)
    img = light_grade(canvas)
    return img


def save_previews(img: Image.Image, before: Image.Image | None = None) -> None:
    ART.mkdir(parents=True, exist_ok=True)
    img.resize((800, 800), Image.LANCZOS).save(ART / "pho-minh-full.jpg", quality=88)
    # crop quanh điện theo lõi mới
    tx, ty = layout_to_world(SIZE // 2, SIZE // 2 - 380, SIZE, CORE_SZ)
    half = int(420 * LAYOUT_SCALE) + 40
    img.crop((tx - half, ty - half, tx + half, ty + int(half * 0.85))).save(
        ART / "pho-minh-temple.jpg", quality=92
    )
    px, py = layout_to_world(SIZE // 2 - 550, SIZE // 2 + 150, SIZE, CORE_SZ)
    img.crop((px - 350, py - 350, px + 350, py + 350)).save(ART / "pho-minh-pond-trees.jpg", quality=90)
    img.crop((80, 80, 900, 900)).save(ART / "pho-minh-corner-trees.jpg", quality=90)
    if before is not None:
        side = Image.new("RGB", (1600, 820), (18, 16, 14))
        side.paste(before.resize((800, 800), Image.LANCZOS), (0, 20))
        side.paste(img.resize((800, 800), Image.LANCZOS), (800, 20))
        from PIL import ImageDraw

        d = ImageDraw.Draw(side)
        d.text((20, 2), "before", fill=(200, 180, 140))
        d.text((820, 2), "rebuild scenery", fill=(160, 220, 160))
        side.save(ART / "pho-minh-before-after.jpg", quality=90)


def main() -> None:
    apply = "--preview" not in sys.argv
    before = Image.open(Z / "400.jpg").convert("RGB") if (Z / "400.jpg").exists() else None
    img = rebuild()

    out_path = Z / "400.jpg"
    if apply:
        img.save(out_path, quality=90, optimize=True)
        print(f"saved {out_path} {out_path.stat().st_size // 1024}KB")
    else:
        ART.mkdir(parents=True, exist_ok=True)
        img.save(ART / "400-preview.jpg", quality=90)
        print("preview only — not writing img/z/400.jpg")

    save_previews(img, before)

    if apply:
        jmo = (ROOT / "jmo.js").read_text(encoding="utf-8")
        meta2, _, _ = extract_zone(jmo, "2")
        meta = obs_for_layout(meta2, SIZE)
        patch_jmo2_assign_zone("400", meta)
        print(f"jmo2 400 obs blocked={meta['blocked']}")

        ver = bump_cache()
        z2 = (ROOT / "zones2.js").read_text(encoding="utf-8")
        (ROOT / "zones2.js").write_text(
            re.sub(r"img/z/400\.jpg(?:\?v=\d+)?", f"img/z/400.jpg?v={ver}", z2), encoding="utf-8"
        )
        # keep other zone bg versions in sync where bump_cache touched world
        z2 = (ROOT / "zones2.js").read_text(encoding="utf-8")
        z2 = re.sub(r"(img/z/\w+\.jpg)\?v=\d+", rf"\1?v={ver}", z2)
        (ROOT / "zones2.js").write_text(z2, encoding="utf-8")
        print(f"Done v{ver} — bố cục gốc + phong cảnh/cây/chùa Trần")


if __name__ == "__main__":
    main()
