// Kenney's "Pixel Platformer" (CC0, kenney.nl): 18 px tiles in a 20 x 9 sheet and 24 px background
// tiles in an 8 x 3 sheet. Each sheet is blown up 5x nearest-neighbour once, so drawing a tile at any
// size afterwards stays sharp. main.ts loads the two images and calls initKenney before the first frame.
const UP = 5;
const SIZE = { tiles: 18, bg: 24 } as const;
const COLS = { tiles: 20, bg: 8 } as const;
type Sheet = keyof typeof SIZE;

const sheets: Partial<Record<Sheet, HTMLCanvasElement>> = {};

export function initKenney(tiles: HTMLImageElement, bg: HTMLImageElement): void {
  sheets.tiles = upscale(tiles);
  sheets.bg = upscale(bg);
}

function upscale(img: HTMLImageElement): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth * UP;
  cv.height = img.naturalHeight * UP;
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  return cv;
}

/** Draw tile `id` at (x, y), w x h units. Before initKenney (unit tests) it draws nothing. */
export function drawTile(c: CanvasRenderingContext2D, id: number, x: number, y: number, w: number, h = w, sheet: Sheet = "tiles"): void {
  const src = sheets[sheet];
  if (!src) return;
  const s = SIZE[sheet] * UP;
  const cols = COLS[sheet];
  c.imageSmoothingEnabled = true;
  // inset by a fifth of a source pixel, so smoothing never picks up the next tile in the sheet
  c.drawImage(src, (id % cols) * s + 1, Math.floor(id / cols) * s + 1, s - 2, s - 2, x, y, w, h);
}

/** Kenney's outline, wood and plain sky colors, for the few shapes drawn by hand to match the tiles. */
export const KP = { outline: "#434a5f", woodDark: "#6f3e43", wood: "#9f5a52", woodLit: "#cb815e", sand: "#f4ac66", white: "#ffffff", slate: "#2b2d3c", gold: "#f4b41b", goldLit: "#fee481", sky: "#dff6f5" };
