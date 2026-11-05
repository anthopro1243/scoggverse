#!/usr/bin/env node
// Re-encodes the committed gallery images with the current settings in scripts/lib/images.js,
// without the deck PDF: each slide's current full image is the source. Writes new file names
// (the -v<IMAGE_VERSION> part), updates src/data/memes.json, deletes the old files and rebuilds
// the share pages.   npm run reencode
// Prefer `npm run import-deck` when the PDF is on hand: it encodes from the original render.
// Ordinary tools only (sharp). Faces untouched: whole slides are resized; cards only lose plain
// white margins.
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { IMAGE_VERSION, imageName, parseImageName, writeFull, writeThumb } from "./lib/images.js";
import { buildShare } from "./share.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const PUB = join(ROOT, "public");
const memesPath = join(ROOT, "src/data/memes.json");
const memes = JSON.parse(readFileSync(memesPath, "utf8"));

let done = 0, kept = 0, bytes = 0;
const old = [];
for (const m of memes) {
  const cur = parseImageName(m.full.split("/").pop());
  if (!cur || cur.page !== m.page) throw new Error(`unexpected image name for page ${m.page}: ${m.full}`);
  if (cur.version === IMAGE_VERSION) { kept++; continue; }
  const name = imageName(m.page, cur.hash);
  const src = await sharp(join(PUB, m.full)).png().toBuffer(); // decode once, lossless from here
  const full = await writeFull(src, join(PUB, "memes/full", name));
  const thumb = await writeThumb(src, join(PUB, "memes/thumb", name));
  old.push(m.full, m.thumb);
  Object.assign(m, { w: full.w, h: full.h, tw: thumb.w, th: thumb.h, thumb: `/memes/thumb/${name}`, full: `/memes/full/${name}` });
  bytes += full.bytes + thumb.bytes;
  if (++done % 50 === 0) console.log(`${done} re-encoded…`);
}
for (const f of old) if (existsSync(join(PUB, f))) unlinkSync(join(PUB, f));
writeFileSync(memesPath, JSON.stringify(memes, null, 2) + "\n");
await buildShare();
console.log(`${done} re-encoded (${(bytes / 1e6).toFixed(1)} MB), ${kept} already current`);
