import { BaseScene } from "./base.js";
import { makeTextures } from "../art/textures.js";
import { initKenney } from "../art/kenney.js";
import kenneyTiles from "../../assets/kenney/tilemap_packed.png";
import kenneyBg from "../../assets/kenney/tilemap-backgrounds_packed.png";
import boyFace from "../../assets/faces/scogg-boy.png";
import girlFace from "../../assets/faces/scogg-girl.png";

export class Boot extends BaseScene {
  constructor() { super("boot"); }

  preload() {
    this.load.image("face-boy", boyFace);
    this.load.image("face-girl", girlFace);
    this.load.image("kenney-tiles", kenneyTiles);
    this.load.image("kenney-bg", kenneyBg);
  }

  async create() {
    // Text and engravings are drawn into textures, so the self-hosted fonts must be loaded first.
    try {
      await Promise.all(['400 16px "Noto Sans"', '700 16px "Noto Sans"', '16px "Kenney Pixel"'].map((f) => document.fonts.load(f)));
    } catch { /* fall back to system fonts */ }
    initKenney(this);
    makeTextures(this);
    // the title screen, unless a link names a level (?level=), the level select (?scene=select) or,
    // in the dev server only, the look sheet (?scene=look)
    const params = new URLSearchParams(location.search);
    const scene = params.get("scene");
    const known = ["select", "title", ...(this.game.scene.keys.look ? ["look"] : [])];
    this.scene.start(known.includes(scene) ? scene : params.has("level") ? "level" : "title");
  }
}
