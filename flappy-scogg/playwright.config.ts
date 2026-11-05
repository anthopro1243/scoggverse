import { defineConfig } from "@playwright/test";

// Tests run against the production build (npm run build) served by vite preview.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  workers: 2,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.FS_URL || "http://localhost:4175",
    viewport: { width: 1366, height: 768 },
  },
  webServer: process.env.FS_URL ? undefined : {
    command: "npx vite preview --port 4175 --strictPort",
    port: 4175,
    reuseExistingServer: true,
  },
});
