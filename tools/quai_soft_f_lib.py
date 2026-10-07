#!/usr/bin/env python3
"""Soft+F shared: Mythic Soft rồi Pixel remaster — giữ lưới anim."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

from quai_remaster_jf import (  # noqa: E402
    ACTS,
    BACKUP,
    CATALOG,
    ROOT,
    pixel_remaster_cell,
)

# (glow RGB, warm, cool, sat, contrast) — cùng palette map2
COLORS = {
    "Ám": ((100, 50, 240), 0.78, 1.32, 1.30, 1.30),
    "Hỏa": ((255, 95, 15), 1.38, 0.68, 1.50, 1.28),
    "Lôi": ((45, 220, 255), 0.82, 1.38, 1.45, 1.25),
    "Độc": ((80, 230, 70), 0.88, 1.05, 1.45, 1.25),
    "ĐộcTím": ((185, 55, 255), 0.90, 1.22, 1.45, 1.25),
    "Băng": ((140, 210, 255), 0.75, 1.35, 1.20, 1.22),
    "Kim": ((255, 200, 60), 1.20, 0.85, 1.40, 1.25),
    "Huyết": ((220, 30, 70), 1.25, 0.80, 1.45, 1.28),
    "U Minh": ((60, 40, 90), 0.70, 1.20, 1.15, 1.35),
    "Hồng Ngọc": ((255, 90, 160), 1.15, 1.05, 1.40, 1.22),
    "Lục Bảo": ((40, 180, 140), 0.90, 1.10, 1.35, 1.25),
}


def style_soft(cell: Image.Image, glow, warm, cool, sat, contrast) -> Image.Image:
    """Mythic nhẹ — aura mỏng, còn màu gốc nhiều."""
    del warm, cool, sat, contrast  # Soft dùng glow chính; giữ chữ ký style map2
    w, h = cell.size
    up = cell.resize((w * 4, h * 4), Image.Resampling.NEAREST)
    up = ImageEnhance.Contrast(up).enhance(1.12)
    up = ImageEnhance.Color(up).enhance(1.15)
    a = np.asarray(up).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    tint = np.array(glow, dtype=np.float32)
    gray = rgb.mean(axis=2, keepdims=True)
    rgb = rgb * 0.72 + gray * 0.08 + tint * 0.20
    mask = Image.fromarray(np.clip(alpha, 0, 255).astype(np.uint8))
    edge = np.asarray(mask.filter(ImageFilter.FIND_EDGES)).astype(np.float32) / 255.0
    edge = np.clip(edge * 1.8, 0, 1)
    dil = np.asarray(mask.filter(ImageFilter.MaxFilter(7))).astype(np.float32)
    ring = (dil > 40) & (alpha <= 40)
    for i in range(3):
        rgb[..., i] = np.where(
            edge > 0.05,
            np.clip(rgb[..., i] * 0.85 + glow[i] * edge * 0.7, 0, 255),
            rgb[..., i],
        )
    out_a = alpha.copy()
    for i in range(3):
        rgb[..., i] = np.where(ring, glow[i] * 0.45, rgb[..., i])
    out_a = np.where(ring, np.maximum(out_a, 100), out_a)
    out = np.dstack([rgb.clip(0, 255), out_a.clip(0, 255)]).astype(np.uint8)
    return Image.fromarray(out, "RGBA").resize((w, h), Image.Resampling.NEAREST)


def soft_f_cell(cell: Image.Image, style) -> Image.Image:
    """style = (label, glow, warm, cool, sat, contrast)."""
    _, glow, warm, cool, sat, contrast = style
    return pixel_remaster_cell(style_soft(cell, glow, warm, cool, sat, contrast))


def color_style(label: str, color_name: str) -> tuple:
    glow, warm, cool, sat, contrast = COLORS[color_name]
    return (f"{label} · {color_name} Soft+F", glow, warm, cool, sat, contrast)


def remaster_sheet_soft_f(src: Path, n: int, d: int, cw: int, ch: int, dst: Path, style) -> None:
    im = Image.open(src).convert("RGBA")
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    for di in range(d):
        for fi in range(n):
            x0, y0 = fi * cw, di * ch
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
            out.paste(soft_f_cell(cell, style), (x0, y0))
    if dst.exists():
        dst.unlink()
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, "WEBP", quality=95, method=4)


def remaster_portrait_soft_f(src: Path, dst: Path, style) -> None:
    out = soft_f_cell(Image.open(src).convert("RGBA"), style)
    if dst.exists():
        dst.unlink()
    out.save(dst, "PNG")


def ensure_backup(stem: str, acts: dict) -> None:
    BACKUP.mkdir(parents=True, exist_ok=True)
    for act in ACTS:
        src = ROOT / f"img/a/{stem}_{act}.webp"
        bkp = BACKUP / f"{stem}_{act}.webp"
        if src.exists() and not bkp.exists():
            shutil.copy2(src, bkp)
    por = ROOT / f"img/m/{stem}.png"
    pb = BACKUP / f"{stem}_portrait.png"
    if por.exists() and not pb.exists():
        shutil.copy2(por, pb)


def apply_soft_f(stem: str, style, cat: dict | None = None) -> None:
    if cat is None:
        cat = json.loads(CATALOG.read_text())
    acts = cat["stems"][stem]["acts"]
    ensure_backup(stem, acts)
    for act in ACTS:
        bkp = BACKUP / f"{stem}_{act}.webp"
        dst = ROOT / f"img/a/{stem}_{act}.webp"
        remaster_sheet_soft_f(
            bkp, acts[act]["n"], acts[act]["d"], acts[act]["w"], acts[act]["h"], dst, style
        )
        pack = ROOT / f"assets/pack/quai/stems/{stem}/{act}.webp"
        if pack.parent.exists():
            if pack.exists():
                pack.unlink()
            shutil.copy2(dst, pack)
    pb = BACKUP / f"{stem}_portrait.png"
    if pb.exists():
        remaster_portrait_soft_f(pb, ROOT / f"img/m/{stem}.png", style)


def st_cell_from(path: Path, meta: dict) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    cell = im.crop(
        (
            0,
            min(2 * meta["h"], max(0, im.height - 1)),
            min(meta["w"], im.width),
            min(3 * meta["h"], im.height),
        )
    )
    bb = cell.split()[-1].getbbox()
    if bb:
        cell = cell.crop(bb)
    return cell
