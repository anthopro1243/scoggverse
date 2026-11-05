import { defineConfig } from "@playwright/test";

// Tests run against the production build (npm run build) served by vite preview.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  // each test runs a software-rendered WebGL browser; more than two at once starves them on a laptop
  workers: 2,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.SBG_URL || "http://localhost:4174",
    viewport: { width: 1366, height: 768 },
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: process.env.SBG_URL ? undefined : {
    command: "npx vite preview --port 4174 --strictPort",
    port: 4174,
    reuseExistingServer: true,
  },
});
