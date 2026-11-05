#!/usr/bin/env node
// Site art made from the game's existing images with ordinary tools (resize + compress, sharp).
// Faces are never edited. Re-run after the game's art changes: node scripts/build-art.mjs
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const GAME = resolve(import.meta.dirname, "../..");
const OUT = resolve(import.meta.dirname, "../public/art");
mkdirSync(join(OUT, "cast"), { recursive: true });

const jobs = [
  // The office's 1917-style "I WANT YOU" poster (built from the class deck's p. 61).
  { src: "art/textures/poster_uncle.png", out: "poster-uncle.webp", width: 640, quality: 82 },
  // The game's title screen, shown behind the Play button before the game loads.
  { src: "Graphics/Scogg/ui/title.webp", out: "game-title.webp", width: 1280, quality: 74 },
  // The office from the game, cropped to the desk, for the game card on Home.
  { src: "Graphics/Scogg/office/office.webp", out: "game-office.webp", extract: { left: 600, top: 250, width: 1800, height: 1012 }, width: 960, quality: 76 },
  // The standees (cut from the classmates' slides for the game), for the cast cards.
  ...["scoggcrates", "scogga_lisa", "scoggis_khan", "uncle_scogg"].map((n) => ({ src: `art/cutouts/${n}.png`, out: `cast/${n}.webp`, height: 520, quality: 82 })),
];

for (const j of jobs) {
  let img = sharp(join(GAME, j.src));
  if (j.extract) img = img.extract(j.extract);
  const info = await img
    .resize({ width: j.width, height: j.height, fit: "inside", withoutEnlargement: true })
    .webp({ quality: j.quality, alphaQuality: 90, effort: 5 })
    .toFile(join(OUT, j.out));
  console.log(`${j.out}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB`);
}
