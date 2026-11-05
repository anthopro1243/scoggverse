// Finds metadata tags in image and audio files by reading their bytes (no external tools), and
// reads the files inside a Godot .pck. Used by test/unit/anonymity.test.js; the fix for anything it
// finds is `python3 tools/strip_metadata.py <files>`.
import { zstdDecompressSync } from "node:zlib";

const ascii = (buf, a, b) => buf.toString("latin1", a, b);

// PNG: text chunks, EXIF and the last-modified time. Colour chunks (iCCP, sRGB, gAMA...) stay.
function png(buf) {
  const found = [];
  for (let p = 8; p + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(p);
    const type = ascii(buf, p + 4, p + 8);
    if (["tEXt", "zTXt", "iTXt", "eXIf", "tIME"].includes(type)) found.push(`PNG ${type}`);
    if (type === "IEND") break;
    p += 12 + len;
  }
  return found;
}

// JPEG: every APPn segment except JFIF (APP0), the colour profile (APP2) and Adobe's colour
// transform (APP14), plus comments.
function jpeg(buf) {
  const found = [];
  for (let p = 2; p + 4 <= buf.length; ) {
    if (buf[p] !== 0xff) break;
    const m = buf[p + 1];
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { p += 2; continue; }
    if (m === 0xda || m === 0xd9) break; // image data starts: no more headers
    const len = buf.readUInt16BE(p + 2);
    if (m === 0xfe) found.push("JPEG comment");
    else if (m >= 0xe0 && m <= 0xef && ![0xe0, 0xe2, 0xee].includes(m)) found.push(`JPEG APP${m - 0xe0} ${ascii(buf, p + 4, p + 8).replace(/[^ -~]/g, "")}`);
    p += 2 + len;
  }
  return found;
}

// WebP: EXIF and XMP chunks (the colour profile chunk stays).
function webp(buf) {
  const found = [];
  if (ascii(buf, 0, 4) !== "RIFF" || ascii(buf, 8, 12) !== "WEBP") return found;
  const end = Math.min(buf.length, 8 + buf.readUInt32LE(4));
  for (let p = 12; p + 8 <= end; ) {
    const type = ascii(buf, p, p + 4);
    if (type === "EXIF" || type === "XMP ") found.push(`WebP ${type.trim()}`);
    p += 8 + buf.readUInt32LE(p + 4) + (buf.readUInt32LE(p + 4) & 1);
  }
  return found;
}

// GIF: comment blocks and application blocks other than the looping one.
function gif(buf) {
  const found = [];
  let p = 13;
  if (buf[10] & 0x80) p += 3 << ((buf[10] & 7) + 1);
  const skipSub = () => { while (p < buf.length && buf[p] !== 0) p += buf[p] + 1; p += 1; };
  while (p < buf.length) {
    const b = buf[p];
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = buf[p + 1];
      if (label === 0xfe) found.push("GIF comment");
      if (label === 0xff) {
        const id = ascii(buf, p + 3, p + 14);
        if (id !== "NETSCAPE2.0" && id !== "ANIMEXTS1.0") found.push(`GIF app ${id}`);
      }
      p += 2;
      skipSub();
    } else if (b === 0x2c) {
      const flags = buf[p + 9];
      p += 10;
      if (flags & 0x80) p += 3 << ((flags & 7) + 1);
      p += 1; // LZW code size
      skipSub();
    } else break;
  }
  return found;
}

// SVG: editor and document metadata (Inkscape, Sodipodi, RDF/Dublin Core).
function svg(buf) {
  const text = buf.toString("utf8");
  return [/<metadata/, /sodipodi:/, /inkscape:/, /<rdf:/, /<dc:/].filter((re) => re.test(text)).map((re) => `SVG ${re.source}`);
}

// Ogg Vorbis / Opus: the comment header. Allowed: an empty vendor string and no comments.
export function oggTags(buf) {
  const found = [];
  for (const [sig, label] of [[Buffer.from("\x03vorbis", "latin1"), "Vorbis"], [Buffer.from("OpusTags", "latin1"), "Opus"]]) {
    for (let p = buf.indexOf(sig); p !== -1; p = buf.indexOf(sig, p + 1)) {
      const v = p + sig.length;
      if (v + 8 > buf.length) continue;
      const vlen = buf.readUInt32LE(v);
      if (vlen > 1024 || v + 8 + vlen > buf.length) continue; // not a real header
      const count = buf.readUInt32LE(v + 4 + vlen);
      if (vlen) found.push(`${label} vendor "${ascii(buf, v + 4, v + 4 + vlen)}"`);
      if (count) found.push(`${label} ${count} comment(s)`);
    }
  }
  return found;
}

// MP4/MOV: tag boxes (encoder name, title, dates set by apps...).
function mp4(buf) {
  const found = [];
  const walk = (a, b, depth) => {
    for (let p = a; p + 8 <= b; ) {
      let size = buf.readUInt32BE(p);
      const type = ascii(buf, p + 4, p + 8);
      if (size === 1) size = Number(buf.readBigUInt64BE(p + 8));
      if (size === 0) size = b - p;
      if (size < 8) break;
      // ffmpeg leaves an empty udta/meta/ilst behind; only boxes with tags in them count
      if ((type === "ilst" && size > 8) || type === "XMP_" || type === "uuid" || (depth > 0 && /^\xa9/.test(type))) found.push(`MP4 ${type}`);
      else if (["moov", "trak", "mdia", "minf", "udta"].includes(type) && depth < 6) walk(p + 8, p + size, depth + 1);
      else if (type === "meta" && depth < 6) walk(p + 12, p + size, depth + 1);
      p += size;
    }
  };
  walk(0, buf.length, 0);
  return found;
}

const BY_EXT = { png, jpg: jpeg, jpeg, webp, gif, svg, ogg: oggTags, oga: oggTags, opus: oggTags, mp4, m4a: mp4, mov: mp4 };
export const MEDIA_EXT = new Set(Object.keys(BY_EXT));

// Metadata found in one file, as short labels (empty: clean).
export function mediaMetadata(buf, ext) {
  const fn = BY_EXT[ext.toLowerCase()];
  return fn ? fn(buf) : [];
}

// Images embedded anywhere in a blob (Godot's textures keep PNG/WebP data inside).
export function embeddedImageMetadata(buf) {
  const found = [];
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let p = buf.indexOf(PNG); p !== -1; p = buf.indexOf(PNG, p + 1)) found.push(...png(buf.subarray(p)));
  for (let p = buf.indexOf("RIFF"); p !== -1; p = buf.indexOf("RIFF", p + 1)) {
    if (ascii(buf, p + 8, p + 12) === "WEBP") found.push(...webp(buf.subarray(p, p + 8 + buf.readUInt32LE(p + 4))));
  }
  for (const marker of ["Exif\0\0", "<x:xmpmeta", "http://ns.adobe.com/xap/"]) if (buf.includes(marker)) found.push(`embedded ${marker.replace(/\0/g, "")}`);
  return found;
}

// The files inside a Godot 4 .pck (pack format 2 or 3, not encrypted): [{ path, data }].
// Scripts exported as compressed tokens (.gdc) come back decompressed so their text can be read.
export function pckEntries(buf) {
  if (ascii(buf, 0, 4) !== "GDPC") throw new Error("not a Godot pck");
  const version = buf.readUInt32LE(4);
  const flags = buf.readUInt32LE(20);
  if (flags & 1) throw new Error("encrypted pck");
  // Offsets are relative to the file base when flag 2 is set; format 3 keeps the directory at the end.
  const base = flags & 2 ? Number(buf.readBigUInt64LE(24)) : 0;
  let p = version >= 3 ? Number(buf.readBigUInt64LE(32)) : 32 + 16 * 4;
  const count = buf.readUInt32LE(p); p += 4;
  const out = [];
  for (let i = 0; i < count; i++) {
    const len = buf.readUInt32LE(p); p += 4;
    const path = ascii(buf, p, p + len).replace(/\0+$/, ""); p += len;
    const off = Number(buf.readBigUInt64LE(p)); const size = Number(buf.readBigUInt64LE(p + 8)); p += 16 + 16 + 4;
    let data = buf.subarray(base + off, base + off + size);
    if (path.endsWith(".gdc") && ascii(data, 0, 4) === "GDSC" && data.readUInt32LE(8) > 0) data = zstdDecompressSync(data.subarray(12));
    out.push({ path, data });
  }
  return out;
}
