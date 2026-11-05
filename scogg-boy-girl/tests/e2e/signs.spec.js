// Signs stay fully on screen and never cover a Scogg Buck or a Gavel, or each other, and no pickup sits on an exit door. Every chamber has exactly one motto
// sign; when the two exits stand close it spans both of them, sitting on top of the taller one.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { open } from "./helpers.js";
import { overlaps } from "../../src/logic/motto.js";
import { DOOR } from "../../src/art/textures.js";
import { WORLD_W, WORLD_H } from "../../src/logic/config.js";

const ORDER = JSON.parse(readFileSync(new URL("../../levels/order.json", import.meta.url), "utf8"));
const TILE = 30;

for (const name of ORDER) {
  test(`signs in ${name} leave every pickup and each other clear`, async ({ page }) => {
    const errors = await open(page, `&level=${name}`);
    const { signs, pickups, doors } = await page.evaluate(() => ({ signs: window.__sbg.signs(), pickups: window.__sbg.pickups(), doors: window.__sbg.doors() }));
    const motto = signs.filter((s) => s.kind === "motto");
    expect(motto, "one motto sign").toHaveLength(1);
    const [m] = motto;
    if (m.spans) for (const d of doors) {
      expect(m.x, `motto reaches past the ${d.kind} door's left side`).toBeLessThanOrEqual(d.x - 40);
      expect(m.x + m.w, `motto reaches past the ${d.kind} door's right side`).toBeGreaterThanOrEqual(d.x + 40);
    }
    else expect(Math.abs(m.x + m.w / 2 - (doors[0].x + doors[1].x) / 2), "a lone motto hangs halfway between the doors").toBeLessThan(3);
    const bad = [];
    for (const s of signs) {
      if (s.x < 0 || s.y < 0 || s.x + s.w > WORLD_W || s.y + s.h > WORLD_H) bad.push(`${s.kind} "${(s.text || "").split("\n")[0]}" runs off the screen`);
      for (const p of pickups) if (overlaps(s, { x: p.c * TILE, y: p.r * TILE, w: TILE, h: TILE })) bad.push(`${s.kind} "${(s.text || "").split("\n")[0]}" covers the ${p.kind} at ${p.c},${p.r}`);
      for (const o of signs) if (o !== s && signs.indexOf(o) > signs.indexOf(s) && overlaps(s, o)) bad.push(`${s.kind} overlaps ${o.kind} "${(o.text || "").split("\n")[0]}"`);
    }
    for (const d of doors) {
      const door = { x: d.x - DOOR[d.kind].w / 2, y: d.y - DOOR[d.kind].h, w: DOOR[d.kind].w, h: DOOR[d.kind].h };
      for (const p of pickups) if (overlaps(door, { x: p.c * TILE + 3, y: p.r * TILE + 3, w: TILE - 6, h: TILE - 6 })) bad.push(`the ${p.kind} at ${p.c},${p.r} sits on the ${d.kind} door`);
    }
    expect(bad).toEqual([]);
    expect(errors).toEqual([]);
  });
}
