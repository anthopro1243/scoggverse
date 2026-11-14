// The gallery's slide titles name no classmate. Titles come straight from the deck, and a classmate
// sometimes put a name in one; the share pages (public/s/) reuse the same titles.
// The class list is not in this repo: it comes from the ANON_CLASS_NAMES secret (comma-separated) in
// CI, or ~/.config/scoggverse/class-names.txt (one name per line) on the computer that has it.
// Without the list the test is skipped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function classNames() {
  if (process.env.ANON_CLASS_NAMES) return process.env.ANON_CLASS_NAMES.split(",").map((s) => s.trim()).filter(Boolean);
  try { return readFileSync(join(homedir(), ".config/scoggverse/class-names.txt"), "utf8").split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#")); } catch { return []; }
}
const NAMES = classNames();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// whole words only, so a short name doesn't match inside another word
const NAME_RE = NAMES.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${NAMES.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "iu") : null;

const memes = JSON.parse(readFileSync(new URL("../../src/data/memes.json", import.meta.url), "utf8"));

test("no gallery title names a classmate", { skip: !NAME_RE && "no class list (ANON_CLASS_NAMES or ~/.config/scoggverse/class-names.txt)" }, () => {
  assert.ok(memes.length > 0, "the gallery has slides");
  // report the page only, so a failing run doesn't print the name it found
  const hits = memes.filter((m) => NAME_RE.test(m.title)).map((m) => `page ${m.page}`);
  assert.deepEqual(hits, []);
});
