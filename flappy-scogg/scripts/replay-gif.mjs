#!/usr/bin/env node
// Makes the review GIF from a deterministic replay (never a live screen recording): steps the
// game frame by frame with the recorded taps, screenshots every few steps, then ffmpeg builds the
// GIF. Real speed, so the flap can be judged; a run longer than 10 s is shown as its opening and
// its ending (the last columns, the hit and the card), with a cut between them.
// Usage: node scripts/replay-gif.mjs replays/f0.json out.gif [open seconds] [end seconds]
//   (needs `npm run preview` or FS_URL; GIF_EVERY, GIF_WIDTH, GIF_COLORS to shrink it)
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { playReplay } from "../src/logic/replay.ts";

const [replayPath, out = "replay.gif", openS = "7", endS = "3"] = process.argv.slice(2);
const replay = JSON.parse(readFileSync(replayPath, "utf8"));
const url = process.env.FS_URL || "http://localhost:4175";
const EVERY = +(process.env.GIF_EVERY || 4); // 60 Hz simulation -> 15 fps GIF (the whole scene scrolls, so every frame costs)
const WIDTH = +(process.env.GIF_WIDTH || 320);
const COLORS = +(process.env.GIF_COLORS || 128);
const DITHER = process.env.GIF_DITHER || "none"; // the night sky is mostly flat, so no dither keeps the GIF small

// when the run ends, so the ending segment holds the hit and the card
let hit = replay.steps;
playReplay(replay, (g) => { if (g.phase === "over" && hit === replay.steps) hit = g.frame; });
const openSteps = Math.round(+openS * 60);
const endFrom = Math.max(openSteps, Math.min(replay.steps, hit + 120) - Math.round(+endS * 60));
const endTo = Math.min(replay.steps, endFrom + Math.round(+endS * 60));

const tmp = mkdtempSync(join(tmpdir(), "fs-gif-"));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 405, height: 720 } });
await page.goto(`${url}/?test=1&touch=1&face=${replay.face}`);
await page.waitForFunction(() => window.__fs?.ready);
let n = 0;
const shot = async () => {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  await page.locator("canvas").screenshot({ path: join(tmp, `f${String(n++).padStart(4, "0")}.png`) });
};
const segments = endFrom > openSteps ? [[0, openSteps], [endFrom, endTo]] : [[0, endTo]];
for (const [from, to] of segments) {
  await page.evaluate(([r, s]) => window.__fs.replay(r, s), [replay, from]);
  for (let s = from; s < to; s += EVERY) {
    await page.evaluate(([r, s]) => window.__fs.replay(r, s), [replay, s]); // replays from the start: exact at any step
    await shot();
  }
}
await browser.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(60 / EVERY), "-i", join(tmp, "f%04d.png"),
  "-vf", `scale=${WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${COLORS}:stats_mode=diff[p];[b][p]paletteuse=dither=${DITHER}:diff_mode=rectangle`,
  out]);
rmSync(tmp, { recursive: true });
console.log(`${out}: ${n} frames, ${(n * EVERY / 60).toFixed(1)} s, ${(statSync(out).size / 1e6).toFixed(2)} MB (steps 0-${openSteps}${segments.length > 1 ? `, then ${endFrom}-${endTo}; hit at ${hit}` : ""})`);
