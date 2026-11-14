#!/usr/bin/env node
// Turns the class deck PDF into the gallery: compressed WebP slides + src/data/memes.json.
// Full images (the viewer) keep the whole slide; thumbnails (the cards) trim plain white margins.
//   npm run import-deck                 (auto-detects the newest full deck in ~/Downloads)
//   npm run import-deck -- <path.pdf>
// Idempotent: re-running with a newer PDF updates everything and removes stale images.
// Ordinary tools only (poppler renders the pages, sharp resizes and compresses).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync, createReadStream } from "node:fs";
import { homedir, cpus } from "node:os";
import { basename, join, resolve } from "node:path";
import sharp from "sharp";
import { pickDeck, titleFromBlocks, parseTerms, textSafety } from "./lib/deck.js";
import { parseLayout } from "./lib/layout.js";
import { imageName, writeFull, writeThumb } from "./lib/images.js";
import { buildShare } from "./share.mjs";

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "..");
const PUB = join(ROOT, "public/memes");
const CACHE = join(homedir(), ".cache/scoggverse");
const TERMS = process.env.SCOGGVERSE_TERMS || join(homedir(), ".config/scoggverse/private-terms.txt");
const SEARCH_DIRS = [join(homedir(), "Downloads/The Scogg Files"), join(homedir(), "Downloads")];
// Pages render at 1600 px; the render's hash names the images, so keep this fixed (changing it would
// rename every image). Image sizes and quality live in scripts/lib/images.js.
const RENDER_EDGE = 1600;
const MIN_PAGES = 300;

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback);
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

async function pageCount(file) {
  try {
    const { stdout } = await run("pdfinfo", [file]);
    return Number(/^Pages:\s+(\d+)/m.exec(stdout)?.[1]);
  } catch {
    return NaN; // truncated exports don't open
  }
}

async function findDeck() {
  const candidates = [];
  for (const dir of SEARCH_DIRS) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.toLowerCase().endsWith(".pdf") || /^copy of/i.test(name)) continue;
      const path = join(dir, name);
      candidates.push({ name, path, mtimeMs: statSync(path).mtimeMs, pages: await pageCount(path) });
    }
  }
  return pickDeck(candidates);
}

function sha256File(file) {
  return new Promise((ok, fail) => {
    const h = createHash("sha256");
    createReadStream(file).on("data", (d) => h.update(d)).on("end", () => ok(h.digest("hex"))).on("error", fail);
  });
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

async function render(pdf, pages, dir) {
  mkdirSync(dir, { recursive: true });
  const done = readdirSync(dir).filter((f) => f.endsWith(".png")).length;
  if (done === pages) return;
  const jobs = Math.max(1, Math.min(6, cpus().length));
  const per = Math.ceil(pages / jobs);
  console.log(`rendering ${pages} pages with pdftoppm (${jobs} jobs)…`);
  await Promise.all(Array.from({ length: jobs }, (_, j) => {
    const f = j * per + 1, l = Math.min(pages, (j + 1) * per);
    return f <= l ? run("pdftoppm", ["-f", String(f), "-l", String(l), "-scale-to", String(RENDER_EDGE), "-png", pdf, join(dir, "p")], { maxBuffer: 1 << 26 }) : null;
  }));
}

async function main() {
  const arg = process.argv[2];
  const deck = arg ? { path: resolve(arg), name: basename(arg), pages: await pageCount(resolve(arg)) } : await findDeck();
  if (!deck || !(deck.pages >= MIN_PAGES)) {
    console.error(`BLOCKED: deck PDF not found (need a PDF with ${MIN_PAGES}+ pages; ignoring "Copy of" files)`);
    process.exit(1);
  }
  console.log(`deck: ${deck.name} (${deck.pages} pages)`);

  const pdfHash = (await sha256File(deck.path)).slice(0, 12);
  const renderDir = join(CACHE, `render-${pdfHash}`);
  await render(deck.path, deck.pages, renderDir);
  const pngs = readdirSync(renderDir).filter((f) => f.endsWith(".png")).sort();
  if (pngs.length !== deck.pages) throw new Error(`expected ${deck.pages} renders, found ${pngs.length}`);

  const layoutFile = join(CACHE, `layout-${pdfHash}.html`);
  if (!existsSync(layoutFile)) await run("pdftotext", ["-bbox-layout", deck.path, layoutFile], { maxBuffer: 1 << 26 });
  const layout = parseLayout(readFileSync(layoutFile, "utf8"));

  const hidden = new Map(readJson(join(ROOT, "content/hidden.json"), []).map((h) => [h.page, h.reason]));
  const overrides = readJson(join(ROOT, "content/overrides.json"), {});
  const termsFound = existsSync(TERMS);
  if (!termsFound) console.warn(`warning: ${TERMS} not found; the private-term check is skipped`);
  const terms = termsFound ? parseTerms(readFileSync(TERMS, "utf8")) : [];

  const skipped = [], hiddenOut = [], memes = [], seen = new Map();
  for (let page = 1; page <= deck.pages; page++) {
    const png = join(renderDir, pngs[page - 1]);
    const blocks = layout[page - 1] || [];
    const text = blocks.flat().join("\n");
    const hash = (await sha256File(png)).slice(0, 8);
    const { channels } = await sharp(png).greyscale().resize(96, 54, { fit: "fill" }).stats();
    const flat = channels[0].stdev < 4;

    if (page === 1) { skipped.push({ page, reason: "title slide" }); continue; }
    if (/scoggstitution/i.test(text)) { skipped.push({ page, reason: "rules slide" }); continue; }
    if (flat && !text.trim()) { skipped.push({ page, reason: "blank" }); continue; }
    if (flat && text.replace(/\s/g, "").length < 4) { skipped.push({ page, reason: "near-blank" }); continue; }
    if (seen.has(hash)) { skipped.push({ page, reason: `exact duplicate of page ${seen.get(hash)}` }); continue; }
    seen.set(hash, page);

    if (hidden.has(page)) { hiddenOut.push({ page, reason: hidden.get(page), by: "hidden.json" }); continue; }
    const unsafe = textSafety(text, terms);
    if (unsafe) { hiddenOut.push({ page, reason: unsafe, by: "auto" }); continue; }

    const title = overrides[page] || titleFromBlocks(blocks, page);
    memes.push({ page, title, hash, png });
  }

  mkdirSync(join(PUB, "full"), { recursive: true });
  mkdirSync(join(PUB, "thumb"), { recursive: true });
  const keep = new Set();
  const out = [];
  let bytes = 0;
  await pool(memes, 4, async (m) => {
    const name = imageName(m.page, m.hash);
    keep.add(name);
    const fullPath = join(PUB, "full", name), thumbPath = join(PUB, "thumb", name);
    const full = existsSync(fullPath) ? await sharp(fullPath).metadata().then((d) => ({ w: d.width, h: d.height })) : await writeFull(m.png, fullPath);
    const thumb = existsSync(thumbPath) ? await sharp(thumbPath).metadata().then((d) => ({ w: d.width, h: d.height })) : await writeThumb(m.png, thumbPath);
    bytes += statSync(fullPath).size + statSync(thumbPath).size;
    out.push({ page: m.page, title: m.title, w: full.w, h: full.h, tw: thumb.w, th: thumb.h, thumb: `/memes/thumb/${name}`, full: `/memes/full/${name}` });
  });

  let removed = 0;
  for (const sub of ["full", "thumb"]) {
    for (const f of readdirSync(join(PUB, sub))) if (!keep.has(f)) { unlinkSync(join(PUB, sub, f)); removed++; }
  }

  out.sort((a, b) => a.page - b.page);
  const memeCount = deck.pages - skipped.length; // the class goal counts slides, hidden ones included
  writeJson(join(ROOT, "src/data/memes.json"), out);
  writeJson(join(ROOT, "src/data/deck.json"), { memeCount, shown: out.length, goal: 1000, lastPage: deck.pages });
  writeJson(join(ROOT, "content/import-report.json"), {
    source: deck.name, pages: deck.pages, memeCount, shown: out.length,
    privateTermsChecked: termsFound, imageMB: +(bytes / 1e6).toFixed(1),
    skipped, hidden: hiddenOut.sort((a, b) => a.page - b.page),
  });
  await buildShare();
  console.log(`${out.length} shown, ${hiddenOut.length} hidden, ${skipped.length} skipped; ${removed} stale files removed; images ${(bytes / 1e6).toFixed(1)} MB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
