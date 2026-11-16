// The G0 look test, dev server only (`npm run dev`; the shipped build leaves it out). ?scene=look: both heroes in every pose on two strips of the Archive (Macro wing
// on top, Gov wing below), with the three pools, both exit doors, a Scogg Buck and a Gavel.
// ?scene=look&view=closeup: both heroes side by side in the dark with their glow.
// scripts/look-sheet.mjs saves both as PNGs; add &test=1 for the face checks.
import { BaseScene } from "./base.js";
import { Hero } from "../art/hero.js";
import { Pool, Pickup } from "../art/pool.js";
import { buildArchive, DEPTH } from "../art/archive.js";
import { PROP_RES } from "../art/textures.js";
import { PAL } from "../art/palette.js";
import { parseGrid } from "../logic/grid.js";
import { TILE, WORLD_W, WORLD_H } from "../logic/config.js";
import { faceCheck, sweepPoses } from "../art/hero.js";

const SHEET = [
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "#################III############",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "#################KKK#RRR########",
  "################################",
];
const WINGS = [
  { x: 0, y: 0, w: WORLD_W, h: 9 * TILE, wing: "macro" },
  { x: 0, y: 9 * TILE, w: WORLD_W, h: WORLD_H - 9 * TILE, wing: "gov" },
];

// pose, time into it (s), x, height off the floor
const POSES = [
  ["idle", 0.3, 64, 0],
  ["run", 0.08, 150, 0],
  ["jump", 0.05, 236, 30],
  ["fall", 0.2, 322, 16],
  ["death", 0.42, 420, 0],
];
const WIN_X = 760;

export class LookSheet extends BaseScene {
  constructor() { super("look"); }

  create() {
    this.setupCamera();
    this.heroes = [];
    if (new URLSearchParams(location.search).get("view") === "closeup") this.closeup();
    else this.sheet();
    window.__sbg = Object.assign(window.__sbg || {}, {
      scene: "look",
      ready: true,
      faceChecks: () => this.heroes.map(faceCheck),
      sweepPoses: () => sweepPoses([this.heroes.find((h) => h.who === "boy"), this.heroes.find((h) => h.who === "girl")]),
    });
  }

  hero(who, x, y, kind, t, tick, facing = 1) {
    const h = new Hero(this, x, y, who).setDepth(DEPTH.heroes);
    h.facing = facing;
    h.setPose(kind, t, tick);
    this.heroes.push(h);
    return h;
  }

  sheet() {
    const grid = parseGrid(SHEET);
    const doors = [
      { x: 868, y: 8 * TILE, kind: "vault", lit: true },
      { x: 878, y: 16 * TILE, kind: "chamber", lit: true },
    ];
    const archive = buildArchive(this, grid, { wings: WINGS, seed: "look", rs: this.rs, doors });
    grid.pools.forEach((p) => new Pool(this, p).draw(1.3));
    new Pickup(this, 18.5 * TILE, 8 * TILE - 34, "buck", PROP_RES).draw(0.4);
    new Pickup(this, 18.5 * TILE, 16 * TILE - 34, "gavel", PROP_RES).draw(0.4);

    this.tablet(14, 22, "THE SCOGGINS ARCHIVE  ·  look test, third pass", { size: 14, serif: true, origin: 0 });
    [["MACRO WING  ·  SCOGG BOY", 8, "boy"], ["GOV WING  ·  SCOGG GIRL", 16, "girl"]].forEach(([title, row, who]) => {
      this.tablet(14, row * TILE - 108 + (who === "boy" ? 10 : 0), title, { size: 11, serif: true, origin: 0 });
      const floor = row * TILE;
      POSES.forEach(([kind, t, x, lift], i) => {
        this.hero(who, x, floor - lift, kind, t, 1.1 + i * 0.37, who === "girl" ? -1 : 1);
        this.tablet(x, floor + 14, kind, { size: 10 });
      });
      this.hero(who, WIN_X, floor, "win", 0.6, 2.2, 1);
      this.tablet(WIN_X, floor + 14, "win", { size: 10 });
    });
    this.tablet(18.5 * TILE, 8 * TILE + 44, "Inflation: Boy is safe", { size: 10 });
    this.tablet(18.5 * TILE, 8 * TILE - 58, "Scogg Buck", { size: 10 });
    this.tablet(18.5 * TILE, 16 * TILE + 26, "Ink: Girl is safe", { size: 10 });
    this.tablet(18.5 * TILE, 16 * TILE - 58, "Gavel", { size: 10 });
    this.tablet(22.5 * TILE, 16 * TILE + 44, "Recession: nobody", { size: 10 });
    archive.update(1.3, this.heroes.filter((h) => h.kind !== "death"));
  }

  closeup() {
    // a strip of each wing's floor in the dark; the heroes are the light
    const grid = parseGrid([...Array(10).fill("................................"), ...Array(8).fill("################################")]);
    buildArchive(this, grid, { wings: [{ x: 0, y: 0, w: WORLD_W / 2, h: WORLD_H, wing: "macro" }, { x: WORLD_W / 2, y: 0, w: WORLD_W / 2, h: WORLD_H, wing: "gov" }], seed: "closeup", rs: this.rs })
      .update(2, []);
    this.add.rectangle(0, 0, WORLD_W, WORLD_H, PAL.void, 0.55).setOrigin(0).setDepth(DEPTH.vignette + 0.5);
    this.hero("boy", 452, 10 * TILE, "idle", 0.4, 2.0, 1);
    this.hero("girl", 508, 10 * TILE, "idle", 0.4, 2.3, -1);
    this.cameras.main.setZoom(this.rs * 3).centerOn(480, 10 * TILE - 30);
  }
}
