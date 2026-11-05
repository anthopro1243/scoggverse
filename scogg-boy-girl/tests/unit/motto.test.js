import { describe, it, expect } from "vitest";
import { mottoRect, overlaps } from "../../src/logic/motto.js";
import { MOTTO_SIGN } from "../../src/logic/config.js";

const SIZES = { vault: { w: 96, h: 91 }, chamber: { w: 92, h: 91 } };

describe("the motto sign", () => {
  it("spans both doors side by side on one floor, sitting on their tops", () => {
    const r = mottoRect([{ x: 705, y: 300, kind: "vault" }, { x: 855, y: 300, kind: "chamber" }], SIZES);
    expect(r.spans).toBe(true);
    expect(r.x).toBe(705 - 48 - MOTTO_SIGN.pad);
    expect(r.x + r.w).toBe(855 + 46 + MOTTO_SIGN.pad);
    expect(r.y + r.h).toBe(300 - 91);
  });
  it("hangs alone halfway between doors far apart or on different floors", () => {
    for (const doors of [
      [{ x: 105, y: 270, kind: "vault" }, { x: 855, y: 270, kind: "chamber" }],
      [{ x: 855, y: 240, kind: "vault" }, { x: 555, y: 360, kind: "chamber" }],
    ]) {
      const r = mottoRect(doors, SIZES);
      expect(r.spans).toBe(false);
      expect(r.w).toBe(MOTTO_SIGN.soloW);
      expect(Math.abs(r.x + r.w / 2 - (doors[0].x + doors[1].x) / 2)).toBeLessThan(3);
      expect(r.y + r.h).toBe(Math.min(...doors.map((d) => d.y)) - 91);
    }
  });
  it("is left out when there are no doors", () => expect(mottoRect([], SIZES)).toBeNull());
  it("overlap is strict: touching edges don't count", () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 })).toBe(true);
  });
});
