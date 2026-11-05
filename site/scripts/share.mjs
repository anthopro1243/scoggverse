#!/usr/bin/env node
// Link previews for group chats, built with ordinary tools (sharp; no AI, faces untouched):
//   public/share-card.jpg            1200x630 card: the Uncle Scogg poster on the dark background + the site name
//   public/s/<page>/index.html       a tiny page per slide with the slide's title, using the share
//                                    card as its picture, that sends people on to the gallery
//                                    viewer (#/scogg/<page>)
// One shared card instead of a JPEG per slide keeps 1,000 slides inside the size budget
// (scripts/lib/size.js). JPEG because not every chat app reads WebP.
// Runs at the end of `npm run import-deck`, or alone: npm run share-pages
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(import.meta.dirname, "..");
const PUB = join(ROOT, "public");
export const CARD = { path: "/share-card.jpg", width: 1200, height: 630 };
export const ALT = "The Uncle Scogg poster: I want you to not deny yourself an education";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function sharePage(m, { siteUrl }) {
  const title = esc(m.title);
  const img = `${siteUrl}${CARD.path}`;
  const url = `${siteUrl}/s/${m.page}/`;
  const desc = title;
  const go = `/gallery/#/scogg/${m.page}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · The Scogg Files</title>
<meta name="description" content="${desc}">
<meta name="robots" content="noindex">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Scoggverse">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="${CARD.width}">
<meta property="og:image:height" content="${CARD.height}">
<meta property="og:image:alt" content="${ALT}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${go}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head>
<body>
<p><a href="${go}">Open ${title} in the Scogg Files</a></p>
</body>
</html>
`;
}

async function shareCard() {
  // The Uncle Scogg poster as it is (scaled, nothing else done to it) on the site's dark
  // background, and the site name in the site's typewriter font. librsvg needs Special Elite as
  // a system font: a TTF in ~/.local/share/fonts, unpacked from @fontsource's WOFF (it can't read
  // WOFF). Without it the name falls back to a plain mono; check the card by eye.
  const W = CARD.width, H = CARD.height;
  const poster = await sharp(join(PUB, "art/poster-uncle.webp")).resize({ height: H - 60 }).toBuffer();
  const pw = (await sharp(poster).metadata()).width;
  const name = Buffer.from(`<svg width="${W - pw - 120}" height="${H}">
    <text x="0" y="${H / 2 + 24}" font-family="Special Elite, DejaVu Sans Mono, monospace" font-size="76" fill="#f1eadb">The Scoggverse</text>
  </svg>`);
  await sharp({ create: { width: W, height: H, channels: 3, background: "#120f0d" } })
    .composite([
      { input: poster, left: 60, top: 30 },
      { input: name, left: pw + 120, top: 0 },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(join(PUB, CARD.path.slice(1)));
}

export async function buildShare() {
  const config = JSON.parse(readFileSync(join(ROOT, "src/config.json"), "utf8"));
  const memesPath = join(ROOT, "src/data/memes.json");
  const memes = JSON.parse(readFileSync(memesPath, "utf8"));
  // Per-slide preview JPEGs are gone (one shared card now); clear any left from older imports.
  rmSync(join(PUB, "memes/og"), { recursive: true, force: true });
  for (const m of memes) { delete m.og; delete m.ow; delete m.oh; }
  // Share pages: rewrite the folder so pages for hidden or removed slides disappear.
  rmSync(join(PUB, "s"), { recursive: true, force: true });
  for (const m of memes) {
    mkdirSync(join(PUB, "s", String(m.page)), { recursive: true });
    writeFileSync(join(PUB, "s", String(m.page), "index.html"), sharePage(m, { siteUrl: config.siteUrl }));
  }
  memes.sort((a, b) => a.page - b.page);
  writeFileSync(memesPath, JSON.stringify(memes, null, 2) + "\n");
  await shareCard();
  console.log(`share: ${memes.length} share pages, plus share-card.jpg`);
}

if (process.argv[1] === import.meta.filename) buildShare().catch((e) => { console.error(e); process.exit(1); });
