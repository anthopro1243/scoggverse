// G1 core rules in the real game: inflation on the HUD clock, pause, restart, deaths restarting the
// chamber, element curtains, plates and gates, coyote time, jump buffering, no sticking to walls,
// and a page where storage is blocked.
import { test, expect } from "@playwright/test";
import { open, stepUntil, press, tap } from "./helpers.js";

const boy = (s) => s.players[0];
const girl = (s) => s.players[1];
const step = (page, n, keys = []) => page.evaluate(([n, k]) => window.__sbg.step(n, k), [n, keys]);

test("the Scogg Buck loses 3% every 10 seconds on the level clock", async ({ page }) => {
  await open(page);
  expect((await step(page, 599)).buckValue).toBe(10);
  const s = await step(page, 1);
  expect(s.time).toBeCloseTo(10, 5);
  expect(s.buckValue).toBe(9.7);
});

test("Esc pauses (nothing moves, the clock stops) and Esc resumes", async ({ page }) => {
  await open(page);
  await step(page, 10, ["D"]);
  await press(page, "Escape", (s) => s.state === "paused");
  const a = await step(page, 60, ["D", "LEFT"]);
  expect(a.state).toBe("paused");
  const b = await step(page, 60, ["D", "LEFT"]);
  expect([b.time, boy(b).x, girl(b).x]).toEqual([a.time, boy(a).x, girl(a).x]);
  await press(page, "Escape", (s) => s.state === "play");
  const c = await step(page, 10, ["D"]);
  expect(c.state).toBe("play");
  expect(boy(c).x).toBeGreaterThan(boy(b).x);
});

test("R puts the chamber back to the start", async ({ page }) => {
  await open(page);
  const start = await step(page, 1);
  await step(page, 70, ["D", "RIGHT"]);
  await press(page, "r", (s) => s.time === 0);
  const s = await step(page, 0);
  expect(s.time).toBe(0);
  expect([boy(s).x, girl(s).x]).toEqual([boy(start).x, girl(start).x]);
});

test("a death plays out, then the whole chamber starts over (pickups too)", async ({ page }) => {
  await open(page);
  // Scogg Boy wades Inflation and takes a Scogg Buck; Scogg Girl walks into Inflation and dies
  let s = await step(page, 40, ["D", "RIGHT"]);
  expect(girl(s).dead || s.state === "dying").toBe(true);
  expect(s.bucks.got + s.gavels.got).toBeGreaterThanOrEqual(0);
  s = await stepUntil(page, [], (x) => x.state === "play", 200);
  expect(s.state).toBe("play");
  expect(s.time).toBe(0);
  expect(girl(s).dead).toBe(false);
  expect(s.bucks.got).toBe(0);
});

test("curtains: flame lets only Scogg Boy through, water only Scogg Girl", async ({ page }) => {
  await open(page, "&level=test/barriers");
  const s = await step(page, 150, ["D", "RIGHT"]);
  expect(boy(s).x).toBeGreaterThan(10 * 30);         // through the flame at column 9
  expect(boy(s).x + 20).toBeLessThanOrEqual(15 * 30 + 1); // stopped by the water at column 15
  expect(girl(s).x + 20).toBeLessThanOrEqual(9 * 30 + 1); // stopped by the flame
});

test("a gate stays shut until someone holds its plate, and never closes on a hero", async ({ page }) => {
  await open(page, "&level=test/gates");
  let s = await step(page, 120, ["RIGHT"]);
  expect(girl(s).x + 20).toBeLessThanOrEqual(12 * 30 + 1); // shut
  expect(s.gates[0]).toBe(0);
  s = await step(page, 34, ["D", "RIGHT"]);              // Scogg Boy walks onto the plate at column 6
  s = await step(page, 30, ["RIGHT"]);
  expect(s.gates[0]).toBe(1);
  s = await stepUntil(page, ["RIGHT"], (x) => x.players[1].x > 12 * 30 - 8, 60); // Girl steps into the gateway
  s = await step(page, 15, ["A"]);                       // Boy steps off the plate while she's in it
  s = await step(page, 30);
  expect(s.gates[0]).toBe(1);                            // held open: she's standing in it
  s = await step(page, 40, ["RIGHT"]);                   // she walks on through
  expect(girl(s).x).toBeGreaterThan(13 * 30);
  s = await step(page, 30);
  expect(s.gates[0]).toBe(0);                            // and it shuts behind her
});

test("no sticking to walls: jumping into a wall falls back down at full speed", async ({ page }) => {
  await open(page, "&level=test/gates");
  await step(page, 120, ["RIGHT"]);                      // Scogg Girl at the shut gate under the stone wall
  await step(page, 1, ["RIGHT", "UP"]);
  const s = await stepUntil(page, ["RIGHT", "UP"], (x) => x.players[1].grounded, 120);
  expect(girl(s).grounded).toBe(true);
  expect(s.frame).toBeLessThan(121 + 56);                // a full jump is about 51 frames in the air
  // the same into a curtain she can't pass
  await open(page, "&level=test/barriers");
  await step(page, 100, ["RIGHT"]);
  await step(page, 1, ["RIGHT", "UP"]);
  const t = await stepUntil(page, ["RIGHT", "UP"], (x) => x.players[1].grounded, 120);
  expect(t.frame).toBeLessThan(101 + 56);
});

// Scogg Boy jumps up onto the ledge (row 12, columns 3 to 8) from its right end, then walks right off it.
async function offTheLedge(page) {
  await open(page, "&level=test/gates");
  await stepUntil(page, ["D"], (s) => s.players[0].x > 330, 120); // a run-up past the ledge, so the jump clears it
  await step(page, 1, ["A", "W"]);
  const on = await stepUntil(page, ["A", "W"], (s) => s.players[0].grounded && s.players[0].y + 52 < 400, 90);
  expect(on.players[0].y + 52).toBe(360);
  await step(page, 6, []);
  return stepUntil(page, ["D"], (s) => !s.players[0].grounded, 120);
}

test("coyote time: a jump a few frames after walking off a ledge still works", async ({ page }) => {
  await offTheLedge(page);
  await step(page, 3, ["D"]);
  const s = await step(page, 1, ["D", "W"]);
  expect(boy(s).vy).toBeLessThan(-500);
});

test("but not long after: no jumping in mid-air", async ({ page }) => {
  await offTheLedge(page);
  await step(page, 12, ["D"]);
  const s = await step(page, 1, ["D", "W"]);
  expect(boy(s).vy).toBeGreaterThan(0);
});

test("jump buffering: a jump pressed just before landing happens on landing", async ({ page }) => {
  await open(page, "&level=test/gates");
  await step(page, 1, ["W"]);
  await stepUntil(page, [], (s) => s.players[0].vy > 0 && s.players[0].y + 52 > 460, 90); // falling, about 20 px up
  await step(page, 1, []);
  const s = await stepUntil(page, ["W"], (x) => x.players[0].grounded || x.players[0].vy < 0, 30);
  const t = await step(page, 2, ["W"]);
  expect(Math.min(boy(s).vy, boy(t).vy)).toBeLessThan(-500);
});

test("letting go of jump early gives a short hop", async ({ page }) => {
  await open(page, "&level=test/gates");
  const y0 = boy(await step(page, 1)).y;
  await step(page, 4, ["W"]);
  const low = await stepUntil(page, [], (s) => s.players[0].vy >= 0, 60);
  await open(page, "&level=test/gates");
  await step(page, 1);
  await step(page, 4, ["W"]);
  const high = await stepUntil(page, ["W"], (s) => s.players[0].vy >= 0, 60);
  expect(y0 - boy(low).y).toBeLessThan((y0 - boy(high).y) * 0.6);
  expect(y0 - boy(high).y).toBeGreaterThan(120);         // a full jump is about 4.5 tiles
});

test("the end card's Play again starts the chamber over", async ({ page }) => {
  const { readFileSync } = await import("node:fs");
  const { playReplay } = await import("./helpers.js");
  await open(page);
  const s = await playReplay(page, JSON.parse(readFileSync(new URL("../../replays/priming.json", import.meta.url), "utf8")));
  expect(s.endCard).toBe(true);
  await tap(page, "ArrowRight"); // Next chamber, then Play again
  await press(page, "Enter", (s) => !s.endCard);
  const t = await step(page, 0);
  expect([t.state, t.endCard, t.time]).toEqual(["play", false, 0]);
});

test("still plays when the browser blocks storage", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  });
  const errors = await open(page);
  await page.keyboard.press("m");
  const s = await step(page, 30, ["D"]);
  expect(boy(s).x).toBeGreaterThan(70);
  expect(errors).toEqual([]);
});
