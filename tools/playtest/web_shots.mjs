// Screenshots of the web page around the game (the parts the Godot screenshot sheet can't show):
// the loading screen mid-download, the phone notice, and the embed page.
//   node web_shots.mjs --url=http://localhost:8060 [--share=<token>] [--out=../../docs/screens/web]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));
const BASE = (args.url || "http://localhost:8060").replace(/\/$/, "");
const OUT = path.resolve(args.out || "../../docs/screens/web");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=vulkan"] });
async function open(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  if (args.share) await page.goto(`${BASE}/?_vercel_share=${args.share}`, { waitUntil: "domcontentloaded" });
  return { ctx, page };
}

// Loading screen: a slow connection (2 MB/s) so the bar is partway.
{
  const { ctx, page } = await open({ viewport: { width: 1280, height: 720 } });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: 2e6, uploadThroughput: 1e6 });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => /Loading [1-9]/.test(document.getElementById("status-bytes")?.textContent || ""), null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "loading.png") });
  await ctx.close();
}
// Phone notice.
{
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#phone-notice", { state: "visible" });
  await page.screenshot({ path: path.join(OUT, "phone_notice.png") });
  await ctx.close();
}
// Embed page, at the title.
{
  const { ctx, page } = await open({ viewport: { width: 1280, height: 860 } });
  await page.goto(`${BASE}/embed.html?test=1`, { waitUntil: "domcontentloaded" });
  const frame = await (await page.waitForSelector("#fnas-game")).contentFrame();
  await frame.waitForFunction(() => window.fnasState && JSON.parse(window.fnasState).scene === "Title", null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, "embed.png") });
  await ctx.close();
}
await browser.close();
console.log(`saved loading.png, phone_notice.png, embed.png in ${OUT}`);
