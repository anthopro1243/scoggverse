// Textures made once at boot: light glows, embers, the two exit doors, the Scogg Buck and the Gavel,
// the end card (and, per chamber, the motto sign over the exits). The doors and the coin are Kenney
// tiles (CC0); the gavel is a few pixels in Kenney's colors. Props are made at PROP_RES times their
// world size so they stay sharp under the camera zoom; display them with setScale(1 / PROP_RES).
import { PAL, css, rgba, SERIF, FONT } from "./palette.js";
import { MOTTO_SIGN } from "../logic/config.js";
import { drawTile, tileCanvas, KP } from "./kenney.js";

export const PROP_RES = 4;
// world units, bottom = floor: a Kenney door (1 x 2 tiles) and its flagpole, shown 2.5x
export const DOOR = { vault: { w: 96, h: 91 }, chamber: { w: 92, h: 91 } };
const DOOR_CELL = 45;
const MOTTO = ["DON'T DENY YOURSELF", "AN EDUCATION"];

function canvas(w, h, res = PROP_RES) {
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(w * res); cv.height = Math.ceil(h * res);
  const ctx = cv.getContext("2d");
  ctx.scale(res, res);
  return { cv, ctx };
}

export function makeTextures(scene) {
  const add = (key, cv) => { if (!scene.textures.exists(key)) scene.textures.addCanvas(key, cv); };
  add("glow-boy", glow(PAL.boy.glow));
  add("glow-girl", glow(PAL.girl.glow));
  add("ember-dollar", ember());
  add("door-vault", door("tiles", false));
  add("door-vault-lit", door("tiles", true));
  add("door-chamber", door("blue", false));
  add("door-chamber-lit", door("blue", true));
  add("buck", tileCanvas([[151]], 18, PROP_RES));
  add("gavel", gavel());
  add("crate", tileCanvas([[26]], 18, PROP_RES));
  add("parchment", parchment());
}

/** Soft radial light, 128 px across (displayed at world scale ~1.25 -> ~80 px radius). */
function glow(color) {
  const { cv, ctx } = canvas(128, 128, 1);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, rgba(color, 0.55));
  g.addColorStop(0.35, rgba(color, 0.22));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return cv;
}

function ember() {
  const { cv, ctx } = canvas(12, 14, 4);
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(255,140,40,0.9)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = css(PAL.boy.hot);
  ctx.fillText("$", 6, 11);
  return cv;
}

/**
 * A Kenney door with a flagpole beside it; the flag is up once its hero is in.
 * Scogg Boy's flag is Kenney's red one, Scogg Girl's the same flag in blue.
 */
function door(flagSheet, lit) {
  const { w, h } = DOOR.vault;
  const { cv, ctx } = canvas(w, h);
  const x = (w - DOOR_CELL * 2) / 2, y = h - DOOR_CELL * 2;
  drawTile(ctx, 130, x, y, DOOR_CELL);
  drawTile(ctx, 150, x, y + DOOR_CELL, DOOR_CELL);
  drawTile(ctx, lit ? 111 : 131, x + DOOR_CELL, y, DOOR_CELL, DOOR_CELL, flagSheet);
  drawTile(ctx, 131, x + DOOR_CELL, y + DOOR_CELL, DOOR_CELL);
  return cv;
}

/** The motto over the exits: a plank sign with the motto in Kenney's pixel font. One line when it fits. */
export function mottoSign(w) {
  const h = MOTTO_SIGN.h;
  const { cv, ctx } = canvas(w, h);
  ctx.fillStyle = KP.outline; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = KP.woodLit; ctx.fillRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = KP.wood; ctx.fillRect(2, h / 2, w - 4, 1); ctx.fillRect(2, h - 4, w - 4, 2);
  ctx.fillStyle = KP.sand; ctx.fillRect(2, 2, w - 4, 1.5);
  ctx.fillStyle = KP.woodDark;
  for (const nx of [5, w - 7]) { ctx.fillRect(nx, 5, 2, 2); ctx.fillRect(nx, h - 8, 2, 2); }   // nails
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  let size = 26;
  ctx.font = `${size}px ${SERIF}`;
  const line = MOTTO.join(" ");
  if (ctx.measureText(line).width <= w - 20) { ctx.fillText(line, w / 2, h / 2 + 1); return cv; }
  size = (h - 4) * 0.55; // two lines have to share the plank
  ctx.font = `${size}px ${SERIF}`;
  const widest = Math.max(...MOTTO.map((m) => ctx.measureText(m).width));
  if (widest > w - 16) size *= (w - 16) / widest;
  ctx.font = `${size}px ${SERIF}`;
  ctx.fillText(MOTTO[0], w / 2, h / 2 - size * 0.42);
  ctx.fillText(MOTTO[1], w / 2, h / 2 + size * 0.5);
  return cv;
}

/**
 * A best-grade stamp for the level select: two red rings and the letter, tilted like a hand stamp.
 * The tilt is drawn into the texture: Phaser 4.2.1 renders a rotated Text only partly (half an "A").
 */
export function stampTexture(scene, grade, color, radius = 25) {
  const key = `stamp-${grade}-${radius}`;
  if (scene.textures.exists(key)) return key;
  const k = radius / 25, S = Math.ceil(radius * 2 + 10), c = S / 2;
  const { cv, ctx } = canvas(S, S);
  ctx.strokeStyle = css(color, 0.9); ctx.lineWidth = 2.4 * k;
  ctx.beginPath(); ctx.arc(c, c, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = css(color, 0.8); ctx.lineWidth = k;
  ctx.beginPath(); ctx.arc(c, c, 21 * k, 0, Math.PI * 2); ctx.stroke();
  ctx.translate(c, c); ctx.rotate(-0.2);
  ctx.font = `${Math.round(40 * k)}px ${SERIF}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = css(color, 0.92);
  ctx.fillText(grade, 0, 2 * k);
  scene.textures.addCanvas(key, cv);
  return key;
}

// A gavel in 12 x 12 pixels, Kenney's outline and wood colors with a blue band (Scogg Girl's pickup).
const GAVEL_PX = [
  "..oooooo....",
  ".oLLLLLLo...",
  ".obbbbbbo...",
  ".oLWWWWLo...",
  ".obbbbbbo...",
  ".oDDDDDDo...",
  "..oooooooo..",
  "......oWLo..",
  ".......oWLo.",
  "........oWLo",
  ".........oDo",
  "..........o.",
];
const GAVEL_COLORS = { o: KP.outline, L: KP.woodLit, W: KP.sand, D: KP.woodDark, b: "#2cc5f6" };

function gavel() {
  const px = 18 / GAVEL_PX.length;
  const { cv, ctx } = canvas(18, 18);
  GAVEL_PX.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === ".") return;
    ctx.fillStyle = GAVEL_COLORS[ch];
    ctx.fillRect(c * px, r * px, px + 0.02, px + 0.02);
  }));
  return cv;
}

/** The end card: a light wooden board with a dark outline, 400 x 270 world units (drawn at 2x). */
function parchment() {
  const W = 400, H = 270;
  const { cv, ctx } = canvas(W, H, 2);
  ctx.fillStyle = KP.outline; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = KP.woodDark; ctx.fillRect(3, 3, W - 6, H - 6);
  ctx.fillStyle = "#2a2433"; ctx.fillRect(9, 9, W - 18, H - 18);
  ctx.fillStyle = KP.woodDark;
  for (const [x, y] of [[15, 15], [W - 19, 15], [15, H - 19], [W - 19, H - 19]]) ctx.fillRect(x, y, 4, 4);
  return cv;
}
