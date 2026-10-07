#!/usr/bin/env python3
"""Style A · Áo giao lĩnh thời Trần — remaster sheet pl_* (giữ n/d/w/h/ax/ay).

Chạy từ backup `assets/pack/nv-goc-jx/sheets_all/` → ghi `img/a/pl_*_*.webp` + portraits.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
BACKUP = ROOT / "assets/pack/nv-goc-jx/sheets_all"
META = ROOT / "assets/pack/nv-goc-jx/meta.json"
OUT_A = ROOT / "img" / "a"
OUT_PL = ROOT / "img" / "pl"
PREV = Path("/opt/cursor/artifacts/nv-style-a")
REVIEW = ROOT / "assets/pack/nv-goc-jx-review"

# Unique stems + aliases that share sheets
UNIQUE = ("shaolin", "tianwang", "tangmen", "wudu", "emei", "cuiyan", "gaibang", "wudang")
ALIASES = {"tianren": "shaolin", "kunlun": "wudang"}
ACTS = ("st", "run", "at", "hurt", "die")

# Target áo giao lĩnh hues (HSV 0–1): robe + accent sash
PALETTE = {
    "shaolin":  {"robe": (0.08, 0.55, 0.72), "accent": (0.10, 0.70, 0.90), "trim": (0.06, 0.35, 0.35)},  # saffron
    "tianwang": {"robe": (0.62, 0.45, 0.55), "accent": (0.10, 0.55, 0.75), "trim": (0.08, 0.40, 0.40)},  # indigo+bronze
    "tangmen":  {"robe": (0.35, 0.40, 0.45), "accent": (0.12, 0.50, 0.65), "trim": (0.30, 0.35, 0.30)},  # forest
    "wudu":     {"robe": (0.78, 0.40, 0.42), "accent": (0.30, 0.55, 0.55), "trim": (0.75, 0.35, 0.28)},  # purple
    "emei":     {"robe": (0.98, 0.65, 0.78), "accent": (0.08, 0.15, 0.92), "trim": (0.95, 0.40, 0.45)},  # son+trắng
    "cuiyan":   {"robe": (0.45, 0.45, 0.55), "accent": (0.12, 0.60, 0.85), "trim": (0.42, 0.35, 0.40)},  # thanh+vàng
    "gaibang":  {"robe": (0.08, 0.40, 0.55), "accent": (0.10, 0.20, 0.85), "trim": (0.07, 0.30, 0.35)},  # đất+kem
    "wudang":   {"robe": (0.62, 0.50, 0.48), "accent": (0.12, 0.70, 0.88), "trim": (0.60, 0.35, 0.30)},  # navy+vàng
}


def rgb_to_hsv(arr: np.ndarray):
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    df = mx - mn
    h = np.zeros_like(mx)
    mask = df != 0
    rmask = mask & (mx == r)
    gmask = mask & (mx == g)
    bmask = mask & (mx == b)
    h[rmask] = ((g[rmask] - b[rmask]) / df[rmask]) % 6
    h[gmask] = (b[gmask] - r[gmask]) / df[gmask] + 2
    h[bmask] = (r[bmask] - g[bmask]) / df[bmask] + 4
    h = h / 6.0
    s = np.where(mx == 0, 0, df / np.maximum(mx, 1e-8))
    return h, s, mx


def hsv_to_rgb(h, s, v):
    h = h % 1.0
    i = np.floor(h * 6).astype(np.int32)
    f = h * 6 - i
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    i = i % 6
    r = np.choose(i, [v, q, p, p, t, v])
    g = np.choose(i, [t, v, v, q, p, p])
    b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], axis=-1)


def remaster_cell(cell: Image.Image, fac: str) -> Image.Image:
    """Đổi tông áo nâu/vàng → áo giao lĩnh; giữ da, kim loại, vũ khí sáng."""
    if cell.mode != "RGBA":
        cell = cell.convert("RGBA")
    w, h = cell.size
    if cell.split()[-1].getbbox() is None:
        return cell

    up = cell.resize((w * 4, h * 4), Image.Resampling.NEAREST)
    a = np.asarray(up).astype(np.float32)
    rgb = a[..., :3] / 255.0
    alpha = a[..., 3]
    hh, ss, vv = rgb_to_hsv(rgb)

    # masks
    opaque = alpha > 40
    skin = opaque & (hh > 0.02) & (hh < 0.14) & (ss > 0.08) & (ss < 0.55) & (vv > 0.28) & (vv < 0.95)
    # metal / blade / glow
    metal = opaque & (((ss < 0.25) & (vv > 0.55)) | ((hh > 0.55) & (hh < 0.85) & (ss > 0.35) & (vv > 0.45)))
    # straw hat: light tan top region
    ys = np.linspace(0, 1, up.height, dtype=np.float32)[:, None]
    xs = np.linspace(0, 1, up.width, dtype=np.float32)[None, :]
    hat = opaque & (ys < 0.38) & (hh > 0.05) & (hh < 0.18) & (ss > 0.15) & (ss < 0.65) & (vv > 0.35)
    # brown / yellow clothing body
    brown = opaque & (hh > 0.02) & (hh < 0.16) & (ss > 0.12) & (vv > 0.12) & (vv < 0.85)
    yellow = opaque & (hh > 0.08) & (hh < 0.22) & (ss > 0.25) & (vv > 0.35)
    green = opaque & (hh > 0.22) & (hh < 0.45) & (ss > 0.20) & (vv > 0.15)
    dark_cloth = opaque & (vv < 0.35) & (ss < 0.45) & ~skin

    female = fac in ("emei", "cuiyan")
    cloth = (yellow | green | brown) if female else (brown | dark_cloth)
    cloth = cloth & ~skin & ~metal
    # sash band (mid body)
    sash = cloth & (ys > 0.42) & (ys < 0.58) & (ss > 0.10)
    trim = cloth & (((ys > 0.35) & (ys < 0.42)) | ((ys > 0.58) & (ys < 0.70)))

    pal = PALETTE[fac]
    rh, rs, rv = pal["robe"]
    ah, as_, av = pal["accent"]
    th, ts, tv = pal["trim"]

    h2, s2, v2 = hh.copy(), ss.copy(), vv.copy()

    # robe body → target hue, boost structure
    if cloth.any():
        cmin = float(vv[cloth].min())
        cmax = float(vv[cloth].max())
        v_n = (vv[cloth] - cmin) / max(1e-6, (cmax - cmin))
        h2[cloth] = rh + (hh[cloth] - 0.08) * 0.08
        s2[cloth] = np.clip(rs * 0.85 + ss[cloth] * 0.35, 0.15, 0.95)
        v2[cloth] = np.clip(rv * (0.55 + 0.55 * v_n), 0.12, 0.95)

    if sash.any():
        h2[sash] = ah
        s2[sash] = np.clip(as_ * 0.9 + ss[sash] * 0.2, 0.2, 1)
        v2[sash] = np.clip(np.maximum(vv[sash] * 1.15, av * 0.7), 0.2, 1)

    if trim.any():
        h2[trim] = th
        s2[trim] = np.clip(ts * 0.8 + ss[trim] * 0.3, 0.15, 0.9)
        v2[trim] = np.clip(vv[trim] * 0.95 + 0.05, 0.15, 0.9)

    # hat → darker bamboo / keep but cool slightly toward period non
    if hat.any() and not female:
        h2[hat] = 0.10
        s2[hat] = np.clip(ss[hat] * 0.85, 0.15, 0.7)
        v2[hat] = np.clip(vv[hat] * 0.92, 0.25, 0.85)

    # female hair keep dark
    if female:
        hair = opaque & (vv < 0.28) & (ss < 0.35) & (ys < 0.40)
        h2[hair], s2[hair], v2[hair] = hh[hair], ss[hair], vv[hair]

    keep = skin | metal
    h2[keep], s2[keep], v2[keep] = hh[keep], ss[keep], vv[keep]

    rgb2 = hsv_to_rgb(h2, np.clip(s2, 0, 1), np.clip(v2, 0, 1))
    out = np.dstack([rgb2 * 255.0, alpha]).astype(np.float32)

    # crisp outline like F
    mask = Image.fromarray(alpha.astype(np.uint8))
    edge = np.asarray(mask.filter(ImageFilter.FIND_EDGES)).astype(np.float32) / 255.0
    edge = np.clip(edge * 1.6, 0, 1)
    out[..., :3] *= (1.0 - edge[..., None] * 0.28)
    alpha2 = np.where(alpha < 16, 0, alpha)
    alpha2 = np.where((alpha2 > 0) & (alpha2 < 85), np.minimum(255, alpha2 * 1.3), alpha2)
    out[..., 3] = alpha2

    up2 = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")
    up2 = ImageEnhance.Contrast(up2).enhance(1.12)
    up2 = ImageEnhance.Color(up2).enhance(1.10)
    up2 = ImageEnhance.Sharpness(up2).enhance(1.25)
    return up2.resize((w, h), Image.Resampling.NEAREST)


def remaster_sheet(src: Path, n: int, d: int, w: int, h: int, fac: str, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sw, sh = im.size
    # tolerate 1–4px sheet slack
    for di in range(d):
        for fi in range(n):
            x0, y0 = fi * w, di * h
            if x0 >= sw or y0 >= sh:
                continue
            cell = im.crop((x0, y0, min(x0 + w, sw), min(y0 + h, sh)))
            if cell.size != (w, h):
                pad = Image.new("RGBA", (w, h), (0, 0, 0, 0))
                pad.paste(cell, (0, 0))
                cell = pad
            if cell.split()[-1].getbbox() is None:
                continue
            out.paste(remaster_cell(cell, fac), (x0, y0))
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    out.save(dst, "WEBP", quality=95, method=4)


def remaster_portrait(src: Path, fac: str, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    out = remaster_cell(im, fac)
    if dst.exists():
        dst.unlink()
    out.save(dst, "PNG")


def preview_board(meta: dict) -> None:
    PREV.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
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
    cell_w, cell_h = 150, 170
    pad, lh = 10, 36
    n = len(UNIQUE)
    W = pad + n * (cell_w + pad)
    H = 40 + pad + 2 * (cell_h + lh + pad)
    board = Image.new("RGB", (W, H), (22, 24, 30))
    draw = ImageDraw.Draw(board)
    draw.text((pad, 10), "Style A ap dung — tren: GOC · duoi: A ao giao linh", fill=(230, 210, 150), font=font_t)

    for i, fac in enumerate(UNIQUE):
        m = meta[fac]["st"]
        w, h = m["w"], m["h"]
        for row, src_dir, tag in (
            (0, BACKUP, "goc"),
            (1, OUT_A, "A"),
        ):
            path = (src_dir / f"pl_{fac}_st.webp") if src_dir == BACKUP else (OUT_A / f"pl_{fac}_st.webp")
            im = Image.open(path).convert("RGBA")
            # front-ish dir 0 or 4
            di = 0 if fac in ("shaolin", "emei", "wudang") else min(4, m["d"] - 1)
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

    board.save(PREV / "before-after-A.png")
    board.save(REVIEW / "applied-A-before-after.png")
    board.save(Path("/opt/cursor/artifacts/applied-A-before-after.png"))
    print("preview", board.size)


def main() -> None:
    meta = json.loads(META.read_text())
    PREV.mkdir(parents=True, exist_ok=True)

    for fac in UNIQUE:
        acts = meta[fac]
        for act in ACTS:
            m = acts[act]
            src = BACKUP / f"pl_{fac}_{act}.webp"
            dst = OUT_A / f"pl_{fac}_{act}.webp"
            remaster_sheet(src, m["n"], m["d"], m["w"], m["h"], fac, dst)
        por_src = ROOT / "assets/pack/nv-goc-jx/portraits" / f"{fac}.png"
        if not por_src.exists():
            por_src = OUT_PL / f"{fac}.png"
        # restore portrait from git? use backup portraits
        remaster_portrait(por_src, fac, OUT_PL / f"{fac}.png")
        print("ok", fac)

    # aliases: copy sheets + portraits
    for alias, src_fac in ALIASES.items():
        for act in ACTS:
            shutil.copy2(OUT_A / f"pl_{src_fac}_{act}.webp", OUT_A / f"pl_{alias}_{act}.webp")
        shutil.copy2(OUT_PL / f"{src_fac}.png", OUT_PL / f"{alias}.png")
        print("alias", alias, "<-", src_fac)

    preview_board(meta)
    print("Style A done")


if __name__ == "__main__":
    main()
