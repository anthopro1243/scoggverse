import { describe, expect, it } from "vitest";
import { CAP_H, CAP_OVERHANG, CEIL_Y, COL_W, FACE_X, FLOOR_Y } from "../../src/logic/config.ts";
import { columnRects, hitCircles, hitsCeiling, hitsColumn, hitsFloor } from "../../src/logic/collide.ts";
import { FACE_IDS, faceSize } from "../../src/logic/faces.ts";

const size = faceSize("a");
const col = { x: FACE_X - COL_W / 2, gapY: 300, gap: 168 }; // the face is right in the middle of it

describe("the face's hitbox", () => {
  it("stays inside the drawn face at every tilt, for every face", () => {
    for (const id of FACE_IDS) {
      const s = faceSize(id);
      for (let a = -0.5; a <= 1; a += 0.1) {
        for (const c of hitCircles(s, 0, 0, a)) {
          // into the face's own frame: every circle must sit inside the drawn ellipse
          const u = c.x * Math.cos(a) + c.y * Math.sin(a);
          const v = -c.x * Math.sin(a) + c.y * Math.cos(a);
          for (let t = 0; t < Math.PI * 2; t += Math.PI / 12) {
            const pu = u + c.r * Math.cos(t), pv = v + c.r * Math.sin(t);
            expect((pu / (s.w / 2)) ** 2 + (pv / (s.h / 2)) ** 2).toBeLessThan(1);
          }
        }
      }
    }
  });
  it("is a little smaller than the face: a near miss is a miss", () => {
    const top = col.gapY - col.gap / 2;
    // the drawn face overlaps the capital by 2 units, but the hitbox doesn't reach it
    const y = top + size.h / 2 - 2;
    expect(hitsColumn(hitCircles(size, FACE_X, y, 0), col)).toBe(false);
  });
  it("hits a capital it clearly touches", () => {
    const top = col.gapY - col.gap / 2;
    expect(hitsColumn(hitCircles(size, FACE_X, top + 4, 0), col)).toBe(true);
    const bottom = col.gapY + col.gap / 2;
    expect(hitsColumn(hitCircles(size, FACE_X, bottom - 4, 0), col)).toBe(true);
  });
  it("is safe in the middle of the gap and clear of a column ahead", () => {
    expect(hitsColumn(hitCircles(size, FACE_X, col.gapY, 0), col)).toBe(false);
    const ahead = { ...col, x: FACE_X + size.w / 2 + CAP_OVERHANG + 1, gapY: 600 };
    expect(hitsColumn(hitCircles(size, FACE_X, 200, 0), ahead)).toBe(false);
  });
  it("hits the shaft from the front", () => {
    const ahead = { ...col, x: FACE_X + 10, gapY: 600 };
    expect(hitsColumn(hitCircles(size, FACE_X, 400, 0), ahead)).toBe(true);
  });
});

describe("columns, floor and ceiling", () => {
  it("collide exactly where they're drawn: shafts plus the wider capitals", () => {
    const r = columnRects(col);
    expect(r[1]).toEqual({ x: col.x - CAP_OVERHANG, y: col.gapY - col.gap / 2 - CAP_H, w: COL_W + 2 * CAP_OVERHANG, h: CAP_H });
    expect(r[3].y + r[3].h).toBe(FLOOR_Y);
  });
  it("the floor and the ceiling end a run", () => {
    expect(hitsFloor(hitCircles(size, FACE_X, FLOOR_Y - 2, 0))).toBe(true);
    expect(hitsFloor(hitCircles(size, FACE_X, FLOOR_Y - 40, 0))).toBe(false);
    expect(hitsCeiling(hitCircles(size, FACE_X, CEIL_Y + 2, 0))).toBe(true);
    expect(hitsCeiling(hitCircles(size, FACE_X, CEIL_Y + 40, 0))).toBe(false);
  });
});
