// The sound player. Browsers only let a page make sound after a key press or a click, so the
// first one starts the audio; every sound is then synthesized once (src/audio/recipes.js) and
// played from memory. Two buses, effects and music, under one master volume from the settings.
// Sounds asked for before that (or in tests) are only logged.
import { RECIPES, renderSound, renderTune } from "./recipes.js";
import { busGain } from "../logic/audio.js";
import { SOUND, WORLD_W } from "../logic/config.js";
import { prefs } from "../prefs.js";

let ctx = null;
const buffers = {};
const bus = {};
const last = {};
let tune = null, tuneNode = null, wantMusic = false;
const played = [];

function apply(s = prefs.all()) {
  if (!ctx) return;
  for (const name of ["sfx", "music"]) bus[name].gain.setTargetAtTime(busGain(s, name), ctx.currentTime, 0.05);
}

async function start() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume().catch(() => {}); return; }
  try { ctx = new AudioContext(); } catch { return; }
  for (const name of ["sfx", "music"]) { bus[name] = ctx.createGain(); bus[name].gain.value = 0; bus[name].connect(ctx.destination); }
  apply();
  prefs.watch(apply);
  try {
    for (const name of Object.keys(RECIPES)) buffers[name] = await renderSound(name);
    tune = await renderTune();
    if (wantMusic) audio.music(true);
  } catch (e) { console.warn("sound off:", e?.message); }
}

export const audio = {
  /** Start listening for the first key press or click. */
  listen() {
    const go = () => start();
    for (const ev of ["keydown", "pointerdown", "touchstart"]) addEventListener(ev, go, { capture: true, passive: true });
  },
  /**
   * Play a sound. rate: playback speed (the Buck chime's pitch), x: where in the world it happens
   * (panned a little left or right).
   */
  play(name, { rate = 1, x = null } = {}) {
    played.push(name);
    if (played.length > 200) played.shift();
    const buf = buffers[name];
    if (!ctx || !buf || ctx.state !== "running") return;
    const now = ctx.currentTime;
    if (now - (last[name] ?? -1) < SOUND.minGap) return;
    last[name] = now;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    let node = src;
    if (x !== null && ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-0.6, Math.min(0.6, (x / WORLD_W) * 2 - 1)) * 0.6;
      src.connect(pan); node = pan;
    }
    node.connect(bus.sfx);
    src.start();
  },
  /** The tune on (fading in) or off (fading out). */
  music(on) {
    wantMusic = on;
    if (!ctx || !tune) return;
    const now = ctx.currentTime;
    if (on && !tuneNode) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(1, now + 3);
      const src = ctx.createBufferSource();
      src.buffer = tune; src.loop = true;
      src.connect(g).connect(bus.music);
      src.start();
      tuneNode = { src, g };
    } else if (!on && tuneNode) {
      const { src, g } = tuneNode;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + 1.2);
      src.stop(now + 1.3);
      tuneNode = null;
    }
  },
  /** For tests: what was asked for, and whether sound is running. */
  state: () => ({ played: [...played], running: ctx?.state === "running", ready: Object.keys(buffers).length === Object.keys(RECIPES).length && !!tune, music: !!tuneNode }),
  clear() { played.length = 0; },
};
