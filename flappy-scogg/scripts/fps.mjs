#!/usr/bin/env node
// Frame rate on two profiles, the same way as the platformer's check: a mid laptop (1366x768, the
// CPU slowed 2x) and a mid phone (375x812 at 2x pixels, touch, the CPU slowed 4x). Plays the F0
// replay in real time, one fixed step per frame, and reports frames per second and slow frames.
//   node scripts/fps.mjs [base url]     (default: the game's own preview)
// Example on the built site: node scripts/fps.mjs http://localhost:4173/flappy-scogg
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const [base = "http://localhost:4175"] = process.argv.slice(2);
const replay = JSON.parse(readFileSync(new URL("../replays/f0.json", import.meta.url), "utf8"));
const PROFILES = [
  { name: "mid laptop", viewport: { width: 1366, height: 768 }, scale: 1, mobile: false, cpu: 2 },
  { name: "mid phone", viewport: { width: 375, height: 812 }, scale: 2, mobile: true, cpu: 4 },
];
const browser = await chromium.launch({ args: ["--use-angle=vulkan", "--enable-gpu", "--ignore-gpu-blocklist"] });
const errors = [];
console.log("| Profile | Frames | Average fps | Slowest frame | Frames over 20 ms |\n|---|---|---|---|---|");
const rows = [];
for (const p of PROFILES) {
  const ctx = await browser.newContext({ viewport: p.viewport, deviceScaleFactor: p.scale, isMobile: p.mobile, hasTouch: p.mobile });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: p.cpu });
  await page.goto(`${base}/?test=1`);
  await page.waitForFunction(() => window.__fs?.ready);
  await page.waitForTimeout(500);
  const times = await page.evaluate((r) => new Promise((done) => {
    window.__fs.reset({ seed: r.seed });
    const taps = new Set(r.taps);
    const out = [];
    let s = 0, last = performance.now();
    const frame = (now) => {
      out.push(now - last); last = now;
      s++;
      if (s <= r.steps) window.__fs.step(1, taps.has(s));
      if (s <= r.steps) requestAnimationFrame(frame);
      else done(out.slice(5)); // skip the first frames
    };
    requestAnimationFrame(frame);
  }), replay);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const row = { name: p.name, frames: times.length, fps: 1000 / avg, worst: Math.max(...times), slow: times.filter((t) => t > 20).length };
  rows.push(row);
  console.log(`| ${row.name} (CPU ${p.cpu}x slower) | ${row.frames} | ${row.fps.toFixed(1)} | ${row.worst.toFixed(1)} ms | ${row.slow} |`);
  await ctx.close();
}
await browser.close();
console.log(`\nErrors: ${errors.length ? errors.join("; ") : "none"}`);
