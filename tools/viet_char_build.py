#!/usr/bin/env python3
"""Dựng nhân Việt★ trẻ + có animation (idle/run/at/hurt/die).

Nguồn pose: pack Kiếm Hiệp (nam #600 trẻ tóc đen, nữ #75).
Sinh sheet nhiều frame từ 1 pose (bob / nghiêng / đà đánh) — flip L/R.
Đồng thời recolor + trẻ hóa sheet 8 hướng Võ Đang/Côn Lôn làm dự phòng.

Chạy: python3 tools/viet_char_build.py
"""
from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
OUT_A = ROOT / 'img' / 'a'
OUT_PL = ROOT / 'img' / 'pl'
SRC_CANDIDATES = [
    Path('/tmp/kh_male/assets/pack/kiem_hiep'),
    Path('/tmp/kh_young/assets/pack/kiem_hiep'),
    Path('/tmp/viet_src/assets/pack/kiem_hiep'),
    ROOT / 'assets' / 'pack' / 'kiem_hiep',
]

PACK = {
    'ys': {
        'src_anim': 'pl_wudang',
        'kh_id': 600,          # nam trẻ, tóc đen, kiếm
        'mode': 'gold',
        'out_anim': 'pl_viet_ys',
        'out_portrait': 'viet_ys',
        'target_h': 78,
    },
    'bd': {
        'src_anim': 'pl_kunlun',
        'kh_id': 75,           # nữ trẻ, đỏ/trắng
        'mode': 'son',
        'out_anim': 'pl_viet_bd',
        'out_portrait': 'viet_bd',
        'target_h': 78,
    },
}
ACTS = ['st', 'run', 'at', 'hurt', 'die']
META8 = {
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
    im = im.convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3] / 255.0
    alpha = a[..., 3]
    h, s, v = _rgb_to_hsv(rgb)
    soft = (s < 0.08) & (v > 0.82)
    skin = (h > 0.02) & (h < 0.12) & (s > 0.15) & (s < 0.55) & (v > 0.35) & (v < 0.95)
    if mode == 'gold':
        h2 = 0.10 + (h - 0.08) * 0.25
        s2 = np.clip(s * 1.2 + 0.12, 0, 1)
        v2 = np.clip(v * 1.06, 0, 1)
        hs, ss, vs = 0.12, 0.32, np.clip(v * 1.05, 0, 1)
    else:
        h2 = 0.98 + (h * 0.08)
        s2 = np.clip(s * 1.15 + 0.15, 0, 1)
        v2 = np.clip(v * 1.04, 0, 1)
        hs, ss, vs = 0.0, 0.08, np.clip(v, 0, 1)
    h_out = np.where(soft, hs, np.where(skin, h, h2 % 1.0))
    s_out = np.where(soft, ss, np.where(skin, s, s2))
    v_out = np.where(soft, vs, np.where(skin, v, v2))
    out = _hsv_to_rgb(h_out, s_out, v_out)
    out = (np.clip(out, 0, 1) * 255).astype(np.uint8)
    res = np.dstack([out, alpha.astype(np.uint8)])
    res[alpha < 8, :3] = a[alpha < 8, :3].astype(np.uint8)
    return Image.fromarray(res, 'RGBA')


def deage_beard(im: Image.Image) -> Image.Image:
    """Biến vùng râu/tóc bạc (sáng + ít bão hòa) ở nửa trên thành da / tóc tối — trẻ hóa sheet 8 hướng."""
    im = im.convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    hgt = a.shape[0]
    yy = np.arange(hgt)[:, None]
    # vùng mặt/cằm: ~15–55% chiều cao frame
    band = (yy > hgt * 0.12) & (yy < hgt * 0.58)
    mean = rgb.mean(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    whiteish = (mean > 160) & (chroma < 45) & (alpha > 40) & band
    # ước lượng màu da từ pixel ấm gần đó
    skin_mask = (rgb[..., 0] > rgb[..., 2] + 8) & (rgb[..., 0] > 90) & (rgb[..., 0] < 210) & (chroma > 20) & (alpha > 40) & band
    if skin_mask.any():
        skin = rgb[skin_mask].mean(axis=0)
    else:
        skin = np.array([198.0, 158.0, 128.0], dtype=np.float32)
    # tóc tối thay cho bạc trên đỉnh
    hair_band = (yy > hgt * 0.05) & (yy < hgt * 0.35)
    hair_white = (mean > 150) & (chroma < 40) & (alpha > 40) & hair_band
    hair = np.array([32.0, 28.0, 26.0], dtype=np.float32)
    out = rgb.copy()
    out[whiteish] = skin
    out[hair_white] = hair
    res = np.dstack([out.astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(res, 'RGBA')


def find_kh(kid: int) -> Path:
    for base in SRC_CANDIDATES:
        p = base / f'{kid}.png'
        if p.is_file():
            return p
    raise FileNotFoundError(f'Không thấy Kiếm Hiệp #{kid}.png')


def trim_alpha(im: Image.Image) -> Image.Image:
    im = im.convert('RGBA')
    a = np.asarray(im)[..., 3]
    ys, xs = np.where(a > 12)
    if len(xs) == 0:
        return im
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def fit_base(src: Path, target_h: int, mode: str) -> Image.Image:
    im = Image.open(src).convert('RGBA')
    im = trim_alpha(im)
    im = recolor(im, mode)
    # trẻ hơn: tăng nhẹ độ sáng/bão hòa
    im = ImageEnhance.Brightness(im).enhance(1.06)
    im = ImageEnhance.Color(im).enhance(1.12)
    w, h = im.size
    sc = target_h / h
    nw, nh = max(1, int(round(w * sc))), max(1, int(round(h * sc)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def paste_centered(canvas: Image.Image, spr: Image.Image, ox: int = 0, oy: int = 0):
    cw, ch = canvas.size
    sw, sh = spr.size
    x = (cw - sw) // 2 + ox
    y = (ch - sh) // 2 + oy
    canvas.alpha_composite(spr, (x, y))


def transform_sprite(im: Image.Image, *, dy=0, dx=0, rot=0.0, scale=1.0, shear=0.0) -> Image.Image:
    """Tạo 1 frame biến dạng nhẹ từ sprite gốc."""
    w, h = im.size
    pad = max(8, int(max(w, h) * 0.2))
    base = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    paste_centered(base, im)
    # scale
    if abs(scale - 1.0) > 1e-3:
        nw = max(1, int(round(base.width * scale)))
        nh = max(1, int(round(base.height * scale)))
        base = base.resize((nw, nh), Image.Resampling.BILINEAR)
    # shear ngang (đà chạy / đánh)
    if abs(shear) > 1e-3:
        shx = shear * base.height
        base = base.transform(
            base.size, Image.Transform.AFFINE,
            (1, shear, -shx * 0.5, 0, 1, 0),
            resample=Image.Resampling.BILINEAR,
        )
    if abs(rot) > 1e-3:
        base = base.rotate(rot, resample=Image.Resampling.BILINEAR, expand=True)
    # dịch
    if dx or dy:
        out = Image.new('RGBA', base.size, (0, 0, 0, 0))
        out.alpha_composite(base, (dx, dy))
        base = out
    return trim_alpha(base)


def stack_h(frames: list[Image.Image]) -> tuple[Image.Image, int, int]:
    """Ghép ngang; đồng nhất kích thước frame (max w/h)."""
    mw = max(f.width for f in frames)
    mh = max(f.height for f in frames)
    # thêm padding chân để bob không cắt
    mh += 4
    sheet = Image.new('RGBA', (mw * len(frames), mh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        cell = Image.new('RGBA', (mw, mh), (0, 0, 0, 0))
        # neo chân: căn giữa ngang, đáy
        x = (mw - f.width) // 2
        y = mh - f.height - 2
        cell.alpha_composite(f, (x, y))
        sheet.paste(cell, (i * mw, 0))
    return sheet, mw, mh


def build_kh_anims(base: Image.Image, out_stem: str) -> dict:
    """Sinh st/run/at/hurt/die từ 1 pose — đủ để nhân vật 'sống' trên map."""
    specs = {
        'st': dict(n=8, ms=120, kind='idle'),
        'run': dict(n=6, ms=90, kind='run'),
        'at': dict(n=7, ms=70, kind='at'),
        'hurt': dict(n=4, ms=100, kind='hurt'),
        'die': dict(n=6, ms=110, kind='die'),
    }
    meta = {}
    for act, sp in specs.items():
        frames = []
        n = sp['n']
        for i in range(n):
            t = i / max(1, n - 1)
            kind = sp['kind']
            if kind == 'idle':
                dy = int(round(math.sin(i / n * math.pi * 2) * 5))
                rot = math.sin(i / n * math.pi * 2) * 3.5
                scale = 1.0 + 0.03 * math.sin(i / n * math.pi * 2)
                shear = math.sin(i / n * math.pi * 2) * 0.03
                fr = transform_sprite(base, dy=dy, rot=rot, scale=scale, shear=shear)
            elif kind == 'run':
                dy = int(round(abs(math.sin(i / n * math.pi * 2)) * 8))
                shear = math.sin(i / n * math.pi * 2) * 0.12
                rot = math.sin(i / n * math.pi * 2) * 8
                dx = int(round(math.sin(i / n * math.pi * 2) * 3))
                fr = transform_sprite(base, dy=-dy, dx=dx, shear=shear, rot=rot, scale=1.04)
            elif kind == 'at':
                # rút → đánh → thu
                phase = math.sin(t * math.pi)
                rot = -14 + phase * 38
                dx = int(round(phase * 12))
                dy = int(round(-phase * 4))
                shear = phase * 0.14
                fr = transform_sprite(base, dx=dx, dy=dy, rot=rot, shear=shear, scale=1.0 + phase * 0.08)
            elif kind == 'hurt':
                dx = int(round((i - n / 2) * 4))
                rot = -10 + i * 6
                fr = transform_sprite(base, dx=dx, rot=rot, scale=0.96)
            else:  # die
                rot = t * 85
                dy = int(round(t * 16))
                alpha = int(round(255 * (1 - t * 0.6)))
                fr = transform_sprite(base, dy=dy, rot=rot, scale=1.0 - t * 0.12)
                # fade
                arr = np.asarray(fr).copy()
                arr[..., 3] = (arr[..., 3].astype(np.float32) * (alpha / 255.0)).astype(np.uint8)
                fr = Image.fromarray(arr, 'RGBA')
            frames.append(fr)
        sheet, fw, fh = stack_h(frames)
        path = OUT_A / f'{out_stem}_{act}.webp'
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(path, 'WEBP', quality=92, method=4)
        meta[act] = {
            'f': path.name,
            'n': n, 'd': 1, 'w': fw, 'h': fh,
            'ax': fw // 2, 'ay': fh - 2,
            'ms': sp['ms'], 'fixed': 1, 'flip': 1,
        }
        print(' ', act, '→', path.name, sheet.size, f'frames={n}')
    return meta


def recolor_sheets_young(src_anim: str, out_anim: str, mode: str) -> dict:
    """Sheet 8 hướng dự phòng: trẻ hóa râu bạc + recolor."""
    meta = META8[src_anim]
    out_meta = {}
    for act in ACTS:
        src = OUT_A / f'{src_anim}_{act}.webp'
        if not src.is_file():
            raise FileNotFoundError(src)
        im = deage_beard(Image.open(src))
        im = recolor(im, mode)
        im = ImageEnhance.Brightness(im).enhance(1.05)
        dst = OUT_A / f'{out_anim}_8_{act}.webp'
        im.save(dst, 'WEBP', quality=90, method=4)
        m = dict(meta[act])
        m['f'] = dst.name
        m['fixed'] = 1
        out_meta[act] = m
        print('  8dir', act, '→', dst.name)
    return out_meta


def save_portrait(im: Image.Image, out: Path):
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, 'PNG', optimize=True)
    w, h = im.size
    return {'img': str(out.relative_to(ROOT)).replace('\\', '/'), 'sz': [w, h, w // 2, h - 2]}


def main():
    # copy nguồn KH vào assets để tái tạo sau này
    pack_dir = ROOT / 'assets' / 'pack' / 'kiem_hiep'
    pack_dir.mkdir(parents=True, exist_ok=True)

    heroes = {}
    anims = {}
    for key, cfg in PACK.items():
        print(f'== {key} ({cfg["out_anim"]}) KH#{cfg["kh_id"]} ==')
        kh = find_kh(cfg['kh_id'])
        # lưu nguồn
        dest = pack_dir / f'{cfg["kh_id"]}.png'
        if not dest.exists() or dest.stat().st_size != kh.stat().st_size:
            dest.write_bytes(kh.read_bytes())
        print(' KH', kh)
        base = fit_base(kh, cfg['target_h'], cfg['mode'])
        por = save_portrait(base, OUT_PL / f'{cfg["out_portrait"]}.png')
        print(' portrait', por)
        # anim chính: sheet nhiều frame từ pose KH (trẻ + có chuyển động)
        kh_meta = build_kh_anims(base, cfg['out_anim'])
        anims[cfg['out_anim']] = kh_meta
        # dự phòng 8 hướng (đã trẻ hóa)
        try:
            anims[cfg['out_anim'] + '_8'] = recolor_sheets_young(cfg['src_anim'], cfg['out_anim'], cfg['mode'])
        except Exception as e:
            print('  skip 8dir', e)
        heroes[key] = {
            'img': por['img'],
            'sz': por['sz'],
            'anim': cfg['out_anim'],                 # chính: có anim
            'anim8': cfg['out_anim'] + '_8',
            'khId': cfg['kh_id'],
            'mode': cfg['mode'],
        }

    data = {
        'series': 'Việt★',
        'seriesCol': '#d4a017',
        'seriesDesc': 'Admin · nhân Việt trẻ (Yên Tử★ · Bạch Đằng★)',
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
        '/* auto-generated by tools/viet_char_build.py — nhân Việt★ trẻ + animation */\n'
        'window.VIET_CHAR = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8',
    )
    readme = pack_dir / 'README.md'
    readme.write_text(
        '# Nguồn Kiếm Hiệp (nhân Việt★ trẻ)\n\n'
        '- `600.png` → Yên Tử★ (nam trẻ, tóc đen)\n'
        '- `75.png` → Bạch Đằng★ (nữ trẻ)\n\n'
        'Tái tạo (có anim): `python3 tools/viet_char_build.py`\n',
        encoding='utf-8',
    )
    print('wrote', out_js)


if __name__ == '__main__':
    main()
