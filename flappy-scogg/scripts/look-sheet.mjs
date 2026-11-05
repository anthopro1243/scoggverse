#!/usr/bin/env node
// The F0 look sheet: each face candidate in flight past the columns, the title screen and the
// game-over card, at phone size (375x812) and laptop size (1366x768), on one labeled PNG.
// Every shot comes from the deterministic replay, so the sheet is the same each time.
// Usage: node scripts/look-sheet.mjs <out dir>   (needs `npm run preview` or FS_URL)
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGame, stepGame } from "../src/logic/game.ts";
import { FACE_X } from "../src/logic/config.ts";

const out = resolve(process.argv[2] || "look");
mkdirSync(out, { recursive: true });
const url = process.env.FS_URL || "http://localhost:4175";
const replay = JSON.parse(readFileSync(new URL("../replays/f0.json", import.meta.url), "utf8"));

// the flight shot: the first moment, in every face's run, with a bronze column on screen ahead
// and the face between the capitals of the column it's passing
function flightStep() {
  for (let s = 400; s < replay.steps; s += 2) {
    const ok = ["a", "b", "c"].every((face) => {
      const g = createGame({ seed: replay.seed, face });
      const taps = new Set(replay.taps);
      for (let i = 1; i <= s; i++) stepGame(g, taps.has(i));
      if (g.phase !== "playing") return false;
      const here = g.columns.find((c) => Math.abs(c.x + 34 - FACE_X) < 20);
      const bronze = g.columns.find((c) => c.bronze && c.x > FACE_X + 80 && c.x < 330);
      return here && bronze;
    });
    if (ok) return s;
  }
  return 900;
}
const FLIGHT = flightStep();

const browser = await chromium.launch();
const shots = [];
for (const [device, vp] of [["phone", { width: 375, height: 812, isMobile: true, hasTouch: true }], ["laptop", { width: 1366, height: 768 }]]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const touch = device === "phone" ? 1 : 0;
  const shoot = async (name, query, fn) => {
    await page.goto(`${url}/?test=1&touch=${touch}&${query}`);
    await page.waitForFunction(() => window.__fs?.ready);
    await page.evaluate(fn[0], fn[1]);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const path = join(out, `${device}-${name}.png`);
    await page.screenshot({ path });
    shots.push({ device, name, path });
  };
  for (const face of ["a", "b", "c"]) {
    await shoot(`face-${face}`, `face=${face}`, [([r, f, n]) => window.__fs.replay({ ...r, face: f }, n), [replay, face, FLIGHT]]);
  }
  await shoot("title", "face=a", [([r]) => { window.__fs.replay(r); window.__fs.reset(); }, [replay]]);
  await shoot("card", "face=a", [([r]) => window.__fs.replay(r), [replay]]);
  await ctx.close();
}
await browser.close();

// lay them out with Pillow: the phone row, then the laptop shots two to a row
const compose = `
import json, sys
from PIL import Image, ImageDraw, ImageFont
shots, out = json.loads(sys.argv[1]), sys.argv[2]
try:
    font = ImageFont.truetype("DejaVuSans-Bold.ttf", 22); small = ImageFont.truetype("DejaVuSans.ttf", 18)
except OSError:
    font = small = ImageFont.load_default()
names = {"face-a": "Face A in flight (in the game now)", "face-b": "Face B in flight", "face-c": "Face C in flight", "title": "Title screen", "card": "Game-over card"}
short = {"face-a": "Face A", "face-b": "Face B", "face-c": "Face C", "title": "Title", "card": "Game over"}
phone = [s for s in shots if s["device"] == "phone"]
laptop = [s for s in shots if s["device"] == "laptop"]
P, PW, PH = 0.72, int(375 * 0.72), int(812 * 0.72)
L, LW, LH = 0.53, int(1366 * 0.53), int(768 * 0.53)
gap, head = 20, 34
W = max(len(phone) * (PW + gap) + gap, 2 * (LW + gap) + gap)
rows = (len(laptop) + 1) // 2
faces = [Image.open(f).convert("RGBA") for f in json.loads(sys.argv[3])]
CH = 230  # the close-up row: each crop as cut from the slide, scaled evenly
H = 60 + head + PH + gap + 50 + rows * (LH + head + gap) + gap + 50 + CH + gap
sheet = Image.new("RGB", (W, H), (24, 20, 17))
d = ImageDraw.Draw(sheet)
d.text((gap, 18), "Flappy Scogg, F0 look sheet. Top: phone 375x812. Below: laptop 1366x768.", font=font, fill=(243, 213, 139))
y = 60
for i, s in enumerate(phone):
    x = gap + i * (PW + gap)
    d.text((x, y), short[s["name"]], font=small, fill=(232, 220, 192))
    sheet.paste(Image.open(s["path"]).convert("RGB").resize((PW, PH), Image.LANCZOS), (x, y + head))
y += head + PH + gap + 20
d.text((gap, y), "Laptop", font=font, fill=(243, 213, 139))
y += 30
for i, s in enumerate(laptop):
    x = gap + (i % 2) * (LW + gap)
    yy = y + (i // 2) * (LH + head + gap)
    d.text((x, yy), names[s["name"]], font=small, fill=(232, 220, 192))
    sheet.paste(Image.open(s["path"]).convert("RGB").resize((LW, LH), Image.LANCZOS), (x, yy + head))
y = y + rows * (LH + head + gap) + 10
d.text((gap, y), "The three faces up close, as cut from the slide (A is in the game now; pick one)", font=font, fill=(243, 213, 139))
y += 40
x = gap
for name, f in zip("ABC", faces):
    k = min((CH - 40) / f.height, 420 / f.width)
    f = f.resize((round(f.width * k), round(f.height * k)), Image.LANCZOS)
    d.text((x, y), name, font=font, fill=(232, 220, 192))
    sheet.paste(f, (x + 30, y), f)
    x += f.width + 70
sheet.save(out, optimize=True)
print(out, sheet.size)
`;
const faces = ["a", "b", "c"].map((f) => fileURLToPath(new URL(`../assets/faces/face-${f}.png`, import.meta.url)));
execFileSync("python3", ["-c", compose, JSON.stringify(shots), join(out, "look-sheet.png"), JSON.stringify(faces)], { stdio: "inherit" });
console.log(`flight shot at step ${FLIGHT}`);
