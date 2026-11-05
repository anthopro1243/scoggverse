import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { open, playReplay, replay } from "./helpers.ts";

test("only the chosen face ships, and it's the cut-out byte for byte", async ({ page, request }) => {
  await open(page);
  const urls = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => /face-[abc]-.*\.png$/.test(n)));
  expect(urls).toHaveLength(1);
  expect(urls[0]).toMatch(/face-a-/);
  const served = Buffer.from(await (await request.get(urls[0])).body());
  expect(served.equals(readFileSync(new URL("../../assets/faces/face-a.png", import.meta.url)))).toBe(true);
});

test("the face is drawn scaled evenly, on the title, in flight and on the card", async ({ page }) => {
  await open(page);
  for (const upTo of [0, 300, 900, Infinity]) {
    await playReplay(page, replay, upTo);
    const f = await page.evaluate(() => (window as any).__fs.lastFace);
    expect(f.w / f.h).toBeCloseTo(f.srcW / f.srcH, 9);
  }
});
