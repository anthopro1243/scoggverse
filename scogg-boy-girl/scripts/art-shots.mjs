#!/usr/bin/env node
// Art review shots: the title, the level select and a few levels at 1366 x 768.
// Usage: node scripts/art-shots.mjs <outDir> [url]   (needs `npx vite preview --port 4174` running)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] || "shots";
const url = process.argv[3] || "http://localhost:4174";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shots = [["title", "?test=1"], ["select", "?scene=select&test=1"], ["level-priming", "?level=priming&test=1"],
  ["level-layer-cake", "?level=layer-cake-marble-cake&test=1"], ["level-quaker", "?level=quaker-oats-incident&test=1"], ["level-factor", "?level=factor-market&test=1"]];
for (const [name, q] of shots) {
  await page.goto(`${url}/${q}`);
  await page.waitForFunction(() => window.__sbg?.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, `${name}.png`) });
}
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`saved ${shots.length} shots to ${out}`);
