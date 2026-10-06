#!/usr/bin/env python3
"""Dựng nhân Việt★ TOÀN THÂN từ Kiếm Hiệp — KHÔNG đè đầu lên sheet cũ.

Nam (Yên Tử★ / Thạch Sơn★):
  - Pose gốc: KH #600 (đứng), #580 (lưng), #620/#640/#680 (chạy), #700 (đánh)
  - Tách bộ phận (đầu / thân / chân T-P) trên CÙNG sprite KH → anim tay chân
  - 2 hướng (trước/lưng) + flip L/R — không dùng pl_kunlun/pl_wudang

Nữ (Bạch Đằng★): KH #75 toàn thân + cùng pipeline.

Chạy: python3 tools/viet_char_build.py
"""
from __future__ import annotations
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_A = ROOT / 'img' / 'a'
OUT_PL = ROOT / 'img' / 'pl'
PACK_DIR = ROOT / 'assets' / 'pack' / 'kiem_hiep'

# Pose KH theo hành động — cùng một nhân vật xanh
KH = {
    'idle': 600,
    'back': 580,
    'run': [620, 640, 680, 620, 640, 680],
    'at':  [700, 680, 640, 700, 680, 640, 700, 680],
    'hurt': 600,
    'die': 600,
}

PACK = {
    'ys': {
        'mode': 'gold',
        'out_anim': 'pl_viet_ys3',
        'out_portrait': 'viet_ys3',
        'label': 'Yên Tử★',
        'target_h': 64,
        'female': False,
    },
    'tn': {
        'mode': 'earth',
        'out_anim': 'pl_viet_tn3',
        'out_portrait': 'viet_tn3',
        'label': 'Thạch Sơn★',
        'target_h': 64,
        'female': False,
    },
    'bd': {
        'mode': 'son',
        'out_anim': 'pl_viet_bd3',
        'out_portrait': 'viet_bd3',
        'label': 'Bạch Đằng★',
        'target_h': 64,
        'female': True,
        'kh_idle': 75,
    },
}


def _rgb_to_hsv(arr):
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
    h = (h / 6.0)
    s = np.where(mx == 0, 0, df / np.maximum(mx, 1e-8))
    return h, s, mx


def _hsv_to_rgb(h, s, v):
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


def recolor(im: Image.Image, mode: str) -> Image.Image:
    """Đổi tông áo xanh KH → vàng / đất / son; giữ da + tóc đen."""
    im = im.convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3] / 255.0
    alpha = a[..., 3]
    h, s, v = _rgb_to_hsv(rgb)
    soft = (s < 0.10) & (v > 0.78)
    skin = (h > 0.02) & (h < 0.14) & (s > 0.10) & (s < 0.55) & (v > 0.30) & (v < 0.95)
    dark = (v < 0.28) & (s < 0.40) & (alpha > 40)
    keep = soft | skin | dark

    if mode == 'gold':
        h2 = 0.12 + (h - 0.55) * 0.05
        s2 = np.clip(s * 1.35 + 0.25, 0, 1)
        v2 = np.clip(v * 1.15 + 0.06, 0, 1)
        hs, ss, vs = 0.13, 0.32, np.clip(v * 1.08, 0, 1)
    elif mode == 'earth':
        h2 = 0.055 + (h - 0.55) * 0.04
        s2 = np.clip(s * 1.2 + 0.18, 0, 1)
        v2 = np.clip(v * 0.95 + 0.02, 0, 1)
        hs, ss, vs = 0.08, 0.26, np.clip(v * 0.96, 0, 1)
    else:
        h2 = 0.985 + (h - 0.55) * 0.05
        s2 = np.clip(s * 1.25 + 0.16, 0, 1)
        v2 = np.clip(v * 1.05, 0, 1)
        hs, ss, vs = 0.0, 0.06, np.clip(v, 0, 1)

    h_out = np.where(keep, np.where(soft, hs, h), h2 % 1.0)
    s_out = np.where(keep, np.where(soft, ss, s), s2)
    v_out = np.where(keep, np.where(soft, vs, v), v2)
    h_out = np.where(dark, h, h_out)
    s_out = np.where(dark, s, s_out)
    v_out = np.where(dark, v, v_out)
    out = (_hsv_to_rgb(h_out, s_out, v_out) * 255).clip(0, 255).astype(np.uint8)
    res = np.dstack([out, alpha.astype(np.uint8)])
    res[alpha < 8, :3] = a[alpha < 8, :3].astype(np.uint8)
    return Image.fromarray(res, 'RGBA')


def trim_alpha(im: Image.Image, thr: int = 10) -> Image.Image:
    a = np.asarray(im.convert('RGBA'))[..., 3]
    ys, xs = np.where(a > thr)
    if len(xs) == 0:
        return im
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def load_kh(kid: int, target_h: int, mode: str) -> Image.Image:
    src = PACK_DIR / f'{kid}.png'
    if not src.is_file():
        raise FileNotFoundError(src)
    im = Image.open(src).convert('RGBA')
    im = trim_alpha(im)
    im = recolor(im, mode)
    im = ImageEnhance.Brightness(im).enhance(1.04)
    im = ImageEnhance.Color(im).enhance(1.1)
    im = im.filter(ImageFilter.UnsharpMask(radius=0.6, percent=55, threshold=2))
    w, h = im.size
    sc = target_h / h
    return im.resize((max(1, int(round(w * sc))), max(1, int(round(h * sc)))), Image.Resampling.LANCZOS)


def transform_full(im: Image.Image, *, dy=0, dx=0, rot=0.0, scale=1.0, shear=0.0) -> Image.Image:
    w, h = im.size
    pad = max(12, int(max(w, h) * 0.22))
    base = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    base.alpha_composite(im, (pad, pad))
    if abs(scale - 1.0) > 1e-3:
        base = base.resize(
            (max(1, int(round(base.width * scale))), max(1, int(round(base.height * scale)))),
            Image.Resampling.BILINEAR,
        )
    if abs(shear) > 1e-3:
        shx = shear * base.height
        base = base.transform(
            base.size, Image.Transform.AFFINE,
            (1, shear, -shx * 0.5, 0, 1, 0),
            resample=Image.Resampling.BILINEAR,
        )
    if abs(rot) > 1e-3:
        base = base.rotate(rot, resample=Image.Resampling.BILINEAR, expand=True)
    if dx or dy:
        out = Image.new('RGBA', base.size, (0, 0, 0, 0))
        out.alpha_composite(base, (dx, dy))
        base = out
    return trim_alpha(base)


def stack_row(frames: list[Image.Image]) -> tuple[Image.Image, int, int]:
    mw = max(f.width for f in frames)
    mh = max(f.height for f in frames) + 4
    sheet = Image.new('RGBA', (mw * len(frames), mh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        x = (mw - f.width) // 2
        y = mh - f.height - 2
        sheet.alpha_composite(f, (i * mw + x, y))
    return sheet, mw, mh


def stack_dirs(rows: list[Image.Image]) -> Image.Image:
    w = max(r.width for r in rows)
    h = max(r.height for r in rows)
    out = Image.new('RGBA', (w, h * len(rows)), (0, 0, 0, 0))
    for i, r in enumerate(rows):
        cell = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        cell.alpha_composite(r, (0, h - r.height))
        out.alpha_composite(cell, (0, i * h))
    return out


def make_idle(full: Image.Image, n: int) -> list[Image.Image]:
    frames = []
    for i in range(n):
        phase = i / n * math.pi * 2
        frames.append(transform_full(
            full,
            dy=int(round(math.sin(phase) * 1.5)),
            rot=math.sin(phase) * 1.5,
            scale=1.0 + 0.01 * math.sin(phase),
        ))
    return frames


def make_run(fulls: list[Image.Image], n: int) -> list[Image.Image]:
    """Chu kỳ chạy = lần lượt pose KH đầy đủ (không cắt ghép)."""
    frames = []
    for i in range(n):
        phase = i / n * math.pi * 2
        base = fulls[i % len(fulls)]
        frames.append(transform_full(
            base,
            dy=-int(round(abs(math.sin(phase)) * 2)),
            shear=math.sin(phase) * 0.04,
            rot=math.sin(phase) * 2.5,
            scale=1.02,
        ))
    return frames


def make_attack(fulls: list[Image.Image], n: int) -> list[Image.Image]:
    frames = []
    for i in range(n):
        t = i / max(1, n - 1)
        phase = math.sin(t * math.pi)
        base = fulls[i % len(fulls)]
        frames.append(transform_full(
            base,
            dx=int(round(phase * 6)),
            rot=-6 + phase * 16,
            shear=phase * 0.05,
            scale=1.0 + phase * 0.04,
        ))
    return frames


def make_hurt(full: Image.Image, n: int) -> list[Image.Image]:
    frames = []
    for i in range(n):
        frames.append(transform_full(full, dx=i * 2 - 2, rot=-6 + i * 4, scale=0.98))
    return frames


def make_die(full: Image.Image, n: int) -> list[Image.Image]:
    frames = []
    for i in range(n):
        t = i / max(1, n - 1)
        fr = transform_full(full, dy=int(round(t * 12)), rot=t * 70, scale=1.0 - t * 0.1)
        arr = np.asarray(fr).copy()
        arr[..., 3] = (arr[..., 3].astype(np.float32) * (1 - t * 0.5)).astype(np.uint8)
        frames.append(Image.fromarray(arr, 'RGBA'))
    return frames


def build_faction(key: str, cfg: dict) -> tuple[dict, dict]:
    mode, stem, th = cfg['mode'], cfg['out_anim'], cfg['target_h']
    print(f'== {cfg["label"]}  KH full-body → {stem} ({mode}) ==')

    if cfg.get('female'):
        idle_id = cfg.get('kh_idle', 75)
        sprites = {idle_id: load_kh(idle_id, th, mode)}
        idle = sprites[idle_id]
        back = idle
        run_list = [idle] * 6
        at_list = [idle] * 8
    else:
        need = {KH['idle'], KH['back'], *KH['run'], *KH['at']}
        sprites = {i: load_kh(i, th, mode) for i in sorted(need)}
        print('  poses', sorted(sprites.keys()), 'h=', th)
        idle = sprites[KH['idle']]
        back = sprites[KH['back']]
        run_list = [sprites[i] for i in KH['run']]
        at_list = [sprites[i] for i in KH['at']]

    specs = {
        'st':   (8, 110, lambda: make_idle(idle, 8), lambda: make_idle(back, 8)),
        'run':  (6, 75,  lambda: make_run(run_list, 6),
                 lambda: make_run([back] * 6, 6)),
        'at':   (8, 60,  lambda: make_attack(at_list, 8),
                 lambda: make_attack([back] * 8, 8)),
        'hurt': (4, 90,  lambda: make_hurt(idle, 4), lambda: make_hurt(back, 4)),
        'die':  (6, 100, lambda: make_die(idle, 6), lambda: make_die(back, 6)),
    }

    meta = {}
    portrait_fr = None
    for act, (n, ms, front_fn, back_fn) in specs.items():
        front = front_fn()
        back_frames = back_fn()
        row_f, fw, fh = stack_row(front)
        row_b, _, _ = stack_row(back_frames)
        mw, mh = max(row_f.width, row_b.width), max(row_f.height, row_b.height)
        rf = Image.new('RGBA', (mw, mh), (0, 0, 0, 0))
        rb = Image.new('RGBA', (mw, mh), (0, 0, 0, 0))
        rf.alpha_composite(row_f, (0, mh - row_f.height))
        rb.alpha_composite(row_b, (0, mh - row_b.height))
        sheet = stack_dirs([rf, rb])
        path = OUT_A / f'{stem}_{act}.webp'
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(path, 'WEBP', quality=92, method=4)
        meta[act] = {
            'f': path.name, 'n': n, 'd': 2, 'w': fw, 'h': mh,
            'ax': fw // 2, 'ay': mh - 2, 'ms': ms, 'fixed': 1, 'flip': 1,
        }
        print(f'  {act} → {path.name} {sheet.size} n={n} d=2')
        if act == 'st':
            portrait_fr = front[0]

    por_path = OUT_PL / f'{cfg["out_portrait"]}.png'
    por_path.parent.mkdir(parents=True, exist_ok=True)
    portrait_fr.save(por_path, 'PNG', optimize=True)
    pw, ph = portrait_fr.size
    hero = {
        'img': str(por_path.relative_to(ROOT)).replace('\\', '/'),
        'sz': [pw, ph, pw // 2, ph - 2],
        'anim': stem,
        'mode': mode,
        'src': 'kh_fullbody',
        'khId': 75 if cfg.get('female') else 600,
    }
    print('  portrait', hero['img'], hero['sz'])
    return hero, meta


def main():
    heroes, anims = {}, {}
    for key, cfg in PACK.items():
        hero, meta = build_faction(key, cfg)
        heroes[key] = hero
        anims[cfg['out_anim']] = meta

    data = {
        'series': 'Việt★',
        'seriesCol': '#d4a017',
        'seriesDesc': 'Admin · nhân Việt dựng lại toàn thân từ Kiếm Hiệp (không đè sheet cũ)',
        'heroes': {
            'wudang_t': heroes['ys'],
            'kunlun_t': heroes['bd'],
            'thoman_t': heroes['tn'],
        },
        'anims': anims,
        'factions': {
            'wudang_t': {'n': 'Yên Tử★', 'short': 'Yên Tử★'},
            'kunlun_t': {'n': 'Bạch Đằng★', 'short': 'Bạch Đằng★'},
            'thoman_t': {'n': 'Thạch Sơn★', 'short': 'Thạch Sơn★', 'sex': 0},
        },
    }
    out_js = ROOT / 'js' / 'viet_char_data.js'
    out_js.write_text(
        '/* auto-generated — Việt★ FULL KH body (no overlay on kunlun/wudang) */\n'
        '(typeof window!=="undefined"?window:globalThis).VIET_CHAR = '
        + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8',
    )
    (PACK_DIR / 'README.md').write_text(
        '# Kiếm Hiệp — nhân Việt★ toàn thân\n\n'
        '- Nam: `600/580/620/640/680/700.png` (không dùng pl_kunlun)\n'
        '- Nữ: `75.png`\n'
        '- Tách bộ phận trên cùng sprite → anim chạy/đánh\n\n'
        '`python3 tools/viet_char_build.py`\n',
        encoding='utf-8',
    )
    print('wrote', out_js)


if __name__ == '__main__':
    main()
