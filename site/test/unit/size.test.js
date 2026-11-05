import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { BUDGET, budgetBytes, perSlide, project } from "../../scripts/lib/size.js";

test("budget: 100 MB with 15% headroom, projected at 1,000 slides", () => {
  assert.equal(BUDGET.slides, 1000);
  assert.ok(BUDGET.headroom >= 0.15);
  assert.equal(budgetBytes(), 85e6);
});

test("perSlide picks out the files that grow with the gallery", () => {
  for (const p of ["/memes/full/4-becc46ba-v2.webp", "/memes/thumb/4-becc46ba-v2.webp", "/memes/og/4-becc46ba.jpg", "/s/4/index.html", "/assets/memes-DjTmlLL5.json"]) assert.ok(perSlide(p), p);
  for (const p of ["/game/index.wasm", "/index.html", "/s/index.html", "/share-card.jpg", "/assets/gallery-Dn-_CLRJ.js", "/art/poster-uncle.webp"]) assert.ok(!perSlide(p), p);
});

test("project: fixed part plus the average slide times 1,000", () => {
  const files = [{ p: "/game/index.wasm", size: 50e6 }, { p: "/index.html", size: 1e6 }];
  for (let i = 0; i < 10; i++) files.push({ p: `/memes/full/${i}-aaaaaaaa-v2.webp`, size: 20e3 }, { p: `/s/${i}/index.html`, size: 10e3 });
  const p = project(files, 10);
  assert.equal(p.each, 30e3);
  assert.equal(p.projected, 51e6 + 30e6);
  assert.ok(p.fits);
  assert.equal(p.roomFor, Math.floor((85e6 - 51e6) / 30e3));
  // must-not: the same site with heavier slides is over budget
  assert.ok(!project(files.map((f) => (perSlide(f.p) ? { ...f, size: f.size * 2 } : f)), 10).fits);
});

// The real check: the built site, projected to 1,000 slides, fits the budget.
// CI builds before `npm test`; locally run `npm run build` first.
test("the built site at 1,000 slides fits the budget", { skip: !existsSync("dist") && "run npm run build first" }, () => {
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = walk("dist").map((p) => ({ p: p.slice("dist".length).replace(/\\/g, "/"), size: statSync(p).size }));
  const shown = JSON.parse(readFileSync("src/data/memes.json", "utf8")).length;
  const p = project(files, shown);
  assert.ok(files.some((f) => f.p === "/game/index.wasm"), "the game is part of the build");
  assert.ok(p.fits, `projected ${(p.projected / 1e6).toFixed(1)} MB at 1,000 slides; budget ${(p.budget / 1e6).toFixed(1)} MB`);
});
