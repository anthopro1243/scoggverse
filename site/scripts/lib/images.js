// Image settings for the gallery, shared by the deck import and the re-encode script.
// Ordinary tools only (sharp: resize, trim plain white margins, compress). Faces untouched.
import { writeFileSync } from "node:fs";
import sharp from "sharp";

// The viewer shows the whole slide. Sized so 1,000 slides plus the game fit the size budget
// (scripts/lib/size.js) with room to spare; see PROGRESS.md "Room to grow".
export const FULL = { edge: 1280, quality: 58, preset: "photo", maxBytes: 60_000 };
// Card thumbnails: the slide with its plain white margins trimmed, fitted inside a 16:9 box.
export const THUMB = { width: 400, height: 225, quality: 62, maxBytes: 16_000 };
export const TRIM = {
  threshold: 18, // how far from pure white a margin pixel may be (lossy edges, faint noise)
  minWhite: 235, // the corner pixel must be at least this light on every channel to count as a white margin
  pad: 0.02, // keep a thin margin (of the trimmed size) so text edges never touch the card
  minGain: 0.97, // skip the trim when it would remove less than 3% of the slide
};
// Bump when the settings above change, so every image gets a new file name. Images are served
// with a one-year immutable cache, so a changed image must never reuse an old name.
export const IMAGE_VERSION = 2;

// <page>-<render hash8>-v<IMAGE_VERSION>.webp: a new name whenever the slide or the settings change.
export function imageName(page, renderHash8, version = IMAGE_VERSION) {
  return `${page}-${renderHash8}-v${version}.webp`;
}

// Reads a name back (older names have no -v part): { page, hash, version }.
export function parseImageName(name) {
  const m = /^(\d+)-([0-9a-f]{8})(?:-v(\d+))?\.webp$/.exec(name);
  return m ? { page: Number(m[1]), hash: m[2], version: Number(m[3] || 1) } : null;
}

// The box to keep after trimming plain white margins, or null when there's nothing to trim
// (the slide fills the frame, or its edge isn't white). Pure math, so it's unit tested.
//   size: { width, height } of the slide; found: the content box sharp's trim found
export function trimBox(size, found, opts = TRIM) {
  if (!found || found.width <= 0 || found.height <= 0) return null;
  const pad = Math.round(opts.pad * Math.max(found.width, found.height));
  const left = Math.max(0, found.left - pad), top = Math.max(0, found.top - pad);
  const right = Math.min(size.width, found.left + found.width + pad);
  const bottom = Math.min(size.height, found.top + found.height + pad);
  const box = { left, top, width: right - left, height: bottom - top };
  if (box.width * box.height >= opts.minGain * size.width * size.height) return null;
  return box;
}

export const isWhite = ([r, g, b], min = TRIM.minWhite) => r >= min && g >= min && b >= min;

// Finds the content box inside plain white margins. Never touches anything inside the box.
export async function findTrim(input, opts = TRIM) {
  const img = sharp(input);
  const { width, height } = await img.metadata();
  const corner = await img.clone().extract({ left: 0, top: 0, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  if (!isWhite([...corner], opts.minWhite)) return null;
  let info;
  try {
    ({ info } = await img.clone().flatten({ background: "#ffffff" }).trim({ background: "#ffffff", threshold: opts.threshold }).toBuffer({ resolveWithObject: true }));
  } catch {
    return null; // all white: nothing to show anyway
  }
  const found = { left: -(info.trimOffsetLeft || 0), top: -(info.trimOffsetTop || 0), width: info.width, height: info.height };
  return trimBox({ width, height }, found, opts);
}

// Resizes to fit inside width x height and compresses to WebP, stepping quality (then size)
// down until the file is under maxBytes.
export async function encodeWebp(input, { width, height, quality, maxBytes, preset = "default", extract = null }) {
  let q = quality, w = width, h = height, buf;
  for (let tries = 0; tries < 8; tries++) {
    let img = sharp(input);
    if (extract) img = img.extract(extract);
    buf = await img.resize({ width: w, height: h, fit: "inside", withoutEnlargement: true }).webp({ quality: q, effort: 6, preset }).toBuffer();
    if (buf.length <= maxBytes) break;
    if (q > 50) q -= 6; else { w = Math.round(w * 0.85); h = Math.round(h * 0.85); }
  }
  return buf;
}

async function write(buf, out) {
  writeFileSync(out, buf);
  const meta = await sharp(buf).metadata();
  return { w: meta.width, h: meta.height, bytes: buf.length };
}

// The viewer's image: the whole slide, long edge FULL.edge.
export async function writeFull(input, out) {
  return write(await encodeWebp(input, { width: FULL.edge, height: FULL.edge, quality: FULL.quality, preset: FULL.preset, maxBytes: FULL.maxBytes }), out);
}

// The card's image: the whole slide minus its plain white margins.
export async function writeThumb(input, out) {
  const extract = await findTrim(input);
  return write(await encodeWebp(input, { ...THUMB, extract }), out);
}
