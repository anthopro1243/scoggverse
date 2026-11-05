import { describe, expect, it } from "vitest";
import { createStepper } from "../../src/logic/fixedStep.ts";

describe("fixed timestep", () => {
  it("runs one step per 1/60 s whatever the frame rate", () => {
    const s = createStepper();
    let n = 0;
    for (let i = 0; i < 144; i++) s.advance(1000 / 144, () => n++); // a 144 Hz screen for one second
    expect(n).toBeGreaterThanOrEqual(59);
    expect(n).toBeLessThanOrEqual(60);
  });
  it("caps the catch-up after a stall instead of fast-forwarding", () => {
    const s = createStepper();
    let n = 0;
    s.advance(2000, () => n++);
    expect(n).toBe(5);
    s.advance(0, () => n++);
    expect(n).toBe(5);
  });
  it("ignores real time in manual mode", () => {
    const s = createStepper({ manual: true });
    let n = 0;
    s.advance(1000, () => n++);
    expect(n).toBe(0);
    s.stepManual(3, () => n++);
    expect(n).toBe(3);
  });
});
