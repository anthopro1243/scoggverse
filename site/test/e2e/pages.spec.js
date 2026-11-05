import { test, expect } from "@playwright/test";
import { watchErrors } from "./helpers.js";

test("Play: nothing from the game downloads until Play is pressed", async ({ page }) => {
  const errors = watchErrors(page);
  const gameRequests = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/game/")) gameRequests.push(r.url()); });
  await page.goto("/play/");
  await page.waitForLoadState("networkidle");
  expect(gameRequests).toEqual([]);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator("[data-fullscreen]")).toBeDisabled();
  await page.locator("[data-play]").click();
  const iframe = page.locator("iframe.cam__frame");
  await expect(iframe).toHaveAttribute("src", "/game/");
  const frame = page.frameLocator("iframe.cam__frame");
  await expect(frame.locator("canvas#canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator("[data-fullscreen]")).toBeEnabled();
  await expect.poll(() => gameRequests.some((u) => u.includes("/game/index.js"))).toBe(true);
  expect(errors).toEqual([]);
});

test("Play: the game loads and plays from the Play page", async ({ page, isMobile }) => {
  test.skip(isMobile, "the game is played on desktop");
  test.setTimeout(240_000);
  await page.goto("/play/?test=1");
  await page.locator("[data-play]").click();
  const el = page.locator("iframe.cam__frame");
  await expect(el).toHaveAttribute("src", "/game/?test=1");
  const frame = await (await el.elementHandle()).contentFrame();
  const st = () => frame.evaluate(() => (window.fnasState ? JSON.parse(window.fnasState) : null)).catch(() => null);
  const until = async (pred, what, ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const s = await st(); if (s && pred(s)) return s; await page.waitForTimeout(100); }
    throw new Error(`timed out waiting for ${what}`);
  };
  const s = await until((x) => x.scene === "Title" && x.title_buttons, "the game's title screen", 180_000);
  const box = await el.boundingBox();
  const k = box.width / 1920;
  const at = ([x, y]) => page.mouse.click(box.x + x * k, box.y + y * k);
  await at([430, 490 + s.title_buttons.findIndex((b) => b.startsWith("New Game")) * 105 + 47]);
  await until((x) => x.observe?.ending === "intro", "the Night 1 card", 20_000);
  await at([960, 300]);
  await until((x) => x.observe?.ending === "" && x.observe.state === "playing", "the night to start", 20_000);
  await page.keyboard.press("a");
  await until((x) => x.observe.doors[0], "A to shut the left door", 10_000);
});

test("Play: phones get the best-on-a-laptop note", async ({ page, isMobile }) => {
  await page.goto("/play/");
  if (isMobile) await expect(page.locator(".phone-note")).toBeVisible();
  else await expect(page.locator(".phone-note")).toBeHidden();
});

test("no About page; every footer has the fan-made note and the takedown line", async ({ page }) => {
  for (const path of ["/", "/gallery/", "/play/", "/404.html"]) {
    await page.goto(path);
    await expect(page.locator(".site-nav a")).toHaveText(["Home", "Gallery", "Play"]);
    await expect(page.locator('a[href^="/about"]')).toHaveCount(0);
    await expect(page.locator(".site-footer__fine")).toHaveText("Fan-made, Dr. Scoggins said it's ok. Want something taken down? Ask him.");
    await expect(page.locator(".site-footer")).not.toContainText("Not affiliated");
  }
});

test("each game's fan-parody line is only on its own Play page", async ({ page }) => {
  const lines = { "/play/": "Scott Cawthon", "/play/scogg-boy-girl/": "Fireboy and Watergirl", "/play/flappy-scogg/": "Flappy Bird" };
  for (const [path, who] of Object.entries(lines)) {
    await page.goto(path);
    await expect(page.locator("body")).toContainText(`Not affiliated with ${who}`);
    for (const other of Object.values(lines).filter((w) => w !== who)) await expect(page.locator("body")).not.toContainText(`Not affiliated with ${other}`);
  }
  await page.goto("/play/");
  await expect(page.locator(".fnaf-fine")).toHaveText("Unofficial fan parody. Not affiliated with Scott Cawthon or Five Nights at Freddy's.");
  for (const path of ["/", "/gallery/", "/404.html"]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText("Not affiliated");
  }
});

test("old /about/ links go to Home", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "the redirect lives in vercel.json, so it's checked on a deployment");
  await page.goto("/about/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("h1")).toHaveText("The Scoggverse");
});

test("Home has no add-your-slide note at the bottom", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".note--deck")).toHaveCount(0);
  await expect(page.locator("main .add-scogg")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Add yours to the end");
  await expect(page.locator(".note--game")).toBeVisible();
});

test("Home: Play button, counter and 8 random files", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Play Five Nights at Scoggy's/ })).toHaveAttribute("href", "/play/");
  await expect(page.locator(".hero__count")).toContainText(/\d+ Scoggs on file\. Goal: 1,000\./);
  // the counter and the gallery link use the same number
  const count = (await page.locator(".hero__count strong").textContent()).trim();
  await expect(page.locator(".section-head__link")).toHaveText(`All ${count}`);
  await page.waitForSelector("html[data-home-ready]");
  await expect(page.locator("[data-strip] .card__btn")).toHaveCount(8);
  const first = await page.locator("[data-strip] .card__btn").first().getAttribute("href");
  expect(first).toMatch(/^\/gallery\/#\/scogg\/\d+$/);
  expect(errors).toEqual([]);
});

test("404 page in the same style", async ({ page }) => {
  const res = await page.goto(process.env.PLAYWRIGHT_BASE_URL ? "/no-such-file/" : "/404.html");
  if (process.env.PLAYWRIGHT_BASE_URL) expect(res.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("File not found");
  await expect(page.locator("main")).toContainText("This file got deleted, or it never existed.");
  await expect(page.locator(".site-nav a")).toHaveCount(3);
});
