#!/usr/bin/env python3
"""Hệ thống lại sheet quái → assets/pack/quai/

Đọc JW.mon / JW.anim / JW.zones từ world.js + zones2.js,
hardlink sheet từ img/a/ và chân dung img/m/ vào:

  assets/pack/quai/
    catalog.json  index.json  monsters.csv  README.md
    stems/<stem>/{st,run,at,hurt,die}.webp + meta.json + portrait.png
    portraits/<stem>.png
    by_type/{ani,boss,enemy}/<stem>  → symlink tới stems/<stem>

Chạy: python3 tools/quai_pack.py
"""
from __future__ import annotations

import csv
import json
import os
import shutil
import subprocess
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'pack' / 'quai'
A = ROOT / 'img' / 'a'
M = ROOT / 'img' / 'm'
ACTS = ['st', 'run', 'at', 'hurt', 'die']


def load_jw() -> dict:
    code = r'''
const fs=require("fs"); const vm=require("vm");
const ctx={console}; ctx.window=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync("world.js","utf8"), ctx);
vm.runInContext("var JW=window.JW;", ctx);
vm.runInContext(fs.readFileSync("zones2.js","utf8"), ctx);
const JW=ctx.JW||ctx.window.JW;
const animKeys=Object.keys(JW.anim).filter(k=>/^(ani|boss|enemy)/.test(k));
const out={
  zones: JW.zones.map(z=>({id:z.id,n:z.n,lo:z.lo,hi:z.hi,m:z.m||[],boss:z.boss,sw:z.sw})),
  mon: JW.mon,
  anim: {}
};
for (const k of animKeys) out.anim[k]=JW.anim[k];
fs.writeFileSync(process.argv[2], JSON.stringify(out));
'''
    tmp = Path('/tmp/quai_jw_dump.js')
    outj = Path('/tmp/quai_jw_dump.json')
    tmp.write_text(code, encoding='utf-8')
    subprocess.check_call(['node', str(tmp), str(outj)], cwd=str(ROOT))
    return json.loads(outj.read_text(encoding='utf-8'))


def stem_type(stem: str) -> str:
    if stem.startswith('boss'):
        return 'boss'
    if stem.startswith('enemy'):
        return 'enemy'
    return 'ani'


def link_or_copy(src: Path, dst: Path, stats: dict):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists() or dst.is_symlink():
        dst.unlink()
    try:
        os.link(src, dst)
        stats['hardlinks'] += 1
    except OSError:
        shutil.copy2(src, dst)
        stats['copies'] += 1
    stats['files'] += 1


def main():
    print('load JW…')
    jw = load_jw()
    mons_raw, anims, zones = jw['mon'], jw['anim'], jw['zones']

    disk: dict[str, dict[str, Path]] = defaultdict(dict)
    for p in sorted(A.glob('*.webp')):
        if not p.stem.startswith(('ani', 'boss', 'enemy')):
            continue
        stem, act = p.stem.rsplit('_', 1)
        if act in ACTS:
            disk[stem][act] = p

    stem_mons: dict[str, list] = defaultdict(list)
    monsters = []
    for tid, v in mons_raw.items():
        anim = v.get('anim')
        if not anim:
            continue
        entry = {
            'id': int(tid),
            'n': v.get('n') or '',
            'anim': anim,
            'img': v.get('img') or '',
            'series': v.get('series'),
        }
        monsters.append(entry)
        stem_mons[anim].append({'id': entry['id'], 'n': entry['n']})

    stem_zones: dict[str, list] = defaultdict(list)
    mon_zones: dict[int, list] = defaultdict(list)
    seen: dict[str, set] = defaultdict(set)
    for z in zones:
        zinfo = {'id': z['id'], 'n': z['n'], 'lo': z.get('lo'), 'hi': z.get('hi')}
        tids = list(z.get('m') or [])
        if z.get('boss') is not None:
            tids.append(z['boss'])
        for tid in tids:
            tid = int(tid)
            m = mons_raw.get(str(tid))
            if not m or not m.get('anim'):
                continue
            anim = m['anim']
            mon_zones[tid].append(zinfo)
            if z['id'] not in seen[anim]:
                seen[anim].add(z['id'])
                stem_zones[anim].append(zinfo)

    if OUT.exists():
        shutil.rmtree(OUT)
    for sub in ['stems', 'portraits', 'by_type/ani', 'by_type/boss', 'by_type/enemy']:
        (OUT / sub).mkdir(parents=True, exist_ok=True)

    stats = {
        'ani': 0, 'boss': 0, 'enemy': 0,
        'files': 0, 'hardlinks': 0, 'copies': 0, 'missing_acts': 0,
    }
    stems_out = {}
    all_stems = sorted(set(disk) | set(stem_mons) | set(anims))

    for stem in all_stems:
        typ = stem_type(stem)
        stats[typ] += 1
        stem_dir = OUT / 'stems' / stem
        stem_dir.mkdir(parents=True, exist_ok=True)

        type_link = OUT / 'by_type' / typ / stem
        if type_link.exists() or type_link.is_symlink():
            type_link.unlink()
        os.symlink(os.path.relpath(stem_dir, type_link.parent), type_link)

        acts_meta = {}
        missing = []
        for act in ACTS:
            src = disk.get(stem, {}).get(act)
            meta = (anims.get(stem) or {}).get(act) or {}
            if src and src.exists():
                link_or_copy(src, stem_dir / f'{act}.webp', stats)
                acts_meta[act] = {
                    'file': f'{act}.webp',
                    'src': f'img/a/{src.name}',
                    'bytes': src.stat().st_size,
                    'n': meta.get('n'), 'd': meta.get('d'),
                    'w': meta.get('w'), 'h': meta.get('h'),
                    'ax': meta.get('ax'), 'ay': meta.get('ay'),
                    'ms': meta.get('ms'),
                }
            else:
                missing.append(act)
                stats['missing_acts'] += 1

        portrait = None
        cands = []
        for m in stem_mons.get(stem, []):
            full = next((x for x in monsters if x['id'] == m['id']), None)
            if full and full.get('img'):
                cands.append(ROOT / full['img'])
        cands.append(M / f'{stem}.png')
        for c in cands:
            if c.is_file():
                link_or_copy(c, OUT / 'portraits' / f'{stem}.png', stats)
                link_or_copy(c, stem_dir / 'portrait.png', stats)
                portrait = f'portraits/{stem}.png'
                break

        entry = {
            'stem': stem,
            'type': typ,
            'path': f'stems/{stem}/',
            'acts': acts_meta,
            'missing_acts': missing,
            'complete': not missing and len(acts_meta) == 5,
            'portrait': portrait,
            'mons': stem_mons.get(stem, []),
            'zones': stem_zones.get(stem, []),
            'in_game_anim': stem in anims,
            'on_disk': stem in disk,
            'used_by_mon': bool(stem_mons.get(stem)),
        }
        (stem_dir / 'meta.json').write_text(
            json.dumps(entry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
        )
        stems_out[stem] = entry

    mon_list = []
    for m in sorted(monsters, key=lambda x: x['id']):
        mon_list.append({
            **m,
            'stem': m['anim'],
            'type': stem_type(m['anim']),
            'zones': mon_zones.get(m['id'], []),
            'pack': f"stems/{m['anim']}/",
            'complete': stems_out.get(m['anim'], {}).get('complete', False),
        })

    unused = [s for s, e in stems_out.items() if not e['used_by_mon']]
    incomplete = [s for s, e in stems_out.items() if not e['complete']]

    catalog = {
        'id': 'quai',
        'label': 'Sheet quái VLTK (npcres → webp)',
        'generated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'source': {
            'runtime_sheets': 'img/a/<stem>_<act>.webp',
            'runtime_portraits': 'img/m/<stem>.png',
            'meta': 'world.js JW.anim / JW.mon + zones2.js',
            'note': 'Hardlink tới file gốc — game vẫn đọc img/a/. Chạy lại: python3 tools/quai_pack.py',
        },
        'stats': {
            'stems': len(stems_out),
            'ani': stats['ani'], 'boss': stats['boss'], 'enemy': stats['enemy'],
            'monsters': len(mon_list), 'zones': len(zones),
            'files_linked': stats['files'],
            'hardlinks': stats['hardlinks'], 'copies': stats['copies'],
            'unused_stems': len(unused), 'incomplete_stems': len(incomplete),
            'acts': ACTS,
        },
        'acts': ACTS,
        'types': {
            'ani': sorted(s for s, e in stems_out.items() if e['type'] == 'ani'),
            'boss': sorted(s for s, e in stems_out.items() if e['type'] == 'boss'),
            'enemy': sorted(s for s, e in stems_out.items() if e['type'] == 'enemy'),
        },
        'unused_stems': unused,
        'incomplete_stems': incomplete,
        'stems': stems_out,
        'monsters': mon_list,
        'zones': [
            {
                'id': z['id'], 'n': z['n'], 'lo': z.get('lo'), 'hi': z.get('hi'),
                'boss': z.get('boss'),
                'mons': [
                    {
                        'id': int(tid),
                        'n': (mons_raw.get(str(tid)) or {}).get('n'),
                        'anim': (mons_raw.get(str(tid)) or {}).get('anim'),
                    }
                    for tid in (z.get('m') or [])
                    if mons_raw.get(str(tid))
                ],
            }
            for z in zones
        ],
    }
    (OUT / 'catalog.json').write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
    )

    index = {
        'stems': {
            s: {
                'type': e['type'],
                'mons': [m['n'] for m in e['mons']],
                'zones': [z['n'] for z in e['zones']],
                'complete': e['complete'],
                'path': e['path'],
            }
            for s, e in stems_out.items()
        },
        'by_mon_id': {
            str(m['id']): {'n': m['n'], 'stem': m['stem'], 'path': m['pack']}
            for m in mon_list
        },
        'by_name': {},
    }
    for m in mon_list:
        index['by_name'].setdefault(m['n'], []).append({'id': m['id'], 'stem': m['stem']})
    (OUT / 'index.json').write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
    )

    with (OUT / 'monsters.csv').open('w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['id', 'name', 'stem', 'type', 'zones', 'pack', 'complete'])
        for m in mon_list:
            w.writerow([
                m['id'], m['n'], m['stem'], m['type'],
                '; '.join(z['n'] for z in m['zones']),
                m['pack'], m['complete'],
            ])

    lines = [
        '# Thư viện sheet quái',
        '',
        f"Sinh lúc: `{catalog['generated']}` · `python3 tools/quai_pack.py`",
        '',
        f"- **{catalog['stats']['stems']} stem** "
        f"(ani {stats['ani']} · enemy {stats['enemy']} · boss {stats['boss']})",
        f"- **{catalog['stats']['monsters']} quái** · **{catalog['stats']['zones']} map**",
        f"- Sheet thiếu act: {len(incomplete)} · Stem không gắn quái: {len(unused)}",
        '',
        '## Cấu trúc',
        '',
        '```',
        'assets/pack/quai/',
        '  catalog.json / index.json / monsters.csv / README.md',
        '  portraits/<stem>.png',
        '  by_type/{ani,boss,enemy}/<stem>  →  stems/<stem>',
        '  stems/<stem>/',
        '    meta.json',
        '    st.webp  run.webp  at.webp  hurt.webp  die.webp',
        '    portrait.png',
        '```',
        '',
        'Runtime game vẫn đọc `img/a/` + `img/m/`. Pack này hardlink để **tra cứu / dựng lại**.',
        '',
        '## Danh sách theo loại',
        '',
    ]
    for typ in ['ani', 'boss', 'enemy']:
        lines += [
            f'### {typ} ({stats[typ]})',
            '',
            '| Stem | Quái | Map | Đủ 5 act |',
            '|------|------|-----|----------|',
        ]
        for s in catalog['types'][typ]:
            e = stems_out[s]
            mons = ', '.join(f"{m['n']}({m['id']})" for m in e['mons']) or '—'
            zs = ', '.join(z['n'] for z in e['zones'][:3]) or '—'
            if len(e['zones']) > 3:
                zs += f' +{len(e["zones"]) - 3}'
            ok = '✓' if e['complete'] else '✗ ' + ','.join(e['missing_acts'])
            lines.append(f'| `{s}` | {mons} | {zs} | {ok} |')
        lines.append('')
    if unused:
        lines += ['## Stem chưa gắn quái', '', ', '.join(f'`{s}`' for s in unused), '']
    (OUT / 'README.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')

    # gitignore binaries under pack (catalog/meta stay tracked)
    gi = OUT / '.gitignore'
    gi.write_text(
        '# binary hardlink — tạo lại bằng tools/quai_pack.py\n'
        'stems/**/*.webp\n'
        'stems/**/portrait.png\n'
        'portraits/*.png\n'
        'by_type/**\n',
        encoding='utf-8',
    )

    print(json.dumps(catalog['stats'], ensure_ascii=False, indent=2))
    print('wrote', OUT)


if __name__ == '__main__':
    main()
