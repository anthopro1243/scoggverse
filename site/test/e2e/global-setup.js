// For a protected Vercel preview: visit it once with ?_vercel_share=<token> so Vercel sets its
// auth cookie, then save that cookie for every test (storageState).
import { chromium } from "@playwright/test";

export const STATE = "test-results/.vercel-share.json";

export default async function globalSetup() {
  const base = process.env.PLAYWRIGHT_BASE_URL;
  const token = process.env.VERCEL_SHARE;
  if (!base || !token) return;
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${base.replace(/\/$/, "")}/?_vercel_share=${token}`);
  await context.storageState({ path: STATE });
  await browser.close();
}
