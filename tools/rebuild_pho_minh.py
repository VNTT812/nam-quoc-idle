#!/usr/bin/env python3
"""Phổ Minh Tự (400) — lấy đúng map gốc đẹp, phóng vừa + collision.

Map gốc = img/z/_tran_tiles/tran-pho-minh-map.jpg (1024, điện/ao/sư tử/đường/tre).
- World 2048 (= ×2) — tránh phóng 3584 làm vỡ pixel.
- Giữ màu/chi tiết, KHÔNG reskin HSV.
- Collision riêng: mở đường/cỏ/khúc gỗ; chỉ chặn điện/sư tử/ao.
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
# Layout gốc 1024 — ×2 = 2048 (sắc nét). ×3.5 lên 3584 làm vỡ pixel.
SIZE = 2048
REF_SIZE = 3584  # tọa độ obs cũ theo khung 3584
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
    """Phóng map gốc theo từng bước ×2 — sắc hơn phóng thẳng lên 3584."""
    out = src.convert("RGB")
    while max(out.size) * 2 <= size:
        nxt = (out.size[0] * 2, out.size[1] * 2)
        out = out.resize(nxt, Image.Resampling.LANCZOS)
        out = ImageEnhance.Sharpness(out).enhance(1.08)
    if out.size != (size, size):
        out = out.resize((size, size), Image.Resampling.LANCZOS)
    print(f"stepped scale {src.size} -> {out.size}")
    return out


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
    gw, gh = size // CW, size // CH
    blocked = [0] * (gw * gh)  # không kế thừa obs Yên Tử
    cx, cy = size // 2, size // 2
    k = size / float(REF_SIZE)

    def S(v: float) -> float:
        return v * k

    # mép map mỏng — tránh rơi ra ngoài khung
    for gy in range(gh):
        for gx in range(gw):
            if gx < 2 or gy < 2 or gx >= gw - 2 or gy >= gh - 2:
                blocked[gy * gw + gx] = 1

    mark_rect(blocked, cx - S(260), cy - S(500), S(520), S(380), True, gw, gh)  # điện
    mark_rect(blocked, cx - S(300), cy - S(150), S(170), S(120), True, gw, gh)  # sư tử L
    mark_rect(blocked, cx + S(90), cy - S(130), S(170), S(120), True, gw, gh)  # sư tử R
    mark_rect(blocked, cx - S(700), cy - S(60), S(260), S(230), True, gw, gh)  # ao

    # đường rộng — gồm nhánh qua khúc gỗ
    carve_path(blocked, [(cx - S(200), cy + S(1100)), (cx, cy + S(220)), (cx, cy - S(40))], S(110), gw, gh)
    carve_path(blocked, [(cx - S(600), cy + S(400)), (cx - S(220), cy + S(200)), (cx, cy + S(80))], S(95), gw, gh)
    carve_path(blocked, [(cx + S(500), cy + S(500)), (cx + S(140), cy + S(160))], S(85), gw, gh)
    carve_path(blocked, [(cx - S(480), cy + S(60)), (cx - S(200), cy + S(40)), (cx, cy + S(60))], S(95), gw, gh)
    carve_path(blocked, [(cx - S(150), cy + S(350)), (cx + S(180), cy + S(180))], S(80), gw, gh)
    carve_path(
        blocked,
        [
            (cx - S(220), cy - S(60)),
            (cx - S(420), cy - S(220)),
            (cx - S(80), cy - S(380)),
            (cx + S(220), cy - S(180)),
            (cx + S(60), cy - S(40)),
        ],
        S(75),
        gw,
        gh,
    )

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


def polish_only(img: Image.Image) -> Image.Image:
    """Nét nhẹ sau ×2 — không đổi hue/palette map gốc."""
    img = ImageEnhance.Sharpness(img).enhance(1.12)
    img = ImageEnhance.Contrast(img).enhance(1.03)
    return img


def rebuild() -> Image.Image:
    src = load_layout_orig()
    print(f"layout orig {src.size} from {TILES / 'tran-pho-minh-map.jpg'}")
    # đúng map user chỉ — phóng full, không reskin
    canvas = build_canvas_from_layout(src, SIZE)
    if "--reskin" in sys.argv:
        print("optional --reskin enabled")
        return reskin_scenery(canvas, bias="warm")
    img = polish_only(canvas)
    print("faithful layout (no reskin)")
    return img


def save_previews(img: Image.Image, before: Image.Image | None = None) -> None:
    ART.mkdir(parents=True, exist_ok=True)
    img.resize((800, 800), Image.Resampling.LANCZOS).save(ART / "pho-minh-full.jpg", quality=88)
    # zoom 1:1 crop — chứng minh hết vỡ pixel
    cx = cy = SIZE // 2
    z = 220
    img.crop((cx - z, cy - z - 80, cx + z, cy + z - 80)).save(ART / "pho-minh-temple-1x.jpg", quality=95)
    k = SIZE / float(REF_SIZE)
    img.crop(
        (int(cx - 420 * k), int(cy - 620 * k), int(cx + 420 * k), int(cy + 80 * k))
    ).save(ART / "pho-minh-temple.jpg", quality=92)
    img.crop(
        (int(cx - 700 * k), int(cy - 100 * k), int(cx - 50 * k), int(cy + 450 * k))
    ).save(ART / "pho-minh-logs-path.jpg", quality=90)
    # so 3584 blur vs 2048 sharp (cùng vùng điện)
    layout = load_layout_orig()
    native = layout.crop((412, 300, 612, 500)).resize((400, 400), Image.Resampling.NEAREST)
    sharp = img.crop((int(412 * 2), int(300 * 2), int(612 * 2), int(500 * 2))).resize(
        (400, 400), Image.Resampling.NEAREST
    )
    if before is not None and before.size[0] >= 3000:
        mush = before.crop((int(412 * 3.5), int(300 * 3.5), int(612 * 3.5), int(500 * 3.5))).resize(
            (400, 400), Image.Resampling.NEAREST
        )
    else:
        mush = layout.resize((3584, 3584), Image.Resampling.LANCZOS).crop(
            (int(412 * 3.5), int(300 * 3.5), int(612 * 3.5), int(500 * 3.5))
        ).resize((400, 400), Image.Resampling.NEAREST)
    cmp = Image.new("RGB", (1240, 440), (18, 16, 14))
    from PIL import ImageDraw

    d = ImageDraw.Draw(cmp)
    for i, (im, lab) in enumerate(
        [(native, "layout 1024"), (mush, "cu 3584 (vo pixel)"), (sharp, f"moi {SIZE} (x2)")]
    ):
        cmp.paste(im, (20 + i * 410, 30))
        d.text((28 + i * 410, 8), lab, fill=(220, 210, 180))
    cmp.save(ART / "pho-minh-pixel-fix.jpg", quality=92)
    if before is not None:
        side = Image.new("RGB", (1600, 820), (18, 16, 14))
        side.paste(before.resize((800, 800), Image.Resampling.LANCZOS), (0, 20))
        side.paste(img.resize((800, 800), Image.Resampling.LANCZOS), (800, 20))
        d2 = ImageDraw.Draw(side)
        d2.text((20, 2), f"truoc {before.size[0]}", fill=(200, 140, 140))
        d2.text((820, 2), f"sau {SIZE} (het vo pixel)", fill=(140, 220, 160))
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
        print(f"Done v{ver} — Phổ Minh {SIZE}px (×2, hết vỡ pixel), không reskin")


if __name__ == "__main__":
    main()
