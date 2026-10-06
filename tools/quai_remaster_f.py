#!/usr/bin/env python3
"""Pixel remaster F for Yên Tử starters — cell-in-place, keep n/d/w/h/ax/ay/ms."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
STEMS = ("ani018", "ani019", "ani051", "ani052")
ACTS = ("st", "run", "at", "hurt", "die")
BACKUP = ROOT / "assets/pack/quai-orig-backup"
CATALOG = ROOT / "assets/pack/quai/catalog.json"
OUT_PREVIEW = Path("/opt/cursor/artifacts/yentu-f-remaster")


def remaster_cell(cell: Image.Image) -> Image.Image:
    """Crisp pixel remaster; output same size as input."""
    if cell.mode != "RGBA":
        cell = cell.convert("RGBA")
    w, h = cell.size
    # Upscale → enhance → nearest downscale (keeps silhouette, cleans edges)
    up = cell.resize((w * 4, h * 4), Image.Resampling.NEAREST)
    up = ImageEnhance.Contrast(up).enhance(1.22)
    up = ImageEnhance.Color(up).enhance(1.12)
    up = ImageEnhance.Sharpness(up).enhance(1.35)
    up = up.filter(ImageFilter.UnsharpMask(radius=1.2, percent=90, threshold=2))

    a = np.asarray(up).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    # Darken silhouette rim for readable outlines
    mask = Image.fromarray(alpha.astype(np.uint8))
    edge = np.asarray(mask.filter(ImageFilter.FIND_EDGES)).astype(np.float32) / 255.0
    edge = np.clip(edge * 1.8, 0, 1)
    rgb = rgb * (1.0 - edge[..., None] * 0.35)
    # Clean near-transparent fringe
    alpha = np.where(alpha < 18, 0, alpha)
    alpha = np.where((alpha > 0) & (alpha < 90), np.minimum(255, alpha * 1.35), alpha)
    out = np.dstack([rgb.clip(0, 255), alpha.clip(0, 255)]).astype(np.uint8)
    up2 = Image.fromarray(out, "RGBA")
    return up2.resize((w, h), Image.Resampling.NEAREST)


def remaster_sheet(src: Path, n: int, d: int, w: int, h: int, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    for di in range(d):
        for fi in range(n):
            x0, y0 = fi * w, di * h
            cell = im.crop((x0, y0, x0 + w, y0 + h))
            # skip empty
            if cell.split()[-1].getbbox() is None:
                continue
            out.paste(remaster_cell(cell), (x0, y0))
    dst.parent.mkdir(parents=True, exist_ok=True)
    # break hardlinks
    if dst.exists():
        dst.unlink()
    out.save(dst, "WEBP", quality=95, method=4)


def remaster_portrait(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    out = remaster_cell(im)
    if dst.exists():
        dst.unlink()
    out.save(dst, "PNG")


def preview_strip(stem: str, meta: dict, label: str, path: Path) -> None:
    from PIL import ImageDraw

    tiles = []
    for act in ACTS:
        m = meta[act]
        im = Image.open(ROOT / f"img/a/{stem}_{act}.webp").convert("RGBA")
        cell = im.crop((0, 2 * m["h"], m["w"], 3 * m["h"]))
        bb = cell.split()[-1].getbbox()
        if bb:
            cell = cell.crop(bb)
        up = cell.resize((cell.width * 4, cell.height * 4), Image.Resampling.NEAREST)
        tile = Image.new("RGB", (160, 140), (28, 70, 45))
        tile.paste(up, ((160 - up.width) // 2, 28 + (100 - up.height) // 2), up)
        ImageDraw.Draw(tile).text((6, 6), act, fill=(255, 240, 180))
        tiles.append(tile)
    strip = Image.new("RGB", (20 + 165 * len(tiles), 170), (18, 18, 22))
    ImageDraw.Draw(strip).text((10, 6), f"{label} {stem}", fill=(255, 220, 140))
    for i, t in enumerate(tiles):
        strip.paste(t, (10 + i * 165, 24))
    path.parent.mkdir(parents=True, exist_ok=True)
    strip.save(path)


def main() -> None:
    cat = json.loads(CATALOG.read_text())
    BACKUP.mkdir(parents=True, exist_ok=True)
    OUT_PREVIEW.mkdir(parents=True, exist_ok=True)

    for stem in STEMS:
        acts = cat["stems"][stem]["acts"]
        # backup once
        for act in ACTS:
            src = ROOT / f"img/a/{stem}_{act}.webp"
            bkp = BACKUP / f"{stem}_{act}.webp"
            if not bkp.exists():
                shutil.copy2(src, bkp)
            # always remaster FROM backup so re-runs are idempotent
            remaster_sheet(
                bkp,
                acts[act]["n"],
                acts[act]["d"],
                acts[act]["w"],
                acts[act]["h"],
                src,
            )

        por = ROOT / f"img/m/{stem}.png"
        pb = BACKUP / f"{stem}_portrait.png"
        if por.exists():
            if not pb.exists():
                shutil.copy2(por, pb)
            remaster_portrait(pb, por)

        preview_strip(stem, acts, "F remaster", OUT_PREVIEW / f"{stem}_after.png")
        # before from backup
        before_acts = {a: dict(acts[a]) for a in ACTS}
        # temporarily preview backup
        tmp = {}
        for act in ACTS:
            tmp[act] = ROOT / f"img/a/{stem}_{act}.webp"
            shutil.copy2(BACKUP / f"{stem}_{act}.webp", OUT_PREVIEW / f"_tmp_{stem}_{act}.webp")
        # build before strip manually
        from PIL import ImageDraw

        tiles = []
        for act in ACTS:
            m = acts[act]
            im = Image.open(BACKUP / f"{stem}_{act}.webp").convert("RGBA")
            cell = im.crop((0, 2 * m["h"], m["w"], 3 * m["h"]))
            bb = cell.split()[-1].getbbox()
            if bb:
                cell = cell.crop(bb)
            up = cell.resize((cell.width * 4, cell.height * 4), Image.Resampling.NEAREST)
            tile = Image.new("RGB", (160, 140), (40, 90, 50))
            tile.paste(up, ((160 - up.width) // 2, 28 + (100 - up.height) // 2), up)
            ImageDraw.Draw(tile).text((6, 6), act, fill=(255, 240, 180))
            tiles.append(tile)
        strip = Image.new("RGB", (20 + 165 * len(tiles), 170), (18, 18, 22))
        ImageDraw.Draw(strip).text((10, 6), f"GỐC {stem}", fill=(255, 220, 140))
        for i, t in enumerate(tiles):
            strip.paste(t, (10 + i * 165, 24))
        strip.save(OUT_PREVIEW / f"{stem}_before.png")
        print("ok", stem)

    # board
    from PIL import Image as PImage

    rows = []
    for stem in STEMS:
        b = PImage.open(OUT_PREVIEW / f"{stem}_before.png")
        a = PImage.open(OUT_PREVIEW / f"{stem}_after.png")
        row = PImage.new("RGB", (max(b.width, a.width), b.height + a.height + 8), (12, 12, 16))
        row.paste(b, (0, 0))
        row.paste(a, (0, b.height + 8))
        rows.append(row)
    W = max(r.width for r in rows)
    H = sum(r.height for r in rows) + 12 * (len(rows) - 1)
    board = PImage.new("RGB", (W, H), (12, 12, 16))
    y = 0
    for r in rows:
        board.paste(r, (0, y))
        y += r.height + 12
    board.save(OUT_PREVIEW / "00-before-after-board.png")
    print("done", OUT_PREVIEW)


if __name__ == "__main__":
    main()
