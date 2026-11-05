import { describe, it, expect } from "vitest";
import { createJump } from "../../src/logic/jump.js";
import { MOVE } from "../../src/logic/config.js";

const dt = 1 / 60;
const run = (j, frames) => frames.map((f) => j.step({ dt, vy: 0, ...f }));

describe("jump feel", () => {
  it("jumps when pressed on the ground", () => {
    expect(createJump().step({ grounded: true, held: true, vy: 0, dt }).jump).toBe(true);
  });
  it("holding the key doesn't jump again: each jump needs a fresh press", () => {
    const j = createJump();
    const out = run(j, [{ grounded: true, held: true }, { grounded: false, held: true, vy: -300 }, ...Array(10).fill({ grounded: true, held: true, vy: 0 })]);
    expect(out.filter((o) => o.jump).length).toBe(1);
  });
  it("coyote time: still jumps a few frames after walking off a ledge", () => {
    const j = createJump();
    run(j, [{ grounded: true, held: false }, ...Array(4).fill({ grounded: false, held: false, vy: 50 })]);
    expect(j.step({ grounded: false, held: true, vy: 60, dt }).jump).toBe(true);
  });
  it("but not once the coyote time has run out", () => {
    const j = createJump();
    const late = Math.ceil(MOVE.coyote / dt) + 2;
    run(j, [{ grounded: true, held: false }, ...Array(late).fill({ grounded: false, held: false, vy: 200 })]);
    expect(j.step({ grounded: false, held: true, vy: 200, dt }).jump).toBe(false);
  });
  it("a jump pressed just before landing happens on landing (buffer)", () => {
    const j = createJump();
    run(j, [{ grounded: false, held: false, vy: 300 }, { grounded: false, held: true, vy: 300 }, ...Array(4).fill({ grounded: false, held: true, vy: 300 })]);
    expect(j.step({ grounded: true, held: true, vy: 0, dt }).jump).toBe(true);
  });
  it("but a press long before landing is forgotten", () => {
    const j = createJump();
    const early = Math.ceil(MOVE.jumpBuffer / dt) + 3;
    run(j, [{ grounded: false, held: false, vy: 300 }, { grounded: false, held: true, vy: 300 }, ...Array(early).fill({ grounded: false, held: false, vy: 300 })]);
    expect(j.step({ grounded: true, held: false, vy: 0, dt }).jump).toBe(false);
  });
  it("letting go early while rising cuts the jump short; letting go while falling does nothing", () => {
    const j = createJump();
    j.step({ grounded: true, held: true, vy: 0, dt });
    expect(j.step({ grounded: false, held: false, vy: -500, dt }).cut).toBe(true);
    const k = createJump();
    k.step({ grounded: true, held: true, vy: 0, dt });
    expect(k.step({ grounded: false, held: false, vy: 100, dt }).cut).toBe(false);
  });
  it("coyote time can't give a double jump", () => {
    const j = createJump();
    j.step({ grounded: true, held: true, vy: 0, dt });
    j.step({ grounded: false, held: false, vy: -600, dt });
    expect(j.step({ grounded: false, held: true, vy: -580, dt }).jump).toBe(false);
  });
});
