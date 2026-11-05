// The backdrop, from Kenney's "Pixel Platformer" tiles (CC0), drawn once per screen size into
// offscreen canvases: a daytime sky, a far band of hills, pine trees in the middle distance, and the
// grass-topped ground. Each frame only copies them.
import { FLOOR_Y, H, W } from "../logic/config.ts";
import { createRng } from "../logic/rng.ts";
import { drawTile } from "./kenney.ts";

export interface Layer { canvas: HTMLCanvasElement; w: number; h: number }

export const TILE = W * 2; // the far and mid layers repeat every 810 units
export const FLOOR_TILE = 192; // six ground tiles
export const FLOOR_DEPTH = 420; // enough ground to fill the bottom of a tall phone
const BG = 45; // one background tile (810 / 18)
const GROUND = 32; // one ground tile (192 / 6)

/** A canvas sized in field units at k device pixels per unit, with its context scaled to match. */
export function makeLayer(w: number, h: number, k: number): [Layer, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(w * k));
  canvas.height = Math.max(1, Math.ceil(h * k));
  const ctx = canvas.getContext("2d")!;
  ctx.scale(k, k);
  return [{ canvas, w, h }, ctx];
}

/** Plain sky (Kenney background tile 0), with a hair of overlap so no seams show. */
export function drawSky(k: number): Layer {
  const [layer, c] = makeLayer(W, FLOOR_Y, k);
  for (let y = 0; y < FLOOR_Y; y += BG) for (let x = 0; x < W; x += BG) drawTile(c, 0, x, y, BG + 0.5, BG + 0.5, "bg");
  return layer;
}

/** A band of cloud-and-hill tiles just above the ground, the paler hill color under it. */
export function drawFar(k: number): Layer {
  const [layer, c] = makeLayer(TILE, FLOOR_Y, k);
  const rng = createRng("far");
  const band = FLOOR_Y - BG * 3;
  for (let x = 0; x < TILE; x += BG) {
    drawTile(c, rng.int(8, 11), x, band, BG + 0.5, BG + 0.5, "bg");
    for (let y = band + BG; y < FLOOR_Y; y += BG) drawTile(c, 16, x, y, BG + 0.5, BG + 0.5, "bg");
  }
  return layer;
}

/** Pine trees and bushes standing on the ground, spaced at random (the same every time). */
export function drawMid(k: number): Layer {
  const [layer, c] = makeLayer(TILE, FLOOR_Y, k);
  const rng = createRng("mid");
  for (let x = 10; x < TILE - 40; x += rng.range(70, 160)) {
    const tall = rng.next() < 0.6;
    const s = tall ? 40 : 28;
    drawTile(c, tall ? 126 : 125, x, FLOOR_Y - s + 2, s, s);
  }
  return layer;
}

/** The ground: a row of grass-topped tiles, then plain dirt down past the bottom of a tall phone. */
export function drawFloor(k: number): Layer {
  const [layer, c] = makeLayer(FLOOR_TILE, FLOOR_DEPTH, k);
  for (let x = 0; x < FLOOR_TILE; x += GROUND) {
    drawTile(c, 22, x, 0, GROUND + 0.3, GROUND + 0.3);
    for (let y = GROUND; y < FLOOR_DEPTH; y += GROUND) drawTile(c, 122, x, y, GROUND + 0.3, GROUND + 0.3);
  }
  return layer;
}

/** No vignette in daylight: an empty layer, kept so the renderer stays the same. */
export function drawVignette(k: number): Layer {
  return makeLayer(W, H, Math.min(k, 1))[0];
}

/** Copy a repeating layer across the field, scrolled by `offset` units. */
export function blitRepeat(ctx: CanvasRenderingContext2D, layer: Layer, offset: number, y: number, viewW = W): void {
  let x = -(((offset % layer.w) + layer.w) % layer.w);
  for (; x < viewW; x += layer.w) ctx.drawImage(layer.canvas, x, y, layer.w, layer.h);
}
