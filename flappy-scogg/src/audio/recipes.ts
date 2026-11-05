// Every sound in the game, made in code with Web Audio (oscillators, noise and filters; no
// recordings). Short and quiet on purpose: nothing should startle. Each recipe schedules itself on
// any AudioContext, so the same code plays live and renders offline for the sound test.

export type SoundName = "flap" | "point" | "ten" | "hit";
export const SOUNDS: readonly SoundName[] = ["flap", "point", "ten", "hit"];

type Recipe = (ctx: BaseAudioContext, out: AudioNode, t: number) => void;

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();
function noise(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 7;
    for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
    noiseCache.set(ctx, b);
  }
  return b;
}

function envelope(ctx: BaseAudioContext, out: AudioNode, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(out);
  return g;
}

function tone(ctx: BaseAudioContext, out: AudioNode, t: number, freq: number, peak: number, decay: number, type: OscillatorType = "sine"): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.connect(envelope(ctx, out, t, peak, 0.004, decay));
  o.start(t);
  o.stop(t + decay + 0.05);
}

const RECIPES: Record<SoundName, Recipe> = {
  // a soft whoosh: a breath of filtered noise sweeping up
  flap(ctx, out, t) {
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(1700, t + 0.13);
    src.connect(bp);
    bp.connect(envelope(ctx, out, t, 0.6, 0.02, 0.15));
    src.start(t);
    src.stop(t + 0.22);
  },
  // a small coin chime: two bright notes, a fifth apart
  point(ctx, out, t) {
    tone(ctx, out, t, 1318.5, 0.13, 0.16, "triangle");
    tone(ctx, out, t + 0.055, 1975.5, 0.11, 0.22, "triangle");
    tone(ctx, out, t + 0.055, 3951, 0.012, 0.12);
  },
  // every ten points: a quick rising chime
  ten(ctx, out, t) {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(ctx, out, t + i * 0.065, f, 0.11, 0.2 + i * 0.04, "triangle"));
  },
  // a low, soft thud: a sine that drops in pitch and a little muffled noise
  hit(ctx, out, t) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.22);
    o.connect(envelope(ctx, out, t, 0.26, 0.012, 0.28));
    o.start(t);
    o.stop(t + 0.35);
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    n.connect(lp);
    lp.connect(envelope(ctx, out, t, 0.08, 0.006, 0.09));
    n.start(t);
    n.stop(t + 0.15);
  },
};

export function playRecipe(name: SoundName, ctx: BaseAudioContext, out: AudioNode, t = ctx.currentTime): void {
  RECIPES[name](ctx, out, t);
}

/** Render one sound offline and measure it (the sound test: it must be heard, and never clip). */
export async function measure(name: SoundName, volume = 1): Promise<{ rms: number; peak: number; seconds: number }> {
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil(rate * 0.6), rate);
  const g = ctx.createGain();
  g.gain.value = volume;
  g.connect(ctx.destination);
  playRecipe(name, ctx, g, 0);
  const d = (await ctx.startRendering()).getChannelData(0);
  let sum = 0, peak = 0, last = 0;
  for (let i = 0; i < d.length; i++) {
    const v = Math.abs(d[i]);
    sum += v * v;
    if (v > peak) peak = v;
    if (v > 0.002) last = i;
  }
  const n = last + 1;
  return { rms: Math.sqrt(sum / Math.max(1, n)), peak, seconds: n / rate };
}
