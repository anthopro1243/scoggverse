// Column spawning: gap heights move around at random (seeded), but each gap stays within reach
// of the last one, so every run can be beaten.
import { BRONZE_EVERY, COL_SPACING, EASY_COLUMNS, EASY_GAP, FACE_START_Y, FIRST_GAP_RANGE, FLOOR_Y, CEIL_Y, GAP, GAP_MARGIN, MAX_DROP, MAX_RISE } from "./config.ts";
import type { Rng } from "./rng.ts";

export interface Column {
  index: number; // 0 for the first column of a run
  x: number; // left edge of the shaft
  gapY: number; // center of the gap
  gap: number; // gap height
  bronze: boolean;
  scored: boolean;
}

export const gapFor = (index: number): number => (index < EASY_COLUMNS ? EASY_GAP : GAP);

/** Lowest and highest gap centers allowed for a gap of this size. */
export function gapBounds(gap: number): [number, number] {
  return [CEIL_Y + GAP_MARGIN + gap / 2, FLOOR_Y - GAP_MARGIN - gap / 2];
}

/** The next gap's center: uniform over everything in bounds and within reach of the last one. */
export function nextGapY(rng: Rng, index: number, prevY: number | null): number {
  const [lo, hi] = gapBounds(gapFor(index));
  const from = prevY === null ? Math.max(lo, FACE_START_Y - FIRST_GAP_RANGE) : Math.max(lo, prevY - MAX_RISE);
  const to = prevY === null ? Math.min(hi, FACE_START_Y + FIRST_GAP_RANGE) : Math.min(hi, prevY + MAX_DROP);
  return Math.round(rng.range(from, to));
}

/** Bronze columns show up now and then, never twice in a row and never in the first three. */
export function isBronze(rng: Rng, index: number, prevBronze: boolean): boolean {
  return index >= 3 && !prevBronze && rng.next() < 1 / BRONZE_EVERY;
}

export function makeColumn(rng: Rng, index: number, x: number, prev: Column | null): Column {
  const gapY = nextGapY(rng, index, prev ? prev.gapY : null);
  return { index, x, gapY, gap: gapFor(index), bronze: isBronze(rng, index, prev?.bronze ?? false), scored: false };
}

export const columnX = (firstX: number, index: number): number => firstX + index * COL_SPACING;
