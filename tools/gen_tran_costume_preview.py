#!/usr/bin/env python3
"""Render gallery duyệt trang phục Trần trên sheet enemy122 (st, hướng 0, frame 0)."""
from __future__ import annotations

import json
import os
from PIL import Image, ImageDraw, ImageFont

META = {"w": 59, "h": 49, "ax": 29, "ay": 47}
SHEET = "img/a/enemy122_st.webp"
OUT_ART = "/opt/cursor/artifacts/tran_costume_review"
OUT_DOC = "docs/tran_costume_preview"

# Bản để duyệt (gốc + đang dùng + ứng viên mới)
COSTUMES = {
    "goc": None,
    "day": {"n": "Áo đay", "note": "Sơn dân · nâu đay", "body": ("#6b4e2e", 0.40), "head": ("#3f3224", 0.28)},
    "cham": {"n": "Áo chàm", "note": "Lính tuần · chàm", "body": ("#2f4f6f", 0.42), "head": ("#1a3044", 0.30)},
    "reu": {"n": "Áo rêu", "note": "Phục kích · xanh rêu", "body": ("#3a5740", 0.38), "head": ("#24382a", 0.26)},
    "muc": {"n": "Áo mực", "note": "Ám sát · mực đen", "body": ("#2c2c32", 0.44), "head": ("#16161a", 0.32)},
    "son": {"n": "Áo son", "note": "Đầu lĩnh · đỏ son", "body": ("#8a3030", 0.42), "head": ("#4e1c1c", 0.30)},
    "kim": {"n": "Áo kim", "note": "Trùm cao · vàng nhạt", "body": ("#9a7a2e", 0.40), "head": ("#5c4818", 0.28)},
    # ứng viên mới
    "bach": {"n": "Áo bạch", "note": "Lụa trắng · văn quan", "body": ("#d8d2c4", 0.46), "head": ("#8a8478", 0.28)},
    "lam": {"n": "Áo lam", "note": "Lam nhạt · thư sinh", "body": ("#4a6d8c", 0.40), "head": ("#2c4458", 0.28)},
    "dat": {"n": "Áo đất", "note": "Nâu đất đậm · nông binh", "body": ("#5a3a22", 0.44), "head": ("#2e1e12", 0.30)},
    "thao": {"n": "Áo thảo", "note": "Vàng cỏ · dân dã", "body": ("#7a6a38", 0.40), "head": ("#4a4020", 0.28)},
    "huyen": {"n": "Áo huyền", "note": "Than tối · đặc sứ", "body": ("#3a2a3a", 0.42), "head": ("#1e1620", 0.32)},
    "ngoc": {"n": "Áo ngọc", "note": "Xanh ngọc · cận vệ", "body": ("#2a5a55", 0.42), "head": ("#163832", 0.30)},
}


def hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def tint_frame(base: Image.Image, costume):
    im = base.convert("RGBA")
    if not costume:
        return im
    w, h = im.size
    ax, ay = META["ax"], META["ay"]
    head_y = max(0, ay - h * 0.8)
    split = head_y + (ay - head_y) * 0.28
    br, bg, bb = hex_rgb(costume["body"][0])
    ba = costume["body"][1]
    hr, hg, hb = hex_rgb(costume["head"][0])
    ha = costume["head"][1]
    px = im.load()
    out = im.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            r0, g0, b0, a0 = px[x, y]
            if a0 < 8:
                continue
            if y < split:
                cr, cg, cb, ca = hr, hg, hb, ha
            else:
                t = 1.0
                if y < split + 6:
                    t = max(0.0, min(1.0, (y - (split - 4)) / 10.0))
                cr, cg, cb, ca = br, bg, bb, ba * t
            op[x, y] = (
                int(r0 * (1 - ca) + cr * ca),
                int(g0 * (1 - ca) + cg * ca),
                int(b0 * (1 - ca) + cb * ca),
                a0,
            )
    return out


def main():
    os.makedirs(OUT_ART, exist_ok=True)
    os.makedirs(OUT_DOC, exist_ok=True)
    sheet = Image.open(SHEET).convert("RGBA")
    fw, fh = META["w"], META["h"]
    frame = sheet.crop((0, 0, fw, fh))
    scale = 4
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
        font2 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    except Exception:
        font = ImageFont.load_default()
        font2 = font

    keys = list(COSTUMES.keys())
    cell_w, cell_h = fw * scale + 28, fh * scale + 72
    cols = 4
    rows = (len(keys) + cols - 1) // cols
    board = Image.new("RGBA", (cols * cell_w + 24, rows * cell_h + 48), (18, 22, 20, 255))
    draw = ImageDraw.Draw(board)
    draw.text((12, 12), "Duyet trang phuc Tran — enemy122 · chon ban muon giu", fill=(230, 220, 200), font=font)

    manifest = []
    for i, key in enumerate(keys):
        c = COSTUMES[key]
        tinted = tint_frame(frame, c)
        big = tinted.resize((fw * scale, fh * scale), Image.NEAREST)
        title = "Goc (chua nhuom)" if key == "goc" else f"{key} — {c['n']}"
        note = "" if key == "goc" else c["note"]

        ind = Image.new("RGBA", (fw * scale + 48, fh * scale + 96), (18, 22, 20, 255))
        ind.paste(big, (24, 40), big)
        idr = ImageDraw.Draw(ind)
        idr.text((12, 10), title, fill=(240, 230, 210), font=font)
        if c:
            br, bg, bb = hex_rgb(c["body"][0])
            hr, hg, hb = hex_rgb(c["head"][0])
            idr.rectangle([12, fh * scale + 48, 36, fh * scale + 72], fill=(br, bg, bb))
            idr.rectangle([44, fh * scale + 48, 68, fh * scale + 72], fill=(hr, hg, hb))
            idr.text((76, fh * scale + 52), note, fill=(180, 170, 150), font=font2)
        else:
            idr.text((12, fh * scale + 52), "Sheet Vo Lam goc", fill=(180, 170, 150), font=font2)

        for folder in (OUT_ART, OUT_DOC):
            ind.save(os.path.join(folder, f"costume_{key}.png"))

        r, col = divmod(i, cols)
        x0, y0 = 12 + col * cell_w, 40 + r * cell_h
        board.paste(big, (x0 + 12, y0 + 28), big)
        draw.text((x0 + 8, y0 + 4), title[:30], fill=(235, 225, 205), font=font2)
        if c:
            br, bg, bb = hex_rgb(c["body"][0])
            hr, hg, hb = hex_rgb(c["head"][0])
            draw.rectangle([x0 + 8, y0 + fh * scale + 34, x0 + 26, y0 + fh * scale + 50], fill=(br, bg, bb))
            draw.rectangle([x0 + 30, y0 + fh * scale + 34, x0 + 48, y0 + fh * scale + 50], fill=(hr, hg, hb))

        manifest.append(
            {
                "key": key,
                "n": None if key == "goc" else c["n"],
                "note": None if key == "goc" else c["note"],
                "body": None if key == "goc" else c["body"][0],
                "head": None if key == "goc" else c["head"][0],
                "file": f"costume_{key}.png",
                "status": "reference" if key == "goc" else ("active" if key in {"day", "cham", "reu", "muc", "son", "kim"} else "candidate"),
            }
        )

    for folder in (OUT_ART, OUT_DOC):
        board.save(os.path.join(folder, "gallery.png"))
        with open(os.path.join(folder, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)

    # HTML gallery for local review
    cards = []
    for m in manifest:
        badge = m["status"]
        cards.append(
            f'<figure data-key="{m["key"]}" data-status="{badge}">'
            f'<img src="{m["file"]}" alt="{m["key"]}"/>'
            f"<figcaption><b>{m['key']}</b> · {m['n'] or 'Gốc'}<br/><small>{m['note'] or ''}</small>"
            f"<br/><em>{badge}</em></figcaption></figure>"
        )
    html = f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"/>
<title>Duyệt trang phục Trần</title>
<style>
body{{margin:0;background:#121614;color:#e8e0d0;font:14px/1.4 system-ui,sans-serif}}
header{{padding:16px 20px;border-bottom:1px solid #2a3230}}
header code{{background:#1e2624;padding:2px 6px;border-radius:4px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;padding:16px}}
figure{{margin:0;background:#1a201e;border:1px solid #2e3834;border-radius:8px;padding:10px;text-align:center}}
figure[data-status=candidate]{{border-color:#6a8f6a}}
figure[data-status=active]{{border-color:#8a6a3a}}
img{{image-rendering:pixelated;width:100%;max-width:260px;background:#0e1210}}
figcaption{{margin-top:8px}} em{{color:#9ab;font-style:normal;font-size:12px}}
</style></head><body>
<header>
  <b>Duyệt trang phục thời Trần</b> — mẫu trên sơn tặc <code>enemy122</code><br/>
  <small>active = đang gắn game · candidate = bản mới chờ bạn chọn · goc = đối chiếu</small>
</header>
<div class="grid">{"".join(cards)}</div>
</body></html>"""
    with open(os.path.join(OUT_DOC, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)
    print(f"OK {len(manifest)} previews → {OUT_ART} + {OUT_DOC}")


if __name__ == "__main__":
    main()
