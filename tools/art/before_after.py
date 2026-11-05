#!/usr/bin/env python3
"""Builds docs/art/before_after.png: the Milestone 2 gray-box (docs/art/before/, screenshots of
main) next to the same moments with the Milestone 3 art (docs/screens/raw/desktop_*.png).

  python3 tools/art/before_after.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONT = ImageFont.truetype(str(ROOT / "tools/art/fonts/DejaVuSans-Bold.ttf"), 24)
# (label, before shot name, after shot name); files are <tag>_<NN>_<name>
PAIRS = [
    ("Title", "title", "title"),
    ("Office", "office_start", "office_start"),
    ("Left light, bot at the door", "left_light_brutus_at_door", "left_light_scoggcrates_at_door"),
    ("CAM 1 Stage", "cam_1_stage", "cam_1_stage"),
    ("CAM 5 Drama Room", "cam_5_curtain_peeking", "cam_5_yurt_khan_peeking"),
    ("CAM 6, the sprinter running", "cam_6_quikq_running", "cam_6_khan_running"),
    ("CAM 9, the leader in the corner", "cam_9_ppc_in_corner", "cam_9_uncle_in_corner"),
    ("Power out", "power_out_ppc_at_left_door", "power_out_uncle_at_left_door"),
    ("Jumpscare", "jumpscare", "jumpscare_flat_uncle"),
    ("6 AM", "win_6am_scogg_bucks", "win_6am_scogg_bucks"),
]


def find(folder: Path, tag: str, name: str) -> Image.Image:
    hits = sorted(p for p in folder.glob(f"{tag}_[0-9][0-9]_{name}.*") if p.suffix in (".png", ".jpg"))
    if not hits:
        raise FileNotFoundError(folder / f"{tag}_NN_{name}")
    return Image.open(hits[0]).convert("RGB")


def main() -> None:
    w, h, pad, lab = 760, 428, 12, 34
    sheet = Image.new("RGB", (pad * 3 + w * 2, pad + (h + lab + pad) * len(PAIRS) + 40), (18, 18, 20))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 8), "Before (gray-box, Milestone 2)", font=FONT, fill=(200, 200, 190))
    d.text((pad * 2 + w, 8), "After (Milestone 3 art)", font=FONT, fill=(200, 200, 190))
    y = 48
    for label, before, after in PAIRS:
        for i, im in enumerate((find(ROOT / "docs/art/before", "before", before), find(ROOT / "docs/screens/raw", "desktop", after))):
            sheet.paste(im.resize((w, h), Image.LANCZOS), (pad + i * (w + pad), y))
        d.text((pad + 4, y + h + 4), label, font=FONT, fill=(225, 225, 215))
        y += h + lab + pad
    sheet.save(ROOT / "docs/art/before_after.png", optimize=True)
    print("docs/art/before_after.png")


if __name__ == "__main__":
    main()
