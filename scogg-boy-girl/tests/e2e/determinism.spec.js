import { test, expect } from "@playwright/test";
import { open, replay } from "./helpers.js";

test("the same inputs give exactly the same game, run after run", async ({ page }) => {
  await open(page, "&level=sandbox");
  const first = await replay(page);
  await page.reload();
  await page.waitForFunction(() => window.__sbg?.ready === true);
  const second = await replay(page);
  expect(second).toEqual(first);
  // and the run actually did things: moved, jumped, died in Recession and the chamber started over
  const all = first.flatMap((s) => s.players);
  expect(all.some((p) => p.pose === "jump" || p.pose === "fall")).toBe(true);
  expect(all.some((p) => p.who === "boy" && p.dead)).toBe(true);
  expect(first.at(-1).players.find((p) => p.who === "boy").dead).toBe(false);
});

test("Scogg Boy is safe in Inflation, Scogg Girl in Ink", async ({ page }) => {
  await open(page, "&level=sandbox");
  // boy walks right into Inflation (cols 7-9); girl walks left into Ink (cols 21-23)
  const s = await page.evaluate(() => window.__sbg.step(52, ["D", "LEFT"]));
  const [boy, girl] = s.players;
  expect(boy.x + 12).toBeGreaterThan(7 * 30);
  expect(boy.dead).toBe(false);
  expect(girl.x + 12).toBeLessThan(24 * 30);
  expect(girl.dead).toBe(false);
});
