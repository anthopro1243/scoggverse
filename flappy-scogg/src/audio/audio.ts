// Plays the game's sounds. The AudioContext starts on the first tap, click or key (browsers only
// allow sound after one). M or the speaker button mutes; the choice is saved in this browser.
import { playRecipe, type SoundName } from "./recipes.ts";

const KEY = "flappy-scogg-muted";
export const VOLUME = 0.6; // master level: quiet on purpose

export interface Audio {
  muted: boolean;
  unlock(): void;
  play(name: SoundName): void;
  toggle(): boolean;
}

export function createAudio({ enabled = true } = {}): Audio {
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let muted = false;
  try { muted = window.localStorage.getItem(KEY) === "1"; } catch { /* storage blocked: start with sound on */ }
  const a: Audio = {
    get muted() { return muted; },
    set muted(v: boolean) {
      muted = v;
      if (out && ctx) out.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.02);
      try { window.localStorage.setItem(KEY, muted ? "1" : "0"); } catch { /* lasts for the visit */ }
    },
    unlock() {
      if (!enabled) return;
      if (!ctx) {
        try {
          ctx = new AudioContext();
          out = ctx.createGain();
          out.gain.value = muted ? 0 : VOLUME;
          out.connect(ctx.destination);
        } catch { ctx = null; return; }
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    },
    play(name) {
      if (!ctx || !out || muted || ctx.state !== "running") return;
      playRecipe(name, ctx, out);
    },
    toggle() { a.muted = !muted; return muted; },
  };
  return a;
}
