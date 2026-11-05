// Review-packet screenshots: node scripts/shots.mjs --out=<dir> [--base=http://localhost:4173] [--share=<token>] path[:name] ...
// Each path is shot at desktop 1366x768 and phone 375x812 (viewport only, not full page, unless --full).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
  const [k, v] = a.slice(2).split("="); return [k, v ?? true];
}));
const paths = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const base = (args.base || "http://localhost:4173").replace(/\/$/, "");
const out = args.out || "shots";
const sizes = { desktop: { width: 1366, height: 768 }, phone: { width: 375, height: 812 } };
const only = args.only ? args.only.split(",") : Object.keys(sizes);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
for (const size of only) {
  const context = await browser.newContext({ viewport: sizes[size], deviceScaleFactor: 1, isMobile: size === "phone", hasTouch: size === "phone" });
  const page = await context.newPage();
  if (args.share) await page.goto(`${base}/?_vercel_share=${args.share}`);
  for (const entry of paths) {
    const [path, name = path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home"] = entry.split(":");
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(Number(args.wait || 400));
    const file = join(out, `${name}-${size}.png`);
    await page.screenshot({ path: file, fullPage: Boolean(args.full) });
    console.log(file);
  }
  await context.close();
}
await browser.close();
