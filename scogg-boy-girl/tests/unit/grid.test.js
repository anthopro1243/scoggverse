import { describe, it, expect } from "vitest";
import { parseGrid, mergeRects } from "../../src/logic/grid.js";
import sandbox from "../../levels/sandbox.json";

describe("text-grid levels", () => {
  it("reads solids, spawns and pools", () => {
    const g = parseGrid(["#....#", "#b..g#", "#IIKR#", "######"]);
    expect(g.w).toBe(6); expect(g.h).toBe(4);
    expect(g.spawns).toEqual({ boy: { c: 1, r: 1 }, girl: { c: 4, r: 1 } });
    expect(g.pools).toEqual([
      { c: 1, r: 2, kind: "inflation", len: 2 },
      { c: 3, r: 2, kind: "ink", len: 1 },
      { c: 4, r: 2, kind: "recession", len: 1 },
    ]);
    expect(g.isSolid(0, 0)).toBe(true);
    expect(g.isSolid(1, 0)).toBe(false);
    expect(g.isSolid(-1, 0)).toBe(false);
  });
  it("reads both doors and both pickups, which are not solid", () => {
    const g = parseGrid(["V$..*C", "######"]);
    expect(g.doors).toEqual([{ c: 0, r: 0, kind: "vault", who: "boy" }, { c: 5, r: 0, kind: "chamber", who: "girl" }]);
    expect(g.pickups).toEqual([{ c: 1, r: 0, kind: "buck" }, { c: 4, r: 0, kind: "gavel" }]);
    expect(g.solid[0].some(Boolean)).toBe(false);
  });
  it("the sandbox is a full 32x18 screen with both spawns, both doors and all three pools", () => {
    const g = parseGrid(sandbox.grid);
    expect([g.w, g.h]).toEqual([32, 18]);
    expect(Object.keys(g.spawns).sort()).toEqual(["boy", "girl"]);
    expect(g.doors.map((d) => d.kind).sort()).toEqual(["chamber", "vault"]);
    expect(new Set(g.pools.map((p) => p.kind))).toEqual(new Set(["inflation", "ink", "recession"]));
  });
  it("reads curtains, plates and the gates they open", () => {
    const g = parseGrid(["#f.w.5#", "#f.w15#", "#######"]);
    expect(g.barriers).toEqual([{ kind: "flame", c: 1, r: 0, w: 1, h: 2 }, { kind: "water", c: 3, r: 0, w: 1, h: 2 }]);
    expect(g.plates).toEqual([{ c: 4, r: 1, group: 1 }]);
    expect(g.gates).toEqual([{ group: 1, c: 5, r: 0, w: 1, h: 2 }]);
    expect(g.solid[0][1] || g.solid[0][5]).toBe(false); // curtains and gates aren't stone
  });
});

describe("collision rectangles", () => {
  it("covers every cell exactly once with merged runs", () => {
    const m = [[1, 1, 0, 1], [1, 1, 0, 1], [0, 1, 1, 1]].map((r) => r.map(Boolean));
    const rects = mergeRects(m);
    expect(rects).toEqual([{ c: 0, r: 0, w: 2, h: 2 }, { c: 3, r: 0, w: 1, h: 2 }, { c: 1, r: 2, w: 3, h: 1 }]);
    const hit = m.map((r) => r.map(() => 0));
    for (const q of rects) for (let r = q.r; r < q.r + q.h; r++) for (let c = q.c; c < q.c + q.w; c++) hit[r][c]++;
    expect(hit).toEqual(m.map((r) => r.map((v) => (v ? 1 : 0))));
  });
  it("a tall wall is one body, so nothing catches on seams", () => {
    expect(mergeRects(Array.from({ length: 8 }, () => [false, true, false]))).toEqual([{ c: 1, r: 0, w: 1, h: 8 }]);
  });
});
