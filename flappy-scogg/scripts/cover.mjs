#!/usr/bin/env node
// The picture on the site: one frame of the F0 replay in flight (the face between two capitals,
// a bronze column ahead), 540x960, saved as WebP to ../site/public/art/fs-cover.webp. The play
// page shows it whole behind its Play button; the Play page's case file 3 card shows a band of it.
// Usage: node scripts/cover.mjs [step]   (needs `npm run preview` or FS_URL)
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const STEP = +(process.argv[2] || 1100);
const url = process.env.FS_URL || "http://localhost:4175";
const out = fileURLToPath(new URL("../../site/public/art/fs-cover.webp", import.meta.url));
const replay = JSON.parse(readFileSync(new URL("../replays/f0.json", import.meta.url), "utf8"));
const tmp = mkdtempSync(join(tmpdir(), "fs-cover-"));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 405, height: 720 }, deviceScaleFactor: 960 / 720 });
await page.goto(`${url}/?test=1&touch=1`);
await page.waitForFunction(() => window.__fs?.ready);
await page.evaluate(([r, s]) => window.__fs.replay(r, s), [replay, STEP]);
await page.evaluate(() => { document.getElementById("hud").hidden = true; }); // just the scene, no buttons
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const png = join(tmp, "cover.png");
await page.locator("canvas").screenshot({ path: png });
await browser.close();
execFileSync("python3", ["-c", `
import sys
from PIL import Image
Image.open(sys.argv[1]).convert("RGB").resize((540, 960), Image.LANCZOS).save(sys.argv[2], "WEBP", quality=52, method=6)
`, png, out]);
rmSync(tmp, { recursive: true });
execFileSync("python3", [fileURLToPath(new URL("../../tools/strip_metadata.py", import.meta.url)), out]);
console.log(`${out}: ${(statSync(out).size / 1e3).toFixed(1)} KB (replay step ${STEP})`);
