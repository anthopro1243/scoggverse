#!/usr/bin/env python3
"""Turns the Blender renders into the game's art: grades them, crops the see-through layers,
builds the flat jumpscares and the 2D flashes, saves everything as lossy WebP under
Graphics/Scogg/, and writes Scripts/Nights/art_layout.gd (where each layer goes).

  python3 tools/art/build_game_art.py [test|look|final]

Grades: the office stays in full color but much darker, with crushed blacks; camera feeds are
lightly desaturated (the room more than the standees), midtones lifted, a teal-green cast in
the shadows only, crushed and vignetted (grain, scanlines, flicker, the
REC dot and the timestamp are added live in the game). Pictures are only scaled, graded,
blended and overlaid; no face is redrawn or warped.
"""
import json
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import flashes  # noqa: E402
import slides  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
Q = sys.argv[1] if len(sys.argv) > 1 else "final"
RAW = ROOT / f"art/renders/{Q}"
OUT = ROOT / "Graphics/Scogg"
LAYOUT = ROOT / "Scripts/Nights/art_layout.gd"
OFFICE_SIZE = (3000, 1500)
OFFICE_OFFSET = (-540, -210)       # the office sprite's offset in nights.tscn
FEED = (1199, 890)                 # cam_view.gd FEED size
SCREEN = (1920, 1080)
QUALITY = 78
BOTS = ("scoggcrates", "scogga_lisa", "scoggis_khan", "uncle_scogg")
JUMPSCARE_STYLE = {"scoggcrates": "rush", "scoggis_khan": "rush", "scogga_lisa": "flat", "uncle_scogg": "flat"}
FRAMES = 8
CAM_ROOM_SAT = 0.6                 # camera feeds: the room keeps 60% of its color...
CAM_STANDEE_SAT = 1.08             # ...the standees all of theirs (a touch more)
CAM_STANDEE_LEVEL = 0.4           # the brighter quarter of every camera standee reaches this
CAM_STANDEE_MAX_GAIN = 9.0
CAM_MIDTONE_GAMMA = 0.72           # lifts a 0.25 midtone ~40%, leaves black and white alone
CAM_SHADOW_TINT = (0.78, 1.0, 0.96)  # teal-green, shadows only
CAM_LIGHT_TINT = (1.05, 1.0, 0.92)   # lit areas stay warm
HALLUCINATIONS = (8, 46, 51)       # flashed over the office; p. 59 flashes over camera static


# ---------------------------------------------------------------- grading

def _arr(im: Image.Image) -> np.ndarray:
    return np.asarray(im.convert("RGBA"), dtype=np.float32) / 255.0


def _img(a: np.ndarray) -> Image.Image:
    return Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")


def _vignette(w: int, h: int, strength: float) -> np.ndarray:
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2) / math.sqrt(2)
    return (1 - strength * np.clip(r, 0, 1) ** 1.8)[..., None]


def office_grade(im: Image.Image, dark: float = 1.0) -> Image.Image:
    """Full color, much darker, crushed blacks."""
    a = _arr(im)
    rgb = a[..., :3]
    rgb = np.clip((rgb - 0.035) / 0.965, 0, 1) ** 1.25 * 0.82 * dark
    a[..., :3] = rgb * _vignette(a.shape[1], a.shape[0], 0.35)
    return _img(a)


def _smooth(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    t = np.clip((x - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def standee_exposure(im: Image.Image) -> Image.Image:
    """Brightens a camera standee layer until its brighter quarter reaches CAM_STANDEE_LEVEL, so
    every bot reads on a laptop screen however far it stands from the lamp. The render's own light
    falloff across the board is kept (it's one gain), with a soft shoulder instead of clipping."""
    a = _arr(im)
    m = a[..., 3] > 0.5
    if not m.any():
        return im
    y = (a[..., :3] * np.array([0.3, 0.59, 0.11], np.float32)).sum(-1)[m]
    gain = float(np.clip(CAM_STANDEE_LEVEL / max(np.percentile(y, 75), 1e-3), 1.0, CAM_STANDEE_MAX_GAIN))
    x = a[..., :3] * gain
    a[..., :3] = np.where(x < 0.75, x, 0.75 + 0.25 * (1 - np.exp(-(x - 0.75) / 0.25)))
    return _img(a)


def cam_grade(im: Image.Image, vignette: bool = True, standee: bool = False) -> Image.Image:
    """Security-camera look: lightly desaturated (the room more than the standees, so the bots are
    the most colorful thing in the shot), midtones lifted so a standee reads on a laptop screen,
    a teal-green cast in the shadows only, lit areas kept warm, crushed blacks, vignetted corners."""
    a = _arr(im)
    rgb = a[..., :3]
    y = (rgb * np.array([0.3, 0.59, 0.11], np.float32)).sum(-1, keepdims=True)
    rgb = y + (rgb - y) * (CAM_STANDEE_SAT if standee else CAM_ROOM_SAT)
    rgb = np.clip((rgb - 0.02) / 0.98, 0, 1) ** CAM_MIDTONE_GAMMA
    y = (rgb * np.array([0.3, 0.59, 0.11], np.float32)).sum(-1, keepdims=True)
    shadow = (1 - _smooth(y, 0.0, 0.32)) * 0.6
    light = _smooth(y, 0.35, 0.85)
    rgb = rgb * (1 - shadow) + rgb * np.array(CAM_SHADOW_TINT, np.float32) * shadow
    rgb = rgb * (1 - light) + rgb * np.array(CAM_LIGHT_TINT, np.float32) * light
    if vignette:
        rgb = rgb * _vignette(a.shape[1], a.shape[0], 0.62)
    a[..., :3] = rgb
    return _img(a)


def save(im: Image.Image, rel: str, lossless_alpha: bool = False) -> str:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    if im.mode == "RGBA" and im.getextrema()[3][0] == 255:
        im = im.convert("RGB")
    im.save(path.with_suffix(".webp"), "WEBP", quality=QUALITY, method=6, alpha_quality=90)
    return rel


def raw(name: str) -> tuple[Image.Image, dict]:
    meta_path = RAW / f"{name}.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    return Image.open(RAW / f"{name}.png").convert("RGBA"), meta


def to_size(im: Image.Image, size) -> tuple[Image.Image, float]:
    k = size[0] / im.width
    return (im if im.size == tuple(size) else im.resize(tuple(size), Image.LANCZOS)), k


def alpha_crop(im: Image.Image, pad: int = 2) -> tuple[Image.Image, tuple[int, int]]:
    bb = im.split()[3].point(lambda v: 255 if v > 3 else 0).getbbox()
    if bb is None:
        return im.crop((0, 0, 2, 2)), (0, 0)
    x0, y0 = max(0, bb[0] - pad), max(0, bb[1] - pad)
    return im.crop((x0, y0, min(im.width, bb[2] + pad), min(im.height, bb[3] + pad))), (x0, y0)


def feather_rect(im: Image.Image, f: int = 40) -> Image.Image:
    w, h = im.size
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rectangle([f // 2, f // 2, w - f // 2, h - f // 2], fill=255)
    im = im.copy()
    im.putalpha(m.filter(ImageFilter.GaussianBlur(f / 3)))
    return im


# ---------------------------------------------------------------- office

def build_office(layout: dict) -> None:
    ox, oy = OFFICE_OFFSET
    base, _ = raw("office")
    base, k = to_size(base, OFFICE_SIZE)
    save(office_grade(base), "office/office")
    dark, _ = raw("office_dark")
    save(office_grade(to_size(dark, OFFICE_SIZE)[0], 0.6), "office/office_dark")
    for name, kind in ([("office_poster_blank", "rect")] + [(f"office_light_{s}", "feather") for s in (0, 1)]
                       + [(f"office_{k_}_{s}", "alpha") for s in (0, 1) for k_ in ("shutter", "bot")]
                       + [("office_uncle_dark_lit", "alpha"), ("office_uncle_dark_eyes", "alpha")]):
        im, meta = raw(name)
        im, k = to_size(im, OFFICE_SIZE)
        im = office_grade(im, 0.6 if "dark" in name else 1.0)
        x0, y0, x1, y1 = (int(v * k) for v in meta["crop_rect"])
        im = im.crop((x0, y0, x1, y1))
        if kind == "feather":
            im = feather_rect(im)
        if kind == "alpha":
            im, (dx, dy) = alpha_crop(im)
            x0, y0 = x0 + dx, y0 + dy
        key = name.removeprefix("office_")
        save(im, f"office/{key}")
        layout["office"][key] = (x0 + ox, y0 + oy)


# ---------------------------------------------------------------- cameras

def build_cams(layout: dict) -> None:
    import re
    names = sorted(p.stem for p in RAW.glob("cam*.png"))
    for n in names:
        im, _ = raw(n)
        im, _ = to_size(im, FEED)
        m = re.fullmatch(r"(cam\d)__(\w+)", n)
        im = cam_grade(standee_exposure(im) if m else im, standee=bool(m))
        m = re.fullmatch(r"(cam\d)__(\w+)", n)
        if m:
            im, (x, y) = alpha_crop(im)
            save(im, f"cams/{n}")
            layout["cams"].setdefault(m.group(1), {})[m.group(2)] = (x, y)
        else:
            save(im, f"cams/{n}")
    # The Scoggipede crawling across CAM 7 (a 2D sprite, graded like the feed, no vignette).
    sp = Image.open(ROOT / "art/cutouts/scoggipede.png").convert("RGBA")
    sp = sp.resize((380, int(380 * sp.height / sp.width)), Image.LANCZOS)
    save(cam_grade(ImageEnhance.Brightness(sp).enhance(0.75), vignette=False, standee=True), "cams/scoggipede")


# ---------------------------------------------------------------- jumpscares

def grain(im: Image.Image, seed: int, amount: float = 0.09) -> Image.Image:
    random.seed(seed)
    n = Image.effect_noise(im.size, 64).convert("RGB")
    return Image.blend(im.convert("RGB"), n, amount)


def flat_frames(bot: str, bg: Image.Image) -> list[Image.Image]:
    """Jumpscare B: the standee's face only, zooming in fast over a dark room, shaking, pupils glowing."""
    meta = json.loads((ROOT / f"art/cutouts/{bot}.json").read_text())
    cut = Image.open(ROOT / f"art/cutouts/{bot}.png").convert("RGBA")
    (u0, v0), (u1, v1) = meta["pupils_uv"]
    p0 = np.array([u0 * cut.width, v0 * cut.height])
    p1 = np.array([u1 * cut.width, v1 * cut.height])
    eye_d = float(np.linalg.norm(p1 - p0))
    cx, cy = (p0 + p1) / 2 + np.array([0, eye_d * 0.55])
    side = eye_d * 3.6
    face = cut.crop((int(cx - side / 2), int(cy - side * 0.55), int(cx + side / 2), int(cy + side * 0.45)))
    pupils = [(p - np.array([cx - side / 2, cy - side * 0.55])) / side for p in (p0, p1)]
    frames = []
    rnd = random.Random(bot)
    for i in range(FRAMES):
        t = i / (FRAMES - 1)
        zoom = 0.45 + 0.9 * t ** 0.6
        size = int(SCREEN[1] * zoom * 1.15)
        f = face.resize((size, size), Image.LANCZOS)
        out = bg.copy().convert("RGBA")
        amp = 8 + 46 * t
        dx, dy = rnd.uniform(-amp, amp), rnd.uniform(-amp, amp)
        x, y = int(SCREEN[0] / 2 - size / 2 + dx), int(SCREEN[1] * 0.5 - size * 0.48 + dy)
        if i > 0:  # zoom smear: a fainter, slightly smaller copy of the last frame's size
            ps = int(SCREEN[1] * (0.45 + 0.9 * ((i - 1) / (FRAMES - 1)) ** 0.6) * 1.15)
            g = face.resize((ps, ps), Image.BILINEAR)
            g.putalpha(g.split()[3].point(lambda v: int(v * 0.35)))
            out.alpha_composite(g, (int(SCREEN[0] / 2 - ps / 2 - dx), int(SCREEN[1] * 0.5 - ps * 0.48 - dy)))
        out.alpha_composite(f, (x, y))
        glow = Image.new("RGBA", SCREEN, (0, 0, 0, 0))
        d = ImageDraw.Draw(glow)
        for pu, pv in pupils:
            gx, gy = x + pu * size, y + pv * size
            for r, a in ((size * 0.06, 70), (size * 0.03, 150), (size * 0.014, 255)):
                d.ellipse([gx - r, gy - r, gx + r, gy + r], fill=(255, 250, 235, a))
        out.alpha_composite(glow.filter(ImageFilter.GaussianBlur(max(2, size / 220))))
        frames.append(out)
    return frames


def build_jumpscares() -> None:
    dark_bg = ImageEnhance.Brightness(raw("office_dark")[0].convert("RGB").resize(
        (int(SCREEN[1] * 2), SCREEN[1]), Image.LANCZOS).crop((int(SCREEN[1] - SCREEN[0] / 2), 0,
                                                               int(SCREEN[1] + SCREEN[0] / 2), SCREEN[1]))).enhance(0.35)
    for bot in BOTS:
        if JUMPSCARE_STYLE[bot] == "rush":
            frames = [office_grade(to_size(raw(f"jump_{bot}_{i}")[0], SCREEN)[0], 1.15) for i in range(FRAMES)]
        else:
            frames = flat_frames(bot, dark_bg)
        for i, f in enumerate(frames):
            save(grain(f, i).convert("RGB"), f"scares/jump_{bot}_{i}")


# ---------------------------------------------------------------- flashes, title, 6 AM

def build_extras() -> None:
    sc, _ = raw("scoggema_flash")
    save(to_size(sc, SCREEN)[0].convert("RGB"), "scares/scoggema")
    for n in HALLUCINATIONS:
        save(flashes.cover(slides.picture(n), SCREEN), f"scares/halluc_p{n:02d}")
    save(flashes.cover(slides.picture(59), FEED), "scares/halluc_p59")
    save(title_art(), "ui/title")
    bill = Image.open(ROOT / "art/textures/scogg_buck.png").convert("RGB")
    save(bill.resize((900, int(900 * bill.height / bill.width)), Image.LANCZOS), "ui/bill")


def title_art() -> Image.Image:
    """Title screen: the office's "I WANT YOU" poster (the 1917-style Uncle Scogg slide, p. 61)
    pinned to a dark wall in the right half, caught in one warm spotlight from below; the menu
    sits on the left. 2D only (no render): the poster texture, a plaster wall and a light falloff."""
    W, H = SCREEN
    rnd = np.random.default_rng(61)
    wall = rnd.normal(0.16, 0.025, (H // 4, W // 4)).clip(0, 1)
    wall = np.asarray(Image.fromarray((wall * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), dtype=np.float32) / 255
    bg = np.dstack([wall * 1.0, wall * 0.93, wall * 0.86])
    poster = Image.open(ROOT / "art/textures/poster_uncle.png").convert("RGB")
    ph = int(H * 0.86)
    poster = poster.resize((int(poster.width * ph / poster.height), ph), Image.LANCZOS)
    poster = poster.rotate(-2.0, resample=Image.BICUBIC, expand=True, fillcolor=(0, 0, 0))
    mask = Image.new("L", (int(ph * 900 / 1260), ph), 255).rotate(-2.0, resample=Image.BICUBIC, expand=True)
    cx = int(W * 0.69)
    x0, y0 = cx - poster.width // 2, (H - poster.height) // 2
    canvas = Image.fromarray((bg * 255).astype(np.uint8))
    shadow = Image.new("L", (W, H), 0)
    shadow.paste(mask, (x0 + 14, y0 + 22))
    canvas.paste((6, 5, 4), (0, 0), shadow.filter(ImageFilter.GaussianBlur(18)))
    canvas.paste(poster, (x0, y0), mask)
    a = np.asarray(canvas, dtype=np.float32) / 255
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # One warm spot from below the poster, falling off fast; the rest of the wall goes black.
    d = np.sqrt(((xx - cx) / (W * 0.30)) ** 2 + ((yy - H * 0.78) / (H * 0.85)) ** 2)
    light = np.clip(1.15 - d, 0.05, 1.0) ** 1.6
    a = a * light[..., None] * np.array([1.0, 0.86, 0.7], dtype=np.float32)
    out = office_grade(Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).convert("RGBA"), 1.25)
    return grain(out, 61, 0.06).convert("RGB")


# ---------------------------------------------------------------- layout

def write_layout(layout: dict) -> None:
    def v(p) -> str:
        return f"Vector2({p[0]}, {p[1]})"
    lines = ["class_name ArtLayout", "extends RefCounted",
             "## Where each rendered layer goes. Generated by tools/art/build_game_art.py; don't edit by hand.", "",
             "const DIR := \"res://Graphics/Scogg/\"", "",
             "## Office overlays: top-left position in office-sprite space (the sprite is offset by (-540, -210)).",
             "const OFFICE: Dictionary[String, Vector2] = {"]
    lines += [f"\t\"{k}\": {v(p)}," for k, p in sorted(layout["office"].items())]
    lines += ["}", "", "## Bot layers on each camera: top-left position inside the feed (1199 x 890).",
              "const CAM_BOTS: Dictionary[String, Dictionary] = {"]
    for cam, bots in sorted(layout["cams"].items()):
        inner = ", ".join(f"\"{b}\": {v(p)}" for b, p in sorted(bots.items()))
        lines.append(f"\t\"{cam}\": {{{inner}}},")
    lines += ["}", "", f"const JUMPSCARE_FRAMES: int = {FRAMES}",
              "## \"rush\": the standee charges the camera (rendered); \"flat\": its face zooms in full-screen.",
              "const JUMPSCARE_STYLE: Dictionary[String, String] = {"]
    lines += [f"\t\"{b}\": \"{s}\"," for b, s in JUMPSCARE_STYLE.items()]
    lines += ["}", "", "## Hallucination flashes over the office (slide pages); p. 59 flashes over camera static.",
              f"const HALLUCINATIONS: Array[int] = [{', '.join(str(n) for n in HALLUCINATIONS)}]", ""]
    LAYOUT.write_text("\n".join(lines))


def main() -> int:
    layout = {"office": {}, "cams": {}}
    build_office(layout)
    build_cams(layout)
    build_jumpscares()
    build_extras()
    write_layout(layout)
    total = sum(p.stat().st_size for p in OUT.rglob("*.webp"))
    biggest = max(OUT.rglob("*.webp"), key=lambda p: p.stat().st_size)
    print(f"{len(list(OUT.rglob('*.webp')))} files, {total / 1e6:.1f} MB, biggest {biggest.name} "
          f"{biggest.stat().st_size / 1e6:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
