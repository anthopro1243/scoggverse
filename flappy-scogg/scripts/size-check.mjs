#!/usr/bin/env node
// Fails if the built game (dist/) is over its 1 MB budget. The whole site sits close to Vercel
// Hobby's 100 MB limit, so the phone game has to stay tiny. Run after `npm run build`.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const BUDGET = 1_000_000; // bytes
const dist = resolve(import.meta.dirname, "..", "dist");
if (!existsSync(dist)) { console.error("no dist/: run npm run build first"); process.exit(1); }
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(dist).map((p) => ({ p: p.slice(dist.length + 1), b: statSync(p).size })).sort((a, b) => b.b - a.b);
const total = files.reduce((s, f) => s + f.b, 0);
for (const f of files.slice(0, 6)) console.log(`${(f.b / 1e3).toFixed(1).padStart(7)} KB  ${f.p}`);
console.log(`game: ${(total / 1e3).toFixed(1)} KB in ${files.length} files (budget ${(BUDGET / 1e6).toFixed(1)} MB)`);
if (total > BUDGET) { console.error("over budget"); process.exit(1); }
