// Writes replays/f0.json: the scripted player flies a fixed seed past TARGET columns, then stops
// tapping and drops to the terrace, and the game-over card comes up. The replay test then checks
// that the same taps still give exactly the same run (so the feel numbers didn't drift).
// Usage: npm run author-replay   (only rerun on purpose, after changing the feel numbers)
import { writeFileSync } from "node:fs";
import { createAutopilot } from "../src/logic/autopilot.ts";
import { createGame, stepGame } from "../src/logic/game.ts";
import { playReplay, type Replay } from "../src/logic/replay.ts";

const TARGET = 26;
const AFTER = 150; // steps to keep going after the hit, so the card is up and readable

for (let attempt = 0; attempt < 50; attempt++) {
  const seed = `f0-replay-${attempt}`;
  const g = createGame({ seed, face: "a" });
  const bot = createAutopilot({ delay: 2, aimNoise: 6, seed: "author" });
  const taps: number[] = [];
  let s = 0;
  while (g.phase !== "over" && s < 60 * 120) {
    s++;
    const flap = g.score < TARGET ? bot(g) : false;
    if (flap) taps.push(s);
    stepGame(g, flap);
  }
  if (g.score !== TARGET) continue;
  const replay: Replay = { seed, face: "a", taps, steps: s + AFTER, expect: { score: TARGET, phase: "over", cause: g.cause } };
  const check = playReplay(replay);
  if (check.score !== TARGET || check.phase !== "over") throw new Error("replay doesn't reproduce");
  writeFileSync(new URL("../replays/f0.json", import.meta.url), JSON.stringify(replay, null, 1).replace(/\n\s+(\d+),?/g, (m) => m.replace(/\n\s+/, "")) + "\n");
  console.log(`replays/f0.json: seed ${seed}, ${taps.length} taps, ${replay.steps} steps (${(replay.steps / 60).toFixed(1)} s), score ${TARGET}, ended by the ${g.cause}`);
  process.exit(0);
}
throw new Error(`no seed in 50 got exactly ${TARGET}`);
