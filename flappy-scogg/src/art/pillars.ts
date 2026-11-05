// Columns stacked from Kenney "Pixel Platformer" blocks (CC0) with a wooden plank cap at the gap,
// and now and then a gold one with a coin on it. Shafts and caps are drawn once per screen size; each
// frame copies the part of the shaft it needs. The drawn shapes match the hit rectangles exactly
// (logic/collide.ts columnRects): what you see is what you hit.
import { CAP_H, CAP_OVERHANG, COL_W, FLOOR_Y } from "../logic/config.ts";
import type { Column } from "../logic/columns.ts";
import { drawTile, KP } from "./kenney.ts";
import { makeLayer, type Layer } from "./scenery.ts";

const SHAFT_H = 760;
const DOLLAR_FROM_CAP = 58; // the coin sits this far from the cap

export interface PillarArt { shaft: Layer; bronzeShaft: Layer; cap: Layer; dollar: Layer }

/** A shaft of square blocks, COL_W across: Kenney's framed brown block, or its gold one. */
function drawShaft(k: number, gold: boolean): Layer {
  const [layer, c] = makeLayer(COL_W, SHAFT_H, k);
  for (let y = 0; y < SHAFT_H; y += COL_W) drawTile(c, gold ? 9 : 6, 0, y, COL_W, COL_W + 0.3);
  return layer;
}

/** The cap as it sits on a bottom column: a wooden plank across the gap edge, the full hit rectangle. */
function drawCap(k: number): Layer {
  const cw = COL_W + 2 * CAP_OVERHANG;
  const [layer, c] = makeLayer(cw, CAP_H, k);
  c.fillStyle = KP.outline;
  c.fillRect(0, 0, cw, CAP_H);
  c.fillStyle = KP.woodLit;
  c.fillRect(2, 2, cw - 4, CAP_H - 4);
  c.fillStyle = KP.sand;
  c.fillRect(2, 2, cw - 4, 3);
  c.fillStyle = KP.wood;
  c.fillRect(2, CAP_H - 6, cw - 4, 4);
  c.fillStyle = KP.woodDark;
  for (const nx of [6, cw - 9]) c.fillRect(nx, 8, 3, 3);
  return layer;
}

/** Kenney's coin, on the gold columns. */
function drawDollar(k: number): Layer {
  const [layer, c] = makeLayer(40, 46, k);
  drawTile(c, 151, 2, 5, 36);
  return layer;
}

export function drawPillarArt(k: number): PillarArt {
  return { shaft: drawShaft(k, false), bronzeShaft: drawShaft(k, true), cap: drawCap(k), dollar: drawDollar(k) };
}

/** Draw one column pair in field units. */
export function drawColumn(ctx: CanvasRenderingContext2D, art: PillarArt, col: Column): void {
  const x = col.x;
  const top = col.gapY - col.gap / 2;
  const bottom = col.gapY + col.gap / 2;
  const shaft = col.bronze ? art.bronzeShaft : art.shaft;
  const sk = shaft.canvas.height / shaft.h; // device pixels per unit in the shaft canvas
  // top column: from above the field down to its capital
  const topLen = Math.max(0, top - CAP_H + 2);
  ctx.drawImage(shaft.canvas, 0, 0, shaft.canvas.width, Math.min(shaft.canvas.height, topLen * sk), x, top - CAP_H + 2 - topLen, COL_W, topLen);
  // bottom column: from its capital down into the terrace
  const botLen = FLOOR_Y - bottom - CAP_H + 2;
  ctx.drawImage(shaft.canvas, 0, 0, shaft.canvas.width, Math.min(shaft.canvas.height, botLen * sk), x, bottom + CAP_H - 2, COL_W, botLen);
  if (col.bronze) {
    const d = art.dollar;
    ctx.drawImage(d.canvas, x + COL_W / 2 - d.w / 2, top - CAP_H - DOLLAR_FROM_CAP - d.h / 2, d.w, d.h);
    ctx.drawImage(d.canvas, x + COL_W / 2 - d.w / 2, bottom + CAP_H + DOLLAR_FROM_CAP - d.h / 2, d.w, d.h);
  }
  // capitals: the bottom one as drawn, the top one flipped so its slab meets the gap
  const cap = art.cap;
  ctx.drawImage(cap.canvas, x - CAP_OVERHANG, bottom, cap.w, cap.h);
  ctx.save();
  ctx.translate(0, top);
  ctx.scale(1, -1);
  ctx.drawImage(cap.canvas, x - CAP_OVERHANG, 0, cap.w, cap.h);
  ctx.restore();
}
