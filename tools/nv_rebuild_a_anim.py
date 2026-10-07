#!/usr/bin/env python3
"""Vẽ lại từng frame run/at Style A từ pose strip (run · windup · strike).

Không lean/shift idle. Giữ n/d/w/h. st/hurt/die giữ bản rebuild sâu hiện tại.
"""
from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
META = ROOT / "assets/pack/nv-goc-jx/meta.json"
POSE_DIR = ROOT / "assets/pack/nv-goc-jx-review/rebuildA-poses"
BASE_DIR = ROOT / "assets/pack/nv-goc-jx-review/rebuildA-bases"
OUT_A = ROOT / "img" / "a"
OUT_PL = ROOT / "img" / "pl"
REVIEW = ROOT / "assets/pack/nv-goc-jx-review"
PREV = Path("/opt/cursor/artifacts")
BACKUP = ROOT / "assets/pack/nv-goc-jx/sheets_all"

UNIQUE = ("shaolin", "tianwang", "tangmen", "wudu", "emei", "cuiyan", "gaibang", "wudang")
ALIASES = {"tianren": "shaolin", "kunlun": "wudang"}
BACK_HINT = {
    "shaolin": {3, 4, 5}, "tianwang": {3, 4, 5}, "tangmen": {2, 3, 4, 5},
    "wudu": {3, 4, 5}, "emei": {3, 4, 5}, "cuiyan": {2, 3, 4, 5},
    "gaibang": {3, 4, 5}, "wudang": {3, 4, 5},
}


def extract_sprite(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    im.thumbnail((420, 420), Image.Resampling.LANCZOS)
    a = np.asarray(im)
    rgb = a[..., :3].astype(np.float32)
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    bg = ((mx < 72) & (sat < 0.22)) | ((mx < 105) & (sat < 0.14))
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # largest component
    from collections import deque
    h, w = alpha.shape
    vis = np.zeros((h, w), np.uint8)
    best, best_n = None, 0
    for y in range(h):
        for x in range(w):
            if alpha[y, x] < 40 or vis[y, x]:
                continue
            q = deque([(y, x)]); vis[y, x] = 1; cells = [(y, x)]
            while q:
                cy, cx = q.popleft()
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and not vis[ny, nx] and alpha[ny, nx] >= 40:
                        vis[ny, nx] = 1; q.append((ny, nx)); cells.append((ny, nx))
            if len(cells) > best_n:
                best_n = len(cells); best = cells
    mask = np.zeros((h, w), bool)
    if best:
        for y, x in best:
            mask[y, x] = True
    alpha = np.where(mask, alpha, 0).astype(np.uint8)
    out = Image.fromarray(np.dstack([a[..., :3], alpha]), "RGBA")
    bb = out.split()[-1].getbbox()
    return out.crop(bb) if bb else out


def split_strip(path: Path) -> dict[str, Image.Image]:
    """Tách strip 3 pose: run | windup | strike theo cột alpha."""
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im)
    rgb = a[..., :3].astype(np.float32)
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    fg = ~(((mx < 72) & (sat < 0.22)) | ((mx < 105) & (sat < 0.14)))
    col = fg.any(axis=0)
    # find gaps between blobs
    stretches = []
    i, n = 0, len(col)
    while i < n:
        if not col[i]:
            i += 1; continue
        j = i
        while j < n and col[j]:
            j += 1
        stretches.append((i, j))
        i = j
    # merge tiny noise
    stretches = [(a, b) for a, b in stretches if b - a > 20]
    if len(stretches) < 3:
        # equal thirds fallback
        w = im.width
        stretches = [(0, w // 3), (w // 3, 2 * w // 3), (2 * w // 3, w)]
    # take 3 largest / leftmost groups
    if len(stretches) > 3:
        # cluster into 3 by x-center
        stretches = sorted(stretches, key=lambda t: t[0])[:3] if len(stretches) == 3 else sorted(stretches, key=lambda t: -(t[1] - t[0]))[:3]
        stretches = sorted(stretches, key=lambda t: t[0])
    while len(stretches) < 3:
        stretches.append(stretches[-1])
    keys = ("run", "windup", "strike")
    out = {}
    for k, (x0, x1) in zip(keys, stretches):
        pad = 8
        crop = im.crop((max(0, x0 - pad), 0, min(im.width, x1 + pad), im.height))
        out[k] = extract_sprite(crop)
        out[k].save(POSE_DIR / f"_cut_{path.stem}_{k}.png")
    return out


def fit_to_cell(sprite: Image.Image, cell_w: int, cell_h: int, foot_x: float = 0.5) -> Image.Image:
    sp = sprite.copy()
    bb = sp.split()[-1].getbbox()
    if not bb:
        return Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
    sp = sp.crop(bb)
    max_h = max(8, int(cell_h * 0.94))
    max_w = max(8, int(cell_w * 0.96))
    scale = min(max_w / sp.width, max_h / sp.height)
    nw, nh = max(1, int(sp.width * scale)), max(1, int(sp.height * scale))
    mask = sp.split()[-1].resize((nw, nh), Image.Resampling.NEAREST)
    rgb = ImageOps.posterize(sp.convert("RGB").resize((nw, nh), Image.Resampling.LANCZOS), 5)
    sp = rgb.convert("RGBA"); sp.putalpha(mask)
    canvas = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
    x = int(cell_w * foot_x - nw * 0.5)
    y = cell_h - nh - max(1, cell_h // 40)
    x = max(-nw // 4, min(cell_w - nw * 3 // 4, x))
    canvas.paste(sp, (x, y), sp)
    return canvas


def lerp_pose(a: Image.Image, b: Image.Image, t: float) -> Image.Image:
    """Blend 2 pose (cùng canvas sau khi fit sẽ blend ở cell-level)."""
    t = max(0.0, min(1.0, t))
    if t <= 0: return a
    if t >= 1: return b
    return Image.blend(a.convert("RGBA"), b.convert("RGBA"), t)


def foot_x_from_orig(orig: Image.Image) -> float:
    bb = orig.split()[-1].getbbox()
    if not bb:
        return 0.5
    return ((bb[0] + bb[2]) / 2) / max(1, orig.width)


def pick_set(front: dict, back: dict | None, di: int, fac: str) -> dict:
    use_back = di in BACK_HINT.get(fac, set()) and back
    poses = back if use_back else front
    # flip westward
    if di in (5, 6, 7):
        return {k: ImageOps.mirror(v) for k, v in poses.items()}
    return poses


def rebuild_run(fac: str, meta_act: dict, front: dict, back: dict | None, idle_front: Image.Image, idle_back: Image.Image | None, dst: Path) -> None:
    n, d, w, h = meta_act["n"], meta_act["d"], meta_act["w"], meta_act["h"]
    # use original sheet only for foot anchors
    orig = Image.open(BACKUP / f"pl_{fac}_run.webp").convert("RGBA")
    out = Image.new("RGBA", (w * n, h * d) if abs(orig.width - w * n) > 8 else orig.size, (0, 0, 0, 0))
    # prefer exact orig size
    out = Image.new("RGBA", orig.size, (0, 0, 0, 0))
    sw, sh = orig.size
    for di in range(d):
        poses = pick_set(front, back, di, fac)
        idle = idle_back if (di in BACK_HINT.get(fac, set()) and idle_back) else idle_front
        if di in (5, 6, 7):
            idle = ImageOps.mirror(idle)
        run = poses["run"]
        # opposite stride: mirror run for alternate feel when no 2nd run pose
        run2 = ImageOps.mirror(run) if di not in (5, 6, 7) else run
        for fi in range(n):
            x0, y0 = fi * w, di * h
            if x0 >= sw or y0 >= sh:
                continue
            oc = orig.crop((x0, y0, min(x0 + w, sw), min(y0 + h, sh)))
            if oc.size != (w, h):
                pad = Image.new("RGBA", (w, h), (0, 0, 0, 0)); pad.paste(oc, (0, 0)); oc = pad
            if oc.split()[-1].getbbox() is None:
                continue
            fx = foot_x_from_orig(oc)
            # cycle: contact → mid → opposite → mid …
            phase = fi / max(1, n)
            # 0 idle-contact lean to run, 0.25 run, 0.5 run2, 0.75 run
            if phase < 0.2:
                sp = lerp_pose(fit_to_cell(idle, w, h, fx), fit_to_cell(run, w, h, fx), phase / 0.2)
            elif phase < 0.5:
                sp = fit_to_cell(run, w, h, fx)
                # bob
                sp2 = Image.new("RGBA", (w, h), (0, 0, 0, 0))
                sp2.paste(sp, (0, -1 if fi % 2 == 0 else 0), sp); sp = sp2
            elif phase < 0.8:
                sp = fit_to_cell(run2, w, h, fx)
                sp2 = Image.new("RGBA", (w, h), (0, 0, 0, 0))
                sp2.paste(sp, (0, -1 if fi % 2 else 0), sp); sp = sp2
            else:
                sp = lerp_pose(fit_to_cell(run2, w, h, fx), fit_to_cell(idle, w, h, fx), (phase - 0.8) / 0.2)
            sp = ImageEnhance.Sharpness(sp).enhance(1.15)
            out.paste(sp, (x0, y0), sp)
    if dst.exists():
        dst.unlink()
    out.save(dst, "WEBP", quality=95, method=4)


def rebuild_at(fac: str, meta_act: dict, front: dict, back: dict | None, idle_front: Image.Image, idle_back: Image.Image | None, dst: Path) -> None:
    n, d, w, h = meta_act["n"], meta_act["d"], meta_act["w"], meta_act["h"]
    orig = Image.open(BACKUP / f"pl_{fac}_at.webp").convert("RGBA")
    out = Image.new("RGBA", orig.size, (0, 0, 0, 0))
    sw, sh = orig.size
    for di in range(d):
        poses = pick_set(front, back, di, fac)
        idle = idle_back if (di in BACK_HINT.get(fac, set()) and idle_back) else idle_front
        if di in (5, 6, 7):
            idle = ImageOps.mirror(idle)
        windup, strike = poses["windup"], poses["strike"]
        for fi in range(n):
            x0, y0 = fi * w, di * h
            if x0 >= sw or y0 >= sh:
                continue
            oc = orig.crop((x0, y0, min(x0 + w, sw), min(y0 + h, sh)))
            if oc.size != (w, h):
                pad = Image.new("RGBA", (w, h), (0, 0, 0, 0)); pad.paste(oc, (0, 0)); oc = pad
            if oc.split()[-1].getbbox() is None:
                continue
            fx = foot_x_from_orig(oc)
            # timeline: idle→windup→strike→hold→recovery
            t = fi / max(1, n - 1)
            if t < 0.2:
                sp = lerp_pose(fit_to_cell(idle, w, h, fx), fit_to_cell(windup, w, h, fx), t / 0.2)
            elif t < 0.45:
                sp = lerp_pose(fit_to_cell(windup, w, h, fx), fit_to_cell(strike, w, h, fx), (t - 0.2) / 0.25)
            elif t < 0.65:
                sp = fit_to_cell(strike, w, h, fx)
                # impact nudge
                nudge = Image.new("RGBA", (w, h), (0, 0, 0, 0))
                nudge.paste(sp, (int(2 * math.sin((t - 0.45) * 20)), 0), sp); sp = nudge
            else:
                sp = lerp_pose(fit_to_cell(strike, w, h, fx), fit_to_cell(idle, w, h, fx), (t - 0.65) / 0.35)
            sp = ImageEnhance.Sharpness(sp).enhance(1.2)
            out.paste(sp, (x0, y0), sp)
    if dst.exists():
        dst.unlink()
    out.save(dst, "WEBP", quality=95, method=4)


def load_idle(fac: str) -> tuple[Image.Image, Image.Image | None]:
    # prefer cleaned cuts from deep rebuild
    front_p = BASE_DIR / f"{fac}_front_cut.png"
    if not front_p.exists():
        front_p = BASE_DIR / f"rebuildA-{fac}.jpg"
        front = extract_sprite(Image.open(front_p))
    else:
        front = Image.open(front_p).convert("RGBA")
    back_p = BASE_DIR / f"{fac}_back_cut.png"
    back = Image.open(back_p).convert("RGBA") if back_p.exists() else None
    if back is None:
        bp = BASE_DIR / f"rebuildA-{fac}-back.jpg"
        if bp.exists():
            back = extract_sprite(Image.open(bp))
    return front, back


def load_poses(fac: str) -> tuple[dict, dict | None]:
    front_path = POSE_DIR / f"pose-{fac}-run-at.jpg"
    front = split_strip(front_path)
    back = None
    bp = POSE_DIR / f"pose-{fac}-run-at-back.jpg"
    if bp.exists():
        back = split_strip(bp)
    elif fac in ("emei", "cuiyan"):
        # reuse emei back for cuiyan if needed
        alt = POSE_DIR / "pose-emei-run-at-back.jpg"
        if alt.exists() and fac == "cuiyan":
            back = split_strip(alt)
    elif fac not in ("emei", "cuiyan"):
        # reuse wudang/tianwang back as weak fallback
        for donor in ("wudang", "tianwang"):
            alt = POSE_DIR / f"pose-{donor}-run-at-back.jpg"
            if alt.exists():
                back = split_strip(alt)
                break
    return front, back


def preview_strip(fac: str, meta: dict) -> Image.Image:
    tiles = []
    for act, label in (("st", "st"), ("run", "run"), ("at", "at")):
        m = meta[fac][act]
        w, h = m["w"], m["h"]
        im = Image.open(OUT_A / f"pl_{fac}_{act}.webp").convert("RGBA")
        # show frame progression for dir 0
        nshow = min(m["n"], 6 if act != "st" else 1)
        idxs = [0] if act == "st" else [int(i * (m["n"] - 1) / max(1, nshow - 1)) for i in range(nshow)]
        for fi in idxs:
            cell = im.crop((fi * w, 0, fi * w + w, h))
            bb = cell.split()[-1].getbbox()
            if bb:
                cell = cell.crop(bb)
            sc = max(2, min(4, 120 // max(cell.width, 1)))
            up = cell.resize((cell.width * sc, cell.height * sc), Image.Resampling.NEAREST)
            tile = Image.new("RGB", (130, 150), (30, 32, 40))
            tile.paste(up, ((130 - up.width) // 2, 20 + (110 - up.height) // 2), up)
            ImageDraw.Draw(tile).text((4, 4), f"{label}{fi}", fill=(220, 200, 140))
            tiles.append(tile)
    strip = Image.new("RGB", (10 + 135 * len(tiles), 170), (18, 18, 22))
    ImageDraw.Draw(strip).text((8, 4), f"{fac} Style A run/at redraw", fill=(230, 210, 150))
    for i, t in enumerate(tiles):
        strip.paste(t, (10 + i * 135, 18))
    return strip


def main() -> None:
    meta = json.loads(META.read_text())
    PREV.mkdir(parents=True, exist_ok=True)
    (PREV / "rebuildA-anim").mkdir(exist_ok=True)

    for fac in UNIQUE:
        print("poses", fac, "...")
        front, back = load_poses(fac)
        idle_f, idle_b = load_idle(fac)
        rebuild_run(fac, meta[fac]["run"], front, back, idle_f, idle_b, OUT_A / f"pl_{fac}_run.webp")
        rebuild_at(fac, meta[fac]["at"], front, back, idle_f, idle_b, OUT_A / f"pl_{fac}_at.webp")
        strip = preview_strip(fac, meta)
        strip.save(PREV / "rebuildA-anim" / f"{fac}_frames.png")
        strip.save(REVIEW / f"anim-{fac}-frames.png")
        print("ok", fac)

    for alias, src in ALIASES.items():
        for act in ("run", "at"):
            shutil.copy2(OUT_A / f"pl_{src}_{act}.webp", OUT_A / f"pl_{alias}_{act}.webp")
        print("alias", alias, "<-", src)

    # board of all
    try:
        font_t = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    except Exception:
        font_t = ImageFont.load_default()
    strips = [Image.open(PREV / "rebuildA-anim" / f"{fac}_frames.png") for fac in ("wudang", "tianwang", "emei", "shaolin")]
    W = max(s.width for s in strips)
    H = 30 + sum(s.height + 8 for s in strips)
    board = Image.new("RGB", (W, H), (16, 16, 20))
    ImageDraw.Draw(board).text((10, 8), "Style A — run/at redraw (key frames)", fill=(230, 210, 150), font=font_t)
    y = 28
    for s in strips:
        board.paste(s, (0, y)); y += s.height + 8
    board.save(PREV / "applied-A-anim-redraw.png")
    board.save(REVIEW / "applied-A-anim-redraw.png")
    print("done", board.size)


if __name__ == "__main__":
    main()
