// Which chambers are open and the best grade earned in each. No Phaser, no storage (see
// src/progress.js), so the rules are unit-tested.
import { SCORE } from "./config.js";

const RANK = Object.fromEntries(SCORE.grades.map(([g], i) => [g, i])); // A is 0, F is last

/** The better of two grades (either may be missing). */
export function better(a, b) {
  if (!(a in RANK)) return b in RANK ? b : undefined;
  if (!(b in RANK)) return a;
  return RANK[a] <= RANK[b] ? a : b;
}

/** A clean progress record from whatever was saved (anything odd is dropped). */
export function cleanProgress(raw, order) {
  const best = {};
  const src = raw && typeof raw === "object" && raw.best && typeof raw.best === "object" ? raw.best : {};
  for (const name of order) if (src[name] in RANK) best[name] = src[name];
  return { best };
}

/** Record a finished chamber: keeps the better grade. Returns a new record. */
export function recordGrade(progress, name, grade) {
  return { ...progress, best: { ...progress.best, [name]: better(progress.best[name], grade) } };
}

/** A chamber is open once the one before it has been escaped (the first is always open). */
export function isUnlocked(progress, order, name) {
  const i = order.indexOf(name);
  return i === 0 || (i > 0 && order[i - 1] in progress.best);
}

/** The chamber to offer first: the first open one not yet escaped, or the last one. */
export function nextToPlay(progress, order) {
  return order.find((n) => isUnlocked(progress, order, n) && !(n in progress.best)) ?? order[order.length - 1];
}

/** The chamber after this one, or null after the last. */
export const levelAfter = (order, name) => order[order.indexOf(name) + 1] ?? null;
