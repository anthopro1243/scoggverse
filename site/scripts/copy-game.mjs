#!/usr/bin/env node
// Copies the games into the built site unchanged, byte for byte; neither is rebuilt here.
// - Five Nights at Scoggy's: the committed Godot web export (../web) into dist/game/ (Vercel has
//   no Godot). The game's own link-preview image (its index.html points at /og.png) is also
//   copied to the site root.
// - Scogg Boy & Scogg Girl: its own Vite build (../scogg-boy-girl/dist, made by `npm run build`
//   just before this) into dist/scogg-boy-girl/.
// - Flappy Scogg: its own Vite build (../flappy-scogg/dist, also made just before this) into
//   dist/flappy-scogg/.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

/** Copy every file under src into out (keeping folders); skips dotfiles. Returns [files, bytes]. */
function copyTree(src, out) {
  mkdirSync(out, { recursive: true });
  let n = 0, bytes = 0;
  for (const f of readdirSync(src)) {
    if (f.startsWith(".")) continue; // .gdignore
    const from = join(src, f), st = statSync(from);
    if (st.isDirectory()) { const [a, b] = copyTree(from, join(out, f)); n += a; bytes += b; continue; }
    if (!st.isFile()) continue;
    copyFileSync(from, join(out, f));
    n++; bytes += st.size;
  }
  return [n, bytes];
}

const WEB = resolve(ROOT, "../web");
const [n, bytes] = copyTree(WEB, join(ROOT, "dist/game"));
copyFileSync(join(WEB, "og.png"), join(ROOT, "dist/og.png"));
console.log(`game: copied ${n} files (${(bytes / 1e6).toFixed(1)} MB) to dist/game/`);

const SBG = resolve(ROOT, "../scogg-boy-girl/dist");
if (!existsSync(join(SBG, "index.html"))) throw new Error("Scogg Boy & Scogg Girl isn't built: run npm run build in ../scogg-boy-girl");
const [m, sbgBytes] = copyTree(SBG, join(ROOT, "dist/scogg-boy-girl"));
console.log(`scogg-boy-girl: copied ${m} files (${(sbgBytes / 1e6).toFixed(1)} MB) to dist/scogg-boy-girl/`);

const FS = resolve(ROOT, "../flappy-scogg/dist");
if (!existsSync(join(FS, "index.html"))) throw new Error("Flappy Scogg isn't built: run npm run build in ../flappy-scogg");
const [k, fsBytes] = copyTree(FS, join(ROOT, "dist/flappy-scogg"));
console.log(`flappy-scogg: copied ${k} files (${(fsBytes / 1e3).toFixed(0)} KB) to dist/flappy-scogg/`);
