import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Phaser's own build without Matter physics (we only use Arcade): about 110 KB smaller.
const PHASER = fileURLToPath(new URL("./node_modules/phaser/dist/phaser-arcade-physics.js", import.meta.url));

export default defineConfig({
  base: "./", // works at /scogg-boy-girl/ on the site and from any folder
  resolve: { alias: [{ find: /^phaser$/, replacement: PHASER }] },
  build: {
    outDir: "dist",
    assetsInlineLimit: 0, // keep the face PNGs as files
    chunkSizeWarningLimit: 2000, // Phaser is one big chunk; scripts/size-check.mjs guards the real budget
  },
  server: { port: 5174 },
  test: { include: ["tests/unit/**/*.test.js"] },
});
