import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const vercel = JSON.parse(readFileSync("../vercel.json", "utf8"));
const memes = JSON.parse(readFileSync("src/data/memes.json", "utf8"));
const gameFiles = readdirSync("../web").filter((f) => !f.startsWith("."));
const rules = vercel.headers.map((r) => ({ re: new RegExp(`^${r.source}$`), headers: r.headers }));

// Every Cache-Control value that applies to a path. Exactly one rule may set it, so the result
// never depends on which rule Vercel applies last.
function cacheControl(path) {
  const hits = rules.flatMap((r) => (r.re.test(path) ? r.headers.filter((h) => h.key.toLowerCase() === "cache-control").map((h) => h.value) : []));
  assert.ok(hits.length <= 1, `${path} gets ${hits.length} Cache-Control rules`);
  return hits[0];
}
const LONG = /max-age=31536000.*immutable/;
const REVALIDATE = /max-age=0.*must-revalidate/;

test("slide images and built assets (content-hashed names) cache for a year", () => {
  for (const m of memes.slice(0, 20)) {
    assert.match(cacheControl(m.full), LONG, m.full);
    assert.match(cacheControl(m.thumb), LONG, m.thumb);
  }
  assert.match(cacheControl("/assets/gallery-Dn-_CLRJ.js"), LONG);
});

test("every game file revalidates, so a new deploy is never served stale", () => {
  // The export keeps the same file names every build (index.wasm, index.pck, ...), so the browser
  // must check its copy each visit; an unchanged file comes back as a 304 with no download.
  for (const f of gameFiles) assert.match(cacheControl(`/game/${f}`) || "", REVALIDATE, f);
  assert.match(cacheControl("/game/"), REVALIDATE);
});

test("Scogg Boy & Scogg Girl: its hashed assets cache for a year, its page revalidates", () => {
  assert.match(cacheControl("/scogg-boy-girl/assets/index-CIZd6CZ2.js"), LONG);
  assert.match(cacheControl("/scogg-boy-girl/assets/scogg-boy-C9I26uDh.png"), LONG);
  assert.match(cacheControl("/scogg-boy-girl/") || "", REVALIDATE);
  assert.match(cacheControl("/scogg-boy-girl/index.html") || "", REVALIDATE);
});

test("Flappy Scogg: its hashed assets cache for a year, its page revalidates", () => {
  assert.match(cacheControl("/flappy-scogg/assets/index-CrnRjy9C.js"), LONG);
  assert.match(cacheControl("/flappy-scogg/assets/face-a-BJMo-q2h.png"), LONG);
  assert.match(cacheControl("/flappy-scogg/") || "", REVALIDATE);
  assert.match(cacheControl("/flappy-scogg/index.html") || "", REVALIDATE);
});

test("must-not: nothing without a hash in its name gets a long cache", () => {
  for (const p of ["/", "/gallery/", "/play/", "/play/scogg-boy-girl/", "/scogg-boy-girl/", "/scogg-boy-girl/index.html", "/play/flappy-scogg/", "/flappy-scogg/", "/flappy-scogg/index.html", "/art/fs-poster.webp", "/404.html", "/s/57/", "/share-card.jpg", "/favicon.svg", "/og.png", "/art/poster-uncle.webp", "/game/index.wasm", "/game/index.pck", "/game/index.js", "/game/og.png"]) {
    assert.doesNotMatch(cacheControl(p) || "", /max-age=[1-9]/, p);
  }
});

test("game content types stay as they were", () => {
  const type = (p) => rules.flatMap((r) => (r.re.test(p) ? r.headers.filter((h) => h.key === "Content-Type").map((h) => h.value) : []))[0];
  assert.equal(type("/game/index.wasm"), "application/wasm");
  assert.equal(type("/game/index.pck"), "application/octet-stream");
});

test("old About links redirect to Home (the page is gone)", () => {
  for (const source of ["/about", "/about/"]) assert.ok(vercel.redirects.some((r) => r.source === source && r.destination === "/"), source);
});
