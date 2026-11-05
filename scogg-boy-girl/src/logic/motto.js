// Where the chamber's motto sign goes, from its two exit doors (bottom-center x, y and kind): a
// shared lintel across both when they stand side by side on one floor, else a lone sign between them.
import { MOTTO_SIGN } from "./config.js";

/**
 * @param {{x:number, y:number, kind:string}[]} doors
 * @param {Record<string, {w:number, h:number}>} sizes  each door kind's width and height
 * @returns {{x:number, y:number, w:number, h:number, spans:boolean} | null}  top-left rect in world units
 */
export function mottoRect(doors, sizes) {
  if (!doors.length) return null;
  const { h, pad, spanMax, soloW } = MOTTO_SIGN;
  const left = Math.min(...doors.map((d) => d.x - sizes[d.kind].w / 2)) - pad;
  const right = Math.max(...doors.map((d) => d.x + sizes[d.kind].w / 2)) + pad;
  const top = Math.min(...doors.map((d) => d.y - sizes[d.kind].h));   // sits on the taller door
  const spans = doors.every((d) => d.y === doors[0].y) && right - left <= spanMax;  // a shared lintel on one floor
  const w = spans ? right - left : soloW;
  return { x: (left + right) / 2 - w / 2, y: top - h, w, h, spans };
}

/** True when two top-left rects overlap. */
export function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
