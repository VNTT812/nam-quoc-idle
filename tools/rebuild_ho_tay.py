#!/usr/bin/env python3
"""Hồ Tây (401): khôi phục bố cục map gốc rồi dựng lại bối cảnh.

- Layout gốc = tran-ho-tay-map.jpg (nhà Trần, bến đá, cầu gỗ, sen, tre) — không lát tile.
- Reskin bias water: giữ mái ngói đỏ + mặt nước hồ.
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
    classify,
    ground_grain,
    hsv_to_rgb,
    mix_hue_sat,
    rgb_to_hsv,
)

CW, CH = 32, 16
SIZE = 3584


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
    p = TILES / "tran-ho-tay-map.jpg"
    if not p.exists():
        raise SystemExit(f"missing layout orig {p}")
    return Image.open(p).convert("RGB")


def build_canvas_from_layout(src: Image.Image, size: int = SIZE) -> Image.Image:
    """Phóng bố cục Hồ Tây gốc — một cảnh liền, không flip/lát mảnh."""
    base = src.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.1))
    ba = np.asarray(base, dtype=np.float32)

    core_sz = 3320
    core = src.resize((core_sz, core_sz), Image.LANCZOS)
    ca = np.asarray(core, dtype=np.float32)
    # Layout gốc: nước lệch dưới-trái, cụm nhà lệch trên-phải một chút
    ox = (size - core_sz) // 2 + 20
    oy = (size - core_sz) // 2 - 30

    yy, xx = np.ogrid[:core_sz, :core_sz]
    margin = 170.0
    dx = np.minimum(xx, core_sz - 1 - xx)
    dy = np.minimum(yy, core_sz - 1 - yy)
    edge = np.minimum(dx, dy).astype(np.float32)
    alpha = np.clip(edge / margin, 0, 1)
    alpha = alpha * alpha * (3 - 2 * alpha)

    x0, y0 = max(0, ox), max(0, oy)
    x1, y1 = min(size, ox + core_sz), min(size, oy + core_sz)
    sx0, sy0 = x0 - ox, y0 - oy
    sw, sh = x1 - x0, y1 - y0
    a = alpha[sy0 : sy0 + sh, sx0 : sx0 + sw][..., None]
    patch = ca[sy0 : sy0 + sh, sx0 : sx0 + sw]
    ba[y0:y1, x0:x1] = patch * a + ba[y0:y1, x0:x1] * (1.0 - a)

    return Image.fromarray(np.clip(ba, 0, 255).astype(np.uint8), "RGB")


def reskin_scenery(img: Image.Image, bias: str = "water") -> Image.Image:
    """Bối cảnh Hồ Tây — giữ mái đỏ + mặt nước, không nuốt layout."""
    W, H = img.size
    og = np.asarray(img, dtype=np.float32)
    c = classify(og)
    p = bias_params(bias)
    h, s, v = rgb_to_hsv(og)
    r, g, b = og[..., 0], og[..., 1], og[..., 2]

    roof_raw = (
        (r > g + 6)
        & (r > b + 8)
        & (r > 75)
        & (g < 175)
        & (c["bright"] > 55)
        & (c["bright"] < 210)
    ).astype(np.float32)
    m_roof = blur_mask(roof_raw, 0.7)

    # Nước hồ: tối, thiên xanh — mạnh hơn Phổ Minh vì Hồ Tây có mặt nước lớn
    water_raw = (
        (b > r + 6)
        & (b >= g - 8)
        & (c["bright"] < 115)
        & (c["bright"] > 18)
        & (g < 150)
        & ~((r > g + 8) & (r > 80))  # không phải mái
    ).astype(np.float32)
    m_water = blur_mask(water_raw, 1.4)

    m_path = blur_mask(c["path"] * (1.0 - water_raw), 0.9)
    m_grass = blur_mask(c["grass"] * (1.0 - water_raw), 1.0)
    m_tree = blur_mask(c["canopy"] * (1.0 - roof_raw), 0.9)
    m_rock = blur_mask(c["rock"] * (1.0 - water_raw * 0.7), 0.8)
    m_built = blur_mask(np.clip(c["built"] + roof_raw, 0, 1) * (1.0 - water_raw * 0.5), 1.0)

    stack = np.stack(
        [
            m_roof * 2.2,
            m_water * 1.8,
            m_built * 1.3,
            m_tree * 1.15,
            m_path * 1.15,
            m_grass * 1.0,
            m_rock * 1.05,
        ],
        axis=-1,
    )
    w = stack / (stack.sum(-1, keepdims=True) + 1e-5)
    mrf, mw, mb, mt, mp, mg, mr = [w[..., i] for i in range(7)]

    h, s = mix_hue_sat(h, s, mb * (1.0 - mrf), p["built"][0], p["built"][1], hue_w=0.5, sat_w=0.32)
    h, s = mix_hue_sat(h, s, mt, p["canopy"][0], p["canopy"][1], hue_w=0.5, sat_w=0.38)
    h, s = mix_hue_sat(h, s, mp, p["path"][0], p["path"][1], hue_w=0.38, sat_w=0.26)
    h, s = mix_hue_sat(h, s, mg, p["grass"][0], p["grass"][1], hue_w=0.42, sat_w=0.3)
    h, s = mix_hue_sat(h, s, mr, p["rock"][0], p["rock"][1], hue_w=0.38, sat_w=0.22)

    # Mái ngói đỏ-cam
    h = h * (1.0 - 0.85 * mrf) + 0.04 * (0.85 * mrf)
    s = np.clip(s * (1.0 - 0.35 * mrf) + 0.48 * mrf, 0, 1)
    v = np.clip(v * (1.0 + 0.03 * mrf), 0, 1)

    # Mặt nước hồ — xanh mát sâu
    h = h * (1.0 - 0.7 * mw) + 0.56 * (0.7 * mw)
    s = np.clip(s * (1.0 - 0.25 * mw) + 0.38 * mw, 0, 1)
    v = np.clip(v * (1.0 - 0.08 * mw), 0, 1)

    body = mb * (1.0 - mrf) * np.clip((130.0 - c["bright"]) / 70.0, 0, 1)
    h = h * (1.0 - 0.25 * body) + 0.07 * (0.25 * body)
    s = np.clip(s * (1.0 - 0.14 * body) + 0.16 * body, 0, 1)

    out = hsv_to_rgb(h, s, v)
    warm_mul = np.array([1.1, 1.02, 0.9], dtype=np.float32)
    warm_add = np.array([6.0, 2.0, -1.0], dtype=np.float32)
    warm_m = (mb * 0.3 + mrf * 0.5)[..., None]
    out = out * (1.0 - warm_m) + np.clip(out * warm_mul + warm_add, 0, 255) * warm_m

    # Nước: hơi kéo xanh, giảm grain
    water_mul = np.array([0.92, 1.02, 1.12], dtype=np.float32)
    out = out * (1.0 - 0.35 * mw[..., None]) + np.clip(out * water_mul, 0, 255) * (
        0.35 * mw[..., None]
    )

    grain = ground_grain(W, H, seed=401)
    if grain is not None:
        gmask = ((mp * 0.2 + mg * 0.1) * (1.0 - mrf) * (1.0 - mw))[..., None]
        gL = grain.mean(2) + 1e-5
        oL = out.mean(2) + 1e-5
        grain2 = grain * (oL / gL)[..., None]
        out = out * (1.0 - gmask) + grain2 * gmask

    out[..., 0] = np.clip(out[..., 0] * 1.01 + 1, 0, 255)
    out[..., 1] = np.clip(out[..., 1] * 1.02, 0, 255)
    out[..., 2] = np.clip(out[..., 2] * 1.01, 0, 255)

    img2 = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    img2 = ImageEnhance.Contrast(img2).enhance(1.05)
    img2 = ImageEnhance.Color(img2).enhance(1.04)
    img2 = ImageEnhance.Sharpness(img2).enhance(1.14)
    return img2


def obs_for_layout(meta56: dict, img: Image.Image, size: int = SIZE) -> dict:
    """Vật cản Hồ Tây: giữ độ thông thoáng gần zone 56, khớp nhà/nước layout mới."""
    gw, gh = meta56["gw"], meta56["gh"]
    # Base = obs Vân Đồn (ban đầu 401 copy từ đây) — đã cân bằng đi lại
    blocked = decode_obs(meta56)
    cx, cy = size // 2, size // 2

    # Chặn footprint nhà theo bố cục Hồ Tây
    mark_rect(blocked, cx - 60, cy - 440, 440, 300, True, gw, gh)
    mark_rect(blocked, cx - 540, cy - 160, 280, 200, True, gw, gh)
    mark_rect(blocked, cx + 160, cy - 40, 260, 180, True, gw, gh)
    mark_rect(blocked, cx - 380, cy + 60, 220, 160, True, gw, gh)

    # Nước sâu dưới-trái (không phủ hết nửa dưới)
    arr = np.asarray(img.resize((gw, gh), Image.BILINEAR), dtype=np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    bright = (r + g + b) / 3.0
    deep_water = (b > r + 10) & (b >= g - 4) & (bright < 85) & (bright > 12) & (g < 120)
    for gy in range(gh):
        for gx in range(gw):
            if deep_water[gy, gx] and gy > gh * 0.45:
                blocked[gy * gw + gx] = 1

    # Mở đường làng + dọc bến
    carve_path(
        blocked,
        [(cx - 400, cy + 160), (cx - 40, cy - 20), (cx + 160, cy - 180)],
        100,
        gw,
        gh,
    )
    carve_path(
        blocked,
        [(cx + 400, cy + 320), (cx + 80, cy + 40), (cx, cy - 120)],
        90,
        gw,
        gh,
    )
    carve_path(blocked, [(cx - 160, cy + 480), (cx - 80, cy + 200)], 80, gw, gh)
    carve_path(
        blocked,
        [(200, cy + 220), (cx - 60, cy + 180), (cx + 400, cy + 220)],
        75,
        gw,
        gh,
    )
    carve_path(blocked, [(cx, cy + 120), (cx, cy - 60)], 120, gw, gh)

    meta = dict(meta56)
    meta["obs"] = encode_obs(blocked)
    meta["blocked"] = int(sum(blocked))
    return meta


def main() -> None:
    src = load_layout_orig()
    print(f"layout orig {src.size} from {TILES / 'tran-ho-tay-map.jpg'}")

    canvas = build_canvas_from_layout(src, SIZE)
    img = reskin_scenery(canvas, bias="water")

    out_path = Z / "401.jpg"
    img.save(out_path, quality=90, optimize=True)
    print(f"saved {out_path} {out_path.stat().st_size // 1024}KB")

    art = Path("/opt/cursor/artifacts")
    art.mkdir(parents=True, exist_ok=True)
    img.resize((800, 800), Image.LANCZOS).save(art / "ho-tay-layout-full.jpg", quality=88)
    img.crop((900, 700, 2500, 2100)).save(art / "ho-tay-layout-village.jpg", quality=90)
    img.crop((200, 1800, 2000, 3300)).save(art / "ho-tay-layout-water.jpg", quality=90)

    jmo = (ROOT / "jmo.js").read_text(encoding="utf-8")
    meta56, _, _ = extract_zone(jmo, "56")
    meta = obs_for_layout(meta56, img, SIZE)

    jmo2_path = ROOT / "jmo2.js"
    jmo2 = jmo2_path.read_text(encoding="utf-8")
    _, start, end = extract_zone(jmo2, "401")
    key_start = jmo2.rfind('"401"', 0, start)
    new_obj = json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
    jmo2_path.write_text(jmo2[:key_start] + '"401":' + new_obj + jmo2[end:], encoding="utf-8")
    print(f"jmo2 401 obs blocked={meta['blocked']}")

    ver = bump_cache()
    z2 = (ROOT / "zones2.js").read_text(encoding="utf-8")
    (ROOT / "zones2.js").write_text(
        re.sub(r"img/z/401\.jpg(?:\?v=\d+)?", f"img/z/401.jpg?v={ver}", z2), encoding="utf-8"
    )
    print(f"Done v{ver} — bố cục Hồ Tây gốc + bối cảnh Trần")


if __name__ == "__main__":
    main()
