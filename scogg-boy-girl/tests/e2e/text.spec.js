// No label clips its last letter. Phaser sizes a text's canvas from widths measured at the text's
// own size, then draws it scaled up by its resolution, where letters come out wider and big serif
// capitals reach past their own width. For every text on every screen: each line's ink, measured at
// the size it is really drawn, must fit inside its canvas, and a text with no background must
// leave its first and last pixel columns empty (no ink cut off). No text is drawn tilted either:
// Phaser 4.2.1 draws a rotated text only partly (the half-drawn "A" stamp), so stamps are baked
// into their own textures.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { open, playReplay, press } from "./helpers.js";

const ORDER = JSON.parse(readFileSync(new URL("../../levels/order.json", import.meta.url), "utf8"));

/** Every text in the running scenes that would clip, with why. */
const clipped = (page) => page.evaluate(() => {
  const probe = document.createElement("canvas").getContext("2d");
  probe.fontKerning = "none";                // the game draws every text without kerning
  const texts = [];
  const walk = (list, rot = 0) => { for (const o of list) { if (o.type === "Text") texts.push([o, rot + o.rotation]); if (o.list) walk(o.list, rot + o.rotation); } };
  for (const sc of window.__sbg.game.scene.getScenes(true)) walk(sc.children.list);
  const bad = [];
  for (const [t, rot] of texts) {
    if (!t.text) continue;
    if (Math.abs(rot) > 1e-6) bad.push(`"${t.text}" is drawn tilted`);
    if (t.context.fillText === CanvasRenderingContext2D.prototype.fillText) bad.push(`"${t.text}" is drawn with kerning`);
    const st = t.style, res = st.resolution;
    const out = st.wordWrapWidth ? t.runWordWrap(t.text) : t.text;
    const lines = out.split(t.splitRegExp);
    probe.font = st._font;
    const small = lines.map((l) => probe.measureText(l));
    const plain = small.map((m) => m.width);
    probe.font = st._font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${n * res}px`);
    // ink measured at the drawn size and at the text's own size, whichever reaches further
    const ink = lines.map((l, i) => { const m = probe.measureText(l), s = small[i]; return { left: Math.max(m.actualBoundingBoxLeft / res, s.actualBoundingBoxLeft), right: Math.max(m.width / res, m.actualBoundingBoxRight / res, s.actualBoundingBoxRight) }; });
    const widest = Math.max(...plain), room = t.canvas.width / res;
    lines.forEach((l, i) => {
      const x = t.padding.left + (st.align === "center" ? (widest - plain[i]) / 2 : st.align === "right" ? widest - plain[i] : 0);
      if (x + ink[i].right > room + 0.01) bad.push(`"${l}" reaches ${(x + ink[i].right).toFixed(1)}, has ${room.toFixed(1)}`);
      if (x - ink[i].left < -0.01) bad.push(`"${l}" reaches ${(x - ink[i].left).toFixed(1)} on the left`);
    });
    if (!st.backgroundColor) {
      const { width, height } = t.canvas;
      for (const [x, side] of [[width - 1, "last"], [0, "first"]]) {
        const col = t.context.getImageData(x, 0, 1, height).data;
        for (let y = 0; y < height; y++) if (col[y * 4 + 3] > 0) { bad.push(`"${t.text}" has ink in its ${side} column`); break; }
      }
    }
  }
  return { count: texts.length, bad };
});

test("the level select: no text clips", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("sbg-progress", JSON.stringify({ best: { priming: "A", "along-the-curve": "B" } })));
  await open(page, "&scene=select");
  const r = await clipped(page);
  expect(r.count).toBeGreaterThan(30);
  expect(r.bad).toEqual([]);
});

for (const level of ORDER) {
  test(`${level}: no sign, HUD or menu text clips`, async ({ page }) => {
    await open(page, `&level=${level}`);
    await press(page, "Escape", (s) => s.state === "paused");
    const r = await clipped(page);
    expect(r.count).toBeGreaterThan(10);
    expect(r.bad).toEqual([]);
  });
}

test("the end card: no text clips", async ({ page }) => {
  await open(page, "&level=priming");
  const s = await playReplay(page, JSON.parse(readFileSync(new URL("../../replays/priming.json", import.meta.url), "utf8")));
  expect(s.endCard).toBe(true);
  expect((await clipped(page)).bad).toEqual([]);
});

test("the title screen and its panels: no text clips", async ({ page }) => {
  await open(page, "&scene=title");
  const r = await clipped(page);
  expect(r.count).toBeGreaterThan(30);
  expect(r.bad).toEqual([]);
});
