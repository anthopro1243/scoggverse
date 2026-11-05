#!/usr/bin/env python3
"""The class deck used for the final art: assets/reference/the_scogg_files_copy.pdf
("Copy of -The Scogg Files-.pdf"). Page numbers everywhere in the art tools refer to it.

Each page is rendered whole at high resolution (the slides are composites: a picture with the
face pasted on as separate layers, so rendering the page keeps every face exactly as the
classmate made it) and cropped to its picture. Ordinary image tools only, no AI.

  python3 tools/art/slides.py 2 3 61     -> art/cache/deck/p02.png ... (picture crops)
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import textures  # noqa: E402
import numpy as np  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "assets/reference/the_scogg_files_copy.pdf"
CACHE = ROOT / "art/cache/deck"
WIDTH = 4800
TRIM = {55: (0.295, 0.0, 1.0, 1.0)}  # where the slide title touches the picture (0-1 of the crop)
# Slides kept from an older copy of the deck, by name: (pdf, page). The 2026-10-04 deck replaced
# Uncle Scogg's full-body costume slide (old p. 61) with the 1917 "I WANT YOU" poster; the
# full-body one stays his standee (he always shows his legs), so that one page is kept.
NAMED = {"uncle_full_body": (ROOT / "assets/reference/uncle_scogg_full_body.pdf", 1)}


def _tag(n) -> str:
    return n if isinstance(n, str) else f"{n:02d}"


def page(n) -> Image.Image:
    """The whole slide (a deck page number, or a NAMED slide), rendered at WIDTH px."""
    path = CACHE / f"page{_tag(n)}_{WIDTH}.png"
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        pdf, num = NAMED[n] if isinstance(n, str) else (PDF, n)
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(["pdftoppm", "-q", "-f", str(num), "-l", str(num), "-png", "-scale-to", str(WIDTH), str(pdf),
                            f"{tmp}/s"], check=True)
            shutil.move(str(next(Path(tmp).glob("s*.png"))), path)
    return Image.open(path).convert("RGB")


def picture(n) -> Image.Image:
    """The slide's picture (the biggest non-white blob), at full render resolution."""
    path = CACHE / f"p{_tag(n)}.png"
    if not path.exists():
        im = page(n)
        k = im.width / 1200
        x0, y0, x1, y1 = textures.picture_box(im.resize((1200, int(im.height / k))))
        pad = 2
        im = im.crop((max(0, int(x0 * k) - pad), max(0, int(y0 * k) - pad), min(im.width, int(x1 * k) + pad),
                      min(im.height, int(y1 * k) + pad)))
        if n in TRIM:
            a, b, c, d = TRIM[n]
            im = im.crop((int(a * im.width), int(b * im.height), int(c * im.width), int(d * im.height)))
        im.save(path)
    return Image.open(path).convert("RGB")


# Framed posters around the rooms (and the Kennedy campaign poster in the office).
POSTER_PAGES = [5, 6, 7, 22, 23, 29, 37, 39, 54, 55, 56]
# Pages that must never appear in the game (FNAF's own art, modern copyrighted works, a real
# school name, the platformer's art). Anything that builds art from the deck checks this.
BANNED = {9, 10, 12, 16, 19, 20, 27, 35, 36, 42, 50, 58}


# Blackboard chalk drawings: page -> region of the slide (0-1) holding the drawing, and any extra
# face regions (ellipses in 0-1 of that region) that aren't color photos (p. 25's sketched face).
CHALK = {25: ((0.19, 0.2, 0.94, 0.98), [(0.0, 0.02, 0.52, 0.74)]),
         26: ((0.5, 0.2, 0.98, 0.9), []),
         32: ((0.0, 0.17, 1.0, 0.98), []),
         45: ((0.3, 0.08, 0.72, 0.98), []),
         49: ((0.15, 0.2, 0.86, 0.98), [])}


def region(n: int, box) -> Image.Image:
    """Part of a slide (box in 0-1 page coordinates), trimmed to its ink."""
    im = page(n)
    im = im.crop((int(box[0] * im.width), int(box[1] * im.height), int(box[2] * im.width), int(box[3] * im.height)))
    ink = im.convert("L").point(lambda v: 255 if v < 225 else 0)
    bb = ink.getbbox()
    return im.crop((max(0, bb[0] - 20), max(0, bb[1] - 20), min(im.width, bb[2] + 20), min(im.height, bb[3] + 20)))


def face_mask(im: Image.Image, extra) -> Image.Image:
    """The pasted-on faces: saturated (skin-colored) blobs, opened to drop thin colored lines and
    closed to take in the glasses, plus any listed extra ellipses. The morphology runs on a
    1/6-size copy (big kernels are slow at full size)."""
    k = 6
    small = im.resize((im.width // k, im.height // k), Image.BILINEAR)
    h_, s_, v_ = (np.asarray(c, dtype=np.int16) for c in small.convert("HSV").split())
    skin = Image.fromarray((((s_ > 55) & (v_ > 50) & ((h_ < 30) | (h_ > 235))) * 255).astype(np.uint8))
    r = max(3, small.width // 80) | 1
    skin = skin.filter(ImageFilter.MinFilter(r)).filter(ImageFilter.MaxFilter(r * 3 | 1))
    skin = skin.filter(ImageFilter.MinFilter(r * 2 - 1 | 1))
    mask = skin.resize(im.size, Image.BILINEAR).point(lambda v: 255 if v > 127 else 0)
    d = ImageDraw.Draw(mask)
    for a, b, c, e in extra:
        d.ellipse([a * im.width, b * im.height, c * im.width, e * im.height], fill=255)
    return mask.filter(ImageFilter.GaussianBlur(2))


def chalk(n: int) -> Image.Image:
    """A slide drawing as chalk (RGBA): dark ink becomes white chalk, colored strokes become
    colored chalk, and the faces are kept exactly as they are (like photos taped to the board)."""
    box, extra = CHALK[n]
    im = region(n, box)
    faces = face_mask(im, extra)
    L = im.convert("L")
    hsv = im.convert("HSV")
    sat = hsv.split()[1]
    ink = L.point(lambda v: max(0, min(255, int((232 - v) * 255 / 110))))
    grain = Image.effect_noise(im.size, 70).point(lambda v: 150 + v // 3)
    ink = ImageChops.multiply(ink, grain)
    white = Image.new("RGB", im.size, (236, 236, 228))
    tinted = Image.blend(im, Image.new("RGB", im.size, (255, 255, 255)), 0.35)
    color = Image.composite(tinted, white, sat.point(lambda v: 255 if v > 70 else 0))
    out = color.convert("RGBA")
    out.putalpha(ink)
    photo = im.convert("RGBA")
    photo.putalpha(faces)
    out.alpha_composite(photo)
    return out


def make_chalkboard() -> None:
    """The stage blackboard: the five chalk drawings on dusty slate."""
    W, H = 3000, 1250
    board = Image.new("RGB", (W, H), (34, 44, 38))
    smudge = Image.effect_noise((W // 16, H // 16), 30).resize((W, H), Image.BICUBIC)
    board = Image.blend(board, Image.merge("RGB", (smudge, smudge, smudge)), 0.12)
    slots = [(25, (60, 50, 1440, 600)), (32, (1560, 50, 2940, 600)), (26, (60, 650, 960, 1200)),
             (45, (1040, 650, 1940, 1200)), (49, (2020, 650, 2940, 1200))]
    out = board.convert("RGBA")
    for n, (x0, y0, x1, y1) in slots:
        c = chalk(n)
        k = min((x1 - x0) / c.width, (y1 - y0) / c.height)
        c = c.resize((int(c.width * k), int(c.height * k)), Image.LANCZOS)
        out.alpha_composite(c, (x0 + (x1 - x0 - c.width) // 2, y0 + (y1 - y0 - c.height) // 2))
    out.convert("RGB").save(textures.OUT / "chalkboard_deck.jpg", quality=90)


def save_poster(n: int, long_side: int = 1400) -> Path:
    assert n not in BANNED, f"page {n} is not allowed in the game"
    im = picture(n)
    k = long_side / max(im.size)
    path = textures.OUT / f"deck_p{n:02d}.jpg"
    im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS).save(path, quality=90)
    return path


def make_bill() -> None:
    """The Scogg Buck: p. 17's "In Scogg We Trust" $20, used for the desk bills and the 6 AM card."""
    im = picture(17)
    im.resize((1024, int(1024 * im.height / im.width)), Image.LANCZOS).save(textures.OUT / "scogg_buck.png")


def on_paper(im: Image.Image, tol: int = 38) -> Image.Image:
    """The slide's plain white background made see-through (magic wand: a flood fill from the
    edges), so the figure sits on the poster paper. Pixels inside the figure are untouched."""
    pad = 4
    work = Image.new("RGB", (im.width + 2 * pad, im.height + 2 * pad), (255, 255, 255))
    work.paste(im, (pad, pad))
    ImageDraw.floodfill(work, (0, 0), (255, 0, 255), thresh=tol)
    key = np.all(np.asarray(work) == (255, 0, 255), axis=2)[pad:-pad, pad:-pad]
    alpha = Image.fromarray(((~key) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    out = im.convert("RGBA")
    out.putalpha(alpha)
    return out


def make_poster_uncle() -> None:
    """The office poster: the 1917-style Uncle Scogg slide (p. 61, head and shoulders, pointing),
    "I WANT YOU... to not deny yourself an education"; and the blank version for when he has left
    the stage. The title screen uses the same poster (build_game_art.py)."""
    w, h = 900, 1260
    im = textures.paper((w, h), (232, 222, 196), 7)
    d = textures.ImageDraw.Draw(im)
    d.rectangle([18, 18, w - 18, h - 18], outline=(40, 40, 70), width=8)
    fig = on_paper(picture(61))
    box_w, box_h = w - 120, 820  # the picture area above the headline
    k = min(box_w / fig.width, box_h / fig.height)
    fig = fig.resize((int(fig.width * k), int(fig.height * k)), Image.LANCZOS)
    x0, y0 = (w - box_w) // 2, 50
    im.paste(fig, (x0 + (box_w - fig.width) // 2, y0 + box_h - fig.height), fig)
    d = textures.ImageDraw.Draw(im)
    d.rectangle([x0, y0, x0 + box_w, y0 + box_h], outline=(40, 40, 70), width=4)
    serif = lambda size: textures.font("DejaVuSerif-Bold.ttf", size)
    y = textures.centered(d, 900, "I WANT YOU", serif(120), (170, 24, 30), w)
    y = textures.centered(d, y, "...to not deny yourself", serif(56), (30, 30, 60), w)
    textures.centered(d, y, "an education", serif(56), (30, 30, 60), w)
    textures.save(im, "poster_uncle.png")
    blank = textures.paper((w, h), (232, 222, 196), 7)
    d = textures.ImageDraw.Draw(blank)
    d.rectangle([18, 18, w - 18, h - 18], outline=(40, 40, 70), width=8)
    d.rectangle([x0, y0, x0 + box_w, y0 + box_h], outline=(40, 40, 70), width=4)
    textures.centered(d, 900, "I WANT YOU", serif(120), (170, 24, 30), w)
    textures.save(blank, "poster_uncle_blank.png")


def main() -> int:
    textures.OUT.mkdir(parents=True, exist_ok=True)
    for n in POSTER_PAGES:
        print(save_poster(n).relative_to(ROOT))
    make_bill()
    make_poster_uncle()
    make_chalkboard()
    return 0


if __name__ == "__main__":
    sys.exit(main())
