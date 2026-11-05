// A level file (levels/*.json): its name, subject, wings, signs and the 32x18 text grid.
// No Phaser, so tests can load and check every level.
import { parseGrid } from "./grid.js";
import { signalIds } from "./signals.js";
import { WORLD_W, WORLD_H, TILE } from "./config.js";

const COLS = WORLD_W / TILE, ROWS = WORLD_H / TILE;

/** Problems that would make a level unplayable (empty list = fine). */
export function checkLevel(def) {
  const out = [];
  if (!def.name) out.push("no name");
  if (!Array.isArray(def.grid) || def.grid.length !== ROWS) out.push(`grid must have ${ROWS} rows`);
  else def.grid.forEach((row, r) => { if (row.length !== COLS) out.push(`row ${r} has ${row.length} columns, not ${COLS}`); });
  if (out.length) return out;
  const g = parseGrid(def.grid);
  for (const who of ["boy", "girl"]) {
    if (!g.spawns[who]) out.push(`no ${who} start`);
    if (g.doors.filter((d) => d.who === who).length !== 1) out.push(`needs exactly one ${who === "boy" ? "vault" : "chamber"} door`);
  }
  for (const d of g.doors) if (!g.isSolid(d.c, d.r + 1)) out.push(`door at ${d.c},${d.r} isn't standing on stone`);
  for (const gate of g.gates) if (!g.plates.some((p) => p.group === gate.group)) out.push(`gate ${gate.group + 4} has no plate ${gate.group}`);
  for (const p of g.plates) if (!g.isSolid(p.c, p.r + 1)) out.push(`plate at ${p.c},${p.r} isn't on stone`);
  out.push(...checkObjects(def.objects || [], g));
  return out;
}

// What each puzzle piece needs (src/scenes/mechs.js builds them; levels/README.md documents them).
const NEEDS = {
  plate: ["id", "c", "r"],
  gate: ["c", "r", "open"],
  lever: ["id", "c", "r"],
  timer: ["id", "c", "r", "seconds", "trigger"],
  mover: ["id", "c", "r", "to", "when"],
  elevator: ["c", "r", "to", "period"],
  scale: ["left", "right"],
  basin: ["c", "r", "w", "h", "high"],
  crate: ["c", "r"],
};
const READS = { gate: "open", mover: "when", timer: "trigger", basin: "high" };

/** Problems with a level's objects: unknown types, missing fields, signals nobody sends. */
export function checkObjects(objects, g) {
  const out = [];
  if (!Array.isArray(objects)) return ["objects must be a list"];
  const sent = new Set();
  for (const p of g.plates) { sent.add(`P${p.group}`); sent.add(`P${p.group}all`); }
  const ids = new Set();
  objects.forEach((o, i) => {
    const name = `object ${i} (${o?.type})`;
    if (!o || !NEEDS[o.type]) { out.push(`${name}: unknown type`); return; }
    for (const k of NEEDS[o.type]) if (o[k] === undefined) out.push(`${name}: needs ${k}`);
    if (o.type === "plate") { sent.add(o.id); sent.add(`${o.id}all`); }
    if (o.type === "lever" || o.type === "timer") {
      if (ids.has(o.id)) out.push(`${name}: id ${o.id} is used twice`);
      ids.add(o.id); sent.add(o.id);
    }
    for (const [c, r] of [[o.c, o.r], ...(o.to ? [o.to] : []), ...(o.left ? [o.left] : []), ...(o.right ? [o.right] : [])]) {
      if (c === undefined && r === undefined) continue;
      if (!(c >= 0 && c < g.w && r >= 0 && r <= g.h)) out.push(`${name}: ${c},${r} is off the grid`);
    }
  });
  objects.forEach((o, i) => {
    const key = READS[o?.type];
    if (!key) return;
    for (const id of signalIds(o[key])) if (!sent.has(id)) out.push(`object ${i} (${o.type}): nothing sends ${id}`);
  });
  return out;
}

/** Parse a level and work out its wings (which half is Macro, which Gov). */
export function loadLevel(def) {
  const problems = checkLevel(def);
  if (problems.length) throw new Error(`${def.name || "level"}: ${problems.join("; ")}`);
  const grid = parseGrid(def.grid);
  const wings = def.wings === "macro" || def.wings === "gov"
    ? [{ x: 0, y: 0, w: WORLD_W, h: WORLD_H, wing: def.wings }]
    : [{ x: 0, y: 0, w: WORLD_W / 2, h: WORLD_H, wing: "macro" }, { x: WORLD_W / 2, y: 0, w: WORLD_W / 2, h: WORLD_H, wing: "gov" }];
  return { ...def, grid, wings, signs: def.signs || [] };
}
