#!/usr/bin/env node
// Link previews for group chats, built with ordinary tools (sharp; no AI, faces untouched):
//   public/share-card.jpg            1200x630 card: three slides on the desk + the site name
//   public/s/<page>/index.html       a tiny page per slide with the slide's title, using the share
//                                    card as its picture, that sends people on to the gallery
//                                    viewer (#/scogg/<page>)
// One shared card instead of a JPEG per slide keeps 1,000 slides inside the size budget
// (scripts/lib/size.js). JPEG because not every chat app reads WebP.
// Runs at the end of `npm run import-deck`, or alone: npm run share-pages
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { fileNo } from "../src/js/text.js";

const ROOT = resolve(import.meta.dirname, "..");
const PUB = join(ROOT, "public");
export const CARD = { path: "/share-card.jpg", width: 1200, height: 630 };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function sharePage(m, { siteUrl, count }) {
  const title = esc(m.title);
  const img = `${siteUrl}${CARD.path}`;
  const url = `${siteUrl}/s/${m.page}/`;
  const desc = esc(`${fileNo(m.page)} from the class deck. ${count} Scoggs on file. Goal: 1,000.`);
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
<meta property="og:image:alt" content="The Scoggverse: slides from the class deck">
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

async function shareCard(memes, count) {
  // Three well-known slides as paper cards on the dark desk, and the site name in type.
  const want = ["Scogga Lisa", "Scoggcrates", "Scoggis Khan"];
  const picks = want.map((t) => memes.find((m) => m.title === t)).filter(Boolean);
  while (picks.length < 3) picks.push(memes[picks.length]);
  const W = CARD.width, H = CARD.height;
  const cards = await Promise.all(picks.map(async (m, i) => {
    const slide = await sharp(join(PUB, m.full)).resize({ width: 420 }).toBuffer();
    const meta = await sharp(slide).metadata();
    const pad = 14;
    const card = await sharp({ create: { width: meta.width + pad * 2, height: meta.height + pad * 2 + 30, channels: 4, background: "#f3ecdc" } })
      .composite([
        { input: slide, left: pad, top: pad + 30 },
        { input: Buffer.from(`<svg width="${meta.width}" height="30"><text x="0" y="21" font-family="DejaVu Sans Mono, monospace" font-size="17" fill="#c8242a">${fileNo(m.page)}</text></svg>`), left: pad, top: pad - 2 },
      ])
      .png().toBuffer();
    const angle = [-5, 2, 6][i];
    return sharp(card).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }));
  const title = Buffer.from(`<svg width="${W}" height="${H}">
    <text x="64" y="118" font-family="DejaVu Sans" font-size="24" letter-spacing="5" fill="#e2484c">CASE FILE: DR. SCOGGINS</text>
    <text x="60" y="200" font-family="DejaVu Serif" font-weight="bold" font-size="84" fill="#f1eadb">The Scoggverse</text>
    <text x="64" y="252" font-family="DejaVu Sans" font-size="30" fill="#ffd95a">${count} Scoggs on file, plus three games.</text>
  </svg>`);
  const desk = Buffer.from(`<svg width="${W}" height="${H}"><defs><radialGradient id="g" cx="50%" cy="-10%" r="90%"><stop offset="0" stop-color="#3a2c22"/><stop offset="1" stop-color="#120f0d"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><rect y="${H - 10}" width="${W}" height="10" fill="#dcc38d"/></svg>`);
  await sharp(desk)
    .composite([
      { input: title, left: 0, top: 0 },
      { input: cards[0], left: 40, top: 300 },
      { input: cards[1], left: 400, top: 320 },
      { input: cards[2], left: 760, top: 290 },
    ])
    .flatten({ background: "#120f0d" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(join(PUB, CARD.path.slice(1)));
}

export async function buildShare() {
  const config = JSON.parse(readFileSync(join(ROOT, "src/config.json"), "utf8"));
  const deck = JSON.parse(readFileSync(join(ROOT, "src/data/deck.json"), "utf8"));
  const memesPath = join(ROOT, "src/data/memes.json");
  const memes = JSON.parse(readFileSync(memesPath, "utf8"));
  // the same count the site shows (the slides in the gallery, not the hidden ones)
  const count = deck.shown.toLocaleString("en-US");
  // Per-slide preview JPEGs are gone (one shared card now); clear any left from older imports.
  rmSync(join(PUB, "memes/og"), { recursive: true, force: true });
  for (const m of memes) { delete m.og; delete m.ow; delete m.oh; }
  // Share pages: rewrite the folder so pages for hidden or removed slides disappear.
  rmSync(join(PUB, "s"), { recursive: true, force: true });
  for (const m of memes) {
    mkdirSync(join(PUB, "s", String(m.page)), { recursive: true });
    writeFileSync(join(PUB, "s", String(m.page), "index.html"), sharePage(m, { siteUrl: config.siteUrl, count }));
  }
  memes.sort((a, b) => a.page - b.page);
  writeFileSync(memesPath, JSON.stringify(memes, null, 2) + "\n");
  await shareCard(memes, count);
  console.log(`share: ${memes.length} share pages, plus share-card.jpg`);
}

if (process.argv[1] === import.meta.filename) buildShare().catch((e) => { console.error(e); process.exit(1); });
