import { expect, test } from "@playwright/test";
import { playReplay as playHeadless } from "../../src/logic/replay.ts";
import { open, playReplay, replay, state, step } from "./helpers.ts";

test("the F0 replay in the built game: past 25 columns, the exact recorded score", async ({ page }) => {
  const errors = await open(page);
  const headless = playHeadless(replay);
  const mid = await playReplay(page, replay, replay.taps[replay.taps.length - 1]);
  expect(mid.score).toBeGreaterThanOrEqual(25);
  const s = await playReplay(page, replay);
  expect(s.score).toBe(replay.expect.score);
  expect(s.phase).toBe(replay.expect.phase);
  expect(s.cause).toBe(replay.expect.cause);
  expect(s.y).toBe(headless.body.y); // same numbers in the browser as in Node, to the last bit
  expect(errors).toEqual([]);
});

test("the card ignores a panicked tap, then a tap starts a new run", async ({ page }) => {
  await open(page);
  // play to the moment of the hit
  let s = await playReplay(page, replay, 1);
  while (s.phase === "playing") s = await step(page, 1, replay.taps.includes(s.frame + 1));
  expect(s.phase).toBe("over");
  s = await step(page, 30, true); // tapping while the card slides in
  expect(s.phase).toBe("over");
  s = await step(page, 60);
  s = await step(page, 1, true);
  expect(s.phase).toBe("playing");
  expect(s.score).toBe(0);
  expect(s.run).toBe(2);
});
