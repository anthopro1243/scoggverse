#!/usr/bin/env python3
"""Every sound in the game. Most are synthesized from scratch with numpy (oscillators, noise, filters and
a synthetic reverb); the four screams and the footsteps are cut and layered from CC0 recordings (takes.py,
recordings/SOURCES.md), the same ones game 2 uses. Writes Audio/*.ogg (Vorbis).

  python3 tools/audio/make_sounds.py            # all sounds
  python3 tools/audio/make_sounds.py march fan  # just these

The power-out march is Sousa's "The Stars and Stripes Forever" (1896, public domain), the trio,
played on a synthesized music box from the notes below (transcribed from the Mutopia Project's
public-domain LilyPond edition, piece 626).
"""
import math
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from strip_metadata import strip_ogg  # noqa: E402
from dsp import (SR, bandpass, convolve, decay, drive, env_adsr, fade, highpass, impulse,  # noqa: E402
                 loop_freq, lowpass, mix, noise, norm, phase_of, place, resonate, reverb, rng,
                 saw, silence, sine, spectral, square, stft_filter, t, write_wav)
import takes  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "Audio"
SOUNDS: dict = {}


def sound(name: str, quality: float = 3, loop: bool = False):
    def deco(fn):
        SOUNDS[name] = (fn, quality, loop)
        return fn
    return deco


def midi_hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


# ================================================================= ambience (loops)

@sound("amb_office", loop=True)
def amb_office():
    """Office: fluorescent ballast hum, faint vent rumble and air, a little room."""
    L = 12.0
    s = t(L)
    f120 = loop_freq(120, L)
    ballast = np.tanh(2.2 * np.sin(2 * math.pi * f120 * s)) * 0.5
    ballast += 0.25 * np.sin(2 * math.pi * loop_freq(60, L) * s)
    ballast = lowpass(ballast, 1400, 2, circular=True)
    # The tube flickers twice a loop: the buzz dips and crackles.
    flick = np.ones_like(s)
    for c in (3.1, 8.7):
        flick -= 0.35 * np.exp(-((s - c) / 0.06) ** 2)
    ballast *= flick
    rumble = lowpass(noise(L), 160, 2, circular=True) * 1.6
    air = bandpass(noise(L), 250, 1600, 1, circular=True) * 0.18
    air *= 0.8 + 0.2 * np.sin(2 * math.pi * loop_freq(0.25, L) * s)
    x = ballast * 0.55 + rumble * 0.5 + air
    return reverb(x, 0.6, 0.15, 2500, circular=True)


@sound("amb_cams", loop=True)
def amb_cams():
    """Cameras: an emptier room tone. A low, slowly beating drone far down the halls, tape hiss,
    a faint high CRT whine, and one far-off pipe tick."""
    L = 10.0
    s = t(L)
    drone = np.sin(2 * math.pi * loop_freq(55, L) * s) + np.sin(2 * math.pi * loop_freq(55.5, L) * s)
    drone = drone * 0.35 + 0.5 * lowpass(noise(L), 90, 2, circular=True)
    hiss = highpass(noise(L), 3000, 1, circular=True) * 0.035
    whine = 0.012 * np.sin(2 * math.pi * loop_freq(11000, L) * s)
    x = drone + hiss + whine
    tick = bandpass(noise(0.03), 1500, 5000) * decay(0.03, 160)
    x = place(x, tick * 0.4, 6.3, circular=True)
    return reverb(x, 2.4, 0.35, 1800, circular=True)


@sound("fan", loop=True)
def fan():
    """The desk fan: motor hum, blade whoosh at the blade-pass rate, a faint rattle."""
    L = 4.0
    s = t(L)
    rev = loop_freq(6.0, L)
    blade = 3 * rev
    motor = 0.25 * np.sin(2 * math.pi * loop_freq(100, L) * s) + 0.1 * np.sin(2 * math.pi * loop_freq(200, L) * s)
    whoosh = bandpass(noise(L), 300, 2200, 1, circular=True)
    whoosh *= 0.55 + 0.45 * np.sin(2 * math.pi * blade * s) ** 2
    rattle = bandpass(noise(L), 2500, 6000, 1, circular=True) * (np.sin(2 * math.pi * rev * s) > 0.96) * 0.25
    return motor + whoosh * 0.5 + rattle


@sound("light_buzz", loop=True)
def light_buzz():
    """A hall light that's on: loud 120 Hz buzz with crackle."""
    L = 2.0
    s = t(L)
    b = np.tanh(4 * np.sin(2 * math.pi * loop_freq(120, L) * s))
    b = lowpass(b, 2500, 2, circular=True) + 0.25 * highpass(noise(L), 4000, 1, circular=True) * (rng.random(len(s)) < 0.02)
    return b * (0.9 + 0.1 * np.sin(2 * math.pi * loop_freq(3, L) * s))


# ================================================================= office actions

def metal_ring(seconds, partials, rate):
    s = t(seconds)
    return sum(a * np.sin(2 * math.pi * f * s + rng.random() * 6) * np.exp(-s * rate * (1 + f / 2000))
               for f, a in partials)


def impact(seconds=1.6, low=55, ring=1.0, bright=3000):
    s = t(seconds)
    thud = np.sin(phase_of(low * (1 + 1.5 * np.exp(-s * 30)))) * np.exp(-s * 9)
    crack = lowpass(noise(seconds), bright, 1) * np.exp(-s * 40)
    rng_ = metal_ring(seconds, [(173, .5), (389, .45), (641, .4), (1013, .3), (1467, .22), (2213, .15), (3120, .08)], 3.2)
    return thud * 1.2 + crack * 0.8 + rng_ * 0.35 * ring


@sound("door_close")
def door_close():
    """Heavy metal security door slamming down: slats rattle as it drops, then the slam."""
    drop = 0.32
    s = t(drop)
    clicks = (rng.random(len(s)) < (20 + 300 * s / drop) / SR).astype(float)
    rattle = convolve(clicks, bandpass(noise(0.02), 900, 4500) * decay(0.02, 200))[:len(s)]
    rattle *= np.linspace(0.3, 1, len(s))
    slide = bandpass(noise(drop), 400, 2500) * np.linspace(0.1, 0.5, len(s))
    x = mix(rattle * 1.2 + slide * 0.4, place(silence(drop + 1.7), impact(1.7), drop))
    return reverb(x, 0.9, 0.22, 2500, early=0.5)


@sound("door_open")
def door_open():
    """The door sliding back up: motor whine rising, slat rattle, a clunk at the top."""
    up = 0.75
    s = t(up)
    motor = saw(140 + 120 * s / up, up) * 0.15
    motor = lowpass(motor, 1200)
    clicks = (rng.random(len(s)) < 140 / SR).astype(float)
    rattle = convolve(clicks, bandpass(noise(0.02), 800, 4000) * decay(0.02, 220))[:len(s)]
    x = (motor + rattle * 0.9) * env_adsr(len(s), 0.05, 0.1, 0.9, 0.08)
    clunk = impact(0.6, 80, 0.4, 1800) * 0.6
    return reverb(mix(x, place(silence(up + 0.6), clunk, up - 0.03)), 0.8, 0.2, 2500)


def click(seconds=0.05, ping=2600):
    s = t(seconds)
    return highpass(noise(seconds), 1500) * np.exp(-s * 300) + 0.3 * np.sin(2 * math.pi * ping * s) * np.exp(-s * 60)


@sound("light_on")
def light_on():
    """Hall light switch: a relay click, then the tube stutters into a buzz."""
    x = silence(0.55)
    place(x, click(0.06), 0.0)
    for at, n in ((0.05, 0.05), (0.14, 0.04), (0.22, 0.33)):
        place(x, light_buzz()[: int(n * SR)] * 0.5, at)
    return fade(x, 0.0, 0.08)


@sound("light_off")
def light_off():
    return mix(click(0.06, 2100), silence(0.12))


@sound("denied")
def denied():
    """Pressing a jammed door or light: a dead low buzz."""
    s = t(0.28)
    return lowpass(square(92, 0.28) * 0.5 + square(96, 0.28) * 0.3, 1200) * env_adsr(len(s), 0.005, 0.05, 0.8, 0.05)


def swipe(seconds, f0, f1):
    x = noise(seconds)
    return stft_filter(x, lambda tc, f: np.exp(-((f - (f0 + (f1 - f0) * min(1, max(0, tc / seconds)))) / 700) ** 2)) \
        * env_adsr(len(x), seconds * 0.3, seconds * 0.2, 0.7, seconds * 0.4)


@sound("tablet_up")
def tablet_up():
    """Tablet flips up: plastic swipe, a click, the screen powering on with a soft thump."""
    x = mix(swipe(0.28, 700, 2600) * 0.6, place(silence(0.5), click(0.05, 1800) * 0.7, 0.25))
    s = t(0.25)
    thump = np.sin(2 * math.pi * 70 * s) * np.exp(-s * 25) * 0.6
    return mix(x, place(silence(0.6), thump + highpass(noise(0.25), 6000) * np.exp(-s * 18) * 0.15, 0.3))


@sound("tablet_down")
def tablet_down():
    return mix(click(0.05, 1500) * 0.6, place(silence(0.4), swipe(0.25, 2400, 600) * 0.6, 0.04))


@sound("cam_switch")
def cam_switch():
    """A short static burst when the camera changes."""
    x = noise(0.26)
    x = np.round(x * 4) / 4  # a little bit-crush grit
    x = bandpass(x, 300, 7000, 1)
    return fade(x * env_adsr(len(x), 0.002, 0.04, 0.6, 0.12), 0.0, 0.02)


@sound("cam_garble")
def cam_garble():
    """Static garble when something moves on the camera you're watching."""
    L = 0.7
    s = t(L)
    x = noise(L) * (0.5 + 0.5 * np.sign(np.sin(2 * math.pi * 23 * s)))
    x = bandpass(x, 400, 5000, 1) + 0.3 * np.sin(phase_of(900 + 600 * np.sin(2 * math.pi * 7 * s)))
    return x * env_adsr(len(s), 0.01, 0.1, 0.7, 0.3)


# ================================================================= bots

def hallway(x, wet=0.55):
    return reverb(x, 1.8, wet, 2200, early=0.6)


@sound("steps_1")
def steps_1():
    """Sneakers on tile, slow."""
    return takes.hallway(takes.walk("steps_sneakers_slow", 3, 0.42))


@sound("steps_2")
def steps_2():
    """Sneakers on tile, quicker."""
    return takes.hallway(takes.walk("steps_sneakers_fast", 4, 0.36))


@sound("steps_heavy")
def steps_heavy():
    """Uncle Scogg: slower, heavier boots that drag a little."""
    return takes.hallway(takes.walk("steps_boots_tile", 3, 0.6, 0.9, drag="steps_dragging_boots"))


def scrape(seconds):
    """A cardboard standee dragged across the floor: grainy rasp, a creak, then the board taps down."""
    x = noise(seconds)
    grain = lowpass(np.abs(noise(seconds)), 30) * 3
    rasp = resonate(x, [(700, 300, 1), (1700, 600, 0.6), (3200, 900, 0.3)]) * grain
    rasp *= env_adsr(len(x), 0.08, 0.1, 0.8, 0.2)
    s = t(seconds)
    creak = 0.12 * saw(180 + 60 * np.sin(2 * math.pi * 1.3 * s), seconds) * np.exp(-((s - seconds * 0.5) / 0.12) ** 2)
    tap = lowpass(noise(0.08), 900) * decay(0.08, 50)
    return hallway(mix(rasp + lowpass(creak, 1500), place(silence(seconds + 0.2), tap * 1.5, seconds)), 0.45)


@sound("scrape_1")
def scrape_1():
    return scrape(0.8)


@sound("scrape_2")
def scrape_2():
    return scrape(1.1)


@sound("gallop", loop=True)
def gallop():
    """Scoggis Khan charging down the hall: hoofbeats on tile in a three-beat gallop."""
    L = 1.8  # four gallop strides
    stride = L / 4
    x = silence(L)
    for k in range(4):
        for off, g in ((0.0, 0.6), (0.09, 0.75), (0.2, 1.0)):
            s = t(0.15)
            clack = bandpass(noise(0.15), 1200, 4500) * np.exp(-s * 90)
            thud = np.sin(2 * math.pi * 95 * s) * np.exp(-s * 35)
            place(x, (clack * 0.8 + thud) * g * rng.uniform(0.85, 1), k * stride + off, circular=True)
    return reverb(x, 1.2, 0.35, 2500, circular=True)


@sound("door_bang")
def door_bang():
    """Banging on the shut metal door."""
    x = silence(2.6)
    for at, g in ((0.0, 1.0), (0.32, 0.8), (0.58, 1.0), (1.25, 0.7), (1.5, 1.0)):
        place(x, impact(1.0, 70, 0.8, 2200) * g, at)
    return reverb(x, 0.8, 0.2, 2500)


@sound("scuttle")
def scuttle():
    """The Scoggipede skittering: dozens of little cardboard taps."""
    L = 1.6
    x = silence(L)
    for _ in range(70):
        tp = bandpass(noise(0.02), 1500, 6000) * decay(0.02, 300)
        place(x, tp * rng.uniform(0.3, 1), rng.uniform(0, L - 0.03))
    return reverb(x * env_adsr(int(L * SR), 0.2, 0.2, 0.9, 0.3), 0.6, 0.2, 4000)


# ================================================================= power out

@sound("power_down")
def power_down():
    """Everything powers down: the breaker clunks, a descending whine, the fan spins down."""
    L = 3.2
    s = t(L)
    f = 40 + 900 * np.exp(-s * 1.4)
    whine = (np.sin(phase_of(f)) + 0.4 * np.sin(phase_of(2 * f)) + 0.2 * np.sin(phase_of(3.01 * f)))
    whine *= np.exp(-s * 0.9) * np.minimum(1, s / 0.02)
    rate = 18 * np.exp(-s * 1.2)
    fanx = bandpass(noise(L), 300, 1800, 1) * (0.5 + 0.5 * np.sin(phase_of(rate)) ** 2) * np.exp(-s * 1.1) * 0.5
    clunk = impact(1.0, 60, 0.3, 1500)
    return reverb(mix(clunk * 0.9, whine * 0.5 + fanx), 1.2, 0.25, 2000)


# The trio of "The Stars and Stripes Forever" (A-flat major, cut time), upper staff, bars 39-70 of
# the Mutopia edition in LilyPond relative-pitch notation.
TRIO = r"""
ef2 df4( c) | c2 b4( c) | c1~ | c2 b4^>( c) | c2 b4^>( c) | ef2 c4.^>( ef8) | df1^( | bf2) bf |
bf a4^>_( bf) | bf2 a4^>_( bf) | df1~ | df2 c4( bf) | c ef2.^^ | <f df af> f4^( | bf,1)~ | bf2 ef |
ef df4( c) | c2 b4( c) | c1~ | c2 b4^>( c) | c2 b4( c) | df4^( c bf4. g'8) | bf,1^( | af2) af |
af g4^> af | cf2^( bf4 af) | <af af'>1~ | <af af'>4 af^( bf c | ef8) r af,4^( bf c | ef8) r ef,4^( f c' |
bf1)^( | af4) r r2 |
"""
STEPS = {"c": 0, "d": 1, "e": 2, "f": 3, "g": 4, "a": 5, "b": 6}
SEMIS = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}


def parse_relative(src: str, start_midi: int = 75):
    """Tiny LilyPond \\relative parser: returns [(midi or None, beats)] with ties merged.
    Chords keep their first note (the melody line). One beat = a quarter note."""
    import re
    tokens = re.findall(r"<[^>]+>[\d.]*~?|[a-gr](?:is|es|s|f)*[',]*\d*\.?~?", src)
    prev_step, prev_oct = 2, start_midi // 12 - 1  # previous note: E-flat 5 (step e)
    prev_midi = start_midi
    dur = 1.0
    out = []
    tie = False
    for tok in tokens:
        if tok.startswith("<"):
            inner, rest = tok[1:tok.index(">")], tok[tok.index(">") + 1:]
            tok = inner.split()[0] + rest
        m = re.match(r"([a-gr])((?:is|es|s|f)*)([',]*)(\d*)(\.?)(~?)", tok)
        name, acc, octs, num, dot, tilde = m.groups()
        if num:
            dur = 4.0 / int(num) * (1.5 if dot else 1.0)
        if name == "r":
            out.append([None, dur])
            tie = False
            continue
        step = STEPS[name]
        # Closest octave to the previous note (by note-name steps, within a fourth).
        best = None
        for o in (prev_oct - 1, prev_oct, prev_oct + 1):
            d = (o * 7 + step) - (prev_oct * 7 + prev_step)
            if abs(d) <= 3 and best is None:
                best = o
        octave = best if best is not None else prev_oct
        octave += octs.count("'") - octs.count(",")
        semis = SEMIS[name] + (acc.count("is") - acc.count("es") - acc.count("f") - (acc == "s"))
        midi = (octave + 1) * 12 + semis
        if tie and out and out[-1][0] == midi:
            out[-1][1] += dur
        else:
            out.append([midi, dur])
        tie = bool(tilde)
        prev_step, prev_oct, prev_midi = step, octave, midi
    return out


CHORDS = {  # A-flat major harmony a music box would play under the tune
    "Ab": (56, [56, 60, 63]), "Db": (49, [53, 56, 61]), "Eb7": (51, [55, 58, 61]),
    "Bbm": (58, [53, 58, 61]), "F7": (53, [57, 60, 63]), "Fm": (53, [56, 60, 65]),
}


def chord_for(notes):
    pcs = {"Ab": {8, 0, 3}, "Db": {1, 5, 8}, "Eb7": {3, 7, 10, 1}, "Bbm": {10, 1, 5}, "F7": {5, 9, 0, 3}, "Fm": {5, 8, 0}}
    score = {k: sum(d for m, d in notes if m is not None and m % 12 in v) for k, v in pcs.items()}
    return max(score, key=lambda k: (score[k], k == "Ab"))


def tine(f, seconds=1.6, bright=1.0, detune_cents=0.0):
    """A music-box tine: a bell-like tone with a quick metallic shimmer and a pluck."""
    f = f * 2 ** (detune_cents / 1200)
    s = t(seconds)
    x = np.sin(2 * math.pi * f * s) * np.exp(-s * 2.6)
    x += 0.28 * bright * np.sin(2 * math.pi * 3.0 * f * s) * np.exp(-s * 9)
    x += 0.10 * bright * np.sin(2 * math.pi * 5.93 * f * s) * np.exp(-s * 22)
    pl = highpass(noise(0.008), 2500) * decay(0.008, 500) * 0.25
    x[: len(pl)] += pl
    return x


def music_box(melody, bar_s, beats_per_bar=4, transpose=0, accompany=True, minor=False, detune=8.0):
    beat_s = bar_s / beats_per_bar
    total_beats = sum(d for _, d in melody)
    out = silence(total_beats * beat_s + 3)
    cents = {m: rng.uniform(-detune, detune) for m in range(30, 110)}

    def flat(m):  # major -> natural minor (3rd, 6th, 7th down)
        return m - 1 if minor and (m % 12) in (0, 5, 7) else m

    pos = 0.0
    bars: list[list] = []
    for m, d in melody:
        bar = int(pos // beats_per_bar + 1e-6)
        while len(bars) <= bar:
            bars.append([])
        bars[bar].append((m, d))
        if m is not None:
            mm = flat(m) + transpose
            place(out, tine(midi_hz(mm), 1.8, 1.0, cents[mm]) * 0.8, pos * beat_s)
        pos += d
    if accompany:
        for b, notes in enumerate(bars):
            root, triad = CHORDS[chord_for(notes)]
            t0 = b * bar_s
            for k, (beat, kind) in enumerate(((0, "root"), (1, "chord"), (2, "fifth"), (3, "chord"))):
                if kind == "chord":
                    for n in triad:
                        nn = flat(n) + transpose
                        place(out, tine(midi_hz(nn), 0.9, 0.6, cents[nn]) * 0.16, t0 + beat * beat_s)
                else:
                    n = flat(root - 12 + (7 if kind == "fifth" else 0)) + transpose
                    place(out, tine(midi_hz(n), 1.5, 0.5, cents[n]) * 0.38, t0 + beat * beat_s)
    return out, total_beats * beat_s


@sound("march", quality=4, loop=True)
def march():
    """Power out: the trio of The Stars and Stripes Forever on a slightly out-of-tune music box.
    The game slows and detunes it (pitch_scale) in the seconds before Uncle Scogg attacks."""
    melody = parse_relative(TRIO)
    x, length = music_box(melody, bar_s=2.0)
    # Fold the ringing tail back into the start so the loop is seamless, add a faint mechanism.
    n = int(length * SR)
    loop = x[:n].copy()
    loop[: len(x) - n] += x[n:]
    s = np.arange(n) / SR
    mech = bandpass(noise(n / SR), 2000, 6000, 1, circular=True) * (np.sin(2 * math.pi * loop_freq(8, n / SR) * s) > 0.97) * 0.05
    return reverb(loop + mech, 1.0, 0.25, 4000, circular=True)


@sound("menu", quality=3, loop=True)
def menu():
    """Title loop: a low beating drone, wind, and the trio's opening crawled out on a music box
    in a minor key."""
    melody = parse_relative(TRIO)[:12]
    box, length = music_box(melody, bar_s=4.0, accompany=False, minor=True, transpose=-12, detune=14.0)
    L = 32.0
    n = int(L * SR)
    s = np.arange(n) / SR
    out = np.zeros(n)
    place(out, box * 0.5, 1.0, circular=True)
    drone = sum(a * np.sin(2 * math.pi * loop_freq(f, L) * s) for f, a in ((51.9, .5), (52.2, .5), (77.8, .25), (103.8, .12)))
    wind = bandpass(rng.standard_normal(n), 200, 1200, 1, circular=True)
    wind *= 0.5 + 0.5 * np.sin(2 * math.pi * loop_freq(1 / 8, L) * s) ** 2
    out += drone * 0.35 + wind * 0.12
    return reverb(out, 3.0, 0.4, 2500, circular=True)


# ================================================================= scares

def creak(seconds, f0=55, f1=95, tone=(720, 1500, 2600)):
    """A dry hinge: stick-slip ticks at a wandering rate, rung through the hinge and frame resonances."""
    s = t(seconds)
    rate = f0 + (f1 - f0) * s / seconds + 12 * np.sin(2 * math.pi * 2.3 * s)
    ph = np.cumsum(rate * (1 + 0.15 * rng.standard_normal(len(s)))) / SR
    ticks = (np.diff(np.floor(ph), prepend=0) > 0) * rng.uniform(0.5, 1.0, len(s))
    x = resonate(ticks, [(tone[0], 60, 1.0), (tone[1], 90, 0.7), (tone[2], 140, 0.4)])
    return norm(x, 1.0) * env_adsr(len(s), 0.06, 0.1, 0.8, 0.12)


# Each scare is one man's voice, picked to fit the figure the standee is dressed as (every standee wears the
# teacher's face; the voices are strangers, never his): (recording, from s, to s, pitch, starts at s, level dB).
# takes.scream lands it on a thud, drives it a little hot and cuts it off fast. Same as game 2.


def scare(x, keep=1.75):
    """Ends a scream's room tail at `keep` seconds (the scare is over at 1.2 s). The screams are game 2's; only the
    tail is shorter, which keeps the site's size projection inside its budget."""
    x = x[: int(keep * SR)].copy()
    n = int(0.2 * SR)
    x[-n:] *= np.linspace(1, 0, n) ** 2
    return x

@sound("scream_scoggcrates")
def scream_scoggcrates():
    """Scoggcrates (the old philosopher): one hoarse roar, pitched well down and blown out, so it hits as a screech
    rather than a man screaming. A single voice: two layered voices sounded like two people (silly)."""
    return scare(takes.scream([("war_cry_gruff", 2.77, 4.35, 0.85, 0.0, 0)], length=1.3, grit=4.0))


@sound("scream_scogga_lisa")
def scream_scogga_lisa():
    """Scogga Lisa (his face in the painting): a man's high, cracking falsetto, and the frame creaking."""
    frame = creak(0.55, 60, 140, tone=(900, 1900, 3200))
    return scare(takes.scream([("man_scream_high", 0.39, 1.84, 1.0, 0.0, 0),
                         ("man_scream_pain", 0.66, 1.51, 1.0, 0.1, -5),
                         (frame, 0, 0, 1.0, 0.05, -13)], length=1.35, grit=2.2))


@sound("scream_scoggis_khan")
def scream_scoggis_khan():
    """Scoggis Khan (the conqueror): a battle war cry, a second rider behind it and a horse rearing underneath."""
    return scare(takes.scream([("war_cry_battle", 5.71, 7.16, 1.0, 0.0, 0),
                         ("war_cry_elf", 0.58, 1.53, 0.95, 0.15, -6),
                         ("horse_whinnies", 7.04, 7.66, 1.0, 0.65, -10)], length=1.35, grit=2.6))


@sound("scream_uncle_scogg")
def scream_uncle_scogg():
    """Uncle Scogg (the poster): a deep, commanding bellow, and his march grinding to a halt under it."""
    tune = march()[int(8.0 * SR):int(9.5 * SR)]
    return scare(takes.scream([("kingly_yell", 1.54, 3.0, 0.92, 0.0, 0),
                         ("war_cry_gruff", 0.70, 2.15, 0.95, 0.05, -6),
                         (takes.tape_stop(tune, 0.8), 0, 0, 1.0, 0.0, -7)], length=1.45, grit=2.8))


@sound("sting_scoggema")
def sting_scoggema():
    """Absolute Scoggema: the funny one. A slide whistle zips up, then a clown-horn honk-honk."""
    L = 0.55
    s = t(L)
    f = 500 + 1300 * (s / L) ** 1.5
    whistle = (np.sin(phase_of(f * (1 + 0.02 * np.sin(2 * math.pi * 7 * s)))) + 0.05 * noise(L)) * env_adsr(len(s), 0.03, 0.1, 0.9, 0.08)
    def honk():
        h = t(0.22)
        x = lowpass(square(370, 0.22) + 0.7 * square(440, 0.22), 2500)
        return resonate(x, [(900, 200, 1), (2000, 400, .5)], floor=0.2) * env_adsr(len(h), 0.01, 0.05, 0.8, 0.06)
    out = silence(1.25)
    place(out, whistle * 0.5, 0.0)
    place(out, honk(), 0.62)
    place(out, honk(), 0.92)
    return out


@sound("whisper")
def whisper():
    """Hallucination flash: a breathy whisper-like burst (filtered noise, no voice), swelling in
    reverse."""
    L = 0.7
    x = noise(L)
    form = [(2500, 900), (4800, 1200), (700, 250)]
    y = stft_filter(x, lambda tc, f: sum(np.exp(-((f - c * (1 + 0.25 * math.sin(tc * 31 + i))) / bw) ** 2)
                                         for i, (c, bw) in enumerate(form)))
    y *= np.linspace(0, 1, len(y)) ** 2  # swells up, then cuts
    y = mix(y, y[::-1] * 0.3)
    return reverb(y, 1.4, 0.45, 4000)


@sound("glitch")
def glitch():
    """A camera glitch frame: a digital chirp and a crackle."""
    s = t(0.14)
    chirp = square(1800 - 1200 * s / 0.14, 0.14) * 0.3
    crack = np.round(noise(0.14) * 2) / 2
    return lowpass(chirp + bandpass(crack, 500, 6000, 1) * 0.6, 6000) * env_adsr(len(s), 0.002, 0.02, 0.7, 0.05)


# ================================================================= 6 AM and the phone

def bell(f, seconds):
    """A big clock bell: hum, prime, tierce, quint and nominal partials."""
    s = t(seconds)
    parts = [(0.5, .6, 0.6), (1.0, 1.0, 1.0), (1.19, .5, 1.4), (1.5, .35, 1.8), (2.0, .4, 2.4), (2.52, .2, 3.4), (3.0, .15, 4), (4.2, .08, 6)]
    x = sum(a * np.sin(2 * math.pi * f * r * s + rng.random() * 6) * np.exp(-s * d) for r, a, d in parts)
    strike = bandpass(noise(0.02), 1500, 6000) * decay(0.02, 200)
    x[: len(strike)] += strike * 0.5
    return x


def cheer(seconds=3.2, voices=26):
    """A small crowd going "yaaay": many buzzy sources through an open-vowel filter, each with
    its own pitch, swell and start (indistinct crowd noise, not anyone's voice), plus claps."""
    out = silence(seconds)
    for _ in range(voices):
        L = rng.uniform(1.4, 2.4)
        s = t(L)
        f0 = rng.uniform(200, 420)
        f = f0 * (1 + 0.35 * np.sin(math.pi * np.minimum(s / 0.5, 1)) - 0.2 * s / L) * (1 + 0.04 * np.sin(2 * math.pi * 5.5 * s))
        src = saw(f) * 0.6 + 0.4 * noise(L)
        v = resonate(src, [(750, 120, 1), (1250, 160, .6), (2600, 300, .25)], floor=0.02)
        v *= env_adsr(len(s), 0.15, 0.4, 0.6, 0.6)
        place(out, v * rng.uniform(0.5, 1), rng.uniform(0, 0.5))
    for _ in range(60):
        c = bandpass(noise(0.03), 800, 5000) * decay(0.03, 120)
        place(out, c * rng.uniform(0.4, 1.2), rng.uniform(0.3, seconds - 0.2))
    return out


@sound("chime_6am", quality=4)
def chime_6am():
    """6 AM: three strokes of a school clock bell, then a little cheer."""
    out = silence(8.0)
    for k in range(3):
        place(out, bell(midi_hz(55), 4.5), k * 1.1)
    place(out, cheer() * 0.22, 3.6)
    return reverb(out, 2.2, 0.3, 3500)


@sound("phone_ring")
def phone_ring():
    """An old desk phone: two electromechanical rings (a clapper hammering two bells at 20 Hz)."""
    out = silence(4.6)
    for start in (0.0, 2.6):
        L = 1.6
        s = t(L)
        gate = (np.sin(2 * math.pi * 20 * s) > 0).astype(float)
        hits = np.diff(np.concatenate([[0], gate])) > 0
        b = convolve(hits.astype(float), bell(1050, 0.3) * 0.5 + bell(1320, 0.3) * 0.4)[:len(s)]
        place(out, b * env_adsr(len(s), 0.01, 0.1, 1.0, 0.1), start)
    return reverb(out, 0.5, 0.15, 4000)


def phone_band(x):
    return bandpass(x, 350, 3200, 2)


@sound("phone_pickup")
def phone_pickup():
    """The receiver lifts: a clunk and a hiss of open line."""
    s = t(0.5)
    clunk = lowpass(noise(0.5), 1200) * np.exp(-s * 40) + np.sin(2 * math.pi * 160 * s) * np.exp(-s * 30) * 0.5
    return clunk + phone_band(noise(0.5)) * 0.05 * np.minimum(1, s / 0.1)


@sound("phone_line", loop=True)
def phone_line():
    """A muffled phone line: band-limited hiss, crackle, and a muffled, unintelligible murmur
    under it (a buzzing source with syllable-shaped bumps; no words, no voice)."""
    L = 6.0
    s = t(L)
    hiss = phone_band(rng.standard_normal(len(s))) * 0.05
    crackle = (rng.random(len(s)) < 6 / SR) * rng.uniform(-1, 1, len(s))
    crackle = convolve(crackle, highpass(noise(0.004), 2000))[:len(s)] * 0.3
    # Murmur: pitch wanders 105-150 Hz, syllables ~4 per second with pauses.
    pitch = 125 + 18 * np.sin(2 * math.pi * loop_freq(0.5, L) * s) + 8 * np.sin(2 * math.pi * loop_freq(1.3, L) * s)
    src = saw(pitch) + 0.3 * rng.standard_normal(len(s))
    syl = np.zeros_like(s)
    tt = 0.2
    while tt < L - 0.3:
        dur = rng.uniform(0.12, 0.3)
        syl += np.exp(-((s - tt - dur / 2) / (dur / 2.5)) ** 2) * rng.uniform(0.5, 1)
        tt += dur + (rng.uniform(0.4, 0.8) if rng.random() < 0.18 else rng.uniform(0.03, 0.09))
    vowel = stft_filter(src * syl, lambda tc, f: 0.1 + np.exp(-((f - (500 + 250 * math.sin(tc * 9))) / 180) ** 2)
                        + 0.6 * np.exp(-((f - (1300 + 400 * math.sin(tc * 6 + 1))) / 260) ** 2))
    murmur = lowpass(vowel, 900, 2) * 0.6  # muffled
    x = phone_band(murmur) + hiss + crackle
    # Make the loop seamless with a short crossfade.
    k = int(0.2 * SR)
    x[:k] = x[:k] * np.linspace(0, 1, k) + x[-k:] * np.linspace(1, 0, k)
    return x[: len(x) - k]


@sound("phone_hangup")
def phone_hangup():
    """The call ends: a click, then a few beeps of the busy tone."""
    out = mix(click(0.08, 900), silence(1.6))
    for k in range(3):
        s = t(0.25)
        tone = (np.sin(2 * math.pi * 480 * s) + np.sin(2 * math.pi * 620 * s)) * 0.25
        place(out, phone_band(tone), 0.25 + k * 0.45)
    return out


@sound("ui_click")
def ui_click():
    return click(0.04, 1800) * 0.7


# ================================================================= output

PEAK = 0.89  # -1 dB: the most a shipped file may reach after Vorbis decoding


def decoded(path: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def encode(name: str, x: np.ndarray, quality: float) -> Path:
    """Writes the Vorbis file. Lossy coding overshoots on dense sounds, so it re-encodes quieter until the
    decoded file peaks at -1 dB or under."""
    path = OUT / f"{name}.ogg"
    level = PEAK
    for _ in range(8):
        with tempfile.TemporaryDirectory() as d:
            wav = Path(d) / f"{name}.wav"
            write_wav(wav, x, level)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "libvorbis",
                            "-q:a", str(quality), str(path)], check=True)
        peak = float(np.abs(decoded(path)).max())
        if peak <= PEAK:
            break
        level *= PEAK / peak * 0.98
    # no tags in the shipped files (ffmpeg writes its name and version into the comment header)
    path.write_bytes(strip_ogg(path.read_bytes()))
    return path


def main() -> int:
    only = set(sys.argv[1:])
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for name, (fn, quality, loop) in SOUNDS.items():
        if only and name not in only:
            continue
        x = fn()
        if not loop:
            x = fade(x, 0.0, 0.03)
        p = encode(name, x, quality)
        total += p.stat().st_size
        print(f"{p.relative_to(ROOT)}  {len(x) / SR:5.1f} s  {p.stat().st_size / 1024:6.0f} KB{'  loop' if loop else ''}")
    print(f"total {total / 1e6:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
