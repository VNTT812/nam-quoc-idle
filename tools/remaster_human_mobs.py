#!/usr/bin/env python3
"""Remaster pixel quái người (enemy* / boss*). Không đụng ani*.

Pipeline mỗi sheet (giữ đúng kích thước / layout frame):
  1) backup gốc → assets/pack/mobs-goc/
  2) làm sạch fringe alpha
  3) tăng nét + tương phản nhẹ, posterize palette
  4) outline silhouette mỏng
  5) preview before/after
"""
from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "img" / "a"
BACKUP = ROOT / "assets/pack/mobs-goc"
REVIEW = ROOT / "assets/pack/mobs-remaster-review"
PREV = Path("/opt/cursor/artifacts")
ACTS = ("st", "run", "at", "hurt", "die")


def stems() -> list[str]:
    out = []
    for p in sorted(SRC.glob("enemy*_st.webp")):
        out.append(p.name.replace("_st.webp", ""))
    for p in sorted(SRC.glob("boss*_st.webp")):
        out.append(p.name.replace("_st.webp", ""))
    return out


def backup_stem(stem: str) -> None:
    BACKUP.mkdir(parents=True, exist_ok=True)
    for act in ACTS:
        src = SRC / f"{stem}_{act}.webp"
        dst = BACKUP / f"{stem}_{act}.webp"
        if src.exists() and not dst.exists():
            shutil.copy2(src, dst)


def clean_alpha(im: Image.Image) -> Image.Image:
    a = np.asarray(im.convert("RGBA"))
    rgb, alpha = a[..., :3].astype(np.float32), a[..., 3].astype(np.float32)
    # kill near-transparent dust
    alpha = np.where(alpha < 18, 0, alpha)
    # harden mid alpha toward opaque / clear
    alpha = np.where((alpha > 0) & (alpha < 90), alpha * 0.35, alpha)
    alpha = np.where(alpha >= 90, np.minimum(255, alpha * 1.08 + 12), alpha)
    alpha = alpha.clip(0, 255)
    # drop isolated 1px speckles
    mask = alpha > 40
    # simple neighbor count
    pad = np.pad(mask, 1, mode="constant")
    neigh = (
        pad[:-2, :-2].astype(np.uint8)
        + pad[:-2, 1:-1]
        + pad[:-2, 2:]
        + pad[1:-1, :-2]
        + pad[1:-1, 2:]
        + pad[2:, :-2]
        + pad[2:, 1:-1]
        + pad[2:, 2:]
    )
    keep = mask & ((neigh >= 2) | (alpha > 160))
    alpha = np.where(keep, alpha, 0)
    out = np.dstack([rgb.astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(out, "RGBA")


def outline(im: Image.Image, strength: float = 0.55) -> Image.Image:
    a = np.asarray(im)
    alpha = a[..., 3]
    mask = Image.fromarray(alpha, "L")
    dil = mask.filter(ImageFilter.MaxFilter(3))
    er = mask.filter(ImageFilter.MinFilter(3))
    edge = np.asarray(dil).astype(np.int16) - np.asarray(er).astype(np.int16)
    edge = (edge > 20) & (alpha > 30)
    out = a.copy()
    # darken edge pixels slightly
    for c in range(3):
        ch = out[..., c].astype(np.float32)
        ch = np.where(edge, ch * (1.0 - 0.35 * strength), ch)
        out[..., c] = ch.clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def remaster(im: Image.Image) -> Image.Image:
    im = clean_alpha(im)
    # mild clarity
    rgb = im.convert("RGB")
    rgb = ImageEnhance.Contrast(rgb).enhance(1.12)
    rgb = ImageEnhance.Color(rgb).enhance(1.08)
    rgb = ImageEnhance.Brightness(rgb).enhance(1.03)
    rgb = rgb.filter(ImageFilter.UnsharpMask(radius=0.7, percent=70, threshold=2))
    # posterize for cleaner game pixels (keep alpha)
    rgb = ImageOps.posterize(rgb, 5)
    out = rgb.convert("RGBA")
    out.putalpha(im.split()[-1])
    out = outline(out, 0.5)
    # final snap alpha
    a = np.array(out, copy=True)
    alpha = a[..., 3]
    alpha = np.where(alpha < 40, 0, np.where(alpha > 200, 255, alpha))
    a[..., 3] = alpha
    return Image.fromarray(a, "RGBA")


def process_stem(stem: str) -> int:
    backup_stem(stem)
    n = 0
    for act in ACTS:
        src = SRC / f"{stem}_{act}.webp"
        if not src.exists():
            continue
        # always remaster from backup if present (idempotent)
        base = BACKUP / f"{stem}_{act}.webp"
        im = Image.open(base if base.exists() else src).convert("RGBA")
        out = remaster(im)
        if src.exists():
            src.unlink()
        out.save(src, "WEBP", quality=95, method=4)
        n += 1
    return n


def preview(stems_show: list[str]) -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    PREV.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 13)
        font2 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    except Exception:
        font = font2 = ImageFont.load_default()

    cell_w, cell_h, pad = 140, 150, 10
    cols = 4
    rows = (len(stems_show) + cols - 1) // cols
    W = pad + cols * (cell_w * 2 + 12 + pad)
    H = 40 + pad + rows * (cell_h + 28 + pad)
    board = Image.new("RGB", (W, H), (18, 20, 24))
    draw = ImageDraw.Draw(board)
    draw.text((pad, 10), "Remaster pixel quai nguoi — trai: GOC · phai: REMASTER", fill=(230, 210, 150), font=font)

    for i, stem in enumerate(stems_show):
        r, c = divmod(i, cols)
        goc = BACKUP / f"{stem}_st.webp"
        neu = SRC / f"{stem}_st.webp"
        if not goc.exists() or not neu.exists():
            continue
        go = Image.open(goc).convert("RGBA")
        nw = Image.open(neu).convert("RGBA")
        # first cell approx: top-left non-empty crop scaled
        def first_sprite(im: Image.Image) -> Image.Image:
            # try common cell heights
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

        a = first_sprite(go)
        b = first_sprite(nw)
        sc = max(2, min(4, 100 // max(a.width, 1)))
        a = a.resize((a.width * sc, a.height * sc), Image.Resampling.NEAREST)
        b = b.resize((b.width * sc, b.height * sc), Image.Resampling.NEAREST)
        x0 = pad + c * (cell_w * 2 + 12 + pad)
        y0 = 40 + pad + r * (cell_h + 28 + pad)
        draw.rectangle([x0, y0, x0 + cell_w - 1, y0 + cell_h - 1], fill=(32, 34, 40), outline=(60, 64, 70))
        draw.rectangle([x0 + cell_w + 8, y0, x0 + cell_w * 2 + 7, y0 + cell_h - 1], fill=(32, 34, 40), outline=(90, 120, 80))
        board.paste(a, (x0 + (cell_w - a.width) // 2, y0 + (cell_h - a.height) // 2), a)
        board.paste(b, (x0 + cell_w + 8 + (cell_w - b.width) // 2, y0 + (cell_h - b.height) // 2), b)
        draw.text((x0 + 4, y0 + cell_h + 4), f"{stem}", fill=(190, 195, 205), font=font2)

    board.save(REVIEW / "before-after.png")
    board.save(PREV / "mobs_remaster_before_after.png")
    print("preview", board.size)


def main() -> None:
    all_stems = stems()
    print(f"remaster {len(all_stems)} stems × {len(ACTS)} acts")
    total = 0
    for i, stem in enumerate(all_stems):
        n = process_stem(stem)
        total += n
        if (i + 1) % 10 == 0 or i == len(all_stems) - 1:
            print(f"  {i+1}/{len(all_stems)} sheets done ({total} files)")
    # representative preview
    show = [
        s for s in (
            "enemy122", "enemy050", "enemy076", "enemy107", "enemy129",
            "enemy003", "enemy048", "enemy069",
            "boss002", "boss008", "boss015", "boss003",
        )
        if s in all_stems
    ]
    if len(show) < 8:
        show = all_stems[:12]
    preview(show)
    print("done", total, "files · backup", BACKUP)


if __name__ == "__main__":
    main()
