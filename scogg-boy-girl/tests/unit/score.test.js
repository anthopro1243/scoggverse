import { describe, it, expect } from "vitest";
import { buckValue, grade, tally, bestValue, clock, nextDropIn } from "../../src/logic/score.js";
import { SCORE } from "../../src/logic/config.js";

describe("Scogg Bucks and inflation", () => {
  it("a Scogg Buck is worth $10 when the level starts", () => {
    expect(buckValue(0)).toBe(10);
    expect(buckValue(9.99)).toBe(10);
  });
  it("loses 3% every 10 seconds, compounding", () => {
    expect(buckValue(10)).toBe(9.7);
    expect(buckValue(20)).toBe(9.41);
    expect(buckValue(60)).toBeCloseTo(10 * 0.97 ** 6, 2);
  });
  it("never drops below $2, and never goes up", () => {
    expect(buckValue(100000)).toBe(2);
    let prev = Infinity;
    for (let t = 0; t < 2000; t += 5) { const v = buckValue(t); expect(v).toBeLessThanOrEqual(prev); expect(v).toBeGreaterThanOrEqual(2); prev = v; }
  });
  it("tells the HUD when the next drop comes", () => {
    expect(nextDropIn(0)).toBe(10);
    expect(nextDropIn(13)).toBe(7);
  });
  it("Gavels keep their value: a slow run only loses on Bucks", () => {
    const fast = tally({ bucks: [10, 10], gavels: 2, totalBucks: 2, totalGavels: 2, time: 20 });
    const slow = tally({ bucks: [buckValue(300), buckValue(300)], gavels: 2, totalBucks: 2, totalGavels: 2, time: 300 });
    expect(slow.gavelSum).toBe(fast.gavelSum);
    expect(slow.buckSum).toBeLessThan(fast.buckSum);
  });
});

describe("the grade", () => {
  it("best possible value is every item at full value", () => {
    expect(bestValue(4, 3)).toBe(4 * SCORE.buckStart + 3 * SCORE.gavel);
  });
  it("everything collected quickly is an A", () => {
    expect(tally({ bucks: [10, 10, 9.7, 9.7], gavels: 4, totalBucks: 4, totalGavels: 4, time: 25 }).grade).toBe("A");
  });
  it("a slow but complete run is about a C", () => {
    const v = buckValue(180);
    expect(tally({ bucks: [v, v, v, v], gavels: 4, totalBucks: 4, totalGavels: 4, time: 180 }).grade).toBe("C");
  });
  it("missing things costs grades; nothing collected is an F", () => {
    expect(tally({ bucks: [10, 10, 10, 10], gavels: 3, totalBucks: 4, totalGavels: 4, time: 9 }).grade).toBe("B");
    expect(tally({ bucks: [10, 10, 10], gavels: 3, totalBucks: 4, totalGavels: 4, time: 9 }).grade).toBe("C");
    expect(tally({ bucks: [], gavels: 0, totalBucks: 4, totalGavels: 4, time: 9 }).grade).toBe("F");
  });
  it("grade boundaries", () => {
    expect(grade(90, 100)).toBe("A");
    expect(grade(89.9, 100)).toBe("B");
    expect(grade(68, 100)).toBe("C");
    expect(grade(51.9, 100)).toBe("F");
  });
  it("clock reads m:ss", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(75.9)).toBe("1:15");
  });
});
