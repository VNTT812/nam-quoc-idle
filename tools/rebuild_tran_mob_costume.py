#!/usr/bin/env python3
"""Dựng lại trang phục thời Trần trên sheet quái người đã remaster.

Nguồn: assets/pack/mobs-remaster/ (snapshot remaster sạch)
Gốc pixel: assets/pack/mobs-goc/
Output: img/a/enemy*|boss* — cloth remap theo bảng áo Trần, giữ da / kim loại / tóc.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC_A = ROOT / "img" / "a"
GOC = ROOT / "assets/pack/mobs-goc"
REMASTER = ROOT / "assets/pack/mobs-remaster"
REVIEW = ROOT / "assets/pack/mobs-tran-costume-review"
PREV = Path("/opt/cursor/artifacts")
ACTS = ("st", "run", "at", "hurt", "die")

# body, head, sash accent, pants (darker cloth)
COSTUMES = {
    "day":   ("#6b4e2e", "#3f3224", "#8a3030", "#4a3420"),
    "cham":  ("#2f4f6f", "#1a3044", "#8a3030", "#1e3244"),
    "reu":   ("#3a5740", "#24382a", "#6a4030", "#243828"),
    "muc":   ("#2c2c32", "#16161a", "#6a2828", "#1a1a1e"),
    "son":   ("#8a3030", "#4e1c1c", "#c4a035", "#4a1818"),
    "kim":   ("#9a7a2e", "#5c4818", "#8a3030", "#5a4418"),
    "bach":  ("#d8d2c4", "#8a8478", "#8a3030", "#6a6458"),
    "lam":   ("#4a6d8c", "#2c4458", "#8a3030", "#2a4050"),
    "dat":   ("#5a3a22", "#2e1e12", "#8a3030", "#3a2414"),
    "thao":  ("#7a6a38", "#4a4020", "#8a3030", "#4a4020"),
    "huyen": ("#3a2a3a", "#1e1620", "#6a3038", "#241820"),
    "ngoc":  ("#2a5a55", "#163832", "#8a3030", "#163830"),
    "hoang": ("#c4a035", "#6e5818", "#8a3030", "#6e5818"),
    "tu":    ("#6a3a58", "#3a2030", "#c4a035", "#3a2030"),
    "dong":  ("#8a5a32", "#4a3018", "#8a3030", "#4a3018"),
    "lua":   ("#b04828", "#5c2414", "#c4a035", "#5c2414"),
    "sam":   ("#1e2a3a", "#101820", "#6a3030", "#101820"),
    "ho":    ("#8a5228", "#4a2c14", "#8a3030", "#4a2c14"),
}

# pool giống js/tran_costume.js — gán theo hash stem
TRASH = ["day", "cham", "reu", "muc", "dat", "thao", "dong", "ho", "bach", "lam"]
ELITE = ["cham", "reu", "son", "lam", "ngoc", "sam", "lua", "tu", "dong"]
BOSS = ["son", "cham", "tu", "ngoc", "lua", "huyen", "kim", "hoang"]


def hex_rgb(h: str) -> np.ndarray:
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def stems() -> list[str]:
    out = []
    for p in sorted(SRC_A.glob("enemy*_st.webp")):
        out.append(p.name.replace("_st.webp", ""))
    for p in sorted(SRC_A.glob("boss*_st.webp")):
        out.append(p.name.replace("_st.webp", ""))
    return out


def stem_hash(stem: str) -> int:
    h = 0
    for ch in stem:
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    return h


def pick_costume(stem: str) -> str:
    h = stem_hash(stem)
    if stem.startswith("boss"):
        return BOSS[h % len(BOSS)]
    # enemy: mix trash/elite by hash
    if (h >> 3) & 1:
        return ELITE[h % len(ELITE)]
    return TRASH[h % len(TRASH)]


def ensure_remaster_snapshot() -> None:
    """Lưu bản remaster sạch (trước khi bake áo) — chỉ copy lần đầu."""
    REMASTER.mkdir(parents=True, exist_ok=True)
    for stem in stems():
        for act in ACTS:
            src = SRC_A / f"{stem}_{act}.webp"
            dst = REMASTER / f"{stem}_{act}.webp"
            if src.exists() and not dst.exists():
                shutil.copy2(src, dst)


def _dilate(mask: np.ndarray, k: int = 1) -> np.ndarray:
    m = mask.astype(np.uint8) * 255
    im = Image.fromarray(m, "L")
    for _ in range(k):
        im = im.filter(ImageFilter.MaxFilter(3))
    return np.asarray(im) > 0


def segment(rgb: np.ndarray, alpha: np.ndarray):
    """Phân vùng: skin / metal / hair / red_accent / cloth — bảo vệ da trần."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1.0)
    opaque = alpha > 40

    # vải tím/hồng (áo) — không nhầm là da
    purple = opaque & (b > g * 1.05) & (r > g * 1.05) & (sat > 0.15)

    # da: peach/tan/olive — nới hơn để giữ ngực trần / tay
    skin_core = (
        opaque
        & ~purple
        & (r > 55)
        & (r < 245)
        & (r >= g - 5)
        & (r > b + 2)
        & (g > b - 8)
        & (sat < 0.62)
        & ((r - b) > 8)
        & (mx - mn < 110)
    )
    # da sáng / hồng nhạt
    skin_light = opaque & ~purple & (r > 150) & (g > 110) & (b > 90) & (r > b) & (sat < 0.35) & (r - b < 70)
    skin = skin_core | skin_light
    # giãn 1px giữ mép da; không nuốt vải đậm / tím
    skin = _dilate(skin, 1) & opaque & ~purple & (sat < 0.65) & (r >= g - 10)

    metal = opaque & (sat < 0.20) & (mx > 140) & ~skin
    # tóc/khăn tối — không lấy da tối
    hair = opaque & (mx < 58) & (sat < 0.40) & ~skin & (r < 80)
    red = opaque & (r > 115) & (r > g * 1.28) & (r > b * 1.28) & (sat > 0.28) & ~skin
    cloth = opaque & ~skin & ~metal & ~hair & ~red
    return skin, metal, hair, red, cloth


def rebuild_sheet(im: Image.Image, key: str) -> Image.Image:
    body_c, head_c, sash_c, pants_c = [hex_rgb(c) for c in COSTUMES[key]]
    a = np.array(im.convert("RGBA"), copy=True)
    rgb = a[..., :3].astype(np.float32)
    alpha = a[..., 3].astype(np.float32)
    skin, metal, hair, red, cloth = segment(rgb, alpha)

    # luminance of original for shading
    lum = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255.0
    # vertical bias: top → head wrap, mid → áo, bottom → quần
    ys = np.linspace(0, 1, a.shape[0], dtype=np.float32)[:, None]
    ys = np.broadcast_to(ys, alpha.shape)

    # cloth remap
    head_w = np.clip((0.38 - ys) / 0.38, 0, 1)  # top
    pant_w = np.clip((ys - 0.55) / 0.35, 0, 1)  # bottom
    body_w = 1.0 - np.maximum(head_w, pant_w)

    target = (
        head_c[None, None, :] * head_w[..., None]
        + body_c[None, None, :] * body_w[..., None]
        + pants_c[None, None, :] * pant_w[..., None]
    )
    # shade by original luminance (keep folds)
    shade = 0.45 + 0.75 * lum
    shaded = target * shade[..., None]
    # blend strength — rebuild mạnh nhưng giữ chút texture gốc
    mix = 0.82
    new_rgb = rgb.copy()
    for c in range(3):
        ch = new_rgb[..., c]
        ch = np.where(cloth, ch * (1 - mix) + shaded[..., c] * mix, ch)
        new_rgb[..., c] = ch

    # sash / đỏ nhấn → accent Trần (son/kim)
    if red.any():
        sash_shade = 0.5 + 0.7 * lum
        for c in range(3):
            ch = new_rgb[..., c]
            ch = np.where(red, ch * 0.25 + sash_c[c] * sash_shade * 0.75, ch)
            new_rgb[..., c] = ch

    # khăn / tóc tối: hơi nhuộm head tone nhẹ
    if hair.any():
        for c in range(3):
            ch = new_rgb[..., c]
            ch = np.where(hair, ch * 0.55 + head_c[c] * 0.35, ch)
            new_rgb[..., c] = ch

    # skin / metal giữ nguyên
    out = np.dstack([new_rgb.clip(0, 255).astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(out, "RGBA")


def process_all() -> dict[str, str]:
    ensure_remaster_snapshot()
    mapping = {}
    all_stems = stems()
    for i, stem in enumerate(all_stems):
        key = pick_costume(stem)
        mapping[stem] = key
        for act in ACTS:
            base = REMASTER / f"{stem}_{act}.webp"
            if not base.exists():
                base = SRC_A / f"{stem}_{act}.webp"
            if not base.exists():
                continue
            im = Image.open(base).convert("RGBA")
            out = rebuild_sheet(im, key)
            dst = SRC_A / f"{stem}_{act}.webp"
            if dst.exists():
                dst.unlink()
            out.save(dst, "WEBP", quality=95, method=4)
        if (i + 1) % 10 == 0 or i == len(all_stems) - 1:
            print(f"  costume {i+1}/{len(all_stems)}")
    REVIEW.mkdir(parents=True, exist_ok=True)
    (REVIEW / "stem_costume.json").write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")
    return mapping


def preview(mapping: dict[str, str]) -> None:
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
        font2 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    except Exception:
        font = font2 = ImageFont.load_default()

    show = [
        s for s in (
            "enemy122", "enemy050", "enemy076", "enemy107", "enemy129",
            "enemy003", "enemy048", "enemy069",
            "boss002", "boss008", "boss015", "boss003",
        )
        if s in mapping
    ]
    if len(show) < 8:
        show = list(mapping.keys())[:12]

    cell_w, cell_h, pad = 140, 150, 10
    cols = 4
    rows = (len(show) + cols - 1) // cols
    W = pad + cols * (cell_w * 2 + 12 + pad)
    H = 40 + pad + rows * (cell_h + 28 + pad)
    board = Image.new("RGB", (W, H), (18, 20, 24))
    draw = ImageDraw.Draw(board)
    draw.text((pad, 10), "Trang phuc Tran tren remaster — trai: REMASTER · phai: AO TRAN", fill=(230, 210, 150), font=font)

    def first_sprite(im: Image.Image) -> Image.Image:
        for h in (45, 47, 49, 50, 52, 55, 58, 60, 65, 70, 75, 80):
            for w in (45, 50, 52, 55, 56, 58, 59, 60, 65, 70, 72, 80, 90):
                if im.width < w or im.height < h:
                    continue
                cell = im.crop((0, 0, w, h))
                bb = cell.split()[-1].getbbox()
                if bb and (bb[2] - bb[0]) * (bb[3] - bb[1]) > w * h * 0.08:
                    return cell.crop(bb)
        bb = im.split()[-1].getbbox()
        return im.crop(bb) if bb else im

    for i, stem in enumerate(show):
        r, c = divmod(i, cols)
        left_p = REMASTER / f"{stem}_st.webp"
        right_p = SRC_A / f"{stem}_st.webp"
        if not left_p.exists() or not right_p.exists():
            continue
        a = first_sprite(Image.open(left_p).convert("RGBA"))
        b = first_sprite(Image.open(right_p).convert("RGBA"))
        sc = max(2, min(4, 100 // max(a.width, 1)))
        a = a.resize((a.width * sc, a.height * sc), Image.Resampling.NEAREST)
        b = b.resize((b.width * sc, b.height * sc), Image.Resampling.NEAREST)
        x0 = pad + c * (cell_w * 2 + 12 + pad)
        y0 = 40 + pad + r * (cell_h + 28 + pad)
        draw.rectangle([x0, y0, x0 + cell_w - 1, y0 + cell_h - 1], fill=(32, 34, 40), outline=(60, 64, 70))
        draw.rectangle([x0 + cell_w + 8, y0, x0 + cell_w * 2 + 7, y0 + cell_h - 1], fill=(32, 34, 40), outline=(120, 100, 60))
        board.paste(a, (x0 + (cell_w - a.width) // 2, y0 + (cell_h - a.height) // 2), a)
        board.paste(b, (x0 + cell_w + 8 + (cell_w - b.width) // 2, y0 + (cell_h - b.height) // 2), b)
        key = mapping.get(stem, "?")
        draw.text((x0 + 4, y0 + cell_h + 4), f"{stem} → {key}", fill=(190, 195, 205), font=font2)

    REVIEW.mkdir(parents=True, exist_ok=True)
    PREV.mkdir(parents=True, exist_ok=True)
    board.save(REVIEW / "remaster-vs-tran.png")
    board.save(PREV / "mobs_tran_costume_rebuild.png")
    print("preview", board.size)


def main() -> None:
    print("rebuild Tran costumes on remastered human mobs…")
    mapping = process_all()
    preview(mapping)
    print("stems", len(mapping), "→", REVIEW / "stem_costume.json")


if __name__ == "__main__":
    main()
