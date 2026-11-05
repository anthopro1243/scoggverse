// The title screen: the name on a carved slab over the Archive, both heroes waiting on the floor,
// and Play, How to Play, Settings and Credits. Play goes to the level select.
import { BaseScene } from "./base.js";
import { Hero } from "../art/hero.js";
import { buildArchive, DEPTH } from "../art/archive.js";
import { PAL } from "../art/palette.js";
import { parseGrid } from "../logic/grid.js";
import { WORLD_W, WORLD_H, TILE } from "../logic/config.js";
import { text, slab, Buttons } from "./ui.js";
import { HowToPanel, SettingsPanel, CreditsPanel } from "./panels.js";

const ROOM = Array.from({ length: 18 }, (_, r) => (r === 0 || r >= 16 ? "#".repeat(32) : `#${".".repeat(30)}#`));

export class Title extends BaseScene {
  constructor() { super("title"); }

  create() {
    this.setupCamera();
    this.archive = buildArchive(this, parseGrid(ROOM), {
      wings: [{ x: 0, y: 0, w: WORLD_W / 2, h: WORLD_H, wing: "macro" }, { x: WORLD_W / 2, y: 0, w: WORLD_W / 2, h: WORLD_H, wing: "gov" }],
      seed: "title", rs: this.rs,
    });
    const d = DEPTH.ui;
    slab(this.add.graphics().setDepth(d), WORLD_W / 2 - 250, 70, 500, 104, 0.95);
    text(this, WORLD_W / 2, 112, "SCOGG BOY & SCOGG GIRL", { size: 30, serif: true, color: PAL.goldBright, origin: [0.5, 0.5] }).setDepth(d);
    text(this, WORLD_W / 2, 148, "2 player. Grab a friend.", { size: 12, color: PAL.text, origin: [0.5, 0.5] }).setDepth(d);

    this.heroes = [new Hero(this, WORLD_W / 2 - 150, 16 * TILE, "boy"), new Hero(this, WORLD_W / 2 + 150, 16 * TILE, "girl")];
    this.heroes[1].facing = -1;
    for (const h of this.heroes) { h.setDepth(DEPTH.heroes); h.play("idle"); }

    this.menu = new Buttons(this, d + 0.5);
    const close = () => this.openPanel(null);
    this.panels = { how: new HowToPanel(this, { back: close }), settings: new SettingsPanel(this, { back: close }), credits: new CreditsPanel(this, { back: close }) };
    [["Play", () => this.scene.start("select")], ["How to Play", () => this.openPanel("how")], ["Settings", () => this.openPanel("settings")], ["Credits", () => this.openPanel("credits")]]
      .forEach(([label, fn], i) => this.menu.add(WORLD_W / 2, 236 + i * 40, 200, label, fn));
    this.menu.setActive(true);
    text(this, WORLD_W / 2, WORLD_H - 22, "Unofficial fan parody. Not affiliated with Fireboy and Watergirl or its makers.", { size: 9, color: PAL.textDim, origin: [0.5, 0.5] }).setDepth(d).setAlpha(0.85);
    this.onKey("keydown-ESC", () => { if (this.open) this.openPanel(null); });

    this.t = 0;
    const { rs, game } = window.__sbg || {};
    window.__sbg = {
      rs, game, scene: "title", ready: true,
      /** Which panel is open (null on the title itself) and the menu's focus. */
      title: () => ({ panel: this.open, focus: this.menu.focus }),
    };
  }

  /** Show one panel (or none, back to the menu). */
  openPanel(name) {
    const was = this.open ? Object.keys(this.panels).indexOf(this.open) + 1 : 0;
    for (const [k, p] of Object.entries(this.panels)) if (k !== name) p.hide();
    this.open = name;
    if (name) { this.menu.setActive(false); this.panels[name].show(); } else this.menu.setActive(true, was);
  }

  update(_t, delta) {
    const dt = Math.min(0.05, delta / 1000);
    this.t += dt;
    for (const h of this.heroes) h.tickPose(dt, this.t);
    this.archive.update(this.t, this.heroes);
  }
}
