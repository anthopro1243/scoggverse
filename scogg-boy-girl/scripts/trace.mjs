#!/usr/bin/env node
// Authoring aid for replays: plays a replay headless and prints where both heroes are at the end
// of each segment of each track. Usage: node scripts/trace.mjs replays/<name>.json [every]
// (needs `npm run preview`). With [every], also prints every N frames.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mergeTracks, replaySteps } from "../src/logic/replay.js";

const [file, every] = process.argv.slice(2);
const r = JSON.parse(readFileSync(file, "utf8"));
const url = process.env.SBG_URL || "http://localhost:4174";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("pageerror", (e) => console.log("ERROR", e.message));
await page.goto(`${url}/?test=1&level=${r.level}`);
await page.waitForFunction(() => window.__sbg?.ready);
const marks = new Map();
for (const who of ["boy", "girl"]) {
  let f = 0;
  (r[who] || []).forEach(([n, k], i) => { f += n; marks.set(f, [...(marks.get(f) || []), `${who}#${i} ${k.join("+") || "-"}`]); });
}
const flat = [];
for (const [n, k] of replaySteps(r)) for (let i = 0; i < n; i++) flat.push(k);
const fmt = (p) => `${p.who[0]} x${(p.x + 10).toFixed(0)} y${(p.y + 52).toFixed(0)} ${p.pose}${p.dead ? " DEAD" : ""}${p.atDoor ? " DOOR" : ""}`;
let s;
for (let f = 0; f < flat.length; f++) {
  s = await page.evaluate((k) => window.__sbg.step(1, k), flat[f]);
  if (marks.has(f + 1) || (every && (f + 1) % +every === 0)) console.log(String(f + 1).padStart(5), s.state.padEnd(6), s.players.map(fmt).join(" | "), "  ", (marks.get(f + 1) || []).join(", "));
}
console.log("END", JSON.stringify({ state: s.state, bucks: s.bucks, gavels: s.gavels, time: s.time, result: s.result && { grade: s.result.grade, value: s.result.value } }));
await browser.close();
