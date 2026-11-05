// The Scoggins Archive at night, drawn in code once per screen size into offscreen canvases:
// a still sky with a moon, a far layer (the dome and the long wings), a mid layer (cypresses and a
// lamp-lit balustrade), the terrace floor, and a soft vignette. Each frame only copies them.
import { FLOOR_Y, H, W } from "../logic/config.ts";
import { createRng } from "../logic/rng.ts";
import { PAL } from "./palette.ts";

export interface Layer { canvas: HTMLCanvasElement; w: number; h: number }

export const TILE = W * 2; // the far and mid layers repeat every 810 units
export const FLOOR_TILE = 192; // two slabs
export const FLOOR_DEPTH = 420; // enough terrace to fill the bottom of a tall phone

/** A canvas sized in field units at k device pixels per unit, with its context scaled to match. */
export function makeLayer(w: number, h: number, k: number): [Layer, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(w * k));
  canvas.height = Math.max(1, Math.ceil(h * k));
  const ctx = canvas.getContext("2d")!;
  ctx.scale(k, k);
  return [{ canvas, w, h }, ctx];
}

export function drawSky(k: number): Layer {
  const [layer, c] = makeLayer(W, FLOOR_Y, k);
  const g = c.createLinearGradient(0, 0, 0, FLOOR_Y);
  g.addColorStop(0, PAL.skyTop);
  g.addColorStop(0.55, PAL.skyMid);
  g.addColorStop(1, PAL.skyLow);
  c.fillStyle = g;
  c.fillRect(0, 0, W, FLOOR_Y);
  const glow = c.createLinearGradient(0, 430, 0, FLOOR_Y);
  glow.addColorStop(0, "rgba(0,0,0,0)");
  glow.addColorStop(1, PAL.horizonGlow);
  c.fillStyle = glow;
  c.fillRect(0, 430, W, FLOOR_Y - 430);

  const rng = createRng("stars");
  for (let i = 0; i < 90; i++) {
    const x = rng.range(0, W);
    const y = rng.range(0, 430) ** 1.15 / 430 ** 0.15; // a few more near the top
    c.globalAlpha = rng.range(0.15, 0.75) * (1 - y / 520);
    c.fillStyle = PAL.star;
    c.beginPath();
    c.arc(x, y, rng.range(0.4, 1.25), 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;

  // the moon, high on the right, with a faint halo and two soft maria
  const mx = 344, my = 50;
  const halo = c.createRadialGradient(mx, my, 18, mx, my, 90);
  halo.addColorStop(0, PAL.moonGlow);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = halo;
  c.fillRect(mx - 90, my - 90, 180, 180);
  c.fillStyle = PAL.moon;
  c.beginPath();
  c.arc(mx, my, 16, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(150, 146, 132, 0.35)";
  c.beginPath(); c.arc(mx - 6, my - 4, 6, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(mx + 5, my + 7, 4, 0, Math.PI * 2); c.fill();
  return layer;
}

function litEdge(c: CanvasRenderingContext2D, x: number, y: number, w: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, 1.2);
}

export function drawFar(k: number): Layer {
  const [layer, c] = makeLayer(TILE, FLOOR_Y, k);
  const base = 486;
  // the long wings of the Archive, all the way across
  c.fillStyle = PAL.farStone;
  c.fillRect(0, base, TILE, FLOOR_Y - base);
  litEdge(c, 0, base, TILE, PAL.farLit);
  c.fillStyle = PAL.farTrim;
  c.fillRect(0, base + 6, TILE, 1);
  const rng = createRng("windows");
  for (let x = 9; x < TILE - 6; x += 22) {
    const lit = rng.next() < 0.22;
    c.fillStyle = lit ? PAL.window : "rgba(4, 6, 12, 0.55)";
    c.beginPath();
    c.moveTo(x, base + 40);
    c.lineTo(x, base + 22);
    c.arc(x + 3, base + 22, 3, Math.PI, 0);
    c.lineTo(x + 6, base + 40);
    c.closePath();
    c.fill();
  }

  // the dome, far off
  const dx = 236;
  c.fillStyle = PAL.farStone;
  c.fillRect(dx - 92, base - 34, 184, 34); // a raised hall under it
  litEdge(c, dx - 92, base - 34, 184, PAL.farLit);
  c.fillRect(dx - 58, base - 84, 116, 52); // the drum
  litEdge(c, dx - 58, base - 84, 116, PAL.farLit);
  c.fillStyle = PAL.farLit;
  for (let x = dx - 52; x <= dx + 52; x += 9) c.fillRect(x, base - 78, 2, 40); // drum columns
  c.fillStyle = PAL.farTrim;
  c.fillRect(dx - 60, base - 86, 120, 2);
  c.fillStyle = PAL.farStone;
  c.beginPath();
  c.ellipse(dx, base - 86, 56, 50, 0, Math.PI, 0);
  c.fill();
  c.strokeStyle = PAL.farLit; // ribs, lit a little more on the moon's side
  c.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    c.globalAlpha = 0.35 + Math.max(0, i) * 0.15;
    c.beginPath();
    c.ellipse(dx, base - 86, Math.abs(i) * 15 + 0.01, 50, 0, i < 0 ? Math.PI : -Math.PI / 2, i < 0 ? Math.PI * 1.5 : 0);
    c.stroke();
  }
  c.globalAlpha = 1;
  c.fillStyle = PAL.farStone;
  c.fillRect(dx - 7, base - 152, 14, 18); // lantern
  c.beginPath();
  c.ellipse(dx, base - 152, 8, 7, 0, Math.PI, 0);
  c.fill();
  c.fillStyle = PAL.window;
  c.fillRect(dx - 3, base - 148, 6, 10);
  c.fillStyle = PAL.farTrim;
  c.fillRect(dx - 1, base - 168, 2, 9);

  // a portico with a pediment, further along
  const px = 610;
  c.fillStyle = PAL.farStone;
  c.beginPath();
  c.moveTo(px - 76, base - 46);
  c.lineTo(px, base - 78);
  c.lineTo(px + 76, base - 46);
  c.closePath();
  c.fill();
  c.strokeStyle = PAL.farLit;
  c.beginPath(); c.moveTo(px - 76, base - 46); c.lineTo(px, base - 78); c.lineTo(px + 76, base - 46); c.stroke();
  c.fillRect(px - 76, base - 46, 152, 6);
  c.fillStyle = PAL.farLit;
  for (let x = px - 68; x <= px + 66; x += 17) c.fillRect(x, base - 40, 4, 40);
  return layer;
}

export function drawMid(k: number): Layer {
  const [layer, c] = makeLayer(TILE, FLOOR_Y, k);
  // cypresses behind the balustrade
  for (const [x, h] of [[54, 150], [96, 118], [318, 168], [702, 140], [744, 112]]) {
    c.fillStyle = "#090c13";
    c.beginPath();
    c.ellipse(x, FLOOR_Y - 50 - h / 2, 15, h / 2, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(60, 74, 96, 0.35)";
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(x, FLOOR_Y - 50 - h / 2, 15, h / 2, 0, -Math.PI / 2, 0.2);
    c.stroke();
  }
  // lamp glow (under the stone, so the rail catches it)
  const lamps = [196, 601];
  for (const x of lamps) {
    const g = c.createRadialGradient(x, 516, 4, x, 516, 90);
    const [r, gg, b] = PAL.lampGlow;
    g.addColorStop(0, `rgba(${r},${gg},${b},0.22)`);
    g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    c.fillStyle = g;
    c.fillRect(x - 90, 426, 180, 180);
  }
  // the balustrade: top rail, vase-shaped balusters, bottom rail
  const rail = 584;
  c.fillStyle = PAL.midStone;
  c.fillRect(0, rail, TILE, 7);
  litEdge(c, 0, rail, TILE, PAL.midLit);
  for (let x = 5; x < TILE; x += 13.5) {
    c.beginPath();
    c.moveTo(x - 2, rail + 7);
    c.quadraticCurveTo(x - 6, rail + 26, x - 2.5, rail + 40);
    c.lineTo(x + 2.5, rail + 40);
    c.quadraticCurveTo(x + 6, rail + 26, x + 2, rail + 7);
    c.closePath();
    c.fill();
  }
  c.fillRect(0, rail + 40, TILE, FLOOR_Y - rail - 40);
  litEdge(c, 0, rail + 40, TILE, "rgba(38, 45, 58, 0.8)");
  // pedestals with bronze lamps
  for (const x of lamps) {
    c.fillStyle = PAL.midStone;
    c.fillRect(x - 13, rail - 22, 26, FLOOR_Y - rail + 22);
    litEdge(c, x - 13, rail - 22, 26, PAL.midLit);
    c.fillRect(x - 15, rail - 24, 30, 4);
    c.fillStyle = PAL.midTrim;
    c.fillRect(x - 1.5, 522, 3, rail - 24 - 522);
    c.fillRect(x - 6, 520, 12, 3);
    c.fillStyle = PAL.lamp;
    c.globalAlpha = 0.9;
    c.beginPath();
    c.moveTo(x - 5, 520); c.lineTo(x - 4, 506); c.lineTo(x + 4, 506); c.lineTo(x + 5, 520);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
    c.fillStyle = PAL.midTrim;
    c.beginPath();
    c.moveTo(x - 6, 506); c.lineTo(x, 499); c.lineTo(x + 6, 506);
    c.closePath();
    c.fill();
  }
  return layer;
}

export function drawFloor(k: number): Layer {
  const [layer, c] = makeLayer(FLOOR_TILE, FLOOR_DEPTH, k);
  c.fillStyle = PAL.floor;
  c.fillRect(0, 0, FLOOR_TILE, FLOOR_DEPTH);
  // slab courses, staggered, a little darker the further down the terrace face
  const courses = [6, 52, 104, 160, 220, 284, 352, FLOOR_DEPTH];
  for (let i = 0; i < courses.length - 1; i++) {
    const y0 = courses[i], y1 = courses[i + 1];
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, PAL.floorLit);
    g.addColorStop(1, PAL.floor);
    c.fillStyle = g;
    c.fillRect(0, y0, FLOOR_TILE, y1 - y0);
    c.fillStyle = PAL.floorJoint;
    c.fillRect(0, y1 - 1.5, FLOOR_TILE, 1.5);
    const off = i % 2 ? 48 : 0;
    for (let x = off; x < FLOOR_TILE + 1; x += 96) c.fillRect(x - 0.75, y0, 1.5, y1 - y0);
    c.fillStyle = "rgba(0,0,0,0.12)";
    c.fillRect(0, y0, FLOOR_TILE, 1); // a soft shadow under each joint
    c.globalAlpha = 1;
  }
  const rng = createRng("veins");
  c.strokeStyle = PAL.floorVein;
  c.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = rng.range(10, FLOOR_TILE - 40);
    let y = rng.range(14, 300);
    c.beginPath();
    c.moveTo(x, y);
    for (let s = 0; s < 4; s++) { x += rng.range(6, 14); y += rng.range(-5, 7); c.lineTo(x, y); }
    c.stroke();
  }
  // the bronze edge along the top of the terrace
  const g = c.createLinearGradient(0, 0, 0, 6);
  g.addColorStop(0, "#e9bd72");
  g.addColorStop(0.3, PAL.floorTop);
  g.addColorStop(1, PAL.floorTrim);
  c.fillStyle = g;
  c.fillRect(0, 0, FLOOR_TILE, 6);
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.fillRect(0, 6, FLOOR_TILE, 3);
  return layer;
}

export function drawVignette(k: number): Layer {
  const [layer, c] = makeLayer(W, H, Math.min(k, 1)); // soft, so low resolution is fine
  const g = c.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.45, H * 0.78);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.42)");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  return layer;
}

/** Copy a repeating layer across the field, scrolled by `offset` units. */
export function blitRepeat(ctx: CanvasRenderingContext2D, layer: Layer, offset: number, y: number, viewW = W): void {
  let x = -(((offset % layer.w) + layer.w) % layer.w);
  for (; x < viewW; x += layer.w) ctx.drawImage(layer.canvas, x, y, layer.w, layer.h);
}
