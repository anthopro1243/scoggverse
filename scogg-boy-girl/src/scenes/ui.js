// The HUD, the pause menu and the end card: gold on dark stone, the engraved serif for titles and
// the plain face for small text. Buttons have real hover and keyboard-focus states.

import { PAL, css, FONT, SERIF, SERIF_SCALE } from "../art/palette.js";
import { DEPTH } from "../art/archive.js";
import { PROP_RES, stampTexture } from "../art/textures.js";
import { WORLD_W, WORLD_H } from "../logic/config.js";
import { clock } from "../logic/score.js";
import { audio } from "../audio/audio.js";

const money = (v) => `$${v.toFixed(2)}`;

export function text(scene, x, y, str, { size = 11, serif = false, color = PAL.gold, align = "left", origin = [0, 0.5] } = {}) {
  return scene.label(x, y, str, { fontFamily: serif ? SERIF : FONT, fontStyle: "700", fontSize: `${serif ? Math.round(size * SERIF_SCALE) : size}px`, color: css(color), align })
    .setOrigin(...origin);
}

/** A stone tablet: dark fill, thin gold edge, lit top line. */
export function slab(g, x, y, w, h, alpha = 0.9) {
  g.fillStyle(PAL.outline, alpha).fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 4);
  g.fillStyle(PAL.tablet, alpha).fillRoundedRect(x, y, w, h, 3);
  g.lineStyle(1, PAL.goldDim, 0.9).strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 2);
  g.fillStyle(PAL.gold, 0.35).fillRect(x + 4, y + 1, w - 8, 1);
  return g;
}

export class Hud {
  constructor(scene, title, totals) {
    this.scene = scene;
    this.totals = totals;
    const ui = DEPTH.ui;
    const g = scene.add.graphics().setDepth(ui);
    // the level's name: the tablet grows with it, and a long name gets a smaller letter so it
    // never runs into the value tablet in the middle
    const room = WORLD_W / 2 - 92 - 10 - 8;
    let size = 13;
    this.title = text(scene, 0, 21, title.toUpperCase(), { size, serif: true, color: PAL.goldBright, origin: [0.5, 0.5] }).setDepth(ui);
    while (this.title.width / this.title.scaleX + 26 > room && size > 9) this.title.setFontSize(`${--size}px`);
    const tw = Math.max(150, Math.ceil(this.title.width / this.title.scaleX) + 26);
    slab(g, 10, 8, tw, 26);
    this.title.setX(10 + tw / 2);
    // the Scogg Buck's value right now (it drops as the clock runs)
    slab(g, WORLD_W / 2 - 92, 8, 184, 26);
    scene.add.image(WORLD_W / 2 - 74, 21, "buck").setScale(0.75 / PROP_RES).setDepth(ui);
    this.value = text(scene, WORLD_W / 2 - 60, 21, "", { size: 12, color: PAL.goldBright }).setDepth(ui);
    this.valueNote = text(scene, WORLD_W / 2 + 84, 21, "each", { size: 10, color: PAL.textDim, origin: [1, 0.5] }).setDepth(ui);
    // what's been picked up, and the clock
    slab(g, WORLD_W - 216, 8, 206, 26);
    scene.add.image(WORLD_W - 198, 21, "buck").setScale(0.7 / PROP_RES).setDepth(ui);
    this.bucks = text(scene, WORLD_W - 186, 21, "").setDepth(ui);
    scene.add.image(WORLD_W - 138, 21, "gavel").setScale(0.62 / PROP_RES).setDepth(ui);
    this.gavels = text(scene, WORLD_W - 126, 21, "").setDepth(ui);
    this.clock = text(scene, WORLD_W - 20, 21, "", { size: 12, color: PAL.text, origin: [1, 0.5] }).setDepth(ui);
    this.hint = text(scene, WORLD_W - 12, 46, "", { size: 9, color: PAL.textDim, origin: [1, 0.5] }).setDepth(ui).setAlpha(0.8);
    this.last = {};
  }

  setMuted(m) {
    this.hint.setText(m ? "Sound off (M)" : "");
  }

  update({ time, value, bucks, gavels }) {
    const s = { value: money(value), bucks: `${bucks}/${this.totals.bucks}`, gavels: `${gavels}/${this.totals.gavels}`, clock: clock(time) };
    if (s.value !== this.last.value) this.value.setText(`Scogg Buck  ${s.value}`);
    if (s.bucks !== this.last.bucks) this.bucks.setText(s.bucks);
    if (s.gavels !== this.last.gavels) this.gavels.setText(s.gavels);
    if (s.clock !== this.last.clock) this.clock.setText(s.clock);
    this.last = s;
  }
}

/** Buttons that work with the mouse and the keyboard (Up/Down/Tab to move, Enter/Space to press). */
export class Buttons {
  constructor(scene, depth) {
    this.scene = scene;
    this.depth = depth;
    this.list = [];
    this.focus = 0;
    this.active = false;
    const kb = scene.input.keyboard;
    // one key press acts on one set of buttons: a press that opens another panel isn't also its first press
    const own = (fn) => (e) => { if (!this.active || !this.list.length || e?.__sbgDone) return; if (e) e.__sbgDone = true; fn(e); };
    const move = (d) => { this.focus = (this.focus + d + this.list.length) % this.list.length; this.paint(); audio.play("ui"); };
    // a setting row (it has adjust) takes left and right for itself
    const side = (d) => {
      const b = this.list[this.focus];
      if (b?.adjust) { b.adjust(d); audio.play("ui"); this.paint(); } else move(d);
    };
    const press = () => { audio.play("ui"); this.list[this.focus].onClick(); };
    kb.on("keydown-UP", own(() => move(-1)));
    kb.on("keydown-DOWN", own(() => move(1)));
    kb.on("keydown-LEFT", own(() => side(-1)));
    kb.on("keydown-RIGHT", own(() => side(1)));
    kb.on("keydown-TAB", own((e) => { e?.preventDefault?.(); move(e?.shiftKey ? -1 : 1); }));
    kb.on("keydown-ENTER", own(press));
    kb.on("keydown-SPACE", own(press));
  }

  /**
   * A button; with adjust(dir) it's a setting row instead: left and right (or a click on its left or
   * right half) change it, Enter steps it forward.
   */
  add(x, y, w, label, onClick, adjust = null) {
    const g = this.scene.add.graphics().setDepth(this.depth);
    const t = text(this.scene, x, y, label, { size: 12, color: PAL.goldBright, origin: [0.5, 0.5] }).setDepth(this.depth + 0.1);
    const zone = this.scene.add.zone(x, y, w, 28).setInteractive({ useHandCursor: true }).setDepth(this.depth + 0.2);
    const b = { x, y, w, g, t, zone, onClick: onClick || (() => adjust(1)), adjust, hover: false };
    zone.on("pointerover", () => { b.hover = true; this.focus = this.list.indexOf(b); this.paint(); });
    zone.on("pointerout", () => { b.hover = false; this.paint(); });
    zone.on("pointerdown", (ptr) => {
      audio.play("ui");
      if (adjust) { const wx = this.scene.cameras.main.getWorldPoint(ptr.x, ptr.y).x; adjust(wx < x ? -1 : 1); this.paint(); } else b.onClick();
    });
    this.list.push(b);
    return b;
  }

  paint() {
    this.list.forEach((b, i) => {
      const on = this.active && (i === this.focus || b.hover);
      b.g.clear();
      b.g.fillStyle(on ? 0x3a2c18 : PAL.tablet, 1).fillRoundedRect(b.x - b.w / 2, b.y - 13, b.w, 26, 3);
      b.g.lineStyle(on ? 1.6 : 1, on ? PAL.goldBright : PAL.goldDim, 1).strokeRoundedRect(b.x - b.w / 2, b.y - 13, b.w, 26, 3);
      if (on && !b.adjust) b.g.fillStyle(PAL.goldBright, 0.9).fillTriangle(b.x - b.w / 2 + 8, b.y - 4, b.x - b.w / 2 + 8, b.y + 4, b.x - b.w / 2 + 13, b.y);
      if (b.adjust) { // arrows at both ends
        b.g.fillStyle(on ? PAL.goldBright : PAL.goldDim, 0.95);
        b.g.fillTriangle(b.x - b.w / 2 + 13, b.y - 4.5, b.x - b.w / 2 + 13, b.y + 4.5, b.x - b.w / 2 + 7.5, b.y);
        b.g.fillTriangle(b.x + b.w / 2 - 13, b.y - 4.5, b.x + b.w / 2 - 13, b.y + 4.5, b.x + b.w / 2 - 7.5, b.y);
      }
      b.t.setColor(css(on ? 0xffffff : PAL.goldBright));
    });
  }

  setActive(v, focus = 0) {
    this.active = v;
    this.focus = focus;
    for (const b of this.list) { b.g.setVisible(v); b.t.setVisible(v); if (v) b.zone.setInteractive(); else b.zone.disableInteractive(); }
    this.paint();
  }
}

/** Esc: the game stops, a stone panel offers Resume, Restart, How to Play, Settings and the level select. */
export class PauseMenu {
  constructor(scene, { resume, restart, how, settings, levels }) {
    const d = DEPTH.ui + 2;
    this.parts = [];
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    this.parts.push(scene.add.rectangle(0, 0, WORLD_W, WORLD_H, PAL.void, 0.62).setOrigin(0).setDepth(d));
    this.parts.push(slab(scene.add.graphics().setDepth(d), cx - 150, cy - 133, 300, 266, 0.97));
    this.parts.push(text(scene, cx, cy - 105, "PAUSED", { size: 20, serif: true, color: PAL.goldBright, origin: [0.5, 0.5] }).setDepth(d));
    this.buttons = new Buttons(scene, d + 0.5);
    [["Resume  (Esc)", resume], ["Restart  (R)", restart], ["How to Play", how], ["Settings", settings], ["All chambers", levels]]
      .forEach(([label, fn], i) => this.buttons.add(cx, cy - 61 + i * 38, 180, label, fn));
    this.hide();
  }
  get visible() { return this.parts[0].visible; }
  show(focus = 0) { for (const p of this.parts) p.setVisible(true); this.buttons.setActive(true, focus); }
  hide() { for (const p of this.parts) p.setVisible(false); this.buttons.setActive(false); }
}

/** The level's end: a dark parchment card with the grade stamped on it. */
export class EndCard {
  constructor(scene, { again, levels, next }) {
    const d = DEPTH.ui + 4;
    this.scene = scene;
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    this.parts = [];
    const add = (o) => { this.parts.push(o.setDepth(d)); return o; };
    add(scene.add.rectangle(0, 0, WORLD_W, WORLD_H, PAL.void, 0.55).setOrigin(0));
    add(scene.add.image(cx, cy, "parchment").setScale(1 / 2));
    this.title = add(text(scene, cx, cy - 98, "", { size: 18, serif: true, color: PAL.goldBright, origin: [0.5, 0.5] }));
    this.sub = add(text(scene, cx, cy - 76, "CHAMBER ESCAPED", { size: 10, serif: true, color: PAL.goldDim, origin: [0.5, 0.5] }));
    this.rows = [0, 1, 2, 3].map((i) => [
      add(text(scene, cx - 150, cy - 46 + i * 21, "", { size: 11, color: PAL.text })),
      add(text(scene, cx + 40, cy - 46 + i * 21, "", { size: 11, color: PAL.goldBright, origin: [1, 0.5] })),
    ]);
    this.rule = add(scene.add.rectangle(cx - 55, cy + 6.5, 190, 1, PAL.goldDim, 0.9));
    this.line = add(text(scene, cx, cy + 48, "", { size: 11, color: PAL.text, align: "center", origin: [0.5, 0.5] }));
    this.lineBy = add(text(scene, cx, cy + 66, "Dr. Scoggins", { size: 9, serif: true, color: PAL.goldDim, origin: [0.5, 0.5] }));
    // the stamp
    this.stamp = add(scene.add.image(cx + 112, cy - 12, "__DEFAULT").setScale(1 / PROP_RES));
    // Enter takes the first button: the next chamber, or Play again after the last one
    this.buttons = new Buttons(scene, d + 0.5);
    const row = [next && ["Next chamber", next], ["Play again (R)", again], ["All chambers", levels]].filter(Boolean);
    row.forEach(([label, fn], i) => this.buttons.add(cx + (i - (row.length - 1) / 2) * 124, cy + 96, 118, label, fn));
    this.hide();
  }

  get visible() { return this.parts[0].visible; }

  show(r) {
    const s = this.scene;
    this.title.setText(s.def.name.toUpperCase());
    const rows = [
      ["Scogg Bucks", `${r.bucks}/${r.totals.bucks}   ${money(r.buckSum)}`],
      ["Gavels", `${r.gavels}/${r.totals.gavels}   ${money(r.gavelSum)}`],
      ["Time", clock(r.time)],
      ["Total", `${money(r.value)} of ${money(r.best)}`],
    ];
    rows.forEach(([a, b], i) => { this.rows[i][0].setText(a); this.rows[i][1].setText(b); });
    this.line.setText(`“${r.line}”`);
    this.stamp.setTexture(stampTexture(s, r.grade, 0xb02a1a, 44));
    for (const p of this.parts) p.setVisible(true);
    this.buttons.setActive(true);
  }

  hide() { for (const p of this.parts) p.setVisible(false); this.buttons.setActive(false); }
}


