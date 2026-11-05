// Build-output checks (they read dist/ from disk, so they run against the local build only).
import { test, expect } from "@playwright/test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseTerms } from "../../scripts/lib/deck.js";

test.skip(!!process.env.PLAYWRIGHT_BASE_URL, "reads the local dist/");
test.describe.configure({ mode: "serial" });

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const report = JSON.parse(readFileSync("content/import-report.json", "utf8"));
const hiddenPages = new Set(report.hidden.map((h) => h.page));

test("no hidden slide reaches dist/ or memes.json", async ({ isMobile }) => {
  test.skip(isMobile, "once");
  expect(existsSync("dist"), "run npm run build first").toBe(true);
  const memes = JSON.parse(readFileSync("src/data/memes.json", "utf8"));
  expect(memes.filter((m) => hiddenPages.has(m.page))).toEqual([]);
  const files = walk("dist").map((f) => f.replace(/\\/g, "/"));
  const leaked = files.filter((f) => /\/(memes\/(full|thumb|og)|s)\//.test(f)).filter((f) => {
    const m = /\/(?:memes\/(?:full|thumb|og)\/(\d+)-|s\/(\d+)\/)/.exec(f);
    return m && hiddenPages.has(Number(m[1] || m[2]));
  });
  expect(leaked).toEqual([]);
  const builtMemes = files.filter((f) => /memes-.*\.json$/.test(f));
  for (const f of builtMemes) expect(JSON.parse(readFileSync(f, "utf8")).filter((m) => hiddenPages.has(m.page))).toEqual([]);
});

test("no private term appears anywhere in dist/", async ({ isMobile }) => {
  test.skip(isMobile, "once");
  const termsFile = process.env.SCOGGVERSE_TERMS || join(homedir(), ".config/scoggverse/private-terms.txt");
  test.skip(!existsSync(termsFile), "private terms file not on this machine (CI)");
  const terms = parseTerms(readFileSync(termsFile, "utf8"));
  const hits = [];
  for (const f of walk("dist")) {
    if (!/\.(html|js|json|css|txt|xml|svg)$/.test(f)) continue;
    const text = readFileSync(f, "utf8");
    for (const t of terms) if (t.re.test(text)) hits.push(f); // the term itself is not printed
  }
  expect(hits).toEqual([]);
});
