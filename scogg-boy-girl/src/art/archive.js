// The level's backdrop and ground, from Kenney's "Pixel Platformer" tiles (CC0). Each level is drawn
// with Canvas 2D into two textures: a sky layer that drifts a little (parallax) and the ground tiles.
// Macro wing: desert sky, sand-topped ground. Gov wing: pale sky, white tops like marble steps.
import Phaser from "phaser";
import { TILE, WORLD_W, WORLD_H } from "../logic/config.js";
import { createRng } from "../logic/rng.js";
import { DOOR, PROP_RES, mottoSign } from "./textures.js";
import { mottoRect } from "../logic/motto.js";
import { drawTile } from "./kenney.js";
import { prefs } from "../prefs.js";

const OV = 24; // parallax overscan, world units
const BG = 48; // one background tile, world units (24 px tiles shown 2x)

export const DEPTH = { far: 0, mid: 1, tiles: 2, light: 3, vignette: 4, dust: 5, doors: 6, items: 7, heroes: 10, pools: 12, ui: 20 };

// background tile ids per wing: plain sky, the horizon band (picked at random), the ground below it
const SKY = {
  macro: { sky: 4, horizon: [12, 13, 12], below: 20 },
  gov: { sky: 0, horizon: [8, 9, 10, 11], below: 16 },
};
// ground tile rows (see Tilesheet (Tiles).txt): the top row of a block, then plain dirt
const GROUND = { macro: 40, gov: 80 };

/**
 * @param {Phaser.Scene} scene
 * @param {ReturnType<import("../logic/grid.js").parseGrid>} grid
 * @param {{wings: {x:number,y:number,w:number,h:number,wing:"macro"|"gov"}[], seed?: string, rs: number,
 *          doors?: {x:number,y:number,kind:"vault"|"chamber",lit?:boolean}[]}} opts  doors: bottom-center in world units
 */
export function buildArchive(scene, grid, { wings, seed = "archive", rs, doors = [] }) {
  const key = `archive-${scene.sys.settings.key}`; // one set per scene, replaced when the next level builds its own
  const wingAt = (x, y) => (wings.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) || wings[0]).wing;
  const layer = (name, draw, overscan, depth) => {
    const cv = document.createElement("canvas");
    cv.width = Math.round((WORLD_W + 2 * overscan) * rs);
    cv.height = Math.round((WORLD_H + 2 * overscan) * rs);
    const ctx = cv.getContext("2d");
    ctx.scale(rs, rs);
    ctx.translate(overscan, overscan);
    draw(ctx, createRng(`${seed}-${name}`));
    if (scene.textures.exists(`${key}-${name}`)) scene.textures.remove(`${key}-${name}`);
    scene.textures.addCanvas(`${key}-${name}`, cv);
    return scene.add.image(-overscan, -overscan, `${key}-${name}`).setOrigin(0).setScale(1 / rs).setDepth(depth);
  };
  const far = layer("far", (ctx, rng) => wings.forEach((r) => region(ctx, r, OV, () => sky(ctx, r, rng))), OV, DEPTH.far);
  layer("tiles", (ctx) => drawTiles(ctx, grid, wingAt), 0, DEPTH.tiles);

  const doorObjs = doors.map((d) => new Door(scene, d));
  // one wooden motto sign over both exits
  const motto = mottoRect(doors, DOOR);
  if (motto) {
    if (scene.textures.exists(`${key}-motto`)) scene.textures.remove(`${key}-motto`);
    scene.textures.addCanvas(`${key}-motto`, mottoSign(motto.w));
    scene.add.image(motto.x, motto.y, `${key}-motto`).setOrigin(0).setScale(1 / PROP_RES).setDepth(DEPTH.doors);
  }

  return {
    doors: doorObjs,
    motto,
    wingAt,
    /** Parallax from the heroes' average position (held still with reduce motion). */
    update(tick, heroes = []) {
      if (prefs.get("reduceMotion") || !heroes.length) { far.setPosition(-OV, -OV); return; }
      const ax = heroes.reduce((s, h) => s + h.x, 0) / heroes.length;
      const ay = heroes.reduce((s, h) => s + h.y, 0) / heroes.length;
      far.setPosition(-OV - (ax - WORLD_W / 2) * 0.02, -OV - (ay - WORLD_H / 2) * 0.015);
    },
  };
}

function region(ctx, r, ov, draw) {
  ctx.save();
  ctx.beginPath();
  // regions on the screen edge extend into the overscan
  const x0 = r.x <= 0 ? -ov : r.x, y0 = r.y <= 0 ? -ov : r.y;
  const x1 = r.x + r.w >= WORLD_W ? WORLD_W + ov : r.x + r.w, y1 = r.y + r.h >= WORLD_H ? WORLD_H + ov : r.y + r.h;
  ctx.rect(x0, y0, x1 - x0, y1 - y0);
  ctx.clip();
  draw();
  ctx.restore();
}

/** Sky down to a band of hills two thirds of the way down the wing, then the ground color under it. */
function sky(ctx, r, rng) {
  const S = SKY[r.wing];
  const horizon = r.y + Math.round((r.h * 0.62) / BG) * BG;
  const y0 = horizon - Math.ceil((horizon + OV) / BG) * BG; // rows line up with the horizon row
  for (let y = y0; y < WORLD_H + OV; y += BG) {
    if (y + BG < r.y - OV || y > r.y + r.h + OV) continue;
    for (let x = -OV - BG; x < WORLD_W + OV; x += BG) {
      const id = y < horizon ? S.sky : y === horizon ? S.horizon[Math.floor(rng.range(0, S.horizon.length))] : S.below;
      drawTile(ctx, id, x, y, BG + 0.5, BG + 0.5, "bg"); // a hair of overlap, so no seams show
    }
  }
}

/** Each solid cell picks its tile from its neighbours: a lip on top when open above, an edge where it ends. */
function drawTiles(ctx, grid, wingAt) {
  const { w, h, isSolid } = grid;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!isSolid(c, r)) continue;
      const x = c * TILE, y = r * TILE;
      const up = isSolid(c, r - 1), down = isSolid(c, r + 1), left = isSolid(c - 1, r), right = isSolid(c + 1, r);
      const across = left && right ? 2 : left ? 3 : right ? 1 : 0; // alone, left end, middle, right end
      const top = GROUND[wingAt(x + TILE / 2, y + TILE / 2)];
      const id = !up ? top + (down ? 20 : 0) + across : (down ? 120 : 140) + across;
      drawTile(ctx, id, x, y, TILE + 0.3, TILE + 0.3);
    }
  }
}

// ------------------------------------------------------------------------------------ doors

export class Door extends Phaser.GameObjects.Container {
  constructor(scene, { x, y, kind, lit = false }) {
    super(scene, x, y);
    this.kind = kind;
    this.img = scene.add.image(0, 0, `door-${kind}`).setOrigin(0.5, 1).setScale(1 / PROP_RES);
    this.add(this.img);
    this.setDepth(DEPTH.doors);
    scene.add.existing(this);
    this.setLit(lit);
  }

  /** The flag goes up when its hero steps in. */
  setLit(lit) {
    this.lit = lit;
    this.img.setTexture(`door-${this.kind}${lit ? "-lit" : ""}`);
    return this;
  }
}
