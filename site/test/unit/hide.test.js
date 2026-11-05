import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hideSlide } from "../../scripts/lib/hide.js";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "scogg-hide-"));
  for (const d of ["content", "src/data", "public/memes/full", "public/memes/thumb", "public/memes/og", "public/s/12"]) mkdirSync(join(root, d), { recursive: true });
  const memes = [12, 13].map((p) => ({ page: p, title: `S${p}`, thumb: `/memes/thumb/${p}-aaaa1111.webp`, full: `/memes/full/${p}-aaaa1111.webp`, og: `/memes/og/${p}-aaaa1111.jpg` }));
  for (const m of memes) for (const f of [m.thumb, m.full, m.og]) writeFileSync(join(root, "public", f), "x");
  writeFileSync(join(root, "public/s/12/index.html"), "x");
  writeFileSync(join(root, "src/data/memes.json"), JSON.stringify(memes));
  writeFileSync(join(root, "src/data/deck.json"), JSON.stringify({ memeCount: 2, shown: 2, goal: 1000 }));
  writeFileSync(join(root, "content/hidden.json"), JSON.stringify([{ page: 5, reason: "old" }]));
  return root;
}

test("hide removes the slide, its images and share page, and records it", () => {
  const root = fixture();
  const { removed } = hideSlide(root, 12, "Dr. Scoggins asked");
  assert.equal(removed, 1);
  const memes = JSON.parse(readFileSync(join(root, "src/data/memes.json"), "utf8"));
  assert.deepEqual(memes.map((m) => m.page), [13]);
  for (const f of ["memes/thumb/12-aaaa1111.webp", "memes/full/12-aaaa1111.webp", "memes/og/12-aaaa1111.jpg", "s/12"]) assert.equal(existsSync(join(root, "public", f)), false, f);
  assert.equal(existsSync(join(root, "public/memes/full/13-aaaa1111.webp")), true, "other slides untouched");
  const hidden = JSON.parse(readFileSync(join(root, "content/hidden.json"), "utf8"));
  assert.deepEqual(hidden, [{ page: 5, reason: "old" }, { page: 12, reason: "Dr. Scoggins asked" }]);
  const deck = JSON.parse(readFileSync(join(root, "src/data/deck.json"), "utf8"));
  assert.equal(deck.shown, 1);
  assert.equal(deck.memeCount, 2, "the class goal still counts hidden slides");
});

test("hide is idempotent and works for a slide that isn't showing", () => {
  const root = fixture();
  hideSlide(root, 12, "first");
  const { removed } = hideSlide(root, 12, "second reason");
  assert.equal(removed, 0);
  const hidden = JSON.parse(readFileSync(join(root, "content/hidden.json"), "utf8"));
  assert.equal(hidden.filter((h) => h.page === 12).length, 1);
  assert.equal(hidden.find((h) => h.page === 12).reason, "second reason");
});

test("hide refuses a bad page or a missing reason", () => {
  const root = fixture();
  assert.throws(() => hideSlide(root, NaN, "x"));
  assert.throws(() => hideSlide(root, 12, "  "));
});
