import { expect, test } from "@playwright/test";
import { nextFrame, open, state } from "./helpers.ts";

test("boots to the title with no console errors, and keeps search engines out", async ({ page }) => {
  const errors = await open(page);
  const s = await state(page);
  expect(s.phase).toBe("title");
  await expect(page).toHaveTitle("Flappy Scogg");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await nextFrame(page);
  expect(errors).toEqual([]);
});

test("loads nothing from other sites", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (r) => { if (!r.url().startsWith("http://localhost:4175")) outside.push(r.url()); });
  await open(page, "");
  await page.waitForLoadState("networkidle");
  expect(outside).toEqual([]);
});

test("laptop: the field sits in the middle with the dark page either side", async ({ page }) => {
  await open(page);
  const l = await page.evaluate(() => (window as any).__fs.layout);
  expect(l.scale).toBeCloseTo(768 / 720, 5);
  expect(l.x).toBeGreaterThan(400);
  expect(l.y).toBe(0);
  // left edge is the site's background color
  await nextFrame(page);
  const px = await page.evaluate(() => {
    const c = document.getElementById("game") as HTMLCanvasElement;
    const d = c.getContext("2d")!.getImageData(5, 300, 1, 1).data;
    return [d[0], d[1], d[2]];
  });
  expect(px).toEqual([0x12, 0x0f, 0x0d]);
});

test("phone: the field fills the width, the page never scrolls", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  await open(page);
  const l = await page.evaluate(() => (window as any).__fs.layout);
  expect(l.x).toBe(0);
  expect(l.y).toBe(0);
  expect(l.scale).toBeCloseTo(375 / 405, 5);
  expect(l.extraBottom).toBeGreaterThan(100);
  const sizes = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, h: innerHeight, w: innerWidth }));
  expect(sizes.sh).toBeLessThanOrEqual(sizes.h);
  expect(sizes.sw).toBeLessThanOrEqual(sizes.w);
  await ctx.close();
});
