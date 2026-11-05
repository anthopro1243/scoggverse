import { test, expect } from "@playwright/test";
import { open } from "./helpers.js";

test("boots into the level select with no console errors", async ({ page }) => {
  const errors = await open(page, "&scene=select");
  await expect(page.locator("canvas")).toBeVisible();
  expect(await page.evaluate(() => window.__sbg.scene)).toBe("select");
  expect(errors).toEqual([]);
});

test("a link with ?level= goes straight to that chamber", async ({ page }) => {
  const errors = await open(page, "&level=priming");
  expect(await page.evaluate(() => [window.__sbg.scene, window.__sbg.level])).toEqual(["level", "priming"]);
  expect(errors).toEqual([]);
});

test("renders at the screen's real size at 1366x768, so it stays crisp", async ({ page }) => {
  await open(page);
  const size = await page.evaluate(() => { const c = document.querySelector("canvas"); return { w: c.width, h: c.height, cw: c.clientWidth }; });
  expect(size.w).toBeGreaterThanOrEqual(1360);
  expect(Math.abs(size.cw - size.w)).toBeLessThanOrEqual(2); // drawn 1:1, not stretched
});

test("without test mode the fixed-step loop runs on its own", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?level=priming");
  await page.waitForFunction(() => window.__sbg?.ready === true);
  await page.waitForFunction(() => window.__sbg.snapshot().frame > 20, null, { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test("the keyboard moves both players (W A D and the arrows)", async ({ page }) => {
  await page.goto("/?level=priming");
  await page.waitForFunction(() => window.__sbg?.ready === true);
  const before = await page.evaluate(() => window.__sbg.snapshot().players);
  await page.keyboard.down("d");
  await page.keyboard.down("ArrowLeft");
  // hold the keys until both have walked (a slow CI machine runs fewer steps per real second)
  await page.waitForFunction(([b0, g0]) => {
    const [b, g] = window.__sbg.snapshot().players;
    return b.x > b0 + 20 && g.x < g0 - 20;
  }, [before[0].x, before[1].x], { timeout: 10_000 }).catch(() => {});
  await page.keyboard.up("d");
  await page.keyboard.up("ArrowLeft");
  const after = await page.evaluate(() => window.__sbg.snapshot().players);
  expect(after[0].x).toBeGreaterThan(before[0].x + 20);
  expect(after[1].x).toBeLessThan(before[1].x - 20);
});
