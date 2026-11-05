// The solvability harness: every level ships with a committed input script (replays/<level>.json,
// one track per player). Replayed headless on the fixed timestep, both heroes must reach their own
// doors, the end card must show a grade, and the scripted run must earn at least a B.
import { test, expect } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { open, playReplay } from "./helpers.js";
const ORDER = JSON.parse(readFileSync(new URL("../../levels/order.json", import.meta.url), "utf8"));

for (const level of ORDER) {
  test(`${level}: the scripted run escapes the chamber with at least a B`, async ({ page }) => {
    const file = new URL(`../../replays/${level}.json`, import.meta.url);
    expect(existsSync(file), `replays/${level}.json must exist`).toBe(true);
    const r = JSON.parse(readFileSync(file, "utf8"));
    expect(r.level).toBe(level);
    const errors = await open(page, `&level=${level}`);
    const s = await playReplay(page, r);
    expect(s.state).toBe("won");
    expect(s.players.every((p) => p.atDoor && !p.dead)).toBe(true);
    expect(s.endCard).toBe(true);
    expect(s.result.grade).toMatch(/^[AB]$/);
    expect(s.bucks.got).toBe(s.bucks.total);
    expect(s.gavels.got).toBe(s.gavels.total);
    expect(errors).toEqual([]);
  });
}
