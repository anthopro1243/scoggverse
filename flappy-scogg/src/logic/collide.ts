// Hitboxes and collisions. The face's hitbox is an ellipse a little smaller than the drawn face,
// turned with it, checked as a chain of circles; columns are the rectangles you can see.
import { CAP_H, CAP_OVERHANG, CEIL_Y, COL_W, FLOOR_Y, HIT_CIRCLES, HIT_RX, HIT_RY } from "./config.ts";
import type { FaceSize } from "./faces.ts";

export interface Circle { x: number; y: number; r: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface ColumnShape { x: number; gapY: number; gap: number }

/** Circles that fill the hitbox ellipse of a face at (x, y) tilted by angle. */
export function hitCircles(size: FaceSize, x: number, y: number, angle: number): Circle[] {
  const rx = size.w * HIT_RX;
  const ry = size.h * HIT_RY;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const out: Circle[] = [];
  const n: number = HIT_CIRCLES;
  const reach = Math.max(0, rx - ry * 0.6);
  for (let i = 0; i < n; i++) {
    const d = n === 1 ? 0 : -reach + (2 * reach * i) / (n - 1);
    const r = ry * Math.sqrt(Math.max(0, 1 - (d / rx) ** 2));
    out.push({ x: x + d * cos, y: y + d * sin, r });
  }
  return out;
}

export function circleHitsRect(c: Circle, r: Rect): boolean {
  const nx = Math.max(r.x, Math.min(c.x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(c.y, r.y + r.h));
  return (c.x - nx) ** 2 + (c.y - ny) ** 2 < c.r * c.r;
}

/** The solid parts of a column pair: two shafts and the two bronze capitals at the gap. */
export function columnRects(col: ColumnShape): Rect[] {
  const top = col.gapY - col.gap / 2;
  const bottom = col.gapY + col.gap / 2;
  return [
    { x: col.x, y: CEIL_Y - 400, w: COL_W, h: top - (CEIL_Y - 400) },
    { x: col.x - CAP_OVERHANG, y: top - CAP_H, w: COL_W + 2 * CAP_OVERHANG, h: CAP_H },
    { x: col.x - CAP_OVERHANG, y: bottom, w: COL_W + 2 * CAP_OVERHANG, h: CAP_H },
    { x: col.x, y: bottom, w: COL_W, h: FLOOR_Y - bottom },
  ];
}

export function hitsColumn(circles: Circle[], col: ColumnShape): boolean {
  const rects = columnRects(col);
  return circles.some((c) => rects.some((r) => circleHitsRect(c, r)));
}

export function hitsFloor(circles: Circle[]): boolean {
  return circles.some((c) => c.y + c.r >= FLOOR_Y);
}

export function hitsCeiling(circles: Circle[]): boolean {
  return circles.some((c) => c.y - c.r <= CEIL_Y);
}
