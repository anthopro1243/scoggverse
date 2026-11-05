#!/usr/bin/env node
// Saves the G0 look sheet and the close-up of both heroes as PNGs. The look sheet is dev-only now.
// Usage: node scripts/look-sheet.mjs [outDir]   (needs `npm run dev` running, or SBG_URL pointing at
// a dev server)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] || "shots";
const url = process.env.SBG_URL || "http://localhost:5174";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${url}/?scene=look&test=1`);
await page.waitForFunction(() => window.__sbg?.ready && window.__sbg.scene === "look");
await page.waitForTimeout(300);
await page.locator("canvas").screenshot({ path: join(out, "look-sheet.png") });
// close-up: both heroes at 3x, side by side in the dark with their glow
await page.goto(`${url}/?scene=look&view=closeup&test=1`);
await page.waitForFunction(() => window.__sbg?.ready && window.__sbg.scene === "look");
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, "heads-closeup.png"), clip: { x: 360, y: 0, width: 1200, height: 1080 } });
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`saved ${out}/look-sheet.png and heads-closeup.png`);
