#!/usr/bin/env python3
"""2D helpers for the flashes (ordinary image ops, no AI): fitting a slide picture to the
screen, camera static, scanlines, and a preview of a hallucination frame. The pictures are only
scaled, blended and overlaid; the faces in them are never torn or warped."""
import random
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance

sys.path.insert(0, str(Path(__file__).resolve().parent))
import slides  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def cover(im: Image.Image, size) -> Image.Image:
    w, h = size
    k = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * k) + 1, int(im.height * k) + 1), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def static(size, seed: int, amount: int = 90) -> Image.Image:
    random.seed(seed)
    n = Image.effect_noise(size, amount).convert("RGB")
    return ImageEnhance.Contrast(n).enhance(1.6)


def scanlines(im: Image.Image, every: int = 4, dark: float = 0.82) -> Image.Image:
    mask = Image.new("L", im.size, 255)
    d = ImageDraw.Draw(mask)
    for y in range(0, im.height, every):
        d.line([(0, y), (im.width, y)], fill=int(255 * dark))
    return ImageChops.multiply(im.convert("RGB"), Image.merge("RGB", (mask, mask, mask)))


def hallucination(frame: Image.Image, page: int, seed: int = 1, over_static: bool = False) -> Image.Image:
    """One frame of a hallucination flash: the slide picture over the view (or over camera static)."""
    pic = cover(slides.picture(page), frame.size)
    base = static(frame.size, seed) if over_static else frame
    out = Image.blend(base.convert("RGB"), pic, 0.85)
    # Static and scanlines on top; the picture itself (and the face in it) is never torn or warped.
    out = Image.blend(out, static(frame.size, seed + 1, 60), 0.1)
    return scanlines(out)
