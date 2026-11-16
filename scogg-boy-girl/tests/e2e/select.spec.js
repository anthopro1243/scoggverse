// The level select and saved progress: chambers open one after another, best grades are kept in
// localStorage, and the game still works (for the visit) when the browser blocks storage.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { open, playReplay, press, tap } from "./helpers.js";

const ORDER = JSON.parse(readFileSync(new URL("../../levels/order.json", import.meta.url), "utf8"));
const replayOf = (level) => JSON.parse(readFileSync(new URL(`../../replays/${level}.json`, import.meta.url), "utf8"));
const select = (page) => page.evaluate(() => window.__sbg.select());
const inScene = (page, scene, level) => page.waitForFunction(([s, l]) => window.__sbg?.ready && window.__sbg.scene === s && (!l || window.__sbg.level === l), [scene, level]);

test("lists every chamber in order; at first only Priming is open, and Enter plays it", async ({ page }) => {
  const errors = await open(page, "&scene=select");
  const s = await select(page);
  expect(s.levels.map((l) => l.name)).toEqual(ORDER);
  expect(s.levels.map((l) => l.unlocked)).toEqual(ORDER.map((_, i) => i === 0));
  expect(s.levels.every((l) => l.best === null)).toBe(true);
  expect([s.focus, s.saved]).toEqual(["priming", true]);
  await page.keyboard.press("Enter");
  await inScene(page, "level", "priming");
  expect(errors).toEqual([]);
});

test("a shut chamber doesn't open", async ({ page }) => {
  await open(page, "&scene=select");
  await tap(page, "ArrowRight");
  expect((await select(page)).focus).toBe(ORDER[1]);
  await tap(page, "Enter");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__sbg.scene)).toBe("select");
});

test("escaping a chamber saves its grade, opens the next one, and Next level goes there", async ({ page }) => {
  await open(page, "&level=priming");
  const s = await playReplay(page, replayOf("priming"));
  expect(s.endCard).toBe(true);
  await page.keyboard.press("Enter");                       // Next level
  await inScene(page, "level", ORDER[1]);
  await open(page, "&scene=select");                        // a fresh page load reads it back
  const sel = await select(page);
  expect(sel.levels[0].best).toBe(s.result.grade);
  expect(sel.levels.map((l) => l.unlocked).slice(0, 3)).toEqual([true, true, false]);
  expect(sel.focus).toBe(ORDER[1]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("sbg-progress")).best.priming)).toBe(s.result.grade);
});

test("a worse run never lowers the best grade", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sbg-progress", JSON.stringify({ best: { priming: "A" } })));
  await open(page, "&level=priming");
  await page.evaluate(() => window.__sbg.step(6000, []));   // stand around for 100 s: the Bucks lose value
  const s = await playReplay(page, replayOf("priming"));
  expect(s.result.grade).not.toBe("A");
  await open(page, "&scene=select");
  expect((await select(page)).levels[0].best).toBe("A");
});

test("the pause menu and the end card both lead back to the level select", async ({ page }) => {
  await open(page, "&level=priming");
  await press(page, "Escape", (s) => s.state === "paused");
  await tap(page, "ArrowUp", "Enter");                     // All levels (the last button)
  await inScene(page, "select");
  await page.keyboard.press("Enter");
  await inScene(page, "level", "priming");
  await playReplay(page, replayOf("priming"));
  await tap(page, "ArrowRight", "ArrowRight", "Enter");    // All levels
  await inScene(page, "select");
  expect((await select(page)).levels[1].unlocked).toBe(true);
});

test("with storage blocked, progress lasts for the visit and the select says so", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  });
  const errors = await open(page, "&scene=select");
  expect((await select(page)).saved).toBe(false);
  await page.keyboard.press("Enter");
  await inScene(page, "level", "priming");
  await playReplay(page, replayOf("priming"));
  await tap(page, "ArrowRight", "ArrowRight", "Enter");
  await inScene(page, "select");
  const s = await select(page);
  expect(s.levels[0].best).toMatch(/^[AB]$/);
  expect(s.levels[1].unlocked).toBe(true);
  expect(errors).toEqual([]);
});

test("finishing a level gives one Scogg Buck, once: the end card says so and the select counts it", async ({ page }) => {
  await open(page, "&scene=select");
  expect((await select(page)).note).toBe("Finish a level to open the next one.");
  await open(page, "&level=priming");
  const first = await playReplay(page, replayOf("priming"));
  expect([first.endCard, first.award]).toEqual([true, "+1 Scogg Buck"]);
  await open(page, "&scene=select");
  expect((await select(page)).note).toBe("Scogg Bucks: 1 of 9");
  await open(page, "&level=priming");
  const again = await playReplay(page, replayOf("priming"));
  expect([again.endCard, again.award]).toEqual([true, ""]);
  await open(page, "&scene=select");
  expect((await select(page)).note).toBe("Scogg Bucks: 1 of 9");
});
