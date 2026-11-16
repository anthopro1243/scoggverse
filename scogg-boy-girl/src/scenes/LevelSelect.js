// The level select: every chamber on a stone tablet with its subject, what it teaches and the best
// grade stamped on it. A chamber opens once the one before it is escaped. Arrow keys (or the
// mouse) choose, Enter (or a click) plays. Progress lives in localStorage when the browser allows.
import { BaseScene } from "./base.js";
import { Hero } from "../art/hero.js";
import { buildArchive, DEPTH } from "../art/archive.js";
import { PAL } from "../art/palette.js";
import { parseGrid } from "../logic/grid.js";
import { WORLD_W, WORLD_H, TILE } from "../logic/config.js";
import { LEVELS, ORDER } from "../levels.js";
import { progress } from "../progress.js";
import { isUnlocked, nextToPlay } from "../logic/progress.js";
import { text, slab } from "./ui.js";
import { stampTexture, PROP_RES } from "../art/textures.js";
import { audio } from "../audio/audio.js";
import { prefs } from "../prefs.js";

// the room behind the tablets: walls, a floor for the two heroes, Macro on the left, Gov on the right
const ROOM = Array.from({ length: 18 }, (_, r) => (r === 0 || r >= 16 ? "#".repeat(32) : `#${".".repeat(30)}#`));
const COLS = 3, CARD_W = 268, CARD_H = 92, GAP_X = 14, GAP_Y = 12;
const X0 = (WORLD_W - (COLS * CARD_W + (COLS - 1) * GAP_X)) / 2, Y0 = 100;
const SUBJECT = { macro: "MACRO", gov: "GOV", both: "MACRO + GOV" };
// only some cards say their subject; a tag on every card reads like a form
const TAGGED = new Set(["along-the-curve", "cats-in-a-sack", "quaker-oats-incident", "factor-market"]);
const STAMP = 0xb02a1a;

export class LevelSelect extends BaseScene {
  constructor() { super("select"); }

  create() {
    this.setupCamera();
    buildArchive(this, parseGrid(ROOM), {
      wings: [{ x: 0, y: 0, w: WORLD_W / 2, h: WORLD_H, wing: "macro" }, { x: WORLD_W / 2, y: 0, w: WORLD_W / 2, h: WORLD_H, wing: "gov" }],
      seed: "select", rs: this.rs,
    });
    const d = DEPTH.ui;
    const head = this.add.graphics().setDepth(d);
    slab(head, WORLD_W / 2 - 200, 22, 400, 58, 0.94);
    text(this, WORLD_W / 2, 44, "SCOGG BOY & SCOGG GIRL", { size: 22, serif: true, color: PAL.goldBright, origin: [0.5, 0.5] }).setDepth(d);
    text(this, WORLD_W / 2, 67, "Choose a chamber", { size: 11, color: PAL.text, origin: [0.5, 0.5] }).setDepth(d);

    const p = progress.get();
    this.cards = ORDER.map((name, i) => this.card(name, i, p));
    this.focus = Math.max(0, ORDER.indexOf(nextToPlay(p, ORDER)));

    // the heroes wait on the floor
    this.heroes = [new Hero(this, 70, 16 * TILE, "boy"), new Hero(this, WORLD_W - 70, 16 * TILE, "girl")];
    this.heroes[1].facing = -1;
    for (const h of this.heroes) { h.setDepth(DEPTH.heroes); h.play("idle"); }

    // the two hint lines sit on a dark label so they read over the bright sky
    this.add.graphics().setDepth(d).fillStyle(PAL.tablet, 0.92).fillRoundedRect(WORLD_W / 2 - 250, 411, 500, 44, 6);
    text(this, WORLD_W / 2, 424, "Arrow keys or the mouse to choose  ·  Enter to play  ·  Esc title", { size: 11, color: PAL.text, origin: [0.5, 0.5] }).setDepth(d);
    this.note = text(this, WORLD_W / 2, 444, "", { size: 10, color: PAL.textDim, origin: [0.5, 0.5] }).setDepth(d);
    this.note.setText("Escape a chamber to open the next one.");

    const move = (dx, dy) => {
      const col = this.focus % COLS, row = Math.floor(this.focus / COLS);
      const n = (row + dy) * COLS + (col + dx);
      if (col + dx >= 0 && col + dx < COLS && n >= 0 && n < this.cards.length) { this.focus = n; this.paint(); audio.play("ui"); }
    };
    this.onKey("keydown-LEFT", () => move(-1, 0));
    this.onKey("keydown-RIGHT", () => move(1, 0));
    this.onKey("keydown-UP", () => move(0, -1));
    this.onKey("keydown-DOWN", () => move(0, 1));
    this.onKey("keydown-A", () => move(-1, 0));
    this.onKey("keydown-D", () => move(1, 0));
    this.onKey("keydown-W", () => move(0, -1));
    this.onKey("keydown-TAB", (e) => { e.preventDefault?.(); this.focus = (this.focus + (e.shiftKey ? -1 : 1) + this.cards.length) % this.cards.length; this.paint(); });
    this.onKey("keydown-ENTER", () => this.play(ORDER[this.focus]));
    this.onKey("keydown-SPACE", () => this.play(ORDER[this.focus]));
    this.onKey("keydown-ESC", () => this.scene.start("title"));
    this.paint();

    this.t = 0;
    const { rs, game } = window.__sbg || {};
    window.__sbg = {
      rs, game,
      scene: "select",
      ready: true,
      /** What the level select shows: each chamber, open or not, its best grade, and which one is chosen. */
      select: () => ({ focus: ORDER[this.focus], saved: progress.saved, levels: this.cards.map((c) => ({ name: c.name, unlocked: c.open, best: c.best ?? null })) }),
    };
  }

  card(name, i, p) {
    const def = LEVELS[name];
    const x = X0 + (i % COLS) * (CARD_W + GAP_X), y = Y0 + Math.floor(i / COLS) * (CARD_H + GAP_Y);
    const open = isUnlocked(p, ORDER, name), best = p.best[name];
    const d = DEPTH.ui;
    const g = this.add.graphics().setDepth(d);
    const parts = [];
    const add = (o) => { parts.push(o.setDepth(d + 0.1)); return o; };
    // the number in a ring, the name, the subject and what it teaches
    add(text(this, x + 26, y + CARD_H / 2, String(i + 1), { size: 20, serif: true, color: PAL.goldBright, origin: [0.5, 0.5] }));
    const title = add(text(this, x + 52, y + 30, def.name, { size: 15, serif: true, color: PAL.goldBright, origin: [0, 0.5] }));
    title.setWordWrapWidth(CARD_W - 52 - 64).setLineSpacing(-2);
    if (TAGGED.has(name)) add(text(this, x + 52, y + CARD_H - 30, SUBJECT[def.subject] || "", { size: 9, color: PAL.goldDim, origin: [0, 0.5] }));
    add(text(this, x + 52, y + CARD_H - 16, def.teaches || "", { size: 10, color: PAL.text, origin: [0, 0.5] }));
    if (title.height > 22) title.setY(y + 24); // two lines: sit a little higher
    // the grade stamp, or a padlock while it's shut
    const mark = this.add.graphics().setDepth(d + 0.2);
    const sx = x + CARD_W - 38, sy = y + CARD_H / 2;
    let stamp = null;
    if (best) {
      stamp = this.add.image(sx, sy, stampTexture(this, best, STAMP)).setScale(1 / PROP_RES).setDepth(d + 0.2);
    } else if (!open) {
      mark.fillStyle(PAL.goldDim, 1).fillRoundedRect(sx - 11, sy - 2, 22, 17, 3);
      mark.lineStyle(3, PAL.goldDim, 1).beginPath().arc(sx, sy - 3, 7, Math.PI, 0).strokePath();
      mark.fillStyle(PAL.tablet, 1).fillCircle(sx, sy + 5, 2.4).fillRect(sx - 1, sy + 5, 2, 5);
    }
    const zone = this.add.zone(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H).setInteractive({ useHandCursor: open }).setDepth(d + 0.3);
    const c = { name, x, y, g, parts, mark, stamp, open, best, hover: false };
    zone.on("pointerover", () => { c.hover = true; this.focus = i; this.paint(); });
    zone.on("pointerout", () => { c.hover = false; this.paint(); });
    zone.on("pointerdown", () => this.play(name));
    return c;
  }

  paint() {
    this.cards.forEach((c, i) => {
      const on = i === this.focus;
      const g = c.g.clear();
      slab(g, c.x, c.y, CARD_W, CARD_H, 0.94);
      g.lineStyle(1, PAL.goldDim, 0.6).strokeCircle(c.x + 26, c.y + CARD_H / 2, 16);
      if (on) g.lineStyle(2, c.open ? PAL.goldBright : PAL.goldDim, 1).strokeRoundedRect(c.x - 2, c.y - 2, CARD_W + 4, CARD_H + 4, 5);
      const a = c.open ? 1 : 0.7;
      for (const o of c.parts) o.setAlpha(a);
      c.mark.setAlpha(c.open ? 1 : 0.8);
    });
  }

  play(name) {
    const c = this.cards.find((k) => k.name === name);
    if (!c?.open) {
      // a shut chamber: the padlock gives a little shake
      if (c && !prefs.get("reduceMotion")) this.tweens.add({ targets: c.mark, x: { from: -3, to: 3 }, duration: 50, yoyo: true, repeat: 2, onComplete: () => c.mark.setX(0) });
      return;
    }
    this.scene.start("level", { level: name });
  }

  update(_t, delta) {
    const dt = Math.min(0.05, delta / 1000);
    this.t += dt;
    for (const h of this.heroes) h.tickPose(dt, this.t);
  }
}
