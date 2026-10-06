#!/usr/bin/env python3
"""Mythic night J remaster — elemental rim (độc/hỏa/ám/lôi), keep n/d/w/h grid."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BACKUP = ROOT / "assets/pack/quai-orig-backup"
CATALOG = ROOT / "assets/pack/quai/catalog.json"
OUT = Path("/opt/cursor/artifacts/yentu-j-remaster")
ACTS = ("st", "run", "at", "hurt", "die")

# stem → (label, RGB glow, warm push, cool push, sat, contrast) — đậm nhưng còn form
STYLES = {
    "ani019": ("Nhím · Độc", (185, 55, 255), 0.90, 1.22, 1.45, 1.25),  # violet poison
    "ani018": ("Heo rừng · Hỏa", (255, 95, 15), 1.38, 0.68, 1.50, 1.28),  # ember fire
    "ani051": ("Hoán hùng · Ám", (100, 50, 240), 0.78, 1.32, 1.30, 1.30),  # shadow indigo
    "ani052": ("Linh Miêu · Lôi", (45, 220, 255), 0.82, 1.38, 1.45, 1.25),  # lightning cyan
}


def mythic_cell(cell: Image.Image, glow: tuple[int, int, int], warm: float, cool: float, sat: float, contrast: float) -> Image.Image:
    if cell.mode != "RGBA":
        cell = cell.convert("RGBA")
    w, h = cell.size
    up = cell.resize((w * 4, h * 4), Image.Resampling.NEAREST)
    up = ImageEnhance.Contrast(up).enhance(contrast)
    up = ImageEnhance.Color(up).enhance(sat)
    up = up.filter(ImageFilter.UnsharpMask(radius=1.1, percent=95, threshold=2))

    a = np.asarray(up).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    rgb[..., 0] = np.clip(rgb[..., 0] * warm, 0, 255)
    rgb[..., 2] = np.clip(rgb[..., 2] * cool, 0, 255)
    # giữ form gốc nhiều hơn, nhuộm hệ rõ
    gray = rgb.mean(axis=2, keepdims=True)
    tint = np.array(glow, dtype=np.float32)
    rgb = rgb * 0.58 + gray * 0.10 + tint * 0.32

    lum = gray[..., 0] / 255.0
    hi = np.clip((lum - 0.50) * 1.8, 0, 1)
    for i in range(3):
        rgb[..., i] = np.clip(rgb[..., i] + hi * glow[i] * 0.22, 0, 255)

    mask = Image.fromarray(np.clip(alpha, 0, 255).astype(np.uint8))
    edge = np.asarray(mask.filter(ImageFilter.FIND_EDGES)).astype(np.float32) / 255.0
    edge = np.clip(edge * 2.6, 0, 1)
    dil_near = np.asarray(mask.filter(ImageFilter.MaxFilter(5))).astype(np.float32)
    dil_far = np.asarray(mask.filter(ImageFilter.MaxFilter(11))).astype(np.float32)
    body = alpha > 40
    ring_near = (dil_near > 40) & (~body)
    ring_far = (dil_far > 40) & (~body) & (~ring_near)
    for i in range(3):
        rgb[..., i] = np.where(
            edge > 0.04,
            np.clip(rgb[..., i] * (1 - edge * 0.35) + glow[i] * edge * 1.05, 0, 255),
            rgb[..., i],
        )
    out_rgb = rgb.copy()
    out_a = alpha.copy()
    for i in range(3):
        out_rgb[..., i] = np.where(ring_near, np.clip(glow[i] * 0.90, 0, 255), out_rgb[..., i])
        out_rgb[..., i] = np.where(ring_far, np.clip(glow[i] * 0.48, 0, 255), out_rgb[..., i])
    out_a = np.where(ring_near, np.maximum(out_a, 190), out_a)
    out_a = np.where(ring_far, np.maximum(out_a, 120), out_a)
    out_a = np.where(out_a < 10, 0, out_a)

    out = np.dstack([out_rgb.clip(0, 255), out_a.clip(0, 255)]).astype(np.uint8)
    up2 = Image.fromarray(out, "RGBA")
    return up2.resize((w, h), Image.Resampling.NEAREST)


def remaster_sheet(src: Path, n: int, d: int, cw: int, ch: int, dst: Path, style) -> None:
    label, glow, warm, cool, sat, contrast = style
    im = Image.open(src).convert("RGBA")
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    for di in range(d):
        for fi in range(n):
            x0, y0 = fi * cw, di * ch
            # clamp to sheet
            x1, y1 = min(x0 + cw, im.width), min(y0 + ch, im.height)
            if x0 >= im.width or y0 >= im.height:
                continue
            cell = im.crop((x0, y0, x1, y1))
            if cell.size != (cw, ch):
                pad = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
                pad.paste(cell, (0, 0))
                cell = pad
            if cell.split()[-1].getbbox() is None:
                continue
            out.paste(mythic_cell(cell, glow, warm, cool, sat, contrast), (x0, y0))
    if dst.exists():
        dst.unlink()
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, "WEBP", quality=95, method=4)


def remaster_portrait(src: Path, dst: Path, style) -> None:
    _, glow, warm, cool, sat, contrast = style
    im = Image.open(src).convert("RGBA")
    out = mythic_cell(im, glow, warm, cool, sat, contrast)
    if dst.exists():
        dst.unlink()
    out.save(dst, "PNG")


def preview(stem: str, meta: dict, style, path: Path) -> None:
    label, glow, *_ = style
    tiles = []
    for act in ACTS:
        m = meta[act]
        im = Image.open(ROOT / f"img/a/{stem}_{act}.webp").convert("RGBA")
        cell = im.crop((0, min(2 * m["h"], im.height - 1), min(m["w"], im.width), min(3 * m["h"], im.height)))
        bb = cell.split()[-1].getbbox()
        if bb:
            cell = cell.crop(bb)
        up = cell.resize((max(1, cell.width * 4), max(1, cell.height * 4)), Image.Resampling.NEAREST)
        tile = Image.new("RGB", (160, 140), (12, 14, 28))
        # subtle glow bg
        g = Image.new("RGB", (160, 140), (glow[0] // 5, glow[1] // 5, glow[2] // 5))
        tile.paste(g)
        tile.paste(up, ((160 - up.width) // 2, 28 + max(0, (100 - up.height) // 2)), up)
        ImageDraw.Draw(tile).text((6, 6), act, fill=(220, 230, 255))
        tiles.append(tile)
    strip = Image.new("RGB", (20 + 165 * len(tiles), 170), (8, 10, 18))
    ImageDraw.Draw(strip).text((10, 6), label, fill=(glow[0], glow[1], glow[2]))
    for i, t in enumerate(tiles):
        strip.paste(t, (10 + i * 165, 24))
    path.parent.mkdir(parents=True, exist_ok=True)
    strip.save(path)


def main() -> None:
    cat = json.loads(CATALOG.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    strips = []
    for stem, style in STYLES.items():
        acts = cat["stems"][stem]["acts"]
        for act in ACTS:
            bkp = BACKUP / f"{stem}_{act}.webp"
            dst = ROOT / f"img/a/{stem}_{act}.webp"
            remaster_sheet(bkp, acts[act]["n"], acts[act]["d"], acts[act]["w"], acts[act]["h"], dst, style)
            pack = ROOT / f"assets/pack/quai/stems/{stem}/{act}.webp"
            if pack.parent.exists():
                if pack.exists():
                    pack.unlink()
                shutil.copy2(dst, pack)
        pb = BACKUP / f"{stem}_portrait.png"
        por = ROOT / f"img/m/{stem}.png"
        if pb.exists():
            remaster_portrait(pb, por, style)
        p = OUT / f"{stem}_j.png"
        preview(stem, acts, style, p)
        strips.append(Image.open(p))
        print("ok", stem, style[0])

    # board
    W = max(s.width for s in strips)
    H = sum(s.height for s in strips) + 10 * (len(strips) - 1) + 36
    board = Image.new("RGB", (W, H), (6, 8, 16))
    ImageDraw.Draw(board).text((12, 10), "J · Mythic đêm — Độc / Hỏa / Ám / Lôi (giữ lưới anim)", fill=(230, 210, 160))
    y = 32
    for s in strips:
        board.paste(s, (0, y))
        y += s.height + 10
    board.save(OUT / "00-j-board.png")
    board.save("/opt/cursor/artifacts/yentu_j_style_board.png")
    print("done", OUT)


if __name__ == "__main__":
    main()
