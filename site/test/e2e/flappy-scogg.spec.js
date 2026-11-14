// Flappy Scogg on the site: its own page at /play/flappy-scogg/ (click to load, one line of how to
// play, works on phones, not scary), the game at /flappy-scogg/ copied in unchanged, the F0
// replay played both on the game's own URL and inside the page's iframe under the site's real
// headers, taps on a phone that never scroll or zoom, and links to it from Home and the Play page.
import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { watchErrors } from "./helpers.js";

const remote = !!process.env.PLAYWRIGHT_BASE_URL;
const GAME = "../flappy-scogg";
const replay = JSON.parse(readFileSync(`${GAME}/replays/f0.json`, "utf8"));
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const files = (dir, base = dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f), base) : [join(dir, f).slice(base.length + 1)]));
const play = (where) => where.evaluate((r) => window.__fs.replay(r), replay);

test("the page: heading, Play marked in the nav, footer, no sideways scroll, no console errors", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/play/flappy-scogg/");
  await expect(page.locator("h1")).toHaveText("Flappy Scogg");
  await expect(page.locator('.site-nav a[href="/play/"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".site-nav a[aria-current]")).toHaveCount(1);
  await expect(page.locator(".site-footer")).toContainText("Don't deny yourself an education.");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  const [scrollW, clientW] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scrollW).toBeLessThanOrEqual(clientW);
  expect(errors).toEqual([]);
});

test("the page says how to play in one line, that it isn't scary, and the fan note", async ({ page }) => {
  await page.goto("/play/flappy-scogg/");
  await expect(page.locator(".fs-how")).toHaveCount(1);
  await expect(page.locator(".fs-how")).toContainText("Space to flap");
  await expect(page.locator(".tower__calm")).toHaveText("It's not scary, it's just his face flying around.");
  await expect(page.locator(".fs-fine")).toHaveText("Unofficial fan parody. Not affiliated with Flappy Bird or its makers. Made with Dr. Scoggins' permission, for fun.");
});

test("no extra helper line about phones or its own page (the description already says it works on phones)", async ({ page }) => {
  await page.goto("/play/flappy-scogg/");
  await expect(page.locator(".play-head p")).toHaveText("Tap to flap. It's just his face.");
  await expect(page.locator("main")).not.toContainText("best on its own page");
  await expect(page.locator(".tower__own")).toHaveText("Own page");
});

test("nothing from the game downloads until Play; then it runs in the iframe", async ({ page }) => {
  const errors = watchErrors(page);
  const gameRequests = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/flappy-scogg/")) gameRequests.push(r.url()); });
  await page.goto("/play/flappy-scogg/");
  await page.waitForLoadState("networkidle");
  expect(gameRequests).toEqual([]);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator("[data-fullscreen]")).toBeDisabled();
  await page.locator("[data-play]").click();
  await expect(page.locator("iframe.tower__frame")).toHaveAttribute("src", "/flappy-scogg/");
  const frame = await (await page.locator("iframe.tower__frame").elementHandle()).contentFrame();
  await frame.waitForFunction(() => window.__fs?.ready, null, { timeout: 30_000 });
  expect(await frame.evaluate(() => window.__fs.state().phase)).toBe("title");
  await expect(page.locator("[data-fullscreen]")).toBeEnabled();
  expect(errors).toEqual([]);
});

test("the F0 replay through the page's iframe: past 25 columns, the recorded score", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/play/flappy-scogg/?test=1");
  await page.locator("[data-play]").click();
  await expect(page.locator("iframe.tower__frame")).toHaveAttribute("src", "/flappy-scogg/?test=1");
  const frame = await (await page.locator("iframe.tower__frame").elementHandle()).contentFrame();
  frame.page().on("pageerror", (e) => errors.push(`frame: ${e.message}`));
  await frame.waitForFunction(() => window.__fs?.ready, null, { timeout: 30_000 });
  const s = await play(frame);
  expect(s.score).toBe(replay.expect.score);
  expect(s.phase).toBe(replay.expect.phase);
  expect(s.cause).toBe(replay.expect.cause);
  expect(errors).toEqual([]);
});

test("the F0 replay on the game's own URL under the site's headers, and sound measured there", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/flappy-scogg/?test=1");
  await page.waitForFunction(() => window.__fs?.ready);
  const s = await play(page);
  expect(s.score).toBe(replay.expect.score);
  expect(s.phase).toBe(replay.expect.phase);
  const m = await page.evaluate(() => window.__fs.measureSounds());
  for (const name of ["flap", "point", "ten", "hit"]) expect(m[name].rms, name).toBeGreaterThan(0.01);
  expect(errors).toEqual([]); // a CSP violation would show up here
});

test("the game's own URL: noindex and the site's CSP", async ({ request, isMobile }) => {
  test.skip(isMobile, "once");
  const res = await request.get("/flappy-scogg/");
  expect(res.status()).toBe(200);
  expect(res.headers()["x-robots-tag"]).toBe("noindex");
  expect(res.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  expect(await res.text()).toContain('<meta name="robots" content="noindex">');
});

test("on a phone, taps on the game flap and never scroll or zoom the page", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only");
  await page.goto("/flappy-scogg/?test=1");
  await page.waitForFunction(() => window.__fs?.ready);
  await page.touchscreen.tap(180, 400);
  let s = await page.evaluate(() => window.__fs.step(1));
  expect(s.phase).toBe("playing");
  for (let i = 0; i < 6; i++) { await page.touchscreen.tap(180, 400); await page.evaluate(() => window.__fs.step(3)); }
  const v = await page.evaluate(() => ({ scale: visualViewport.scale, x: scrollX, y: scrollY }));
  expect(v).toEqual({ scale: 1, x: 0, y: 0 });
});

test("dist/flappy-scogg is a byte-for-byte copy of the game's own build", async ({ isMobile }) => {
  test.skip(remote || isMobile, "reads the local build once");
  expect(existsSync("dist/flappy-scogg/index.html"), "run npm run build first").toBe(true);
  const list = files(`${GAME}/dist`);
  expect(list.length).toBeGreaterThan(3);
  expect(files("dist/flappy-scogg").sort()).toEqual(list.sort());
  for (const f of list) expect(sha(readFileSync(`dist/flappy-scogg/${f}`)), f).toBe(sha(readFileSync(`${GAME}/dist/${f}`)));
});

test("Home and the Play page link to it; the other two games stay where they were", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".games__tile", { hasText: "Flappy Scogg" })).toHaveAttribute("href", "/play/flappy-scogg/");
  await page.goto("/play/");
  await expect(page.locator("h1")).toHaveText("Five Nights at Scoggy's");
  await expect(page.locator(".games__tile", { hasText: "Scogg Boy" })).toHaveAttribute("href", "/play/scogg-boy-girl/");
  const card = page.locator(".games__tile", { hasText: "Flappy Scogg" });
  await expect(card).toHaveAttribute("href", "/play/flappy-scogg/");
  // the only phone line on the site is the one under the FNAF game box
  await expect(page.locator(".phone-pick")).toHaveCount(0);
  await expect(page.locator(".phone-note")).toHaveCount(1);
  await card.click();
  await expect(page).toHaveURL(/\/play\/flappy-scogg\/$/);
});
