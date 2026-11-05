// The three pools, animated in code on the simulation clock (so replays match), in the colors of
// Kenney's water tile: Ink is the water itself, Inflation the same swapped to lava, Recession to
// green slime. A stepped wave on top, a few bubbles. Pools draw over the heroes' feet.
import Phaser from "phaser";
import { TILE } from "../logic/config.js";
import { DEPTH } from "./archive.js";
import { prefs } from "../prefs.js";

const POOL_COLORS = {
  ink: { main: 0x2cc5f6, light: 0x4ce5fd },
  inflation: { main: 0xf4682c, light: 0xffd34d },
  recession: { main: 0x5ac54f, light: 0x99e65f },
};
const OUTLINE = 0x434a5f;

export const POOL_SURFACE = 4; // liquid surface sits this far below the floor line

export class Pool extends Phaser.GameObjects.Graphics {
  constructor(scene, { c, r, len, kind }) {
    super(scene);
    this.kind = kind;
    this.x = c * TILE;
    this.y = r * TILE;
    this.w = len * TILE;
    this.colors = POOL_COLORS[kind];
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
    const { main, light } = this.colors;
    const w = this.w, s = POOL_SURFACE, step = 3;
    const speed = this.kind === "inflation" ? 1 : 0.45; // ink and recession move slowly
    // a wave in 1.5-unit steps, so it moves like pixels rather than a smooth line
    const wave = (x) => s + 1.5 * Math.round(Math.sin(x * 0.16 + tick * 2.6 * speed) + 0.6 * Math.sin(x * 0.37 - tick * 3.7 * speed));
    for (let x = 0; x < w; x += step) {
      const y = wave(x);
      g.fillStyle(light, 1).fillRect(x, y, step, 3);
      g.fillStyle(main, 1).fillRect(x, y + 3, step, TILE - y - 3);
    }
    g.fillStyle(OUTLINE, 1).fillRect(0, s - 2, 2, TILE - s + 2).fillRect(w - 2, s - 2, 2, TILE - s + 2);
    if (this.kind === "ink") return this;
    // square bubbles rising through lava and slime
    const n = Math.max(2, Math.round(w / 26));
    for (let i = 0; i < n; i++) {
      const bx = Math.round(((i + 0.5) / n) * w + 5 * Math.sin(i * 7.1));
      const ph = (tick * (this.kind === "inflation" ? 0.3 : 0.18) + i * 0.37) % 1;
      g.fillStyle(light, 1 - ph).fillRect(bx, TILE - 4 - ph * (TILE - s - 6), 3, 3);
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
    this.img = scene.add.image(0, 0, kind).setScale(1 / propRes);
    this.add(this.img);
    this.setDepth(DEPTH.items);
    scene.add.existing(this);
    this.propRes = propRes;
  }

  draw(tick) {
    if (prefs.get("reduceMotion")) { this.img.y = 0; this.img.scaleX = 1 / this.propRes; return; }
    this.img.y = Math.round(Math.sin(tick * 2.2 + this.phase) * 2);
    if (this.kind === "buck") this.img.scaleX = (1 / this.propRes) * Math.max(0.35, Math.abs(Math.cos(tick * 1.2 + this.phase))); // a slow spin
  }
}
