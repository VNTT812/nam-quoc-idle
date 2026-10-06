#!/usr/bin/env python3
"""Dựng nhân Việt★: sheet 8 hướng thật (tay/chân chuyển động như NV gốc).

Yên Tử★   ← Võ Đang (kiếm) + trẻ hóa + tông vàng
Bạch Đằng★ ← Nga My (nữ) + tông đỏ son
Thạch Sơn★ ← Côn Lôn (đao, nam Thổ) + trẻ hóa mạnh + tông đất

Portrait lấy frame đứng đầu sheet để khớp in-game.
Chạy: python3 tools/viet_char_build.py
"""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_A = ROOT / 'img' / 'a'
OUT_PL = ROOT / 'img' / 'pl'

PACK = {
    'ys': {
        'src_anim': 'pl_wudang',
        'mode': 'gold',
        'out_anim': 'pl_viet_ys',
        'out_portrait': 'viet_ys',
        'deage': True,
        'label': 'Yên Tử★',
    },
    'bd': {
        'src_anim': 'pl_emei',
        'mode': 'son',
        'out_anim': 'pl_viet_bd',
        'out_portrait': 'viet_bd',
        'deage': False,
        'label': 'Bạch Đằng★',
    },
    'tn': {
        'src_anim': 'pl_kunlun',  # nam đao — dựng lại trẻ + tông thổ
        'mode': 'earth',
        'out_anim': 'pl_viet_tn',
        'out_portrait': 'viet_tn',
        'deage': True,
        'label': 'Thạch Sơn★',
    },
}
ACTS = ['st', 'run', 'at', 'hurt', 'die']

META = {
    'pl_wudang': {
        'st':   {'n': 11, 'd': 8, 'w': 65, 'h': 47, 'ax': 32, 'ay': 45, 'ms': 120},
        'run':  {'n': 6,  'd': 8, 'w': 72, 'h': 47, 'ax': 36, 'ay': 47, 'ms': 70},
        'at':   {'n': 8,  'd': 8, 'w': 97, 'h': 79, 'ax': 49, 'ay': 77, 'ms': 60},
        'hurt': {'n': 4,  'd': 8, 'w': 65, 'h': 50, 'ax': 32, 'ay': 48, 'ms': 80},
        'die':  {'n': 6,  'd': 8, 'w': 130,'h': 75, 'ax': 65, 'ay': 53, 'ms': 95},
    },
    'pl_emei': {
        'st':   {'n': 12, 'd': 8, 'w': 50, 'h': 46, 'ax': 25, 'ay': 44, 'ms': 120},
        'run':  {'n': 6,  'd': 8, 'w': 74, 'h': 44, 'ax': 37, 'ay': 43, 'ms': 70},
        'at':   {'n': 7,  'd': 8, 'w': 98, 'h': 67, 'ax': 49, 'ay': 61, 'ms': 60},
        'hurt': {'n': 4,  'd': 8, 'w': 62, 'h': 47, 'ax': 31, 'ay': 45, 'ms': 80},
        'die':  {'n': 8,  'd': 8, 'w': 131,'h': 75, 'ax': 66, 'ay': 49, 'ms': 95},
    },
    'pl_kunlun': {
        'st':   {'n': 11, 'd': 8, 'w': 65, 'h': 47, 'ax': 32, 'ay': 45, 'ms': 120},
        'run':  {'n': 6,  'd': 8, 'w': 72, 'h': 47, 'ax': 36, 'ay': 47, 'ms': 70},
        'at':   {'n': 8,  'd': 8, 'w': 97, 'h': 79, 'ax': 49, 'ay': 77, 'ms': 60},
        'hurt': {'n': 4,  'd': 8, 'w': 65, 'h': 50, 'ax': 32, 'ay': 48, 'ms': 80},
        'die':  {'n': 6,  'd': 8, 'w': 130,'h': 75, 'ax': 65, 'ay': 53, 'ms': 95},
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


def deage_sheet(im: Image.Image) -> Image.Image:
    """Trẻ hóa từng frame trong sheet: bỏ râu/tóc bạc → da / tóc đen."""
    im = im.convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    H, W = rgb.shape[:2]
    yy = np.arange(H)[:, None]
    # Ước lượng chiều cao 1 frame row ≈ H/8 cho sheet 8 hướng
    # nhưng white beard xuất hiện mọi row — dùng tỉ lệ trong từng "hàng" khó:
    # dùng heuristic toàn cục: vùng sáng ít bão hòa + không phải nón (nón vàng ấm)
    mean = rgb.mean(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    # râu/tóc bạc: sáng, xám
    grayish = (mean > 145) & (chroma < 48) & (alpha > 35)
    # nón lá / vàng ấm: giữ lại
    warm = (rgb[..., 0] > rgb[..., 2] + 15) & (rgb[..., 1] > rgb[..., 2] + 5) & (rgb[..., 0] > 110)
    # vùng "mặt" gần giữa-trên mỗi tile — xấp xỉ: bỏ gray không ấm
    beard = grayish & (~warm)
    # tóc bạc gần đỉnh nhân vật (sáng hơn)
    hair_white = (mean > 170) & (chroma < 40) & (alpha > 35) & (~warm)

    skin = np.array([210.0, 172.0, 142.0], dtype=np.float32)  # da trẻ sáng hơn
    hair = np.array([28.0, 22.0, 20.0], dtype=np.float32)

    # lấy skin từ pixel da thật nếu có
    skin_mask = (
        (rgb[..., 0] > rgb[..., 2] + 10) & (rgb[..., 0] > 100) & (rgb[..., 0] < 220)
        & (chroma > 18) & (chroma < 90) & (alpha > 40) & (~warm)
    )
    if skin_mask.sum() > 30:
        skin = rgb[skin_mask].mean(axis=0)

    out = rgb.copy()
    out[beard] = skin
    out[hair_white] = hair
    # nhẹ nhàng tăng sáng vùng da còn lại (trẻ hơn)
    soft_skin = skin_mask & (mean < 190)
    out[soft_skin] = np.clip(out[soft_skin] * 1.06 + 4, 0, 255)

    res = np.dstack([out.astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(res, 'RGBA')


def recolor(im: Image.Image, mode: str) -> Image.Image:
    im = im.convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3] / 255.0
    alpha = a[..., 3]
    h, s, v = _rgb_to_hsv(rgb)
    soft = (s < 0.08) & (v > 0.82)
    skin = (h > 0.02) & (h < 0.12) & (s > 0.12) & (s < 0.55) & (v > 0.35) & (v < 0.95)
    # giữ nón / kim loại sáng
    keep = soft | skin
    if mode == 'gold':
        # áo → vàng hổ phách / nâu đất trẻ
        h2 = 0.09 + (h - 0.06) * 0.2
        s2 = np.clip(s * 1.25 + 0.1, 0, 1)
        v2 = np.clip(v * 1.08, 0, 1)
        hs, ss, vs = 0.11, 0.28, np.clip(v * 1.04, 0, 1)
    elif mode == 'earth':
        # hệ Thổ nam: nâu đất / hổ phách đậm, trẻ
        h2 = 0.07 + (h - 0.05) * 0.18
        s2 = np.clip(s * 1.3 + 0.14, 0, 1)
        v2 = np.clip(v * 1.1, 0, 1)
        hs, ss, vs = 0.10, 0.32, np.clip(v * 1.05, 0, 1)
    else:
        # đỏ son trẻ
        h2 = 0.985 + h * 0.06
        s2 = np.clip(s * 1.2 + 0.14, 0, 1)
        v2 = np.clip(v * 1.05, 0, 1)
        hs, ss, vs = 0.0, 0.06, np.clip(v, 0, 1)
    h_out = np.where(keep, np.where(soft, hs, h), h2 % 1.0)
    s_out = np.where(keep, np.where(soft, ss, s), s2)
    v_out = np.where(keep, np.where(soft, vs, v), v2)
    out = _hsv_to_rgb(h_out, s_out, v_out)
    out = (np.clip(out, 0, 1) * 255).astype(np.uint8)
    res = np.dstack([out, alpha.astype(np.uint8)])
    res[alpha < 8, :3] = a[alpha < 8, :3].astype(np.uint8)
    return Image.fromarray(res, 'RGBA')


def process_sheet(src: Path, dst: Path, mode: str, do_deage: bool) -> Image.Image:
    im = Image.open(src).convert('RGBA')
    if do_deage:
        im = deage_sheet(im)
    im = recolor(im, mode)
    im = ImageEnhance.Brightness(im).enhance(1.06)
    im = ImageEnhance.Color(im).enhance(1.1)
    # nhẹ sharpen để chi tiết tay/chân rõ hơn khi scale
    im = im.filter(ImageFilter.UnsharpMask(radius=0.8, percent=80, threshold=2))
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, 'WEBP', quality=92, method=4)
    return im


def portrait_from_sheet(sheet: Image.Image, meta: dict, out: Path) -> dict:
    w, h = meta['w'], meta['h']
    fr = sheet.crop((0, 0, w, h)).convert('RGBA')
    out.parent.mkdir(parents=True, exist_ok=True)
    fr.save(out, 'PNG', optimize=True)
    return {
        'img': str(out.relative_to(ROOT)).replace('\\', '/'),
        'sz': [w, h, meta['ax'], meta['ay']],
    }


def build_faction(key: str, cfg: dict) -> tuple[dict, dict]:
    src = cfg['src_anim']
    out = cfg['out_anim']
    meta_src = META[src]
    print(f'== {cfg["label"]}  {src} → {out} ({cfg["mode"]}) ==')
    out_meta = {}
    st_im = None
    for act in ACTS:
        src_path = OUT_A / f'{src}_{act}.webp'
        if not src_path.is_file():
            raise FileNotFoundError(src_path)
        dst_path = OUT_A / f'{out}_{act}.webp'
        im = process_sheet(src_path, dst_path, cfg['mode'], cfg['deage'])
        m = dict(meta_src[act])
        m['f'] = dst_path.name
        m['fixed'] = 1
        out_meta[act] = m
        print(' ', act, '→', dst_path.name, im.size)
        if act == 'st':
            st_im = im
    por = portrait_from_sheet(st_im, out_meta['st'], OUT_PL / f'{cfg["out_portrait"]}.png')
    print(' portrait', por)
    hero = {
        'img': por['img'],
        'sz': por['sz'],
        'anim': out,  # 8 hướng — tay chân chuyển động như gốc
        'mode': cfg['mode'],
        'src': src,
    }
    return hero, out_meta


def main():
    heroes = {}
    anims = {}
    for key, cfg in PACK.items():
        hero, meta = build_faction(key, cfg)
        heroes[key] = hero
        anims[cfg['out_anim']] = meta

    data = {
        'series': 'Việt★',
        'seriesCol': '#d4a017',
        'seriesDesc': 'Admin · Yên Tử★ · Bạch Đằng★ · Thạch Sơn★ (nam Thổ)',
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
        '/* auto-generated by tools/viet_char_build.py — Việt★ + nam Thổ★ 8-dir */\n'
        '(typeof window!=="undefined"?window:globalThis).VIET_CHAR = '
        + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8',
    )
    print('wrote', out_js)


if __name__ == '__main__':
    main()
