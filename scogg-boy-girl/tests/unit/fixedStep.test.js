import { describe, it, expect } from "vitest";
import { createStepper } from "../../src/logic/fixedStep.js";
import { STEP_MS, MAX_STEPS_PER_FRAME } from "../../src/logic/config.js";

describe("fixed-timestep loop", () => {
  it("runs one step per 1/60 s of real time, whatever the frame rate", () => {
    for (const fps of [30, 60, 75, 144]) {
      const s = createStepper();
      let steps = 0;
      for (let i = 0; i < fps * 10; i++) s.advance(1000 / fps, () => steps++); // 10 seconds
      expect(Math.abs(steps - 600)).toBeLessThanOrEqual(1);
    }
  });
  it("doesn't step on a frame shorter than one step", () => {
    const s = createStepper();
    let steps = 0;
    s.advance(STEP_MS * 0.5, () => steps++);
    expect(steps).toBe(0);
    s.advance(STEP_MS * 0.6, () => steps++);
    expect(steps).toBe(1);
  });
  it("caps the steps after a long stall instead of spiralling", () => {
    const s = createStepper();
    let steps = 0;
    expect(s.advance(5000, () => steps++)).toBe(MAX_STEPS_PER_FRAME);
    expect(s.advance(0, () => steps++)).toBe(0); // the backlog was dropped
  });
  it("ignores real time in manual mode; only stepManual moves it", () => {
    const s = createStepper({ manual: true });
    let steps = 0;
    expect(s.advance(1000, () => steps++)).toBe(0);
    s.stepManual(7, () => steps++);
    expect(steps).toBe(7);
    expect(s.frame).toBe(7);
  });
  it("passes a frame counter that counts up by one", () => {
    const s = createStepper({ manual: true });
    const seen = [];
    s.stepManual(4, (f) => seen.push(f));
    expect(seen).toEqual([0, 1, 2, 3]);
  });
});
