#!/usr/bin/env python3
"""Dựng nhân Việt★ MỚI — không recolor nón lá cũ.

Nam (Yên Tử★ / Thạch Sơn★): pose Kiếm Hiệp #600 (tóc búi, không nón) +
  các pose 580/620/640/680/700 cho đứng/chạy/đánh. Anim tay–chân bằng
  tách nửa trên/dưới + shear/bob (không còn silhouette Côn Lôn).

Nữ (Bạch Đằng★): sheet 8 hướng Nga My + tông son (đã khác nam).

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

# Pose KH theo hành động (cùng set áo xanh → recolor gold/earth)
KH_POSE = {
    'st':   [600],
    'run':  [620, 640, 680, 620],
    'at':   [700, 680, 640, 700],
    'hurt': [600],
    'die':  [600],
    'back': [580],  # hướng lưng
}
ACTS = ['st', 'run', 'at', 'hurt', 'die']

PACK = {
    'ys': {
        'mode': 'gold',
        'out_anim': 'pl_viet_ys',
        'out_portrait': 'viet_ys',
        'label': 'Yên Tử★',
        'target_h': 72,
        'kind': 'kh_male',
    },
    'tn': {
        'mode': 'earth',
        'out_anim': 'pl_viet_tn',
        'out_portrait': 'viet_tn',
        'label': 'Thạch Sơn★',
        'target_h': 72,
        'kind': 'kh_male',
    },
    'bd': {
        'src_anim': 'pl_emei',
        'mode': 'son',
        'out_anim': 'pl_viet_bd',
        'out_portrait': 'viet_bd',
        'label': 'Bạch Đằng★',
        'kind': 'sheet8',
        'deage': False,
    },
}

META_EMEI = {
    'st':   {'n': 12, 'd': 8, 'w': 50, 'h': 46, 'ax': 25, 'ay': 44, 'ms': 120},
    'run':  {'n': 6,  'd': 8, 'w': 74, 'h': 44, 'ax': 37, 'ay': 43, 'ms': 70},
    'at':   {'n': 7,  'd': 8, 'w': 98, 'h': 67, 'ax': 49, 'ay': 61, 'ms': 60},
    'hurt': {'n': 4,  'd': 8, 'w': 62, 'h': 47, 'ax': 31, 'ay': 45, 'ms': 80},
    'die':  {'n': 8,  'd': 8, 'w': 131,'h': 75, 'ax': 66, 'ay': 49, 'ms': 95},
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
    """Đổi tông áo xanh KH → vàng / đất / son; giữ da + kim loại sáng."""
    im = im.convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3] / 255.0
    alpha = a[..., 3]
    h, s, v = _rgb_to_hsv(rgb)
    soft = (s < 0.10) & (v > 0.78)
    skin = (h > 0.02) & (h < 0.14) & (s > 0.10) & (s < 0.55) & (v > 0.30) & (v < 0.95)
    # tóc tối / đen — giữ
    dark_hair = (v < 0.28) & (s < 0.35) & (alpha > 40)
    keep = soft | skin | dark_hair

    if mode == 'gold':
        # áo → hổ phách / vàng đồng
        h2 = 0.10 + (h - 0.55) * 0.08
        s2 = np.clip(s * 1.15 + 0.18, 0, 1)
        v2 = np.clip(v * 1.08 + 0.04, 0, 1)
        hs, ss, vs = 0.12, 0.28, np.clip(v * 1.04, 0, 1)
    elif mode == 'earth':
        # hệ Thổ: nâu đất / hổ phách đậm (khác hẳn xanh KH gốc)
        h2 = 0.075 + (h - 0.55) * 0.06
        s2 = np.clip(s * 1.25 + 0.22, 0, 1)
        v2 = np.clip(v * 1.05 + 0.02, 0, 1)
        hs, ss, vs = 0.10, 0.30, np.clip(v * 1.03, 0, 1)
    else:
        # đỏ son
        h2 = 0.985 + (h - 0.55) * 0.05
        s2 = np.clip(s * 1.2 + 0.16, 0, 1)
        v2 = np.clip(v * 1.04, 0, 1)
        hs, ss, vs = 0.0, 0.06, np.clip(v, 0, 1)

    h_out = np.where(keep, np.where(soft, hs, h), h2 % 1.0)
    s_out = np.where(keep, np.where(soft, ss, s), s2)
    v_out = np.where(keep, np.where(soft, vs, v), v2)
    # tóc giữ nguyên
    h_out = np.where(dark_hair, h, h_out)
    s_out = np.where(dark_hair, s, s_out)
    v_out = np.where(dark_hair, v, v_out)

    out = _hsv_to_rgb(h_out, s_out, v_out)
    out = (np.clip(out, 0, 1) * 255).astype(np.uint8)
    res = np.dstack([out, alpha.astype(np.uint8)])
    res[alpha < 8, :3] = a[alpha < 8, :3].astype(np.uint8)
    return Image.fromarray(res, 'RGBA')


def trim_alpha(im: Image.Image, thr: int = 12) -> Image.Image:
    im = im.convert('RGBA')
    a = np.asarray(im)[..., 3]
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
    im = ImageEnhance.Brightness(im).enhance(1.05)
    im = ImageEnhance.Color(im).enhance(1.12)
    im = im.filter(ImageFilter.UnsharpMask(radius=0.7, percent=70, threshold=2))
    w, h = im.size
    sc = target_h / h
    nw, nh = max(1, int(round(w * sc))), max(1, int(round(h * sc)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def paste_centered(canvas: Image.Image, spr: Image.Image, ox: int = 0, oy: int = 0):
    cw, ch = canvas.size
    sw, sh = spr.size
    x = (cw - sw) // 2 + ox
    y = (ch - sh) // 2 + oy
    canvas.alpha_composite(spr, (max(0, x), max(0, y)))


def limb_warp(im: Image.Image, *, leg_shear: float = 0.0, leg_dx: int = 0,
              arm_rot: float = 0.0, bob: int = 0, torso_dx: int = 0) -> Image.Image:
    """Tách nửa trên/dưới — chân shear + thân nghiêng để thấy tay/chân chuyển."""
    im = trim_alpha(im)
    w, h = im.size
    pad = max(12, int(max(w, h) * 0.25))
    base = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    paste_centered(base, im)

    split = int(base.height * 0.48)  # eo
    upper = base.crop((0, 0, base.width, split + 4))
    lower = base.crop((0, split - 2, base.width, base.height))

    # chân: shear ngang + dịch
    if abs(leg_shear) > 1e-3 or leg_dx:
        sh = leg_shear
        shx = sh * lower.height
        lower = lower.transform(
            lower.size, Image.Transform.AFFINE,
            (1, sh, -shx * 0.5 + leg_dx, 0, 1, 0),
            resample=Image.Resampling.BILINEAR,
        )

    # thân/tay: xoay nhẹ quanh eo
    if abs(arm_rot) > 1e-3 or torso_dx:
        upper = upper.rotate(arm_rot, resample=Image.Resampling.BILINEAR, expand=False)
        if torso_dx:
            tmp = Image.new('RGBA', upper.size, (0, 0, 0, 0))
            tmp.alpha_composite(upper, (torso_dx, 0))
            upper = tmp

    out = Image.new('RGBA', base.size, (0, 0, 0, 0))
    out.alpha_composite(lower, (0, split - 2 + bob))
    out.alpha_composite(upper, (0, bob))
    return trim_alpha(out)


def transform_sprite(im: Image.Image, *, dy=0, dx=0, rot=0.0, scale=1.0, shear=0.0) -> Image.Image:
    w, h = im.size
    pad = max(10, int(max(w, h) * 0.22))
    base = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    paste_centered(base, im)
    if abs(scale - 1.0) > 1e-3:
        nw = max(1, int(round(base.width * scale)))
        nh = max(1, int(round(base.height * scale)))
        base = base.resize((nw, nh), Image.Resampling.BILINEAR)
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
    mh = max(f.height for f in frames) + 6
    sheet = Image.new('RGBA', (mw * len(frames), mh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        x = (mw - f.width) // 2
        y = mh - f.height - 3
        sheet.alpha_composite(f, (i * mw + x, y))
    return sheet, mw, mh


def stack_dirs(rows: list[Image.Image]) -> Image.Image:
    """Ghép nhiều hàng hướng (cùng kích thước)."""
    w = max(r.width for r in rows)
    h = max(r.height for r in rows)
    out = Image.new('RGBA', (w, h * len(rows)), (0, 0, 0, 0))
    for i, r in enumerate(rows):
        out.alpha_composite(r, (0, i * h))
    return out


def make_act_frames(poses: dict[int, Image.Image], act: str, n: int) -> list[Image.Image]:
    ids = KH_POSE[act]
    frames = []
    for i in range(n):
        t = i / max(1, n - 1)
        pose_id = ids[i % len(ids)]
        base = poses[pose_id]
        if act == 'st':
            bob = int(round(math.sin(i / n * math.pi * 2) * 2))
            fr = limb_warp(base, bob=bob, arm_rot=math.sin(i / n * math.pi * 2) * 2.5,
                           leg_shear=math.sin(i / n * math.pi * 2) * 0.02)
        elif act == 'run':
            phase = math.sin(i / n * math.pi * 2)
            fr = limb_warp(
                base,
                leg_shear=phase * 0.14,
                leg_dx=int(round(phase * 3)),
                arm_rot=phase * -8,
                torso_dx=int(round(phase * 2)),
                bob=int(round(abs(phase) * 3)),
            )
            fr = transform_sprite(fr, shear=phase * 0.04, rot=phase * 2.5, scale=1.02)
        elif act == 'at':
            phase = math.sin(t * math.pi)
            fr = limb_warp(
                base,
                arm_rot=-10 + phase * 28,
                torso_dx=int(round(phase * 5)),
                leg_shear=phase * 0.06,
                bob=int(round((1 - phase) * 2)),
            )
            fr = transform_sprite(fr, dx=int(round(phase * 7)), rot=phase * 6, scale=1.0 + phase * 0.05)
        elif act == 'hurt':
            fr = limb_warp(base, arm_rot=-8 + i * 4, torso_dx=i * 2 - 2, bob=i)
            fr = transform_sprite(fr, dx=i * 2 - 3, rot=-8 + i * 5, scale=0.97)
        else:  # die
            fr = transform_sprite(base, dy=int(round(t * 14)), rot=t * 75, scale=1.0 - t * 0.12)
            arr = np.asarray(fr).copy()
            arr[..., 3] = (arr[..., 3].astype(np.float32) * (1 - t * 0.55)).astype(np.uint8)
            fr = Image.fromarray(arr, 'RGBA')
        frames.append(fr)
    return frames


def build_kh_male(cfg: dict) -> tuple[dict, dict]:
    """Sheet d=2 (trước / lưng) + flip L/R — pose KH trẻ, không nón."""
    mode, stem, th = cfg['mode'], cfg['out_anim'], cfg['target_h']
    print(f'== {cfg["label"]}  KH male → {stem} ({mode}) ==')

    need = set()
    for ids in KH_POSE.values():
        need.update(ids)
    poses = {kid: load_kh(kid, th, mode) for kid in sorted(need)}
    print(' poses', sorted(poses.keys()), 'h≈', th)

    specs = {
        'st':   dict(n=8, ms=110),
        'run':  dict(n=6, ms=80),
        'at':   dict(n=7, ms=65),
        'hurt': dict(n=4, ms=90),
        'die':  dict(n=6, ms=100),
    }
    meta = {}
    st_portrait = None

    for act, sp in specs.items():
        front = make_act_frames(poses, act, sp['n'])
        # hàng lưng: luôn từ pose 580 (view sau), cùng nhịp warp
        back_poses = dict(poses)
        for kid in list(back_poses.keys()):
            back_poses[kid] = poses[580]
        if act in ('st', 'hurt', 'die'):
            back = make_act_frames(back_poses, act, sp['n'])
        elif act == 'run':
            back = []
            for i in range(sp['n']):
                phase = math.sin(i / sp['n'] * math.pi * 2)
                back.append(limb_warp(
                    poses[580],
                    leg_shear=phase * -0.12,
                    leg_dx=int(round(phase * -3)),
                    arm_rot=phase * 7,
                    bob=int(round(abs(phase) * 3)),
                ))
        else:  # at
            back = []
            for i in range(sp['n']):
                t = i / max(1, sp['n'] - 1)
                phase = math.sin(t * math.pi)
                back.append(limb_warp(
                    poses[580],
                    arm_rot=-8 + phase * 20,
                    torso_dx=int(round(phase * -4)),
                    leg_shear=phase * -0.05,
                ))

        row_f, fw, fh = stack_row(front)
        row_b, _, _ = stack_row(back)
        # đồng nhất kích thước 2 hàng
        mw = max(row_f.width, row_b.width)
        mh = max(row_f.height, row_b.height)
        rf = Image.new('RGBA', (mw, mh), (0, 0, 0, 0))
        rb = Image.new('RGBA', (mw, mh), (0, 0, 0, 0))
        rf.alpha_composite(row_f, (0, mh - row_f.height))
        rb.alpha_composite(row_b, (0, mh - row_b.height))
        sheet = stack_dirs([rf, rb])

        path = OUT_A / f'{stem}_{act}.webp'
        path.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(path, 'WEBP', quality=92, method=4)
        meta[act] = {
            'f': path.name,
            'n': sp['n'], 'd': 2, 'w': fw, 'h': mh,
            'ax': fw // 2, 'ay': mh - 3,
            'ms': sp['ms'], 'fixed': 1, 'flip': 1,
        }
        print(' ', act, '→', path.name, sheet.size, f'n={sp["n"]} d=2')
        if act == 'st':
            st_portrait = front[0]

    por_path = OUT_PL / f'{cfg["out_portrait"]}.png'
    por_path.parent.mkdir(parents=True, exist_ok=True)
    st_portrait.save(por_path, 'PNG', optimize=True)
    pw, ph = st_portrait.size
    hero = {
        'img': str(por_path.relative_to(ROOT)).replace('\\', '/'),
        'sz': [pw, ph, pw // 2, ph - 2],
        'anim': stem,
        'mode': mode,
        'src': 'kh600',
        'khId': 600,
    }
    print(' portrait', hero['img'], hero['sz'])
    return hero, meta


def build_sheet8(cfg: dict) -> tuple[dict, dict]:
    src, out, mode = cfg['src_anim'], cfg['out_anim'], cfg['mode']
    print(f'== {cfg["label"]}  {src} → {out} ({mode}) ==')
    out_meta = {}
    st_im = None
    for act in ACTS:
        src_path = OUT_A / f'{src}_{act}.webp'
        if not src_path.is_file():
            raise FileNotFoundError(src_path)
        im = Image.open(src_path).convert('RGBA')
        im = recolor(im, mode)
        im = ImageEnhance.Brightness(im).enhance(1.05)
        im = ImageEnhance.Color(im).enhance(1.08)
        dst = OUT_A / f'{out}_{act}.webp'
        im.save(dst, 'WEBP', quality=92, method=4)
        m = dict(META_EMEI[act])
        m['f'] = dst.name
        m['fixed'] = 1
        out_meta[act] = m
        print(' ', act, '→', dst.name, im.size)
        if act == 'st':
            st_im = im
    # portrait = frame đầu
    w, h = out_meta['st']['w'], out_meta['st']['h']
    fr = st_im.crop((0, 0, w, h))
    por = OUT_PL / f'{cfg["out_portrait"]}.png'
    fr.save(por, 'PNG', optimize=True)
    hero = {
        'img': str(por.relative_to(ROOT)).replace('\\', '/'),
        'sz': [w, h, out_meta['st']['ax'], out_meta['st']['ay']],
        'anim': out,
        'mode': mode,
        'src': src,
    }
    return hero, out_meta


def main():
    heroes = {}
    anims = {}
    for key, cfg in PACK.items():
        if cfg['kind'] == 'kh_male':
            hero, meta = build_kh_male(cfg)
        else:
            hero, meta = build_sheet8(cfg)
        heroes[key] = hero
        anims[cfg['out_anim']] = meta

    data = {
        'series': 'Việt★',
        'seriesCol': '#d4a017',
        'seriesDesc': 'Admin · Yên Tử★ · Bạch Đằng★ · Thạch Sơn★ (nam Thổ KH#600)',
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
        '/* auto-generated by tools/viet_char_build.py — Việt★ KH#600 (không nón lá) */\n'
        '(typeof window!=="undefined"?window:globalThis).VIET_CHAR = '
        + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8',
    )
    (PACK_DIR / 'README.md').write_text(
        '# Nguồn Kiếm Hiệp (nhân Việt★ trẻ — dựng lại)\n\n'
        '- `600.png` + `580/620/640/680/700` → Yên Tử★ / Thạch Sơn★ (nam, không nón)\n'
        '- `75.png` tham chiếu nữ; Bạch Đằng★ dùng sheet Nga My 8 hướng\n\n'
        'Tái tạo: `python3 tools/viet_char_build.py`\n',
        encoding='utf-8',
    )
    print('wrote', out_js)


if __name__ == '__main__':
    main()
