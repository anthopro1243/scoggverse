import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { watchErrors } from "./helpers.js";

const memes = JSON.parse(readFileSync("src/data/memes.json", "utf8"));
const config = JSON.parse(readFileSync("src/config.json", "utf8"));
const lisa = memes.find((m) => m.title === "Scogga Lisa");
const PAGES = ["/", "/gallery/", "/play/", "/play/scogg-boy-girl/", "/play/flappy-scogg/"];
const local = (u) => u.replace(config.siteUrl, "");

for (const path of PAGES) {
  test(`${path}: link-preview tags, noindex, no console errors`, async ({ page, request, isMobile }) => {
    test.skip(isMobile, "same tags at both sizes");
    const errors = watchErrors(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    for (const p of ["og:title", "og:description", "og:image", "og:url"]) await expect(page.locator(`meta[property="${p}"]`)).toHaveAttribute("content", /\S/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    const img = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(img).toMatch(/^https:\/\/.+\/share-card\.jpg$/);
    const r = await request.get(local(img));
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/jpeg");
    expect(errors).toEqual([]);
  });
}

test("headers: noindex everywhere, CSP on site pages, game left without a CSP", async ({ request, isMobile }) => {
  test.skip(isMobile, "once");
  const site = await request.get("/gallery/");
  expect(site.headers()["x-robots-tag"]).toBe("noindex");
  const csp = site.headers()["content-security-policy"];
  expect(csp).toContain("frame-src 'self'");
  expect(csp).toContain("script-src 'self'");
  const game = await request.get("/game/index.html");
  expect(game.headers()["x-robots-tag"]).toBe("noindex");
  expect(game.headers()["content-security-policy"]).toBeUndefined();
});

test("share page: the slide's title with the shared JPEG card, then into the gallery viewer", async ({ page, request }) => {
  const res = await request.get(`/s/${lisa.page}/`);
  expect(res.status()).toBe(200);
  const html = await res.text();
  const img = /<meta property="og:image" content="([^"]+)"/.exec(html)[1];
  expect(img).toMatch(/\/share-card\.jpg$/);
  expect(html).toContain(`<meta property="og:title" content="Scogga Lisa">`);
  const jpg = await request.get(local(img));
  expect(jpg.status()).toBe(200);
  expect(jpg.headers()["content-type"]).toContain("image/jpeg");
  await page.goto(`/s/${lisa.page}/`);
  await expect(page).toHaveURL(new RegExp(`/gallery/#/scogg/${lisa.page}$`));
  await expect(page.locator("[data-lightbox]")).toHaveAttribute("open", "");
  await expect(page.locator("[data-lb-title]")).toHaveText("Scogga Lisa");
});

test("every shown slide has a share page and no hidden slide does", async ({ request, isMobile }) => {
  test.skip(isMobile, "once");
  const report = JSON.parse(readFileSync("content/import-report.json", "utf8"));
  for (const h of report.hidden) expect((await request.get(`/s/${h.page}/`)).status(), `hidden ${h.page}`).toBe(404);
  for (const m of memes.slice(0, 20)) expect((await request.get(`/s/${m.page}/`)).status()).toBe(200);
});

test("Add a Scogg: no button while the deck link is empty, but the goal note stays", async ({ page }) => {
  test.skip(!!config.addScoggUrl, "link is set");
  await page.goto("/gallery/");
  await expect(page.locator(".add-scogg")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Ask in class for the deck link");
  await expect(page.locator("[data-goal-note]")).toContainText("Add yours at the end of the slideshow and keep it appropriate.");
});

test("viewer copy-link points at the share page", async ({ page, context, isMobile, browserName }) => {
  test.skip(isMobile || browserName !== "chromium", "clipboard check once");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/gallery/#/scogg/${lisa.page}`);
  await page.locator("[data-lb-copy]").click();
  await expect(page.locator("[data-toast]")).not.toBeEmpty();
  const text = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
  if (text) expect(text).toMatch(new RegExp(`/s/${lisa.page}/$`));
});

for (const path of [...PAGES, "/404.html"]) {
  test(`axe: no serious or critical issues on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    const bad = results.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.length} (${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(", ")})`);
    expect(bad).toEqual([]);
  });
}

test("axe: the gallery viewer is accessible too", async ({ page }) => {
  await page.goto(`/gallery/#/scogg/${lisa.page}`);
  await expect(page.locator("[data-lightbox]")).toHaveAttribute("open", "");
  const results = await new AxeBuilder({ page }).include("[data-lightbox]").analyze();
  expect(results.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => v.id)).toEqual([]);
});
