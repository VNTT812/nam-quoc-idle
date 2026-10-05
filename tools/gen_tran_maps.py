#!/usr/bin/env python3
"""Sinh nền bản đồ phong cách kiến trúc Đại Việt thời Trần + lưới vật cản (nhanh, numpy)."""
from __future__ import annotations

import base64
import json
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "img" / "z"
SIZE = 3584
CW, CH = 32, 16
GW, GH = SIZE // CW, SIZE // CH
ARCH_SCALE = 3.2

MAPS = [
    ("2", "yen_tu"), ("3", "thien_truong"), ("7", "long_hung"), ("19", "tuc_mac"),
    ("21", "con_son"), ("41", "chi_linh"), ("90", "pha_lai"), ("70", "dong_trieu"),
    ("92", "an_bang"), ("56", "van_don"), ("122", "bach_dang"), ("140", "dam_thuy"),
    ("224", "truong_yen"), ("319", "chi_lang"), ("320", "tam_dao"), ("322", "ba_vi"),
    ("town", "thang_long"),
    ("195", "nhan_dang"), ("43", "kiem_cac"), ("179", "la_tieu"), ("193", "vu_di"),
    ("74", "mieu_linh"), ("145", "tuyet_bao"), ("167", "diem_thuong"), ("68", "thanh_loa"),
    ("342", "vi_son"), ("341", "mac_bac"), ("123", "lao_ho"), ("93", "tien_cuc"),
    ("75", "khoa_lang"), ("336", "phong_lang"), ("337", "thuyen"), ("340", "mac_cao"),
    ("201", "bang_ha"), ("205", "duong_trung"),
]

THEMES = {
    "yen_tu": dict(grass=(78, 110, 72), dirt=(140, 118, 88), stone=(150, 145, 132), wc=(70, 110, 120), roof=(140, 72, 52), wood=(110, 78, 48), mist=0.18, hills=1.0, wa=0.3, buildings=5, bamboo=1.0),
    "thien_truong": dict(grass=(90, 120, 78), dirt=(150, 128, 96), stone=(160, 152, 138), wc=(72, 118, 128), roof=(132, 64, 48), wood=(118, 82, 52), mist=0.08, hills=0.4, wa=0.4, buildings=9, bamboo=0.5),
    "long_hung": dict(grass=(70, 95, 68), dirt=(130, 112, 90), stone=(145, 140, 130), wc=(65, 100, 110), roof=(120, 70, 55), wood=(100, 72, 48), mist=0.22, hills=0.8, wa=0.2, buildings=4, bamboo=0.6),
    "tuc_mac": dict(grass=(88, 118, 76), dirt=(148, 126, 94), stone=(155, 148, 135), wc=(74, 120, 125), roof=(138, 68, 50), wood=(112, 80, 50), mist=0.1, hills=0.3, wa=0.35, buildings=7, bamboo=0.8),
    "con_son": dict(grass=(68, 105, 70), dirt=(128, 110, 84), stone=(140, 138, 128), wc=(60, 105, 115), roof=(125, 66, 48), wood=(105, 75, 46), mist=0.25, hills=1.0, wa=0.25, buildings=3, bamboo=1.2),
    "chi_linh": dict(grass=(82, 115, 74), dirt=(142, 120, 90), stone=(148, 142, 130), wc=(68, 112, 118), roof=(135, 70, 50), wood=(108, 78, 48), mist=0.12, hills=0.7, wa=0.3, buildings=4, bamboo=1.4),
    "pha_lai": dict(grass=(85, 118, 80), dirt=(145, 124, 92), stone=(150, 145, 133), wc=(55, 105, 125), roof=(130, 66, 48), wood=(110, 78, 48), mist=0.1, hills=0.2, wa=0.7, buildings=5, bamboo=0.7),
    "dong_trieu": dict(grass=(76, 112, 72), dirt=(136, 116, 88), stone=(145, 140, 128), wc=(62, 108, 115), roof=(128, 68, 50), wood=(106, 76, 46), mist=0.15, hills=0.9, wa=0.35, buildings=4, bamboo=1.0),
    "an_bang": dict(grass=(60, 98, 64), dirt=(120, 105, 80), stone=(135, 132, 122), wc=(55, 95, 105), roof=(118, 62, 46), wood=(98, 70, 44), mist=0.28, hills=1.0, wa=0.2, buildings=2, bamboo=1.5),
    "van_don": dict(grass=(95, 125, 85), dirt=(155, 135, 100), stone=(165, 158, 145), wc=(50, 115, 140), roof=(145, 75, 55), wood=(120, 85, 55), mist=0.12, hills=0.15, wa=0.85, buildings=6, bamboo=0.4, coastal=1),
    "bach_dang": dict(grass=(80, 115, 78), dirt=(138, 120, 92), stone=(148, 145, 135), wc=(45, 100, 130), roof=(125, 65, 48), wood=(108, 76, 48), mist=0.14, hills=0.25, wa=0.9, buildings=3, bamboo=0.5),
    "dam_thuy": dict(grass=(72, 118, 80), dirt=(130, 115, 88), stone=(140, 138, 128), wc=(58, 120, 110), roof=(120, 70, 52), wood=(100, 78, 50), mist=0.2, hills=0.6, wa=0.45, buildings=3, bamboo=1.1),
    "truong_yen": dict(grass=(110, 120, 78), dirt=(165, 140, 100), stone=(170, 160, 140), wc=(80, 120, 115), roof=(150, 80, 55), wood=(125, 90, 55), mist=0.08, hills=0.2, wa=0.15, buildings=8, bamboo=0.3),
    "chi_lang": dict(grass=(70, 100, 68), dirt=(125, 108, 85), stone=(155, 150, 140), wc=(60, 100, 110), roof=(118, 60, 45), wood=(100, 72, 45), mist=0.16, hills=1.2, wa=0.2, buildings=2, bamboo=0.6),
    "tam_dao": dict(grass=(75, 108, 72), dirt=(132, 112, 86), stone=(148, 145, 135), wc=(62, 105, 112), roof=(122, 64, 48), wood=(105, 75, 46), mist=0.2, hills=1.1, wa=0.25, buildings=3, bamboo=0.9),
    "ba_vi": dict(grass=(65, 100, 68), dirt=(120, 105, 82), stone=(145, 142, 132), wc=(55, 98, 108), roof=(115, 60, 45), wood=(98, 70, 44), mist=0.3, hills=1.3, wa=0.2, buildings=2, bamboo=1.0),
    "thang_long": dict(grass=(95, 122, 82), dirt=(160, 138, 105), stone=(175, 168, 155), wc=(70, 125, 135), roof=(155, 70, 52), wood=(130, 90, 55), mist=0.06, hills=0.1, wa=0.35, buildings=14, bamboo=0.3),
    "nhan_dang": dict(grass=(78, 105, 70), dirt=(135, 115, 88), stone=(160, 155, 145), wc=(65, 105, 115), roof=(125, 65, 48), wood=(105, 75, 46), mist=0.18, hills=1.0, wa=0.25, buildings=3, bamboo=0.8),
    "kiem_cac": dict(grass=(82, 112, 74), dirt=(140, 120, 90), stone=(150, 145, 135), wc=(68, 110, 118), roof=(130, 68, 50), wood=(110, 78, 48), mist=0.12, hills=0.7, wa=0.3, buildings=5, bamboo=0.7),
    "la_tieu": dict(grass=(62, 108, 68), dirt=(125, 108, 82), stone=(138, 135, 125), wc=(55, 100, 108), roof=(118, 62, 46), wood=(100, 72, 44), mist=0.22, hills=0.9, wa=0.3, buildings=3, bamboo=1.3),
    "vu_di": dict(grass=(70, 100, 72), dirt=(128, 110, 85), stone=(142, 140, 130), wc=(58, 100, 112), roof=(120, 64, 48), wood=(102, 74, 45), mist=0.35, hills=1.0, wa=0.25, buildings=2, bamboo=1.0),
    "mieu_linh": dict(grass=(58, 95, 62), dirt=(115, 100, 78), stone=(130, 128, 118), wc=(50, 92, 100), roof=(110, 58, 44), wood=(95, 68, 42), mist=0.28, hills=1.0, wa=0.2, buildings=2, bamboo=1.6),
    "tuyet_bao": dict(grass=(55, 75, 60), dirt=(100, 95, 85), stone=(130, 135, 140), wc=(70, 110, 130), roof=(100, 55, 45), wood=(90, 70, 50), mist=0.4, hills=0.5, wa=0.15, buildings=1, bamboo=0.2, cave=1),
    "diem_thuong": dict(grass=(80, 110, 74), dirt=(138, 118, 90), stone=(148, 142, 132), wc=(65, 108, 115), roof=(128, 66, 48), wood=(108, 76, 46), mist=0.14, hills=0.85, wa=0.3, buildings=4, bamboo=0.9),
    "thanh_loa": dict(grass=(88, 125, 90), dirt=(145, 128, 98), stone=(155, 150, 140), wc=(45, 120, 145), roof=(135, 70, 52), wood=(115, 82, 52), mist=0.15, hills=0.1, wa=0.95, buildings=4, bamboo=0.6, coastal=1),
    "vi_son": dict(grass=(75, 110, 80), dirt=(130, 115, 90), stone=(160, 155, 145), wc=(40, 110, 140), roof=(125, 65, 48), wood=(105, 75, 46), mist=0.18, hills=0.3, wa=0.95, buildings=2, bamboo=0.4, coastal=1),
    "mac_bac": dict(grass=(120, 130, 85), dirt=(170, 145, 100), stone=(165, 155, 135), wc=(90, 125, 120), roof=(140, 75, 55), wood=(120, 88, 55), mist=0.1, hills=0.15, wa=0.1, buildings=3, bamboo=0.1),
    "lao_ho": dict(grass=(65, 90, 62), dirt=(115, 100, 80), stone=(125, 122, 115), wc=(55, 95, 105), roof=(110, 58, 44), wood=(95, 68, 42), mist=0.3, hills=0.6, wa=0.15, buildings=1, bamboo=0.5, cave=1),
    "tien_cuc": dict(grass=(60, 85, 60), dirt=(110, 98, 80), stone=(120, 120, 118), wc=(50, 90, 100), roof=(105, 55, 42), wood=(90, 65, 40), mist=0.35, hills=0.5, wa=0.12, buildings=1, bamboo=0.3, cave=1),
    "khoa_lang": dict(grass=(58, 82, 58), dirt=(105, 95, 78), stone=(118, 116, 112), wc=(48, 88, 98), roof=(100, 52, 40), wood=(88, 62, 40), mist=0.38, hills=0.5, wa=0.1, buildings=1, bamboo=0.3, cave=1),
    "phong_lang": dict(grass=(90, 120, 85), dirt=(150, 130, 100), stone=(160, 155, 145), wc=(40, 110, 145), roof=(135, 70, 52), wood=(115, 82, 52), mist=0.12, hills=0.1, wa=0.9, buildings=4, bamboo=0.4, coastal=1),
    "thuyen": dict(grass=(100, 115, 90), dirt=(140, 120, 95), stone=(150, 145, 135), wc=(35, 100, 140), roof=(120, 65, 50), wood=(130, 95, 60), mist=0.08, hills=0.0, wa=1.0, buildings=2, bamboo=0.0, boat=1),
    "mac_cao": dict(grass=(70, 95, 68), dirt=(120, 110, 90), stone=(145, 142, 138), wc=(60, 105, 120), roof=(115, 60, 46), wood=(100, 72, 46), mist=0.25, hills=0.7, wa=0.2, buildings=2, bamboo=0.4, cave=1),
    "bang_ha": dict(grass=(75, 100, 85), dirt=(125, 120, 110), stone=(150, 155, 160), wc=(80, 130, 150), roof=(110, 70, 60), wood=(100, 80, 60), mist=0.32, hills=0.5, wa=0.25, buildings=1, bamboo=0.2, cave=1),
    "duong_trung": dict(grass=(68, 95, 70), dirt=(118, 108, 90), stone=(135, 132, 128), wc=(55, 100, 110), roof=(112, 60, 46), wood=(98, 70, 45), mist=0.28, hills=0.55, wa=0.2, buildings=1, bamboo=0.4, cave=1),
}


def clamp(v, a, b):
    return a if v < a else b if v > b else v


def mix(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def value_noise(h, w, seed, scale):
    rng = np.random.default_rng(seed)
    gh = max(2, int(h / scale) + 2)
    gw = max(2, int(w / scale) + 2)
    grid = rng.random((gh, gw), dtype=np.float32)
    yy = np.linspace(0, gh - 2, h, dtype=np.float32)
    xx = np.linspace(0, gw - 2, w, dtype=np.float32)
    y0 = np.floor(yy).astype(np.int32)
    x0 = np.floor(xx).astype(np.int32)
    fy = yy - y0
    fx = xx - x0
    # bilinear
    y0 = y0[:, None]
    x0 = x0[None, :]
    fy = fy[:, None]
    fx = fx[None, :]
    n00 = grid[y0, x0]
    n10 = grid[y0 + 1, x0]
    n01 = grid[y0, x0 + 1]
    n11 = grid[y0 + 1, x0 + 1]
    return (n00 * (1 - fy) * (1 - fx) + n10 * fy * (1 - fx) + n01 * (1 - fy) * fx + n11 * fy * fx)


def fbm(h, w, seed, scales=(180, 90, 45, 22)):
    out = np.zeros((h, w), dtype=np.float32)
    amp = 1.0
    total = 0.0
    for i, sc in enumerate(scales):
        out += amp * value_noise(h, w, seed + i * 19, sc)
        total += amp
        amp *= 0.5
    return out / total


def mark_rect(blocked, x, y, w, h, solid, map_w=SIZE, map_h=SIZE):
    gw, gh = map_w // CW, map_h // CH
    x0 = clamp(int(x) // CW, 0, gw - 1)
    y0 = clamp(int(y) // CH, 0, gh - 1)
    x1 = clamp(int(x + w) // CW, 0, gw - 1)
    y1 = clamp(int(y + h) // CH, 0, gh - 1)
    for gy in range(y0, y1 + 1):
        for gx in range(x0, x1 + 1):
            blocked[gy * gw + gx] = 1 if solid else 0


def carve_path(blocked, points, radius=28, map_w=SIZE, map_h=SIZE):
    gw, gh = map_w // CW, map_h // CH
    for i in range(len(points) - 1):
        x0, y0 = points[i]
        x1, y1 = points[i + 1]
        d = math.hypot(x1 - x0, y1 - y0) or 1
        steps = int(d / 10) + 1
        for s in range(steps + 1):
            t = s / steps
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            gx0 = clamp(int((x - radius) // CW), 0, gw - 1)
            gx1 = clamp(int((x + radius) // CW), 0, gw - 1)
            gy0 = clamp(int((y - radius) // CH), 0, gh - 1)
            gy1 = clamp(int((y + radius) // CH), 0, gh - 1)
            r2 = radius * radius
            for gy in range(gy0, gy1 + 1):
                wy = (gy + 0.5) * CH
                for gx in range(gx0, gx1 + 1):
                    wx = (gx + 0.5) * CW
                    if (wx - x) ** 2 + (wy - y) ** 2 <= r2:
                        blocked[gy * gw + gx] = 0


def encode_obs(blocked):
    n = len(blocked)
    raw = bytearray((n + 7) // 8)
    for k, b in enumerate(blocked):
        if b:
            raw[k >> 3] |= 1 << (k & 7)
    return base64.b64encode(bytes(raw)).decode("ascii")


def draw_roof(draw, cx, cy, w, h, roof, wood, stone, blocked, map_w, map_h):
    """Đình / chùa nhìn từ trên: sân đá, thân gỗ, đôi mái cong ngói đất nung."""
    x0, y0 = cx - w // 2, cy - h // 2
    pad = max(18, w // 10)
    # sân / nền đá
    draw.rectangle([x0 - pad, y0 - pad, x0 + w + pad, y0 + h + pad], fill=stone)
    draw.rectangle([x0 - pad + 4, y0 - pad + 4, x0 + w + pad - 4, y0 + h + pad - 4], outline=mix(stone, (60, 55, 45), 0.35), width=3)
    mark_rect(blocked, x0 - pad, y0 - pad, w + 2 * pad, h + 2 * pad, True, map_w, map_h)
    # thân
    draw.rectangle([x0 + 6, y0 + h // 5, x0 + w - 6, y0 + h - 6], fill=wood)
    # hàng cột
    for i in range(5):
        ox = x0 + 16 + i * (w - 32) // 4
        draw.rectangle([ox - 3, y0 + h // 5, ox + 3, y0 + h - 8], fill=mix(wood, (40, 25, 15), 0.35))
    # mái dưới (rộng hơn)
    dark = mix(roof, (30, 15, 10), 0.35)
    light = mix(roof, (200, 120, 80), 0.2)
    draw.polygon([(x0 - 20, y0 + h // 4), (cx, y0 - 18), (x0 + w + 20, y0 + h // 4),
                  (x0 + w + 10, y0 + h // 4 + 22), (cx, y0 + 8), (x0 - 10, y0 + h // 4 + 22)], fill=roof)
    # sọc ngói
    for k in range(5):
        yy = y0 - 10 + k * 8
        draw.line([(x0 - 8 + k * 3, yy + 14), (cx, yy), (x0 + w + 8 - k * 3, yy + 14)], fill=dark, width=2)
    # mái trên (chồng)
    draw.polygon([(x0 + w * 0.15, y0 + h // 5), (cx, y0 - 28), (x0 + w * 0.85, y0 + h // 5),
                  (x0 + w * 0.78, y0 + h // 5 + 16), (cx, y0 - 4), (x0 + w * 0.22, y0 + h // 5 + 16)], fill=dark)
    # đầu đao cong hai bên
    draw.polygon([(x0 - 22, y0 + h // 4 + 4), (x0 - 40, y0 + h // 4 - 10), (x0 - 8, y0 + h // 4 - 2)], fill=light)
    draw.polygon([(x0 + w + 22, y0 + h // 4 + 4), (x0 + w + 40, y0 + h // 4 - 10), (x0 + w + 8, y0 + h // 4 - 2)], fill=light)
    mark_rect(blocked, x0 - 40, y0 - 30, w + 80, h + 40, True, map_w, map_h)


def draw_gate(draw, cx, cy, scale, roof, wood, stone, blocked, map_w, map_h):
    """Cổng tam quan — ba lối, mái ngói chồng."""
    w, h = int(90 * scale), int(55 * scale)
    x0, y0 = cx - w // 2, cy - h // 2
    dark = mix(roof, (30, 15, 10), 0.3)
    draw.rectangle([x0 - 8, y0 - 4, x0 + w + 8, y0 + h + 8], fill=stone)
    # ba trụ + ba lối
    gap = w // 3
    for i in range(4):
        ax = x0 + i * gap
        draw.rectangle([ax - 6, y0, ax + 6, y0 + h], fill=wood)
    for i in range(3):
        ax = x0 + 10 + i * gap
        col = mix(stone, (30, 30, 30), 0.45) if i != 1 else mix(stone, (20, 20, 20), 0.55)
        draw.rectangle([ax, y0 + 18, ax + gap - 20, y0 + h], fill=col)
    # mái ba tầng kiểu tam quan
    draw.polygon([(x0 - 16, y0 + 16), (cx, y0 - 22), (x0 + w + 16, y0 + 16),
                  (x0 + w + 6, y0 + 28), (cx, y0 - 2), (x0 - 6, y0 + 28)], fill=roof)
    draw.polygon([(x0 + w * 0.12, y0 + 8), (cx, y0 - 34), (x0 + w * 0.88, y0 + 8),
                  (x0 + w * 0.8, y0 + 18), (cx, y0 - 12), (x0 + w * 0.2, y0 + 18)], fill=dark)
    mark_rect(blocked, x0 - 16, y0 - 34, w + 32, h + 42, True, map_w, map_h)
    # lối giữa đi được
    mark_rect(blocked, cx - gap // 3, y0 + 16, gap * 2 // 3, h, False, map_w, map_h)


def draw_house(draw, cx, cy, w, h, roof, wood, blocked, map_w, map_h):
    x0, y0 = cx - w // 2, cy - h // 2
    dark = mix(roof, (40, 20, 15), 0.3)
    draw.rectangle([x0 - 4, y0 + 6, x0 + w + 4, y0 + h + 4], fill=mix(wood, (80, 70, 55), 0.2))
    draw.rectangle([x0, y0 + 10, x0 + w, y0 + h], fill=wood)
    draw.polygon([(x0 - 12, y0 + 14), (cx, y0 - 10), (x0 + w + 12, y0 + 14),
                  (x0 + w + 4, y0 + 26), (cx, y0 + 6), (x0 - 4, y0 + 26)], fill=roof)
    draw.line([(x0 - 4, y0 + 16), (cx, y0 - 2), (x0 + w + 4, y0 + 16)], fill=dark, width=2)
    mark_rect(blocked, x0 - 12, y0 - 10, w + 24, h + 16, True, map_w, map_h)


def draw_stele(draw, cx, cy, stone, blocked, map_w, map_h):
    s = ARCH_SCALE
    draw.ellipse([cx - 28*s/2, cy + 8, cx + 28*s/2, cy + 36], fill=mix(stone, (60, 80, 50), 0.2))
    draw.rectangle([cx - 10*s/2, cy - 40*s/2, cx + 10*s/2, cy + 16], fill=stone)
    draw.rectangle([cx - 18*s/2, cy - 50*s/2, cx + 18*s/2, cy - 34*s/2], fill=mix(stone, (80, 70, 50), 0.3))
    mark_rect(blocked, cx - 30, cy - 50, 60, 90, True, map_w, map_h)


def draw_bamboo(draw, cx, cy, green, blocked, map_w, map_h):
    for i in range(9):
        ox = cx + (i - 4) * 10
        h = 55 + (i % 3) * 18
        draw.line([(ox, cy + 30), (ox, cy - h)], fill=mix(green, (20, 50, 20), 0.3), width=3)
        draw.ellipse([ox - 14, cy - h - 18, ox + 14, cy - h + 8], fill=green)
    mark_rect(blocked, cx - 50, cy - 90, 100, 130, True, map_w, map_h)


def gen_map(stem, theme_key, seed):
    th = THEMES[theme_key]
    rng = np.random.default_rng(seed)
    W = H = 4096 if stem == "337" else SIZE
    gw, gh = W // CW, H // CH
    # low-res terrain
    lw, lh = W // 4, H // 4
    elev = fbm(lh, lw, seed, (90, 45, 22, 11)) * th["hills"]
    n = fbm(lh, lw, seed + 7, (70, 35, 18, 9))
    grass = np.array(th["grass"], dtype=np.float32)
    dirt = np.array(th["dirt"], dtype=np.float32)
    stone = np.array(th["stone"], dtype=np.float32)
    water_c = np.array(th["wc"], dtype=np.float32)
    paddy = mix(th["grass"], (160, 170, 80), 0.25)
    paddy = np.array(paddy, dtype=np.float32)

    rgb = np.zeros((lh, lw, 3), dtype=np.float32)
    rgb[:] = grass
    rgb[elev > 0.48] = dirt * 0.4 + grass * 0.6
    rgb[elev > 0.62] = stone * 0.35 + grass * 0.65
    rgb[n < 0.28 + th["wa"] * 0.15] = paddy
    jitter = (rng.random((lh, lw, 1), dtype=np.float32) - 0.5) * 16
    rgb = np.clip(rgb + jitter, 0, 255)

    # water mask at low-res
    water_mask = np.zeros((lh, lw), dtype=bool)
    ys = np.arange(lh)[:, None]
    xs = np.arange(lw)[None, :]
    if th.get("boat"):
        water_mask = (np.abs(xs - lw / 2) > lw * 0.28) | (np.abs(ys - lh / 2) > lh * 0.18)
    elif th.get("coastal"):
        edge = np.minimum(np.minimum(xs, ys), np.minimum(lw - 1 - xs, lh - 1 - ys))
        wave = 20 + 12 * np.sin(xs * 0.08 + seed) * np.cos(ys * 0.06)
        water_mask = edge < (45 + wave)
    elif th["wa"] > 0.25:
        # meandering river on low-res
        rx = int(lw * (0.35 + 0.3 * (seed % 7) / 7))
        for y in range(lh):
            rx += int(rng.integers(-2, 3))
            rx = int(clamp(rx, 8, lw - 9))
            half = int(8 + th["wa"] * 14)
            x0, x1 = max(0, rx - half), min(lw, rx + half)
            water_mask[y, x0:x1] = True

    if th.get("cave"):
        # dark cave floor
        cave = mix(th["stone"], (40, 40, 45), 0.55)
        rgb[:] = np.array(cave, dtype=np.float32)
        # lighter walkable center
        cy, cx = lh // 2, lw // 2
        yy, xx = np.ogrid[:lh, :lw]
        dist = ((yy - cy) / (lh * 0.35)) ** 2 + ((xx - cx) / (lw * 0.35)) ** 2
        rgb[dist < 1.0] = dirt * 0.5 + stone * 0.5

    rgb[water_mask] = water_c * (0.85 + 0.15 * rng.random((water_mask.sum(), 1)))

    img = Image.fromarray(rgb.astype(np.uint8), "RGB").resize((W, H), Image.BILINEAR)
    draw = ImageDraw.Draw(img)

    blocked = [0] * (gw * gh)
    # block water on grid
    wm = np.array(Image.fromarray(water_mask.astype(np.uint8) * 255).resize((gw, gh), Image.NEAREST)) > 127
    for gy in range(gh):
        for gx in range(gw):
            if wm[gy, gx]:
                blocked[gy * gw + gx] = 1

    if th.get("cave"):
        # block outside oval
        for gy in range(gh):
            for gx in range(gw):
                nx = (gx + 0.5) / gw - 0.5
                ny = (gy + 0.5) / gh - 0.5
                if (nx / 0.38) ** 2 + (ny / 0.38) ** 2 > 1:
                    blocked[gy * gw + gx] = 1

    # rice paddies
    if th["wa"] < 0.7 and th["hills"] < 0.85 and not th.get("cave") and not th.get("boat"):
        for _ in range(int(rng.integers(4, 9))):
            rx = int(rng.integers(200, W - 400))
            ry = int(rng.integers(200, H - 400))
            rw = int(rng.integers(160, 280))
            rh = int(rng.integers(100, 180))
            field = mix(th["grass"], (170, 185, 90), 0.4)
            border = mix(th["dirt"], (90, 80, 60), 0.2)
            draw.rectangle([rx, ry, rx + rw, ry + rh], outline=border, width=3)
            for i in range(1, 5):
                yy = ry + i * rh // 5
                draw.line([(rx, yy), (rx + rw, yy)], fill=border, width=2)
            draw.rectangle([rx + 2, ry + 2, rx + rw - 2, ry + rh - 2], fill=field)

    cx, cy = W // 2, H // 2
    roads = [[(120, cy), (cx, cy), (W - 120, cy)], [(cx, 120), (cx, cy), (cx, H - 120)]]
    if th["buildings"] >= 6:
        roads += [[(W // 4, H // 4), (cx, cy), (3 * W // 4, 3 * H // 4)], [(3 * W // 4, H // 4), (cx, cy), (W // 4, 3 * H // 4)]]

    for poly in roads:
        for i in range(len(poly) - 1):
            x0, y0 = poly[i]
            x1, y1 = poly[i + 1]
            steps = int(math.hypot(x1 - x0, y1 - y0) / 6) + 1
            for s in range(steps):
                t = s / steps
                x = x0 + (x1 - x0) * t
                y = y0 + (y1 - y0) * t
                rr = 40
                draw.ellipse([x - rr, y - rr // 2, x + rr, y + rr // 2], fill=th["dirt"])
        carve_path(blocked, poly, 48, W, H)

    draw.ellipse([cx - 160, cy - 100, cx + 160, cy + 100], fill=mix(th["stone"], th["dirt"], 0.4))
    # ao sen gần trung tâm
    for ox, oy in ((-280, 220), (300, -180)):
        px, py = cx + ox, cy + oy
        draw.ellipse([px - 70, py - 45, px + 70, py + 45], fill=mix(th["wc"], (20, 60, 50), 0.25))
        for k in range(6):
            lx = px - 40 + k * 14
            draw.ellipse([lx, py - 8, lx + 16, py + 6], fill=(40, 110, 70))
            draw.ellipse([lx + 4, py - 14, lx + 12, py - 6], fill=(180, 60, 80))
        mark_rect(blocked, px - 70, py - 45, 140, 90, True, W, H)
    # đình trung tâm
    draw_roof(draw, cx, cy - 20, int(200 * ARCH_SCALE // 2), int(150 * ARCH_SCALE // 2), th["roof"], th["wood"], th["stone"], blocked, W, H)
    draw_gate(draw, cx, cy + int(140 * ARCH_SCALE // 2), 2.2, th["roof"], th["wood"], th["stone"], blocked, W, H)
    carve_path(blocked, [(cx, cy + 200), (cx, cy + 400)], 50, W, H)
    carve_path(blocked, [(cx, cy), (cx + 1, cy)], 90, W, H)

    n_build = max(3, int(th["buildings"]) * 2)
    for i in range(n_build):
        ang = (i / n_build) * math.tau + float(rng.random()) * 0.3
        dist = 280 + int(rng.integers(0, 700))
        bx = int(clamp(cx + math.cos(ang) * dist, 200, W - 200))
        by = int(clamp(cy + math.sin(ang) * dist * 0.85, 200, H - 200))
        kind = i % 5
        S = ARCH_SCALE
        if kind == 0:
            draw_roof(draw, bx, by, int(rng.integers(90, 140) * S), int(rng.integers(70, 100) * S), th["roof"], th["wood"], th["stone"], blocked, W, H)
        elif kind == 1:
            draw_gate(draw, bx, by, float(rng.uniform(1.8, 2.6)), th["roof"], th["wood"], th["stone"], blocked, W, H)
        elif kind == 2:
            draw_house(draw, bx, by, int(rng.integers(50, 80) * S), int(rng.integers(40, 60) * S), th["roof"], th["wood"], blocked, W, H)
            draw_house(draw, bx + int(90*S), by + int(30*S), int(rng.integers(40, 60) * S), int(rng.integers(35, 50) * S), th["roof"], th["wood"], blocked, W, H)
        elif kind == 3:
            for k in range(3):
                draw_stele(draw, bx + k * int(40*S), by + (k % 2) * int(20*S), th["stone"], blocked, W, H)
        else:
            draw_roof(draw, bx, by, int(140 * S), int(100 * S), th["roof"], th["wood"], th["stone"], blocked, W, H)
            draw_stele(draw, bx + int(160*S), by + int(50*S), th["stone"], blocked, W, H)

    for _ in range(int(14 * th["bamboo"])):
        bx = int(rng.integers(150, W - 150))
        by = int(rng.integers(150, H - 150))
        draw_bamboo(draw, bx, by, mix(th["grass"], (30, 80, 40), 0.4), blocked, W, H)

    if th.get("boat"):
        # wooden deck
        draw.rectangle([cx - int(W * 0.26), cy - int(H * 0.16), cx + int(W * 0.26), cy + int(H * 0.16)], fill=th["wood"])
        draw.rectangle([cx - int(W * 0.22), cy - int(H * 0.12), cx + int(W * 0.22), cy + int(H * 0.12)], fill=mix(th["wood"], (80, 60, 40), 0.2))
        for gy in range(gh):
            for gx in range(gw):
                wx, wy = (gx + 0.5) * CW, (gy + 0.5) * CH
                if abs(wx - cx) <= W * 0.24 and abs(wy - cy) <= H * 0.14:
                    blocked[gy * gw + gx] = 0

    # reconnect roads
    for poly in roads:
        carve_path(blocked, poly, 44, W, H)
    carve_path(blocked, [(cx, cy), (cx + 1, cy)], 70, W, H)

    # border
    for gy in range(gh):
        for gx in range(gw):
            if gx < 2 or gy < 2 or gx >= gw - 2 or gy >= gh - 2:
                blocked[gy * gw + gx] = 1

    if th["mist"] > 0:
        mist = Image.new("RGB", (W, H), mix(th["grass"], (200, 210, 200), 0.5))
        img = Image.blend(img, mist, th["mist"] * 0.35)

    img = ImageEnhance.Color(img).enhance(0.92)
    img = ImageEnhance.Contrast(img).enhance(1.06)
    img = img.filter(ImageFilter.SMOOTH)

    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{stem}.jpg"
    img.save(out, quality=80, optimize=True)

    meta = {
        "A": 8 if stem == "337" else 7,
        "w": W,
        "h": H,
        "gw": gw,
        "gh": gh,
        "cw": CW,
        "ch": CH,
        "regions": 1,
        "blocked": int(sum(blocked)),
        "obs": encode_obs(blocked),
        "_free": int(sum(1 for b in blocked if not b)),
    }
    return out, meta


def patch_jmo(metas):
    main_ids = {"2", "3", "7", "19", "21", "41", "90", "70", "92", "56", "122", "140", "224", "319", "320", "322", "37"}
    jmo_main, jmo_alt = {}, {}
    for stem, meta in metas.items():
        key = "37" if stem == "town" else stem
        entry = {k: v for k, v in meta.items() if not k.startswith("_")}
        (jmo_main if key in main_ids else jmo_alt)[key] = entry

    def write_jmo(path, obj, assign=False):
        def kord(k):
            return (0, int(k)) if k.isdigit() else (1, k)

        ordered = {k: obj[k] for k in sorted(obj.keys(), key=kord)}
        body = json.dumps(ordered, ensure_ascii=False, separators=(",", ":"))
        if assign:
            txt = "/* vat can ban do (tools/gen_tran_maps.py, phong cach Tran) */\nObject.assign(window.JMO, " + body + ");\n"
        else:
            txt = "/* tao boi tools/gen_tran_maps.py (phong cach Tran) */\nwindow.JMO=" + body + ";\n"
        path.write_text(txt, encoding="utf-8")

    write_jmo(ROOT / "jmo.js", jmo_main, assign=False)
    write_jmo(ROOT / "jmo2.js", jmo_alt, assign=True)


def rename_zones():
    names = {
        2: "Yên Tử Sơn", 3: "Thiên Trường", 7: "Long Hưng", 19: "Tức Mặc",
        21: "Côn Sơn", 41: "Chí Linh", 90: "Phả Lại", 70: "Đông Triều",
        92: "An Bang", 56: "Vân Đồn", 122: "Bạch Đằng Giang", 140: "Đạm Thủy Cốc",
        224: "Trường Yên", 319: "Ải Chi Lăng", 320: "Tam Đảo", 322: "Ba Vì Sơn",
    }
    alt_names = {
        195: "Nhạn Đãng", 43: "Sơn Trại Thiên Trường", 179: "Rừng La Tiêu", 193: "Vũ Di Sơn",
        74: "Miêu Lĩnh", 145: "Động Tuyết Báo", 167: "Điểm Thương Sơn", 68: "Thanh Loa Đảo",
        342: "Vi Sơn Đảo", 341: "Thảo Nguyên Mạc Bắc", 123: "Động Lão Hổ", 93: "Động Tiến Cúc",
        75: "Động Khoả Lang", 336: "Bến Phong Lăng", 340: "Mạc Cao Quật", 201: "Động Băng Hà",
        205: "Động Dương Trung",
    }
    world = (ROOT / "world.js").read_text(encoding="utf-8")
    for i, n in names.items():
        world = re.sub(rf'(\{{"id":{i},"n":")[^"]+"', rf'\g<1>{n}"', world)
    world = re.sub(r'("town":\{"id":37,"n":")[^"]+"', r'\g<1>Thăng Long"', world)
    (ROOT / "world.js").write_text(world, encoding="utf-8")

    z2 = (ROOT / "zones2.js").read_text(encoding="utf-8")
    for i, n in alt_names.items():
        z2 = re.sub(rf'("id": {i}, "n": ")[^"]+"', rf'\g<1>{n}"', z2)
    (ROOT / "zones2.js").write_text(z2, encoding="utf-8")


def bump_cache():
    idx = ROOT / "index.html"
    text = idx.read_text(encoding="utf-8")
    m = re.search(r"\?v=(\d+)", text)
    ver = int(m.group(1)) + 1 if m else 210
    text = re.sub(r"\?v=\d+", f"?v={ver}", text)
    idx.write_text(text, encoding="utf-8")
    sw = ROOT / "sw.js"
    s = sw.read_text(encoding="utf-8")
    s = s.replace("jxidle-v209", f"jxidle-v{ver}").replace("jxidle-img-1", f"jxidle-img-{ver}")
    # also handle if already bumped
    s = re.sub(r"jxidle-v\d+", f"jxidle-v{ver}", s)
    s = re.sub(r"jxidle-img-\d+", f"jxidle-img-{ver}", s)
    sw.write_text(s, encoding="utf-8")
    return ver


def main():
    metas = {}
    for i, (stem, theme) in enumerate(MAPS):
        print(f"[{i+1}/{len(MAPS)}] {stem} ({theme})", flush=True)
        path, meta = gen_map(stem, theme, seed=1000 + i * 97)
        metas[stem] = meta
        print(f"  -> {path.name} free={meta['_free']}/{meta['gw']*meta['gh']}", flush=True)
    print("JMO + rename...", flush=True)
    patch_jmo(metas)
    rename_zones()
    ver = bump_cache()
    print(f"Done v{ver}", flush=True)


if __name__ == "__main__":
    main()
