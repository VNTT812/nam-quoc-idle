#!/usr/bin/env python3
"""Sinh FX recolor cho he Tho★ (Test): Võ Đang = vàng hổ phách, Côn Lôn = xanh băng/phong."""
from __future__ import annotations
import json, os, re, shutil
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parents[1]

def load_json_assign(path: Path, prefix: str):
    t = path.read_text(encoding='utf-8')
    i = t.find('=')
    raw = t[i + 1:].strip()
    if raw.endswith(';'):
        raw = raw[:-1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find('{')
        depth = 0
        for j, ch in enumerate(raw[start:], start):
            if ch == '{': depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    return json.loads(raw[start:j + 1])
        raise

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
    """mode: 'wd' gold/amber, 'kl' cyan/ice. Keep alpha."""
    im = im.convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3] / 255.0
    alpha = a[..., 3]
    h, s, v = _rgb_to_hsv(rgb)
    soft = (s < 0.05) & (v > 0.85)
    if mode == 'wd':
        h2 = 0.08 + h * 0.15
        s2 = np.clip(s * 1.15 + 0.12, 0, 1)
        v2 = np.clip(v * 1.05, 0, 1)
        hs, ss, vs = 0.12, 0.25, np.clip(v, 0, 1)
    else:
        h2 = 0.48 + h * 0.12
        s2 = np.clip(s * 1.1 + 0.1, 0, 1)
        v2 = np.clip(v * 1.02, 0, 1)
        hs, ss, vs = 0.52, 0.22, np.clip(v, 0, 1)
    h_out = np.where(soft, hs, h2 % 1.0)
    s_out = np.where(soft, ss, s2)
    v_out = np.where(soft, vs, v2)
    out = _hsv_to_rgb(h_out, s_out, v_out)
    out = (np.clip(out, 0, 1) * 255).astype(np.uint8)
    res = np.dstack([out, alpha.astype(np.uint8)])
    res[alpha < 8, :3] = a[alpha < 8, :3].astype(np.uint8)
    return Image.fromarray(res, 'RGBA')

def maybe_mirror(im: Image.Image, do: bool) -> Image.Image:
    return im.transpose(Image.FLIP_LEFT_RIGHT) if do else im

def save_webp(im: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, 'WEBP', quality=90, method=4)

def main():
    J = load_json_assign(ROOT / 'data.js', 'JX')
    JFX = load_json_assign(ROOT / 'fx.js', 'JFX')
    JXST = load_json_assign(ROOT / 'jxstate.js', 'JXST')
    # fx2.js merges them states T={...} into JXST
    fx2 = (ROOT / 'fx2.js').read_text(encoding='utf-8')
    mT = re.search(r',T=(\{.*?\})\};', fx2, re.S)
    if mT:
        try:
            for k, v in json.loads(mT.group(1)).items():
                JXST[str(k)] = v
        except Exception as e:
            print('fx2 T parse skip', e)
    mP = re.search(r',P=(\{.*?\})\},T=', fx2, re.S)
    if mP:
        try:
            # precast skill->key; resolve C later if needed
            pass
        except Exception:
            pass

    own = {
        'wd': [int(s['id']) for s in J['skills'].values() if s.get('f') == 'wudang'],
        'kl': [int(s['id']) for s in J['skills'].values() if s.get('f') == 'kunlun'],
    }

    # collect missile ids + state files per faction
    fac_mids = {'wd': set(), 'kl': set()}
    fac_states = {'wd': {}, 'kl': {}}  # skillId -> state meta
    src_files = set()

    for fac, ids in own.items():
        for i in ids:
            f = JFX.get('f', {}).get(str(i)) or {}
            s = JFX.get('s', {}).get(str(i))
            mid = f.get('c') if f.get('c') is not None else s
            if mid is not None and str(mid).replace('.', '').isdigit():
                fac_mids[fac].add(int(mid))
            st = JXST.get(str(i))
            if st:
                fac_states[fac][i] = st
                src_files.add(st['f'])

    for fac in ('wd', 'kl'):
        for mid in fac_mids[fac]:
            m = JFX.get('m', {}).get(str(mid))
            if not m:
                continue
            for k in ('fly', 'hit'):
                if m.get(k) and m[k].get('f'):
                    src_files.add(m[k]['f'])

    # shared precast c4 + faction precasts from fx2 naming
    extras = ['fx/c4.webp', 'fx/c2_157.webp', 'fx/c2_171.webp', 'fx/c2_173.webp',
              'fx/c2_178.webp', 'fx/c2_630.webp', 'fx/st2_211.webp']
    for p in extras:
        if (ROOT / p).exists():
            src_files.add(p)

    print('recolor files', len(src_files), 'wd mids', sorted(fac_mids['wd']), 'kl mids', sorted(fac_mids['kl']))

    # generate per-faction recolors of each unique source file
    # naming: fx/tt_{fac}_{basename}
    manifest = {'wd': {}, 'kl': {}, 'mids': {'wd': {}, 'kl': {}}, 'states': {'wd': {}, 'kl': {}}}
    for src in sorted(src_files):
        p = ROOT / src
        if not p.exists():
            print('missing', src)
            continue
        im0 = Image.open(p)
        for fac, mirror in (('wd', False), ('kl', True)):
            im = recolor(im0.copy(), fac)
            # shape tweak: KL mirror; WD slight — mirror hit sheets only for variety
            base = Path(src).name
            if fac == 'kl' and ('_fly' in base or base.startswith('st_') or base.startswith('c')):
                im = maybe_mirror(im, True)
            out_rel = f'fx/tt_{fac}_{base}'
            save_webp(im, ROOT / out_rel)
            manifest[fac][src] = out_rel
            print('wrote', out_rel)

    # missile remap tables
    for fac, base in (('wd', 8100), ('kl', 8200)):
        for mid in sorted(fac_mids[fac]):
            m = JFX.get('m', {}).get(str(mid))
            if not m:
                continue
            nm = base + mid
            nm_obj = json.loads(json.dumps(m))  # deep copy
            for k in ('fly', 'hit'):
                if nm_obj.get(k) and nm_obj[k].get('f'):
                    src = nm_obj[k]['f']
                    nm_obj[k]['f'] = manifest[fac].get(src, src)
            # slight speed/feel difference
            if 'spd' in nm_obj:
                nm_obj['spd'] = int(nm_obj['spd'] * (1.08 if fac == 'wd' else 0.92))
            manifest['mids'][fac][str(mid)] = {'id': nm, 'm': nm_obj}

    for fac in ('wd', 'kl'):
        for sid, st in fac_states[fac].items():
            ns = json.loads(json.dumps(st))
            ns['f'] = manifest[fac].get(st['f'], st['f'])
            # shape: tweak ms slightly
            ns['ms'] = max(40, int(ns.get('ms', 80) * (0.9 if fac == 'wd' else 1.15)))
            manifest['states'][fac][str(sid)] = ns

    # precast variants
    for fac in ('wd', 'kl'):
        if 'fx/c4.webp' in manifest[fac]:
            manifest[fac]['pre_c4'] = manifest[fac]['fx/c4.webp']

    out_json = ROOT / 'js' / 'tho_test_fx_data.js'
    # emit as JS assign for tho_test.js to consume
    payload = {
        'mids': manifest['mids'],
        'states': manifest['states'],
        'map': {fac: {k: v for k, v in manifest[fac].items() if not k.startswith('pre')} for fac in ('wd', 'kl')},
        'pre': {fac: manifest[fac].get('pre_c4') for fac in ('wd', 'kl')},
    }
    out_json.write_text(
        '/* auto-generated by tools/tho_test_fx.py — do not edit by hand */\n'
        'window.THO_TEST_FX = ' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8',
    )
    print('wrote', out_json)

if __name__ == '__main__':
    main()
