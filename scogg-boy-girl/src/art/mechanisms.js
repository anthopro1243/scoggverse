// The level's moving parts, drawn in code in the Archive's style (dark outline, bronze, lit edges):
// element curtains (flame lets only Scogg Boy through, water only Scogg Girl), pressure plates and
// the bronze gates they open. Animated on the simulation clock, so replays match.
import Phaser from "phaser";
import { fitText } from "./fitText.js";
import { PAL } from "./palette.js";
import { DEPTH } from "./archive.js";
import { TILE, LEVEL } from "../logic/config.js";
import { flicker } from "./poses.js";

const BRONZE = { dark: 0x3a2612, mid: 0x7d5124, lit: 0xd9a35a, edge: 0xf0c27a };

/** A curtain of flame or falling water filling a rectangle of tiles. */
export class Curtain extends Phaser.GameObjects.Graphics {
  constructor(scene, { kind, c, r, w, h }) {
    super(scene);
    this.kind = kind;
    this.x = c * TILE; this.y = r * TILE;
    this.w = w * TILE; this.h = h * TILE;
    this.setDepth(DEPTH.items);
    if (kind === "flame") this.setBlendMode(Phaser.BlendModes.ADD); // fire gives off light
    scene.add.existing(this);
    this.draw(0);
  }

  draw(tick) {
    const g = this.clear(), w = this.w, h = this.h, cx = w / 2;
    const sheet = Math.min(w, this.kind === "flame" ? 20 : 14);
    if (this.kind === "flame") {
      // a sheet of fire: soft heat behind, tongues of flame climbing it, sparks rising off it
      const c = PAL.boy, half = sheet / 2 + 2;
      g.fillStyle(c.red, 0.18).fillRect(cx - half - 5, 0, 2 * half + 10, h);
      g.fillStyle(c.red, 0.22).fillRect(cx - half, 0, 2 * half, h);
      const rows = Math.ceil(h / 14) + 2;
      for (let k = 0; k < rows; k++) {
        const yy = h - k * 14 + ((tick * 30) % 14);
        for (let i = 0; i < 4; i++) {
          const fl = flicker(tick, k * 4 + i);
          const bx = cx + (i - 1.5) * half * 0.45 + Math.sin(tick * 3 + k * 1.7 + i) * 1.5;
          const tall = (14 + 8 * ((k * 7 + i * 3) % 4) / 3) * fl, fw = 5 - Math.abs(i - 1.5) * 0.8;
          g.fillStyle(i % 3 ? c.orange : c.red, 0.32).fillPoints(flamePts(bx, yy, tall, fw, Math.sin(tick * 4 + k)), true);
          g.fillStyle(c.gold, 0.22).fillPoints(flamePts(bx, yy, tall * 0.5, fw * 0.5, 0), true);
        }
      }
      for (let i = 0; i < 4; i++) {
        const ph = (tick * 0.5 + i / 4) % 1;
        g.fillStyle(c.gold, 0.8 * (1 - ph)).fillCircle(cx + Math.sin(tick * 2 + i * 2) * half, h * (1 - ph), 1);
      }
    } else {
      const c = PAL.girl;
      g.fillStyle(c.blue, 0.38).fillRect(cx - sheet / 2, 0, sheet, h);
      for (let i = 0; i < 5; i++) {           // streaks falling through the sheet
        const x = cx - sheet / 2 + 2 + i * (sheet - 4) / 4;
        for (let y = -20 + ((tick * 90 + i * 37) % 26); y < h; y += 26) {
          g.lineStyle(1, c.shine, 0.5).lineBetween(x, Math.max(0, y), x, Math.min(h, y + 10));
        }
      }
      g.lineStyle(1, c.light, 0.7).lineBetween(cx - sheet / 2, 0, cx - sheet / 2, h).lineBetween(cx + sheet / 2, 0, cx + sheet / 2, h);
      for (let i = 0; i < 3; i++) {           // splashes where it meets the floor
        const ph = (tick * 1.4 + i / 3) % 1;
        g.fillStyle(c.light, 0.6 * (1 - ph)).fillCircle(cx + (i - 1) * 6 * ph * 2, h - 2 - 6 * Math.sin(Math.PI * ph), 1.2);
      }
    }
    return this;
  }
}

/** A flame tongue standing on (x, y): a soft teardrop leaning a little with the draught. */
function flamePts(x, y, tall, w, lean) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * (i / 8);
    pts.push({ x: x - Math.cos(a) * w, y: y - Math.sin(a) * w * 0.9 });
  }
  pts.push({ x: x + w * 0.6 + lean * 0.6, y: y - tall * 0.55 }, { x: x + lean * 1.5, y: y - tall }, { x: x - w * 0.6 + lean * 0.6, y: y - tall * 0.55 });
  return pts;
}

/** A bronze pressure plate on the floor; sinks while someone stands on it. */
export class Plate extends Phaser.GameObjects.Graphics {
  constructor(scene, { c, r, group }) {
    super(scene);
    this.group = group;
    this.x = c * TILE; this.y = (r + 1) * TILE; // floor line
    this.setDepth(DEPTH.items);
    scene.add.existing(this);
    this.draw(false);
  }

  /** The area that counts as standing on it, in world units. */
  get zone() { return { x: this.x + 3, w: TILE - 6, y: this.y }; }

  draw(down) {
    const g = this.clear(), d = down ? LEVEL.plateDepth : 0;
    g.fillStyle(PAL.outline, 1).fillRect(0, -7 + d, TILE, 7 - d);
    g.fillStyle(BRONZE.mid, 1).fillRect(1, -6 + d, TILE - 2, 6 - d);
    g.fillStyle(down ? BRONZE.edge : BRONZE.lit, 1).fillRect(1, -6 + d, TILE - 2, 1.4);
    g.fillStyle(down ? 0xffd27a : BRONZE.dark, 1).fillCircle(TILE / 2, -3 + d / 2, 2);
    if (down) g.fillStyle(0xffb040, 0.35).fillCircle(TILE / 2, -3 + d / 2, 5);
    return this;
  }
}

/** A bronze portcullis filling a rectangle of tiles; slides up into the stone as it opens. */
export class Gate extends Phaser.GameObjects.Graphics {
  constructor(scene, { group, c, r, w, h, style }) {
    super(scene);
    this.group = group;
    this.style = style || "bronze";
    this.x = c * TILE; this.y = r * TILE;
    this.w = w * TILE; this.h = h * TILE;
    this.state = { open: 0 };
    this.setDepth(DEPTH.items);
    scene.add.existing(this);
    this.draw();
  }

  get rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  draw() {
    // a heavy bronze slab with vertical grooves and riveted bands, sliding up into the stone
    const g = this.clear(), w = this.w, shown = this.h * (1 - this.state.open);
    if (shown < 1) return this;
    if (this.style === "filibuster") return this.drawFilibuster(g, w, shown);
    g.fillStyle(PAL.outline, 1).fillRect(2, 0, w - 4, shown);
    g.fillStyle(BRONZE.dark, 1).fillRect(3, 0, w - 6, shown);
    g.fillStyle(BRONZE.mid, 1).fillRect(4, 0, w - 8, shown);
    g.fillStyle(BRONZE.lit, 0.35).fillRect(4, 0, 2, shown);                  // light down the left edge
    for (let x = 9; x < w - 6; x += 6) g.fillStyle(BRONZE.dark, 0.8).fillRect(x, 0, 1.2, shown);
    for (let y = shown - 14; y > 4; y -= 40) {                              // riveted bands
      g.fillStyle(BRONZE.dark, 1).fillRect(3, y, w - 6, 5).fillStyle(BRONZE.lit, 0.6).fillRect(3, y, w - 6, 1);
      for (let x = 7; x < w - 4; x += 8) g.fillStyle(BRONZE.edge, 1).fillCircle(x, y + 2.5, 1);
    }
    g.fillStyle(BRONZE.edge, 1).fillRect(3, shown - 3, w - 6, 3);           // the lit bottom edge
    return this;
  }

  /** The filibuster wall: a slab of pale marble covered in carved lines of endless speech. */
  drawFilibuster(g, w, shown) {
    g.fillStyle(PAL.outline, 1).fillRect(1, 0, w - 2, shown);
    g.fillStyle(0x6b7484, 1).fillRect(2, 0, w - 4, shown);
    g.fillStyle(0x8d97a8, 1).fillRect(2, 0, 2, shown);
    for (let y = 6; y < shown - 3; y += 5) g.fillStyle(0x3b4250, 0.8).fillRect(5, y, w - 10 - ((y * 7) % 9), 1.2);
    g.fillStyle(0xc7cfdc, 1).fillRect(2, shown - 3, w - 4, 3);
    return this;
  }
}

const MARBLE = { dark: 0x3b4250, mid: 0x5b6475, lit: 0x9aa4b5, edge: 0xc7cfdc };

/**
 * A lever on the floor: a bronze arm on a stone base, leaning left (off) or right (on).
 * Veto levers carry the emblem of who may pass ($) and who may strike down (gavel).
 */
export class LeverArt extends Phaser.GameObjects.Graphics {
  constructor(scene, x, y, rules) {
    super(scene);
    this.x = x; this.y = y;
    this.rules = rules || {};
    this.ang = -0.6;
    this.setDepth(DEPTH.items);
    scene.add.existing(this);
  }
  draw(on, tick) {
    const g = this.clear();
    const target = on ? 0.6 : -0.6;
    this.ang += (target - this.ang) * 0.35;
    const a = this.ang, L = 20;
    const tx = Math.sin(a) * L, ty = -6 - Math.cos(a) * L;
    g.lineStyle(4.2, PAL.outline, 1).lineBetween(0, -6, tx, ty);
    g.lineStyle(2.6, BRONZE.lit, 1).lineBetween(0, -6, tx, ty);
    g.fillStyle(PAL.outline, 1).fillCircle(tx, ty, 4.2);
    g.fillStyle(on ? 0xffd27a : BRONZE.mid, 1).fillCircle(tx, ty, 3);
    g.fillStyle(PAL.outline, 1).fillRoundedRect(-11, -9, 22, 9, 2);
    g.fillStyle(BRONZE.dark, 1).fillRoundedRect(-10, -8, 20, 8, 2);
    g.fillStyle(BRONZE.lit, 0.6).fillRect(-9, -8, 18, 1);
    const veto = this.rules.on && this.rules.on !== "any";
    if (veto) { // who passes it (right) and who strikes it down (left), as small lit marks on the base
      g.fillStyle(this.rules.on === "boy" ? PAL.boy.gold : PAL.girl.light, 1).fillCircle(6, -4, 2);
      g.fillStyle(this.rules.off === "boy" ? PAL.boy.gold : PAL.girl.light, 1).fillCircle(-6, -4, 2);
    }
    return this;
  }
}

/** A moving slab: bronze for platforms and the business-cycle elevators, marble for the scale's pans. */
export class SlabArt extends Phaser.GameObjects.Graphics {
  constructor(scene, w, h, style) {
    super(scene);
    this.sw = w; this.sh = h; this.style = style; // not w/h: setPosition() resets a game object's w to 0
    this.setDepth(DEPTH.items + 0.2);
    scene.add.existing(this);
    this.draw();
  }
  draw(glow = 0) {
    const g = this.clear(), w = this.sw, h = this.sh;
    const C = this.style === "pan" ? MARBLE : BRONZE;
    g.fillStyle(PAL.outline, 1).fillRect(0, 0, w, h);
    g.fillStyle(C.mid, 1).fillRect(1, 1, w - 2, h - 2);
    g.fillStyle(C.dark, 1).fillRect(1, h - 4, w - 2, 3);
    g.fillStyle(C.edge, 1).fillRect(1, 1, w - 2, 2);                // the lit top edge
    for (let x = 6; x < w - 4; x += 12) g.fillStyle(C.dark, 1).fillCircle(x, h / 2 + 1, 1.2);
    if (this.style === "elevator") {
      g.fillStyle(0xffd27a, 0.25 + 0.5 * glow).fillRect(w / 2 - 6, h / 2 - 1, 12, 2.5); // its cycle light
    }
    return this;
  }
}

/** Chains from a pan up to its pulley (the checks-and-balances scale). */
export class ChainArt extends Phaser.GameObjects.Graphics {
  constructor(scene) { super(scene); this.setDepth(DEPTH.items - 0.2); scene.add.existing(this); }
  draw(lines) {
    const g = this.clear();
    for (const [x, y0, y1] of lines) {
      g.lineStyle(2.2, PAL.outline, 1).lineBetween(x, y0, x, y1);
      g.lineStyle(1, MARBLE.lit, 0.9).lineBetween(x, y0, x, y1);
      for (let y = y0 + 2; y < y1; y += 5) g.fillStyle(MARBLE.edge, 0.7).fillRect(x - 1, y, 2, 1.2);
      g.fillStyle(PAL.outline, 1).fillCircle(x, y0, 4).fillStyle(MARBLE.mid, 1).fillCircle(x, y0, 2.6);
    }
    return this;
  }
}

/** A surplus crate: heavy wooden crate of unsold goods, banded in iron, "SURPLUS" stencilled on. */
export class CrateArt extends Phaser.GameObjects.Container {
  constructor(scene, w, h) {
    super(scene, 0, 0);
    const g = scene.add.graphics();
    g.fillStyle(PAL.outline, 1).fillRect(0, 0, w, h);
    g.fillStyle(0x6a4523, 1).fillRect(1, 1, w - 2, h - 2);
    for (let y = 3; y < h - 2; y += 6.5) g.fillStyle(0x553619, 1).fillRect(1, y, w - 2, 1);
    g.fillStyle(0x8a5f33, 1).fillRect(1, 1, w - 2, 1.5);
    g.lineStyle(1.6, 0x2b1a0c, 1).lineBetween(2, 2, w - 2, h - 2).lineBetween(w - 2, 2, 2, h - 2);
    g.fillStyle(0x3a3f47, 1).fillRect(0, 3, w, 2).fillRect(0, h - 5, w, 2);
    this.add(g);
    this.add(fitText(scene.add.text(w / 2, h / 2, "SURPLUS", { fontFamily: "Noto Sans", fontStyle: "700", fontSize: "5px", color: "#e0b070", resolution: 8 })).setOrigin(0.5).setAlpha(0.85));
    this.setDepth(DEPTH.items + 0.3);
    scene.add.existing(this);
  }
}

/** The Rules Committee's sand clock: an hourglass whose sand runs out, with the seconds left. */
export class HourglassArt extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    this.g = scene.add.graphics();
    this.t = scene.label(0, -46, "", { fontFamily: "Noto Sans", fontStyle: "700", fontSize: "10px", color: "#f3d58b" }).setOrigin(0.5);
    this.add([this.g, this.t]);
    this.setDepth(DEPTH.items);
    scene.add.existing(this);
  }
  draw(frac, secs) {
    const g = this.g.clear();
    const H = 34, W = 18, top = -H - 2;
    g.fillStyle(PAL.outline, 1).fillRect(-W / 2 - 2, top - 3, W + 4, 4).fillRect(-W / 2 - 2, -3, W + 4, 4);
    g.fillStyle(BRONZE.lit, 1).fillRect(-W / 2 - 1, top - 2, W + 2, 2).fillRect(-W / 2 - 1, -2, W + 2, 2);
    const glass = [{ x: -W / 2, y: top }, { x: W / 2, y: top }, { x: 1.5, y: top + H / 2 }, { x: W / 2, y: -3 }, { x: -W / 2, y: -3 }, { x: -1.5, y: top + H / 2 }];
    g.fillStyle(0x9fc4e8, 0.18).fillPoints(glass, true);
    g.lineStyle(1, 0xc7dcf0, 0.7).strokePoints(glass, true, true);
    const sand = 0xe0b070;
    if (frac > 0) { // sand left in the top bulb, a falling thread, a pile below
      const k = frac, ty = top + H / 2 - (H / 2 - 2) * k, half = (W / 2 - 1.5) * k + 1.5;
      g.fillStyle(sand, 1).fillTriangle(-half, ty, half, ty, 0, top + H / 2 - 0.5);
      g.fillStyle(sand, 1).fillRect(-0.5, top + H / 2, 1, H / 2 - 3);
    }
    const pile = (1 - frac) * (H / 2 - 4) + 1;
    g.fillStyle(sand, 1).fillTriangle(-W / 2 + 1, -3, W / 2 - 1, -3, 0, -3 - pile);
    this.t.setText(secs > 0 ? `${Math.ceil(secs)}` : "");
  }
}

/** A basin of Inflation whose level the money supply lever raises and lowers. */
export class BasinArt extends Phaser.GameObjects.Graphics {
  constructor(scene, x, w, kind) {
    super(scene);
    this.x = x; this.w = w; this.colors = PAL.pools[kind];
    this.setDepth(DEPTH.pools);
    scene.add.existing(this);
  }
  /** surface: y of the liquid's top, bottom: y of the basin floor. */
  draw(surface, bottom, tick) {
    const g = this.clear();
    const depth = bottom - surface;
    if (depth < 1) return this;
    const { top, mid, deep, coin } = this.colors;
    const w = this.w;
    const wave = (x) => surface + 4 + 1.3 * Math.sin(x * 0.16 + tick * 2.6) + 0.8 * Math.sin(x * 0.37 - tick * 3.7);
    const pts = [];
    for (let x = 0; x <= w; x += 3) pts.push({ x, y: Math.min(bottom, wave(x)) });
    pts.push({ x: w, y: bottom }, { x: 0, y: bottom });
    g.fillStyle(mid, 1).fillPoints(pts, true);
    g.fillStyle(deep, 1).fillRect(0, Math.max(surface + 8, bottom - 14), w, Math.min(14, depth));
    g.lineStyle(1.8, top, 1).beginPath();
    g.moveTo(0, Math.min(bottom, wave(0)));
    for (let x = 3; x <= w; x += 3) g.lineTo(x, Math.min(bottom, wave(x)));
    g.strokePath();
    for (let i = 0; i < Math.round(w / 30); i++) {
      const ph = (tick * 0.12 + i * 0.41) % 1, bx = (i + 0.5) * 30, cy = surface + 7 + ph * Math.min(10, depth - 6);
      if (cy < bottom - 2) g.fillStyle(coin, 1 - ph * 0.8).fillEllipse(bx, cy, 8 - 3 * ph, 4.6 - 3 * ph, 12);
    }
    return this;
  }
}
