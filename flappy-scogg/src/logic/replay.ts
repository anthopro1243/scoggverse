// Replays: a seed, a face and the steps a tap landed on, counted from when the game was created
// (the first tap starts the run from the title screen). Played headless in the unit tests and
// step by step in the browser (tests/e2e/replay.spec.ts, scripts/replay-gif.mjs).
import { createGame, stepGame, type Game } from "./game.ts";
import type { FaceId } from "./faces.ts";

export interface Replay {
  seed: string;
  face: FaceId;
  taps: number[]; // step numbers (1-based: the first step is 1)
  steps: number; // how long to play
  expect: { score: number; phase: "playing" | "over"; cause?: string | null };
}

/** Play a replay to the end, headless. onStep sees the game after every step. */
export function playReplay(r: Replay, onStep?: (g: Game) => void): Game {
  const g = createGame({ seed: r.seed, face: r.face });
  const taps = new Set(r.taps);
  for (let s = 1; s <= r.steps; s++) {
    stepGame(g, taps.has(s));
    onStep?.(g);
  }
  return g;
}

/** Runs of [steps, tap-on-first-step] pairs, for stepping a browser build quickly. */
export function replayChunks(r: Replay): Array<[number, boolean]> {
  const out: Array<[number, boolean]> = [];
  let s = 1;
  for (const t of [...r.taps].sort((a, b) => a - b)) {
    if (t > s) out.push([t - s, false]);
    out.push([1, true]);
    s = t + 1;
  }
  if (r.steps >= s) out.push([r.steps - s + 1, false]);
  return out;
}
