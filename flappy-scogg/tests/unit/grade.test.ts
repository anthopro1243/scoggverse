import { describe, expect, it } from "vitest";
import { gradeFor, LINES, lineFor } from "../../src/logic/grade.ts";

describe("grades", () => {
  it("F under 5, D 5 to 9, C 10 to 19, B 20 to 39, A 40 and up", () => {
    const cases: Array<[number, string]> = [[0, "F"], [4, "F"], [5, "D"], [9, "D"], [10, "C"], [19, "C"], [20, "B"], [39, "B"], [40, "A"], [250, "A"]];
    for (const [score, grade] of cases) expect(gradeFor(score)).toBe(grade);
  });
  it("has his line for each grade, and its own for dying on the first column", () => {
    expect(lineFor(0)).toBe(LINES.firstColumn);
    expect(lineFor(3)).toBe(LINES.F);
    expect(lineFor(7)).toBe(LINES.D);
    expect(lineFor(12)).toBe(LINES.C);
    expect(lineFor(25)).toBe(LINES.B);
    expect(lineFor(41)).toBe(LINES.A);
  });
  it("writes the lines the way a classmate would: no em dashes", () => {
    for (const l of Object.values(LINES)) expect(l).not.toMatch(/—/);
  });
});
