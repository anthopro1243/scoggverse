import { expect, test } from "@playwright/test";
import { open, state, step } from "./helpers.ts";

test("the pause button shows only during a run, pauses and resumes, and never flaps", async ({ page }) => {
  await open(page);
  await expect(page.locator("#pause")).toBeHidden();
  await page.keyboard.press("Space");
  await step(page, 20);
  await expect(page.locator("#pause")).toBeVisible();
  await expect(page.locator("#pause")).toHaveAttribute("aria-label", "Pause");
  const before = await state(page);
  await page.locator("#pause").click();
  let s = await state(page);
  expect(s.paused).toBe(true);
  await expect(page.locator("#pause")).toHaveAttribute("aria-label", "Keep going");
  s = await step(page, 1);
  expect(s.events).not.toContain("flap");
  expect(s.vy).toBeGreaterThan(before.vy); // only gravity since: the click didn't flap
  await page.locator("#pause").click();
  expect((await state(page)).paused).toBe(false);
  // Space still flaps after using the button (focus went back to the game)
  await page.keyboard.press("Space");
  s = await step(page, 1);
  expect(s.events).toContain("flap");
});

test("M and the speaker button mute, and the choice is remembered", async ({ page }) => {
  await open(page);
  const mute = page.locator("#mute");
  await expect(mute).toBeVisible();
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("m");
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(mute).toHaveAttribute("aria-label", "Turn the sound on");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  expect((await state(page)).phase).toBe("title"); // the button didn't start a run
  await mute.click();
  await page.reload();
  await page.waitForFunction(() => (window as any).__fs?.ready);
  expect((await state(page)).muted).toBe(true);
});

test("the credits open from the title, say the right things, and close", async ({ page }) => {
  await open(page);
  const link = page.locator("#credits-link");
  await expect(link).toBeVisible();
  await link.click();
  const panel = page.locator("#credits");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Face from the class deck The Scogg Files.");
  await expect(panel).toContainText("SIL Open Font License 1.1");
  await expect(panel).toContainText("Unofficial fan parody. Not affiliated with Flappy Bird or its makers. Made with Dr. Scoggins' permission, for fun.");
  // no "made by a classmate" line and no note about how the sounds were made (human pass, H1)
  await expect(panel).not.toContainText("classmate");
  await expect(panel).not.toContainText("made in code");
  await page.keyboard.press("Space"); // doesn't start a run behind the panel
  expect((await step(page, 1)).phase).toBe("title");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await link.click();
  await page.locator("#credits-close").click();
  await expect(panel).toBeHidden();
  await page.keyboard.press("Space");
  expect((await step(page, 1)).phase).toBe("playing");
  await expect(link).toBeHidden();
});

test("buttons are big enough to hit with a thumb, and sit inside the field on a phone", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await open(page);
  await page.touchscreen.tap(180, 400);
  await step(page, 2);
  for (const id of ["#pause", "#mute"]) {
    const b = (await page.locator(id).boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(375);
  }
  const before = await state(page);
  const b = (await page.locator("#pause").boundingBox())!;
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  const s = await state(page);
  expect(s.paused).toBe(true);
  expect(s.run).toBe(before.run);
  await ctx.close();
});

test("reduce motion: the title holds still (no drifting scenery, no bobbing)", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await open(page);
  const shot = async () => page.locator("canvas").screenshot();
  await step(page, 1);
  const a = await shot();
  await step(page, 50);
  const b = await shot();
  expect(a.equals(b)).toBe(true);
  await ctx.close();
});
