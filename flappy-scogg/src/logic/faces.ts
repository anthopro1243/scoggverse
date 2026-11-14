// The three face candidates cut from p. 40 of the class deck (scripts/make_faces.py).
// Sizes are the PNGs' pixel sizes; tests/unit/faces.test.ts checks they still match the files.
import { FACE_H, FACE_MAX_W } from "./config.ts";

export type FaceId = "a" | "b" | "c";
export const FACE_IDS: readonly FaceId[] = ["a", "b", "c"];
export const DEFAULT_FACE: FaceId = "a"; // the face the game ships

export const FACE_PNG: Record<FaceId, { w: number; h: number }> = {
  a: { w: 166, h: 72 },
  b: { w: 231, h: 93 },
  c: { w: 231, h: 65 },
};

export interface FaceSize { w: number; h: number; scale: number }

/** Drawn size in field units. Always one scale for both axes: the face is never stretched by us. */
export function faceSize(id: FaceId): FaceSize {
  const { w, h } = FACE_PNG[id];
  const scale = Math.min(FACE_H / h, FACE_MAX_W / w);
  return { w: w * scale, h: h * scale, scale };
}

export function isFaceId(v: unknown): v is FaceId {
  return v === "a" || v === "b" || v === "c";
}
