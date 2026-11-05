// Phones see a notice before the game loads: it needs a keyboard and a second player, with a link
// back to the site and "Play anyway" (remembered on the device). Laptops never see it.
import { test, expect } from "@playwright/test";

test("a phone sees the notice first, and Play anyway starts the game", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?test=1");
  const notice = page.locator("#phone");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("You need a keyboard and 2 people for this one.");
  const back = notice.getByRole("link", { name: "Back to the site" });
  expect(await back.getAttribute("href")).toBe("/play/");
  expect(await back.getAttribute("target")).toBe("_top");
  expect(await page.locator("canvas").count()).toBe(0);   // nothing loads behind it
  await notice.getByRole("button", { name: "Play anyway" }).click();
  await expect(notice).toBeHidden();
  await page.waitForFunction(() => window.__sbg?.ready === true, null, { timeout: 30_000 });
  expect(await page.evaluate(() => localStorage.getItem("sbg-phone-ok"))).toBe("1");
  await page.reload();                                     // remembered on this device
  await page.waitForFunction(() => window.__sbg?.ready === true, null, { timeout: 30_000 });
  await expect(notice).toBeHidden();
  expect(errors).toEqual([]);
  await ctx.close();
});

test("a laptop never sees the notice, even in a narrow window", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto("/?test=1");
  await page.waitForFunction(() => window.__sbg?.ready === true, null, { timeout: 30_000 });
  await expect(page.locator("#phone")).toBeHidden();
  await ctx.close();
});
