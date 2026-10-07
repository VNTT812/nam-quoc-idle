#!/usr/bin/env python3
"""Sàn Đấu 403 — tường bao quanh sân đá + spawn trong vòng.

- Collision: lấy obs zone 56 (khớp art), chặn mọi ô ngoài ARENA, mở trong ARENA.
- Visual: vẽ tường đá thấp quanh biên ARENA (không đè layout lệch).
- Spawn A/B: hai đầu trong sân.
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import subprocess
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
Z = ROOT / "img" / "z"
JMO2 = ROOT / "jmo2.js"
PK = ROOT / "js" / "pk_arena.js"
ART = Path("/opt/cursor/artifacts/pk-arena-403")
REVIEW = ROOT / "assets/pack/map-style-review/403-pk-arena"
ORIG_REV = "5f51470"

# Sân đá mở (tuyệt đối) — khung PK
ARENA = (2080, 720, 2920, 1360)  # x0,y0,x1,y1
SPAWN_A = (2180, 1040)
SPAWN_B = (2820, 1040)
CW, CH = 32, 16
GW, GH = 112, 224


def load_clean() -> Image.Image:
    # dùng 403 hiện tại (đã rebuild họa phong) làm nền vẽ tường
    return Image.open(Z / "403.jpg").convert("RGB")


def load_meta56() -> dict:
    text = (ROOT / "jmo.js").read_text()
    m = re.search(
        r'"56":\{"A":(\d+),"w":(\d+),"h":(\d+),"gw":(\d+),"gh":(\d+),"cw":(\d+),"ch":(\d+),"regions":(\d+),"blocked":(\d+),"obs":"([^"]+)"',
        text,
    )
    if not m:
        raise SystemExit("56 obs not found in jmo.js")
    return {
        "A": int(m.group(1)),
        "w": int(m.group(2)),
        "h": int(m.group(3)),
        "gw": int(m.group(4)),
        "gh": int(m.group(5)),
        "cw": int(m.group(6)),
        "ch": int(m.group(7)),
        "regions": int(m.group(8)),
        "blocked": int(m.group(9)),
        "obs": m.group(10),
    }


def decode_obs(meta: dict) -> list[int]:
    raw = base64.b64decode(meta["obs"])
    n = meta["gw"] * meta["gh"]
    blocked = [0] * n
    for k in range(n):
        if raw[k >> 3] & (1 << (k & 7)):
            blocked[k] = 1
    return blocked


def encode_obs(blocked: list[int]) -> str:
    n = len(blocked)
    raw = bytearray((n + 7) // 8)
    for k, b in enumerate(blocked):
        if b:
            raw[k >> 3] |= 1 << (k & 7)
    return base64.b64encode(bytes(raw)).decode("ascii")


def build_arena_obs(meta56: dict) -> tuple[list[int], dict]:
    blocked = decode_obs(meta56)
    ax0, ay0, ax1, ay1 = ARENA
    gx0, gy0 = ax0 // CW, ay0 // CH
    gx1, gy1 = (ax1 - 1) // CW, (ay1 - 1) // CH
    # chặn toàn map
    for i in range(len(blocked)):
        blocked[i] = 1
    # mở trong ARENA
    for gy in range(gy0, gy1 + 1):
        for gx in range(gx0, gx1 + 1):
            blocked[gy * GW + gx] = 0
    # tường collision dày 1 ô quanh biên (trừ không cần — biên đã là blocked)
    n_free = sum(1 for b in blocked if not b)
    meta = {
        "A": meta56["A"],
        "w": meta56["w"],
        "h": meta56["h"],
        "gw": GW,
        "gh": GH,
        "cw": CW,
        "ch": CH,
        "regions": 1,
        "blocked": len(blocked) - n_free,
        "obs": encode_obs(blocked),
    }
    print(f"arena cells free={n_free} blocked={meta['blocked']} box=({gx0},{gy0})-({gx1},{gy1})")
    return blocked, meta


def patch_jmo2(meta: dict) -> None:
    text = JMO2.read_text()
    payload = json.dumps(meta, separators=(",", ":"))
    # keep key format like others: "403":{...}
    new_entry = '"403":' + payload
    if re.search(r'"403":\{', text):
        text2, n = re.subn(r'"403":\{.*?\}(?=,")', new_entry, text, count=1)
        if n != 1:
            # fallback end of object
            text2, n = re.subn(r'"403":\{[^}]*\}', new_entry, text, count=1)
        if n != 1:
            raise SystemExit("failed to replace 403 in jmo2.js")
        text = text2
    else:
        # insert before closing }};
        text = text.replace("}};", "," + new_entry + "}};", 1)
    JMO2.write_text(text)
    print("patched jmo2.js 403")


def sample_wall_colors(img: Image.Image) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    a = np.asarray(img, dtype=np.float32)
    # sample existing perimeter wall (white/grey) near courtyard edge
    patches = [
        a[980:1020, 1880:1960],
        a[1280:1320, 3000:3080],
        a[620:660, 2400:2480],
    ]
    cols = []
    for p in patches:
        if p.size:
            cols.append(p.reshape(-1, 3).mean(0))
    body = tuple(int(x) for x in np.mean(cols, 0)) if cols else (150, 145, 138)
    cap = (max(40, body[0] - 55), max(35, body[1] - 55), max(30, body[2] - 55))
    return body, cap  # type: ignore


def draw_arena_walls(img: Image.Image) -> Image.Image:
    """Vẽ tường vữa + mái ngói quanh ARENA — thân nằm ngoài biên walkable."""
    out = img.convert("RGBA")
    body, _ = sample_wall_colors(img)
    plaster = (
        min(210, body[0] + 35),
        min(205, body[1] + 32),
        min(195, body[2] + 28),
    )
    roof = (72, 62, 52)
    roof_hi = (95, 82, 68)
    x0, y0, x1, y1 = ARENA
    thick = 28
    height = 36
    layer = Image.new("RGBA", out.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    def h_wall(x_left: int, x_right: int, y: int, outward: int) -> None:
        # outward <0 : tường phía trên (ra ngoài lên); >0 : phía dưới
        if outward < 0:
            y_top, y_bot = y - height, y + 3
        else:
            y_top, y_bot = y - 3, y + height
        d.rectangle([x_left, y_top, x_right, y_bot], fill=plaster + (242,))
        # mái
        ry = y_top if outward < 0 else y_bot - 10
        d.rectangle([x_left - 3, ry - 6, x_right + 3, ry + 6], fill=roof + (250,))
        d.rectangle([x_left, ry - 3, x_right, ry + 2], fill=roof_hi + (250,))
        # bóng trong sân
        sy = y + 2 if outward < 0 else y - 6
        d.rectangle([x_left + 2, sy, x_right + 4, sy + 7], fill=(18, 16, 12, 75))

    def v_wall(y_top: int, y_bot: int, x: int, outward: int) -> None:
        if outward < 0:
            x_l, x_r = x - thick, x + 3
        else:
            x_l, x_r = x - 3, x + thick
        d.rectangle([x_l, y_top, x_r, y_bot], fill=plaster + (242,))
        # mái dọc (đỉnh tường)
        d.rectangle([x_l - 2, y_top - 8, x_r + 2, y_top + 2], fill=roof + (250,))
        d.rectangle(
            [x_l + (0 if outward < 0 else thick - 8), y_top, x_l + 8 if outward < 0 else x_r, y_bot],
            fill=roof_hi + (90,),
        )
        sx = x + 2 if outward < 0 else x - 6
        d.rectangle([sx, y_top + 2, sx + 7, y_bot + 4], fill=(18, 16, 12, 75))

    ax0, ay0, ax1, ay1 = x0, y0, x1, y1
    h_wall(ax0 - thick, ax1 + thick, ay0, -1)  # top outside
    h_wall(ax0 - thick, ax1 + thick, ay1, +1)  # bottom outside
    v_wall(ay0, ay1, ax0, -1)  # left outside
    v_wall(ay0, ay1, ax1, +1)  # right outside

    # trụ góc
    for cx, cy in ((ax0, ay0), (ax1, ay0), (ax0, ay1), (ax1, ay1)):
        d.rectangle([cx - 16, cy - height - 8, cx + 16, cy + 10], fill=plaster + (250,))
        d.rectangle([cx - 18, cy - height - 14, cx + 18, cy - height], fill=roof + (255,))

    layer = layer.filter(ImageFilter.GaussianBlur(0.3))
    out = Image.alpha_composite(out, layer)
    return out.convert("RGB")


def patch_spawns() -> None:
    text = PK.read_text()
    text2 = re.sub(
        r"spawnA:\s*\[[^\]]+\]",
        f"spawnA: [{SPAWN_A[0]}, {SPAWN_A[1]}]",
        text,
    )
    text2 = re.sub(
        r"spawnB:\s*\[[^\]]+\]",
        f"spawnB: [{SPAWN_B[0]}, {SPAWN_B[1]}]",
        text2,
    )
    if text2 == text:
        print("warn: spawn pattern not updated")
    PK.write_text(text2)
    print(f"spawns A={SPAWN_A} B={SPAWN_B}")


def save_previews(img: Image.Image, blocked: list[int]) -> None:
    ART.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    x0, y0, x1, y1 = ARENA
    crop = img.crop((x0 - 60, y0 - 60, x1 + 60, y1 + 60)).resize((900, 700), Image.LANCZOS)
    crop.save(ART / "walled-arena.jpg", quality=90)
    crop.save(REVIEW / "walled-arena.jpg", quality=90)

    # obs overlay
    vis = img.copy().resize((896, 896))
    scale = 896 / 3584
    arr = np.asarray(vis).astype(np.float32)
    for gy in range(0, GH, 2):
        for gx in range(0, GW, 2):
            if not blocked[gy * GW + gx]:
                continue
            px0, py0 = int(gx * CW * scale), int(gy * CH * scale)
            px1, py1 = int((gx + 2) * CW * scale), int((gy + 2) * CH * scale)
            arr[py0:py1, px0:px1] = arr[py0:py1, px0:px1] * 0.55 + np.array([160, 40, 40]) * 0.45
    Image.fromarray(arr.astype(np.uint8)).save(ART / "obs-walled.jpg", quality=85)

    d = ImageDraw.Draw(crop)
    # mark spawns relative
    for (sx, sy), col in ((SPAWN_A, (255, 60, 60)), (SPAWN_B, (60, 220, 60))):
        px = int((sx - (x0 - 60)) * 900 / (x1 - x0 + 120))
        py = int((sy - (y0 - 60)) * 700 / (y1 - y0 + 120))
        d.ellipse([px - 10, py - 10, px + 10, py + 10], outline=col, width=3)
    crop.save(ART / "walled-spawns.jpg", quality=90)
    print("previews saved")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    meta56 = load_meta56()
    blocked, meta403 = build_arena_obs(meta56)
    img = draw_arena_walls(load_clean())
    img = ImageEnhance.Contrast(img).enhance(1.01)
    save_previews(img, blocked)

    if args.apply:
        img.save(Z / "403.jpg", quality=91, optimize=True)
        patch_jmo2(meta403)
        patch_spawns()
        print("applied", Z / "403.jpg", (Z / "403.jpg").stat().st_size)
    else:
        print("preview only")


if __name__ == "__main__":
    main()
