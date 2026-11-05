import { BaseScene } from "./base.js";
import { makeTextures } from "../art/textures.js";
import boyFace from "../../assets/faces/scogg-boy.png";
import girlFace from "../../assets/faces/scogg-girl.png";

export class Boot extends BaseScene {
  constructor() { super("boot"); }

  preload() {
    this.load.image("face-boy", boyFace);
    this.load.image("face-girl", girlFace);
  }

  async create() {
    // Text and engravings are drawn into textures, so the self-hosted fonts must be loaded first.
    try {
      await Promise.all(['400 16px "Noto Sans"', '700 16px "Noto Sans"', '700 16px "Cinzel"'].map((f) => document.fonts.load(f)));
    } catch { /* fall back to system fonts */ }
    makeTextures(this);
    // the title screen, unless a link names a level (?level=), the level select (?scene=select) or,
    // in the dev server only, the look sheet (?scene=look)
    const params = new URLSearchParams(location.search);
    const scene = params.get("scene");
    const known = ["select", "title", ...(this.game.scene.keys.look ? ["look"] : [])];
    this.scene.start(known.includes(scene) ? scene : params.has("level") ? "level" : "title");
  }
}
