#!/usr/bin/env python3
"""Dựng nhân vật Việt★ riêng: portrait từ pack Kiếm Hiệp + sheet 8 hướng recolor
từ Võ Đang / Côn Lôn — thay hình hệ Thổ★ test.

Chạy: python3 tools/viet_char_build.py
Nguồn KH tạm: /tmp/viet_src/assets/pack/kiem_hiep/  hoặc assets/pack/kiem_hiep/
"""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT_A = ROOT / 'img' / 'a'
OUT_PL = ROOT / 'img' / 'pl'
SRC_CANDIDATES = [
    Path('/tmp/viet_src/assets/pack/kiem_hiep'),
    ROOT / 'assets' / 'pack' / 'kiem_hiep',
]

# Yên Tử★ (kiếm, từ Võ Đang) — áo vàng / nâu đất Đại Việt
# Bạch Đằng★ (đao, từ Côn Lôn) — đỏ son / trắng
PACK = {
    'ys': {
        'src_anim': 'pl_wudang',
        'kh_id': 1000,
        'mode': 'gold',
        'out_anim': 'pl_viet_ys',
        'out_portrait': 'viet_ys',
        'target_h': 72,
    },
    'bd': {
        'src_anim': 'pl_kunlun',
        'kh_id': 25,
        'mode': 'son',
        'out_anim': 'pl_viet_bd',
        'out_portrait': 'viet_bd',
        'target_h': 72,
    },
}
ACTS = ['st', 'run', 'at', 'hurt', 'die']
# meta gốc (world.js) — giữ nguyên khung
META = {
    'pl_wudang': {
        'st':   {'n': 11, 'd': 8, 'w': 65, 'h': 47, 'ax': 32, 'ay': 45, 'ms': 143},
        'run':  {'n': 6,  'd': 8, 'w': 72, 'h': 47, 'ax': 36, 'ay': 47, 'ms': 71},
        'at':   {'n': 8,  'd': 8, 'w': 97, 'h': 79, 'ax': 49, 'ay': 77, 'ms': 62},
        'hurt': {'n': 4,  'd': 8, 'w': 65, 'h': 50, 'ax': 32, 'ay': 48, 'ms': 83},
        'die':  {'n': 6,  'd': 8, 'w': 130,'h': 75, 'ax': 65, 'ay': 53, 'ms': 100},
    },
    'pl_kunlun': {
        'st':   {'n': 11, 'd': 8, 'w': 65, 'h': 47, 'ax': 32, 'ay': 45, 'ms': 143},
        'run':  {'n': 6,  'd': 8, 'w': 72, 'h': 47, 'ax': 36, 'ay': 47, 'ms': 71},
        'at':   {'n': 8,  'd': 8, 'w': 97, 'h': 79, 'ax': 49, 'ay': 77, 'ms': 62},
        'hurt': {'n': 4,  'd': 8, 'w': 65, 'h': 50, 'ax': 32, 'ay': 48, 'ms': 83},
        'die':  {'n': 6,  'd': 8, 'w': 130,'h': 75, 'ax': 65, 'ay': 53, 'ms': 100},
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
    h = h / 6.0
    s = np.where(mx == 0, 0, df / np.maximum(mx, 1e-8))
    v = mx
    return h, s, v


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
    """gold = vàng hổ phách Đại Việt; son = đỏ son + trắng."""
    im = im.convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3] / 255.0
    alpha = a[..., 3]
    h, s, v = _rgb_to_hsv(rgb)
    soft = (s < 0.08) & (v > 0.82)
    skin = (h > 0.02) & (h < 0.12) & (s > 0.15) & (s < 0.55) & (v > 0.35) & (v < 0.95)
    if mode == 'gold':
        h2 = 0.10 + (h - 0.08) * 0.25  # vàng–nâu
        s2 = np.clip(s * 1.25 + 0.14, 0, 1)
        v2 = np.clip(v * 1.06, 0, 1)
        hs, ss, vs = 0.12, 0.35, np.clip(v * 1.05, 0, 1)
    else:  # son
        h2 = 0.98 + (h * 0.08)  # đỏ son
        s2 = np.clip(s * 1.2 + 0.18, 0, 1)
        v2 = np.clip(v * 1.03, 0, 1)
        hs, ss, vs = 0.0, 0.08, np.clip(v, 0, 1)
    h_out = np.where(soft, hs, np.where(skin, h, h2 % 1.0))
    s_out = np.where(soft, ss, np.where(skin, s, s2))
    v_out = np.where(soft, vs, np.where(skin, v, v2))
    out = _hsv_to_rgb(h_out, s_out, v_out)
    out = (np.clip(out, 0, 1) * 255).astype(np.uint8)
    res = np.dstack([out, alpha.astype(np.uint8)])
    res[alpha < 8, :3] = a[alpha < 8, :3].astype(np.uint8)
    return Image.fromarray(res, 'RGBA')


def find_kh(kid: int) -> Path:
    for base in SRC_CANDIDATES:
        p = base / f'{kid}.png'
        if p.is_file():
            return p
    raise FileNotFoundError(f'Không thấy Kiếm Hiệp #{kid}.png trong {SRC_CANDIDATES}')


def trim_alpha(im: Image.Image) -> Image.Image:
    im = im.convert('RGBA')
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > 12)
    if len(xs) == 0:
        return im
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def fit_portrait(src: Path, out: Path, target_h: int, mode: str):
    im = Image.open(src).convert('RGBA')
    im = trim_alpha(im)
    # nhẹ recolor để thống nhất tông Việt
    im = recolor(im, mode)
    w, h = im.size
    sc = target_h / h
    nw, nh = max(1, int(round(w * sc))), max(1, int(round(h * sc)))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, 'PNG', optimize=True)
    ax, ay = nw // 2, nh - 2
    return {'img': str(out.relative_to(ROOT)).replace('\\', '/'), 'sz': [nw, nh, ax, ay], 'w': nw, 'h': nh, 'ax': ax, 'ay': ay}


def build_stand_from_kh(src: Path, out_stem: str, target_h: int, mode: str):
    """Sheet 1 frame / 1 hướng / flip — dùng khi muốn hiện đúng sprite Việt riêng (đứng)."""
    im = Image.open(src).convert('RGBA')
    im = trim_alpha(im)
    im = recolor(im, mode)
    w, h = im.size
    sc = target_h / h
    nw, nh = max(1, int(round(w * sc))), max(1, int(round(h * sc)))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    path = OUT_A / f'{out_stem}_kh_st.webp'
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, 'WEBP', quality=92, method=4)
    return {
        'f': path.name,
        'n': 1, 'd': 1, 'w': nw, 'h': nh,
        'ax': nw // 2, 'ay': nh - 2,
        'ms': 320, 'fixed': 1, 'flip': 1,
    }


def recolor_sheets(src_anim: str, out_anim: str, mode: str):
    meta = META[src_anim]
    out_meta = {}
    for act in ACTS:
        src = OUT_A / f'{src_anim}_{act}.webp'
        if not src.is_file():
            raise FileNotFoundError(src)
        im = recolor(Image.open(src), mode)
        dst = OUT_A / f'{out_anim}_{act}.webp'
        im.save(dst, 'WEBP', quality=90, method=4)
        m = dict(meta[act])
        m['f'] = f'{out_anim}_{act}.webp'
        m['fixed'] = 1
        out_meta[act] = m
        print(' ', act, '→', dst.name, im.size)
    return out_meta


def main():
    heroes = {}
    anims = {}
    for key, cfg in PACK.items():
        print(f'== {key} ({cfg["out_anim"]}) ==')
        kh = find_kh(cfg['kh_id'])
        print(' KH', kh)
        por = fit_portrait(kh, OUT_PL / f'{cfg["out_portrait"]}.png', cfg['target_h'], cfg['mode'])
        print(' portrait', por['img'], por['sz'])
        sheet_meta = recolor_sheets(cfg['src_anim'], cfg['out_anim'], cfg['mode'])
        kh_st = build_stand_from_kh(kh, cfg['out_anim'], cfg['target_h'], cfg['mode'])
        # anim gameplay = sheet 8 hướng; giữ thêm kh_st để optional
        anims[cfg['out_anim']] = sheet_meta
        anims[cfg['out_anim'] + '_kh'] = {'st': kh_st, 'run': dict(kh_st, ms=180), 'at': dict(kh_st, ms=140), 'hurt': dict(kh_st, ms=180), 'die': dict(kh_st, ms=220)}
        heroes[key] = {
            'img': por['img'],
            'sz': por['sz'],
            'anim': cfg['out_anim'],
            'animKh': cfg['out_anim'] + '_kh',
            'khId': cfg['kh_id'],
            'mode': cfg['mode'],
        }
    data = {
        'series': 'Việt★',
        'seriesCol': '#d4a017',
        'seriesDesc': 'Admin · nhân Việt riêng (Yên Tử★ · Bạch Đằng★)',
        'heroes': {
            'wudang_t': heroes['ys'],
            'kunlun_t': heroes['bd'],
        },
        'anims': anims,
        'factions': {
            'wudang_t': {'n': 'Yên Tử★', 'short': 'Yên Tử★'},
            'kunlun_t': {'n': 'Bạch Đằng★', 'short': 'Bạch Đằng★'},
        },
    }
    out_js = ROOT / 'js' / 'viet_char_data.js'
    out_js.write_text(
        '/* auto-generated by tools/viet_char_build.py — nhân Việt★ thay Thổ★ test */\n'
        'window.VIET_CHAR = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8',
    )
    print('wrote', out_js)


if __name__ == '__main__':
    main()
