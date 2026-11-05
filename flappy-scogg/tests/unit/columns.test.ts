import { describe, expect, it } from "vitest";
import { COL_SPACING, EASY_COLUMNS, EASY_GAP, FIRST_COL_X, GAP, MAX_DROP, MAX_RISE } from "../../src/logic/config.ts";
import { gapBounds, gapFor, type Column } from "../../src/logic/columns.ts";
import { FACE_IDS } from "../../src/logic/faces.ts";
import { canPass, runColumns } from "../../src/logic/solver.ts";

describe("column spawning", () => {
  it("keeps every gap in bounds and within reach of the last one", () => {
    for (let s = 0; s < 200; s++) {
      const cols = runColumns(`spawn-${s}`, 1, 120);
      cols.forEach((c, i) => {
        const [lo, hi] = gapBounds(c.gap);
        expect(c.gapY).toBeGreaterThanOrEqual(lo);
        expect(c.gapY).toBeLessThanOrEqual(hi);
        if (i > 0) {
          expect(cols[i - 1].gapY - c.gapY).toBeLessThanOrEqual(MAX_RISE + 0.5);
          expect(c.gapY - cols[i - 1].gapY).toBeLessThanOrEqual(MAX_DROP + 0.5);
        }
      });
    }
  });
  it("makes the first ten gaps wider, then keeps one size", () => {
    const cols = runColumns("easy", 1, 40);
    cols.forEach((c, i) => expect(c.gap).toBe(i < EASY_COLUMNS ? EASY_GAP : GAP));
  });
  it("spaces columns evenly, never closer over time", () => {
    const cols = runColumns("spacing", 1, 60);
    cols.forEach((c, i) => expect(c.x).toBe(FIRST_COL_X + i * COL_SPACING));
  });
  it("adds a bronze column now and then, never two in a row", () => {
    const cols = runColumns("bronze", 1, 400);
    const n = cols.filter((c) => c.bronze).length;
    expect(n).toBeGreaterThan(25);
    expect(n).toBeLessThan(90);
    cols.forEach((c, i) => { if (i > 0 && c.bronze) expect(cols[i - 1].bronze).toBe(false); });
  });
  it("is the same for the same seed", () => {
    expect(runColumns("same", 1, 30)).toEqual(runColumns("same", 1, 30));
  });
});

describe("every gap is reachable", () => {
  // The hardest sequences the spawner allows: the biggest rise and the biggest drop, back to back,
  // between the highest and lowest gaps, across the switch from wide to normal gaps.
  const worst = (pattern: Array<"rise" | "drop" | "top" | "bottom">): Column[] => {
    const cols: Column[] = [];
    pattern.forEach((p, i) => {
      const gap = gapFor(i + EASY_COLUMNS - 2);
      const [lo, hi] = gapBounds(gap);
      const prev = cols[i - 1]?.gapY ?? 300;
      const y = p === "top" ? lo : p === "bottom" ? hi : p === "rise" ? Math.max(lo, prev - MAX_RISE) : Math.min(hi, prev + MAX_DROP);
      cols.push({ index: i, x: FIRST_COL_X + i * COL_SPACING, gapY: y, gap, bronze: false, scored: false });
    });
    return cols;
  };
  for (const id of FACE_IDS) {
    it(`face ${id}: biggest rises and drops, from the bottom and from the top`, () => {
      expect(canPass(worst(["bottom", "rise", "rise", "rise", "drop", "drop", "drop", "rise", "drop", "rise"]), id)).toBe(true);
      expect(canPass(worst(["top", "drop", "drop", "drop", "rise", "rise", "rise", "drop", "rise", "drop"]), id)).toBe(true);
    }, 60_000);
  }
  it("random runs can be passed all the way (a search over every tap pattern)", () => {
    for (let s = 0; s < 4; s++) expect(canPass(runColumns(`reach-${s}`, 1, 25))).toBe(true);
  }, 120_000);
});
