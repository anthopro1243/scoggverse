// Every level in the game: it parses, both exits exist, and no Scogg Buck is out of Scogg Boy's
// reach. (The browser solve test then proves each level in play: its replay picks up every Buck.)
import { describe, it, expect } from "vitest";
import { checkLevel, checkObjects } from "../../src/logic/level.js";
import { parseGrid, POOL_CHARS } from "../../src/logic/grid.js";
import { LEVELS, ORDER } from "../../src/levels.js";

const PLAN = [
  ["along-the-curve", "macro"], ["cats-in-a-sack", "gov"], ["ovens-and-tee-shirts", "macro"], ["layer-cake-marble-cake", "gov"],
  ["quaker-oats-incident", "macro"], ["hamburger-stand-hustle", "macro"], ["factor-market", "both"], ["rules-committee", "gov"],
];

/** Rows a hero can stand in (the cell above something solid), per column, including every puzzle piece's surfaces. */
function standSpots(def) {
  const g = parseGrid(def.grid);
  const spots = new Set();
  const add = (c, r) => { if (r >= 0 && c >= 0 && c < g.w) spots.add(`${c},${Math.floor(r)}`); };
  def.grid.forEach((row, r) => [...row].forEach((ch, c) => {
    const below = def.grid[r + 1]?.[c];
    if (ch !== "#" && (below === "#" || POOL_CHARS[below])) add(c, r);
  }));
  for (const o of def.objects || []) {
    const span = (c, r, w) => { for (let i = 0; i < w; i++) add(c + i, r - 1); };
    if (o.type === "mover" || o.type === "elevator") { span(o.c, o.r, o.w || 2); span(o.to[0], o.to[1], o.w || 2); }
    if (o.type === "scale") for (const [c, r, w] of [o.left, o.right]) for (const d of [-(o.travel ?? 2), 0, o.travel ?? 2]) span(c, r + d, w);
    if (o.type === "basin") span(o.c, o.r, o.w);
    if (o.type === "crate") add(o.c, o.r - 1);
  }
  return spots;
}

describe("the game's levels", () => {
  it("are Priming and then the plan's eight levels, in order, with the right subjects", () => {
    expect(ORDER).toEqual(["priming", ...PLAN.map(([n]) => n)]);
    for (const [name, subject] of PLAN) expect([name, LEVELS[name].subject]).toEqual([name, subject]);
  });

  for (const name of ORDER) {
    it(`${name}: parses, has both exits on stone, and every Scogg Buck is within a jump of somewhere to stand`, () => {
      const def = LEVELS[name];
      expect(checkLevel(def)).toEqual([]);
      const g = parseGrid(def.grid);
      expect(g.doors.map((d) => d.who).sort()).toEqual(["boy", "girl"]);
      for (const d of g.doors) expect(g.isSolid(d.c, d.r + 1)).toBe(true);
      expect(unreachableBucks(def)).toEqual([]);
    });
  }

  it("the Buck check catches a Buck floating out of reach", () => {
    const grid = LEVELS.priming.grid.map((row, r) => (r === 2 ? row.slice(0, 25) + "$" + row.slice(26) : row));
    expect(unreachableBucks({ ...LEVELS.priming, grid })).toEqual([[25, 2]]);
  });
});

/** Bucks in stone, behind water, or more than a jump from anywhere Scogg Boy can stand. */
function unreachableBucks(def) {
  const g = parseGrid(def.grid);
  const spots = standSpots(def);
  // a hero is 1.7 tiles tall and jumps 4.5 tiles up and 6 across: within 5 rows above and 4
  // columns either side of somewhere he can stand
  const near = (c, r) => {
    for (let dc = -4; dc <= 4; dc++) for (let dr = 0; dr <= 5; dr++) if (spots.has(`${c + dc},${r + dr}`)) return true;
    return false;
  };
  return g.pickups.filter((p) => p.kind === "buck" && (g.isSolid(p.c, p.r) || def.grid[p.r][p.c] === "w" || !near(p.c, p.r))).map((p) => [p.c, p.r]);
}

describe("checking a level's puzzle pieces", () => {
  const g = parseGrid(LEVELS.priming.grid);
  it("passes a well-wired set", () => {
    expect(checkObjects([
      { type: "lever", id: "L1", c: 3, r: 14 },
      { type: "mover", id: "M", c: 5, r: 10, to: [5, 6], when: "L1" },
      { type: "plate", id: "F", c: 2, r: 15 }, { type: "gate", c: 9, r: 12, open: "Fall", latch: true },
      { type: "timer", id: "T", c: 4, r: 4, seconds: 2, trigger: "F" }, { type: "gate", c: 8, r: 12, open: "!T|L1" },
    ], g)).toEqual([]);
  });
  it("catches unknown pieces, missing fields, repeated ids, stray positions and signals nobody sends", () => {
    expect(checkObjects([{ type: "trampoline", c: 1, r: 1 }], g).join()).toMatch(/unknown type/);
    expect(checkObjects([{ type: "gate", c: 1, r: 1 }], g).join()).toMatch(/needs open/);
    expect(checkObjects([{ type: "lever", id: "L", c: 1, r: 1 }, { type: "lever", id: "L", c: 2, r: 1 }], g).join()).toMatch(/used twice/);
    expect(checkObjects([{ type: "crate", c: 40, r: 1 }], g).join()).toMatch(/off the grid/);
    expect(checkObjects([{ type: "gate", c: 1, r: 1, open: "L9&P1" }], g).join()).toMatch(/nothing sends L9/);
    expect(checkLevel({ ...LEVELS.priming, objects: [{ type: "basin", c: 1, r: 1, w: 2, h: 2, high: "nope" }] }).join()).toMatch(/nothing sends nope/);
  });
});
