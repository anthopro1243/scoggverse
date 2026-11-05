// Nothing private is reachable (owner, 2026-10-05): docs, package files, source maps, git data and
// config files all answer 404 or 403. Runs against the local build and, with PLAYWRIGHT_BASE_URL,
// against a deployment. The old /embed.html link is the one redirect that's meant to work.
import { test, expect } from "@playwright/test";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const remote = !!process.env.PLAYWRIGHT_BASE_URL;

const PRIVATE = [
  // docs
  "/README.md", "/CLAUDE.md", "/HANDOFF.md", "/PROGRESS.md", "/NEEDS-OWNER.md", "/CREDITS.md",
  "/docs/HANDOFF-NEW-ACCOUNT.md", "/docs/EMBED.md", "/site/README.md",
  // package files
  "/package.json", "/package-lock.json", "/site/package.json", "/site/package-lock.json", "/node_modules/.package-lock.json",
  // git and CI
  "/.git/HEAD", "/.git/config", "/.gitignore", "/.github/workflows/ci.yml",
  // config and source
  "/vercel.json", "/.vercel/project.json", "/.env", "/vite.config.js", "/playwright.config.js", "/site/vite.config.js",
  "/project.godot", "/export_presets.cfg", "/src/config.json", "/site/src/config.json", "/content/hidden.json",
  "/site/content/hidden.json", "/scripts/share.mjs", "/tools/strip_metadata.py", "/web/index.html", "/game/.gdignore",
];

test.describe.configure({ mode: "serial" });

test("private files answer 404 or 403", async ({ request, isMobile }) => {
  test.skip(isMobile, "once");
  const open = [];
  for (const path of PRIVATE) {
    const res = await request.get(path, { maxRedirects: 5 });
    if (![403, 404].includes(res.status())) open.push(`${path} -> ${res.status()}`);
  }
  expect(open).toEqual([]);
});

test("no source maps are served for the site's or the game's scripts", async ({ request, page, isMobile }) => {
  test.skip(isMobile, "once");
  const scripts = new Set(["/game/index.js", "/game/index.audio.worklet.js", "/game/index.audio.position.worklet.js"]);
  for (const path of ["/", "/gallery/", "/play/"]) {
    await page.goto(path);
    for (const src of await page.locator("script[src], link[rel=modulepreload]").evaluateAll((els) => els.map((e) => e.getAttribute("src") || e.getAttribute("href")))) {
      if (src.startsWith("/")) scripts.add(src);
    }
  }
  const served = [];
  for (const s of scripts) {
    const body = await (await request.get(s)).text();
    if (/sourceMappingURL=(?!data:)/.test(body)) served.push(`${s} links a source map`);
    const map = await request.get(`${s}.map`, { maxRedirects: 5 });
    if (![403, 404].includes(map.status())) served.push(`${s}.map -> ${map.status()}`);
  }
  expect(scripts.size).toBeGreaterThan(3);
  expect(served).toEqual([]);
});

test("the old /embed.html link still reaches the game", async ({ request, isMobile }) => {
  test.skip(isMobile || !remote, "a Vercel redirect (vercel.json); vite preview doesn't run it");
  const res = await request.get("/embed.html", { maxRedirects: 0 });
  expect([301, 302, 307, 308]).toContain(res.status());
  expect(res.headers().location).toMatch(/\/game\/embed\.html$/);
});

test("the build has no docs, maps, package, config or hidden files", async ({ isMobile }) => {
  test.skip(isMobile || remote, "reads the local dist/");
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  expect(existsSync("dist"), "run npm run build first").toBe(true);
  const bad = walk("dist").map((f) => f.slice("dist".length).replace(/\\/g, "/")).filter((p) =>
    /\.(md|map|cfg|toml|ya?ml|env|py|mjs|godot|lock)$/i.test(p) || /(^|\/)\./.test(p) || /(^|\/)(package(-lock)?\.json|vercel\.json|[\w-]+\.config\.js)$/.test(p));
  expect(bad).toEqual([]);
});
