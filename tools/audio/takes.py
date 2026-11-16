"""Cutting and layering the recordings in recordings/ (CC0, listed in recordings/SOURCES.md).

The screams and the steps are made from these, because a synthesized scream reads as one brassy note (players
heard an elephant) and a synthesized step as a drum machine. Everything else in the game is still synthesized.
"""
import subprocess
from functools import cache
from pathlib import Path

import numpy as np

from dsp import SR, highpass, lowpass, t

REC = Path(__file__).resolve().parent / "recordings"
rng = np.random.default_rng(1951)  # its own, so cutting takes never shifts the synthesized sounds' noise


@cache
def take(name: str) -> np.ndarray:
    """A whole recording, mono at the game's rate."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(REC / f"{name}.ogg"), "-f", "f32le", "-ac", "1",
                          "-ar", str(SR), "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def cut(name: str, a: float, b: float, fin: float = 0.004, fout: float = 0.03) -> np.ndarray:
    """Seconds a to b of a recording, with short fades so the edges don't click."""
    x = take(name)[int(a * SR):int(b * SR)].copy()
    n_in, n_out = min(len(x), int(fin * SR)), min(len(x), int(fout * SR))
    if n_in:
        x[:n_in] *= np.linspace(0, 1, n_in)
    if n_out:
        x[-n_out:] *= np.linspace(1, 0, n_out)
    return x


def repitch(x: np.ndarray, ratio: float) -> np.ndarray:
    """Tape-style: pitch and speed together (0.85 is lower and slower)."""
    if ratio == 1:
        return x
    n = int(len(x) / ratio)
    return np.interp(np.arange(n) * ratio, np.arange(len(x)), x)


def rms(x: np.ndarray) -> float:
    return float(np.sqrt(np.mean(x ** 2))) or 1e-9


def at_db(x: np.ndarray, db: float) -> np.ndarray:
    """Levels a layer by its loudness (RMS), so layer gains mean the same thing whatever the take."""
    return x / rms(x) * 0.1 * 10 ** (db / 20)


def limit(x: np.ndarray, push_db: float, release: float = 0.08) -> np.ndarray:
    """A look-ahead peak limiter: raises the sound by `push_db` and holds its peaks at the old top. Real takes have
    sharp peaks, so at the same peak they're far quieter than a synthesized tone; this brings their body up."""
    x = x / np.abs(x).max() * 10 ** (push_db / 20)
    look = int(0.004 * SR)
    a = np.abs(x)
    hold = np.maximum.reduce([np.roll(a, k) for k in range(-look, look + 1, 4)])
    need = np.maximum(hold, 1.0)
    k = np.exp(-1 / (release * SR))
    g = np.empty_like(need)
    cur = need[0]
    for i, v in enumerate(need):  # jump up at once, come back down over `release`
        cur = v if v > cur else v + (cur - v) * k
        g[i] = cur
    return x / g


def room(x: np.ndarray, seconds: float, wet: float, damp_hz: float = 4000) -> np.ndarray:
    """A plain room: decaying noise that darkens a little. Unlike dsp.reverb it has no low layer, which hummed."""
    tt = t(seconds)
    ir = lowpass(rng.standard_normal(len(tt)), damp_hz, 1) * np.exp(-tt * 6.9 / seconds)
    ir = highpass(ir, 200, 1)
    ir[: int(SR * 0.006)] = 0  # the first reflection arrives a little late
    ir /= np.sqrt(np.sum(ir ** 2))
    n = len(x) + len(ir) - 1
    w = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)
    return np.concatenate([x, np.zeros(len(w) - len(x))]) * (1 - wet) + w * wet * 2.0


# ---------------------------------------------------------------- the jumpscares

def tape_stop(x: np.ndarray, seconds: float) -> np.ndarray:
    """Plays x while slowing to a halt over `seconds`, like a tape or a record losing power."""
    n = int(seconds * SR)
    pos = np.cumsum(np.linspace(1, 0, n) ** 1.5)
    pos = pos[pos < len(x) - 1]
    return np.interp(pos, np.arange(len(x)), x)


def thud() -> np.ndarray:
    """The hit on a scare's first frame: a boot stomp on the tile, an octave down (a body landing, not a cymbal)."""
    return repitch(cut("steps_boots_tile", 17.245, 17.6, 0.001, 0.12), 0.55)


def scream(layers, length: float = 1.35, grit: float = 2.0, push: float = 8.0) -> np.ndarray:
    """Layers recordings into one scare. `layers`: (recording or a ready sound, a, b, pitch, start_s, db); a ready
    sound ignores a and b. It lands on a thud, is driven a little hot (a blown-out speaker), holds, then cuts off
    quickly after `length` seconds."""
    out = np.zeros(int((length + 0.2) * SR))
    for name, a, b, pitch, start, db in layers:
        x = name if isinstance(name, np.ndarray) else cut(name, a, b, 0.002, 0.06)
        x = at_db(repitch(x, pitch), db)
        i = int(start * SR)
        x = x[: max(0, len(out) - i)]
        out[i:i + len(x)] += x
    hit = at_db(thud(), 2)
    out[: len(hit)] += hit[: len(out)]
    out = highpass(out, 70, 2)
    out = np.tanh(out / np.abs(out).max() * grit) / np.tanh(grit)
    s = t(len(out) / SR)
    out *= np.clip((length + 0.12 - s) / 0.12, 0, 1) ** 2  # a fast cut-off, not a slow fade
    return limit(room(out, 0.7, 0.12, 5000), push, 0.02)  # last, since the room's own peaks would undo it


# ---------------------------------------------------------------- footsteps

# Where each clean step starts in its recording (found by the loudness of each hit; the strongest ones).
STEP_HITS = {
    "steps_sneakers_slow": [1.76, 5.03, 8.90, 19.91, 21.89],
    "steps_sneakers_fast": [0.99, 1.71, 2.45, 7.26, 8.36, 9.15, 9.52, 12.16, 16.73],
    "steps_boots_tile": [10.65, 13.65, 17.26, 19.11, 20.81, 34.56],
    "steps_dragging_boots": [2.15, 8.06, 10.82, 11.93],
}


def step(name: str, k: int, pitch: float = 1.0, length: float = 0.3) -> np.ndarray:
    at = STEP_HITS[name][k]
    return repitch(cut(name, at - 0.015, at + length, 0.003, 0.08), pitch)


def walk(name: str, n: int, gap: float, pitch: float = 1.0, drag: str | None = None) -> np.ndarray:
    """n real steps, each a different take, a little uneven in time and strength. `drag` lays a quieter scuff from
    a second recording under each step."""
    pool = list(range(len(STEP_HITS[name])))
    picks = rng.choice(pool, size=n, replace=len(pool) < n)
    out = np.zeros(int((n * gap + 0.5) * SR))
    for i, k in enumerate(picks):
        x = step(name, k, pitch)
        x = x / np.abs(x).max() * rng.uniform(0.75, 1.0)
        if drag:
            d = step(drag, rng.integers(len(STEP_HITS[drag])), pitch, 0.4)
            x = np.concatenate([x, np.zeros(max(0, len(d) - len(x)))])
            x[: len(d)] += d / np.abs(d).max() * 0.35
        j = int((i * gap + rng.uniform(-0.02, 0.02) + 0.02) * SR)
        out[j:j + len(x)] += x[: len(out) - j]
    return highpass(out, 60, 2)


def hallway(x: np.ndarray, push: float = 9.0) -> np.ndarray:
    """A tiled school hall: the recordings already have some room, so only a little more. Limited last."""
    return limit(room(x, 1.4, 0.28, 3500), push, 0.04)


def far(x: np.ndarray, push: float = 6.0) -> np.ndarray:
    """Down the halls: the highs gone, mostly room."""
    return limit(room(lowpass(x, 900, 2), 2.2, 0.6, 1500), push, 0.04)
