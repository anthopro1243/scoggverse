// Fluted marble columns with bronze capitals at the gap, and now and then an all-bronze one with
// a faint "$" engraved on it. Shafts and capitals are drawn once per screen size; each frame
// copies the part of the shaft it needs. The drawn shapes match the hit rectangles exactly
// (logic/collide.ts columnRects): what you see is what you hit.
import { CAP_H, CAP_OVERHANG, COL_W, FLOOR_Y } from "../logic/config.ts";
import type { Column } from "../logic/columns.ts";
import { PAL, SERIF } from "./palette.ts";
import { makeLayer, type Layer } from "./scenery.ts";

const SHAFT_H = 760;
const DOLLAR_FROM_CAP = 58; // the engraving sits this far from the capital

export interface PillarArt { shaft: Layer; bronzeShaft: Layer; cap: Layer; dollar: Layer }

function shaftGradient(c: CanvasRenderingContext2D, stops: readonly string[]): CanvasGradient {
  const g = c.createLinearGradient(0, 0, COL_W, 0);
  stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
  return g;
}

function drawShaft(k: number, bronze: boolean): Layer {
  const [layer, c] = makeLayer(COL_W, SHAFT_H, k);
  // the light comes from the moon, up and to the right: the lit band sits right of center
  c.fillStyle = shaftGradient(c, bronze ? PAL.bronze : PAL.marble);
  c.fillRect(0, 0, COL_W, SHAFT_H);
  // flutes: shallow grooves with a lit lip, spaced so they bunch toward the edges like a cylinder
  const flutes = 9;
  for (let i = 1; i < flutes; i++) {
    const t = i / flutes;
    const x = COL_W * (0.5 - Math.cos(t * Math.PI) / 2);
    const w = 2.6 * Math.sin(t * Math.PI) + 0.6;
    c.fillStyle = PAL.flute;
    c.fillRect(x - w / 2, 0, w, SHAFT_H);
    c.fillStyle = PAL.fluteLit;
    c.fillRect(x + w / 2, 0, 0.8, SHAFT_H);
  }
  if (!bronze) {
    c.strokeStyle = PAL.vein;
    c.lineWidth = 1;
    for (let y = 40; y < SHAFT_H; y += 170) {
      c.beginPath();
      c.moveTo(6, y);
      c.bezierCurveTo(24, y + 30, 40, y + 18, COL_W - 6, y + 64);
      c.stroke();
    }
    c.fillStyle = PAL.night;
    c.fillRect(0, 0, COL_W, SHAFT_H);
  } else {
    c.fillStyle = "rgba(10, 6, 2, 0.18)";
    c.fillRect(0, 0, COL_W, SHAFT_H);
  }
  // dark edges so the column reads against the sky
  c.fillStyle = PAL.outline;
  c.fillRect(0, 0, 1.2, SHAFT_H);
  c.fillRect(COL_W - 1.2, 0, 1.2, SHAFT_H);
  return layer;
}

/** The capital as it sits on a bottom column: abacus slab at the gap edge, then echinus, then a ring. */
function drawCap(k: number): Layer {
  const cw = COL_W + 2 * CAP_OVERHANG;
  const [layer, c] = makeLayer(cw, CAP_H, k);
  const g = c.createLinearGradient(0, 0, cw, 0);
  PAL.bronze.forEach((s, i) => g.addColorStop(i / (PAL.bronze.length - 1), s));
  c.fillStyle = g;
  // abacus
  c.fillRect(0, 0, cw, 7);
  // echinus: curves in from the slab to just wider than the shaft
  c.beginPath();
  c.moveTo(1, 7);
  c.quadraticCurveTo(CAP_OVERHANG - 2, 14, CAP_OVERHANG - 1, 15);
  c.lineTo(cw - CAP_OVERHANG + 1, 15);
  c.quadraticCurveTo(cw - CAP_OVERHANG + 2, 14, cw - 1, 7);
  c.closePath();
  c.fill();
  // astragal ring on top of the shaft
  c.fillRect(CAP_OVERHANG - 1, 15, COL_W + 2, CAP_H - 15);
  c.fillStyle = PAL.bronzeShine;
  c.fillRect(0, 0, cw, 1);
  c.fillRect(CAP_OVERHANG - 1, 16, COL_W + 2, 0.8);
  c.fillStyle = PAL.bronzeLine;
  c.fillRect(0, 6.2, cw, 1);
  c.fillRect(CAP_OVERHANG - 1, 15, COL_W + 2, 0.8);
  c.fillRect(CAP_OVERHANG - 1, CAP_H - 1, COL_W + 2, 1);
  c.strokeStyle = PAL.outline;
  c.lineWidth = 1;
  c.strokeRect(0.5, 0.5, cw - 1, 6);
  return layer;
}

function drawDollar(k: number): Layer {
  const [layer, c] = makeLayer(40, 46, k);
  c.font = `700 34px ${SERIF}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = PAL.engraveLit; // light catches the lower lip of the cut
  c.fillText("$", 20.8, 24.8);
  c.fillStyle = PAL.engrave;
  c.fillText("$", 20, 24);
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
