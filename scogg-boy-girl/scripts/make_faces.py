#!/usr/bin/env python3
"""Cut Scogg Boy's and Scogg Girl's faces out of page 20 of the class deck.

Ordinary tools only: poppler renders the page, Pillow crops it and adds an alpha mask.
No retouching. The faces are cut exactly where the classmate placed them on the
slide: the slide clips the photo to an oval, and we read that oval's geometry straight
from the PDF (pdftocairo -svg), then use it as the alpha mask.

Usage: python3 scripts/make_faces.py [deck.pdf]
"""
import os
import re
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets", "faces")
DECKS = [
    os.path.join(ROOT, "..", "assets", "reference", "the_scogg_files_copy.pdf"),
    os.path.expanduser("~/scoggverse/hq/scoggverse-hq/assets/scogg-files-curated.pdf"),
]
PAGE = 20
TITLE = "Scoggboy and Scoggirl"
DPI = 345          # the face photo's native resolution on the slide (pdfimages -list), so nothing is upscaled
SS = 8             # supersampling for a smooth mask edge
INSET_PX = 1.0     # drop the outermost ring, where the render blends the face into the slide's art


def run(*cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def ovals(deck, tmp):
    """The two oval clip paths on the page, in PDF points: [(cx, cy, rx, ry), ...] left to right."""
    svg = os.path.join(tmp, "p.svg")
    run("pdftocairo", "-svg", "-f", str(PAGE), "-l", str(PAGE), deck, svg)
    text = open(svg, encoding="utf8").read()
    found = []
    for body in re.findall(r"<clipPath[^>]*>(.*?)</clipPath>", text, re.S):
        d = re.search(r'd="([^"]*)"', body)
        if not d or "C" not in d.group(1):
            continue  # rectangles; the face clips are drawn with curves
        nums = [float(n) for n in re.findall(r"-?\d+\.?\d*", d.group(1))]
        xs, ys = nums[0::2], nums[1::2]
        found.append(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (max(xs) - min(xs)) / 2, (max(ys) - min(ys)) / 2))
    if len(found) != 2:
        sys.exit(f"expected 2 oval face clips on p.{PAGE}, found {len(found)}")
    return sorted(found)


def main():
    deck = sys.argv[1] if len(sys.argv) > 1 else next((d for d in DECKS if os.path.exists(d)), None)
    if not deck:
        sys.exit("no deck PDF found")
    title = run("pdftotext", "-f", str(PAGE), "-l", str(PAGE), deck, "-").strip().splitlines()[0]
    if TITLE not in title:
        sys.exit(f"p.{PAGE} is '{title}', not the {TITLE} slide; find it by title and update PAGE")
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        run("pdftoppm", "-f", str(PAGE), "-l", str(PAGE), "-r", str(DPI), "-png", deck, os.path.join(tmp, "p"))
        page = Image.open(next(os.path.join(tmp, f) for f in os.listdir(tmp) if f.endswith(".png"))).convert("RGB")
        k = DPI / 72
        for name, (cx, cy, rx, ry) in zip(("scogg-boy", "scogg-girl"), ovals(deck, tmp)):
            cx, cy, rx, ry = cx * k, cy * k, rx * k - INSET_PX, ry * k - INSET_PX
            box = (int(cx - rx) - 1, int(cy - ry) - 1, int(cx + rx) + 2, int(cy + ry) + 2)
            face = page.crop(box)
            mask = Image.new("L", (face.width * SS, face.height * SS), 0)
            ox, oy = (cx - box[0]) * SS, (cy - box[1]) * SS
            ImageDraw.Draw(mask).ellipse((ox - rx * SS, oy - ry * SS, ox + rx * SS, oy + ry * SS), fill=255)
            face.putalpha(mask.resize(face.size, Image.LANCZOS))
            path = os.path.join(OUT, f"{name}.png")
            face.save(path, optimize=True)  # no text chunks: the repo's metadata test checks every image
            print(f"{name}: {face.width}x{face.height} px, oval {2*rx:.1f}x{2*ry:.1f} px -> {os.path.relpath(path, ROOT)}")


if __name__ == "__main__":
    main()
