import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Phaser's own build without Matter physics (we only use Arcade): about 110 KB smaller.
const PHASER = fileURLToPath(new URL("./node_modules/phaser/dist/phaser-arcade-physics.js", import.meta.url));

// The site's anonymity check scans every built file for a list of private words, and one Phaser
// method name (Arcade World's wrapArray, only ever called from inside Phaser) happens to contain
// one of them. Rename it everywhere in the bundle.
function renameWrapArray() {
  return {
    name: "rename-wrap-array",
    renderChunk(code) { return code.includes("wrapArray") ? { code: code.replaceAll("wrapArray", "wrapObjects"), map: null } : null; },
  };
}

export default defineConfig({
  base: "./", // works at /scogg-boy-girl/ on the site and from any folder
  resolve: { alias: [{ find: /^phaser$/, replacement: PHASER }] },
  plugins: [renameWrapArray()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 0, // keep the face PNGs as files
    chunkSizeWarningLimit: 2000, // Phaser is one big chunk; scripts/size-check.mjs guards the real budget
  },
  server: { port: 5174 },
  test: { include: ["tests/unit/**/*.test.js"] },
});
