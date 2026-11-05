// The three pools, animated in code on the simulation clock (so replays match):
// Inflation (molten gold and red, melting coins), Ink (deep glowing blue, slow ripples),
// Recession (dark poison-green sludge, slow bubbles). Pools draw over the heroes' feet.
import Phaser from "phaser";
import { PAL } from "./palette.js";
import { TILE } from "../logic/config.js";
import { DEPTH } from "./archive.js";
import { prefs } from "../prefs.js";

export const POOL_SURFACE = 4; // liquid surface sits this far below the floor line

export class Pool extends Phaser.GameObjects.Graphics {
  constructor(scene, { c, r, len, kind }) {
    super(scene);
    this.kind = kind;
    this.x = c * TILE;
    this.y = r * TILE;
    this.w = len * TILE;
    this.colors = PAL.pools[kind];
    this.setDepth(DEPTH.pools);
    scene.add.existing(this);
    this.draw(0);
  }

  /** The deadly area, in world units: standing on (or falling into) the pool's surface. */
  get hitRect() {
    return { x: this.x + 4, y: this.y - 2, w: this.w - 8, h: TILE + 2 };
  }

  draw(tick) {
    const g = this.clear();
    const { top, mid, deep, glint } = this.colors;
    const w = this.w, s = POOL_SURFACE;
    const speed = this.kind === "inflation" ? 1 : 0.45; // ink and recession move slowly
    const amp = this.kind === "recession" ? 0.9 : 1.4;
    const wave = (x) => s + amp * Math.sin(x * 0.16 + tick * 2.6 * speed) + 0.6 * amp * Math.sin(x * 0.37 - tick * 3.7 * speed);
    const pts = [];
    for (let x = 0; x <= w; x += 3) pts.push({ x, y: wave(x) });
    pts.push({ x: w, y: TILE }, { x: 0, y: TILE });
    g.fillStyle(mid, 1).fillPoints(pts, true);
    g.fillStyle(deep, 1).fillRect(0, TILE - 12, w, 12);
    g.fillStyle(deep, 0.6).fillRect(0, TILE - 18, w, 6);
    g.lineStyle(1.8, top, 1).beginPath();
    g.moveTo(0, wave(0));
    for (let x = 3; x <= w; x += 3) g.lineTo(x, wave(x));
    g.strokePath();
    g.fillStyle(PAL.outline, 1).fillRect(0, s - 2, 1.6, TILE - s + 2).fillRect(w - 1.6, s - 2, 1.6, TILE - s + 2);

    const n = Math.max(2, Math.round(w / 26));
    for (let i = 0; i < n; i++) {
      const bx = ((i + 0.5) / n) * w + 5 * Math.sin(i * 7.1);
      if (this.kind === "inflation") {
        // coins melting into the gold as they sink
        const ph = (tick * 0.12 + i * 0.41) % 1;
        const cy = s + 3 + ph * 10;
        const melt = ph;
        g.fillStyle(this.colors.coinDark, 1 - ph * 0.8).fillEllipse(bx, cy + 0.6, 9 - 3 * melt, 5.5 - 3.5 * melt, 12);
        g.fillStyle(this.colors.coin, 1 - ph * 0.8).fillEllipse(bx, cy, 8 - 3 * melt, 4.6 - 3 * melt, 12);
        g.fillStyle(this.colors.coin, 0.8 * (1 - ph)).fillTriangle(bx - 1.6, cy + 1.5, bx + 1.6, cy + 1.5, bx + 0.3, cy + 3 + 5 * melt); // a drip
        const gl = Math.max(0, Math.sin((tick * 1.4 + i * 1.3) * Math.PI));
        if (gl > 0.5) g.fillStyle(glint, gl).fillRect(bx + 6, wave(bx + 6) + 1.5, 4 * gl, 1.2);
      } else if (this.kind === "ink") {
        // slow ripples spreading on the surface
        const ph = (tick * 0.22 + i * 0.37) % 1;
        g.lineStyle(1, glint, 0.55 * (1 - ph)).strokeEllipse(bx, wave(bx) + 2.5, 4 + 16 * ph, 1.2 + 2 * ph, 16);
        g.fillStyle(glint, 0.25).fillCircle(bx + 7, s + 10 + 2 * Math.sin(tick + i), 1);
      } else {
        // slow bubbles that swell and pop
        const ph = (tick * 0.18 + i * 0.29) % 1;
        const r = 1 + 3.2 * ph;
        if (ph < 0.92) g.lineStyle(1, glint, 0.55).strokeCircle(bx, wave(bx) + 1 - r * 0.6, r).fillStyle(mid, 0.9).fillCircle(bx, wave(bx) + 1 - r * 0.6, r - 0.6);
        g.fillStyle(deep, 0.9).fillCircle(bx + 8, s + 9 + 1.5 * Math.sin(tick * 0.6 + i), 2.2);
      }
    }
    return this;
  }
}

/** A collectible bobbing in place: Scogg Bucks for Scogg Boy, Gavels for Scogg Girl. */
export class Pickup extends Phaser.GameObjects.Container {
  constructor(scene, x, y, kind, propRes, phase = 0) {
    super(scene, x, y);
    this.phase = phase;
    this.kind = kind;
    // the Gavel's cold light reads dimmer than gold, so its halo is a little bigger
    this.halo = scene.add.image(0, 0, kind === "buck" ? "glow-boy" : "glow-girl").setBlendMode(Phaser.BlendModes.ADD).setScale(kind === "buck" ? 0.45 : 0.55);
    this.img = scene.add.image(0, 0, kind).setScale(1 / propRes);
    this.add([this.halo, this.img]);
    this.setDepth(DEPTH.items);
    scene.add.existing(this);
    this.propRes = propRes;
  }

  draw(tick) {
    if (prefs.get("reduceMotion")) { this.img.y = this.halo.y = 0; this.img.scaleX = 1 / this.propRes; this.halo.setAlpha(0.8); return; }
    this.img.y = this.halo.y = Math.sin(tick * 2.2 + this.phase) * 2;
    if (this.kind === "buck") this.img.scaleX = (1 / this.propRes) * Math.max(0.35, Math.abs(Math.cos(tick * 1.2 + this.phase))); // a slow spin
    this.halo.setAlpha(0.7 + 0.2 * Math.sin(tick * 3 + this.phase));
  }
}
