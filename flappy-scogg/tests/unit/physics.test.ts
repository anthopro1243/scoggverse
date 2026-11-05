import { describe, expect, it } from "vitest";
import { FLAP_VY, GRAVITY, MAX_FALL, TILT_DOWN, TILT_UP } from "../../src/logic/config.ts";
import { stepBody, targetTilt, type Body } from "../../src/logic/physics.ts";

const body = (): Body => ({ y: 300, vy: 0, angle: 0 });

describe("the flap", () => {
  it("sets the upward speed instead of adding to it, so mashing doesn't rocket", () => {
    const a = body(); stepBody(a, true);
    const b = body(); b.vy = -400; stepBody(b, true);
    expect(a.vy).toBe(b.vy);
    expect(a.vy).toBeCloseTo(FLAP_VY + GRAVITY / 60);
  });
  it("rises about 69 units, then falls", () => {
    const b = body();
    stepBody(b, true);
    let top = b.y;
    for (let i = 0; i < 60; i++) { stepBody(b, false); top = Math.min(top, b.y); }
    expect(300 - top).toBeGreaterThan(62);
    expect(300 - top).toBeLessThan(76);
    expect(b.y).toBeGreaterThan(300);
  });
  it("doesn't move the face up without a tap", () => {
    const b = body();
    for (let i = 0; i < 30; i++) { const y = b.y; stepBody(b, false); expect(b.y).toBeGreaterThan(y); }
  });
});

describe("gravity and the tilt", () => {
  it("never falls faster than the terminal speed", () => {
    const b = body();
    for (let i = 0; i < 200; i++) stepBody(b, false);
    expect(b.vy).toBe(MAX_FALL);
  });
  it("noses up after a flap and down while falling, within its limits", () => {
    const b = body();
    stepBody(b, true);
    for (let i = 0; i < 4; i++) stepBody(b, false);
    expect(b.angle).toBeLessThan(0);
    for (let i = 0; i < 90; i++) stepBody(b, false);
    expect(b.angle).toBeGreaterThan(TILT_DOWN - 0.02);
    expect(b.angle).toBeLessThanOrEqual(TILT_DOWN);
    expect(targetTilt(-500)).toBe(TILT_UP);
    expect(targetTilt(5000)).toBeCloseTo(TILT_DOWN);
  });
});
