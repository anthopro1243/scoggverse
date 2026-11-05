// Sound: every effect and the tune are synthesized in the page. Each one is heard (not silent),
// never peaks above the cap, never starts hard (nothing that startles), and fades out; the tune
// loops without a click. Playing a level asks for the right sounds at the right moments, and the
// first key press starts the audio with the tune.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { open, playReplay, replay } from "./helpers.js";
import { SOUND } from "../../src/logic/config.js";

test("every sound is audible, capped, soft at the start and quiet at the end", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page);
  const all = await page.evaluate(() => window.__sbgSynth());
  for (const [name, m] of Object.entries(all)) {
    expect(m.rms, `${name} is heard`).toBeGreaterThan(0.01);
    expect(m.peak, `${name} peak`).toBeLessThanOrEqual(SOUND.maxPeak);
    expect(m.toHalfPeak, `${name} doesn't start hard`).toBeGreaterThanOrEqual(0.0015);
    if (name !== "tune") expect(m.endRms, `${name} fades out`).toBeLessThan(0.01);
  }
  expect(all.tune.seconds).toBe(32);
  expect(all.tune.seam, "the tune loops without a click").toBeLessThan(0.02);
});

test("a level asks for jumps, landings, pickups and the win chord", async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__sbg.step(1, []));
  const r = JSON.parse(readFileSync(new URL("../../replays/priming.json", import.meta.url), "utf8"));
  await playReplay(page, r);
  const { played } = await page.evaluate(() => window.__sbgAudio());
  for (const name of ["jumpBoy", "jumpGirl", "land", "buck", "gavel", "win"]) expect(played, name).toContain(name);
  expect(played).not.toContain("ember");
  expect(played).not.toContain("splash");
});

test("Scogg Boy in Recession fizzles out like an ember", async ({ page }) => {
  await open(page);
  await replay(page);
  const { played } = await page.evaluate(() => window.__sbgAudio());
  expect(played).toContain("ember");
});

test("the first key press starts the sound and the tune", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await open(page, "&scene=select&sound=1");
  expect((await page.evaluate(() => window.__sbgAudio())).running).toBe(false);
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => window.__sbgAudio().ready, null, { timeout: 60_000 });
  const s = await page.evaluate(() => window.__sbgAudio());
  expect(s.running).toBe(true);
  expect(s.music).toBe(true);
  expect(s.played).toContain("ui");
  expect(errors).toEqual([]);
});
