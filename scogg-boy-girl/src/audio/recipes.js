// Every sound in the game, synthesized from oscillators, noise and filters (no recordings, no
// samples). Each recipe plays into an OfflineAudioContext once, through a long stone-room
// echo, and the result is kept as a buffer: deep, echoing and low-key. Nothing starts hard and no
// sound peaks above SOUND.maxPeak.
import { createRng } from "../logic/rng.js";
import { hz, TUNE, tuneLength } from "../logic/audio.js";
import { SOUND } from "../logic/config.js";

export const SR = 44100;

// name: [seconds, echo (0..1), peak, recipe(ctx, out, kit)]
export const RECIPES = {
  // Scogg Boy's jump: a warm breath of air rising
  jumpBoy: [0.9, 0.25, 0.22, (ctx, out, k) => {
    k.noise(out, 0, 0.3, { type: "bandpass", f: [320, 900], q: 1.4, a: 0.012, d: 0.16, gain: 0.9 });
    k.tone(out, 0, { f: [110, 170], d: 0.14, gain: 0.5 });
  }],
  // Scogg Girl's jump: a soft rising bloop
  jumpGirl: [0.9, 0.25, 0.22, (ctx, out, k) => {
    k.tone(out, 0, { f: [250, 470], glide: 0.12, d: 0.16, gain: 0.8, lp: 1400 });
    k.noise(out, 0.01, 0.08, { type: "highpass", f: [2400, 2400], a: 0.005, d: 0.05, gain: 0.12 });
  }],
  // landing: a low soft thud
  land: [0.8, 0.2, 0.28, (ctx, out, k) => {
    k.tone(out, 0, { f: [95, 45], glide: 0.12, a: 0.004, d: 0.13, gain: 1 });
    k.noise(out, 0, 0.08, { type: "lowpass", f: [420, 300], a: 0.003, d: 0.04, gain: 0.5 });
  }],
  // the Scogg Buck: a metallic chime (bell partials); played slower as inflation rises
  buck: [3.4, 0.5, 0.34, (ctx, out, k) => {
    const f = 523.25;
    [[1, 1, 1.5], [2.756, 0.45, 0.8], [5.404, 0.22, 0.45], [8.933, 0.1, 0.25]].forEach(([r, g, d]) => k.tone(out, 0, { f: [f * r, f * r], a: 0.004, d, gain: g }));
  }],
  // the Gavel: two soft wooden knocks
  gavel: [1.2, 0.35, 0.34, (ctx, out, k) => {
    for (const [t, g] of [[0, 1], [0.14, 0.65]]) {
      k.tone(out, t, { f: [190, 170], a: 0.003, d: 0.07, gain: g });
      k.noise(out, t, 0.06, { type: "bandpass", f: [950, 900], q: 5, a: 0.002, d: 0.03, gain: 0.9 * g });
    }
  }],
  // a lever: a heavy clunk with a little click after it
  lever: [1.0, 0.35, 0.3, (ctx, out, k) => {
    k.tone(out, 0, { f: [140, 85], glide: 0.1, a: 0.004, d: 0.12, gain: 1 });
    k.noise(out, 0, 0.05, { type: "bandpass", f: [1300, 1100], q: 2, a: 0.002, d: 0.025, gain: 0.6 });
    k.noise(out, 0.09, 0.04, { type: "bandpass", f: [1800, 1600], q: 3, a: 0.002, d: 0.02, gain: 0.35 });
  }],
  // a stone door or gate sliding: a low grinding rumble that swells and settles
  door: [2.2, 0.3, 0.3, (ctx, out, k) => {
    k.noise(out, 0, 1.4, { type: "lowpass", f: [260, 180], a: 0.18, hold: 0.6, d: 0.35, gain: 1, wobble: 11 });
    k.tone(out, 0, { f: [55, 52], a: 0.2, hold: 0.6, d: 0.4, gain: 0.35 });
  }],
  // a pressure plate going down: a soft stone click
  button: [0.7, 0.3, 0.2, (ctx, out, k) => {
    k.tone(out, 0, { f: [310, 210], glide: 0.05, a: 0.003, d: 0.05, gain: 0.8 });
    k.noise(out, 0, 0.03, { type: "highpass", f: [2600, 2600], a: 0.002, d: 0.015, gain: 0.25 });
  }],
  // Scogg Boy goes out: an ember fizzling down, gentle
  ember: [1.8, 0.4, 0.3, (ctx, out, k) => {
    k.noise(out, 0, 0.9, { type: "bandpass", f: [2600, 500], q: 1.2, a: 0.02, d: 0.6, gain: 0.8 });
    k.tone(out, 0.02, { f: [220, 82], glide: 0.6, a: 0.02, d: 0.5, gain: 0.45 });
  }],
  // Scogg Girl splashes apart: a soft splash and a few bubbles
  splash: [1.8, 0.4, 0.3, (ctx, out, k) => {
    k.noise(out, 0, 0.5, { type: "lowpass", f: [3800, 500], a: 0.006, d: 0.3, gain: 0.9 });
    const rng = createRng("splash");
    for (let i = 0; i < 6; i++) { const f = rng.range(380, 820); k.tone(out, 0.08 + i * 0.07 + rng.range(0, 0.03), { f: [f, f * 1.6], glide: 0.05, a: 0.004, d: 0.05, gain: 0.3 }); }
  }],
  // both through their doors: a slow, warm D major chord with a bell on top
  win: [6, 0.55, 0.42, (ctx, out, k) => {
    [50, 57, 62, 66, 69].forEach((m, i) => k.strings(out, i * 0.06, hz(m), { a: 0.35, hold: 0.9, d: 1.6, gain: 0.3, lp: 1500 }));
    k.tone(out, 0.25, { f: [hz(74), hz(74)], a: 0.005, d: 1.4, gain: 0.35 });
    k.tone(out, 0.25, { f: [hz(74) * 2.756, hz(74) * 2.756], a: 0.005, d: 0.5, gain: 0.08 });
  }],
  // menu: a soft tick
  ui: [0.5, 0.25, 0.12, (ctx, out, k) => {
    k.tone(out, 0, { f: [660, 620], glide: 0.03, a: 0.003, d: 0.035, gain: 1 });
  }],
};

/** The building blocks recipes play with. Envelopes are exponential and never start hard. */
function kit(ctx) {
  const rng = createRng("noise");
  const white = ctx.createBuffer(1, SR * 2, SR);
  const data = white.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = rng.range(-1, 1);

  /** Attack, hold, decay on a gain param: a = attack s, hold s at full, d = time constant of the fall. */
  const env = (param, t, { a = 0.005, hold = 0, d = 0.1, gain = 1 }) => {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(gain, t + Math.max(0.002, a));
    param.setValueAtTime(gain, t + a + hold);
    param.setTargetAtTime(0, t + a + hold, d);
    return t + a + hold + d * 7;
  };
  return {
    tone(out, t, o) {
      const osc = ctx.createOscillator();
      osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(o.f[0], t);
      if (o.f[1] !== o.f[0]) osc.frequency.exponentialRampToValueAtTime(o.f[1], t + (o.glide ?? (o.a ?? 0.005) + (o.d ?? 0.1)));
      const g = ctx.createGain();
      let node = osc;
      if (o.lp) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = o.lp; osc.connect(f); node = f; }
      node.connect(g).connect(out);
      const end = env(g.gain, t, o);
      osc.start(t); osc.stop(end);
    },
    noise(out, t, len, o) {
      const src = ctx.createBufferSource();
      src.buffer = white;
      const f = ctx.createBiquadFilter();
      f.type = o.type; f.Q.value = o.q ?? 0.7;
      f.frequency.setValueAtTime(o.f[0], t);
      f.frequency.exponentialRampToValueAtTime(o.f[1], t + len);
      const g = ctx.createGain();
      src.connect(f).connect(g).connect(out);
      if (o.wobble) { // a slow grind: the level shivers a little
        const lfo = ctx.createOscillator(), depth = ctx.createGain();
        lfo.frequency.value = o.wobble; depth.gain.value = 0.25;
        const w = ctx.createGain(); w.gain.value = 0.75;
        g.disconnect(); g.connect(w).connect(out);
        lfo.connect(depth).connect(w.gain);
        lfo.start(t); lfo.stop(t + len + 1);
      }
      const end = env(g.gain, t, o);
      src.start(t, rng.range(0, 1)); src.stop(Math.max(end, t + len));
    },
    /** A bowed string: three detuned saws through a soft low-pass. */
    strings(out, t, f, o) {
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = o.lp || 900; lp.Q.value = 0.4;
      lp.connect(g).connect(out);
      const end = env(g.gain, t, o);
      for (const c of [-7, 0, 6]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth"; osc.frequency.value = f; osc.detune.value = c;
        const v = ctx.createGain(); v.gain.value = 1 / 3;
        osc.connect(v).connect(lp);
        osc.start(t); osc.stop(end);
      }
    },
  };
}

/** A stone room's echo: stereo noise falling away over a few seconds, darker as it fades. */
function roomEcho(ctx, seconds = 2.8) {
  const rng = createRng("room");
  const n = Math.floor(seconds * ctx.sampleRate);
  const ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const x = i / n;
      const k = 0.5 - 0.42 * x;             // the tail loses its highs
      lp += (rng.range(-1, 1) - lp) * k;
      d[i] = lp * Math.exp(-4.2 * x) * (i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1);
    }
  }
  return ir;
}

/** Plays a recipe into a fresh offline context with dry and echo paths; returns the raw buffer. */
async function renderWith(seconds, echo, play) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR);
  const bus = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.buffer = roomEcho(ctx);
  const wet = ctx.createGain(); wet.gain.value = echo;
  bus.connect(ctx.destination);
  bus.connect(conv).connect(wet).connect(ctx.destination);
  play(ctx, bus, kit(ctx));
  return ctx.startRendering();
}

/** Scale a buffer so its loudest sample sits at peak. */
function normalize(buf, peak) {
  let max = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) for (const v of buf.getChannelData(ch)) max = Math.max(max, Math.abs(v));
  const k = max > 0 ? Math.min(peak, SOUND.maxPeak) / max : 1;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] *= k; }
  return buf;
}

/** One sound effect, rendered, with the last bit of its echo faded out so it never clicks off. */
export async function renderSound(name) {
  const [seconds, echo, peak, play] = RECIPES[name];
  const buf = normalize(await renderWith(seconds, echo, play), peak);
  const n = Math.floor(SR * 0.08);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n;
  }
  return buf;
}

/**
 * The tune, one seamless loop: it's played twice in a row and the second pass is kept, so the
 * strings and the echo ringing over from the end flow straight into the start.
 */
export async function renderTune() {
  const L = tuneLength();
  const raw = await renderWith(L * 2, 0.45, (ctx, out, k) => {
    for (let pass = 0; pass < 2; pass++) {
      const t0 = pass * L;
      TUNE.chords.forEach(([root, voicing], i) => {
        const t = t0 + i * TUNE.bar;
        // low strings: swell in, hold, and fade into the next chord
        voicing.forEach((m) => k.strings(out, t, hz(m), { a: 1.6, hold: TUNE.bar - 2.2, d: 0.9, gain: 0.16, lp: 700 }));
        // the soft pulse: a muted low note on the root
        for (const b of TUNE.pulse) k.tone(out, t + b, { f: [hz(root), hz(root)], a: 0.03, d: 0.45, gain: 0.32, lp: 300 });
      });
      for (const [s, m] of TUNE.bells) {
        k.tone(out, t0 + s, { f: [hz(m), hz(m)], a: 0.01, d: 1.3, gain: 0.07 });
        k.tone(out, t0 + s, { f: [hz(m) * 2.756, hz(m) * 2.756], a: 0.01, d: 0.4, gain: 0.015 });
      }
    }
  });
  const out = new AudioBuffer({ numberOfChannels: 2, length: L * SR, sampleRate: SR });
  for (let ch = 0; ch < 2; ch++) out.copyToChannel(raw.getChannelData(ch).subarray(L * SR, 2 * L * SR), ch);
  return normalize(out, 0.36);
}
