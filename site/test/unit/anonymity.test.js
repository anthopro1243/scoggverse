// Anonymity (owner, 2026-10-05): nothing public may point to who made the site or the game.
// Scans every file of the built site, including the game's export in dist/game/ and the files
// inside its index.pck, for the owner's details, and checks that no image or audio file (in the
// build or anywhere in the repo) carries metadata tags.
// CI builds before `npm test`; locally run `npm run build` first. ANON_DIST=<folder> scans another
// copy of the site instead (e.g. the live files downloaded into a folder).
// The owner's names are not in this repo: they come from the ANON_NAMES secret (comma-separated)
// in CI, or ~/.config/scoggverse/anon-names.txt (one per line) on the owner's computer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { homedir } from "node:os";
import { embeddedImageMetadata, mediaMetadata, MEDIA_EXT, oggTags, pckEntries } from "../../scripts/lib/media-meta.js";

const DIST = process.env.ANON_DIST || "dist";

// Who made it. Not checked in index.wasm: the Godot engine binary lists its contributors, and some
// happen to share these names.
function nameList() {
  if (process.env.ANON_NAMES) return process.env.ANON_NAMES.split(",").map((s) => s.trim()).filter(Boolean);
  try { return readFileSync(join(homedir(), ".config/scoggverse/anon-names.txt"), "utf8").split("\n").map((s) => s.trim()).filter(Boolean); } catch { return []; }
}
const NAME_LIST = nameList();
const NAMES = NAME_LIST.length ? new RegExp(NAME_LIST.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i") : null;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const OTHER = [
  ["team name", /chess[\s_-]*club/i],
  ["home folder path", /\/home\/(?!web_user\b)[A-Za-z0-9_.-]+/], // web_user is Emscripten's built-in virtual home
  ["\"site owner\"", /site\s+owner/i],
  ["Vercel preview URL", /[a-z0-9-]+-git-[a-z0-9-]+|team_[A-Za-z0-9]{24}|[a-z0-9-]+-[a-z0-9]{9}-[a-z0-9-]+\.vercel\.app/i],
];
// Email addresses the engine's libraries ship inside index.wasm (FreeType's mailing lists).
const ENGINE_EMAILS = new Set(["freetype@nongnu.org", "freetype-devel@nongnu.org"]);
const TEXT_EXT = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".txt", ".xml", ".webmanifest", ".map", ".md"]);
// Files inside the .pck: compressed binary data (textures, sound) is checked for names but not for
// email-shaped byte runs; everything else (scripts, scenes, configs) gets every check.
const PCK_BINARY = /\.(ctex|oggvorbisstr|sample|fontdata)$/;

const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

// Problems in one blob of bytes: [label, matched text].
function scan(buf, { names = true, emails = true, allowEmails = new Set() } = {}) {
  const text = buf.toString("latin1");
  const hits = [];
  if (names && NAMES) { const m = NAMES.exec(text); if (m) hits.push(["owner's name/username/email", m[0]]); }
  if (emails) for (const m of text.matchAll(EMAIL)) if (!allowEmails.has(m[0])) hits.push(["email address", m[0]]);
  for (const [label, re] of OTHER) { const m = re.exec(text); if (m) hits.push([label, m[0]]); }
  return hits;
}

const skip = !existsSync(DIST) && "run npm run build first";
const files = skip ? [] : walk(DIST);
const rel = (f) => relative(DIST, f).replace(/\\/g, "/");

test("the built site and game name nobody: no names, emails, team, home paths or preview links", { skip }, () => {
  const problems = [];
  for (const f of files) {
    const name = rel(f);
    const ext = extname(f).toLowerCase();
    const buf = readFileSync(f);
    if (name.endsWith("index.pck")) {
      for (const e of pckEntries(buf)) for (const [label, hit] of scan(e.data, { emails: !PCK_BINARY.test(e.path) })) problems.push(`${name}:${e.path}: ${label} (${hit})`);
      continue;
    }
    const opts = name.endsWith("index.wasm") ? { names: false, allowEmails: ENGINE_EMAILS } : { emails: TEXT_EXT.has(ext) };
    for (const [label, hit] of scan(buf, opts)) problems.push(`${name}: ${label} (${hit})`);
  }
  assert.ok(files.some((f) => rel(f) === "game/index.pck"), "the game is part of the scanned files");
  assert.deepEqual(problems, []);
});

test("no image or audio file in the build has metadata tags (including the game's sounds and textures)", { skip }, () => {
  const problems = [];
  for (const f of files) {
    const name = rel(f);
    const ext = extname(f).slice(1).toLowerCase();
    if (MEDIA_EXT.has(ext)) for (const m of mediaMetadata(readFileSync(f), ext)) problems.push(`${name}: ${m}`);
    if (name.endsWith("index.pck")) {
      for (const e of pckEntries(readFileSync(f))) {
        if (/\.(oggvorbisstr|ogg|sample)$/.test(e.path)) for (const m of oggTags(e.data)) problems.push(`${name}:${e.path}: ${m}`);
        if (/\.(ctex|png|jpg|webp|svg|image)$/.test(e.path)) for (const m of embeddedImageMetadata(e.data)) problems.push(`${name}:${e.path}: ${m}`);
        if (/\.svg$/.test(e.path)) for (const m of mediaMetadata(e.data, "svg")) problems.push(`${name}:${e.path}: ${m}`);
      }
    }
  }
  assert.deepEqual(problems, [], "fix with: python3 tools/strip_metadata.py <files> (then re-import and re-export the game)");
});

// Every image, sound and video committed to the repo, not only the ones that ship.
function tracked() {
  try { return execFileSync("git", ["ls-files", "-z"], { cwd: "..", encoding: "utf8" }).split("\0").filter(Boolean); } catch { return null; }
}
const repoFiles = tracked();

test("no image, audio or video file in the repo has metadata tags", { skip: !repoFiles && "not a git checkout" }, () => {
  const problems = [];
  for (const f of repoFiles) {
    const ext = extname(f).slice(1).toLowerCase();
    if (!MEDIA_EXT.has(ext) || !existsSync(join("..", f))) continue;
    for (const m of mediaMetadata(readFileSync(join("..", f)), ext)) problems.push(`${f}: ${m}`);
  }
  assert.deepEqual(problems, [], "fix with: python3 tools/strip_metadata.py <files>");
});

test("must-not: the checks catch what they're meant to", () => {
  const caught = (s, opts) => scan(Buffer.from(s), opts).length > 0;
  for (const s of ["mail me at someone@example.com", "Chess Club", "chess_club", "/home/someone/x", "/home/bob/site", "ask the site owner", "https://five-nights-at-scoggies-git-main-team.vercel.app", "https://five-nights-at-scoggies-abc123xyz-team.vercel.app"]) assert.ok(caught(s), s);
  for (const s of ["https://five-nights-at-scoggies.vercel.app/play/", "/home/web_user", "Dr. Scoggins", "To get something taken down, ask Dr. Scoggins."]) assert.ok(!caught(s), s);
  for (const w of NAME_LIST) assert.ok(caught(`made by ${w.toUpperCase()}`), "a listed name is caught");
  if (NAME_LIST.length) assert.ok(!caught(`Josh ${NAME_LIST[0]}`, { names: false }), "the engine's contributor list is allowed in index.wasm only");
  assert.ok(!caught("freetype@nongnu.org", { names: false, allowEmails: ENGINE_EMAILS }));
  // metadata
  const vorbis = (vendor, n) => Buffer.concat([Buffer.from("\x03vorbis", "latin1"), Buffer.from(new Uint32Array([vendor.length]).buffer), Buffer.from(vendor), Buffer.from(new Uint32Array([n]).buffer), Buffer.from([1])]);
  assert.deepEqual(oggTags(vorbis("", 0)), []);
  assert.ok(oggTags(vorbis("Lavf60.16.100", 1)).length === 2);
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length); b.write(type, 4, "latin1"); data.copy(b, 8); return b; };
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = chunk("IHDR", Buffer.alloc(13));
  assert.deepEqual(mediaMetadata(Buffer.concat([pngSig, ihdr, chunk("IEND", Buffer.alloc(0))]), "png"), []);
  assert.deepEqual(mediaMetadata(Buffer.concat([pngSig, ihdr, chunk("tEXt", Buffer.from("Author\0someone")), chunk("IEND", Buffer.alloc(0))]), "png"), ["PNG tEXt"]);
  const jpeg = (seg) => Buffer.concat([Buffer.from([0xff, 0xd8]), seg, Buffer.from([0xff, 0xda, 0, 2, 0xff, 0xd9])]);
  const app = (n, body) => Buffer.concat([Buffer.from([0xff, 0xe0 + n, 0, body.length + 2]), body]);
  assert.deepEqual(mediaMetadata(jpeg(app(0, Buffer.from("JFIF\0"))), "jpg"), []);
  assert.equal(mediaMetadata(jpeg(app(1, Buffer.from("Exif\0\0"))), "jpg").length, 1);
});

test("the owner's names are loaded (in CI from the ANON_NAMES secret)", { skip: !process.env.CI && !NAMES && "no ~/.config/scoggverse/anon-names.txt on this computer" }, () => {
  assert.ok(NAMES, "add the ANON_NAMES secret: GitHub repo Settings, Secrets and variables, Actions");
});
