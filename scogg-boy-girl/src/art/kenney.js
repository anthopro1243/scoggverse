// Kenney's "Pixel Platformer" (CC0, kenney.nl): 18 px tiles in a 20 x 9 sheet and 24 px background
// tiles in an 8 x 3 sheet. Each sheet is blown up 5x nearest-neighbour once, so drawing a tile at any
// size afterwards stays sharp. Swapping a few exact colors makes the lava, Recession slime and the
// blue flag; nothing is redrawn.
// The two sheets are loaded by Boot as "kenney-tiles" and "kenney-bg".
const UP = 5;
const SIZE = { tiles: 18, bg: 24 };
const COLS = { tiles: 20, bg: 8 };

// exact color swaps (from -> to)
const SWAPS = {
  inflation: { "2cc5f6": "f4682c", "4ce5fd": "ffd34d" },   // water -> Inflation lava
  recession: { "2cc5f6": "5ac54f", "4ce5fd": "99e65f" },   // water -> Recession slime
  blue: { fc683b: "2cc5f6", dd442c: "1a8fd0", "7e3125": "1b4f8a" }, // red flag -> Scogg Girl's blue
};

const sheets = {};

/** Call once after the two sheets are loaded (Boot). */
export function initKenney(scene) {
  sheets.tiles = upscale(scene.textures.get("kenney-tiles").getSourceImage());
  sheets.bg = upscale(scene.textures.get("kenney-bg").getSourceImage());
  for (const [name, swap] of Object.entries(SWAPS)) sheets[name] = recolor(sheets.tiles, swap);
}

function upscale(img) {
  const cv = document.createElement("canvas");
  cv.width = img.width * UP; cv.height = img.height * UP;
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  return cv;
}

function recolor(src, swap) {
  const cv = document.createElement("canvas");
  cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext("2d");
  ctx.drawImage(src, 0, 0);
  const data = ctx.getImageData(0, 0, cv.width, cv.height);
  const map = new Map(Object.entries(swap).map(([a, b]) => [parseInt(a, 16), parseInt(b, 16)]));
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const to = map.get((px[i] << 16) | (px[i + 1] << 8) | px[i + 2]);
    if (to !== undefined) { px[i] = to >> 16; px[i + 1] = (to >> 8) & 255; px[i + 2] = to & 255; }
  }
  ctx.putImageData(data, 0, 0);
  return cv;
}

/**
 * Draw tile `id` into a Canvas 2D context at (x, y), w x h world units.
 * @param {"tiles"|"bg"|"inflation"|"recession"|"blue"} sheet
 */
export function drawTile(ctx, id, x, y, w, h = w, sheet = "tiles") {
  const kind = sheet === "bg" ? "bg" : "tiles";
  const s = SIZE[kind] * UP, cols = COLS[kind];
  ctx.imageSmoothingEnabled = true;
  // inset by a fifth of a source pixel, so smoothing never picks up the next tile in the sheet
  ctx.drawImage(sheets[sheet], (id % cols) * s + 1, Math.floor(id / cols) * s + 1, s - 2, s - 2, x, y, w, h);
}

/** A canvas of tiles laid out on a grid: rows of tile ids (null = empty), each cell `cell` units, at `res` px per unit. */
export function tileCanvas(rows, cell, res, sheet = "tiles") {
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(rows[0].length * cell * res); cv.height = Math.ceil(rows.length * cell * res);
  const ctx = cv.getContext("2d");
  ctx.scale(res, res);
  rows.forEach((row, r) => row.forEach((id, c) => { if (id !== null) drawTile(ctx, id, c * cell, r * cell, cell, cell, sheet); }));
  return cv;
}

/** Kenney's dark outline and wood colors, for the few things drawn by hand to match the tiles. */
export const KP = { outline: "#434a5f", woodDark: "#6f3e43", wood: "#9f5a52", woodLit: "#cb815e", sand: "#f4ac66", white: "#ffffff", grey: "#dce1e7", gold: "#f4b41b", goldLit: "#fee481", sky: "#2cc5f6" };
