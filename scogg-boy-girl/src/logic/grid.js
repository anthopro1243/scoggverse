// Text-grid levels: one character per 30 px tile, 32 columns x 18 rows.
//   .  empty                 #  solid stone
//   I  Inflation pool        K  Ink pool          R  Recession pool
//   b  Scogg Boy start       g  Scogg Girl start  (the tile they stand in)
//   V  Scogg Boy's vault door   C  Scogg Girl's chamber door  (the tile at the door's bottom center)
//   $  Scogg Buck            *  Gavel
//   f  flame curtain (only Scogg Boy passes)     w  water curtain (only Scogg Girl passes)
//   1-4  pressure plate (sits on the floor below it)   5-8  gate opened by plate 1-4 (5 by 1, 6 by 2...)
// G2 adds the rest of the legend (levers, elevators, crates...).

export const POOL_CHARS = { I: "inflation", K: "ink", R: "recession" };
export const BARRIER_CHARS = { f: "flame", w: "water" };

export function parseGrid(rows) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const solid = [];
  const pools = [];
  const spawns = {};
  const doors = [];
  const pickups = [];
  const plates = [];
  const masks = { flame: blank(w, h), water: blank(w, h) };
  const gateMasks = {};
  rows.forEach((row, r) => {
    solid.push([]);
    for (let c = 0; c < w; c++) {
      const ch = row[c] ?? ".";
      solid[r].push(ch === "#");
      if (POOL_CHARS[ch]) pools.push({ c, r, kind: POOL_CHARS[ch] });
      if (ch === "b") spawns.boy = { c, r };
      if (ch === "g") spawns.girl = { c, r };
      if (ch === "V") doors.push({ c, r, kind: "vault", who: "boy" });
      if (ch === "C") doors.push({ c, r, kind: "chamber", who: "girl" });
      if (ch === "$") pickups.push({ c, r, kind: "buck" });
      if (ch === "*") pickups.push({ c, r, kind: "gavel" });
      if (BARRIER_CHARS[ch]) masks[BARRIER_CHARS[ch]][r][c] = true;
      if (ch >= "1" && ch <= "4") plates.push({ c, r, group: +ch });
      if (ch >= "5" && ch <= "8") (gateMasks[+ch - 4] ??= blank(w, h))[r][c] = true;
    }
  });
  // Neighbouring pool tiles of one kind on one row become one pool.
  const merged = [];
  for (const p of pools) {
    const last = merged[merged.length - 1];
    if (last && last.kind === p.kind && last.r === p.r && last.c + last.len === p.c) last.len++;
    else merged.push({ ...p, len: 1 });
  }
  const barriers = Object.entries(masks).flatMap(([kind, m]) => mergeRects(m).map((rect) => ({ kind, ...rect })));
  const gates = Object.entries(gateMasks).flatMap(([group, m]) => mergeRects(m).map((rect) => ({ group: +group, ...rect })));
  return {
    w, h, solid, pools: merged, spawns, doors, pickups, plates, barriers, gates,
    solidRects: mergeRects(solid),
    isSolid: (c, r) => r >= 0 && r < h && c >= 0 && c < w && solid[r][c],
  };
}

function blank(w, h) { return Array.from({ length: h }, () => Array(w).fill(false)); }

/**
 * Cover the true cells of a mask with few rectangles: runs along each row, then runs with the
 * same span stacked into one. Fewer, bigger bodies mean no seams for a hero to catch on.
 * @returns {{c: number, r: number, w: number, h: number}[]} in tiles
 */
export function mergeRects(mask) {
  const open = new Map(); // "c,w" -> rect still growing downward
  const out = [];
  mask.forEach((row, r) => {
    const runs = [];
    let start = -1;
    row.concat(false).forEach((on, c) => {
      if (on && start < 0) start = c;
      if (!on && start >= 0) { runs.push([start, c - start]); start = -1; }
    });
    const next = new Map();
    for (const [c, w] of runs) {
      const key = `${c},${w}`;
      const rect = open.get(key);
      if (rect && rect.r + rect.h === r) { rect.h++; next.set(key, rect); open.delete(key); }
      else { const nr = { c, r, w, h: 1 }; out.push(nr); next.set(key, nr); }
    }
    open.clear();
    for (const [k, v] of next) open.set(k, v);
  });
  return out;
}

/** Rows of a level text file (blank lines and trailing spaces ignored). */
export const rowsOf = (text) => text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
