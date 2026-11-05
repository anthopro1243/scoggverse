// The game must stay exactly as exported: dist/game/ is a byte-for-byte copy of ../web.
import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";

const remote = !!process.env.PLAYWRIGHT_BASE_URL;
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
// Vercel injects its feedback-toolbar script into HTML on preview deployments (never production).
const unInject = (buf) => Buffer.from(buf.toString("latin1").replace(/<script async data-explicit-opt-in="true"[^>]*vercel\.live[^>]*><\/script>/, ""), "latin1");
const gameFiles = readdirSync("../web").filter((f) => !f.startsWith("."));

test("dist/game is a byte-for-byte copy of the committed web export", async ({ isMobile }) => {
  test.skip(remote || isMobile, "reads the local build once");
  expect(existsSync("dist/game"), "run npm run build first").toBe(true);
  for (const f of gameFiles) expect(sha(readFileSync(`dist/game/${f}`)), f).toBe(sha(readFileSync(`../web/${f}`)));
  expect(sha(readFileSync("dist/og.png"))).toBe(sha(readFileSync("../web/og.png")));
});

test("the served game files match the export", async ({ request, isMobile }) => {
  test.skip(isMobile, "once");
  test.setTimeout(120_000);
  for (const f of gameFiles) {
    const r = await request.get(`/game/${f}`);
    expect(r.status(), f).toBe(200);
    const body = await r.body();
    expect(sha(f.endsWith(".html") ? unInject(body) : body), f).toBe(sha(readFileSync(`../web/${f}`)));
  }
});

test("/game/ is the game's own page", async ({ page }) => {
  await page.goto("/game/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Five Nights at Scoggy's/);
  await expect(page.locator("canvas#canvas")).toHaveCount(1);
});

test("/embed.html still works (redirects to the game's embed page)", async ({ page }) => {
  test.skip(!remote, "the redirect lives in vercel.json, so it's checked on a deployment");
  await page.goto("/embed.html", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/game\/embed\.html$/);
  await expect(page.locator("iframe#fnas-game")).toHaveAttribute("src", /\.\/index\.html/);
});
