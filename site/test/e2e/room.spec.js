// Room-to-grow fixes (2026-10-05): the Home buttons on phones, trimmed card thumbnails, caching.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { watchErrors } from "./helpers.js";
import { THUMB, FULL } from "../../scripts/lib/images.js";

const remote = !!process.env.PLAYWRIGHT_BASE_URL;
const memes = JSON.parse(readFileSync("src/data/memes.json", "utf8"));
const lisa = memes.find((m) => m.title === "Scogga Lisa");

test("Home: the Play and Gallery buttons show without scrolling", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const view = page.viewportSize();
  for (const name of [/Play Five Nights at Scoggy's/, /Open the files/]) {
    const box = await page.getByRole("link", { name }).first().boundingBox();
    expect(box, String(name)).not.toBeNull();
    expect(box.y + box.height, `${name} bottom edge`).toBeLessThanOrEqual(view.height);
  }
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(errors).toEqual([]);
});

test("Home on a phone: the poster sits under the buttons", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone layout");
  await page.goto("/");
  const play = await page.getByRole("link", { name: /Play Five Nights at Scoggy's/ }).boundingBox();
  const poster = await page.locator(".poster").boundingBox();
  expect(poster.y).toBeGreaterThan(play.y + play.height);
});

test("gallery cards show trimmed thumbnails whole; the viewer shows the full slide", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`/gallery/`);
  await page.waitForSelector("html[data-gallery-ready]");
  const img = page.locator(".card__btn img").first();
  await expect(img).toHaveCSS("object-fit", "contain");
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
  const natural = await img.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight, src: el.getAttribute("src") }));
  expect(natural.src).toMatch(/^\/memes\/thumb\//);
  expect(natural.w).toBeLessThanOrEqual(THUMB.width);
  expect(natural.h).toBeLessThanOrEqual(THUMB.height);
  await page.goto(`/gallery/#/scogg/${lisa.page}`);
  const lb = page.locator("[data-lb-img]");
  await expect(lb).toHaveAttribute("src", lisa.full);
  await expect.poll(() => lb.evaluate((el) => el.complete && el.naturalWidth)).toBe(Math.min(FULL.edge, lisa.w));
  expect(await lb.evaluate((el) => (el.naturalWidth / el.naturalHeight).toFixed(2))).toBe((16 / 9).toFixed(2));
  expect(errors).toEqual([]);
});

test("cache headers: a year for hashed site files, revalidate for the game", async ({ request, isMobile }) => {
  test.skip(isMobile, "once");
  const long = /max-age=31536000.*immutable/;
  for (const url of [lisa.full, lisa.thumb]) expect((await request.get(url)).headers()["cache-control"], url).toMatch(long);
  const html = await (await request.get("/gallery/")).text();
  const asset = /\/assets\/[^"]+\.js/.exec(html)[0];
  expect((await request.get(asset)).headers()["cache-control"]).toMatch(long);
  for (const f of ["index.html", "index.js", "index.wasm", "index.pck"]) {
    const r = await request.head(`/game/${f}`);
    expect(r.status(), f).toBe(200);
    expect(r.headers()["cache-control"], f).toMatch(/max-age=0.*must-revalidate/);
    if (remote) expect(r.headers()["etag"], `${f} has an ETag, so a repeat visit is a 304`).toBeTruthy();
  }
});

test("game files: compressed where it helps, and a repeat visit doesn't download them again", async ({ request, isMobile }) => {
  test.skip(!remote, "compression and ETags come from Vercel (vite preview does neither the same way)");
  test.skip(isMobile, "once");
  test.setTimeout(120_000);
  for (const f of ["index.wasm", "index.pck", "index.js", "index.html"]) {
    const r = await request.head(`/game/${f}`, { headers: { "accept-encoding": "br, gzip" } });
    expect(r.headers()["content-encoding"], f).toMatch(/^(br|gzip)$/);
  }
  for (const f of ["index.wasm", "index.pck"]) {
    const first = await request.head(`/game/${f}`, { headers: { "accept-encoding": "br, gzip" } });
    const again = await request.get(`/game/${f}`, { headers: { "accept-encoding": "br, gzip", "if-none-match": first.headers()["etag"] }, maxRedirects: 0 });
    expect(again.status(), `${f} revalidates to 304 Not Modified`).toBe(304);
  }
});
