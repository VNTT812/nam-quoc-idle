#!/usr/bin/env python3
"""Nhạn Đãng (195): giữ bố cục map gốc VLTK, lấp lỗ đen, dựng bối cảnh thời Trần.

- Layout gốc = git 5f51470 img/z/195.jpg (đường/vách đá/cây) — không đổi vật cản.
- Lấp void đen bằng vách đá + tán rừng (không để lỗ trống trên màn hình).
- Reskin HSV tông mist Trần: đường đất, đá xám-nâu, tán xanh rêu, không stamp nhà.
"""
from __future__ import annotations

import re
import subprocess
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from scipy import ndimage

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
    open_tile,
    rgb_to_hsv,
)

STEM = "195"
SIZE = 3584


def load_layout_orig() -> Image.Image:
    data = subprocess.check_output(["git", "show", f"{ORIG_REV}:img/z/{STEM}.jpg"])
    return Image.open(BytesIO(data)).convert("RGB")


def void_mask(arr: np.ndarray) -> np.ndarray:
    """Pixel gần đen / ngoài map VLTK (lỗ kim cương trên màn hình)."""
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    bright = (r + g + b) / 3.0
    return ((bright < 22) & (r < 28) & (g < 32) & (b < 28)) | (
        (r < 12) & (g < 14) & (b < 12)
    )


def fill_voids(img: Image.Image) -> Image.Image:
    """Lấp lỗ đen bằng đá/rừng Trần — không nearest-neighbor (tránh vệt kéo ngang)."""
    arr = np.asarray(img, dtype=np.float32)
    H, W = arr.shape[:2]
    void = void_mask(arr)
    if not void.any():
        return img

    void = ndimage.binary_dilation(void, iterations=2)
    dist = ndimage.distance_transform_edt(void).astype(np.float32)
    depth = np.clip(dist / 56.0, 0, 1)

    # Màu biên trung bình cục bộ (blur vùng hợp lệ) — không copy pixel kéo dài
    valid = (~void).astype(np.float32)[..., None]
    blurred = ndimage.gaussian_filter(arr * valid, sigma=(6, 6, 0))
    wsum = ndimage.gaussian_filter(valid, sigma=(6, 6, 0)) + 1e-5
    edge_col = blurred / wsum
    # fallback palette đá núi Trần nếu biên thiếu
    fallback = np.array([72.0, 78.0, 58.0], dtype=np.float32)
    edge_col = np.where(wsum > 0.05, edge_col, fallback)

    yy, xx = np.mgrid[0:H, 0:W]
    rng = np.random.default_rng(195)

    rock = open_tile("tran-yen-tu-map.jpg", "03_yen_tu.jpg", "tran-con-son-map.jpg")
    bamboo = open_tile("tran-bamboo-trees.jpg", "tran-ground.jpg")

    # Base fill = edge color + rock texture (lệch tile + flip để hết seam)
    filled = edge_col.copy()
    if rock is not None:
        rimg = rock.resize((1400, 1400), Image.LANCZOS)
        variants = [
            np.asarray(rimg, dtype=np.float32),
            np.asarray(rimg.transpose(Image.FLIP_LEFT_RIGHT), dtype=np.float32),
            np.asarray(rimg.transpose(Image.FLIP_TOP_BOTTOM), dtype=np.float32),
        ]
        # offset theo vùng để bớt lặp
        ox = (xx * 3 + yy * 2) % 1400
        oy = (yy * 3 + xx) % 1400
        rpix = variants[0][oy, ox]
        rpix2 = variants[1][(oy + 400) % 1400, (ox + 350) % 1400]
        t = (((xx // 700) + (yy // 700)) % 2).astype(np.float32)[..., None]
        rpix = rpix * (1.0 - t) + rpix2 * t
        # khớp luminance biên để liền mạch
        eL = edge_col.mean(2) + 1e-5
        rL = rpix.mean(2) + 1e-5
        rpix = rpix * (eL / rL)[..., None]
        # tối dần vào vực
        rpix = rpix * (0.62 + 0.28 * (1.0 - depth[..., None]))
        filled = edge_col * (0.25 + 0.20 * (1.0 - depth[..., None])) + rpix * (
            0.75 - 0.15 * (1.0 - depth[..., None])
        )

    if bamboo is not None:
        bimg = bamboo.resize((900, 900), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.0))
        bt = np.asarray(bimg, dtype=np.float32)
        bpix = bt[yy % 900, xx % 900]
        bpix2 = np.asarray(bimg.transpose(Image.FLIP_LEFT_RIGHT), dtype=np.float32)[
            (yy + 200) % 900, (xx + 180) % 900
        ]
        bpix = 0.55 * bpix + 0.45 * bpix2
        canopy = np.clip((depth - 0.12) / 0.65, 0, 1) * 0.55
        # tán nhiều hơn phía “trên” khối void (giả lập đỉnh vách)
        canopy = canopy * (0.7 + 0.3 * (1.0 - (yy / max(H - 1, 1))))
        filled = filled * (1.0 - canopy[..., None]) + bpix * canopy[..., None]

    noise = rng.normal(0, 5.0, filled.shape).astype(np.float32)
    filled = filled + noise * void.astype(np.float32)[..., None]

    soft = blur_mask(void.astype(np.float32), 2.2)[..., None]
    out = arr * (1.0 - soft) + filled * soft

    # bảo vệ đường/cỏ ngoài void
    c = classify(arr)
    protect = blur_mask(np.clip(c["path"] + c["grass"] * 0.45, 0, 1), 1.0) * (~void)
    pm = protect[..., None]
    out = out * (1.0 - 0.9 * pm) + arr * (0.9 * pm)
    # trong void vẫn dùng filled
    vm = void.astype(np.float32)[..., None]
    out = out * (1.0 - vm) + filled * vm

    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def reskin_scenery(img: Image.Image, bias: str = "mist") -> Image.Image:
    """Bối cảnh Nhạn Đãng thời Trần — núi sương, đá ấm, đường đất, không stamp."""
    W, H = img.size
    og = np.asarray(img, dtype=np.float32)
    c = classify(og)
    p = bias_params(bias)
    h, s, v = rgb_to_hsv(og)

    m_path = blur_mask(c["path"], 0.9)
    m_grass = blur_mask(c["grass"], 1.0)
    m_tree = blur_mask(c["canopy"], 0.9)
    m_rock = blur_mask(c["rock"], 0.85)
    m_built = blur_mask(c["built"], 1.0)

    stack = np.stack(
        [m_built * 1.2, m_tree * 1.35, m_rock * 1.25, m_path * 1.2, m_grass * 1.05],
        axis=-1,
    )
    w = stack / (stack.sum(-1, keepdims=True) + 1e-5)
    mb, mt, mr, mp, mg = [w[..., i] for i in range(5)]

    # Tán: xanh rêu Đại Việt
    h, s = mix_hue_sat(h, s, mt, 0.30, 0.38, hue_w=0.9, sat_w=0.6)
    # Cỏ
    h, s = mix_hue_sat(h, s, mg, 0.29, 0.32, hue_w=0.75, sat_w=0.45)
    # Đường đất nâu ấm
    h, s = mix_hue_sat(h, s, mp, 0.095, 0.26, hue_w=0.7, sat_w=0.42)
    # Đá núi xám-nâu (không lạnh Trung Hoa)
    h, s = mix_hue_sat(h, s, mr, 0.08, 0.14, hue_w=0.65, sat_w=0.4)
    # Mảng built nhỏ (bia/đá) ấm nhẹ
    h, s = mix_hue_sat(h, s, mb, 0.07, 0.22, hue_w=0.7, sat_w=0.4)

    # Hơi sương núi: giảm sat vùng tối + nâng blue nhẹ ở xa
    mist = np.clip((55.0 - c["bright"]) / 55.0, 0, 1) * (1.0 - mp) * 0.35
    s = np.clip(s * (1.0 - 0.35 * mist), 0, 1)
    v = np.clip(v * (1.0 + 0.04 * mist) + 0.02 * mist, 0, 1)

    out = hsv_to_rgb(h, s, v)

    # Đá ấm hơn
    warm_mul = np.array([1.08, 1.03, 0.90], dtype=np.float32)
    warm_add = np.array([6.0, 3.0, -3.0], dtype=np.float32)
    wm = (mr * 0.55 + mb * 0.35)[..., None]
    out = out * (1.0 - wm) + np.clip(out * warm_mul + warm_add, 0, 255) * wm

    grain = ground_grain(W, H, seed=195)
    if grain is not None:
        gmask = (mp * 0.30 + mg * 0.14)[..., None]
        gL = grain.mean(2) + 1e-5
        oL = out.mean(2) + 1e-5
        grain2 = grain * (oL / gL)[..., None]
        out = out * (1.0 - gmask) + grain2 * gmask

    # Grade Trần ấm, hơi sương
    out[..., 0] = np.clip(out[..., 0] * 1.03 + 2, 0, 255)
    out[..., 1] = np.clip(out[..., 1] * 1.02 + 1, 0, 255)
    out[..., 2] = np.clip(out[..., 2] * 0.96, 0, 255)

    img2 = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    img2 = ImageEnhance.Contrast(img2).enhance(1.06)
    img2 = ImageEnhance.Color(img2).enhance(1.02)
    img2 = ImageEnhance.Sharpness(img2).enhance(1.12)
    return img2


def main() -> None:
    src = load_layout_orig()
    print(f"layout orig {src.size} from {ORIG_REV}:img/z/{STEM}.jpg")

    filled = fill_voids(src)
    a0 = np.asarray(src)
    a1 = np.asarray(filled)
    d0 = float(void_mask(a0).mean() * 100)
    d1 = float(void_mask(a1).mean() * 100)
    print(f"void dark% {d0:.3f} -> {d1:.3f}")

    img = reskin_scenery(filled, bias="mist")
    d2 = float(void_mask(np.asarray(img)).mean() * 100)
    print(f"after reskin dark% {d2:.3f}")

    out_path = Z / f"{STEM}.jpg"
    img.save(out_path, quality=90, optimize=True)
    print(f"saved {out_path} {out_path.stat().st_size // 1024}KB")

    art = Path("/opt/cursor/artifacts")
    art.mkdir(parents=True, exist_ok=True)
    img.resize((800, 800), Image.LANCZOS).save(art / "nhan-dang-layout-full.jpg", quality=88)
    # vùng giữa (chỗ user báo lỗ đen)
    img.crop((1100, 1100, 2500, 2500)).save(art / "nhan-dang-layout-center.jpg", quality=90)
    # so sánh trước/sau
    src.resize((640, 640), Image.LANCZOS).save(art / "nhan-dang-before-orig.jpg", quality=85)
    print("artifacts: nhan-dang-layout-full/center.jpg")

    # Giữ obs gốc (bố cục đường/vách khớp 1:1)
    ver = bump_cache()
    z2 = (ROOT / "zones2.js").read_text(encoding="utf-8")
    (ROOT / "zones2.js").write_text(
        re.sub(r"img/z/195\.jpg(?:\?v=\d+)?", f"img/z/195.jpg?v={ver}", z2),
        encoding="utf-8",
    )
    # world.js nếu có bg 195
    world = ROOT / "world.js"
    if world.exists():
        w = world.read_text(encoding="utf-8")
        w2 = re.sub(r'img/z/195\.jpg(?:\?v=\d+)?', f"img/z/195.jpg?v={ver}", w)
        if w2 != w:
            world.write_text(w2, encoding="utf-8")
    print(f"Done v{ver} — bố cục Nhạn Đãng gốc + bối cảnh Trần (hết lỗ đen)")


if __name__ == "__main__":
    main()
