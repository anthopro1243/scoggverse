import { expect, test } from "@playwright/test";
import { open, state, step } from "./helpers.ts";

test("a click starts the run and flaps", async ({ page }) => {
  await open(page);
  await page.mouse.click(683, 400);
  const s = await step(page, 1);
  expect(s.phase).toBe("playing");
  expect(s.events).toContain("flap");
  expect(s.vy).toBeLessThan(0);
});

test("Space flaps once per press, holding it doesn't repeat", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Space");
  await step(page, 1);
  await step(page, 40);
  await page.keyboard.down("Space");
  let s = await step(page, 1);
  expect(s.events).toContain("flap");
  for (let i = 0; i < 5; i++) await page.keyboard.down("Space"); // auto-repeat while held
  s = await step(page, 1);
  expect(s.events).not.toContain("flap");
  await page.keyboard.up("Space");
});

test("Esc and P pause a run and resume it; the clock really stops", async ({ page }) => {
  await open(page, "seed=pause");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => (window as any).__fs.state().runFrame > 3);
  await page.keyboard.press("Escape");
  const a = await state(page);
  expect(a.paused).toBe(true);
  await page.waitForTimeout(300);
  const b = await state(page);
  expect(b.frame).toBe(a.frame);
  await page.keyboard.press("p");
  expect((await state(page)).paused).toBe(false);
  await page.keyboard.press("p");
  expect((await state(page)).paused).toBe(true);
  await page.mouse.click(683, 400); // a tap on the pause screen only resumes
  const c = await state(page);
  expect(c.paused).toBe(false);
  expect(c.phase).toBe("playing");
});

test("hiding the tab pauses a run", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Space");
  await step(page, 2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect((await state(page)).paused).toBe(true);
});

test("phone: a tap flaps, and taps never scroll or zoom the page", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await open(page, "test=1");
  await page.touchscreen.tap(180, 400);
  let s = await step(page, 1);
  expect(s.phase).toBe("playing");
  expect(s.vy).toBeLessThan(0);
  for (let i = 0; i < 6; i++) { await page.touchscreen.tap(180, 400); await step(page, 3); } // quick double taps
  const v = await page.evaluate(() => ({ scale: visualViewport!.scale, x: scrollX, y: scrollY }));
  expect(v).toEqual({ scale: 1, x: 0, y: 0 });
  const touchAction = await page.evaluate(() => getComputedStyle(document.getElementById("game")!).touchAction);
  expect(touchAction).toBe("none");
  await ctx.close();
});
