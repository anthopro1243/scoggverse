#!/usr/bin/env python3
"""Spectrogram contact sheet of every sound in Audio/ (a visual check: shape, clipping, loudness).

  python3 tools/audio/spectro_sheet.py [out.png]
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SR = 22050


def decode(p: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, "<i2").astype(np.float32) / 32768


def spectro(x: np.ndarray, w=420, h=120) -> Image.Image:
    frame, hop = 1024, 256
    x = np.concatenate([x, np.zeros(frame)])
    n = max(1, (len(x) - frame) // hop)
    win = np.hanning(frame)
    S = np.array([np.abs(np.fft.rfft(x[i * hop:i * hop + frame] * win)) for i in range(n)]).T
    S = 20 * np.log10(S + 1e-9)
    S = np.clip((S - S.max() + 60) / 60, 0, 1)
    # Log frequency axis (40 Hz to 11 kHz).
    f = np.fft.rfftfreq(frame, 1 / SR)
    rows = np.geomspace(40, 11000, h)[::-1]
    idx = np.searchsorted(f, rows).clip(0, len(f) - 1)
    img = (S[idx] * 255).astype(np.uint8)
    im = Image.fromarray(img).resize((w, h))
    return Image.merge("RGB", (im, im.point(lambda v: int(v ** 1.6 / 255 ** 0.6)), im.point(lambda v: int(v * 0.4))))


def main() -> int:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs/audio/spectrograms.png"
    files = sorted((ROOT / "Audio").glob("*.ogg"))
    W, H = 440, 150
    cols = 3
    sheet = Image.new("RGB", (W * cols, H * ((len(files) + cols - 1) // cols)), (12, 12, 12))
    d = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("DejaVuSans.ttf", 13)
    for i, p in enumerate(files):
        x = decode(p)
        rms = 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
        pk = 20 * np.log10(np.abs(x).max() + 1e-9)
        cx, cy = (i % cols) * W, (i // cols) * H
        sheet.paste(spectro(x), (cx + 10, cy + 22))
        d.text((cx + 10, cy + 4), f"{p.stem}  {len(x) / SR:.1f}s  rms {rms:.0f} dB  peak {pk:.1f}", font=font, fill=(230, 230, 230))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out)
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
