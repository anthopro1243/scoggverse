import { defineConfig, devices } from "@playwright/test";
import { STATE } from "./test/e2e/global-setup.js";

// PLAYWRIGHT_BASE_URL tests a deployed preview instead of the local build
// (a protected Vercel preview also needs VERCEL_SHARE=<token>; see HANDOFF.md).
const remote = process.env.PLAYWRIGHT_BASE_URL;
const shared = remote && process.env.VERCEL_SHARE;

export default defineConfig({
  testDir: "test/e2e",
  globalSetup: "./test/e2e/global-setup.js",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: remote || "http://localhost:4173",
    trace: "retain-on-failure",
    storageState: shared ? STATE : undefined,
    // PW_CHROMIUM points at a Chromium already on the machine (cloud sessions), else Playwright's own.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } } },
  ],
  webServer: remote ? undefined : {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
