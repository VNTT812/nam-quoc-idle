#!/usr/bin/env python3
"""Rebuild sâu Style A · Áo giao lĩnh — thay form áo (không chỉ nhuộm).

Dùng base AI (front/back) map vào từng cell theo pose/neo chân của sheet gốc.
Giữ n/d/w/h/ax/ay. Nguồn gốc: assets/pack/nv-goc-jx/sheets_all/
"""
from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
BACKUP = ROOT / "assets/pack/nv-goc-jx/sheets_all"
META = ROOT / "assets/pack/nv-goc-jx/meta.json"
BASE_DIR = ROOT / "assets/pack/nv-goc-jx-review/rebuildA-bases"
OUT_A = ROOT / "img" / "a"
OUT_PL = ROOT / "img" / "pl"
REVIEW = ROOT / "assets/pack/nv-goc-jx-review"
PREV = Path("/opt/cursor/artifacts")

UNIQUE = ("shaolin", "tianwang", "tangmen", "wudu", "emei", "cuiyan", "gaibang", "wudang")
ALIASES = {"tianren": "shaolin", "kunlun": "wudang"}
ACTS = ("st", "run", "at", "hurt", "die")

# which dirs use back base (JX often 0=SE front … varies; we score by hat/skin)
BACK_HINT = {
    "shaolin": {3, 4, 5},
    "tianwang": {3, 4, 5},
    "tangmen": {2, 3, 4, 5},
    "wudu": {3, 4, 5},
    "emei": {3, 4, 5},
    "cuiyan": {2, 3, 4, 5},
    "gaibang": {3, 4, 5},
    "wudang": {3, 4, 5},
}


def _largest_component(alpha: np.ndarray) -> np.ndarray:
    """Giữ blob lớn nhất — bỏ cánh hoa / hạt AI rời."""
    from collections import deque
    h, w = alpha.shape
    vis = np.zeros((h, w), dtype=np.uint8)
    best = None
    best_n = 0
    for y in range(h):
        for x in range(w):
            if alpha[y, x] < 40 or vis[y, x]:
                continue
            q = deque([(y, x)])
            vis[y, x] = 1
            cells = [(y, x)]
            while q:
                cy, cx = q.popleft()
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and not vis[ny, nx] and alpha[ny, nx] >= 40:
                        vis[ny, nx] = 1
                        q.append((ny, nx))
                        cells.append((ny, nx))
            if len(cells) > best_n:
                best_n = len(cells)
                best = cells
    mask = np.zeros((h, w), dtype=bool)
    if best:
        for y, x in best:
            mask[y, x] = True
    return mask


def extract_sprite(path: Path) -> Image.Image:
    """Cắt nhân vật khỏi nền tối / xám AI, bỏ hạt rời."""
    im = Image.open(path).convert("RGBA")
    # downscale AI art early for speed + cleaner pixels
    im.thumbnail((384, 384), Image.Resampling.LANCZOS)
    a = np.asarray(im)
    rgb = a[..., :3].astype(np.float32)
    mx = rgb.max(axis=-1)
    mn = rgb.min(axis=-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    dark = (mx < 70) & (sat < 0.22)
    mid_gray = (mx < 100) & (sat < 0.14)
    # pale petal-ish blobs (pink/cream small) far from center handled by component filter
    bg = dark | mid_gray
    alpha2 = np.where(bg, 0, 255).astype(np.uint8)
    keep = _largest_component(alpha2)
    alpha2 = np.where(keep, alpha2, 0).astype(np.uint8)
    out = np.dstack([a[..., :3], alpha2])
    im2 = Image.fromarray(out, "RGBA")
    bb = im2.split()[-1].getbbox()
    if not bb:
        return im2
    return im2.crop(bb)


def content_bbox(im: Image.Image):
    bb = im.split()[-1].getbbox()
    return bb


def fit_to_cell(sprite: Image.Image, cell_w: int, cell_h: int, foot_x_ratio: float = 0.5) -> Image.Image:
    """Scale sprite vào cell, neo chân đáy — pixelate 2 bước cho nét game."""
    sp = sprite.copy()
    bb = content_bbox(sp)
    if not bb:
        return Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
    sp = sp.crop(bb)
    max_h = max(8, int(cell_h * 0.94))
    max_w = max(8, int(cell_w * 0.96))
    scale = min(max_w / sp.width, max_h / sp.height)
    nw, nh = max(1, int(sp.width * scale)), max(1, int(sp.height * scale))
    mask = sp.split()[-1].resize((nw, nh), Image.Resampling.NEAREST)
    rgb = sp.convert("RGB").resize((nw, nh), Image.Resampling.LANCZOS)
    rgb = ImageOps.posterize(rgb, 5)
    sp = rgb.convert("RGBA")
    sp.putalpha(mask)
    canvas = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
    x = int(cell_w * foot_x_ratio - nw * 0.5)
    y = cell_h - nh - max(1, cell_h // 40)
    x = max(-nw // 4, min(cell_w - nw * 3 // 4, x))
    canvas.paste(sp, (x, y), sp)
    return canvas


def motion_delta(orig_cell: Image.Image, idle_cell: Image.Image):
    """Offset tâm khối so với idle → chuyển động frame."""
    def center(im):
        a = np.asarray(im.split()[-1])
        ys, xs = np.where(a > 40)
        if len(xs) == 0:
            return 0.0, 0.0
        return float(xs.mean()), float(ys.mean())
    cx0, cy0 = center(idle_cell)
    cx1, cy1 = center(orig_cell)
    return cx1 - cx0, cy1 - cy0


def shift(im: Image.Image, dx: float, dy: float) -> Image.Image:
    if abs(dx) < 0.2 and abs(dy) < 0.2:
        return im
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    out.paste(im, (int(round(dx)), int(round(dy))), im)
    return out


def lean(im: Image.Image, amount: float) -> Image.Image:
    """Nghiêng nhẹ khi chạy/đánh (shear ngang)."""
    if abs(amount) < 0.01:
        return im
    w, h = im.size
    # affine: x' = x + amount*(y-h)
    return im.transform(
        (w, h),
        Image.Transform.AFFINE,
        (1, amount, -amount * h * 0.5, 0, 1, 0),
        resample=Image.Resampling.BILINEAR,
    )


def paste_weapon_from_orig(base: Image.Image, orig: Image.Image) -> Image.Image:
    """Ghép lại lưỡi kiếm / ánh tím từ cell gốc nếu base thiếu."""
    o = np.asarray(orig.convert("RGBA")).astype(np.float32)
    rgb, alpha = o[..., :3] / 255.0, o[..., 3]
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    # metal / glow / bright blade
    weapon = (alpha > 60) & (
        ((sat < 0.28) & (mx > 0.55))
        | ((sat > 0.35) & (mx > 0.45) & ((rgb[..., 2] > rgb[..., 0] * 1.15) | (rgb[..., 0] > 0.7)))
    )
    if weapon.sum() < 12:
        return base
    # only outer fringe-ish: prefer pixels near edge of opaque
    mask = Image.fromarray((weapon * 255).astype(np.uint8))
    # dilate slightly
    mask = mask.filter(ImageFilter.MaxFilter(3))
    wpn = orig.copy()
    wpn.putalpha(mask)
    out = base.copy()
    out.alpha_composite(wpn)
    return out


def pick_base(bases: dict, fac: str, di: int, d: int) -> Image.Image:
    use_back = di in BACK_HINT.get(fac, set())
    sp = bases["back"] if use_back and bases.get("back") is not None else bases["front"]
    # flip for left-facing dirs (often 5,6,7)
    if di in (5, 6, 7) or (di >= d // 2 + 1 and not use_back):
        # heuristic flip for westward
        if di in (5, 6, 7):
            sp = ImageOps.mirror(sp)
    return sp


def rebuild_sheet(fac: str, act: str, meta_act: dict, bases: dict, dst: Path) -> None:
    n, d, w, h = meta_act["n"], meta_act["d"], meta_act["w"], meta_act["h"]
    src = BACKUP / f"pl_{fac}_{act}.webp"
    orig_sheet = Image.open(src).convert("RGBA")
    out = Image.new("RGBA", orig_sheet.size, (0, 0, 0, 0))
    sw, sh = orig_sheet.size

    # idle reference row dir0 frame0 for motion
    idle_refs = {}
    for di in range(d):
        idle_refs[di] = orig_sheet.crop((0, di * h, min(w, sw), min(di * h + h, sh)))
        if idle_refs[di].size != (w, h):
            pad = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            pad.paste(idle_refs[di], (0, 0))
            idle_refs[di] = pad

    for di in range(d):
        base_sp = pick_base(bases, fac, di, d)
        for fi in range(n):
            x0, y0 = fi * w, di * h
            if x0 >= sw or y0 >= sh:
                continue
            oc = orig_sheet.crop((x0, y0, min(x0 + w, sw), min(y0 + h, sh)))
            if oc.size != (w, h):
                pad = Image.new("RGBA", (w, h), (0, 0, 0, 0))
                pad.paste(oc, (0, 0))
                oc = pad
            if oc.split()[-1].getbbox() is None:
                continue

            # foot x from original content
            bb = oc.split()[-1].getbbox()
            foot_x = ((bb[0] + bb[2]) / 2) / w if bb else 0.5
            cell = fit_to_cell(base_sp, w, h, foot_x_ratio=foot_x)

            dx, dy = motion_delta(oc, idle_refs[di])
            # damp motion so robe stays readable
            cell = shift(cell, dx * 0.65, dy * 0.55)

            if act == "run":
                cell = lean(cell, 0.04 * math.sin(fi / max(1, n) * math.pi * 2))
                cell = shift(cell, 0, -1 if fi % 2 == 0 else 1)
            elif act == "at":
                cell = lean(cell, 0.06 * math.sin(fi / max(1, n - 1) * math.pi))
                cell = shift(cell, 1.2 * math.sin(fi / max(1, n - 1) * math.pi), -0.5)
            elif act == "hurt":
                cell = shift(cell, -1.5 * fi, 0.5 * fi)
            elif act == "die":
                # flatten slightly
                cell = lean(cell, 0.08 * fi / max(1, n - 1))
                cell = shift(cell, 0, 1.2 * fi)

            # chỉ ghép lưỡi sáng ở frame đánh — tránh hạt bẩn idle
            if act == "at" and fi >= n // 3:
                cell = paste_weapon_from_orig(cell, oc)

            cell = ImageEnhance.Sharpness(cell).enhance(1.2)
            out.paste(cell, (x0, y0), cell)

    if dst.exists():
        dst.unlink()
    out.save(dst, "WEBP", quality=95, method=4)


def make_portrait(fac: str, bases: dict, sz: tuple[int, int], dst: Path) -> None:
    """Portrait từ base front, fit kích thước gốc."""
    # use original portrait size
    ow, oh = sz
    cell = fit_to_cell(bases["front"], ow, oh, 0.5)
    if dst.exists():
        dst.unlink()
    cell.save(dst, "PNG")


def preview(meta: dict) -> None:
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
        font_t = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    except Exception:
        font = font_t = ImageFont.load_default()
    labels = {
        "shaolin": "Thieu Lam", "tianwang": "Thien Vuong", "tangmen": "Duong Mon",
        "wudu": "Ngu Doc", "emei": "Nga My", "cuiyan": "Thuy Yen",
        "gaibang": "Cai Bang", "wudang": "Vo Dang",
    }
    cell_w, cell_h, pad, lh = 150, 170, 10, 36
    n = len(UNIQUE)
    W = pad + n * (cell_w + pad)
    H = 40 + pad + 2 * (cell_h + lh + pad)
    board = Image.new("RGB", (W, H), (22, 24, 30))
    draw = ImageDraw.Draw(board)
    draw.text((pad, 10), "Rebuild SAU Style A — tren: GOC · duoi: A ao giao linh (form moi)", fill=(230, 210, 150), font=font_t)
    for i, fac in enumerate(UNIQUE):
        m = meta[fac]["st"]
        w, h = m["w"], m["h"]
        for row, folder, tag in ((0, BACKUP, "goc"), (1, OUT_A, "A+")):
            path = folder / f"pl_{fac}_st.webp"
            im = Image.open(path).convert("RGBA")
            di = 0
            cell = im.crop((0, di * h, w, di * h + h))
            bb = cell.split()[-1].getbbox()
            if bb:
                cell = cell.crop(bb)
            sc = max(1, int(min((cell_w - 24) / max(1, cell.width), (cell_h - 24) / max(1, cell.height))))
            big = cell.resize((cell.width * sc, cell.height * sc), Image.Resampling.NEAREST)
            x0 = pad + i * (cell_w + pad)
            y0 = 40 + pad + row * (cell_h + lh + pad)
            draw.rectangle([x0, y0, x0 + cell_w - 1, y0 + cell_h - 1], fill=(40, 42, 50), outline=(70, 72, 80))
            board.paste(big, (x0 + (cell_w - big.width) // 2, y0 + (cell_h - big.height) // 2), big)
            draw.text((x0 + 4, y0 + cell_h + 4), f"{tag} · {labels[fac]}", fill=(190, 195, 205), font=font)
    board.save(REVIEW / "applied-A-deep-before-after.png")
    board.save(PREV / "applied-A-deep-before-after.png")
    print("preview", board.size)


def load_bases(fac: str) -> dict:
    front_p = BASE_DIR / f"rebuildA-{fac}.jpg"
    if not front_p.exists():
        front_p = BASE_DIR / f"rebuildA-{fac}.png"
    back_p = BASE_DIR / f"rebuildA-{fac}-back.jpg"
    if not back_p.exists():
        back_p = BASE_DIR / f"rebuildA-{fac}-back.png"
    front = extract_sprite(front_p)
    back = extract_sprite(back_p) if back_p.exists() else None
    # fallback back: mirror front (weak but ok)
    if back is None:
        # reuse other backs
        for donor in ("wudang", "tianwang", "emei"):
            dp = BASE_DIR / f"rebuildA-{donor}-back.jpg"
            if dp.exists() and ((fac in ("emei", "cuiyan") and donor == "emei") or (fac not in ("emei", "cuiyan") and donor != "emei")):
                back = extract_sprite(dp)
                break
    if back is None:
        back = ImageOps.mirror(front)
    return {"front": front, "back": back}


def main() -> None:
    meta = json.loads(META.read_text())
    for fac in UNIQUE:
        bases = load_bases(fac)
        # save cleaned bases for debug
        bases["front"].save(BASE_DIR / f"{fac}_front_cut.png")
        bases["back"].save(BASE_DIR / f"{fac}_back_cut.png")
        for act in ACTS:
            rebuild_sheet(fac, act, meta[fac][act], bases, OUT_A / f"pl_{fac}_{act}.webp")
        # portrait size from backup portrait
        por = Image.open(ROOT / "assets/pack/nv-goc-jx/portraits" / f"{fac}.png")
        make_portrait(fac, bases, por.size, OUT_PL / f"{fac}.png")
        print("rebuilt", fac)

    for alias, src in ALIASES.items():
        for act in ACTS:
            shutil.copy2(OUT_A / f"pl_{src}_{act}.webp", OUT_A / f"pl_{alias}_{act}.webp")
        shutil.copy2(OUT_PL / f"{src}.png", OUT_PL / f"{alias}.png")
        print("alias", alias, "<-", src)

    preview(meta)
    print("deep Style A rebuild done")


if __name__ == "__main__":
    main()
