import { describe, it, expect } from "vitest";
import { evalSignal, signalIds } from "../../src/logic/signals.js";
import { pushLever, approach, cyclePhase, scaleOffset, stepTimer, stepLatch } from "../../src/logic/mechs.js";

describe("signals", () => {
  const sig = { P1: true, P2: false, L1: true };
  it("reads ids, and, or, not", () => {
    expect(evalSignal("P1", sig)).toBe(true);
    expect(evalSignal("P1&P2", sig)).toBe(false);
    expect(evalSignal("P2|L1", sig)).toBe(true);
    expect(evalSignal("!P2&L1", sig)).toBe(true);
    expect(evalSignal("P2&L1|P1", sig)).toBe(true);
  });
  it("unknown or empty signals are off", () => {
    expect(evalSignal("X9", sig)).toBe(false);
    expect(evalSignal("", sig)).toBe(false);
    expect(evalSignal(undefined, sig)).toBe(false);
  });
  it("lists the ids an expression needs", () => expect(signalIds("!P1&L2|T1")).toEqual(["P1", "L2", "T1"]));
});

describe("levers", () => {
  it("walking right pushes it on, walking left pushes it off", () => {
    const l = { on: false };
    expect(pushLever(l, { dir: 1, who: "boy" })).toBe(true);
    expect(l.on).toBe(true);
    expect(pushLever(l, { dir: 1, who: "girl" })).toBe(false); // already on
    pushLever(l, { dir: -1, who: "girl" });
    expect(l.on).toBe(false);
  });
  it("veto: only Scogg Boy can pass it, only Scogg Girl can strike it down", () => {
    const l = { on: false, rules: { on: "boy", off: "girl" } };
    expect(pushLever(l, { dir: 1, who: "girl" })).toBe(false);
    expect(pushLever(l, { dir: 1, who: "boy" })).toBe(true);
    expect(pushLever(l, { dir: -1, who: "boy" })).toBe(false);
    expect(pushLever(l, { dir: -1, who: "girl" })).toBe(true);
  });
});

describe("moving things", () => {
  it("approach never overshoots", () => {
    expect(approach(0, 10, 60, 1 / 60)).toBe(1);
    expect(approach(9.5, 10, 60, 1 / 60)).toBe(10);
    expect(approach(10, 0, 120, 1 / 60)).toBe(8);
  });
  it("the business cycle rests at the trough and the peak and is smooth between", () => {
    expect(cyclePhase(0, 6)).toBe(0);
    expect(cyclePhase(3.2, 6)).toBe(1);
    expect(cyclePhase(6, 6)).toBe(0);
    let prev = 0;
    for (let t = 0; t <= 3; t += 0.05) { const v = cyclePhase(t, 6); expect(v).toBeGreaterThanOrEqual(prev - 1e-9); prev = v; }
    for (let t = 0; t < 12; t += 0.1) expect(Math.abs(cyclePhase(t + 0.02, 6) - cyclePhase(t, 6))).toBeLessThan(0.02);
  });
  it("checks and balances: the heavier pan sinks, equal weights level out", () => {
    expect(scaleOffset(1, 0, 60)).toBe(60);
    expect(scaleOffset(0, 1, 60)).toBe(-60);
    expect(scaleOffset(1, 1, 60)).toBe(0);
    expect(scaleOffset(2, 0, 60)).toBe(60);
  });
});

describe("timers and latches", () => {
  it("the sand clock refills while triggered, then runs out", () => {
    const t = { left: 0 };
    expect(stepTimer(t, { trigger: true, dt: 1 / 60, seconds: 2 })).toBe(true);
    let on = true, n = 0;
    while (on && n < 1000) { on = stepTimer(t, { trigger: false, dt: 1 / 60, seconds: 2 }); n++; }
    expect(n).toBe(120);
  });
  it("cloture: once both plates were held together, the filibuster is over for good", () => {
    const l = { on: false };
    expect(stepLatch(l, false)).toBe(false);
    expect(stepLatch(l, true)).toBe(true);
    expect(stepLatch(l, false)).toBe(true);
  });
});
