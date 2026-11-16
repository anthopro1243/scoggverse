// Scogg Boy & Scogg Girl on the site: its own page at /play/scogg-boy-girl/ (click to load, both
// players' controls, how to play), the game at /scogg-boy-girl/
// copied in unchanged, every level replayed both on the game's own URL and inside the page's
// iframe under the site's real headers, and links to it from Home and the Play page.
import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { watchErrors } from "./helpers.js";
import { replaySteps } from "../../../scogg-boy-girl/src/logic/replay.js";

const remote = !!process.env.PLAYWRIGHT_BASE_URL;
const GAME = "../scogg-boy-girl";
const ORDER = JSON.parse(readFileSync(`${GAME}/levels/order.json`, "utf8"));
const replay = (level) => replaySteps(JSON.parse(readFileSync(`${GAME}/replays/${level}.json`, "utf8")));
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const files = (dir, base = dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f), base) : [join(dir, f).slice(base.length + 1)]));

/** Play a level's replay in a page or frame with the game on it; returns the last snapshot. */
const play = (where, steps) => where.evaluate((st) => { let s; for (const [n, k] of st) s = window.__sbg.step(n, k); return s; }, steps);

test("the page: heading, Play marked in the nav, footer, no sideways scroll, no console errors", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/play/scogg-boy-girl/");
  await expect(page.locator("h1")).toHaveText("Scogg Boy & Scogg Girl");
  await expect(page.locator('.site-nav a[href="/play/"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".site-nav a[aria-current]")).toHaveCount(1);
  await expect(page.locator(".site-footer")).toContainText("Don't deny yourself an education.");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  const [scrollW, clientW] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scrollW).toBeLessThanOrEqual(clientW);
  expect(errors).toEqual([]);
});

test("the page says what the game needs in one paragraph: both players' keys and the rules, with no line about jump scares", async ({ page }) => {
  await page.goto("/play/scogg-boy-girl/");
  const how = page.locator(".play-how p");
  await expect(how).toHaveCount(1);
  await expect(how).toContainText("Scogg Boy uses A, D and W. Scogg Girl uses the arrow keys.");
  for (const word of ["Ink", "Inflation", "Recession", "Esc", "R restarts"]) await expect(how).toContainText(word);
  await expect(page.locator(".controls, .survive, kbd")).toHaveCount(0);
  await expect(page.locator(".vault__overlay")).not.toContainText("scare");
  await expect(page.locator(".sbg-fine")).toHaveText("Unofficial fan parody. Not affiliated with Fireboy and Watergirl or its makers. Made with Dr. Scoggins' permission, for fun.");
});

test("no phone note on the page (the game shows its own on a phone)", async ({ page }) => {
  await page.goto("/play/scogg-boy-girl/");
  await expect(page.locator(".phone-note")).toHaveCount(0);
});

test("nothing from the game downloads until Play; then it runs in the iframe", async ({ page }) => {
  const errors = watchErrors(page);
  const gameRequests = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/scogg-boy-girl/")) gameRequests.push(r.url()); });
  await page.goto("/play/scogg-boy-girl/");
  await page.waitForLoadState("networkidle");
  expect(gameRequests).toEqual([]);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator("[data-fullscreen]")).toBeDisabled();
  await page.locator("[data-play]").click();
  await expect(page.locator("iframe.vault__frame")).toHaveAttribute("src", "/scogg-boy-girl/");
  const frame = await (await page.locator("iframe.vault__frame").elementHandle()).contentFrame();
  await expect.poll(() => gameRequests.length).toBeGreaterThan(0);
  await expect(page.locator("[data-fullscreen]")).toBeEnabled();
  // on a phone the game shows its own notice first; on a laptop it opens on the title screen
  await frame.waitForFunction(() => window.__sbgPhone || window.__sbg?.scene === "title", null, { timeout: 60_000 });
  expect(errors).toEqual([]);
});

test("every level, replayed through the Play page's iframe, gets out with an A", async ({ page, isMobile }) => {
  test.skip(isMobile, "the game is played on a laptop");
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  for (const level of ORDER) {
    await page.goto(`/play/scogg-boy-girl/?test=1&level=${level}`);
    await page.locator("[data-play]").click();
    await expect(page.locator("iframe.vault__frame")).toHaveAttribute("src", `/scogg-boy-girl/?test=1&level=${level}`);
    const frame = await (await page.locator("iframe.vault__frame").elementHandle()).contentFrame();
    frame.page().on("pageerror", (e) => errors.push(`frame: ${e.message}`));
    await frame.waitForFunction((l) => window.__sbg?.ready && window.__sbg.level === l, level, { timeout: 60_000 });
    const s = await play(frame, replay(level));
    expect(s.state, level).toBe("won");
    expect(s.result.grade, level).toBe("A");
  }
  expect(errors).toEqual([]);
});

test("every level, replayed on the game's own URL under the site's headers, gets out with an A", async ({ page, isMobile }) => {
  test.skip(isMobile, "the game is played on a laptop");
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  for (const level of ORDER) {
    await page.goto(`/scogg-boy-girl/?test=1&level=${level}`);
    await page.waitForFunction((l) => window.__sbg?.ready && window.__sbg.level === l, level, { timeout: 60_000 });
    const s = await play(page, replay(level));
    expect(s.state, level).toBe("won");
    expect(s.result.grade, level).toBe("A");
  }
  expect(errors).toEqual([]);   // a CSP violation would show up here
});

test("the game's own URL: title screen, noindex and the site's CSP", async ({ page, request, isMobile }) => {
  test.skip(isMobile, "once");
  const res = await request.get("/scogg-boy-girl/");
  expect(res.status()).toBe(200);
  expect(res.headers()["x-robots-tag"]).toBe("noindex");
  expect(res.headers()["content-security-policy"]).toContain("script-src 'self'");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
  expect(await res.text()).toContain('<meta name="robots" content="noindex">');
  const errors = watchErrors(page);
  await page.goto("/scogg-boy-girl/");
  await page.waitForFunction(() => window.__sbg?.scene === "title", null, { timeout: 60_000 });
  await expect(page).toHaveTitle("Scogg Boy & Scogg Girl");
  expect(errors).toEqual([]);
});

test("dist/scogg-boy-girl is a byte-for-byte copy of the game's own build", async ({ isMobile }) => {
  test.skip(remote || isMobile, "reads the local build once");
  expect(existsSync("dist/scogg-boy-girl/index.html"), "run npm run build first").toBe(true);
  const list = files(`${GAME}/dist`);
  expect(list.length).toBeGreaterThan(3);
  expect(files("dist/scogg-boy-girl").sort()).toEqual(list.sort());
  for (const f of list) expect(sha(readFileSync(`dist/scogg-boy-girl/${f}`)), f).toBe(sha(readFileSync(`${GAME}/dist/${f}`)));
});

test("Home and the Play page link to it; the FNAF game stays where it was", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".games__tile", { hasText: "Scogg Boy" })).toHaveAttribute("href", "/play/scogg-boy-girl/");
  await expect(page.locator("main").getByRole("link", { name: /^Play$/ })).toHaveAttribute("href", "/play/");
  await page.goto("/play/five-nights-at-scoggies/");
  await expect(page.locator("h1")).toHaveText("Five Nights at Scoggy's");
  await expect(page.locator("[data-play]")).toHaveCount(1);
  const card = page.locator(".games__tile", { hasText: "Scogg Boy" });
  await expect(card).toHaveAttribute("href", "/play/scogg-boy-girl/");
  await card.click();
  await expect(page).toHaveURL(/\/play\/scogg-boy-girl\/$/);
});
