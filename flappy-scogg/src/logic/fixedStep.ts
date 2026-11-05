// Fixed-timestep loop: the game always advances in exact 1/60 s steps, whatever the display's
// frame rate. In manual mode (tests, replays) real time is ignored and only stepManual() moves it.
import { STEP_MS, MAX_STEPS_PER_FRAME } from "./config.ts";

export interface Stepper {
  readonly frame: number;
  manual: boolean;
  /** Feed real elapsed ms; runs step() zero or more times. Returns the number of steps run. */
  advance(deltaMs: number, step: (frame: number) => void): number;
  /** Run exactly n steps now. */
  stepManual(n: number, step: (frame: number) => void): number;
  reset(): void;
}

export function createStepper({ stepMs = STEP_MS, maxSteps = MAX_STEPS_PER_FRAME, manual = false } = {}): Stepper {
  let acc = 0;
  let frame = 0;
  return {
    get frame() { return frame; },
    get manual() { return manual; },
    set manual(v: boolean) { manual = v; acc = 0; },
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
    stepManual(n, step) {
      for (let i = 0; i < n; i++) step(frame++);
      return n;
    },
    reset() { acc = 0; frame = 0; },
  };
}
