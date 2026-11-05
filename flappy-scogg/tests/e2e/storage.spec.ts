import { expect, test } from "@playwright/test";
import { open, playReplay, replay, step } from "./helpers.ts";

test("the best score is saved in this browser", async ({ page }) => {
  await open(page);
  const s = await playReplay(page, replay);
  expect(s.best).toBe(replay.expect.score);
  await page.reload();
  await page.waitForFunction(() => (window as any).__fs?.ready);
  expect((await page.evaluate(() => (window as any).__fs.state())).best).toBe(replay.expect.score);
});

test("the game still works when the browser blocks storage", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  });
  const errors = await open(page);
  const s = await playReplay(page, replay);
  expect(s.phase).toBe("over");
  expect(s.best).toBe(replay.expect.score);
  const t = await step(page, 1, true);
  expect(t.phase).toBe("playing");
  expect(errors).toEqual([]);
});
