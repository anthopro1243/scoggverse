#!/usr/bin/env node
// Deploy size report for dist/ (run after npm run build): total, game, images, file count, and the
// projected size at the class goal of 1,000 slides against the budget in scripts/lib/size.js.
//   npm run size              print the table
//   npm run size -- --check   also exit 1 when the projection is over budget
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { BUDGET, project } from "./lib/size.js";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(DIST).map((p) => ({ p: p.slice(DIST.length).replace(/\\/g, "/"), size: statSync(p).size }));
const sum = (list) => list.reduce((a, f) => a + f.size, 0);
const mb = (b) => `${(b / 1e6).toFixed(1)} MB`;
const groups = {
  "game (/game/)": files.filter((f) => f.p.startsWith("/game/")),
  "slides, full (WebP)": files.filter((f) => f.p.startsWith("/memes/full/")),
  "slides, thumbs (WebP)": files.filter((f) => f.p.startsWith("/memes/thumb/")),
  "slides, previews (JPEG)": files.filter((f) => f.p.startsWith("/memes/og/")),
  "share pages (/s/)": files.filter((f) => f.p.startsWith("/s/")),
};
const rest = files.filter((f) => !Object.values(groups).flat().includes(f));
console.log(`| Part | Files | Size |\n|---|---|---|`);
for (const [k, v] of Object.entries(groups)) if (v.length) console.log(`| ${k} | ${v.length} | ${mb(sum(v))} |`);
console.log(`| site pages, CSS, JS, fonts, art | ${rest.length} | ${mb(sum(rest))} |`);
console.log(`| **Total** | **${files.length}** | **${mb(sum(files))}** |`);

const shown = JSON.parse(readFileSync(join(ROOT, "src/data/memes.json"), "utf8")).length;
const p = project(files, shown);
console.log(`\nPer slide: ${(p.each / 1e3).toFixed(1)} KB (image, thumbnail, share page, list entry), ${shown} shown.`);
console.log(`At ${BUDGET.slides.toLocaleString("en-US")} slides: ${mb(p.projected)}. Budget ${mb(p.budget)} (${mb(BUDGET.limitBytes)} with ${BUDGET.headroom * 100}% headroom): ${p.fits ? "fits" : "OVER BUDGET"}.`);
console.log(`Room for about ${p.roomFor.toLocaleString("en-US")} slides inside the budget.`);
if (process.argv.includes("--check") && !p.fits) process.exit(1);
