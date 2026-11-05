import { describe, it, expect } from "vitest";
import { computePose, POSE_KINDS, DEATH, headCenterY, GEO, FACE_RY } from "../../src/art/poses.js";

const times = Array.from({ length: 121 }, (_, i) => i / 60);

describe("hero poses", () => {
  it("every pose gives finite numbers at every time, for both facings", () => {
    for (const kind of POSE_KINDS) for (const facing of [1, -1]) for (const t of times) {
      const p = computePose(kind, t, { facing });
      for (const v of [p.rootRot, p.rootDX, p.rootDY, p.sx, p.sy, ...p.legs, ...p.arms, p.headRot, p.headDY, p.sway, p.glow, p.collapse, p.burst, p.bodyAlpha]) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
  it("has no way to scale, fade or tint the face: squash, stretch and fading are for the body only", () => {
    for (const kind of POSE_KINDS) {
      const keys = Object.keys(computePose(kind, 0.3));
      expect(keys.some((k) => /head.*(scale|alpha|tint)|face(?!Shown)/i.test(k))).toBe(false);
    }
  });
  it("squash and stretch stays gentle while alive (within 20%)", () => {
    for (const kind of POSE_KINDS.filter((k) => k !== "death")) for (const t of times) {
      const p = computePose(kind, t);
      expect(Math.abs(p.sx - 1)).toBeLessThanOrEqual(0.2);
      expect(Math.abs(p.sy - 1)).toBeLessThanOrEqual(0.2);
    }
  });
  it("death: the body collapses (embers or ink) without tipping over, then the face is hidden, never faded", () => {
    const start = computePose("death", 0);
    expect(start.collapse).toBe(0);
    expect(start.burst).toBe(-1);
    expect(start.faceShown).toBe(true);
    const mid = computePose("death", DEATH.collapseAt + DEATH.collapseLen);
    expect(mid.sy).toBeLessThan(0.3);
    expect(mid.burst).toBeGreaterThan(0);
    for (const t of times) expect(computePose("death", t, { facing: -1 }).rootRot).toBe(0);
    expect(computePose("death", DEATH.goneAt - 0.01).faceShown).toBe(true);
    expect(computePose("death", DEATH.goneAt).faceShown).toBe(false);
    expect(computePose("death", DEATH.total).bodyAlpha).toBe(0);
  });
  it("win: a calm rise into the door, arms up and the glow swelling", () => {
    const lift = Math.min(...times.map((t) => computePose("win", t).rootDY));
    expect(lift).toBeLessThan(-2);
    expect(lift).toBeGreaterThan(-10);
    const p = computePose("win", 1);
    expect(p.arms[1]).toBeGreaterThan(1.5);
    expect(p.glow).toBeGreaterThan(1.5);
  });
  it("run: legs and arms swing opposite each other", () => {
    const p = computePose("run", 0.05);
    expect(Math.sign(p.legs[0])).toBe(-Math.sign(p.legs[1]));
    expect(Math.sign(p.arms[0])).toBe(-Math.sign(p.legs[0]));
  });
  it("the head sits on top of the body, follows the squash, and stays off the floor even collapsed", () => {
    const tall = headCenterY(computePose("jump", 0));
    const squashed = headCenterY(computePose("land", 0));
    expect(tall).toBeLessThan(GEO.torsoTop);
    expect(squashed).toBeGreaterThan(tall);
    expect(headCenterY(computePose("death", DEATH.goneAt - 0.01))).toBeLessThanOrEqual(-FACE_RY - 4);
  });
  it("the hero is about 1.8 tiles tall (plan: 1.5 to 2)", () => {
    expect(GEO.height / 30).toBeGreaterThanOrEqual(1.5);
    expect(GEO.height / 30).toBeLessThanOrEqual(2);
  });
  it("is the same every time for the same inputs", () => {
    expect(computePose("run", 0.4, { tick: 3.2 })).toEqual(computePose("run", 0.4, { tick: 3.2 }));
  });
});
