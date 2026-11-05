#!/usr/bin/env node
// Contact sheets for the visual safety pass: 48 small slides per sheet, each labeled with its page.
//   node scripts/contact-sheets.mjs --out=<dir>            every page of the newest render (all slides, for checking)
//   node scripts/contact-sheets.mjs --out=<dir> --shown    only the slides in src/data/memes.json (safe to share)
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const ROOT = resolve(import.meta.dirname, "..");
const out = resolve(args.out || "sheets");
const COLS = 8, ROWS = 6, W = 300, H = 169, LABEL = 26, GAP = 6;
mkdirSync(out, { recursive: true });

let items;
if (args.shown) {
  const memes = JSON.parse(readFileSync(join(ROOT, "src/data/memes.json"), "utf8"));
  items = memes.map((m) => ({ page: m.page, file: join(ROOT, "public", m.thumb) }));
} else {
  const cache = join(homedir(), ".cache/scoggverse");
  const dir = readdirSync(cache).filter((d) => d.startsWith("render-")).map((d) => join(cache, d)).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (!dir || !existsSync(dir)) throw new Error("no render cache; run npm run import-deck first");
  items = readdirSync(dir).filter((f) => f.endsWith(".png")).sort().map((f, i) => ({ page: i + 1, file: join(dir, f) }));
}
if (args.from) items = items.filter((i) => i.page >= Number(args.from));
if (args.to) items = items.filter((i) => i.page <= Number(args.to));

const per = COLS * ROWS;
for (let s = 0; s * per < items.length; s++) {
  const chunk = items.slice(s * per, (s + 1) * per);
  const cells = await Promise.all(chunk.map(async (it, i) => {
    const x = GAP + (i % COLS) * (W + GAP), y = GAP + Math.floor(i / COLS) * (H + LABEL + GAP);
    const img = await sharp(it.file).resize(W, H, { fit: "contain", background: "#222" }).png().toBuffer();
    const label = Buffer.from(`<svg width="${W}" height="${LABEL}"><rect width="100%" height="100%" fill="#111"/><text x="6" y="19" font-family="DejaVu Sans, sans-serif" font-size="17" font-weight="bold" fill="#ffd95a">#${it.page}</text></svg>`);
    return [{ input: img, left: x, top: y }, { input: label, left: x, top: y + H }];
  }));
  const width = GAP + COLS * (W + GAP), height = GAP + ROWS * (H + LABEL + GAP);
  const file = join(out, `sheet-${String(s + 1).padStart(2, "0")}-p${chunk[0].page}-${chunk.at(-1).page}.png`);
  await sharp({ create: { width, height, channels: 3, background: "#000" } }).composite(cells.flat()).png().toFile(file);
  console.log(file);
}
