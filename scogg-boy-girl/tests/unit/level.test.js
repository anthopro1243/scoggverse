import { describe, it, expect } from "vitest";
import { checkLevel, loadLevel } from "../../src/logic/level.js";
import { LEVELS, ORDER } from "../../src/levels.js";
import { parseGrid } from "../../src/logic/grid.js";

describe("level files", () => {
  it("every level and test room loads with no problems", () => {
    expect(Object.keys(LEVELS).length).toBeGreaterThanOrEqual(4);
    for (const [name, def] of Object.entries(LEVELS)) expect([name, checkLevel(def)]).toEqual([name, []]);
  });
  it("the game starts with Priming, which teaches the three pools, both doors and both pickups", () => {
    expect(ORDER[0]).toBe("priming");
    const g = parseGrid(LEVELS.priming.grid);
    expect(new Set(g.pools.map((p) => p.kind))).toEqual(new Set(["inflation", "ink", "recession"]));
    expect(g.doors.map((d) => d.kind).sort()).toEqual(["chamber", "vault"]);
    expect(g.pickups.some((p) => p.kind === "buck") && g.pickups.some((p) => p.kind === "gavel")).toBe(true);
  });
  it("catches a level missing a door, a start or a plate", () => {
    const grid = [...LEVELS.priming.grid];
    const noDoor = grid.map((r) => r.replace("V", "."));
    expect(checkLevel({ name: "x", grid: noDoor }).join()).toMatch(/vault/);
    const noStart = grid.map((r) => r.replace("g", "."));
    expect(checkLevel({ name: "x", grid: noStart }).join()).toMatch(/girl start/);
    const lonelyGate = grid.map((r, i) => (i === 15 ? r.slice(0, 10) + "5" + r.slice(11) : r));
    expect(checkLevel({ name: "x", grid: lonelyGate }).join()).toMatch(/no plate/);
    expect(checkLevel({ name: "x", grid: grid.slice(1) }).join()).toMatch(/18 rows/);
  });
  it("loadLevel refuses a broken level and splits the wings", () => {
    expect(() => loadLevel({ name: "x", grid: [] })).toThrow();
    expect(loadLevel(LEVELS.priming).wings.map((w) => w.wing)).toEqual(["macro", "gov"]);
  });
});
