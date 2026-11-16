import { test, expect } from "@playwright/test";
import { watchErrors } from "./helpers.js";

const PAGES = [
  { path: "/", h1: "The Scoggverse" },
  { path: "/gallery/", h1: "The Scogg Files" },
  { path: "/play/", h1: "Games" },
];

for (const p of PAGES) {
  test(`${p.path} loads with header, footer and no console errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(p.path);
    await expect(page.locator("h1")).toHaveText(p.h1);
    await expect(page.locator(".site-nav a")).toHaveCount(3);
    await expect(page.locator(`.site-nav a[href="${p.path}"]`)).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".site-footer")).toContainText("Don't deny yourself an education.");
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollW, "no horizontal scroll").toBeLessThanOrEqual(clientW);
    expect(errors).toEqual([]);
  });
}

test("nav links go to each page", async ({ page }) => {
  await page.goto("/");
  for (const p of PAGES.slice(1)) {
    await page.locator(`.site-nav a[href="${p.path}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${p.path.replace(/\//g, "\\/")}$`));
    await expect(page.locator("h1")).toHaveText(p.h1);
  }
});

test("page content keeps a side gutter", async ({ page }) => {
  await page.goto("/");
  const x = await page.locator("h1").evaluate((el) => el.getBoundingClientRect().left);
  expect(x).toBeGreaterThanOrEqual(12);
});
