// Stone panels over the title screen and the pause menu: How to Play, Settings and Credits.
// Each has its own keyboard-and-mouse buttons; Back (or Esc, handled by the scene) closes it.
import { PAL } from "../art/palette.js";
import { DEPTH } from "../art/archive.js";
import { WORLD_W, WORLD_H } from "../logic/config.js";
import { prefs } from "../prefs.js";
import { text, slab, Buttons } from "./ui.js";

const CX = WORLD_W / 2, CY = WORLD_H / 2;

class Panel {
  constructor(scene, { w, h, title, back, depth = DEPTH.ui + 6 }) {
    this.scene = scene;
    this.depth = depth;
    this.parts = [];
    this.w = w; this.h = h;
    this.top = CY - h / 2;
    this.add(scene.add.rectangle(0, 0, WORLD_W, WORLD_H, PAL.void, 0.72).setOrigin(0));
    this.add(slab(scene.add.graphics(), CX - w / 2, this.top, w, h, 0.97));
    this.add(text(scene, CX, this.top + 30, title, { size: 20, serif: true, color: PAL.goldBright, origin: [0.5, 0.5] }));
    this.buttons = new Buttons(scene, depth + 0.5);
    this.back = back;
  }

  add(o) { this.parts.push(o.setDepth(this.depth)); return o; }
  backButton(y = this.top + this.h - 30) { this.buttons.add(CX, y, 160, "Back  (Esc)", () => this.back()); }
  get visible() { return this.parts[0].visible; }
  show() { for (const p of this.parts) p.setVisible(true); this.buttons.setActive(true); return this; }
  hide() { for (const p of this.parts) p.setVisible(false); this.buttons.setActive(false); return this; }
}

/** Controls for both players, the rules in a few lines, and the keys. */
export class HowToPanel extends Panel {
  constructor(scene, opts) {
    super(scene, { w: 620, h: 396, title: "HOW TO PLAY", ...opts });
    const s = this.scene, y0 = this.top + 66;
    const col = (x, name, color, lines) => {
      this.add(text(s, x, y0, name, { size: 14, serif: true, color, origin: [0.5, 0.5] }));
      lines.forEach((l, i) => this.add(text(s, x, y0 + 24 + i * 19, l, { size: 11, color: i === 1 ? PAL.goldBright : PAL.text, origin: [0.5, 0.5] })));
    };
    col(CX - 150, "SCOGG BOY", 0xffb35c, ["AP Macro, made of fire", "W jump   A D move", "Grabs the Scogg Bucks", "Ink kills him"]);
    col(CX + 150, "SCOGG GIRL", 0x9fd2ff, ["AP Gov, made of water", "Up jump   Left Right move", "Grabs the Gavels", "Inflation kills her"]);
    this.add(s.add.rectangle(CX, y0 + 108, this.w - 80, 1, PAL.goldDim, 0.7));
    [
      "Recession takes anyone. Plates, levers, crates and scales open the way,",
      "and most of them need both of you.",
      "Bucks lose value the longer you take.",
      "Both stand at your own door to escape the chamber.",
    ].forEach((l, i) => this.add(text(s, CX, y0 + 128 + i * 19, l, { size: 11, color: PAL.text, origin: [0.5, 0.5] })));
    this.add(text(s, CX, y0 + 216, "Esc pause   R restart   M sound   F full screen   Two gamepads work too", { size: 10, color: PAL.textDim, origin: [0.5, 0.5] }));
    this.backButton();
    this.hide();
  }
}

/** Volume, music, sound on or off, and reduce motion; saved in this browser. */
export class SettingsPanel extends Panel {
  constructor(scene, opts) {
    super(scene, { w: 380, h: 300, title: "SETTINGS", ...opts });
    const pct = (v) => `${Math.round(v * 100)}%`;
    const step = (k) => (d) => prefs.set(k, Math.round((prefs.get(k) + d * 0.1) * 10) / 10);
    const flip = (k) => () => prefs.toggle(k);
    this.rows = [
      [() => `Volume   ${pct(prefs.get("volume"))}`, step("volume")],
      [() => `Music   ${pct(prefs.get("music"))}`, step("music")],
      [() => `Sound   ${prefs.get("muted") ? "Off" : "On"}`, flip("muted")],
      [() => `Reduce motion   ${prefs.get("reduceMotion") ? "On" : "Off"}`, flip("reduceMotion")],
    ].map(([label, adjust], i) => ({ label, b: this.buttons.add(CX, this.top + 76 + i * 38, 260, label(), null, adjust) }));
    this.backButton();
    const unwatch = prefs.watch(() => this.refresh());
    scene.events.once("shutdown", unwatch);
    this.hide();
  }
  refresh() { for (const r of this.rows) r.b.t.setText(r.label()); }
}

/** Engine and font licenses, where the faces come from, and the fan-parody line. */
export class CreditsPanel extends Panel {
  constructor(scene, opts) {
    super(scene, { w: 600, h: 360, title: "CREDITS", ...opts });
    const s = this.scene;
    const lines = [
      ["Faces from the class deck The Scogg Files", PAL.goldBright],
      ["Built with Phaser (MIT License)", PAL.text],
      ["Fonts: Noto Sans and Cinzel (SIL Open Font License 1.1)", PAL.text],
      ["", PAL.text],
      ["Unofficial fan parody. Not affiliated with Fireboy and Watergirl or its makers.", PAL.textDim],
      ["Made with Dr. Scoggins' permission, for fun.", PAL.textDim],
    ];
    lines.forEach(([l, color], i) => this.add(text(s, CX, this.top + 74 + i * 24, l, { size: 11, color, origin: [0.5, 0.5] })));
    this.backButton();
    this.hide();
  }
}
