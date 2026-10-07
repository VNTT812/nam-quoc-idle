#!/usr/bin/env python3
"""Zone 56 Hoành Sơn Phái: giữ bố cục VLTK, vài biến thể bối cảnh Trần — chỉ preview duyệt."""
from __future__ import annotations

import shutil
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from compose_tran_style_maps import compose, load_orig as load_orig_compose, tile_fill  # noqa: E402
from compose_tran_style_maps import structure_mask, TILES  # noqa: E402
from reskin_tran_layout import reskin  # noqa: E402

STEM = "56"
REVIEW = ROOT / "assets/pack/map-style-review/56-hoanh-son"
THUMB = 1024
ORIG_REV = "5f51470"


def load_git_orig() -> Image.Image:
    import subprocess

    data = subprocess.check_output(["git", "show", f"{ORIG_REV}:img/z/{STEM}.jpg"])
    return Image.open(BytesIO(data)).convert("RGB")


def save_thumb(full: Path, thumb_dir: Path) -> None:
    im = Image.open(full).convert("RGB")
    w, h = im.size
    scale = THUMB / max(w, h)
    tw, th = int(w * scale), int(h * scale)
    im.resize((tw, th), Image.LANCZOS).save(thumb_dir / full.name, quality=88, optimize=True)


def hybrid_reskin_compose(bias: str, tile_name: str, ai_weight: float, out: Path) -> Path:
    """Reskin HSV trên layout gốc + pha nhẹ texture AI (giữ đường/tường rõ)."""
    tmp_reskin = REVIEW / "_tmp" / f"hybrid-{bias}.jpg"
    tmp_reskin.parent.mkdir(parents=True, exist_ok=True)
    reskin(STEM, bias=bias, out_path=tmp_reskin)

    orig = load_orig_compose(STEM)
    W, H = orig.size
    tile = Image.open(TILES / f"{tile_name}.jpg").convert("RGB")
    filled = tile_fill(tile, W, H, seed=5600 + hash(tile_name) % 1000)
    mask = structure_mask(orig)
    a = np.asarray(mask, dtype=np.float32) / 255.0
    a = 0.35 + 0.40 * a  # giữ layout gốc mạnh hơn compose full
    a = a[..., None]
    ai = np.asarray(filled, dtype=np.float32)
    rs = np.asarray(Image.open(tmp_reskin).convert("RGB"), dtype=np.float32)
    out_arr = rs * (1.0 - ai_weight * (1.0 - a)) + ai * (ai_weight * (1.0 - a))
    out_arr[..., 0] = np.clip(out_arr[..., 0] * 1.02 + 2, 0, 255)
    out_arr[..., 2] = np.clip(out_arr[..., 2] * 0.97, 0, 255)
    img = Image.fromarray(out_arr.astype(np.uint8), "RGB")
    img = ImageEnhance.Contrast(img).enhance(1.04)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, quality=90, optimize=True)
    return out


def build_variants() -> list[tuple[str, str, tuple]]:
    specs: list[tuple[str, str, object]] = [
        ("01-reskin-van-don", "Reskin Trần · tông Vân Đồn (nước/xanh)", ("reskin", "water")),
        ("02-reskin-warm", "Reskin Trần · gạch/ mái ấm", ("reskin", "warm")),
        ("03-reskin-lush", "Reskin Trần · rừng xanh Côn Sơn", ("reskin", "lush")),
        ("04-reskin-mist", "Reskin Trần · sương mù nhẹ", ("reskin", "mist")),
        ("05-compose-van-don", "Ghép texture · tran-van-don-map", ("compose", "tran-van-don-map")),
        ("06-compose-con-son", "Ghép texture · tran-con-son-map", ("compose", "tran-con-son-map")),
        ("07-compose-thang-long", "Ghép texture · tran-thang-long-map", ("compose", "tran-thang-long-map")),
        (
            "08-hybrid-water-van-don",
            "Pha reskin + AI Vân Đồn (layout ưu tiên)",
            ("hybrid", "water", "tran-van-don-map", 0.38),
        ),
        (
            "09-hybrid-warm-thang-long",
            "Pha reskin ấm + AI Thăng Long",
            ("hybrid", "warm", "tran-thang-long-map", 0.32),
        ),
    ]
    return specs


def run_one(slug: str, kind: tuple) -> Path:
    out = REVIEW / f"{slug}.jpg"
    if kind[0] == "reskin":
        return reskin(STEM, bias=kind[1], out_path=out)
    if kind[0] == "compose":
        return compose(STEM, kind[1], out_path=out)
    if kind[0] == "hybrid":
        _, bias, tile, w = kind
        return hybrid_reskin_compose(bias, tile, w, out)
    raise ValueError(kind)


def write_gallery(labels: list[tuple[str, str]]) -> None:
    ref = Path("/home/ubuntu/.cursor/projects/workspace/assets/067efdec-f98c-424e-b30b-5f8bd2961255.jpg")
    ref_line = ""
    if ref.exists():
        dest = REVIEW / "00-reference-user.jpg"
        shutil.copy2(ref, dest)
        ref_line = f'<figure><img src="00-reference-user.jpg" alt="ref"/><figcaption>Ảnh tham chiếu (Hoành Sơn Phái gốc)</figcaption></figure>'

    cards = []
    cards.append(
        f'<figure><img src="thumbs/00-original-vltk.jpg" alt="orig"/>'
        f"<figcaption><strong>00 · Map gốc VLTK</strong><br/>Giữ bố cục / vật cản jmo.js</figcaption></figure>"
    )
    for slug, title in labels:
        cards.append(
            f'<figure><img src="thumbs/{slug}.jpg" alt="{slug}"/>'
            f"<figcaption><strong>{slug}</strong><br/>{title}</figcaption></figure>"
        )

    html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<title>Zone 56 · Hoành Sơn Phái — duyệt phong cách Trần</title>
<style>
body {{ font-family: system-ui, sans-serif; background:#1a1612; color:#e8dcc8; margin:0; padding:1rem 1.5rem; }}
h1 {{ font-size:1.25rem; font-weight:600; }}
p {{ max-width:72ch; line-height:1.5; color:#c4b8a8; }}
.grid {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:1rem; margin-top:1rem; }}
figure {{ margin:0; background:#252018; border-radius:8px; overflow:hidden; border:1px solid #3d3428; }}
img {{ width:100%; height:auto; display:block; cursor:zoom-in; }}
figcaption {{ padding:0.65rem 0.75rem; font-size:0.85rem; }}
a {{ color:#d4a574; }}
</style>
</head>
<body>
<h1>Zone 56 · Hoành Sơn Phái / Vân Đồn — preview Trần (chưa deploy)</h1>
<p>Click ảnh thumb để mở file JPG full ({3584}×{3584}) trong thư mục này. Chọn slug (vd. <code>01-reskin-van-don</code>) để áp vào <code>img/z/56.jpg</code>.</p>
<div class="grid">
{ref_line}
{"".join(cards)}
</div>
</body>
</html>
"""
    (REVIEW / "index.html").write_text(html, encoding="utf-8")


def write_readme(labels: list[tuple[str, str]]) -> None:
    lines = [
        "# Zone 56 · Hoành Sơn Phái — style review (Trần)",
        "",
        "Layout và `jmo.js` zone `56` **không đổi** cho tới khi bạn chọn variant.",
        "",
        "| Slug | Mô tả |",
        "|------|--------|",
        "| `00-original-vltk.jpg` | Bản gốc từ git (VLTK) |",
    ]
    for slug, title in labels:
        lines.append(f"| `{slug}.jpg` | {title} |")
    lines.extend(
        [
            "",
            "Mở `index.html` để xem lưới thumb.",
            "",
            "Deploy (sau khi duyệt): copy variant → `img/z/56.jpg`, bump cache trong `index.html` / `sw.js` / `world.js`.",
        ]
    )
    (REVIEW / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    thumbs = REVIEW / "thumbs"
    thumbs.mkdir(exist_ok=True)

    orig = load_git_orig()
    orig_path = REVIEW / "00-original-vltk.jpg"
    orig.save(orig_path, quality=92, optimize=True)
    save_thumb(orig_path, thumbs)

    specs = build_variants()
    labels: list[tuple[str, str]] = []
    for i, (slug, title, kind) in enumerate(specs, 1):
        print(f"[{i}/{len(specs)}] {slug} …", flush=True)
        path = run_one(slug, kind)
        print(f"  -> {path.stat().st_size // 1024} KB", flush=True)
        save_thumb(path, thumbs)
        labels.append((slug, title))

    write_gallery(labels)
    write_readme(labels)
    tmp = REVIEW / "_tmp"
    if tmp.is_dir():
        shutil.rmtree(tmp)
    print(f"Done → {REVIEW}", flush=True)


if __name__ == "__main__":
    main()
