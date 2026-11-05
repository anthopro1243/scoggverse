import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { watchErrors } from "./helpers.js";

const memes = JSON.parse(readFileSync("src/data/memes.json", "utf8"));
const byTitle = (t) => memes.find((m) => m.title === t);
const lisa = byTitle("Scogga Lisa");
const scoggema = byTitle("Absolute Scoggema");

async function ready(page, path = "/gallery/") {
  await page.goto(path);
  await page.waitForSelector("html[data-gallery-ready]");
}

test("grid renders the first chunk with sizes set, newest first", async ({ page }) => {
  const errors = watchErrors(page);
  await ready(page);
  await expect(page.locator("[data-count]")).toHaveText(`${memes.length} files on display`);
  const cards = page.locator(".card__btn");
  await expect(cards).toHaveCount(48);
  const img = cards.first().locator("img");
  await expect(img).toHaveAttribute("width", /\d+/);
  await expect(img).toHaveAttribute("height", /\d+/);
  await expect(img).toHaveAttribute("loading", "lazy");
  const newest = Math.max(...memes.map((m) => m.page));
  await expect(cards.first()).toContainText(`FILE ${String(newest).padStart(4, "0")}`);
  expect(errors).toEqual([]);
});

test("scrolling renders more cards", async ({ page }) => {
  await ready(page);
  await page.locator("[data-sentinel]").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator(".card__btn").count()).toBeGreaterThan(48);
});

test("search is instant and case/accent-insensitive", async ({ page }) => {
  await ready(page);
  const search = page.locator("[data-search]");
  await search.fill("SCÖGGA lísa");
  await expect(page.locator(".card__btn").first()).toContainText("Scogga Lisa");
  await search.fill(`#${scoggema.page}`);
  await expect(page.locator(".card__btn")).toHaveCount(1);
  await expect(page.locator(".card__btn")).toContainText("Absolute Scoggema");
  await search.fill("zzzz-no-such-scogg");
  await expect(page.locator("[data-empty]")).toBeVisible();
});

test("sort oldest puts the lowest page first", async ({ page }) => {
  await ready(page);
  await page.locator("[data-sort]").selectOption("oldest");
  const oldest = Math.min(...memes.map((m) => m.page));
  await expect(page.locator(".card__btn").first()).toContainText(`FILE ${String(oldest).padStart(4, "0")}`);
});

test("Random Scogg opens the lightbox on a real slide", async ({ page }) => {
  await ready(page);
  await page.locator("[data-random]").click();
  const lb = page.locator("[data-lightbox]");
  await expect(lb).toHaveAttribute("open", "");
  await expect(page).toHaveURL(/#\/scogg\/\d+$/);
  const n = Number(/(\d+)$/.exec(page.url())[1]);
  expect(memes.some((m) => m.page === n)).toBe(true);
});

test("lightbox: open, keyboard prev/next, Esc closes, focus stays inside", async ({ page }) => {
  await ready(page);
  await page.locator(".card__btn").first().click();
  const lb = page.locator("[data-lightbox]");
  await expect(lb).toHaveAttribute("open", "");
  const first = await lb.getAttribute("data-page");
  await expect(page.locator("[data-lb-img]")).toHaveAttribute("src", /\/memes\/full\//);
  await page.keyboard.press("ArrowRight");
  await expect(lb).not.toHaveAttribute("data-page", first);
  await page.keyboard.press("ArrowLeft");
  await expect(lb).toHaveAttribute("data-page", first);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest("[data-lightbox]"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(lb).not.toHaveAttribute("open", "");
  await expect(page).not.toHaveURL(/#\/scogg\//);
});

test("lightbox closes on a backdrop click", async ({ page }) => {
  await ready(page);
  await page.locator(".card__btn").first().click();
  const lb = page.locator("[data-lightbox]");
  await expect(lb).toHaveAttribute("open", "");
  // Measure only after the slide has loaded; until then the image box can still change size.
  await expect.poll(() => page.locator("[data-lb-img]").evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  const box = await page.locator("[data-lb-stage]").boundingBox();
  const img = await page.locator("[data-lb-img]").boundingBox();
  // A point in the stage but outside the image (below it, or beside it).
  const y = img.y + img.height + 4 < box.y + box.height ? img.y + img.height + 4 : box.y + box.height / 2;
  const x = img.y + img.height + 4 < box.y + box.height ? box.x + box.width / 2 : box.x + 2;
  await page.mouse.click(x, y);
  await expect(lb).not.toHaveAttribute("open", "");
});

test("deep link #/scogg/<page> opens that slide", async ({ page }) => {
  await ready(page, `/gallery/#/scogg/${lisa.page}`);
  const lb = page.locator("[data-lightbox]");
  await expect(lb).toHaveAttribute("open", "");
  await expect(page.locator("[data-lb-title]")).toHaveText("Scogga Lisa");
  await expect(page.locator("[data-lb-page]")).toHaveText(`FILE ${String(lisa.page).padStart(4, "0")}`);
});

test("swipe moves to the next slide on touch screens", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch only");
  await ready(page, `/gallery/#/scogg/${lisa.page}`);
  const lb = page.locator("[data-lightbox]");
  await expect(lb).toHaveAttribute("data-page", String(lisa.page));
  await page.evaluate(() => {
    const el = document.querySelector("[data-lightbox]");
    const t = (x) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })];
    el.dispatchEvent(new TouchEvent("touchstart", { touches: t(300), changedTouches: t(300), bubbles: true }));
    el.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: t(80), bubbles: true }));
  });
  await expect(lb).not.toHaveAttribute("data-page", String(lisa.page));
});

test("no horizontal scroll and the goal counter shows", async ({ page }) => {
  await ready(page);
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
  await expect(page.locator("[data-goal-count]")).not.toHaveText("0");
});

test("the goal counter is in the page itself, so it never shows 0 while the script loads", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/gallery/");
  const shown = String(JSON.parse(readFileSync("src/data/deck.json", "utf8")).shown);
  await expect(page.locator("[data-goal-count]")).toHaveText(shown);
  await expect(page.locator("[data-goal] [role=progressbar]")).toHaveAttribute("aria-valuenow", shown);
  await context.close();
});

test("first load stays under 600 KB before scrolling", async ({ page, isMobile }) => {
  test.skip(isMobile, "measured once at desktop size");
  let bytes = 0;
  page.on("response", async (r) => { try { bytes += (await r.body()).length; } catch {} });
  await ready(page);
  await page.waitForLoadState("networkidle");
  expect(bytes).toBeLessThan(600_000);
});

test("every image in memes.json returns 200", async ({ request, isMobile }) => {
  test.skip(isMobile, "checked once");
  test.setTimeout(120_000);
  const urls = memes.flatMap((m) => [m.thumb, m.full]);
  const bad = [];
  for (let i = 0; i < urls.length; i += 24) {
    const res = await Promise.all(urls.slice(i, i + 24).map((u) => request.head(u).then((r) => [u, r.status()])));
    bad.push(...res.filter(([, s]) => s !== 200));
  }
  expect(bad).toEqual([]);
});
