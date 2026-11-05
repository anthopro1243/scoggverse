#!/usr/bin/env python3
"""The link-preview image (web/og.png, 1200x630): the title art (the "I WANT YOU" poster in its
spotlight) with the game's name on the left, like the title screen. Run after
tools/art/build_game_art.py and the web export:  python3 tools/web/make_og.py"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONT = ROOT / "tools/art/fonts/DejaVuSans-Bold.ttf"


def main() -> None:
    art = Image.open(ROOT / "Graphics/Scogg/ui/title.webp").convert("RGB")
    W, H = 1200, 630
    k = H / art.height
    art = art.resize((int(art.width * k), H), Image.LANCZOS)
    im = art.crop((art.width - W, 0, art.width, H))
    d = ImageDraw.Draw(im)
    d.text((60, 170), "FIVE NIGHTS AT", font=ImageFont.truetype(str(FONT), 54), fill=(218, 218, 218))
    d.text((56, 230), "SCOGGY'S", font=ImageFont.truetype(str(FONT), 104), fill=(226, 38, 42))
    d.text((62, 370), "Don't deny yourself an education.", font=ImageFont.truetype(str(FONT), 26), fill=(150, 150, 150))
    d.text((62, 560), "A free fan parody of Five Nights at Freddy's", font=ImageFont.truetype(str(FONT), 20),
           fill=(110, 110, 110))
    im.save(ROOT / "web/og.png", optimize=True)
    print("web/og.png", im.size)


if __name__ == "__main__":
    main()
