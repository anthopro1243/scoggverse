import { describe, it, expect } from "vitest";
import { barrierBlocks, stepGate, gateBlocks } from "../../src/logic/gates.js";

describe("element curtains", () => {
  it("flame lets only Scogg Boy through", () => {
    expect(barrierBlocks("flame", "boy")).toBe(false);
    expect(barrierBlocks("flame", "girl")).toBe(true);
  });
  it("water lets only Scogg Girl through", () => {
    expect(barrierBlocks("water", "girl")).toBe(false);
    expect(barrierBlocks("water", "boy")).toBe(true);
  });
  it("rejects unknown curtains", () => expect(() => barrierBlocks("acid", "boy")).toThrow());
});

describe("plates and gates", () => {
  const dt = 1 / 60, speed = 2.5;
  const run = (gate, n, s) => { for (let i = 0; i < n; i++) stepGate(gate, { dt, speed, held: false, occupied: false, ...s }); return gate; };
  it("a gate opens while its plate is held", () => {
    const g = run({ open: 0 }, 30, { held: true });
    expect(g.open).toBe(1);
    expect(gateBlocks(g)).toBe(false);
  });
  it("and closes again when the plate is let go", () => {
    const g = run(run({ open: 0 }, 30, { held: true }), 30, { held: false });
    expect(g.open).toBe(0);
    expect(gateBlocks(g)).toBe(true);
  });
  it("never closes onto a hero standing in it", () => {
    const g = run(run({ open: 0 }, 30, { held: true }), 60, { held: false, occupied: true });
    expect(g.open).toBe(1);
  });
  it("a half-open gate still blocks", () => {
    expect(gateBlocks(run({ open: 0 }, 12, { held: true }))).toBe(true);
  });
});
