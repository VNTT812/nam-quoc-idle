#!/usr/bin/env python3
"""Dựng lại Phổ Minh Tự (400): nền liền mạch + cụm chùa rõ nét.

- Base: layout Yên Tử (VLTK) reskin tông ấm — không lát tile AI.
- Điểm nhấn: blend grass-aware 1 cảnh chùa lớn + 2 nhà/bia (không lặp lưới).
"""
from __future__ import annotations

import base64
import json
import re
import subprocess
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from reskin_tran_layout import (  # noqa: E402
    ORIG_REV,
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


def build_base() -> Image.Image:
    data = subprocess.check_output(["git", "show", f"{ORIG_REV}:img/z/2.jpg"])
    orig = Image.open(BytesIO(data)).convert("RGB")
    W, H = orig.size
    og = np.asarray(orig, dtype=np.float32)
    p = bias_params("warm")
    c = classify(og)
    h, s, v = rgb_to_hsv(og)
    m_path = blur_mask(c["path"], 0.9)
    m_grass = blur_mask(c["grass"], 1.1)
    m_tree = blur_mask(c["canopy"], 0.9)
    m_rock = blur_mask(c["rock"], 0.8)
    m_built = blur_mask(c["built"], 1.1)
    stack = np.stack(
        [m_built * 1.35, m_tree * 1.3, m_path * 1.15, m_grass * 1.0, m_rock * 1.05],
        axis=-1,
    )
    w = stack / (stack.sum(-1, keepdims=True) + 1e-5)
    mb, mt, mp, mg, mr = [w[..., i] for i in range(5)]
    h, s = mix_hue_sat(h, s, mb, p["built"][0], p["built"][1], hue_w=0.92, sat_w=0.6)
    h, s = mix_hue_sat(h, s, mt, p["canopy"][0], p["canopy"][1], hue_w=0.95, sat_w=0.65)
    h, s = mix_hue_sat(h, s, mp, p["path"][0], p["path"][1], hue_w=0.75, sat_w=0.45)
    h, s = mix_hue_sat(h, s, mg, p["grass"][0], p["grass"][1], hue_w=0.8, sat_w=0.5)
    h, s = mix_hue_sat(h, s, mr, p["rock"][0], p["rock"][1], hue_w=0.7, sat_w=0.4)
    roof = mb * np.clip((c["bright"] - 115.0) / 70.0, 0, 1)
    h = h * (1.0 - 0.45 * roof) + 0.04 * (0.45 * roof)
    s = np.clip(s + 0.14 * roof, 0, 1)
    body = mb * np.clip((130.0 - c["bright"]) / 70.0, 0, 1)
    h = h * (1.0 - 0.35 * body) + 0.075 * (0.35 * body)
    s = np.clip(s * (1.0 - 0.2 * body) + 0.22 * body, 0, 1)
    out = hsv_to_rgb(h, s, v)
    warm_mul = np.array([1.18, 1.02, 0.82], dtype=np.float32)
    warm_add = np.array([14.0, 6.0, -4.0], dtype=np.float32)
    out = out * (1.0 - 0.55 * mb[..., None]) + np.clip(out * warm_mul + warm_add, 0, 255) * (
        0.55 * mb[..., None]
    )
    grain = ground_grain(W, H, seed=400)
    if grain is not None:
        gmask = (mp * 0.28 + mg * 0.16)[..., None]
        gL = grain.mean(2) + 1e-5
        oL = out.mean(2) + 1e-5
        grain2 = grain * (oL / gL)[..., None]
        out = out * (1.0 - gmask) + grain2 * gmask
    out[..., 0] = np.clip(out[..., 0] * 1.04 + 3, 0, 255)
    out[..., 1] = np.clip(out[..., 1] * 1.02 + 1, 0, 255)
    out[..., 2] = np.clip(out[..., 2] * 0.94, 0, 255)
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    return ImageEnhance.Contrast(ImageEnhance.Color(img).enhance(1.05)).enhance(1.06)


def blend_stamp(
    ba: np.ndarray,
    stamp_img: Image.Image,
    xy,
    size,
    core=0.38,
    soft=0.92,
    built_keep=1.0,
    green_keep=0.22,
    path_keep=0.55,
    tw=None,
    th=None,
):
    """Giữ mái/đá/tượng; cỏ của stamp phai vào rừng nền — hết khung vuông."""
    H, W = ba.shape[:2]
    tw = int(tw or size)
    th = int(th or size)
    s = stamp_img.resize((tw, th), Image.LANCZOS).convert("RGB")
    sa = np.asarray(s, dtype=np.float32)
    bx, by = xy
    x0, y0 = max(0, bx), max(0, by)
    x1, y1 = min(W, bx + tw), min(H, by + th)
    sx0, sy0 = x0 - bx, y0 - by
    sw, sh = x1 - x0, y1 - y0
    patch = sa[sy0 : sy0 + sh, sx0 : sx0 + sw].copy()
    dest = ba[y0:y1, x0:x1]
    yy, xx = np.ogrid[:sh, :sw]
    rad = np.sqrt(
        ((xx - (tw / 2 - sx0)) / (tw / 2)) ** 2 + ((yy - (th / 2 - sy0)) / (th / 2)) ** 2
    )
    a = np.clip((soft - rad) / max(1e-5, soft - core), 0, 1)
    a = a * a * (3 - 2 * a)
    r, g, b = patch[..., 0], patch[..., 1], patch[..., 2]
    greenish = (g > r + 6) & (g > b + 4) & (g > 55)
    pathish = (np.abs(r - g) < 35) & (r > 70) & (g > 55) & (b > 35) & ~greenish
    roof = (r > g + 10) & (r > b + 6) & (r > 85)
    stone = (np.abs(r.astype(np.float32) - g) < 28) & (r > 70) & (r < 175) & (b > 55) & ~greenish
    wood = (r > g + 5) & (g > b + 5) & (r > 60) & (r < 160) & ~greenish
    built = roof | stone | wood | (~greenish & ((r > g + 8) | (r + g + b < 140)))
    keep = np.where(built, built_keep, np.where(pathish, path_keep, green_keep))
    a = a * keep
    ring = (a > 0.05) & (a < 0.55)
    if ring.any():
        sL = float(patch[ring].mean())
        dL = float(dest[ring].mean())
        if sL > 1:
            patch = np.clip(patch * (0.65 + 0.35 * (dL / sL)), 0, 255)
    a3 = a[..., None]
    ba[y0:y1, x0:x1] = patch * a3 + dest * (1.0 - a3)
    return ba


def main() -> None:
    base = build_base()
    W, H = base.size
    cx, cy = W // 2, H // 2
    ba = np.asarray(base, dtype=np.float32)

    temple = Image.open(TILES / "tran-pho-minh-map.jpg")
    house = Image.open(TILES / "prop-tran-house.jpg")
    stele = Image.open(TILES / "prop-tran-stele.jpg")
    # Crop điện chính + sư tử (bỏ ao/rừng thừa) — stamp rõ như chùa thật
    hall = temple.crop((260, 160, 800, 740))

    # Nền cảnh chùa rộng (ao + đường) rồi đè điện chính cứng hơn
    main_sz = 2200
    ba = blend_stamp(
        ba,
        temple,
        (cx - main_sz // 2, cy - main_sz // 2 - 80),
        main_sz,
        core=0.42,
        soft=0.94,
        built_keep=1.0,
        green_keep=0.18,
        path_keep=0.62,
    )
    hall_w, hall_h = 1180, 1280
    ba = blend_stamp(
        ba,
        hall,
        (cx - hall_w // 2, cy - hall_h // 2 - 220),
        hall_w,
        core=0.48,
        soft=0.96,
        built_keep=1.0,
        green_keep=0.12,
        path_keep=0.7,
        tw=hall_w,
        th=hall_h,
    )
    ba = blend_stamp(
        ba, house, (cx - 1180, cy + 180), 640, core=0.4, soft=0.88, built_keep=1.0, green_keep=0.15
    )
    ba = blend_stamp(
        ba,
        house.transpose(Image.FLIP_LEFT_RIGHT),
        (cx + 560, cy - 40),
        600,
        core=0.4,
        soft=0.88,
        built_keep=1.0,
        green_keep=0.15,
    )
    ba = blend_stamp(
        ba, stele, (cx - 280, cy + 820), 340, core=0.32, soft=0.82, built_keep=1.0, green_keep=0.12
    )
    ba = blend_stamp(
        ba, stele, (cx + 40, cy + 860), 280, core=0.32, soft=0.82, built_keep=1.0, green_keep=0.12
    )

    img = Image.fromarray(np.clip(ba, 0, 255).astype(np.uint8), "RGB")
    img = ImageEnhance.Contrast(ImageEnhance.Color(img).enhance(1.05)).enhance(1.06)
    out_path = Z / "400.jpg"
    img.save(out_path, quality=90, optimize=True)
    print(f"saved {out_path} {out_path.stat().st_size // 1024}KB")

    jmo = (ROOT / "jmo.js").read_text(encoding="utf-8")
    meta2, _, _ = extract_zone(jmo, "2")
    gw, gh = meta2["gw"], meta2["gh"]
    blocked = decode_obs(meta2)
    mark_rect(blocked, cx - 420, cy - 560, 840, 620, True, gw, gh)
    mark_rect(blocked, cx - 1180 + 80, cy + 180 + 80, 460, 360, True, gw, gh)
    mark_rect(blocked, cx + 560 + 60, cy - 40 + 80, 440, 340, True, gw, gh)
    carve_path(blocked, [(cx, cy + 1100), (cx, cy + 280)], 90, gw, gh)
    carve_path(blocked, [(cx - 280, cy + 600), (cx, cy + 280), (cx + 280, cy + 600)], 70, gw, gh)

    meta = dict(meta2)
    meta["obs"] = encode_obs(blocked)
    meta["blocked"] = int(sum(blocked))

    jmo2_path = ROOT / "jmo2.js"
    jmo2 = jmo2_path.read_text(encoding="utf-8")
    _, start, end = extract_zone(jmo2, "400")
    key_start = jmo2.rfind('"400"', 0, start)
    new_obj = json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
    jmo2_path.write_text(jmo2[:key_start] + '"400":' + new_obj + jmo2[end:], encoding="utf-8")
    print(f"jmo2 400 obs blocked={meta['blocked']}")

    ver = bump_cache()
    z2 = (ROOT / "zones2.js").read_text(encoding="utf-8")
    (ROOT / "zones2.js").write_text(
        re.sub(r"img/z/400\.jpg(?:\?v=\d+)?", f"img/z/400.jpg?v={ver}", z2), encoding="utf-8"
    )
    print(f"Done v{ver}")


if __name__ == "__main__":
    main()
