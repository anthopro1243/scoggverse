// The puzzle pieces' rules, with no Phaser, so they can be unit-tested. Positions are in pixels.

/**
 * A lever flips when a hero walks into it: walking right pushes it on, walking left pushes it off.
 * `on`/`off` say who may push it that way ("any", "boy" or "girl"); a veto lever lets one hero
 * pass the bill and only the other strike it down.
 */
export function pushLever(lever, { dir, who }) {
  const may = (rule) => !rule || rule === "any" || rule === who;
  if (dir > 0 && !lever.on && may(lever.rules?.on)) { lever.on = true; return true; }
  if (dir < 0 && lever.on && may(lever.rules?.off)) { lever.on = false; return true; }
  return false;
}

/** Move a value toward a target at a speed (per second); returns the new value. */
export function approach(v, target, speed, dt) {
  const d = target - v, step = speed * dt;
  return Math.abs(d) <= step ? target : v + Math.sign(d) * step;
}

/** A platform moving between two points: 0 at its start, 1 at its end, eased so it slows at each end. */
export const ease = (k) => k * k * (3 - 2 * k);

/**
 * The business cycle: an elevator rides from trough to peak and back, forever, on the level clock.
 * Returns 0 (trough, its lower point) .. 1 (peak), resting a moment at each end.
 */
export function cyclePhase(t, period, offset = 0) {
  const k = (((t / period + offset) % 1) + 1) % 1;
  const rest = 0.12;                           // fraction of the cycle spent resting at each end
  if (k < rest) return 0;
  if (k < 0.5) return ease((k - rest) / (0.5 - rest));
  if (k < 0.5 + rest) return 1;
  return 1 - ease((k - 0.5 - rest) / (0.5 - rest));
}

/** Checks and balances: the pan carrying more weight sinks, the other rises; equal weights level out. */
export function scaleOffset(left, right, travel) {
  return Math.max(-1, Math.min(1, left - right)) * travel; // + means the left pan is lower
}

/** The Rules Committee's sand clock: (re)filled while its trigger is on, then runs out. */
export function stepTimer(timer, { trigger, dt, seconds }) {
  if (trigger) timer.left = seconds;
  else timer.left = Math.max(0, timer.left - dt);
  if (timer.left < 1e-9) timer.left = 0; // no float dust left in the glass
  return timer.left > 0;
}

/** A latch (cloture): once its condition has been true, it stays on. */
export function stepLatch(latch, cond) {
  if (cond) latch.on = true;
  return latch.on;
}
