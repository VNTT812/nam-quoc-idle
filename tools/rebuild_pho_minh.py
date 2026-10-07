#!/usr/bin/env python3
"""Phổ Minh Tự (400): khôi phục bố cục map gốc rồi dựng lại bối cảnh.

- Layout gốc = tran-pho-minh-map.jpg (điện, ao sen, sư tử, đường, tre) — không lấy Yên Tử.
- Không lát tile AI (tránh ghép mảnh lặp chùa).
- Reskin HSV tông Trần ấm trên đúng pixel bố cục gốc.
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
    """Map gốc Phổ Minh — asset bố cục điện/ao/đường (không Yên Tử)."""
    p = TILES / "tran-pho-minh-map.jpg"
    if not p.exists():
        raise SystemExit(f"missing layout orig {p}")
    return Image.open(p).convert("RGB")


def build_canvas_from_layout(src: Image.Image, size: int = SIZE) -> Image.Image:
    """Phóng bố cục gốc lên full map, mép liền (không lát lặp cả cảnh chùa)."""
    # Nền: phóng cả cảnh + blur nhẹ — cùng DNA bố cục, mép không đường cắt
    base = src.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
    ba = np.asarray(base, dtype=np.float32)

    # Lõi nét: cùng bố cục, chiếm phần lớn khung (giữ vị trí điện/ao/đường)
    core_sz = 3300
    core = src.resize((core_sz, core_sz), Image.LANCZOS)
    ca = np.asarray(core, dtype=np.float32)
    ox = (size - core_sz) // 2
    oy = (size - core_sz) // 2 - 40  # hơi lệch lên như bố cục gốc (điện lệch trên)

    # Feather mép lõi vào nền phóng — hết khung cứng, vẫn đúng bố cục
    yy, xx = np.ogrid[:core_sz, :core_sz]
    margin = 160.0
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


def reskin_scenery(img: Image.Image, bias: str = "warm") -> Image.Image:
    """Dựng lại bối cảnh Trần trên đúng bố cục — giữ mái ngói đỏ/cam gốc."""
    W, H = img.size
    og = np.asarray(img, dtype=np.float32)
    c = classify(og)
    p = bias_params(bias)
    h, s, v = rgb_to_hsv(og)
    r, g, b = og[..., 0], og[..., 1], og[..., 2]

    # Mái ngói đỏ/cam gốc — khóa trước khi canopy (lá vàng) nuốt mất
    roof_raw = (
        (r > g + 6)
        & (r > b + 8)
        & (r > 75)
        & (g < 175)
        & (c["bright"] > 55)
        & (c["bright"] < 210)
    ).astype(np.float32)
    m_roof = blur_mask(roof_raw, 0.7)

    m_path = blur_mask(c["path"], 0.9)
    m_grass = blur_mask(c["grass"], 1.0)
    m_tree = blur_mask(c["canopy"] * (1.0 - roof_raw), 0.9)  # đừng coi mái là tán
    m_rock = blur_mask(c["rock"], 0.8)
    m_built = blur_mask(np.clip(c["built"] + roof_raw, 0, 1), 1.0)

    stack = np.stack(
        [
            m_roof * 2.2,
            m_built * 1.35,
            m_tree * 1.15,
            m_path * 1.15,
            m_grass * 1.0,
            m_rock * 1.05,
        ],
        axis=-1,
    )
    w = stack / (stack.sum(-1, keepdims=True) + 1e-5)
    mrf, mb, mt, mp, mg, mr = [w[..., i] for i in range(6)]

    # Remap nhẹ — giữ palette bố cục gốc, chỉ chỉnh bối cảnh
    h, s = mix_hue_sat(h, s, mb * (1.0 - mrf), p["built"][0], p["built"][1], hue_w=0.55, sat_w=0.35)
    h, s = mix_hue_sat(h, s, mt, p["canopy"][0], p["canopy"][1], hue_w=0.55, sat_w=0.4)
    h, s = mix_hue_sat(h, s, mp, p["path"][0], p["path"][1], hue_w=0.4, sat_w=0.28)
    h, s = mix_hue_sat(h, s, mg, p["grass"][0], p["grass"][1], hue_w=0.45, sat_w=0.32)
    h, s = mix_hue_sat(h, s, mr, p["rock"][0], p["rock"][1], hue_w=0.4, sat_w=0.25)

    # Khóa hue mái về ngói đỏ-cam (không cho thành xanh)
    h = h * (1.0 - 0.85 * mrf) + 0.04 * (0.85 * mrf)
    s = np.clip(s * (1.0 - 0.35 * mrf) + 0.48 * mrf, 0, 1)
    v = np.clip(v * (1.0 + 0.04 * mrf), 0, 1)

    body = mb * (1.0 - mrf) * np.clip((130.0 - c["bright"]) / 70.0, 0, 1)
    h = h * (1.0 - 0.28 * body) + 0.07 * (0.28 * body)
    s = np.clip(s * (1.0 - 0.15 * body) + 0.18 * body, 0, 1)

    # Ao sen: xanh nước nhẹ, không đè cỏ
    water = (
        (b > r + 10) & (b >= g - 2) & (c["bright"] < 100) & (c["bright"] > 20) & (g < 140)
    ).astype(np.float32)
    mw = blur_mask(water, 1.0) * (1.0 - mrf)
    h = h * (1.0 - 0.45 * mw) + 0.56 * (0.45 * mw)
    s = np.clip(s * (1.0 - 0.2 * mw) + 0.32 * mw, 0, 1)

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
    out[..., 1] = np.clip(out[..., 1] * 1.01, 0, 255)
    out[..., 2] = np.clip(out[..., 2] * 0.97, 0, 255)

    img2 = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    img2 = ImageEnhance.Contrast(img2).enhance(1.05)
    img2 = ImageEnhance.Color(img2).enhance(1.03)
    img2 = ImageEnhance.Sharpness(img2).enhance(1.15)
    return img2


def obs_for_layout(meta2: dict, size: int = SIZE) -> dict:
    """Vật cản khớp bố cục Phổ Minh: chặn điện/sư tử, mở đường vào chùa."""
    gw, gh = meta2["gw"], meta2["gh"]
    blocked = decode_obs(meta2)
    cx, cy = size // 2, size // 2
    # Điện chính + nền đá (lệch trên như layout gốc)
    mark_rect(blocked, cx - 280, cy - 520, 560, 420, True, gw, gh)
    # Sư tử / bậc thềm
    mark_rect(blocked, cx - 320, cy - 160, 200, 140, True, gw, gh)
    mark_rect(blocked, cx + 80, cy - 140, 220, 140, True, gw, gh)
    # Ao sen (trái dưới điện)
    mark_rect(blocked, cx - 720, cy - 80, 280, 260, True, gw, gh)
    # Đường chính từ dưới lên thềm
    carve_path(blocked, [(cx - 200, cy + 1100), (cx, cy + 200), (cx, cy - 80)], 95, gw, gh)
    carve_path(blocked, [(cx - 600, cy + 400), (cx - 200, cy + 200), (cx, cy + 80)], 70, gw, gh)
    carve_path(blocked, [(cx + 500, cy + 500), (cx + 120, cy + 160)], 65, gw, gh)
    meta = dict(meta2)
    meta["obs"] = encode_obs(blocked)
    meta["blocked"] = int(sum(blocked))
    return meta


def main() -> None:
    src = load_layout_orig()
    print(f"layout orig {src.size} from {TILES / 'tran-pho-minh-map.jpg'}")

    canvas = build_canvas_from_layout(src, SIZE)
    img = reskin_scenery(canvas, bias="warm")

    out_path = Z / "400.jpg"
    img.save(out_path, quality=90, optimize=True)
    print(f"saved {out_path} {out_path.stat().st_size // 1024}KB")

    # Preview artifacts
    art = Path("/opt/cursor/artifacts")
    art.mkdir(parents=True, exist_ok=True)
    img.resize((800, 800), Image.LANCZOS).save(art / "pho-minh-layout-full.jpg", quality=88)
    cx = cy = SIZE // 2
    img.crop((cx - 420, cy - 620, cx + 420, cy + 80)).save(
        art / "pho-minh-layout-temple.jpg", quality=92
    )

    jmo = (ROOT / "jmo.js").read_text(encoding="utf-8")
    meta2, _, _ = extract_zone(jmo, "2")
    meta = obs_for_layout(meta2, SIZE)

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
    print(f"Done v{ver} — bố cục Phổ Minh gốc + bối cảnh Trần")


if __name__ == "__main__":
    main()
