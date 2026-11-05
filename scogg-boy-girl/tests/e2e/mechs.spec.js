// Each G2 puzzle piece, in the level that teaches it: driven by keys a frame at a time, or by
// playing that level's replay up to the moment the piece is in use.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { open } from "./helpers.js";
import { replaySteps } from "../../src/logic/replay.js";

const replayOf = (level) => JSON.parse(readFileSync(new URL(`../../replays/${level}.json`, import.meta.url), "utf8"));
const step = (page, n, keys = []) => page.evaluate(([n, k]) => window.__sbg.step(n, k), [n, keys]);
const feet = (p) => p.y + 52;
const cx = (p) => p.x + 10;

/** Walk one hero to x (center), a frame at a time. */
function walk(page, who, x) {
  return page.evaluate(([who, x]) => {
    const i = who === "boy" ? 0 : 1, [L, R] = who === "boy" ? ["A", "D"] : ["LEFT", "RIGHT"];
    let s = window.__sbg.snapshot();
    for (let f = 0; f < 900 && Math.abs(s.players[i].x + 10 - x) > 1.8; f++) s = window.__sbg.step(1, [s.players[i].x + 10 < x ? R : L]);
    return s;
  }, [who, x]);
}

/** Play a level's replay one frame at a time until check(snapshot) holds; returns that snapshot (or the last). */
function playUntil(page, level, check) {
  const frames = replaySteps(replayOf(level)).flatMap(([n, k]) => Array(n).fill(k));
  return page.evaluate(([frames, src]) => {
    const fn = new Function("s", `return (${src})(s)`);
    let s = window.__sbg.snapshot();
    for (const k of frames) { s = window.__sbg.step(1, k); if (fn(s)) return { ...s, hit: true }; }
    return { ...s, hit: false };
  }, [frames, check.toString()]);
}

test("lever and lift: walking into the lever raises the platform, and it carries whoever stands on it", async ({ page }) => {
  await open(page, "&level=ovens-and-tee-shirts");
  let s = await playUntil(page, "ovens-and-tee-shirts", (s) => s.mech.levers.L1);
  expect(s.hit).toBe(true);
  expect(feet(s.players[1])).toBeCloseTo(480, 0);           // Girl on the lift, still down
  s = await step(page, 240);
  expect(s.mech.movers[0].y).toBeCloseTo(270, 1);          // up at the floor above
  expect(feet(s.players[1])).toBeCloseTo(270, 0);           // and she rode up with it
  expect(s.players[1].dead).toBe(false);
});

test("surplus crate: pushed onto the plate, it holds the gate open by itself", async ({ page }) => {
  await open(page, "&level=ovens-and-tee-shirts");
  const start = (await step(page, 0)).mech.crates[0].x;
  const s = await playUntil(page, "ovens-and-tee-shirts", (s) => s.mech.sig.P1);
  expect(s.hit).toBe(true);
  expect(s.mech.crates[0].x).toBeGreaterThan(start + 20);
  const t = await step(page, 40);                          // nobody touching it now
  expect(t.mech.sig.P1).toBe(true);
  expect(t.gates[0]).toBeGreaterThanOrEqual(0.95);
});

test("filibuster wall: one plate does nothing; both at once opens it, and it stays open", async ({ page }) => {
  await open(page, "&level=cats-in-a-sack");
  let s = await walk(page, "boy", 225);                    // Boy on the far plate alone
  s = await step(page, 60);
  expect(s.gates[0]).toBe(0);
  await walk(page, "girl", 165);                           // Girl on the near one: cloture
  s = await step(page, 30);
  expect(s.gates[0]).toBeGreaterThanOrEqual(0.95);
  await walk(page, "boy", 120);                            // both step off
  await walk(page, "girl", 60);
  s = await step(page, 90);
  expect(s.gates[0]).toBe(1);
});

test("checks and balances: alone on a lane's pan you sink into the Recession; side by side it stays level", async ({ page }) => {
  await open(page, "&level=layer-cake-marble-cake");
  await walk(page, "girl", 465);                           // Girl alone on the lower lane's pan
  let s = await step(page, 0);
  for (let i = 0; i < 12 && !s.players[1].dead; i++) s = await step(page, 10);
  expect(s.players[1].dead).toBe(true);
  await open(page, "&level=layer-cake-marble-cake");
  s = await playUntil(page, "layer-cake-marble-cake", (s) => s.players.every((p) => p.x + 10 > 420 && p.x + 10 < 510));
  expect(s.hit).toBe(true);
  expect(s.mech.scales[1].left).toBeCloseTo(300, 0);       // both pans at rest: level
  expect(s.mech.scales[1].right).toBeCloseTo(480, 0);
});

test("money supply: Inflation holds Scogg Boy and burns Scogg Girl; the lever drains it", async ({ page }) => {
  await open(page, "&level=quaker-oats-incident");
  let s = await walk(page, "boy", 165);                    // Boy stands on the Inflation
  expect(feet(s.players[0])).toBeCloseTo(360, 0);
  expect(s.players[0].dead).toBe(false);
  s = await walk(page, "girl", 150);                       // Girl steps in
  for (let i = 0; i < 6 && !s.players[1].dead; i++) s = await step(page, 5);
  expect(s.players[1].dead).toBe(true);
  await open(page, "&level=quaker-oats-incident");
  s = await playUntil(page, "quaker-oats-incident", (s) => !s.mech.levers.L1);
  expect(s.hit).toBe(true);
  s = await step(page, 200);
  expect(s.mech.basins[0]).toBe(480);                      // drained to the floor
});

test("business cycle: the elevators ride trough to peak and back on the clock, the third one opposite", async ({ page }) => {
  await open(page, "&level=hamburger-stand-hustle");
  let s = await step(page, 1);
  expect(s.mech.movers.map((m) => m.y)).toEqual([480, 300, 180]);
  s = await step(page, 3.2 * 60);
  expect(s.mech.movers.map((m) => m.y)).toEqual([300, 180, 300]);
  s = await step(page, 3 * 60);
  expect(s.mech.movers.map((m) => m.y)).toEqual([480, 300, 180]);
});

test("veto levers: only the named hero passes it, only the other vetoes it", async ({ page }) => {
  await open(page, "&level=factor-market");
  let s = await walk(page, "girl", 330);                   // Girl passes her lever: gate B opens
  expect(s.mech.levers.LB).toBe(true);
  s = await walk(page, "girl", 300);                       // she can't veto her own
  expect(s.mech.levers.LB).toBe(true);
  s = await walk(page, "boy", 630);                        // Boy walks back over his: no veto from him either
  expect(s.mech.levers.LA).toBe(false);
  s = await walk(page, "boy", 660);                        // he passes it
  expect(s.mech.levers.LA).toBe(true);
  s = await step(page, 30);
  expect(s.gates.slice(0, 2)).toEqual([1, 1]);
  s = await walk(page, "boy", 300);                        // Boy vetoes Girl's lever on his way left
  expect(s.mech.levers.LB).toBe(false);
});

test("Rules Committee: the plate fills the sand clock; the gate shuts when it runs out", async ({ page }) => {
  await open(page, "&level=rules-committee");
  await walk(page, "girl", 165);                           // on the plate
  let s = await step(page, 30);
  expect(s.gates[1]).toBeGreaterThanOrEqual(0.95);
  s = await walk(page, "girl", 105);                       // off it: 3 seconds of sand
  s = await step(page, 2.4 * 60);
  expect(s.gates[1]).toBe(1);
  expect(s.mech.timers.T1).toBeGreaterThan(0);
  s = await step(page, 60);
  expect(s.mech.timers.T1).toBe(0);
  expect(s.gates[1]).toBeLessThan(0.9);
});
