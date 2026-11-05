import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./", // works at /flappy-scogg/ on the site and from any folder
  build: {
    outDir: "dist",
    assetsInlineLimit: 0, // keep the faces and fonts as files (the site's CSP allows no data: images)
    sourcemap: false,
  },
  server: { port: 5175 },
  preview: { port: 4175 },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
