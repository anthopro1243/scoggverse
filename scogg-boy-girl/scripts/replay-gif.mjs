#!/usr/bin/env node
// Makes a GIF from a deterministic replay (never a live screen recording): steps the game frame by
// frame with the scripted keys, screenshots every few steps, then ffmpeg builds the GIF.
// Usage: node scripts/replay-gif.mjs replays/priming.json out.gif [speed] [hold]   (needs `npm run preview` or SBG_URL)
//   speed: playback speed (1 = real time), hold: seconds to hold the last frame (e.g. the end card)
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { replaySteps } from "../src/logic/replay.js";

const [replayPath, out = "replay.gif", speed = "1", hold = "0"] = process.argv.slice(2);
const replay = JSON.parse(readFileSync(replayPath, "utf8"));
const url = process.env.SBG_URL || "http://localhost:4174";
const EVERY = +(process.env.GIF_EVERY || 3); // 60 Hz simulation -> 20 fps GIF (GIF_EVERY=4 -> 15 fps, smaller)
const WIDTH = +(process.env.GIF_WIDTH || 720);
const COLORS = +(process.env.GIF_COLORS || 128);
const tmp = mkdtempSync(join(tmpdir(), "sbg-gif-"));
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto(`${url}/?test=1&level=${replay.level || "priming"}`);
await page.waitForFunction(() => window.__sbg?.ready);
let n = 0;
const shot = async () => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.locator("canvas").screenshot({ path: join(tmp, `f${String(n++).padStart(4, "0")}.png`) });
};
await shot();
for (const [frames, keys] of replaySteps(replay)) {
  for (let i = 0; i < frames; i += EVERY) {
    await page.evaluate(([k, s]) => window.__sbg.step(s, k), [keys, Math.min(EVERY, frames - i)]);
    await shot();
  }
}
await browser.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String((60 / EVERY) * +speed), "-i", join(tmp, "f%04d.png"),
  "-vf", `tpad=stop_mode=clone:stop_duration=${+hold},scale=${WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${COLORS}:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
  out]);
rmSync(tmp, { recursive: true });
console.log(`${out}: ${n} frames, ${(n * EVERY / 60 / +speed + +hold).toFixed(1)} s, ${(statSync(out).size / 1e6).toFixed(2)} MB`);
