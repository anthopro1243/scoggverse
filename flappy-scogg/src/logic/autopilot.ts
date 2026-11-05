// A scripted player, for writing replays and for the skill simulator (scripts/sim.ts). It reacts
// to what the game looked like `delay` steps ago, aims a little below the gap it is heading for,
// and its aim wobbles by up to `aimNoise` units. More delay and more wobble play like a newer player.
import { CAP_OVERHANG, COL_W, DT, FACE_X, FLAP_VY, GRAVITY, MAX_FALL } from "./config.ts";
import type { Game } from "./game.ts";
import type { Column } from "./columns.ts";
import { createRng } from "./rng.ts";

export interface Skill { delay: number; aimNoise: number; seed?: string }

/** Where the face will be after n steps without a flap. */
export function fallAfter(y: number, vy: number, n: number): number {
  for (let i = 0; i < n; i++) { vy = Math.min(MAX_FALL, vy + GRAVITY * DT); y += vy * DT; }
  return y;
}

export function createAutopilot({ delay, aimNoise, seed = "bot" }: Skill) {
  const rng = createRng(seed);
  const seen: Array<{ y: number; vy: number; target: number }> = [];
  let wobble = 0;
  const mine: boolean[] = []; // its own last taps: a player always knows when they tapped
  return (g: Game): boolean => {
    // aim below the center of the first gap not cleared yet; once inside it, already drift
    // toward the following gap as far as this one safely allows
    const half = g.size.w * 0.45;
    const i = g.columns.findIndex((c) => c.x + COL_W + CAP_OVERHANG + half > FACE_X);
    const cur = g.columns[i];
    const aim = (c: Column) => c.gapY + c.gap * 0.18;
    let target = cur ? aim(cur) : 330;
    const nxt = g.columns[i + 1];
    if (cur && nxt && cur.x - CAP_OVERHANG - half < FACE_X) {
      const top = cur.gapY - cur.gap / 2 + 96;
      const bottom = cur.gapY + cur.gap / 2 - 22;
      target = Math.max(top, Math.min(bottom, aim(nxt)));
    }
    if (g.frame % 40 === 0) wobble = (rng.next() * 2 - 1) * aimNoise;
    seen.push({ y: g.body.y, vy: g.body.vy, target: target + wobble });
    if (seen.length > delay + 1) seen.shift();
    if (g.phase !== "playing") return g.phase === "title";
    const view = seen[0];
    // where the face is now, as far as the player can tell: what they saw, plus their own taps since
    let y = view.y;
    let vy = view.vy;
    for (const tapped of seen.length > 1 ? mine.slice(-(seen.length - 1)) : []) {
      if (tapped) vy = FLAP_VY;
      vy = Math.min(MAX_FALL, vy + GRAVITY * DT);
      y += vy * DT;
    }
    // flap if, by the time a flap would land, it will have sunk below the aim point,
    // unless a flap from here would bump the top of the gap it is in or about to enter
    const near = cur && cur.x - CAP_OVERHANG - half - 50 < FACE_X;
    const rise = (FLAP_VY * FLAP_VY) / (2 * GRAVITY);
    let flap = !(near && y - rise - g.size.h * 0.5 < cur.gapY - cur.gap / 2);
    flap &&= vy > -60 && fallAfter(y, vy, 2) > view.target;
    mine.push(flap);
    if (mine.length > 64) mine.shift();
    return flap;
  };
}
