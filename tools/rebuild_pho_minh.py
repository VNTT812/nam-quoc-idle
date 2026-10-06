#!/usr/bin/env python3
"""Dựng lại Phổ Minh Tự (400) liền mạch từ layout Yên Tử + reskin tông ấm Trần.

Map 400 ban đầu lát tile AI (compose_tran_style_maps) nên bị seam/ghép mảnh.
"""
from __future__ import annotations

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


def main() -> None:
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
    img = ImageEnhance.Contrast(img).enhance(1.07)
    img = ImageEnhance.Color(img).enhance(1.05)
    out_path = Z / "400.jpg"
    img.save(out_path, quality=90, optimize=True)
    print(f"saved {out_path} {out_path.stat().st_size // 1024}KB")

    jmo = (ROOT / "jmo.js").read_text(encoding="utf-8")
    meta2, _, _ = extract_zone(jmo, "2")
    jmo2_path = ROOT / "jmo2.js"
    jmo2 = jmo2_path.read_text(encoding="utf-8")
    _, start, end = extract_zone(jmo2, "400")
    key_start = jmo2.rfind('"400"', 0, start)
    new_obj = json.dumps(meta2, ensure_ascii=False, separators=(",", ":"))
    jmo2_path.write_text(jmo2[:key_start] + '"400":' + new_obj + jmo2[end:], encoding="utf-8")
    print("jmo2 400 obs synced from zone 2")

    ver = bump_cache()
    z2 = (ROOT / "zones2.js").read_text(encoding="utf-8")
    z2n = re.sub(r"img/z/400\.jpg(?:\?v=\d+)?", f"img/z/400.jpg?v={ver}", z2)
    (ROOT / "zones2.js").write_text(z2n, encoding="utf-8")
    print(f"Done v{ver}")


if __name__ == "__main__":
    main()
