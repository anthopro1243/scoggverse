#!/usr/bin/env python3
"""Cut the three stretched-face candidates out of page 40 of the class deck.

Ordinary tools only: poppler renders the page, Pillow crops it and adds an alpha mask.
No AI, no retouching, no stretching of our own. On p. 40 ("The Virtuous Economic Scyggle")
a classmate stretched his face wide and clipped it to an oval three times; we read each
face's clip shapes (the oval and Slides' crop box) straight from the PDF (pdftocairo -svg),
render the page at the face photo's native resolution and use those shapes as the alpha mask.
The stretch, the mirroring and the sideways turn are all the classmate's, kept as placed.

Usage: python3 scripts/make_faces.py [deck.pdf]
"""
import math
import os
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "assets", "faces")
DECKS = [
    os.path.join(ROOT, "..", "assets", "reference", "the_scogg_files_copy.pdf"),
    os.path.expanduser("~/scoggverse-hq/assets/scogg-files-curated.pdf"),
]
PAGE = 40
TITLE = "The Virtuous Economic Scyggle"
# Each candidate is found by where its oval sits on the slide (PDF points, 720x405 page).
CANDIDATES = {
    "a": (435.5, 224.0),  # right of the cycle: upright, stretched wide, mirrored by the classmate
    "b": (293.6, 223.9),  # left of the cycle: turned on its side, stretched along the face
    "c": (366.4, 145.2),  # top of the cycle: on its side the other way, stretched further
}
SS = 4          # supersampling for a smooth mask edge
INSET_PX = 1    # drop the outermost ring, where the render blends the face into the slide

SVG = "{http://www.w3.org/2000/svg}"
XLINK = "{http://www.w3.org/1999/xlink}href"


def run(*cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def flatten(d):
    """An absolute M/L/C/Z path as a list of closed polygons (cubic curves cut into 24 pieces)."""
    tokens = re.findall(r"[MLCZ]|-?\d+\.?\d*(?:e-?\d+)?", d)
    polys, cur, i, cmd = [], [], 0, None
    while i < len(tokens):
        t = tokens[i]
        if t in "MLCZ":
            cmd = t
            i += 1
            if t == "Z":
                if cur:
                    polys.append(cur)
                cur = []
            continue
        if cmd == "M":
            if cur:
                polys.append(cur)
            cur = [(float(tokens[i]), float(tokens[i + 1]))]
            i += 2
            cmd = "L"
        elif cmd == "L":
            cur.append((float(tokens[i]), float(tokens[i + 1])))
            i += 2
        elif cmd == "C":
            x0, y0 = cur[-1]
            x1, y1, x2, y2, x3, y3 = (float(v) for v in tokens[i:i + 6])
            for k in range(1, 25):
                s = k / 24
                u = 1 - s
                cur.append((u**3 * x0 + 3 * u * u * s * x1 + 3 * u * s * s * x2 + s**3 * x3,
                            u**3 * y0 + 3 * u * u * s * y1 + 3 * u * s * s * y2 + s**3 * y3))
            i += 6
    if cur:
        polys.append(cur)
    return [p for p in polys if len(p) > 2]


def faces_on_page(svg_path):
    """Every 400x400 face photo drawn on the page: its transform and the clip shapes around it."""
    tree = ET.parse(svg_path)
    root = tree.getroot()
    clips = {c.get("id"): c.find(f"{SVG}path").get("d") for c in root.iter(f"{SVG}clipPath") if c.find(f"{SVG}path") is not None}
    photos = {im.get("id") for im in root.iter(f"{SVG}image") if im.get("width") == "400" and im.get("height") == "400"}
    found = []

    def walk(el, stack):
        cp = el.get("clip-path")
        if cp:
            stack = stack + [clips[cp[5:-1]]]
        if el.tag == f"{SVG}use" and (el.get(XLINK) or "")[1:] in photos:
            m = [float(v) for v in re.findall(r"-?\d+\.?\d*(?:e-?\d+)?", el.get("transform"))]
            found.append({"matrix": m, "clips": stack})
        for ch in el:
            walk(ch, stack)

    walk(root, [])
    return found


def bbox(polys):
    xs = [x for p in polys for x, _ in p]
    ys = [y for p in polys for _, y in p]
    return min(xs), min(ys), max(xs), max(ys)


def main():
    deck = sys.argv[1] if len(sys.argv) > 1 else next((d for d in DECKS if os.path.exists(d)), None)
    if not deck:
        sys.exit("no deck PDF found")
    title = run("pdftotext", "-f", str(PAGE), "-l", str(PAGE), deck, "-").strip().splitlines()[0]
    if TITLE not in title:
        sys.exit(f"p.{PAGE} is '{title}', not '{TITLE}'; find the slide by title and update PAGE")
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        svg = os.path.join(tmp, "p.svg")
        run("pdftocairo", "-svg", "-f", str(PAGE), "-l", str(PAGE), deck, svg)
        faces = faces_on_page(svg)
        for name, (ex, ey) in CANDIDATES.items():
            def center(f):
                x0, y0, x1, y1 = bbox(flatten(f["clips"][-1]))
                return (x0 + x1) / 2, (y0 + y1) / 2
            face = min(faces, key=lambda f: math.dist(center(f), (ex, ey)))
            if math.dist(center(face), (ex, ey)) > 6:
                sys.exit(f"face {name}: no clipped face photo near {ex},{ey} on p.{PAGE}")
            a, b, c, d = face["matrix"][:4]
            # PDF points per photo pixel along each of the photo's axes; render at the finer one's
            # native resolution, so no axis is upscaled past what the classmate's stretch already did.
            dpi = math.floor(min(72 / math.hypot(a, b), 72 / math.hypot(c, d)))
            run("pdftoppm", "-f", str(PAGE), "-l", str(PAGE), "-r", str(dpi), "-png", deck, os.path.join(tmp, name))
            page = Image.open(next(os.path.join(tmp, f) for f in sorted(os.listdir(tmp)) if f.startswith(name + "-"))).convert("RGB")
            k = dpi / 72
            shapes = [flatten(cd) for cd in face["clips"]]
            x0, y0, x1, y1 = bbox(shapes[-1])
            box = (math.floor(x0 * k) - 1, math.floor(y0 * k) - 1, math.ceil(x1 * k) + 1, math.ceil(y1 * k) + 1)
            w, h = box[2] - box[0], box[3] - box[1]
            mask = Image.new("L", (w * SS, h * SS), 255)
            for polys in shapes:  # the visible face is inside every clip at once
                layer = Image.new("L", mask.size, 0)
                draw = ImageDraw.Draw(layer)
                for p in polys:
                    draw.polygon([((x * k - box[0]) * SS, (y * k - box[1]) * SS) for x, y in p], fill=255)
                mask = Image.composite(mask, layer, layer)
            mask = mask.filter(ImageFilter.MinFilter(2 * INSET_PX * SS + 1))
            out = page.crop(box)
            out.putalpha(mask.resize(out.size, Image.LANCZOS))
            out = out.crop(out.getbbox())
            path = os.path.join(OUT, f"face-{name}.png")
            out.save(path, optimize=True)  # no text chunks: the repo's metadata test checks every image
            print(f"face-{name}: {out.width}x{out.height} px at {dpi} dpi (photo scale {math.hypot(a, b):.3f} x {math.hypot(c, d):.3f} pt/px) -> {os.path.relpath(path, ROOT)}")


if __name__ == "__main__":
    main()
