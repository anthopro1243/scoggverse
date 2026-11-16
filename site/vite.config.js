import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { partials } from "./scripts/vite-partials.js";

const root = import.meta.dirname;

// `vite preview` sends the same headers as Vercel (from ../vercel.json), so local tests see the
// real Content-Security-Policy.
function vercelHeaders() {
  const rules = JSON.parse(readFileSync(resolve(root, "../vercel.json"), "utf8")).headers || [];
  const compiled = rules.map((r) => ({ re: new RegExp(`^${r.source}$`), headers: r.headers }));
  return {
    name: "vercel-headers",
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url || "/").split("?")[0]);
        for (const r of compiled) if (r.re.test(path)) for (const h of r.headers) res.setHeader(h.key, h.value);
        next();
      });
    },
  };
}

export default defineConfig({
  appType: "mpa",
  plugins: [partials(), vercelHeaders()],
  build: {
    target: "es2020",
    rollupOptions: {
      input: {
        home: resolve(root, "index.html"),
        gallery: resolve(root, "gallery/index.html"),
        play: resolve(root, "play/index.html"),
        playFnas: resolve(root, "play/five-nights-at-scoggies/index.html"),
        playSbg: resolve(root, "play/scogg-boy-girl/index.html"),
        playFnas2: resolve(root, "play/five-nights-at-scoggies-2/index.html"),
        playFs: resolve(root, "play/flappy-scogg/index.html"),
        notFound: resolve(root, "404.html"),
      },
    },
  },
  preview: { port: 4173, strictPort: true },
});
