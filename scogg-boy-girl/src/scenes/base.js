// Shared setup for every scene: the world is 960x540; the camera zooms to the canvas's render
// scale so vector shapes and text stay crisp at any screen size.
import Phaser from "phaser";
import { WORLD_W, WORLD_H } from "../logic/config.js";
import { PAL, css, FONT, SERIF } from "../art/palette.js";
import { DEPTH } from "../art/archive.js";
import { fitText } from "../art/fitText.js";

export class BaseScene extends Phaser.Scene {
  get rs() { return this.registry.get("rs"); }

  /**
   * A key handler that runs once per key press. Under load Phaser can hand the same press to a
   * scene more than once in a frame (one Esc toggled the pause three times), so repeats are skipped.
   */
  onKey(name, fn) {
    const seen = new WeakSet();
    this.input.keyboard.on(name, (e) => {
      if (e && typeof e === "object") { if (seen.has(e)) return; seen.add(e); }
      fn(e);
    });
  }

  setupCamera() {
    this.cameras.main.setZoom(this.rs).centerOn(WORLD_W / 2, WORLD_H / 2);
  }

  /** Text that stays sharp under the camera zoom, and never clips its last letter. */
  label(x, y, text, style = {}) {
    return fitText(this.add.text(x, y, text, { resolution: Math.max(2, Math.ceil(this.rs * 2)), ...style }).setDepth(DEPTH.ui));
  }

  /** Gold lettering on a dark stone tablet (small text uses the plain face, titles the engraved serif). */
  tablet(x, y, text, { size = 11, serif = false, origin = 0.5 } = {}) {
    return this.label(x, y, text, {
      fontFamily: serif ? SERIF : FONT, fontStyle: "700", fontSize: `${size}px`,
      color: css(serif ? PAL.goldBright : PAL.gold), backgroundColor: css(PAL.tablet, 0.88),
      padding: { x: serif ? 9 : 6, y: serif ? 5 : 3 },
    }).setOrigin(origin, 0.5);
  }
}
