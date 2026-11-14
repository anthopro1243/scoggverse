// Boot: load the face and the fonts, then run the fixed-step game loop and draw every frame.
// URL switches: ?seed=<text> fixes the runs, ?touch=1|0 forces the phone or laptop wording,
// ?test=1 freezes real time so only window.__fs.step() moves the game and keeps the sound off
// unless &sound=1 (tests, screenshots and the replay GIF use it).
import "./fonts.css";
import "./page.css";
import faceA from "../assets/faces/face-a.png";
import kenneyTiles from "../assets/kenney/tilemap_packed.png";
import kenneyBg from "../assets/kenney/tilemap-backgrounds_packed.png";
import { initKenney } from "./art/kenney.ts";
import { createAudio, VOLUME } from "./audio/audio.ts";
import { measure, SOUNDS, type SoundName } from "./audio/recipes.ts";
import { createRenderer } from "./art/render.ts";
import { createStepper } from "./logic/fixedStep.ts";
import { DEFAULT_FACE } from "./logic/faces.ts";
import { createGame, stepGame, type Game } from "./logic/game.ts";
import { replayChunks, type Replay } from "./logic/replay.ts";
import { loadBest, saveBest } from "./storage.ts";
import { TEXT } from "./texts.ts";

// face A, picked from the F0 look sheet. Only this face ships, to keep the
// site inside its size budget; the other two crops stay in assets/faces/ for the record.
const FACE = DEFAULT_FACE;

const params = new URLSearchParams(location.search);
const test = params.get("test") === "1";
const seed = params.get("seed") ?? randomSeed();
const touch = params.has("touch") ? params.get("touch") === "1" : matchMedia("(pointer: coarse)").matches;
const reduceMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");

function randomSeed(): string {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return `${a[0].toString(36)}${a[1].toString(36)}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function boot(): Promise<void> {
  document.title = TEXT.tabTitle;
  const canvas = $<HTMLCanvasElement>("game");
  const pauseBtn = $<HTMLButtonElement>("pause");
  const muteBtn = $<HTMLButtonElement>("mute");
  const creditsLink = $<HTMLButtonElement>("credits-link");
  const credits = $<HTMLDivElement>("credits");
  const creditsClose = $<HTMLButtonElement>("credits-close");
  const [img, tiles, bg] = await Promise.all([
    loadImage(faceA),
    loadImage(kenneyTiles),
    loadImage(kenneyBg),
    document.fonts.load('40px "Kenney Pixel"'),
    document.fonts.load('400 16px "Noto Sans"'),
    document.fonts.load('600 16px "Noto Sans"'),
  ]);

  initKenney(tiles, bg);
  let g: Game = createGame({ seed, face: FACE, best: loadBest() });
  let saved = g.best;
  let pending = 0; // taps since the last step
  let paused = false;
  const audio = createAudio({ enabled: !test || params.get("sound") === "1" });
  const stepper = createStepper({ manual: test });
  const renderer = createRenderer(canvas, () => img);

  const resize = () => {
    renderer.resize(window.innerWidth, window.innerHeight, Math.min(2, window.devicePixelRatio || 1));
    const l = renderer.layout;
    const root = document.documentElement.style;
    root.setProperty("--fx", `${l.x}px`);
    root.setProperty("--fy", `${l.y}px`);
    root.setProperty("--fw", `${l.scale * 405}px`);
  };
  resize();
  window.addEventListener("resize", resize);

  const sounds: Record<string, SoundName> = { flap: "flap", score: "point", ten: "ten", hit: "hit" };
  const step = (flap: boolean) => {
    stepGame(g, flap);
    for (const e of g.events) {
      if (e === "score" && g.events.includes("ten")) continue; // the ten chime replaces the coin
      const s = sounds[e];
      if (s) audio.play(s);
    }
    if (g.best > saved) { saveBest(g.best); saved = g.best; }
  };
  const draw = () => renderer.draw(g, { touch, reduceMotion: reduceMotionQuery.matches, paused });

  // the buttons over the game follow its phase; only touched when something changes
  let shown = "";
  const syncUi = () => {
    const key = `${g.phase}|${paused}|${audio.muted}|${credits.hidden}`;
    if (key === shown) return;
    shown = key;
    pauseBtn.hidden = g.phase !== "playing";
    pauseBtn.setAttribute("aria-pressed", String(paused));
    pauseBtn.setAttribute("aria-label", paused ? TEXT.resumeButton : TEXT.pauseButton);
    muteBtn.setAttribute("aria-pressed", String(audio.muted));
    muteBtn.setAttribute("aria-label", audio.muted ? TEXT.soundOn : TEXT.soundOff);
    creditsLink.hidden = g.phase !== "title" || !credits.hidden;
  };

  const setPaused = (p: boolean) => { paused = p && g.phase === "playing"; pending = 0; syncUi(); draw(); };
  const flap = () => {
    audio.unlock();
    if (!credits.hidden) return;
    if (paused) { setPaused(false); return; } // a tap on the pause screen only resumes
    pending++;
  };
  const openCredits = (open: boolean) => {
    credits.hidden = !open;
    syncUi();
    (open ? creditsClose : canvas).focus();
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    flap();
  });
  // keep phones from scrolling, zooming or long-pressing on the game
  for (const el of [canvas, document.getElementById("hud")!, credits]) {
    for (const type of ["touchmove", "gesturestart", "dblclick", "contextmenu"]) el.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
  canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  // a button press never reaches the canvas, so it never flaps; then focus goes back to the game
  const button = (el: HTMLButtonElement, act: () => void) => {
    el.addEventListener("pointerdown", (e) => e.stopPropagation());
    el.addEventListener("click", () => { audio.unlock(); act(); el.blur(); });
  };
  button(pauseBtn, () => setPaused(!paused));
  button(muteBtn, () => { audio.toggle(); syncUi(); });
  button(creditsLink, () => openCredits(true));
  creditsClose.addEventListener("click", () => openCredits(false));

  window.addEventListener("keydown", (e) => {
    if (!credits.hidden) {
      if (e.code === "Escape") openCredits(false);
      return;
    }
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (!e.repeat) flap();
    } else if (e.code === "Escape" || e.code === "KeyP") {
      setPaused(!paused);
    } else if (e.code === "KeyM" && !e.repeat) {
      audio.unlock();
      audio.toggle();
      syncUi();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && g.phase === "playing") setPaused(true);
  });

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(250, now - last);
    last = now;
    if (!paused) {
      stepper.advance(dt, () => {
        const f = pending > 0;
        pending = 0;
        step(f);
      });
    } else {
      pending = 0;
    }
    syncUi();
    draw();
    requestAnimationFrame(frame);
  };
  syncUi();
  requestAnimationFrame(frame);

  // the test hook: only here to drive the game step by step and read its state
  const state = () => ({
    phase: g.phase, score: g.score, best: g.best, newBest: g.newBest, frame: g.frame, runFrame: g.runFrame, run: g.run,
    y: g.body.y, vy: g.body.vy, angle: g.body.angle, cause: g.cause, paused, face: g.face, seed: g.seed, events: [...g.events],
    muted: audio.muted, credits: !credits.hidden,
    columns: g.columns.map((c) => ({ index: c.index, x: c.x, gapY: c.gapY, gap: c.gap, bronze: c.bronze })),
  });
  const after = () => { syncUi(); draw(); return state(); };
  (window as unknown as { __fs: unknown }).__fs = {
    ready: true,
    test,
    state,
    get lastFace() { return renderer.lastFace; },
    get layout() { return renderer.layout; },
    /** Run n steps now; tap on the first one if asked. */
    step(n: number, tapFirst = false) {
      for (let i = 0; i < n; i++) {
        const f = (i === 0 && tapFirst) || pending > 0;
        pending = 0;
        step(f);
      }
      return after();
    },
    /** Start over from the title with a seed, as a replay would. */
    reset(opts: { seed?: string } = {}) {
      g = createGame({ seed: opts.seed ?? seed, face: FACE, best: g.best });
      paused = false;
      return after();
    },
    replay(r: Replay, upTo = Infinity) {
      g = createGame({ seed: r.seed, face: FACE, best: g.best });
      paused = false;
      let s = 0;
      for (const [n, tap] of replayChunks(r)) {
        for (let i = 0; i < n && s < upTo; i++, s++) step(tap && i === 0);
      }
      return after();
    },
    /** Render each sound offline and measure it (the sound test). */
    async measureSounds() {
      const out: Record<string, unknown> = {};
      for (const s of SOUNDS) out[s] = await measure(s, VOLUME);
      return out;
    },
  };
}

boot();
