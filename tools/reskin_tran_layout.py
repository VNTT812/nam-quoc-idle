#!/usr/bin/env python3
"""Giữ bố cục + nét map gốc VLTK; đổi bối cảnh Trần sạch.

- Không stamp sprite lên cột/nhà
- Không lát tile kiến trúc (tránh mái/nhà nổi trên đất)
- Đất: grain nhẹ từ texture đất/lúa
- Cây / nhà / đá: remap màu HSV trên pixel gốc (giữ hình khối)
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import deque
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
Z = ROOT / "img" / "z"
TILES = Z / "_tran_tiles"
ORIG_REV = "5f51470"

# zone bias → hue/sat tweaks
BIAS = {
    "2": "lush",
    "3": "warm",
    "7": "warm",
    "19": "lush",
    "21": "lush",
    "41": "lush",
    "90": "water",
    "70": "water",
    "92": "lush",
    "56": "water",
    "122": "water",
    "140": "mist",
    "224": "warm",
    "319": "mist",
    "320": "mist",
    "322": "mist",
    "town": "warm",
    "195": "mist",
    "43": "lush",
    "179": "lush",
    "193": "mist",
    "74": "lush",
    "145": "cave",
    "167": "mist",
    "68": "water",
    "342": "water",
    "341": "water",
    "123": "cave",
    "93": "cave",
    "75": "cave",
    "336": "water",
    "337": "water",
    "340": "cave",
    "201": "cave",
    "205": "cave",
    "400": "warm",
    "401": "water",
}


def load_orig(stem: str) -> Image.Image:
    data = subprocess.check_output(["git", "show", f"{ORIG_REV}:img/z/{stem}.jpg"])
    return Image.open(BytesIO(data)).convert("RGB")


def open_tile(*names: str) -> Image.Image | None:
    for name in names:
        for base in (TILES, Path("/opt/cursor/artifacts/assets"), Path("/tmp/maps_tran")):
            p = base / name
            if p.exists():
                return Image.open(p).convert("RGB")
    return None


def blur_mask(m: np.ndarray, rad: float) -> np.ndarray:
    im = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8), "L")
    if rad > 0:
        im = im.filter(ImageFilter.GaussianBlur(rad))
    return np.asarray(im, dtype=np.float32) / 255.0


def rgb_to_hsv(arr: np.ndarray):
    r, g, b = arr[..., 0] / 255.0, arr[..., 1] / 255.0, arr[..., 2] / 255.0
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    df = mx - mn + 1e-8
    h = np.zeros_like(mx)
    m = mx == r
    h[m] = ((g[m] - b[m]) / df[m]) % 6
    m = mx == g
    h[m] = (b[m] - r[m]) / df[m] + 2
    m = mx == b
    h[m] = (r[m] - g[m]) / df[m] + 4
    h = h / 6.0
    s = np.where(mx <= 1e-8, 0, df / (mx + 1e-8))
    return h, s, mx


def hsv_to_rgb(h, s, v) -> np.ndarray:
    h6 = (h % 1.0) * 6.0
    i = np.floor(h6).astype(np.int32) % 6
    f = h6 - np.floor(h6)
    p = v * (1.0 - s)
    q = v * (1.0 - s * f)
    t = v * (1.0 - s * (1.0 - f))
    out = np.zeros(h.shape + (3,), dtype=np.float32)
    for idx, channels in enumerate(
        [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    ):
        m = i == idx
        out[m, 0], out[m, 1], out[m, 2] = channels[0][m], channels[1][m], channels[2][m]
    return np.clip(out * 255.0, 0, 255)


def detect_orbs(arr: np.ndarray) -> list[tuple[int, int, int]]:
    """Tìm đầu cột sáng — giới hạn số pixel để map hang động không treo."""
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    bright = (r + g + b) / 3
    sat = arr.max(2) - arr.min(2)
    orb = (bright > 205) & (sat < 40) & (r > 185) & (g > 185) & (b > 175)
    ys, xs = np.where(orb)
    if len(xs) == 0 or len(xs) > 80000:
        # quá nhiều điểm sáng = hang/tuyết — bỏ qua orb
        return []
    H, W = bright.shape
    vis = np.zeros((H, W), dtype=np.uint8)
    raw = []
    for y, x in zip(ys, xs):
        if vis[y, x]:
            continue
        q = deque([(y, x)])
        vis[y, x] = 1
        cells = []
        while q and len(cells) < 500:
            cy, cx = q.popleft()
            cells.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and orb[ny, nx] and not vis[ny, nx]:
                        vis[ny, nx] = 1
                        q.append((ny, nx))
        if 8 <= len(cells) <= 400:
            cy = int(np.mean([c[0] for c in cells]))
            cx = int(np.mean([c[1] for c in cells]))
            raw.append((cx, cy, len(cells)))
        if len(raw) > 80:
            break
    raw.sort(key=lambda t: -t[2])
    kept = []
    for cx, cy, n in raw:
        if any(abs(cx - kx) < 40 and abs(cy - ky) < 40 for kx, ky, _ in kept):
            continue
        kept.append((cx, cy, n))
    return kept


def classify(og: np.ndarray) -> dict[str, np.ndarray]:
    r, g, b = og[..., 0], og[..., 1], og[..., 2]
    bright = (r + g + b) / 3.0
    sat = og.max(2) - og.min(2)
    greenish = (g > r + 8) & (g > b + 5)
    canopy = (r > g + 4) & (r > b + 10) & (bright > 65) & (bright < 205) & (sat > 26)
    path = (
        (r > 68)
        & (g > 52)
        & (b > 32)
        & (np.abs(r - g) < 42)
        & ~greenish
        & ~canopy
        & (bright > 70)
        & (bright < 180)
        & (sat < 55)
    )
    grass = greenish & (bright > 45) & (bright < 175)
    rock = (bright < 90) & (sat < 50) & (np.abs(r - g) < 30)
    stone = (sat < 40) & (bright > 95) & (bright < 190) & (np.abs(r - g) < 26) & ~greenish
    built_warm = (
        (r > g + 10)
        & (r > b + 16)
        & (bright > 55)
        & (bright < 200)
        & (sat > 20)
        & (sat < 95)
        & ~canopy
    )
    built = (built_warm | stone).astype(np.float32)
    H, W = bright.shape
    yy, xx = np.mgrid[0:H, 0:W]
    for cx, cy, n in detect_orbs(og):
        rad_x = 20 + min(8, n // 4)
        rad_y = 46 + min(16, n // 3)
        m = (((xx - cx) / rad_x) ** 2 + ((yy - (cy + 16)) / rad_y) ** 2) <= 1.0
        built[m] = 1.0
    return {
        "path": path.astype(np.float32),
        "grass": grass.astype(np.float32),
        "canopy": canopy.astype(np.float32),
        "rock": rock.astype(np.float32),
        "built": built,
        "bright": bright,
    }


def bias_params(bias: str):
    # canopy_h, canopy_s, grass_h, grass_s, path_h, path_s, built_h, built_s, rock_h, rock_s
    if bias == "lush":
        return dict(
            canopy=(0.30, 0.42),
            grass=(0.29, 0.38),
            path=(0.10, 0.28),
            built=(0.07, 0.28),
            rock=(0.18, 0.12),
        )
    if bias == "water":
        return dict(
            canopy=(0.32, 0.40),
            grass=(0.34, 0.36),
            path=(0.11, 0.26),
            built=(0.08, 0.26),
            rock=(0.55, 0.10),
        )
    if bias == "mist":
        return dict(
            canopy=(0.31, 0.34),
            grass=(0.30, 0.30),
            path=(0.10, 0.22),
            built=(0.07, 0.24),
            rock=(0.55, 0.08),
        )
    if bias == "cave":
        return dict(
            canopy=(0.28, 0.22),
            grass=(0.27, 0.18),
            path=(0.08, 0.20),
            built=(0.06, 0.22),
            rock=(0.08, 0.10),
        )
    return dict(
        canopy=(0.31, 0.40),
        grass=(0.30, 0.36),
        path=(0.09, 0.30),
        built=(0.06, 0.30),
        rock=(0.12, 0.12),
    )


def mix_hue_sat(h, s, mask, th, ts, hue_w=0.9, sat_w=0.55):
    m = mask
    h2 = h * (1.0 - hue_w * m) + th * (hue_w * m)
    # kéo sat về mức tự nhiên Trần (không neon)
    s2 = s * (1.0 - sat_w * m) + ts * (sat_w * m)
    return h2, s2


def ground_grain(W: int, H: int, seed: int) -> np.ndarray | None:
    tile = open_tile("tran-ground.jpg", "04_dong_lua.jpg")
    if tile is None:
        return None
    tw = 320
    t = tile.resize((tw, tw), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.5))
    canvas = Image.new("RGB", (W, H))
    for y in range(0, H, tw):
        for x in range(0, W, tw):
            v = t if ((x // tw + y // tw + seed) % 2 == 0) else t.transpose(Image.FLIP_LEFT_RIGHT)
            canvas.paste(v, (x, y))
    return np.asarray(canvas, dtype=np.float32)


def reskin(stem: str, bias: str | None = None) -> Path:
    bias = bias or BIAS.get(stem, "warm")
    orig = load_orig(stem)
    W, H = orig.size
    og = np.asarray(orig, dtype=np.float32)
    c = classify(og)
    p = bias_params(bias)

    h, s, v = rgb_to_hsv(og)
    m_path = blur_mask(c["path"], 0.9)
    m_grass = blur_mask(c["grass"], 1.1)
    m_tree = blur_mask(c["canopy"], 0.9)
    m_rock = blur_mask(c["rock"], 0.8)
    m_built = blur_mask(c["built"], 1.1)

    # normalize priority: built/tree first
    stack = np.stack(
        [m_built * 1.35, m_tree * 1.3, m_path * 1.15, m_grass * 1.0, m_rock * 1.05],
        axis=-1,
    )
    w = stack / (stack.sum(-1, keepdims=True) + 1e-5)
    mb, mt, mp, mg, mr = [w[..., i] for i in range(5)]

    h, s = mix_hue_sat(h, s, mb, p["built"][0], p["built"][1], hue_w=0.92, sat_w=0.6)
    h, s = mix_hue_sat(h, s, mt, p["canopy"][0], p["canopy"][1], hue_w=0.95, sat_w=0.65)
    h, s = mix_hue_sat(h, s, mp, p["path"][0], p["path"][1], hue_w=0.75, sat_w=0.45)
    h, s = mix_hue_sat(h, s, mg, p["grass"][0], p["grass"][1], hue_w=0.8, sat_w=0.5)
    h, s = mix_hue_sat(h, s, mr, p["rock"][0], p["rock"][1], hue_w=0.7, sat_w=0.4)

    # mái/cửa ấm hơn trên built sáng
    roof = mb * np.clip((c["bright"] - 115.0) / 70.0, 0, 1)
    h = h * (1.0 - 0.45 * roof) + 0.04 * (0.45 * roof)
    s = np.clip(s + 0.14 * roof, 0, 1)
    # thân cột/bia: đá ấm xám-nâu (built tối hơn)
    body = mb * np.clip((130.0 - c["bright"]) / 70.0, 0, 1)
    h = h * (1.0 - 0.35 * body) + 0.075 * (0.35 * body)
    s = np.clip(s * (1.0 - 0.2 * body) + 0.22 * body, 0, 1)

    out = hsv_to_rgb(h, s, v)
    # RGB grade mạnh trên kiến trúc — đổi cảm giác cột/nhà xám Trung Hoa
    warm_mul = np.array([1.18, 1.02, 0.82], dtype=np.float32)
    warm_add = np.array([14.0, 6.0, -4.0], dtype=np.float32)
    out = out * (1.0 - 0.55 * mb[..., None]) + np.clip(
        out * warm_mul + warm_add, 0, 255
    ) * (0.55 * mb[..., None])

    # grain đất nhẹ — chỉ path/grass, match luminance để không đè hình
    grain = ground_grain(W, H, seed=sum(map(ord, stem)) % 97)
    if grain is not None:
        gmask = (mp * 0.28 + mg * 0.16)[..., None]
        gL = grain.mean(2) + 1e-5
        oL = out.mean(2) + 1e-5
        grain2 = grain * (oL / gL)[..., None]
        out = out * (1.0 - gmask) + grain2 * gmask

    # grade ấm Trần, không neon
    out[..., 0] = np.clip(out[..., 0] * 1.02 + 2, 0, 255)
    out[..., 1] = np.clip(out[..., 1] * 1.03 + 1, 0, 255)
    out[..., 2] = np.clip(out[..., 2] * 0.96, 0, 255)

    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    img = ImageEnhance.Contrast(img).enhance(1.06)
    img = ImageEnhance.Color(img).enhance(1.04)

    out_path = Z / f"{stem}.jpg"
    img.save(out_path, quality=90, optimize=True)
    return out_path


def ensure_orig_jmo(stem: str = "7") -> None:
    t = subprocess.check_output(["git", "show", f"{ORIG_REV}:jmo.js"], text=True)
    m = re.search(rf'"{stem}"\s*:\s*\{{', t)
    if not m:
        return
    i = t.find("{", m.start())
    depth = 0
    meta = None
    for j in range(i, len(t)):
        if t[j] == "{":
            depth += 1
        elif t[j] == "}":
            depth -= 1
            if depth == 0:
                meta = json.loads(t[i : j + 1])
                break
    if meta is None:
        return
    jmo_path = ROOT / "jmo.js"
    cur = jmo_path.read_text(encoding="utf-8")
    start = cur.find(f'"{stem}":{{')
    if start < 0:
        start = cur.find(f'"{stem}": {{')
    if start < 0:
        return
    i = cur.find("{", start)
    depth = 0
    end = None
    for j in range(i, len(cur)):
        if cur[j] == "{":
            depth += 1
        elif cur[j] == "}":
            depth -= 1
            if depth == 0:
                end = j + 1
                break
    if end is None:
        return
    new_obj = json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
    cur = cur[:start] + f'"{stem}":' + new_obj + cur[end:]
    if cur.startswith("/*"):
        cur = re.sub(
            r"^/\*.*?\*/",
            "/* Maps: layout goc VLTK + remap Tran sach (khong stamp, khong lat nha) */",
            cur,
            count=1,
            flags=re.S,
        )
    jmo_path.write_text(cur, encoding="utf-8")


def bump_cache() -> int:
    idx = ROOT / "index.html"
    text = idx.read_text(encoding="utf-8")
    m = re.search(r"\?v=(\d+)", text)
    ver = int(m.group(1)) + 1 if m else 233
    text = re.sub(r"\?v=\d+", f"?v={ver}", text)
    idx.write_text(text, encoding="utf-8")
    sw = ROOT / "sw.js"
    s = sw.read_text(encoding="utf-8")
    s = re.sub(r"jxidle-v\d+", f"jxidle-v{ver}", s)
    s = re.sub(r"jxidle-img-\d+", f"jxidle-img-{ver}", s)
    sw.write_text(s, encoding="utf-8")
    world = ROOT / "world.js"
    w = world.read_text(encoding="utf-8")
    w = re.sub(r'("bg":")img/z/(\w+)\.jpg(?:\?v=\d+)?"', rf'\1img/z/\2.jpg?v={ver}"', w)
    world.write_text(w, encoding="utf-8")
    return ver


def main() -> None:
    args = [a for a in sys.argv[1:] if a]
    available = set(
        subprocess.check_output(["git", "ls-tree", "--name-only", f"{ORIG_REV}:img/z/"], text=True)
        .strip()
        .splitlines()
    )
    if not args or args == ["all"]:
        stems = [s for s in BIAS if f"{s}.jpg" in available]
    else:
        stems = args

    for name in ("tran-ground.jpg", "04_dong_lua.jpg"):
        for src_dir in (Path("/tmp/maps_tran"), Path("/opt/cursor/artifacts/assets")):
            src = src_dir / name
            if src.exists():
                (TILES / name).write_bytes(src.read_bytes())
                break

    for i, stem in enumerate(stems):
        bias = BIAS.get(stem, "warm")
        print(f"[{i+1}/{len(stems)}] reskin {stem} ({bias})", flush=True)
        path = reskin(stem, bias)
        print(f"  -> {path.name} {path.stat().st_size // 1024}KB", flush=True)

    if "7" in stems:
        ensure_orig_jmo("7")
    ver = bump_cache()
    print(f"Done {len(stems)} maps v{ver}", flush=True)


if __name__ == "__main__":
    main()
