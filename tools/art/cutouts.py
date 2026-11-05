#!/usr/bin/env python3
"""Life-size cardboard standees of the classmates' slide pictures.

Each figure is cut out of its slide picture (tools/art/slides.py) along a hand-traced outline
(a lasso polygon in config.json "cutouts", in 0-1 picture coordinates), then given a die-cut
margin of worn dark cardboard (white for the Absolute Scoggema meme). Ordinary image tools only
(polygon mask, magic wand, dilate, blur); no AI tools, and the faces are never altered.

  python3 tools/art/cutouts.py            -> art/cutouts/<name>.png (RGBA) + <name>.json
  python3 tools/art/cutouts.py --preview  -> also art/cache/cutout_preview.png
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageStat

sys.path.insert(0, str(Path(__file__).resolve().parent))
import slides  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CFG = json.loads((ROOT / "tools/art/config.json").read_text())["cutouts"]
OUT = ROOT / "art/cutouts"
MAX_H = 2048          # texture height
MARGIN = 0.008        # white die-cut margin, as a fraction of the picture height


def wand(src: Image.Image, mask: Image.Image, tol: int) -> Image.Image:
    """Magic wand: inside the traced outline, drop background-colored pixels connected to the
    outside (a contiguous flood fill seeded from everything outside the outline)."""
    w, h = src.size
    work = src.copy()
    ring = mask.filter(ImageFilter.MaxFilter(9))
    bg = ImageStat.Stat(src, mask=ring.point(lambda v: 255 - v) if False else
                        Image.composite(Image.new("L", (w, h), 0), ring, mask)).median
    key = (255, 0, 255)
    outside = mask.point(lambda v: 255 if v == 0 else 0)
    work.paste(tuple(int(c) for c in bg), (0, 0), outside)
    ImageDraw.floodfill(work, (0, 0), key, thresh=tol)
    filled = Image.eval(work.convert("RGB"), lambda v: v)
    px = filled.load()
    out = Image.new("L", (w, h), 0)
    op = out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] != key:
                op[x, y] = 255
    return ImageChops.multiply(out.filter(ImageFilter.MinFilter(3)), mask)


def make(name: str, spec: dict) -> Image.Image:
    src = slides.picture(spec["page"])
    k = MAX_H / src.height
    src = src.resize((int(src.width * k), MAX_H), Image.LANCZOS)
    w, h = src.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon([(x * w, y * h) for x, y in spec["poly"]], fill=255)
    if "wand" in spec:
        mask = wand(src, mask, spec["wand"])
    figure = mask.filter(ImageFilter.GaussianBlur(1.2))
    m = max(3, int(MARGIN * h)) | 1
    outline = mask.filter(ImageFilter.MaxFilter(m)).filter(ImageFilter.GaussianBlur(m / 3))
    outline = outline.point(lambda v: 255 if v > 110 else 0).filter(ImageFilter.GaussianBlur(1.0))
    if spec.get("edge", "dark") == "white":  # the meme scare keeps the bright sticker look
        out = Image.new("RGBA", (w, h), (246, 244, 238, 0))
    else:  # worn dark cardboard: brown-gray with grime blotches
        grime = Image.effect_noise((w // 8, h // 8), 40).resize((w, h), Image.BICUBIC)
        out = Image.merge("RGB", [grime.point(lambda v, c=c: max(0, min(255, int(c * (0.65 + v / 400)))))
                                  for c in (58, 48, 38)]).convert("RGBA")
    out.putalpha(outline)
    printed = src.convert("RGBA")
    printed.putalpha(figure)
    out.alpha_composite(printed)
    # Trim to the outline, padding 4 px.
    x0, y0, x1, y1 = outline.getbbox()
    box = (max(0, x0 - 4), max(0, y0 - 4), min(w, x1 + 4), min(h, y1 + 4))
    out = out.crop(box)
    # Width of the bottom edge (for the display riser under cropped figures).
    a = out.split()[3]
    row = [a.getpixel((x, a.height - 8)) for x in range(a.width)]
    on = [x for x, v in enumerate(row) if v > 128]
    meta = {"page": spec["page"], "height_m": spec["height_m"] * (box[3] - box[1]) / h,
            "aspect": round(out.width / out.height, 4), "base_m": spec["base_m"],
            "bottom_u": [round(on[0] / out.width, 4), round(on[-1] / out.width, 4)] if on else [0.3, 0.7],
            "face_uv": [round((spec["face"][0] * w - box[0]) / out.width, 4),
                        round((spec["face"][1] * h - box[1]) / out.height, 4)],
            "pupils_uv": [[round((u * w - box[0]) / out.width, 4), round((v * h - box[1]) / out.height, 4)]
                          for u, v in spec.get("pupils", [])]}
    OUT.mkdir(parents=True, exist_ok=True)
    out.save(OUT / f"{name}.png")
    (OUT / f"{name}.json").write_text(json.dumps(meta, indent=1))
    print(f"art/cutouts/{name}.png", meta)
    return out


def main() -> int:
    only = next((a.split("=", 1)[1].split(",") for a in sys.argv[1:] if a.startswith("--only=")), None)
    made = [make(n, s) for n, s in CFG.items() if only is None or n in only]
    if "--preview" in sys.argv:
        H = 700
        tiles = [im.resize((int(im.width * H / im.height), H), Image.LANCZOS) for im in made]
        sheet = Image.new("RGB", (sum(t.width for t in tiles) + 20 * len(tiles), H + 20), (40, 70, 60))
        x = 10
        for t in tiles:
            sheet.paste(t, (x, 10), t)
            x += t.width + 20
        sheet.save(ROOT / "art/cache/cutout_preview.png")
    return 0


if __name__ == "__main__":
    sys.exit(main())
