#!/usr/bin/env python3
"""Hoành Sơn Phái (56): giữ bố cục VLTK, đổi màu + kiến trúc nhà sang tông Trần.

- Mái xanh / mái cổng tối → ngói đất nung (terracotta)
- Tường trắng → gạch/vữa ấm; cờ xanh → cờ ấm
- Soft-stamp prop nhà Trần lên vị trí điện / nhà phụ / cổng
- Chỉ xuất preview duyệt — không ghi đè img/z/56.jpg trừ khi --apply
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from reskin_tran_layout import (  # noqa: E402
    TILES,
    blur_mask,
    classify,
    ground_grain,
    hsv_to_rgb,
    mix_hue_sat,
    rgb_to_hsv,
)

Z = ROOT / "img" / "z"
REVIEW = ROOT / "assets/pack/map-style-review/56-hoanh-son"
ART = Path("/opt/cursor/artifacts/hoanh-son-56-tran-arch")
ORIG_REV = "5f51470"
STEM = "56"

# Vị trí nhà trên map 3584 (ước lượng từ bố cục gốc — giữ footprint)
BUILDINGS = [
    # name, cx, cy, stamp_w, stamp_h, flip
    ("main_hall", 2880, 920, 520, 420, False),
    ("wing_nw", 2320, 780, 420, 300, False),
    ("wing_se", 3020, 1480, 380, 280, True),
    ("gate", 2140, 1580, 340, 280, False),
]


def load_orig() -> Image.Image:
    data = subprocess.check_output(["git", "show", f"{ORIG_REV}:img/z/{STEM}.jpg"])
    return Image.open(BytesIO(data)).convert("RGB")


def load_house_rgba() -> Image.Image:
    p = TILES / "prop-tran-house.jpg"
    im = Image.open(p).convert("RGB")
    a = np.asarray(im, dtype=np.float32)
    # nền cỏ ô vuông — loại theo độ lệch so với góc
    corners = np.stack([a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]]).mean(0)
    diff = np.abs(a - corners).sum(2)
    # cũng loại vùng xanh lá phẳng quanh chân
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    grass = (g > r + 6) & (g > b + 4) & (g > 70) & (g < 160) & ((a.max(2) - a.min(2)) < 55)
    alpha = np.clip((diff - 28) / 50.0, 0, 1)
    alpha = np.where(grass, alpha * 0.15, alpha)
    alpha = (alpha * 255).astype(np.uint8)
    # feather
    am = Image.fromarray(alpha, "L").filter(ImageFilter.GaussianBlur(2.5))
    rgba = im.convert("RGBA")
    rgba.putalpha(am)
    # crop tight
    bb = am.getbbox()
    if bb:
        rgba = rgba.crop(bb)
    return rgba


def roof_masks(og: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Mái ngói xanh (điện), mái tối (cổng), cờ xanh."""
    r, g, b = og[..., 0], og[..., 1], og[..., 2]
    bright = (r + g + b) / 3.0
    sat = og.max(2) - og.min(2)
    h, s, v = rgb_to_hsv(og)

    # Sân đá xám trong compound — neo vùng kiến trúc
    stone = ((s < 0.25) & (bright > 65) & (bright < 175) & (np.abs(r - g) < 28)).astype(np.float32)
    near = blur_mask(stone, 0.0)
    near_im = Image.fromarray((near * 255).astype(np.uint8), "L")
    for _ in range(3):
        near_im = near_im.filter(ImageFilter.MaxFilter(21))
    near = np.asarray(near_im, dtype=np.float32) / 255.0

    # Mái xanh ngọc (không lấy tán cây tối bên ngoài)
    emerald = (
        (g > r + 14)
        & (g > b + 10)
        & (g > 100)
        & (bright > 85)
        & (bright < 210)
        & (sat > 28)
        & (h > 0.22)
        & (h < 0.48)
    )
    # ưu tiên gần sân; vẫn lấy mái trên điện sát tường
    roof_green = (emerald.astype(np.float32) * np.clip(near * 1.4, 0, 1)).astype(np.float32)
    roof_green = np.clip(roof_green + emerald.astype(np.float32) * 0.35, 0, 1)

    # Mái cổng tối (ngói xám đen) trên built gần cổng
    dark_roof = (
        (bright < 95)
        & (bright > 35)
        & (sat < 45)
        & (np.abs(r - g) < 22)
        & (b <= g + 8)
        & (near > 0.2)
    ).astype(np.float32)

    # Cờ / banner xanh đứng trong sân
    banner = (
        (g > r + 25)
        & (g > b + 18)
        & (sat > 55)
        & (bright > 95)
        & (bright < 220)
        & (near > 0.35)
    ).astype(np.float32)

    return (
        blur_mask(roof_green, 0.8),
        blur_mask(dark_roof, 1.0),
        blur_mask(banner, 0.6),
    )


def recolor_tran(orig: Image.Image) -> Image.Image:
    og = np.asarray(orig, dtype=np.float32)
    W, H = orig.size
    c = classify(og)
    m_green, m_dark, m_banner = roof_masks(og)
    m_path = blur_mask(c["path"], 0.9)
    m_grass = blur_mask(c["grass"], 1.0)
    m_tree = blur_mask(c["canopy"] * (1.0 - m_green), 0.9)
    m_rock = blur_mask(c["rock"], 0.8)
    m_built = blur_mask(np.clip(c["built"] + m_green + m_dark * 0.5, 0, 1), 1.0)

    h, s, v = rgb_to_hsv(og)

    # Cây / đường / cỏ — tông ấm Trần nhẹ
    h, s = mix_hue_sat(h, s, m_tree, 0.30, 0.38, hue_w=0.7, sat_w=0.45)
    h, s = mix_hue_sat(h, s, m_path, 0.09, 0.28, hue_w=0.55, sat_w=0.35)
    h, s = mix_hue_sat(h, s, m_grass, 0.28, 0.34, hue_w=0.55, sat_w=0.4)
    h, s = mix_hue_sat(h, s, m_rock, 0.10, 0.12, hue_w=0.5, sat_w=0.3)

    # Thân nhà / tường: nâu gỗ + gạch ấm (tránh xanh)
    body = m_built * (1.0 - m_green) * (1.0 - m_dark * 0.7)
    h, s = mix_hue_sat(h, s, body, 0.07, 0.32, hue_w=0.85, sat_w=0.55)
    # tường sáng → vữa kem / gạch hồng nhạt
    plaster = body * np.clip((c["bright"] - 100) / 80.0, 0, 1)
    h = h * (1.0 - 0.5 * plaster) + 0.06 * (0.5 * plaster)
    s = np.clip(s * (1.0 - 0.25 * plaster) + 0.22 * plaster, 0, 1)

    # === Mái ngói đất nung (khóa hue ~ đỏ-cam) ===
    h = h * (1.0 - 0.95 * m_green) + 0.045 * (0.95 * m_green)
    s = np.clip(s * (1.0 - 0.45 * m_green) + 0.55 * m_green, 0, 1)
    v = np.clip(v * (1.0 - 0.08 * m_green) + 0.42 * m_green * 0.15, 0, 1)

    # Mái cổng: ngói nâu sẫm
    h = h * (1.0 - 0.9 * m_dark) + 0.04 * (0.9 * m_dark)
    s = np.clip(s * (1.0 - 0.3 * m_dark) + 0.38 * m_dark, 0, 1)
    v = np.clip(v * (1.0 - 0.12 * m_dark), 0, 1)

    # Cờ: đỏ / cam ấm (hơi ngũ sắc)
    h = h * (1.0 - 0.92 * m_banner) + 0.02 * (0.92 * m_banner)
    s = np.clip(s * (1.0 - 0.35 * m_banner) + 0.62 * m_banner, 0, 1)
    v = np.clip(v * (1.0 + 0.08 * m_banner), 0, 1)

    out = hsv_to_rgb(h, s, v)

    # RGB grade trên mái + thân
    warm_mul = np.array([1.22, 1.00, 0.78], dtype=np.float32)
    warm_add = np.array([18.0, 4.0, -8.0], dtype=np.float32)
    wm = (m_green * 0.7 + body * 0.45 + m_dark * 0.4)[..., None]
    out = out * (1.0 - wm) + np.clip(out * warm_mul + warm_add, 0, 255) * wm

    grain = ground_grain(W, H, seed=56)
    if grain is not None:
        gmask = ((m_path * 0.25 + m_grass * 0.12) * (1.0 - m_green))[..., None]
        gL = grain.mean(2) + 1e-5
        oL = out.mean(2) + 1e-5
        grain2 = grain * (oL / gL)[..., None]
        out = out * (1.0 - gmask) + grain2 * gmask

    out[..., 0] = np.clip(out[..., 0] * 1.03 + 3, 0, 255)
    out[..., 1] = np.clip(out[..., 1] * 1.01, 0, 255)
    out[..., 2] = np.clip(out[..., 2] * 0.95, 0, 255)

    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    img = ImageEnhance.Contrast(img).enhance(1.06)
    img = ImageEnhance.Color(img).enhance(1.06)
    img = ImageEnhance.Sharpness(img).enhance(1.12)
    return img


def stamp_houses(base: Image.Image, strength: float = 0.72) -> Image.Image:
    house = load_house_rgba()
    canvas = base.convert("RGBA")
    for name, cx, cy, sw, sh, flip in BUILDINGS:
        spr = house.resize((sw, sh), Image.LANCZOS)
        if flip:
            spr = spr.transpose(Image.FLIP_LEFT_RIGHT)
        # scale alpha by strength
        r, g, b, a = spr.split()
        a = a.point(lambda p: int(p * strength))
        spr = Image.merge("RGBA", (r, g, b, a))
        # soft edge
        a2 = spr.split()[-1].filter(ImageFilter.GaussianBlur(1.2))
        spr.putalpha(a2)
        dest = (cx - sw // 2, cy - sh // 2)
        canvas.alpha_composite(spr, dest=dest)
    return canvas.convert("RGB")


def draw_roof_accents(img: Image.Image, intensity: float = 0.55) -> Image.Image:
    """Vẽ thêm đường mái / đầu đao nhẹ trên footprint điện — hỗ trợ cảm giác Trần."""
    out = img.copy()
    draw = ImageDraw.Draw(out, "RGBA")
    roof = (168, 72, 42, int(160 * intensity))
    dark = (90, 40, 28, int(140 * intensity))
    wood = (92, 58, 36, int(120 * intensity))
    for name, cx, cy, sw, sh, _ in BUILDINGS:
        if name == "gate":
            w, h = int(sw * 0.55), int(sh * 0.35)
            x0, y0 = cx - w // 2, cy - h // 2 - 20
            draw.polygon(
                [
                    (x0 - 10, y0 + h // 2),
                    (cx, y0 - 8),
                    (x0 + w + 10, y0 + h // 2),
                    (x0 + w, y0 + h // 2 + 14),
                    (cx, y0 + 10),
                    (x0, y0 + h // 2 + 14),
                ],
                fill=dark,
            )
            continue
        w, h = int(sw * 0.7), int(sh * 0.45)
        x0, y0 = cx - w // 2, cy - h // 2 - 30
        draw.polygon(
            [
                (x0 - 16, y0 + h // 3),
                (cx, y0 - 12),
                (x0 + w + 16, y0 + h // 3),
                (x0 + w + 6, y0 + h // 3 + 18),
                (cx, y0 + 8),
                (x0 - 6, y0 + h // 3 + 18),
            ],
            fill=roof,
        )
        # đầu đao hai bên
        draw.polygon(
            [(x0 - 18, y0 + h // 3 + 2), (x0 - 36, y0 + h // 3 - 12), (x0 - 4, y0 + h // 3 - 2)],
            fill=(200, 120, 70, int(100 * intensity)),
        )
        draw.polygon(
            [
                (x0 + w + 18, y0 + h // 3 + 2),
                (x0 + w + 36, y0 + h // 3 - 12),
                (x0 + w + 4, y0 + h // 3 - 2),
            ],
            fill=(200, 120, 70, int(100 * intensity)),
        )
        # cột gỗ gợi ý
        for i in range(4):
            ox = x0 + 20 + i * (w - 40) // 3
            draw.rectangle([ox - 3, y0 + h // 3 + 10, ox + 3, y0 + h - 10], fill=wood)
    return out


def make_variant(kind: str) -> Image.Image:
    orig = load_orig()
    base = recolor_tran(orig)
    if kind == "A-recolor":
        return base
    if kind == "B-recolor-accent":
        return draw_roof_accents(base, 0.5)
    if kind == "C-stamp-soft":
        return stamp_houses(base, strength=0.55)
    if kind == "D-stamp-strong":
        stamped = stamp_houses(base, strength=0.78)
        return draw_roof_accents(stamped, 0.35)
    if kind == "E-stamp-warm":
        stamped = stamp_houses(base, strength=0.68)
        arr = np.asarray(stamped, dtype=np.float32)
        arr[..., 0] = np.clip(arr[..., 0] * 1.04 + 4, 0, 255)
        arr[..., 2] = np.clip(arr[..., 2] * 0.94, 0, 255)
        return Image.fromarray(arr.astype(np.uint8), "RGB")
    raise ValueError(kind)


VARIANTS = [
    ("10-arch-recolor", "A-recolor", "Đổi màu mái/tường/cờ → ngói đất nung (không stamp)"),
    ("11-arch-accent", "B-recolor-accent", "Recolor + vẽ mái/đầu đao nhẹ"),
    ("12-arch-stamp-soft", "C-stamp-soft", "Recolor + stamp nhà Trần (mềm)"),
    ("13-arch-stamp-strong", "D-stamp-strong", "Recolor + stamp mạnh + đầu đao"),
    ("14-arch-stamp-warm", "E-stamp-warm", "Recolor + stamp + grade ấm hơn"),
]


def save_previews(path: Path, slug: str) -> None:
    im = Image.open(path).convert("RGB")
    ART.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    (REVIEW / "thumbs").mkdir(exist_ok=True)
    im.resize((1024, 1024), Image.LANCZOS).save(REVIEW / "thumbs" / f"{slug}.jpg", quality=88)
    # crop compound
    crop = im.crop((1680, 280, 3380, 1980)).resize((1200, 900), Image.LANCZOS)
    d = ImageDraw.Draw(crop)
    d.rectangle([0, 0, 1200, 34], fill=(26, 22, 18))
    d.text((10, 8), slug, fill=(232, 220, 200))
    crop.save(ART / f"{slug}.jpg", quality=90)


def update_gallery(extra: list[tuple[str, str]]) -> None:
    idx = REVIEW / "index.html"
    cards = []
    for slug, title in extra:
        cards.append(
            f'<figure><img src="thumbs/{slug}.jpg" alt="{slug}"/>'
            f"<figcaption><strong>{slug}</strong><br/>{title}</figcaption></figure>"
        )
    block = "\n".join(cards)
    if idx.exists():
        html = idx.read_text(encoding="utf-8")
        marker = "<!-- ARCH_TRAN -->"
        if marker in html:
            pre, rest = html.split(marker, 1)
            # replace until next comment or end of grid
            html = pre + marker + "\n" + block + "\n" + rest[rest.find("</div>") :]
        else:
            html = html.replace(
                '</div>\n</body>',
                f'{marker}\n{block}\n</div>\n</body>',
            )
        idx.write_text(html, encoding="utf-8")
    readme = REVIEW / "README.md"
    if readme.exists():
        t = readme.read_text(encoding="utf-8")
        if "10-arch-recolor" not in t:
            lines = [
                "",
                "## Architecture Trần (v2)",
                "| Slug | Mô tả |",
                "|------|--------|",
            ]
            for slug, title in extra:
                lines.append(f"| `{slug}.jpg` | {title} |")
            readme.write_text(t.rstrip() + "\n" + "\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", choices=[v[0] for v in VARIANTS], help="Ghi vào img/z/56.jpg")
    args = ap.parse_args()

    labels: list[tuple[str, str]] = []
    for i, (slug, kind, title) in enumerate(VARIANTS, 1):
        print(f"[{i}/{len(VARIANTS)}] {slug} …", flush=True)
        img = make_variant(kind)
        out = REVIEW / f"{slug}.jpg"
        img.save(out, quality=90, optimize=True)
        save_previews(out, slug)
        print(f"  -> {out.stat().st_size // 1024} KB", flush=True)
        labels.append((slug, title))

    update_gallery(labels)

    if args.apply:
        src = REVIEW / f"{args.apply}.jpg"
        dest = Z / "56.jpg"
        dest.write_bytes(src.read_bytes())
        print(f"Applied {args.apply} -> {dest}")
    print(f"Done → {REVIEW} / {ART}")


if __name__ == "__main__":
    main()
