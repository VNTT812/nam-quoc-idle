#!/usr/bin/env python3
"""Dựng nhân Việt★: GIỮ anim 8 hướng thật (tay/chân như NV gốc) + đầu trẻ KH.

- Yên Tử★ / Thạch Sơn★: sheet pl_wudang / pl_kunlun (d=8, tay chân mượt)
  → bỏ nón lá, gắn đầu búi tóc từ Kiếm Hiệp #600, recolor vàng/đất
- Bạch Đằng★: sheet Nga My + tông son

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
PACK_DIR = ROOT / 'assets' / 'pack' / 'kiem_hiep'
KH600 = PACK_DIR / '600.png'

ACTS = ['st', 'run', 'at', 'hurt', 'die']

PACK = {
    'ys': {
        'src_anim': 'pl_wudang',
        'mode': 'gold',
        'out_anim': 'pl_viet_ys',
        'out_portrait': 'viet_ys',
        'label': 'Yên Tử★',
        'head_swap': True,
    },
    'tn': {
        'src_anim': 'pl_kunlun',
        'mode': 'earth',
        'out_anim': 'pl_viet_tn',
        'out_portrait': 'viet_tn',
        'label': 'Thạch Sơn★',
        'head_swap': True,
    },
    'bd': {
        'src_anim': 'pl_emei',
        'mode': 'son',
        'out_anim': 'pl_viet_bd',
        'out_portrait': 'viet_bd',
        'label': 'Bạch Đằng★',
        'head_swap': False,
    },
}

META = {
    'pl_wudang': {
        'st':   {'n': 11, 'd': 8, 'w': 65, 'h': 47, 'ax': 32, 'ay': 45, 'ms': 120},
        'run':  {'n': 6,  'd': 8, 'w': 72, 'h': 47, 'ax': 36, 'ay': 47, 'ms': 70},
        'at':   {'n': 8,  'd': 8, 'w': 97, 'h': 79, 'ax': 49, 'ay': 77, 'ms': 60},
        'hurt': {'n': 4,  'd': 8, 'w': 65, 'h': 50, 'ax': 32, 'ay': 48, 'ms': 80},
        'die':  {'n': 6,  'd': 8, 'w': 130,'h': 75, 'ax': 65, 'ay': 53, 'ms': 95},
    },
    'pl_kunlun': {
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
    im = im.convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3] / 255.0
    alpha = a[..., 3]
    h, s, v = _rgb_to_hsv(rgb)
    soft = (s < 0.10) & (v > 0.78)
    skin = (h > 0.02) & (h < 0.14) & (s > 0.10) & (s < 0.55) & (v > 0.30) & (v < 0.95)
    dark_hair = (v < 0.28) & (s < 0.40) & (alpha > 40)
    keep = soft | skin | dark_hair

    if mode == 'gold':
        h2 = 0.12 + (h - 0.08) * 0.15
        s2 = np.clip(s * 1.3 + 0.22, 0, 1)
        v2 = np.clip(v * 1.12 + 0.05, 0, 1)
        hs, ss, vs = 0.13, 0.32, np.clip(v * 1.08, 0, 1)
    elif mode == 'earth':
        h2 = 0.06 + (h - 0.06) * 0.12
        s2 = np.clip(s * 1.2 + 0.16, 0, 1)
        v2 = np.clip(v * 1.02, 0, 1)
        hs, ss, vs = 0.09, 0.28, np.clip(v * 0.98, 0, 1)
    else:
        h2 = 0.985 + h * 0.05
        s2 = np.clip(s * 1.2 + 0.14, 0, 1)
        v2 = np.clip(v * 1.04, 0, 1)
        hs, ss, vs = 0.0, 0.06, np.clip(v, 0, 1)

    h_out = np.where(keep, np.where(soft, hs, h), h2 % 1.0)
    s_out = np.where(keep, np.where(soft, ss, s), s2)
    v_out = np.where(keep, np.where(soft, vs, v), v2)
    h_out = np.where(dark_hair, h, h_out)
    s_out = np.where(dark_hair, s, s_out)
    v_out = np.where(dark_hair, v, v_out)

    out = (_hsv_to_rgb(h_out, s_out, v_out) * 255).clip(0, 255).astype(np.uint8)
    res = np.dstack([out, alpha.astype(np.uint8)])
    res[alpha < 8, :3] = a[alpha < 8, :3].astype(np.uint8)
    return Image.fromarray(res, 'RGBA')


def trim_alpha(im: Image.Image, thr: int = 12) -> Image.Image:
    a = np.asarray(im.convert('RGBA'))[..., 3]
    ys, xs = np.where(a > thr)
    if len(xs) == 0:
        return im
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def extract_kh_head() -> Image.Image:
    """Cắt đầu + búi tóc từ KH #600 (không nón)."""
    im = Image.open(KH600).convert('RGBA')
    im = trim_alpha(im)
    w, h = im.size
    # đầu khoảng 28% trên
    head = im.crop((0, 0, w, int(h * 0.30)))
    head = trim_alpha(head)
    # scale về ~18px cao (khớp sprite chibi ~47px)
    target_h = 18
    tw = max(1, int(round(head.width * (target_h / head.height))))
    head = head.resize((tw, target_h), Image.Resampling.LANCZOS)
    return head


def hat_mask(rgb: np.ndarray, alpha: np.ndarray, ay_hint: int) -> np.ndarray:
    """Chỉ vùng nón lá trên đỉnh đầu — không đụng áo thân."""
    H, W = rgb.shape[:2]
    ys, xs = np.where(alpha > 40)
    if len(xs) == 0:
        return np.zeros((H, W), dtype=bool)
    y0, y1 = int(ys.min()), int(ys.max())
    ch = max(1, y1 - y0 + 1)
    # nón nằm trong ~30% trên của silhouette
    top_band = (np.arange(H)[:, None] >= y0) & (np.arange(H)[:, None] < y0 + int(ch * 0.30))

    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mean = rgb.mean(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    # nón lá: vàng/nâu ấm sáng
    warm = (r > b + 18) & (g > b + 8) & (r > 110) & (mean > 110) & (mean < 225) & (chroma > 22)
    # da mặt (giữ)
    skin = (r > 145) & (r < 225) & (g > 105) & (g < 185) & (b > 85) & (b < 165) & (chroma < 75)
    return top_band & (alpha > 30) & warm & (~skin)


def remove_hat_and_place_head(frame: Image.Image, head: Image.Image, meta: dict) -> Image.Image:
    """Chỉ xóa nón lá; neo đầu KH vào đỉnh THÂN (bỏ qua mũi kiếm/vũ khí)."""
    fr = frame.convert('RGBA')
    a = np.asarray(fr).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    H, W = rgb.shape[:2]

    opaque = alpha > 40
    ys, xs = np.where(opaque)
    if len(xs) == 0:
        return fr

    y0, y1 = int(ys.min()), int(ys.max())
    ch = max(1, y1 - y0 + 1)
    mask = hat_mask(rgb, alpha, meta.get('ay', H - 2))

    mean = rgb.mean(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    white_top = (
        (np.arange(H)[:, None] >= y0) & (np.arange(H)[:, None] < y0 + int(ch * 0.28))
        & (mean > 165) & (chroma < 36) & (alpha > 30)
    )
    clear = mask | white_top
    out_a = alpha.copy()
    out_a[clear] = 0
    base = Image.fromarray(
        np.dstack([rgb.astype(np.uint8), out_a.astype(np.uint8)]), 'RGBA'
    )

    # Đỉnh thân = hàng đầu có bề ngang đủ rộng (không phải mũi kiếm mỏng)
    row_w = opaque.sum(axis=1)
    body_rows = np.where(row_w >= 8)[0]
    if len(body_rows) == 0:
        body_rows = np.where(row_w >= 4)[0]
    if len(body_rows) == 0:
        body_top = y0
        cx = int((int(xs.min()) + int(xs.max())) / 2)
    else:
        body_top = int(body_rows[0])
        # tâm ngang tại vài hàng gần đỉnh thân
        band = opaque[body_top:min(H, body_top + 6)]
        bxs = np.where(band.any(axis=0))[0]
        cx = int((int(bxs.min()) + int(bxs.max())) / 2) if len(bxs) else W // 2

    hx = cx - head.width // 2
    hy = max(0, body_top - head.height + 12)
    base.alpha_composite(head, (hx, hy))
    return base


def process_sheet(src: Path, dst: Path, meta: dict, mode: str, head: Image.Image | None) -> Image.Image:
    im = Image.open(src).convert('RGBA')
    w, h, n, d = meta['w'], meta['h'], meta['n'], meta['d']
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))

    for row in range(d):
        for col in range(n):
            cell = im.crop((col * w, row * h, (col + 1) * w, (row + 1) * h))
            if head is not None:
                cell = remove_hat_and_place_head(cell, head, meta)
            cell = recolor(cell, mode)
            out.paste(cell, (col * w, row * h))

    out = ImageEnhance.Brightness(out).enhance(1.04)
    out = ImageEnhance.Color(out).enhance(1.08)
    out = out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=2))
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, 'WEBP', quality=92, method=4)
    return out


def portrait_from_sheet(sheet: Image.Image, meta: dict, out: Path) -> dict:
    w, h = meta['w'], meta['h']
    fr = sheet.crop((0, 0, w, h)).convert('RGBA')
    out.parent.mkdir(parents=True, exist_ok=True)
    fr.save(out, 'PNG', optimize=True)
    return {
        'img': str(out.relative_to(ROOT)).replace('\\', '/'),
        'sz': [w, h, meta['ax'], meta['ay']],
    }


def build_faction(key: str, cfg: dict, head: Image.Image | None) -> tuple[dict, dict]:
    src = cfg['src_anim']
    out = cfg['out_anim']
    meta_src = META[src]
    use_head = head if cfg.get('head_swap') else None
    print(f'== {cfg["label"]}  {src} → {out} ({cfg["mode"]}) head_swap={use_head is not None} ==')
    out_meta = {}
    st_im = None
    for act in ACTS:
        src_path = OUT_A / f'{src}_{act}.webp'
        if not src_path.is_file():
            raise FileNotFoundError(src_path)
        dst_path = OUT_A / f'{out}_{act}.webp'
        m = dict(meta_src[act])
        im = process_sheet(src_path, dst_path, m, cfg['mode'], use_head)
        m['f'] = dst_path.name
        m['fixed'] = 1
        out_meta[act] = m
        print(' ', act, '→', dst_path.name, im.size, f"n={m['n']} d={m['d']}")
        if act == 'st':
            st_im = im

    por = portrait_from_sheet(st_im, out_meta['st'], OUT_PL / f'{cfg["out_portrait"]}.png')
    hero = {
        'img': por['img'],
        'sz': por['sz'],
        'anim': out,
        'mode': cfg['mode'],
        'src': src,
        'khHead': 600 if use_head is not None else None,
    }
    print(' portrait', por)
    return hero, out_meta


def main():
    head = extract_kh_head()
    print('KH head', head.size)
    head.save(OUT_PL / '_kh_head_preview.png')

    heroes, anims = {}, {}
    for key, cfg in PACK.items():
        hero, meta = build_faction(key, cfg, head)
        heroes[key] = hero
        anims[cfg['out_anim']] = meta

    data = {
        'series': 'Việt★',
        'seriesCol': '#d4a017',
        'seriesDesc': 'Admin · Yên Tử★ · Bạch Đằng★ · Thạch Sơn★ (anim 8 hướng + đầu KH trẻ)',
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
        '/* auto-generated by tools/viet_char_build.py — 8-dir limb + KH young head */\n'
        '(typeof window!=="undefined"?window:globalThis).VIET_CHAR = '
        + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8',
    )
    (PACK_DIR / 'README.md').write_text(
        '# Nguồn Kiếm Hiệp (đầu trẻ Việt★)\n\n'
        '- `600.png` → đầu búi tóc thay nón lá (Yên Tử★ / Thạch Sơn★)\n'
        '- Anim 8 hướng lấy từ Võ Đang / Côn Lôn / Nga My (tay chân mượt như NV gốc)\n\n'
        'Tái tạo: `python3 tools/viet_char_build.py`\n',
        encoding='utf-8',
    )
    print('wrote', out_js)


if __name__ == '__main__':
    main()
