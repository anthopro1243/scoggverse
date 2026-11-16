import { describe, expect, it } from "vitest";
import { gradeFor } from "../../src/logic/grade.ts";

describe("grades", () => {
  it("F under 5, D 5 to 9, C 10 to 19, B 20 to 39, A 40 and up", () => {
    const cases: Array<[number, string]> = [[0, "F"], [4, "F"], [5, "D"], [9, "D"], [10, "C"], [19, "C"], [20, "B"], [39, "B"], [40, "A"], [250, "A"]];
    for (const [score, grade] of cases) expect(gradeFor(score)).toBe(grade);
  });
});
