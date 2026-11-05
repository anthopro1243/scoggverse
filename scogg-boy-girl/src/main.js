import "./fonts.css";
import "./page.css";
import Phaser from "phaser";
import { WORLD_W, WORLD_H, HZ, MOVE, MAX_RENDER_SCALE } from "./logic/config.js";
import { Boot } from "./scenes/Boot.js";
import { Level } from "./scenes/Level.js";
import { LevelSelect } from "./scenes/LevelSelect.js";
import { Title } from "./scenes/Title.js";
import { audio } from "./audio/audio.js";
import { RECIPES, renderSound, renderTune, SR } from "./audio/recipes.js";

// Render at the screen's real pixel size (up to 1920x1080) and zoom the camera to match, so the
// 960x540 world stays sharp at 1366x768 without drawing more pixels than a Chromebook needs.
function renderScale() {
  const fit = Math.min(window.innerWidth / WORLD_W, window.innerHeight / WORLD_H) * (window.devicePixelRatio || 1);
  return Math.min(MAX_RENDER_SCALE, Math.max(1, fit));
}

// Phones (touch only, small screen) see a notice first: the game needs a keyboard and two people.
// "Play anyway" is remembered on the device. ?phone=1 forces the notice (tests), ?phone=0 skips it.
function isPhone() {
  const q = new URLSearchParams(location.search);
  if (q.get("phone") === "1") return true;
  if (q.get("phone") === "0") return false;
  let ok = false;
  try { ok = localStorage.getItem("sbg-phone-ok") === "1"; } catch { /* storage blocked */ }
  const coarseOnly = matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches;
  return coarseOnly && Math.min(screen.width, screen.height) < 820 && !ok;
}

function boot(extra = []) {
  const rs = renderScale();
  window.__sbg = { ready: false, rs };

  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: "game",
    width: Math.round(WORLD_W * rs),
    height: Math.round(WORLD_H * rs),
    backgroundColor: "#07080b",
    banner: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: MOVE.gravity }, fps: HZ, customUpdate: true } },
    seed: ["scogg-boy-girl"],
    input: { gamepad: true },
    // images load as plain <img> files, not blob: URLs, so the site's strict CSP allows them
    loader: { imageLoadType: "HTMLImageElement" },
    scene: [Boot, Title, LevelSelect, Level, ...extra],
  });
  game.registry.set("rs", rs);
  window.__sbg.game = game;
}

// The G0 look sheet (?scene=look) is only in the dev server; the shipped build leaves it out.
function start() {
  if (import.meta.env.DEV) import("./scenes/LookSheet.js").then((m) => boot([m.LookSheet]));
  else boot();
}

if (isPhone()) {
  const notice = document.getElementById("phone");
  notice.hidden = false;
  window.__sbgPhone = true;
  document.getElementById("phone-play").addEventListener("click", () => {
    try { localStorage.setItem("sbg-phone-ok", "1"); } catch { /* storage blocked */ }
    notice.hidden = true;
    start();
  }, { once: true });
} else start();

// sound starts with the first key press or click; the tune plays everywhere, softly. Tests keep
// it off (rendering every sound takes a few seconds of CPU) unless they ask with ?sound=1.
const query = new URLSearchParams(location.search);
if (!query.has("test") || query.has("sound")) audio.listen();
audio.music(true);
window.__sbgAudio = audio.state;
if (query.has("test")) {
  // tests render every sound offline and measure it
  window.__sbgSynth = async () => {
    const measure = (buf) => {
      const d = [0, 1].map((c) => buf.getChannelData(c));
      let peak = 0, sum = 0, loud = 0, firstHalf = -1;
      const w = Math.floor(SR * 0.05);
      for (let i = 0; i < buf.length; i++) {
        const v = Math.max(Math.abs(d[0][i]), Math.abs(d[1][i]));
        peak = Math.max(peak, v); sum += d[0][i] ** 2 + d[1][i] ** 2;
      }
      for (let i = 0; i < buf.length; i++) if (firstHalf < 0 && Math.max(Math.abs(d[0][i]), Math.abs(d[1][i])) >= peak / 2) firstHalf = i;
      for (let i = 0; i + w <= buf.length; i += w) { let s = 0; for (let j = i; j < i + w; j++) s += d[0][j] ** 2 + d[1][j] ** 2; loud = Math.max(loud, Math.sqrt(s / (2 * w))); }
      const edge = (from) => { let s = 0; for (let j = from; j < from + w; j++) s += d[0][j] ** 2 + d[1][j] ** 2; return Math.sqrt(s / (2 * w)); };
      return { seconds: buf.length / SR, peak, rms: Math.sqrt(sum / (2 * buf.length)), loudest50ms: loud, toHalfPeak: firstHalf / SR,
        seam: Math.max(Math.abs(d[0][0] - d[0][buf.length - 1]), Math.abs(d[1][0] - d[1][buf.length - 1])), startRms: edge(0), endRms: edge(buf.length - w) };
    };
    const out = {};
    for (const n of Object.keys(RECIPES)) out[n] = measure(await renderSound(n));
    out.tune = measure(await renderTune());
    return out;
  };
}
