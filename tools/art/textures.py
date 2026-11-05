#!/usr/bin/env python3
"""Flat 2D art the Blender scenes map onto planes that isn't from the deck: flyers, the senior
checklist, the stage banner and the library's book spines; plus the paper, text and slide
picture helpers tools/art/slides.py uses. Ordinary image tools only (draw, text).

  python3 tools/art/textures.py [--only=name,...]   -> art/textures/*.png|jpg
"""
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art/textures"
FONTS = ROOT / "tools/art/fonts"


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / name), size)


def save(im: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    if path.suffix == ".jpg":
        im.convert("RGB").save(path, quality=90)
    else:
        im.save(path)
    print(f"art/textures/{name}")


def picture_box(im: Image.Image) -> tuple[int, int, int, int]:
    """Bounding box of the biggest non-white blob on a slide (the picture, not the title)."""
    k = 8
    small = np.asarray(im.resize((im.width // k, im.height // k))).astype(int)
    ink = (small.min(axis=2) < 232)
    h, w = ink.shape
    seen = np.zeros_like(ink)
    best, best_box = 0, (0, 0, w, h)
    for y in range(h):
        for x in range(w):
            if not ink[y, x] or seen[y, x]:
                continue
            stack, n = [(y, x)], 0
            seen[y, x] = True
            x0 = x1 = x
            y0 = y1 = y
            while stack:
                cy, cx = stack.pop()
                n += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < h and 0 <= nx < w and ink[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            area = (x1 - x0 + 1) * (y1 - y0 + 1)
            if area > best:
                best, best_box = area, (x0, y0, x1 + 1, y1 + 1)
    x0, y0, x1, y1 = best_box
    return x0 * k, y0 * k, min(im.width, x1 * k), min(im.height, y1 * k)


def paper(size: tuple[int, int], color: tuple[int, int, int], seed: int) -> Image.Image:
    """Slightly dirty, uneven paper."""
    rnd = random.Random(seed)
    im = Image.new("RGB", size, color)
    noise = Image.effect_noise(size, 18).convert("RGB")
    im = Image.blend(im, noise, 0.06)
    d = ImageDraw.Draw(im)
    for _ in range(6):  # faint stains
        x, y, r = rnd.randrange(size[0]), rnd.randrange(size[1]), rnd.randrange(20, 90)
        d.ellipse([x - r, y - r, x + r, y + r], outline=tuple(int(c * 0.9) for c in color), width=3)
    return im


def centered(d: ImageDraw.ImageDraw, y: int, text: str, f: ImageFont.FreeTypeFont, fill, width: int) -> int:
    box = d.textbbox((0, 0), text, font=f)
    d.text(((width - (box[2] - box[0])) / 2, y), text, font=f, fill=fill)
    return y + (box[3] - box[1]) + int(f.size * 0.35)


def make_flyers() -> None:
    w, h = 600, 800
    im = paper((w, h), (240, 196, 80), 1)
    d = ImageDraw.Draw(im)
    y = centered(d, 50, "FALL", font("DejaVuSerif-Bold.ttf", 120), (120, 40, 10), w)
    y = centered(d, y, "FLING", font("DejaVuSerif-Bold.ttf", 120), (120, 40, 10), w)
    for i in range(9):  # paper leaves
        x, yy = 60 + i * 60, 360 + (i % 3) * 25
        d.ellipse([x, yy, x + 34, yy + 20], fill=(170, 70, 20))
    y = centered(d, 450, "FRIDAY  7 PM  GYM", font("DejaVuSans-Bold.ttf", 44), (60, 30, 10), w)
    y = centered(d, y + 10, "Tickets: $5", font("DejaVuSans.ttf", 40), (60, 30, 10), w)
    centered(d, y, "or 5 Scogg Bucks", font("DejaVuSans-Bold.ttf", 40), (60, 30, 10), w)
    save(im, "flyer_fall_fling.png")

    im = paper((w, h), (40, 70, 150), 2)
    d = ImageDraw.Draw(im)
    y = centered(d, 60, "HOME", font("DejaVuSerif-Bold.ttf", 130), (250, 220, 90), w)
    y = centered(d, y, "COMING", font("DejaVuSerif-Bold.ttf", 110), (250, 220, 90), w)
    d.polygon([(300, 380), (330, 470), (420, 470), (345, 520), (375, 610), (300, 555), (225, 610), (255, 520),
               (180, 470), (270, 470)], fill=(250, 250, 250))
    y = centered(d, 640, "GO SCOGGS!", font("DejaVuSans-Bold.ttf", 60), (250, 250, 250), w)
    centered(d, y, "Dance Saturday 8 PM", font("DejaVuSans.ttf", 36), (230, 230, 230), w)
    save(im, "flyer_homecoming.png")

    im = paper((w, h), (236, 234, 224), 3)
    d = ImageDraw.Draw(im)
    centered(d, 40, "SENIOR CHECKLIST", font("DejaVuSans-Bold.ttf", 52), (20, 20, 20), w)
    items = ["FAFSA", "College apps", "Letters of rec", "Senior dues", "Cap & gown", "Don't deny yourself",
             "   an education"]
    for i, item in enumerate(items):
        yy = 150 + i * 85
        if not item.startswith(" "):
            d.rectangle([50, yy, 92, yy + 42], outline=(20, 20, 20), width=4)
            if i < 3:
                d.line([(56, yy + 20), (70, yy + 36), (100, yy - 8)], fill=(170, 20, 20), width=7)
        d.text((115, yy - 4 if not item.startswith(" ") else yy - 30), item.strip(), font=font("DejaVuSans.ttf", 42),
               fill=(20, 20, 20))
    save(im, "senior_checklist.png")


def make_banner() -> None:
    w, h = 2400, 420
    im = Image.new("RGB", (w, h), (120, 14, 22))
    d = ImageDraw.Draw(im)
    for x in range(0, w, 120):  # folds
        d.rectangle([x, 0, x + 60, h], fill=(108, 12, 20))
    d.rectangle([0, 0, w, 26], fill=(200, 160, 50))
    d.rectangle([0, h - 26, w, h], fill=(200, 160, 50))
    centered(d, 90, "SCOGGINS' SHOWTIME", font("DejaVuSerif-Bold.ttf", 150), (240, 200, 70), w)
    for x in (110, w - 170):
        d.polygon([(x + 30, 130), (x + 42, 170), (x + 85, 170), (x + 50, 195), (x + 62, 238), (x + 30, 212),
                   (x - 2, 238), (x + 10, 195), (x - 25, 170), (x + 18, 170)], fill=(240, 200, 70))
    save(im, "banner_showtime.jpg")


def make_book_spines() -> None:
    """Library shelf fronts: rows of worn book spines in dull colors (procedural)."""
    rnd = random.Random(11)
    w, h = 2048, 512
    im = Image.new("RGB", (w, h), (20, 16, 12))
    d = ImageDraw.Draw(im)
    palette = [(92, 30, 26), (40, 58, 82), (52, 70, 44), (120, 96, 54), (70, 52, 40), (30, 30, 34), (110, 108, 96)]
    x = 0
    while x < w:
        bw = rnd.randint(14, 40)
        top = rnd.randint(30, 110)
        c = tuple(max(0, min(255, v + rnd.randint(-18, 18))) for v in rnd.choice(palette))
        d.rectangle([x, top, x + bw - 2, h], fill=c)
        for _ in range(rnd.randint(0, 3)):  # bands on the spine
            y = rnd.randint(top + 20, h - 40)
            d.rectangle([x + 2, y, x + bw - 4, y + rnd.randint(4, 10)], fill=tuple(min(255, v + 50) for v in c))
        x += bw
    im = Image.blend(im, Image.effect_noise((w, h), 30).convert("RGB"), 0.08)
    save(im, "book_spines.jpg")


def main() -> int:
    only = next((a.split("=", 1)[1].split(",") for a in sys.argv[1:] if a.startswith("--only=")), None)
    # The deck posters, the bill and the Uncle poster now come from the new deck (tools/art/slides.py).
    jobs = {"flyers": make_flyers, "banner": make_banner, "books": make_book_spines}
    for name, job in jobs.items():
        if only is None or name in only:
            job()
    return 0


if __name__ == "__main__":
    sys.exit(main())
