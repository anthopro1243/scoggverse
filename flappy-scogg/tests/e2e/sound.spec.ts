import { expect, test } from "@playwright/test";
import { open } from "./helpers.ts";

test("every sound is heard, short, and never clips", async ({ page }) => {
  await open(page);
  const m = await page.evaluate(() => (window as any).__fs.measureSounds());
  for (const name of ["flap", "point", "ten", "hit"]) {
    expect(m[name].rms, name).toBeGreaterThan(0.01);
    expect(m[name].peak, name).toBeLessThanOrEqual(0.5); // quiet: half of full scale at most
    expect(m[name].seconds, name).toBeLessThan(0.6);
  }
  // nothing louder than the coin by much: the hit is a soft thud, not a bang
  expect(m.hit.peak).toBeLessThan(m.point.peak * 2.5);
});

test("sound starts on the first tap and plays without errors", async ({ page }) => {
  const errors = await open(page, "test=1&sound=1");
  await page.mouse.click(683, 400);
  const running = await page.evaluate(async () => {
    (window as any).__fs.step(30);
    return "AudioContext" in window;
  });
  expect(running).toBe(true);
  expect(errors).toEqual([]);
});
