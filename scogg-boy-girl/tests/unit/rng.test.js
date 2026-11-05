import { describe, it, expect } from "vitest";
import { createRng, hashSeed } from "../../src/logic/rng.js";

describe("seeded random", () => {
  it("gives the same numbers for the same seed", () => {
    const a = createRng("level-3"), b = createRng("level-3");
    const seqA = Array.from({ length: 50 }, a.next), seqB = Array.from({ length: 50 }, b.next);
    expect(seqA).toEqual(seqB);
  });
  it("gives different numbers for different seeds", () => {
    const a = createRng(1), b = createRng(2);
    expect(Array.from({ length: 5 }, a.next)).not.toEqual(Array.from({ length: 5 }, b.next));
  });
  it("stays inside its ranges", () => {
    const r = createRng("ranges");
    for (let i = 0; i < 2000; i++) {
      const f = r.next(); expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThan(1);
      const n = r.int(2, 5); expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(5); expect(Number.isInteger(n)).toBe(true);
      const x = r.range(-3, 3); expect(x).toBeGreaterThanOrEqual(-3); expect(x).toBeLessThan(3);
    }
  });
  it("can save and restore its state mid-sequence", () => {
    const r = createRng("save");
    r.next(); r.next();
    const saved = r.state;
    const next3 = [r.next(), r.next(), r.next()];
    r.state = saved;
    expect([r.next(), r.next(), r.next()]).toEqual(next3);
  });
  it("hashes strings to 32-bit seeds", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).toBeLessThan(2 ** 32);
  });
});
