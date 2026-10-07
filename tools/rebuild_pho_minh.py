#!/usr/bin/env python3
"""Phổ Minh Tự (400) — làm lại từ đầu.

Map gốc = img/z/_tran_tiles/tran-pho-minh-map.jpg (điện, ao, sư tử, đường, tre).
- Phóng full-frame 3584 (không thu nhỏ thành đảo, không viền rừng lặp).
- Reskin HSV tông Trần nhẹ trên đúng pixel bố cục.
- Collision riêng: trong map mở, chỉ chặn điện/sư tử/ao — đường/cỏ/khúc gỗ đi được.
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
    patch_jmo2_assign_zone,
    rgb_to_hsv,
)

CW, CH = 32, 16
SIZE = 3584
ART = Path("/opt/cursor/artifacts/pho-minh-reset")


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
    p = TILES / "tran-pho-minh-map.jpg"
    if not p.exists():
        raise SystemExit(f"missing layout orig {p}")
    return Image.open(p).convert("RGB")


def build_canvas_from_layout(src: Image.Image, size: int = SIZE) -> Image.Image:
    """Phóng bố cục gốc full map — mép feather, không đảo nhỏ / không pad rừng."""
    base = src.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.0))
    ba = np.asarray(base, dtype=np.float32)

    core_sz = 3300
    core = src.resize((core_sz, core_sz), Image.LANCZOS)
    ca = np.asarray(core, dtype=np.float32)
    ox = (size - core_sz) // 2
    oy = (size - core_sz) // 2 - 40

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
    print(f"full-frame core {core_sz} at ({ox},{oy})")
    return Image.fromarray(np.clip(ba, 0, 255).astype(np.uint8), "RGB")


def roof_mask(og: np.ndarray) -> np.ndarray:
    r, g, b = og[..., 0], og[..., 1], og[..., 2]
    bright = (r + g + b) / 3.0
    return (
        (r > g + 8)
        & (r > b + 12)
        & (r > 85)
        & (g < 160)
        & (bright > 60)
        & (bright < 200)
    ).astype(np.float32)


def water_mask(og: np.ndarray) -> np.ndarray:
    r, g, b = og[..., 0], og[..., 1], og[..., 2]
    bright = (r + g + b) / 3.0
    return (
        (b > r + 10) & (b >= g - 2) & (bright < 100) & (bright > 20) & (g < 140)
    ).astype(np.float32)


def reskin_scenery(img: Image.Image, bias: str = "warm") -> Image.Image:
    """Reskin nhẹ trên đúng bố cục gốc — không stamp, không lát tile."""
    W, H = img.size
    og = np.asarray(img, dtype=np.float32)
    c = classify(og)
    p = bias_params(bias)
    h, s, v = rgb_to_hsv(og)

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
            m_tree * 1.15,
            m_path * 1.15,
            m_grass * 1.0,
            m_rock * 1.05,
        ],
        axis=-1,
    )
    wgt = stack / (stack.sum(-1, keepdims=True) + 1e-5)
    mrf, mb, mt, mp, mg, mr = [wgt[..., i] for i in range(6)]

    h, s = mix_hue_sat(h, s, mb * (1.0 - mrf), p["built"][0], p["built"][1], hue_w=0.55, sat_w=0.35)
    h, s = mix_hue_sat(h, s, mt, p["canopy"][0], p["canopy"][1], hue_w=0.55, sat_w=0.4)
    h, s = mix_hue_sat(h, s, mp, p["path"][0], p["path"][1], hue_w=0.4, sat_w=0.28)
    h, s = mix_hue_sat(h, s, mg, p["grass"][0], p["grass"][1], hue_w=0.45, sat_w=0.32)
    h, s = mix_hue_sat(h, s, mr, p["rock"][0], p["rock"][1], hue_w=0.4, sat_w=0.25)

    h = h * (1.0 - 0.85 * mrf) + 0.04 * (0.85 * mrf)
    s = np.clip(s * (1.0 - 0.35 * mrf) + 0.48 * mrf, 0, 1)
    v = np.clip(v * (1.0 + 0.04 * mrf), 0, 1)

    body = mb * (1.0 - mrf) * np.clip((130.0 - c["bright"]) / 70.0, 0, 1)
    h = h * (1.0 - 0.28 * body) + 0.07 * (0.28 * body)
    s = np.clip(s * (1.0 - 0.15 * body) + 0.18 * body, 0, 1)

    mw = blur_mask(water_mask(og), 1.0) * (1.0 - mrf)
    h = h * (1.0 - 0.45 * mw) + 0.56 * (0.45 * mw)
    s = np.clip(s * (1.0 - 0.2 * mw) + 0.32 * mw, 0, 1)

    out = hsv_to_rgb(h, s, v)
    warm_mul = np.array([1.10, 1.02, 0.90], dtype=np.float32)
    warm_add = np.array([6.0, 2.0, -2.0], dtype=np.float32)
    warm_m = (mb * 0.30 + mrf * 0.50)[..., None]
    out = out * (1.0 - warm_m) + np.clip(out * warm_mul + warm_add, 0, 255) * warm_m

    grain = ground_grain(W, H, seed=400)
    if grain is not None:
        gmask = ((mp * 0.20 + mg * 0.10) * (1.0 - mrf))[..., None]
        gL = grain.mean(2) + 1e-5
        oL = out.mean(2) + 1e-5
        grain2 = grain * (oL / gL)[..., None]
        out = out * (1.0 - gmask) + grain2 * gmask

    out[..., 0] = np.clip(out[..., 0] * 1.015 + 1, 0, 255)
    out[..., 1] = np.clip(out[..., 1] * 1.01, 0, 255)
    out[..., 2] = np.clip(out[..., 2] * 0.975, 0, 255)

    img2 = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    img2 = ImageEnhance.Contrast(img2).enhance(1.04)
    img2 = ImageEnhance.Color(img2).enhance(1.02)
    img2 = ImageEnhance.Sharpness(img2).enhance(1.12)
    return img2


def obs_for_layout(meta2: dict, size: int = SIZE) -> dict:
    """Collision Phổ Minh sạch: mở gần hết, chỉ chặn điện/sư tử/ao."""
    gw, gh = meta2["gw"], meta2["gh"]
    blocked = [0] * (gw * gh)  # không kế thừa obs Yên Tử
    cx, cy = size // 2, size // 2

    # mép map mỏng — tránh rơi ra ngoài khung
    for gy in range(gh):
        for gx in range(gw):
            if gx < 2 or gy < 2 or gx >= gw - 2 or gy >= gh - 2:
                blocked[gy * gw + gx] = 1

    mark_rect(blocked, cx - 260, cy - 500, 520, 380, True, gw, gh)  # điện
    mark_rect(blocked, cx - 300, cy - 150, 170, 120, True, gw, gh)  # sư tử L
    mark_rect(blocked, cx + 90, cy - 130, 170, 120, True, gw, gh)  # sư tử R
    mark_rect(blocked, cx - 700, cy - 60, 260, 230, True, gw, gh)  # ao

    # đường rộng — gồm nhánh qua khúc gỗ
    carve_path(blocked, [(cx - 200, cy + 1100), (cx, cy + 220), (cx, cy - 40)], 110, gw, gh)
    carve_path(blocked, [(cx - 600, cy + 400), (cx - 220, cy + 200), (cx, cy + 80)], 95, gw, gh)
    carve_path(blocked, [(cx + 500, cy + 500), (cx + 140, cy + 160)], 85, gw, gh)
    carve_path(blocked, [(cx - 480, cy + 60), (cx - 200, cy + 40), (cx, cy + 60)], 95, gw, gh)
    carve_path(blocked, [(cx - 150, cy + 350), (cx + 180, cy + 180)], 80, gw, gh)
    carve_path(
        blocked,
        [(cx - 220, cy - 60), (cx - 420, cy - 220), (cx - 80, cy - 380), (cx + 220, cy - 180), (cx + 60, cy - 40)],
        75,
        gw,
        gh,
    )

    meta = dict(meta2)
    meta["w"] = size
    meta["h"] = size
    meta["obs"] = encode_obs(blocked)
    meta["blocked"] = int(sum(blocked))
    return meta


def rebuild() -> Image.Image:
    src = load_layout_orig()
    print(f"layout orig {src.size} from {TILES / 'tran-pho-minh-map.jpg'}")
    canvas = build_canvas_from_layout(src, SIZE)
    img = reskin_scenery(canvas, bias="warm")
    return img


def save_previews(img: Image.Image, before: Image.Image | None = None) -> None:
    ART.mkdir(parents=True, exist_ok=True)
    img.resize((800, 800), Image.LANCZOS).save(ART / "pho-minh-full.jpg", quality=88)
    cx = cy = SIZE // 2
    img.crop((cx - 420, cy - 620, cx + 420, cy + 80)).save(ART / "pho-minh-temple.jpg", quality=92)
    img.crop((cx - 700, cy - 100, cx - 50, cy + 450)).save(ART / "pho-minh-logs-path.jpg", quality=90)
    if before is not None:
        side = Image.new("RGB", (1600, 820), (18, 16, 14))
        side.paste(before.resize((800, 800), Image.LANCZOS), (0, 20))
        side.paste(img.resize((800, 800), Image.LANCZOS), (800, 20))
        from PIL import ImageDraw

        d = ImageDraw.Draw(side)
        d.text((20, 2), "truoc (ban hong)", fill=(200, 140, 140))
        d.text((820, 2), "lam lai tu dau — map goc", fill=(140, 220, 160))
        side.save(ART / "pho-minh-before-after.jpg", quality=90)


def main() -> None:
    apply = "--preview" not in sys.argv
    before = Image.open(Z / "400.jpg").convert("RGB") if (Z / "400.jpg").exists() else None
    img = rebuild()

    if apply:
        out = Z / "400.jpg"
        img.save(out, quality=90, optimize=True)
        print(f"saved {out} {out.stat().st_size // 1024}KB")
    else:
        ART.mkdir(parents=True, exist_ok=True)
        img.save(ART / "400-preview.jpg", quality=90)
        print("preview only")

    save_previews(img, before)

    if apply:
        jmo = (ROOT / "jmo.js").read_text(encoding="utf-8")
        meta2, _, _ = extract_zone(jmo, "2")
        meta = obs_for_layout(meta2, SIZE)
        patch_jmo2_assign_zone("400", meta)
        print(f"jmo2 400 blocked={meta['blocked']} free={meta['gw']*meta['gh']-meta['blocked']}")

        ver = bump_cache()
        z2 = (ROOT / "zones2.js").read_text(encoding="utf-8")
        z2 = re.sub(r"(img/z/\w+\.jpg)\?v=\d+", rf"\1?v={ver}", z2)
        (ROOT / "zones2.js").write_text(z2, encoding="utf-8")
        print(f"Done v{ver} — Phổ Minh map gốc full-frame + reskin nhẹ")


if __name__ == "__main__":
    main()
