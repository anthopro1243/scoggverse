import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FACE_H, FACE_MAX_W } from "../../src/logic/config.ts";
import { FACE_IDS, FACE_PNG, faceSize } from "../../src/logic/faces.ts";

const pngSize = (id: string) => {
  const b = readFileSync(new URL(`../../assets/faces/face-${id}.png`, import.meta.url));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), b };
};

describe("the face candidates", () => {
  it("match the PNGs cut from the deck", () => {
    for (const id of FACE_IDS) {
      const { w, h } = pngSize(id);
      expect({ w, h }).toEqual(FACE_PNG[id]);
    }
  });
  it("are only ever scaled evenly, never stretched by us", () => {
    for (const id of FACE_IDS) {
      const s = faceSize(id);
      expect(s.w / s.h).toBeCloseTo(FACE_PNG[id].w / FACE_PNG[id].h, 10);
      expect(s.h).toBeLessThanOrEqual(FACE_H + 1e-9);
      expect(s.w).toBeLessThanOrEqual(FACE_MAX_W + 1e-9);
    }
  });
  it("carry no text metadata (no tEXt, iTXt, zTXt or eXIf chunks)", () => {
    for (const id of FACE_IDS) {
      const { b } = pngSize(id);
      for (const chunk of ["tEXt", "iTXt", "zTXt", "eXIf"]) expect(b.includes(Buffer.from(chunk))).toBe(false);
    }
  });
});
