#!/usr/bin/env node
// Frame rate on a mid-laptop profile: 1366x768, the integrated laptop GPU through Vulkan when
// there is one (else software WebGL), and the CPU slowed down 2x. Plays each level's replay in
// real time, one fixed step per frame, and reports frames per second and the slow frames.
//   node scripts/fps.mjs [base url] [levels...]     (default: the game's own preview)
// Example on the built site: node scripts/fps.mjs http://localhost:4173/scogg-boy-girl
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { replaySteps } from "../src/logic/replay.js";

const [base = "http://localhost:4174", ...picked] = process.argv.slice(2);
const ORDER = JSON.parse(readFileSync("levels/order.json", "utf8"));
const levels = picked.length ? picked : ORDER;
const browser = await chromium.launch({ args: ["--use-angle=vulkan", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

const gpu = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl");
  const e = gl?.getExtension("WEBGL_debug_renderer_info");
  return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "unknown";
});
console.log(`GPU: ${gpu}\nCPU: 2x slower\n`);
console.log("| Level | Frames | Average fps | Slowest frame | Frames over 20 ms |\n|---|---|---|---|---|");
const rows = [];
for (const level of levels) {
  await page.goto(`${base}/?test=1&level=${level}`);
  await page.waitForFunction(() => window.__sbg?.ready);
  await page.waitForTimeout(500);
  const steps = replaySteps(JSON.parse(readFileSync(`replays/${level}.json`, "utf8")));
  const r = await page.evaluate((steps) => new Promise((done) => {
    const keys = steps.flatMap(([n, k]) => Array(n).fill(k));
    const times = [];
    let i = 0, last = performance.now();
    const frame = (now) => {
      times.push(now - last); last = now;
      if (i < keys.length) window.__sbg.step(1, keys[i++]);
      if (i < keys.length || times.length < 60) requestAnimationFrame(frame);
      else done(times.slice(5));              // skip the first frames (texture uploads)
    };
    requestAnimationFrame(frame);
  }), steps);
  const avg = r.reduce((a, b) => a + b, 0) / r.length;
  const row = { level, frames: r.length, fps: 1000 / avg, worst: Math.max(...r), slow: r.filter((t) => t > 20).length };
  rows.push(row);
  console.log(`| ${level} | ${row.frames} | ${row.fps.toFixed(1)} | ${row.worst.toFixed(1)} ms | ${row.slow} |`);
}
await browser.close();
const all = rows.reduce((a, r) => a + r.frames, 0), slow = rows.reduce((a, r) => a + r.slow, 0);
console.log(`\nAll levels: ${(rows.reduce((a, r) => a + r.fps * r.frames, 0) / all).toFixed(1)} fps on average, ${slow} of ${all} frames over 20 ms. Errors: ${errors.length ? errors.join("; ") : "none"}`);
