// The face's flight: one fixed step of gravity, a flap, and the tilt. No DOM.
import { DT, FLAP_VY, GRAVITY, MAX_FALL, TILT_DOWN, TILT_EASE, TILT_FALL_FROM, TILT_FALL_FULL, TILT_UP } from "./config.ts";

export interface Body {
  y: number; // center, field units
  vy: number; // units/s, + is down
  angle: number; // radians, + is nose down
}

/** The tilt the face eases toward at a given vertical speed. */
export function targetTilt(vy: number): number {
  if (vy <= TILT_FALL_FROM) return TILT_UP;
  const t = Math.min(1, (vy - TILT_FALL_FROM) / (TILT_FALL_FULL - TILT_FALL_FROM));
  return TILT_UP + (TILT_DOWN - TILT_UP) * t;
}

/** Advance the face one step. A flap replaces the speed with a fixed upward kick (not added). */
export function stepBody(b: Body, flap: boolean): void {
  if (flap) {
    b.vy = FLAP_VY;
    b.angle = Math.min(b.angle, TILT_UP * 0.5); // snaps most of the way up at once
  }
  b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * DT);
  b.y += b.vy * DT;
  b.angle += (targetTilt(b.vy) - b.angle) * TILT_EASE;
}
