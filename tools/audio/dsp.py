"""A tiny numpy-only DSP kit for the game's sound synthesis (no scipy on this machine).

Filters work in the frequency domain. A filter on a loop is circular, so a loop stays seamless;
one-shots are zero-padded first so nothing wraps around. Every sound is built from oscillators,
noise and these filters; no recordings.
"""
import math
import wave
from pathlib import Path

import numpy as np

SR = 44100
rng = np.random.default_rng(1896)  # the year Sousa wrote the march


def t(seconds: float) -> np.ndarray:
    return np.arange(int(round(SR * seconds))) / SR


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(round(SR * seconds)))


def noise(seconds: float) -> np.ndarray:
    return rng.standard_normal(int(round(SR * seconds)))


def loop_freq(f: float, length: float) -> float:
    """The nearest frequency with a whole number of cycles in `length` seconds (seamless loops)."""
    return max(1, round(f * length)) / length


# ---------------------------------------------------------------- filters

def spectral(x: np.ndarray, gain, circular: bool = False) -> np.ndarray:
    """Multiplies the spectrum by gain(freqs). Pads one-shots so the filter doesn't wrap."""
    n = len(x)
    pad = 0 if circular else min(n, SR // 2)
    X = np.fft.rfft(np.concatenate([x, np.zeros(pad)]))
    f = np.fft.rfftfreq(n + pad, 1 / SR)
    y = np.fft.irfft(X * gain(f), n + pad)
    return y[:n]


def lowpass(x, fc, order=2, circular=False):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)), circular)


def highpass(x, fc, order=2, circular=False):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)), circular)


def bandpass(x, lo, hi, order=2, circular=False):
    return highpass(lowpass(x, hi, order, circular), lo, order, circular)


def peak(f, fc, bw):
    """Resonance curve (for formants and body resonances)."""
    return 1 / np.sqrt(1 + ((f - fc) / bw) ** 2)


def resonate(x, peaks, circular=False, floor=0.0):
    """Sum of resonances [(freq, bandwidth, gain), ...]."""
    return spectral(x, lambda f: floor + sum(g * peak(f, fc, bw) for fc, bw, g in peaks), circular)


def stft_filter(x: np.ndarray, gain_at, frame: int = 2048, hop: int = 512) -> np.ndarray:
    """Time-varying filter: gain_at(time_s, freqs) -> gains, applied frame by frame (overlap-add)."""
    win = np.hanning(frame)
    n = len(x)
    pad = np.concatenate([np.zeros(frame), x, np.zeros(frame)])
    out = np.zeros_like(pad)
    norm = np.zeros_like(pad)
    f = np.fft.rfftfreq(frame, 1 / SR)
    for start in range(0, len(pad) - frame, hop):
        seg = pad[start:start + frame] * win
        tc = (start + frame / 2 - frame) / SR
        y = np.fft.irfft(np.fft.rfft(seg) * gain_at(tc, f), frame)
        out[start:start + frame] += y * win
        norm[start:start + frame] += win ** 2
    out /= np.maximum(norm, 1e-6)
    return out[frame:frame + n]


# ---------------------------------------------------------------- oscillators

def phase_of(freq) -> np.ndarray:
    """Phase (radians) for a frequency array that changes over time."""
    return 2 * math.pi * np.cumsum(freq) / SR


def sine(freq, seconds=None):
    if np.isscalar(freq):
        return np.sin(2 * math.pi * freq * t(seconds))
    return np.sin(phase_of(freq))


def saw(freq, seconds=None):
    ph = (freq * t(seconds)) if np.isscalar(freq) else np.cumsum(freq) / SR
    return 2 * (ph % 1.0) - 1


def square(freq, seconds=None, duty=0.5):
    ph = (freq * t(seconds)) if np.isscalar(freq) else np.cumsum(freq) / SR
    return np.where(ph % 1.0 < duty, 1.0, -1.0)


# ---------------------------------------------------------------- envelopes and shaping

def env_adsr(n_or_s, a, d, s_level, r, hold=None):
    n = n_or_s if isinstance(n_or_s, int) else int(round(SR * n_or_s))
    tt = np.arange(n) / SR
    total = n / SR
    hold = total - r if hold is None else hold
    e = np.where(tt < a, tt / max(a, 1e-6),
                 np.where(tt < a + d, 1 - (1 - s_level) * (tt - a) / max(d, 1e-6), s_level))
    rel = np.clip((tt - hold) / max(r, 1e-6), 0, 1)
    return e * (1 - rel)


def decay(seconds, rate, attack=0.002):
    tt = t(seconds)
    return np.minimum(1, tt / attack) * np.exp(-tt * rate)


def fade(x, fin=0.005, fout=0.02):
    x = x.copy()
    a, b = int(SR * fin), int(SR * fout)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def drive(x, amount):
    return np.tanh(x * amount) / np.tanh(amount)


def place(out: np.ndarray, x: np.ndarray, at_s: float, gain: float = 1.0, circular=False) -> np.ndarray:
    a = int(round(at_s * SR))
    if circular:
        idx = (a + np.arange(len(x))) % len(out)
        np.add.at(out, idx, x * gain)
        return out
    if a < 0:
        x, a = x[-a:], 0
    b = min(len(out), a + len(x))
    if a < len(out):
        out[a:b] += x[:b - a] * gain
    return out


def mix(*parts) -> np.ndarray:
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[:len(p)] += p
    return out


def norm(x, peak_level=0.9):
    return x / max(1e-9, np.abs(x).max()) * peak_level


# ---------------------------------------------------------------- space

def impulse(seconds: float, damp_hz: float = 3000, early: float = 0.0) -> np.ndarray:
    """A synthetic room: decaying noise that darkens as it decays."""
    tt = t(seconds)
    n = rng.standard_normal(len(tt))
    bright = lowpass(n, damp_hz, 1) * np.exp(-tt * 6.9 / (seconds * 0.4))
    dark = lowpass(rng.standard_normal(len(tt)), damp_hz / 4, 1) * np.exp(-tt * 6.9 / seconds)
    ir = bright + 1.3 * dark
    ir[: int(SR * 0.004)] *= np.linspace(0, 1, int(SR * 0.004))
    if early:
        for k, d in enumerate((0.011, 0.019, 0.027, 0.041)):
            ir[int(d * SR)] += early / (k + 1)
    return ir / np.sqrt(np.sum(ir ** 2))


def convolve(x: np.ndarray, ir: np.ndarray, circular: bool = False) -> np.ndarray:
    if circular:
        n = len(x)
        h = np.zeros(n)
        h[: min(n, len(ir))] = ir[:n]
        return np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(h), n)
    n = len(x) + len(ir) - 1
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)


def reverb(x, seconds=1.2, wet=0.3, damp_hz=3000, circular=False, early=0.0):
    w = convolve(x, impulse(seconds, damp_hz, early), circular)
    dry = np.concatenate([x, np.zeros(len(w) - len(x))])
    return dry * (1 - wet) + w * wet * 3.0


# ---------------------------------------------------------------- output

def write_wav(path: Path, x: np.ndarray, peak_level: float | None = 0.9) -> None:
    if peak_level is not None:
        x = norm(x, peak_level)
    x = np.clip(x, -1, 1)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())
