import { describe, it, expect } from "vitest";
import { better, cleanProgress, recordGrade, isUnlocked, nextToPlay, levelAfter } from "../../src/logic/progress.js";

const ORDER = ["priming", "one", "two", "three"];

describe("saved progress", () => {
  it("keeps the better grade", () => {
    expect(better("B", "A")).toBe("A");
    expect(better("A", "C")).toBe("A");
    expect(better(undefined, "D")).toBe("D");
    expect(better("F", undefined)).toBe("F");
    let p = cleanProgress({}, ORDER);
    p = recordGrade(p, "one", "C");
    p = recordGrade(p, "one", "A");
    p = recordGrade(p, "one", "B");
    expect(p.best.one).toBe("A");
  });
  it("opens each chamber once the one before it is escaped, whatever the grade", () => {
    let p = cleanProgress({}, ORDER);
    expect(ORDER.map((n) => isUnlocked(p, ORDER, n))).toEqual([true, false, false, false]);
    p = recordGrade(p, "priming", "F");
    expect(ORDER.map((n) => isUnlocked(p, ORDER, n))).toEqual([true, true, false, false]);
    expect(isUnlocked(p, ORDER, "not-a-level")).toBe(false);
  });
  it("offers the first open chamber not yet escaped, then the last one", () => {
    let p = cleanProgress({}, ORDER);
    expect(nextToPlay(p, ORDER)).toBe("priming");
    p = recordGrade(recordGrade(p, "priming", "A"), "one", "B");
    expect(nextToPlay(p, ORDER)).toBe("two");
    for (const n of ORDER) p = recordGrade(p, n, "A");
    expect(nextToPlay(p, ORDER)).toBe("three");
    expect(levelAfter(ORDER, "two")).toBe("three");
    expect(levelAfter(ORDER, "three")).toBe(null);
  });
  it("drops anything odd from a saved record", () => {
    expect(cleanProgress(null, ORDER)).toEqual({ best: {} });
    expect(cleanProgress("junk", ORDER)).toEqual({ best: {} });
    expect(cleanProgress({ best: { priming: "A", one: "Z", gone: "A", two: 3 } }, ORDER)).toEqual({ best: { priming: "A" } });
  });
});
