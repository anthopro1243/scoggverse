// Skill simulator: plays many runs with scripted players of different skill and prints how far
// each gets. Used to tune the feel numbers in src/logic/config.ts (see HANDOFF.md).
// Usage: npm run sim [-- runs]
import { createAutopilot, type Skill } from "../src/logic/autopilot.ts";
import { createGame, stepGame } from "../src/logic/game.ts";

const RUNS = Number(process.argv[2] ?? 300);
const CAP = 150; // stop a run here (a 150 counts as "100 or more")
const PLAYERS: Array<[string, Skill]> = [
  ["new player", { delay: 14, aimNoise: 40 }],
  ["casual", { delay: 10, aimNoise: 28 }],
  ["decent", { delay: 7, aimNoise: 20 }],
  ["sharp", { delay: 4, aimNoise: 10 }],
  ["perfect", { delay: 0, aimNoise: 0 }],
];

export function simulate(skill: Skill, runs: number): number[] {
  const scores: number[] = [];
  for (let i = 0; i < runs; i++) {
    const g = createGame({ seed: `sim-${i}` });
    const bot = createAutopilot({ ...skill, seed: `bot-${i}` });
    for (let s = 0; s < 60 * 60 * 5 && g.phase !== "over" && g.score < CAP; s++) stepGame(g, bot(g));
    scores.push(g.score);
  }
  return scores.sort((a, b) => a - b);
}

const pct = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))];
console.log(`${RUNS} runs each\nplayer        p10  median  p90   past 3   20+    100+`);
for (const [name, skill] of PLAYERS) {
  const s = simulate(skill, RUNS);
  const share = (f: (x: number) => boolean) => `${Math.round((100 * s.filter(f).length) / s.length)}%`.padStart(5);
  console.log(`${name.padEnd(12)} ${String(pct(s, 0.1)).padStart(4)} ${String(pct(s, 0.5)).padStart(6)} ${String(pct(s, 0.9)).padStart(5)}   ${share((x) => x > 3)}  ${share((x) => x >= 20)}  ${share((x) => x >= 100)}`);
}
