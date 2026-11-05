import { describe, expect, it } from "vitest";
import { createRng, hashSeed } from "../../src/logic/rng.ts";

describe("seeded randomness", () => {
  it("gives the same numbers for the same seed", () => {
    const a = createRng("x"), b = createRng("x");
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });
  it("gives different numbers for different seeds", () => {
    expect(createRng("x").next()).not.toBe(createRng("y").next());
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
  });
  it("stays in range", () => {
    const r = createRng(3);
    for (let i = 0; i < 500; i++) {
      const f = r.range(5, 9), n = r.int(1, 3);
      expect(f).toBeGreaterThanOrEqual(5); expect(f).toBeLessThan(9);
      expect([1, 2, 3]).toContain(n);
    }
  });
});
