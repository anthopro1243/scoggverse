#!/usr/bin/env node
// Art review shots: the title, a run in progress (the F0 replay) and the game-over card, on a
// laptop (1366 x 768) and a phone (375 x 812).
// Usage: node scripts/art-shots.mjs <outDir> [url]   (needs `npx vite preview --port 4175` running)
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] || "shots";
const url = process.argv[3] || "http://localhost:4175";
const replay = JSON.parse(readFileSync(new URL("../replays/f0.json", import.meta.url), "utf8"));
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
for (const [size, viewport] of [["laptop", { width: 1366, height: 768 }], ["phone", { width: 375, height: 812 }]]) {
  const page = await browser.newPage({ viewport, isMobile: size === "phone", hasTouch: size === "phone" });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${url}/?test=1`);
  await page.waitForFunction(() => window.__fs?.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `title-${size}.png`) });
  await page.evaluate((r) => window.__fs.replay(r, 900), replay);
  await page.screenshot({ path: join(out, `run-${size}.png`) });
  await page.evaluate(() => { window.__fs.reset({ seed: "art" }); window.__fs.step(1, true); return window.__fs.step(400); });
  await page.screenshot({ path: join(out, `over-${size}.png`) });
  await page.close();
}
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`saved shots to ${out}`);
