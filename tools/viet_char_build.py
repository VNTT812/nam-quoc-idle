#!/usr/bin/env python3
"""Dựng nhân Việt★ từ bộ phận JX (đầu/tóc/thân/tay/vũ khí) — cùng style NV gốc.

Không đè đầu KH lên sheet kunlun. Không thay thân bằng pose KH lệch góc.
Mỗi khung ghép đúng thứ tự JX → anim 8 hướng tay chân mượt như nhân vật gốc.

Chạy: python3 tools/viet_char_build.py
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
OUT_A = ROOT / 'img' / 'a'
OUT_PL = ROOT / 'img' / 'pl'
JXLOOK = ROOT / 'jxlook.js'
META_CACHE = Path('/tmp/jx_viet_meta.json')

ACTS = ['st', 'run', 'at', 'hurt', 'die']
PARTS = ['发型', '头部', '躯体', '左手', '右手', '左手武器', '右手武器']
PART_IDX = {
    '头部': 0, '发型': 1, '肩膀': 4, '躯体': 5,
    '左手': 6, '右手': 7, '左手武器': 8, '右手武器': 9,
}

PACK = {
    'ys': {
        'mode': 'gold',
        'out_anim': 'pl_viet_ys4',
        'out_portrait': 'viet_ys4',
        'label': 'Yên Tử★',
        'sex': 'm',
        'rows': {'头部': 5, '发型': 11, '躯体': 2, '左手': 2, '右手': 2, '左手武器': 0, '右手武器': 1},
    },
    'tn': {
        'mode': 'earth',
        'out_anim': 'pl_viet_tn4',
        'out_portrait': 'viet_tn4',
        'label': 'Thạch Sơn★',
        'sex': 'm',
        # thân row 3 tối hơn; đầu 4 trẻ + tóc búi
        'rows': {'头部': 4, '发型': 11, '躯体': 3, '左手': 3, '右手': 3, '左手武器': 0, '右手武器': 1},
    },
    'bd': {
        'mode': 'son',
        'out_anim': 'pl_viet_bd4',
        'out_portrait': 'viet_bd4',
        'label': 'Bạch Đằng★',
        'sex': 'f',
        'rows': {'头部': 0, '发型': 3, '躯体': 0, '左手': 0, '右手': 0, '左手武器': 0, '右手武器': 1},
    },
}


def dump_jx_meta() -> dict:
    """Xuất foot/tabs/sheets/sort cần dùng qua node."""
    script = Path('/tmp/jx_viet_dump.js')
    script.write_text(
        r'''
const fs=require("fs"); const vm=require("vm");
const t=fs.readFileSync("jxlook.js","utf8");
const ctx={window:{}}; vm.createContext(ctx);
vm.runInContext(t.replace(/^/,"var window=this; "), ctx);
const J=ctx.window.JXLOOK;
const acts=["短武器站立","短武器跑步","短武器刺","短武器受伤","短武器死亡"];
const parts=["头部","发型","躯体","左手","右手","左手武器","右手武器"];
const out={
  foot:J.foot,
  assoc_m:J.assoc.m["单手剑1"]["0"],
  assoc_f:(J.assoc.f["单手剑1"]||J.assoc.f["空手"])["0"],
  sort_m:J.sort.m,
  sort_f:J.sort.f,
  tabs_m:{}, tabs_f:{}, sheets:{}
};
function collect(tabsSrc, tabsOut, prefix) {
  for (const part of parts) {
    if (!tabsSrc[part]) continue;
    tabsOut[part]={};
    for (const [row, tab] of Object.entries(tabsSrc[part])) {
      tabsOut[part][row]={};
      for (const act of acts) if (tab[act]) {
        tabsOut[part][row][act]=tab[act];
        const k=prefix+"/"+tab[act];
        out.sheets[k]=J.sheets[k];
      }
    }
  }
}
collect(J.tabs.m, out.tabs_m, "m");
collect(J.tabs.f, out.tabs_f, "f");
fs.writeFileSync(process.argv[2], JSON.stringify(out));
console.log("sheets", Object.keys(out.sheets).length);
''',
        encoding='utf-8',
    )
    subprocess.check_call(['node', str(script), str(META_CACHE)], cwd=str(ROOT))
    return json.loads(META_CACHE.read_text(encoding='utf-8'))


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


def recolor_clothes(im: Image.Image, mode: str) -> Image.Image:
    im = im.convert('RGBA')
    a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3] / 255.0
    alpha = a[..., 3]
    h, s, v = _rgb_to_hsv(rgb)
    soft = (s < 0.14) & (v > 0.70)
    skin = (h > 0.02) & (h < 0.16) & (s > 0.05) & (s < 0.55) & (v > 0.28) & (v < 0.97)
    dark = (v < 0.18) & (s < 0.45) & (alpha > 40)
    keep = soft | skin | dark

    if mode == 'gold':
        h2, s_add, v_mul = 0.12, 0.16, 1.08
    elif mode == 'earth':
        # áo vàng JX → nâu đất rõ hơn
        h2, s_add, v_mul = 0.055, 0.12, 0.88
    else:
        h2, s_add, v_mul = 0.0, 0.12, 1.02

    s2 = np.clip(s * 0.9 + s_add, 0, 0.58)
    v2 = np.clip(v * v_mul, 0, 1)
    h_out = np.where(keep, h, np.full_like(h, h2 % 1.0))
    s_out = np.where(keep, s, s2)
    v_out = np.where(keep, v, v2)
    out = (_hsv_to_rgb(h_out, s_out, v_out) * 255).clip(0, 255).astype(np.uint8)
    res = np.dstack([out, alpha.astype(np.uint8)])
    res[alpha < 8, :3] = a[alpha < 8, :3].astype(np.uint8)
    return Image.fromarray(res, 'RGBA')


class JxBaker:
    def __init__(self, meta: dict):
        self.meta = meta
        self.foot = meta['foot']
        self._img: dict[str, Image.Image] = {}

    def img(self, key: str) -> Image.Image:
        if key not in self._img:
            path = ROOT / 'img' / 'jx' / f'{key}.webp'
            self._img[key] = Image.open(path).convert('RGBA')
        return self._img[key]

    def order(self, sort: dict, act: str, dir16: int, frame: int) -> list[int]:
        sec = sort.get(act) or {}
        D = sort['DEFAULT']
        for k, v in sec.items():
            if k.startswith('L') and v[0] == frame:
                return v[1:]
        key = 'Dir' + str(dir16 + 1)
        v = sec.get(key) or D.get(key) or D['Dir1']
        return v[1:]

    def compose_frame(
        self,
        *,
        sex: str,
        rows: dict,
        act_name: str,
        dir_i: int,
        frame: int,
        cw: int = 110,
        ch: int = 120,
    ) -> Image.Image:
        tabs = self.meta['tabs_m' if sex == 'm' else 'tabs_f']
        sort = self.meta['sort_m' if sex == 'm' else 'sort_f']
        prefix = 'm' if sex == 'm' else 'f'
        fx, fy = self.foot

        loaded = []
        ref = None
        for part in PARTS:
            row = rows.get(part)
            if row is None:
                continue
            tab = tabs.get(part, {}).get(str(row))
            if not tab:
                continue
            nm = tab.get(act_name)
            if not nm:
                continue
            key = f'{prefix}/{nm}'
            m = self.meta['sheets'].get(key)
            if not m:
                continue
            loaded.append((part, key, m))
            if part == '躯体':
                ref = m

        if not loaded:
            return Image.new('RGBA', (1, 1), (0, 0, 0, 0))
        if ref is None:
            ref = loaded[0][2]

        nn = ref[4]
        step = int(ref[6]) if len(ref) > 6 else 1
        ord_list = self.order(sort, act_name, (dir_i % 8) * 2, frame * step)

        def sort_key(item):
            pi = PART_IDX.get(item[0], 99)
            try:
                return ord_list.index(pi)
            except ValueError:
                return 50

        loaded.sort(key=sort_key)

        canvas = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        ox, oy = cw // 2, ch - 8
        for part, key, m in loaded:
            w, h, x0, y0, pnn, dirs = m[:6]
            pfi = min(pnn - 1, frame * pnn // max(1, nn))
            pd = dir_i % 8 if dirs >= 8 else (dir_i % 8) * dirs // 8
            im = self.img(key)
            cell = im.crop((pfi * w, pd * h, pfi * w + w, pd * h + h))
            dx = int(round(ox + (x0 - fx)))
            dy = int(round(oy + (y0 - fy)))
            if dx < -w or dy < -h or dx >= cw or dy >= ch:
                continue
            # clip paste
            canvas.alpha_composite(cell, (dx, dy))
        return canvas

    def trim(self, im: Image.Image, thr: int = 18) -> Image.Image:
        a = np.asarray(im)[..., 3]
        ys, xs = np.where(a > thr)
        if len(xs) == 0:
            return im
        return im.crop((
            max(0, int(xs.min()) - 1),
            max(0, int(ys.min()) - 1),
            min(im.width, int(xs.max()) + 2),
            min(im.height, int(ys.max()) + 2),
        ))


def stack_sheet(frames_by_dir: list[list[Image.Image]]) -> tuple[Image.Image, int, int]:
    """frames_by_dir[dir][frame] → sheet d rows × n cols, cell mw×mh."""
    all_fr = [f for row in frames_by_dir for f in row]
    mw = max(f.width for f in all_fr)
    mh = max(f.height for f in all_fr)
    n = len(frames_by_dir[0])
    d = len(frames_by_dir)
    sheet = Image.new('RGBA', (mw * n, mh * d), (0, 0, 0, 0))
    for di, row in enumerate(frames_by_dir):
        for fi, fr in enumerate(row):
            x = fi * mw + (mw - fr.width) // 2
            y = di * mh + (mh - fr.height)  # chân sát đáy ô
            sheet.alpha_composite(fr, (x, y))
    return sheet, mw, mh


def build_faction(key: str, cfg: dict, baker: JxBaker, meta: dict) -> tuple[dict, dict]:
    sex = cfg['sex']
    assoc = meta['assoc_m' if sex == 'm' else 'assoc_f']
    print(f'== {cfg["label"]}  JX parts → {cfg["out_anim"]} ({cfg["mode"]}) ==')

    anim_meta = {}
    st_sheet = None
    for act in ACTS:
        act_name = assoc[act]
        # frame count from body sheet
        tabs = meta['tabs_m' if sex == 'm' else 'tabs_f']
        body_row = str(cfg['rows']['躯体'])
        body_nm = tabs['躯体'][body_row][act_name]
        prefix = 'm' if sex == 'm' else 'f'
        body_meta = meta['sheets'][f'{prefix}/{body_nm}']
        n, d = body_meta[4], body_meta[5]
        ms = {'st': 120, 'run': 70, 'at': 60, 'hurt': 80, 'die': 95}[act]

        rows_frames = []
        for di in range(d):
            row = []
            for fi in range(n):
                fr = baker.compose_frame(
                    sex=sex, rows=cfg['rows'], act_name=act_name,
                    dir_i=di, frame=fi,
                )
                fr = baker.trim(fr)
                fr = recolor_clothes(fr, cfg['mode'])
                row.append(fr)
            rows_frames.append(row)

        sheet, mw, mh = stack_sheet(rows_frames)
        # slight polish
        sheet = ImageEnhance.Brightness(sheet).enhance(1.03)
        sheet = ImageEnhance.Color(sheet).enhance(1.06)
        dst = OUT_A / f'{cfg["out_anim"]}_{act}.webp'
        dst.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(dst, 'WEBP', quality=92, method=4)
        print(f'  {act} → {dst.name} {sheet.size} n={n} d={d} cell={mw}x{mh}')
        anim_meta[act] = {
            'f': dst.name,
            'n': n, 'd': d, 'w': mw, 'h': mh,
            'ax': mw // 2, 'ay': mh - 2,
            'ms': ms, 'fixed': 1,
        }
        if act == 'st':
            st_sheet = sheet

    # portrait: dir 2 frame 0
    w, h = anim_meta['st']['w'], anim_meta['st']['h']
    por = st_sheet.crop((0, 2 * h, w, 3 * h))
    por_path = OUT_PL / f'{cfg["out_portrait"]}.png'
    por_path.parent.mkdir(parents=True, exist_ok=True)
    por.save(por_path, 'PNG', optimize=True)
    hero = {
        'img': str(por_path.relative_to(ROOT)).replace('\\', '/'),
        'sz': [w, h, w // 2, h - 2],
        'anim': cfg['out_anim'],
        'mode': cfg['mode'],
        'src': 'jx_parts',
        'rebuild': 'jx_full_parts',
    }
    print('  portrait', hero['img'], hero['sz'])
    return hero, anim_meta


def main():
    print('dump JX meta…')
    meta = dump_jx_meta()
    baker = JxBaker(meta)

    heroes, anims = {}, {}
    for key, cfg in PACK.items():
        # skip missing female hair row
        tabs = meta['tabs_m' if cfg['sex'] == 'm' else 'tabs_f']
        rows = dict(cfg['rows'])
        if cfg['sex'] == 'f':
            # pick first available hair row
            hair_rows = list(tabs.get('发型', {}).keys())
            if hair_rows and str(rows.get('发型')) not in tabs.get('发型', {}):
                rows['发型'] = int(hair_rows[0])
                cfg = dict(cfg, rows=rows)
                print('  female hair row →', rows['发型'])
        hero, am = build_faction(key, dict(cfg, rows=rows), baker, meta)
        heroes[key] = hero
        anims[cfg['out_anim']] = am

    data = {
        'series': 'Việt★',
        'seriesCol': '#d4a017',
        'seriesDesc': 'Admin · Việt★ ghép bộ phận JX (đầu/tóc/thân/tay) · anim 8 hướng như NV gốc',
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
        '/* auto-generated — Việt★ JX full-parts rebuild (no KH overlay) */\n'
        '(typeof window!=="undefined"?window:globalThis).VIET_CHAR = '
        + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n',
        encoding='utf-8',
    )
    (ROOT / 'assets' / 'pack' / 'kiem_hiep' / 'README.md').write_text(
        '# Việt★ build\n\n'
        'Nhân vật dựng từ bộ phận JX (`img/jx`) — đầu/tóc/thân/tay/vũ khí,\n'
        'anim 8 hướng giống NV gốc. Không đè đầu KH lên sheet cũ.\n\n'
        '`python3 tools/viet_char_build.py`\n',
        encoding='utf-8',
    )
    print('wrote', out_js)


if __name__ == '__main__':
    main()
