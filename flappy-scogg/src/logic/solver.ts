// Reachability check: searches every tap pattern (both choices on every step, with near-identical
// states merged) to find whether any player could get through a run's first N columns. Used by
// the unit tests to prove the spawner never makes an impossible gap.
import { COL_SPACING, COL_W, FACE_START_Y, FACE_X, FIRST_COL_X, SCROLL, DT } from "./config.ts";
import { hitCircles, hitsCeiling, hitsColumn, hitsFloor } from "./collide.ts";
import { makeColumn, type Column } from "./columns.ts";
import { faceSize, type FaceId } from "./faces.ts";
import { runSeed } from "./game.ts";
import { stepBody, type Body } from "./physics.ts";
import { createRng, hashSeed } from "./rng.ts";

/** The columns a run would get, in order (the same rolls startRun makes). */
export function runColumns(seed: string, run: number, count: number): Column[] {
  const rng = createRng(hashSeed(runSeed(seed, run)));
  const out: Column[] = [];
  for (let i = 0; i < count; i++) out.push(makeColumn(rng, i, FIRST_COL_X + i * COL_SPACING, out[i - 1] ?? null));
  return out;
}

/** True if some sequence of taps passes all of `columns`. Starts with the tap that begins the run. */
export function canPass(columns: Column[], face: FaceId = "a"): boolean {
  const size = faceSize(face);
  const end = Math.ceil((columns[columns.length - 1].x + COL_W - FACE_X + size.w) / (SCROLL * DT));
  let states: Body[] = [{ y: FACE_START_Y, vy: 0, angle: 0 }];
  let peak = 0;
  for (let t = 1; t <= end; t++) {
    const shift = SCROLL * DT * t;
    const near = columns.filter((c) => Math.abs(c.x - shift + COL_W / 2 - FACE_X) < COL_W + size.w);
    const next = new Map<string, Body>();
    for (const s of states) {
      for (const flap of t === 1 ? [true] : [false, true]) {
        const b = { ...s };
        stepBody(b, flap);
        const circles = hitCircles(size, FACE_X, b.y, b.angle);
        if (hitsFloor(circles) || hitsCeiling(circles)) continue;
        if (near.some((c) => hitsColumn(circles, { x: c.x - shift, gapY: c.gapY, gap: c.gap }))) continue;
        const key = `${Math.round(b.y / 2)}:${Math.round(b.vy / 30)}:${Math.round(b.angle * 12)}`;
        if (!next.has(key)) next.set(key, b);
      }
    }
    if (next.size === 0) return false;
    states = [...next.values()];
    peak = Math.max(peak, states.length);
  }
  lastPeak = peak;
  return true;
}

export let lastPeak = 0;
