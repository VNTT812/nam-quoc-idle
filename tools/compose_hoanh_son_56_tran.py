#!/usr/bin/env python3
"""Ghép compound Trần (AI) lên map gốc zone 56 — giữ rừng/đường ngoài."""
from __future__ import annotations
import argparse, subprocess
from io import BytesIO
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
REVIEW = ROOT / "assets/pack/map-style-review/56-hoanh-son"
COMP = REVIEW / "compounds"
Z = ROOT / "img" / "z"
BOX = (1750, 350, 3450, 2050)
ORIG_REV = "5f51470"


def load_orig():
    data = subprocess.check_output(["git", "show", f"{ORIG_REV}:img/z/56.jpg"])
    return Image.open(BytesIO(data)).convert("RGB")


def feather(size, margin=110):
    w, h = size
    yy, xx = np.ogrid[:h, :w]
    edge = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy)).astype(np.float32)
    m = np.clip(edge / margin, 0, 1)
    return m * m * (3 - 2 * m)


def compose(compound: Image.Image, strength: float = 0.92) -> Image.Image:
    orig = load_orig()
    x0, y0, x1, y1 = BOX
    bw, bh = x1 - x0, y1 - y0
    comp = compound.resize((bw, bh), Image.LANCZOS)
    ba = np.asarray(orig, dtype=np.float32)
    ba[..., 0] = np.clip(ba[..., 0] * 1.02 + 2, 0, 255)
    ba[..., 2] = np.clip(ba[..., 2] * 0.97, 0, 255)
    ca = np.asarray(comp, dtype=np.float32)
    oL = ba[y0:y1, x0:x1].mean() + 1e-5
    cL = ca.mean() + 1e-5
    ca = ca * (0.55 * oL / cL + 0.45)
    alpha = feather((bw, bh))[..., None] * strength
    cr, cg, cb = ca[..., 0], ca[..., 1], ca[..., 2]
    greenish = (cg > cr + 10) & (cg > cb + 8)
    alpha = alpha * (1.0 - greenish.astype(np.float32) * 0.35)[..., None]
    patch = ba[y0:y1, x0:x1]
    ba[y0:y1, x0:x1] = patch * (1 - alpha) + ca * alpha
    img = Image.fromarray(np.clip(ba, 0, 255).astype(np.uint8), "RGB")
    return ImageEnhance.Contrast(ImageEnhance.Color(img).enhance(1.04)).enhance(1.03)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--which", choices=["A", "B", "C", "AB"], default="A")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    if args.which == "AB":
        a = Image.open(COMP / "A.jpg").convert("RGB")
        b = Image.open(COMP / "B.jpg").convert("RGB")
        compound = Image.blend(a.resize(b.size, Image.LANCZOS), b, 0.45)
        slug = "18-tran-arch-AB"
    else:
        compound = Image.open(COMP / f"{args.which}.jpg").convert("RGB")
        slug = {"A": "15-tran-arch-A", "B": "16-tran-arch-B", "C": "17-tran-arch-C"}[args.which]
    img = compose(compound)
    out = REVIEW / f"{slug}.jpg"
    img.save(out, quality=90, optimize=True)
    print("wrote", out)
    if args.apply:
        dest = Z / "56.jpg"
        dest.write_bytes(out.read_bytes())
        print("applied ->", dest)


if __name__ == "__main__":
    main()
