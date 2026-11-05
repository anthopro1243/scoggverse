// Scogg Bucks with inflation, Gavels, and the grade. No Phaser.
import { SCORE } from "./config.js";

const cents = (v) => Math.round(v * 100) / 100;

/** What one Scogg Buck is worth t seconds into the level: 3% less every 10 s, never below $2. */
export function buckValue(t, cfg = SCORE) {
  const steps = Math.floor(Math.max(0, t) / cfg.every);
  return Math.max(cfg.buckFloor, cents(cfg.buckStart * Math.pow(1 - cfg.inflation, steps)));
}

/** Seconds until the Scogg Buck's value next drops (for the HUD). */
export const nextDropIn = (t, cfg = SCORE) => cfg.every - (Math.max(0, t) % cfg.every);

/** The most a level can pay: every item at full value. */
export const bestValue = (bucks, gavels, cfg = SCORE) => bucks * cfg.buckStart + gavels * cfg.gavel;

/** Letter grade for value collected out of the best possible. */
export function grade(value, best, cfg = SCORE) {
  if (best <= 0) return "A";
  const r = value / best;
  return cfg.grades.find(([, min]) => r >= min - 1e-9)[0];
}

// One line per grade in his voice, taken or adapted from his real phrases (Lore Bible §3).
export const GRADE_LINES = {
  A: "Good, that's exactly right.",
  B: "You're on fire! Excellent.",
  C: "That's the right idea, close, but missing one thing.",
  D: "This is a lot.",
  F: "Don't deny yourself an education.",
};

/** The end card's numbers from what was picked up. bucks: values when grabbed. */
export function tally({ bucks, gavels, totalBucks, totalGavels, time }, cfg = SCORE) {
  const buckSum = cents(bucks.reduce((a, b) => a + b, 0));
  const gavelSum = gavels * cfg.gavel;
  const value = cents(buckSum + gavelSum);
  const best = bestValue(totalBucks, totalGavels, cfg);
  const g = grade(value, best, cfg);
  return { buckSum, gavelSum, value, best, grade: g, line: GRADE_LINES[g], time };
}

/** m:ss */
export const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
