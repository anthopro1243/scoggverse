import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import type { Replay } from "../../src/logic/replay.ts";

export const replay: Replay = JSON.parse(readFileSync(new URL("../../replays/f0.json", import.meta.url), "utf8"));

export interface State {
  phase: string; score: number; best: number; newBest: boolean; frame: number; runFrame: number; run: number;
  y: number; vy: number; angle: number; cause: string | null; paused: boolean; face: string; seed: string; events: string[];
  muted: boolean; credits: boolean;
  columns: Array<{ index: number; x: number; gapY: number; gap: number; bronze: boolean }>;
}

/** Open the game and wait until it's running. Collects console errors into the returned list. */
export async function open(page: Page, query = "test=1"): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => (window as any).__fs?.ready);
  return errors;
}

export const state = (page: Page): Promise<State> => page.evaluate(() => (window as any).__fs.state());
export const step = (page: Page, n: number, tap = false): Promise<State> => page.evaluate(([n, t]) => (window as any).__fs.step(n, t), [n, tap] as const);
export const playReplay = (page: Page, r: Replay, upTo = Infinity): Promise<State> => page.evaluate(([r, u]) => (window as any).__fs.replay(r, u), [r, upTo] as const);
export const nextFrame = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
