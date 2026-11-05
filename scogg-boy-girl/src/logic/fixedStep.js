// Fixed-timestep loop: the simulation always advances in exact 1/60 s steps, whatever the
// display's frame rate. In manual mode (tests, replays) real time is ignored and only
// stepManual() moves the game, so the same inputs always give the same result.
import { STEP_MS, MAX_STEPS_PER_FRAME } from "./config.js";

export function createStepper({ stepMs = STEP_MS, maxSteps = MAX_STEPS_PER_FRAME, manual = false } = {}) {
  let acc = 0;
  let frame = 0;
  return {
    get frame() { return frame; },
    get manual() { return manual; },
    set manual(v) { manual = !!v; acc = 0; },
    /** Feed real elapsed ms; runs step() zero or more times. Returns the number of steps run. */
    advance(deltaMs, step) {
      if (manual) return 0;
      acc += Math.max(0, deltaMs);
      let n = 0;
      while (acc >= stepMs && n < maxSteps) {
        acc -= stepMs;
        step(frame++);
        n++;
      }
      if (acc >= stepMs) acc %= stepMs; // hit the cap: drop the backlog after a stall
      return n;
    },
    /** Run exactly n steps now (manual mode or not). */
    stepManual(n, step) {
      for (let i = 0; i < n; i++) step(frame++);
      return n;
    },
    /** Fraction of a step left over, for smooth rendering if ever needed. */
    get alpha() { return acc / stepMs; },
    reset() { acc = 0; frame = 0; },
  };
}
